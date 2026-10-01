import { mkdirSync } from 'node:fs';
import type { Server, ServerWebSocket } from 'bun';
import { CloseCode, parseClientMessage, type ServerMessage } from '@games/protocol';
import { AiQuota, ClaudePackGenerator } from './ai.ts';
import { openDb } from './db/index.ts';
import { ApiError } from './errors.ts';
import { createRegistry } from './games.ts';
import { createApi } from './http.ts';
import { PackStore } from './packs.ts';
import { RateLimiter } from './rate-limit.ts';
import { RoomManager } from './rooms.ts';
import { SnapshotStore } from './snapshot.ts';

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = process.env.DATA_DIR ?? './data';
const SNAPSHOT_MAX_AGE_MS = 15 * 60_000;
const AI_DAILY_PER_CLIENT = Number(process.env.AI_DAILY_PER_CLIENT ?? 5);
const AI_DAILY_TOTAL = Number(process.env.AI_DAILY_TOTAL ?? 100);

interface WsData {
	session: string;
}

mkdirSync(DATA_DIR, { recursive: true });
const db = openDb(`${DATA_DIR}/server.sqlite`);
const packs = new PackStore(db);

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

const rooms = new RoomManager(
	{
		roomChanged(code, room) {
			server?.publish(
				roomTopic(code),
				JSON.stringify({ type: 'room', room } satisfies ServerMessage)
			);
		},
		youChanged(session, you) {
			send(sockets.get(session), { type: 'you', you });
		},
		gameChanged(updates) {
			for (const { session, update } of updates)
				send(sockets.get(session), { type: 'game', ...update });
		},
		streamed(code, from, event) {
			server?.publish(
				roomTopic(code),
				JSON.stringify({ type: 'stream', from, event } satisfies ServerMessage)
			);
		},
		sessionEnded(session, reason) {
			const ws = sockets.get(session);
			if (!ws) return;
			send(ws, reason === 'kicked' ? { type: 'kicked' } : { type: 'closed', reason });
			sockets.delete(session);
			ws.close(closeCodeFor[reason], reason);
		}
	},
	Date.now,
	Math.random,
	() => crypto.randomUUID(),
	createRegistry(packs)
);
rooms.onCustomPackPlayed = (code) => packs.recordPlay(code);

const store = new SnapshotStore(`${DATA_DIR}/server.sqlite`);
const restored = store.take(SNAPSHOT_MAX_AGE_MS);
if (restored) {
	rooms.restore(restored);
	console.log(`restored ${restored.rooms.length} room(s) from snapshot`);
}

const limiter = new RateLimiter({ windowMs: 60_000, max: 30 });

const api = createApi({
	rooms,
	packs,
	limiter,
	// AI packs are on when an API key is configured.
	ai: process.env.ANTHROPIC_API_KEY
		? {
				generator: new ClaudePackGenerator(),
				quota: new AiQuota(db, { perClient: AI_DAILY_PER_CLIENT, total: AI_DAILY_TOTAL })
			}
		: null
});

function clientIp(req: Request, srv: Server<WsData>) {
	// Traefik sets X-Forwarded-For; the first entry is the original client.
	return (
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		srv.requestIP(req)?.address ??
		'unknown'
	);
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
		'/api/*': (req, srv) => api(req, clientIp(req, srv)),
		'/ws': (req, srv) => {
			const session = new URL(req.url).searchParams.get('session') ?? '';
			if (srv.upgrade(req, { data: { session } })) return;
			return new Response('Expected a WebSocket upgrade', { status: 426 });
		}
	},
	fetch: () => new Response('Not found', { status: 404 }),
	// Packs are small; anything bigger than this is a mistake or abuse.
	maxRequestBodySize: 512 * 1024,
	websocket: {
		data: {} as WsData,
		idleTimeout: 60,
		// Stroke batches and answers are small; refuse anything large.
		maxPayloadLength: 64 * 1024,
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
				if (err instanceof ApiError)
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

// Game timers: 4 checks a second is plenty for countdowns and costs nothing when idle.
const ticker = setInterval(() => rooms.tick(), 250);

const sweeper = setInterval(() => {
	rooms.sweep();
	limiter.sweep();
}, 5_000);

let shuttingDown = false;
function shutdown(signal: string) {
	if (shuttingDown) return;
	shuttingDown = true;
	clearInterval(sweeper);
	clearInterval(ticker);
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
