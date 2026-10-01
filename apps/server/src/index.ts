import { mkdirSync } from 'node:fs';
import type { Server, ServerWebSocket } from 'bun';
import {
	CloseCode,
	CreateRoomBody,
	JoinRoomBody,
	parseClientMessage,
	v,
	type ErrorCode,
	type ErrorResponse,
	type ServerMessage
} from '@games/protocol';
import { RoomError, RoomManager } from './rooms.ts';
import { SnapshotStore } from './snapshot.ts';
import { RateLimiter } from './rate-limit.ts';

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = process.env.DATA_DIR ?? './data';
const SNAPSHOT_MAX_AGE_MS = 15 * 60_000;

interface WsData {
	session: string;
}

const sockets = new Map<string, ServerWebSocket<WsData>>();
const roomTopic = (code: string) => `room:${code}`;
const send = (ws: ServerWebSocket<WsData> | undefined, msg: ServerMessage) =>
	ws?.send(JSON.stringify(msg));

const closeCodeFor = {
	kicked: CloseCode.Kicked,
	left: CloseCode.RoomClosed,
	expired: CloseCode.RoomClosed
};

let server: Server<WsData>;

const rooms = new RoomManager({
	roomChanged(code, room) {
		server?.publish(
			roomTopic(code),
			JSON.stringify({ type: 'room', room } satisfies ServerMessage)
		);
	},
	youChanged(session, you) {
		send(sockets.get(session), { type: 'you', you });
	},
	sessionEnded(session, reason) {
		const ws = sockets.get(session);
		if (!ws) return;
		send(ws, reason === 'kicked' ? { type: 'kicked' } : { type: 'closed', reason });
		sockets.delete(session);
		ws.close(closeCodeFor[reason], reason);
	}
});

mkdirSync(DATA_DIR, { recursive: true });
const store = new SnapshotStore(`${DATA_DIR}/server.sqlite`);
const restored = store.take(SNAPSHOT_MAX_AGE_MS);
if (restored) {
	rooms.restore(restored);
	console.log(`restored ${restored.rooms.length} room(s) from snapshot`);
}

const limiter = new RateLimiter({ windowMs: 60_000, max: 30 });

function json(body: unknown, status = 200) {
	return Response.json(body, { status });
}

function fail(code: ErrorCode, message: string) {
	const status = {
		bad_request: 400,
		room_not_found: 404,
		session_invalid: 401,
		name_taken: 409,
		forbidden: 403,
		rate_limited: 429
	}[code];
	return json({ error: { code, message } } satisfies ErrorResponse, status);
}

function handleError(err: unknown) {
	if (err instanceof RoomError) return fail(err.code, err.message);
	if (err instanceof v.ValiError)
		return fail('bad_request', err.issues[0]?.message ?? 'Invalid request');
	console.error(err);
	return json({ error: { code: 'bad_request', message: 'Something went wrong' } }, 500);
}

function clientIp(req: Request, srv: Server<WsData>) {
	// Traefik sets X-Forwarded-For; the first entry is the original client.
	return (
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		srv.requestIP(req)?.address ??
		'unknown'
	);
}

async function readJson(req: Request) {
	try {
		return await req.json();
	} catch {
		throw new RoomError('bad_request', 'Expected a JSON body');
	}
}

server = Bun.serve({
	port: PORT,
	routes: {
		'/health': new Response('ok'),
		'/metrics': () =>
			new Response(
				[
					'# TYPE games_rooms gauge',
					`games_rooms ${rooms.roomCount}`,
					'# TYPE games_connections gauge',
					`games_connections ${sockets.size}`,
					'# TYPE process_resident_memory_bytes gauge',
					`process_resident_memory_bytes ${process.memoryUsage().rss}`
				].join('\n') + '\n',
				{ headers: { 'content-type': 'text/plain; version=0.0.4' } }
			),
		'/api/rooms': {
			POST: async (req, srv) => {
				try {
					if (!limiter.allow(clientIp(req, srv))) return fail('rate_limited', 'Slow down a little');
					return json(rooms.create(v.parse(CreateRoomBody, await readJson(req))), 201);
				} catch (err) {
					return handleError(err);
				}
			}
		},
		'/api/rooms/:code': {
			GET: (req) => {
				try {
					return json(rooms.info(req.params.code));
				} catch (err) {
					return handleError(err);
				}
			}
		},
		'/api/rooms/:code/join': {
			POST: async (req, srv) => {
				try {
					if (!limiter.allow(clientIp(req, srv))) return fail('rate_limited', 'Slow down a little');
					return json(rooms.join(req.params.code, v.parse(JoinRoomBody, await readJson(req))), 201);
				} catch (err) {
					return handleError(err);
				}
			}
		},
		'/ws': (req, srv) => {
			const session = new URL(req.url).searchParams.get('session') ?? '';
			if (srv.upgrade(req, { data: { session } })) return;
			return new Response('Expected a WebSocket upgrade', { status: 426 });
		}
	},
	fetch: () => fail('bad_request', 'Not found'),
	websocket: {
		data: {} as WsData,
		idleTimeout: 60,
		sendPings: true,
		open(ws) {
			const { session } = ws.data;
			try {
				const welcome = rooms.connect(session);
				// One live socket per session: a new tab or reconnect replaces the old one.
				const prev = sockets.get(session);
				if (prev && prev !== ws) prev.close(CloseCode.Replaced, 'replaced');
				sockets.set(session, ws);
				ws.subscribe(roomTopic(welcome.room.code));
				send(ws, { type: 'welcome', ...welcome });
			} catch {
				ws.close(CloseCode.SessionInvalid, 'session invalid');
			}
		},
		message(ws, raw) {
			const msg = parseClientMessage(String(raw));
			if (!msg) {
				send(ws, { type: 'error', code: 'bad_request', message: 'Unknown message' });
				return;
			}
			try {
				rooms.handle(ws.data.session, msg);
			} catch (err) {
				if (err instanceof RoomError)
					send(ws, { type: 'error', code: err.code, message: err.message });
				else console.error(err);
			}
		},
		close(ws) {
			const { session } = ws.data;
			// Ignore closes from sockets that were already replaced or ended.
			if (sockets.get(session) !== ws) return;
			sockets.delete(session);
			rooms.disconnect(session);
		}
	}
});

const sweeper = setInterval(() => {
	rooms.sweep();
	limiter.sweep();
}, 5_000);

let shuttingDown = false;
function shutdown(signal: string) {
	if (shuttingDown) return;
	shuttingDown = true;
	clearInterval(sweeper);
	const snapshot = rooms.snapshot();
	if (snapshot.rooms.length > 0) store.save(snapshot);
	store.close();
	console.log(`${signal}: saved ${snapshot.rooms.length} room(s), shutting down`);
	server.stop(true);
	process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log(`game server listening on :${server.port}`);
