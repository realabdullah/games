import {
	CreateRoomBody,
	GeneratePackBody,
	JoinRoomBody,
	SavePackBody,
	v,
	type AiStatusResponse,
	type CreatedPackResponse,
	type ErrorCode,
	type ErrorResponse
} from '@games/protocol';
import { topicKey, type AiQuota, type PackGenerator } from './ai.ts';
import { ApiError } from './errors.ts';
import { Metrics } from './metrics.ts';
import type { PackStore } from './packs.ts';
import type { RateLimiter } from './rate-limit.ts';
import type { RoomManager } from './rooms.ts';

export interface ApiDeps {
	rooms: RoomManager;
	packs: PackStore;
	limiter: RateLimiter;
	/** Null when AI generation isn't configured (no API key). */
	ai: { generator: PackGenerator; quota: AiQuota } | null;
	metrics?: Metrics;
}

type Handler = (ctx: {
	req: Request;
	params: Record<string, string>;
	ip: string;
}) => Response | Promise<Response>;

const STATUS: Record<ErrorCode, number> = {
	bad_request: 400,
	session_invalid: 401,
	forbidden: 403,
	room_not_found: 404,
	not_found: 404,
	name_taken: 409,
	filtered: 422,
	rate_limited: 429,
	unavailable: 503
};

/**
 * The HTTP API (everything under /api). Returns a plain `(Request, ip) => Response`
 * so it's easy to test without a running server.
 */
export function createApi({ rooms, packs, limiter, ai, metrics = new Metrics() }: ApiDeps) {
	const limited = (ip: string) => {
		if (!limiter.allow(ip)) throw new ApiError('rate_limited', 'Slow down a little');
	};

	const routes: [method: string, pattern: string, handler: Handler][] = [
		// ----- rooms -----
		[
			'POST',
			'/api/rooms',
			async ({ req, ip }) => {
				limited(ip);
				return json(rooms.create(v.parse(CreateRoomBody, await readJson(req))), 201);
			}
		],
		['GET', '/api/rooms/:code', ({ params }) => json(rooms.info(params.code!))],
		[
			'POST',
			'/api/rooms/:code/join',
			async ({ req, params, ip }) => {
				limited(ip);
				return json(rooms.join(params.code!, v.parse(JoinRoomBody, await readJson(req))), 201);
			}
		],

		// ----- packs -----
		[
			'POST',
			'/api/packs',
			async ({ req, ip }) => {
				limited(ip);
				const body = v.parse(SavePackBody, await readJson(req));
				metrics.packsCreated.inc({ source: 'custom' });
				return json(packs.create(body.pack) satisfies CreatedPackResponse, 201);
			}
		],
		['GET', '/api/packs/:code', ({ params }) => json(packs.summary(params.code!))],
		[
			'GET',
			'/api/packs/:code/edit',
			({ req, params }) => json(packs.getForEdit(params.code!, bearer(req)))
		],
		[
			'PUT',
			'/api/packs/:code',
			async ({ req, params, ip }) => {
				limited(ip);
				const body = v.parse(SavePackBody, await readJson(req));
				return json(packs.update(params.code!, bearer(req), body.pack));
			}
		],
		[
			'DELETE',
			'/api/packs/:code',
			({ req, params }) => {
				packs.delete(params.code!, bearer(req));
				return new Response(null, { status: 204 });
			}
		],

		// ----- AI -----
		[
			'GET',
			'/api/ai',
			({ ip }) =>
				json({
					enabled: !!ai,
					remaining: ai ? ai.quota.remaining(ip) : 0
				} satisfies AiStatusResponse)
		],
		[
			'POST',
			'/api/ai/packs',
			async ({ req, ip }) => {
				if (!ai) throw new ApiError('unavailable', 'AI packs aren’t set up on this server');
				limited(ip);
				const body = v.parse(GeneratePackBody, await readJson(req));
				const key = topicKey(body);

				// Same request as before: copy the earlier result, no AI call, no quota used.
				const cached = packs.findGenerated(key);
				if (cached) {
					metrics.aiGenerations.inc({ result: 'cached' });
					return json(packs.create(cached, { source: 'ai', topicKey: key }), 201);
				}

				ai.quota.take(ip);
				try {
					const draft = await ai.generator.generate(body);
					metrics.aiGenerations.inc({ result: 'generated' });
					metrics.packsCreated.inc({ source: 'ai' });
					return json(packs.create(draft, { source: 'ai', topicKey: key }), 201);
				} catch (err) {
					ai.quota.release(ip);
					metrics.aiGenerations.inc({ result: err instanceof ApiError ? err.code : 'error' });
					throw err;
				}
			}
		]
	];

	const compiled = routes.map(([method, pattern, handler]) => ({
		method,
		regex: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
		handler
	}));

	return async function handle(req: Request, ip: string): Promise<Response> {
		const { pathname } = new URL(req.url);
		const matches = compiled.filter((r) => r.regex.test(pathname));
		if (matches.length === 0) return fail('not_found', 'Not found');
		const route = matches.find((r) => r.method === req.method);
		if (!route) return fail('bad_request', 'Method not allowed');
		try {
			const params = route.regex.exec(pathname)!.groups ?? {};
			return await route.handler({ req, params, ip });
		} catch (err) {
			return handleError(err, () => metrics.errors.inc({ where: 'http' }));
		}
	};
}

function json(body: unknown, status = 200) {
	return Response.json(body, { status });
}

function fail(code: ErrorCode, message: string) {
	return json({ error: { code, message } } satisfies ErrorResponse, STATUS[code]);
}

function handleError(err: unknown, onUnexpected?: () => void) {
	if (err instanceof ApiError) return fail(err.code, err.message);
	if (err instanceof v.ValiError) {
		const issue = err.issues[0];
		const path = issue?.path?.map((p: { key: unknown }) => p.key).join('.');
		return fail(
			'bad_request',
			path ? `${issue.message} (${path})` : (issue?.message ?? 'Invalid request')
		);
	}
	console.error(err);
	onUnexpected?.();
	return json({ error: { code: 'bad_request', message: 'Something went wrong' } }, 500);
}

async function readJson(req: Request) {
	try {
		return await req.json();
	} catch {
		throw new ApiError('bad_request', 'Expected a JSON body');
	}
}

/** Edit tokens travel as `Authorization: Bearer <token>`, never in URLs. */
function bearer(req: Request): string {
	return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
}
