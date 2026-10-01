import { beforeEach, describe, expect, test } from 'bun:test';
import type { TriviaPackDraft } from '@games/content';
import type { CreatedPackResponse, EditPackResponse, PackSummary } from '@games/protocol';
import { AiQuota, toDraft, topicKey, type GenerateRequest, type PackGenerator } from './ai.ts';
import { openDb } from './db/index.ts';
import { createRegistry } from './games.ts';
import { createApi } from './http.ts';
import { PackStore } from './packs.ts';
import { RateLimiter } from './rate-limit.ts';
import { RoomManager } from './rooms.ts';

const draft: TriviaPackDraft = {
	title: 'Office Trivia',
	description: 'How well do you know the team?',
	emoji: '🏢',
	language: 'en',
	questions: [
		{ q: 'Which floor is the kitchen on?', choices: ['1', '2', '3', '4'], answer: 1 },
		{ q: 'Who has been here longest?', choices: ['Ada', 'Bob', 'Cy'], answer: 0 },
		{ q: 'What is the wifi name?', choices: ['Office', 'Guest'], answer: 0, fact: 'Hi' }
	]
};

class FakeGenerator implements PackGenerator {
	calls: GenerateRequest[] = [];
	fail = false;
	async generate(req: GenerateRequest) {
		this.calls.push(req);
		if (this.fail) throw new Error('boom');
		return { ...draft, title: `AI: ${req.topic}` };
	}
}

let api: ReturnType<typeof createApi>;
let generator: FakeGenerator;
let packs: PackStore;
let rooms: RoomManager;

function setup({ withAi = true, perClient = 2 } = {}) {
	const db = openDb(':memory:');
	packs = new PackStore(db);
	generator = new FakeGenerator();
	rooms = new RoomManager(
		{ roomChanged() {}, youChanged() {}, sessionEnded() {}, gameChanged() {}, streamed() {} },
		Date.now,
		Math.random,
		() => crypto.randomUUID(),
		createRegistry(packs)
	);
	api = createApi({
		rooms,
		packs,
		limiter: new RateLimiter({ windowMs: 60_000, max: 1000 }),
		ai: withAi ? { generator, quota: new AiQuota(db, { perClient, total: 100 }) } : null
	});
}
beforeEach(() => setup());

async function call<T = unknown>(
	method: string,
	path: string,
	opts: { body?: unknown; token?: string; ip?: string } = {}
): Promise<{ status: number; body: T }> {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (opts.token) headers.authorization = `Bearer ${opts.token}`;
	const res = await api(
		new Request(`http://test${path}`, {
			method,
			headers,
			body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
		}),
		opts.ip ?? '1.1.1.1'
	);
	return { status: res.status, body: res.status === 204 ? (null as T) : ((await res.json()) as T) };
}

const createPack = (pack: unknown = draft) =>
	call<CreatedPackResponse>('POST', '/api/packs', { body: { game: 'trivia', pack } });

describe('packs', () => {
	test('create returns a share code and a one-time edit token', async () => {
		const { status, body } = await createPack();
		expect(status).toBe(201);
		expect(body.summary).toMatchObject({
			title: 'Office Trivia',
			count: 3,
			source: 'custom',
			flagged: false
		});
		expect(body.summary.code).toMatch(/^[A-Z2-9]{6}$/);
		expect(body.editToken.length).toBeGreaterThan(20);
	});

	test('the public summary never includes questions', async () => {
		const { body: created } = await createPack();
		const { status, body } = await call<PackSummary>('GET', `/api/packs/${created.summary.code}`);
		expect(status).toBe(200);
		expect(JSON.stringify(body)).not.toContain('kitchen');
	});

	test('codes are case-insensitive', async () => {
		const { body: created } = await createPack();
		const { status } = await call('GET', `/api/packs/${created.summary.code.toLowerCase()}`);
		expect(status).toBe(200);
	});

	test('editing needs the token', async () => {
		const { body: created } = await createPack();
		const code = created.summary.code;
		expect((await call('GET', `/api/packs/${code}/edit`)).status).toBe(403);
		expect((await call('GET', `/api/packs/${code}/edit`, { token: 'wrong' })).status).toBe(403);

		const edit = await call<EditPackResponse>('GET', `/api/packs/${code}/edit`, {
			token: created.editToken
		});
		expect(edit.body.pack.questions[0]!.q).toBe('Which floor is the kitchen on?');

		const updated = await call<PackSummary>('PUT', `/api/packs/${code}`, {
			token: created.editToken,
			body: { game: 'trivia', pack: { ...draft, title: 'Renamed' } }
		});
		expect(updated.body.title).toBe('Renamed');

		expect((await call('DELETE', `/api/packs/${code}`, { token: 'nope' })).status).toBe(403);
		expect((await call('DELETE', `/api/packs/${code}`, { token: created.editToken })).status).toBe(
			204
		);
		expect((await call('GET', `/api/packs/${code}`)).status).toBe(404);
	});

	test('rejects invalid packs with a useful message', async () => {
		const tooFew = await createPack({ ...draft, questions: draft.questions.slice(0, 2) });
		expect(tooFew.status).toBe(400);
		expect(JSON.stringify(tooFew.body)).toContain('at least 3 questions');

		const badAnswer = await createPack({
			...draft,
			questions: [...draft.questions, { q: 'Broken?', choices: ['a', 'b'], answer: 5 }]
		});
		expect(badAnswer.status).toBe(400);
	});

	test('packs with profanity are saved but flagged', async () => {
		const { body } = await createPack({ ...draft, title: 'Shit questions' });
		expect(body.summary.flagged).toBe(true);
	});
});

describe('playing custom packs', () => {
	test('a host can start trivia with a pack code', async () => {
		const { body: created } = await createPack();
		const host = rooms.create({ mode: 'party' });
		rooms.join(host.code, { name: 'Ada', avatar: '🦊' });
		rooms.handle(host.session, { type: 'start', gameId: 'trivia', packId: created.summary.code });
		expect(rooms.info(host.code).phase).toBe('playing');
	});

	test('flagged packs need the family filter off', async () => {
		const { body: created } = await createPack({ ...draft, title: 'Shit questions' });
		const host = rooms.create({ mode: 'party' });
		rooms.join(host.code, { name: 'Ada', avatar: '🦊' });
		const start = () =>
			rooms.handle(host.session, { type: 'start', gameId: 'trivia', packId: created.summary.code });
		expect(start).toThrow('family filter');
		rooms.handle(host.session, { type: 'settings', familyFilter: false });
		start();
		expect(rooms.info(host.code).phase).toBe('playing');
	});
});

describe('AI packs', () => {
	const gen = (topic: string, ip = '1.1.1.1') =>
		call<CreatedPackResponse>('POST', '/api/ai/packs', { body: { topic, count: 5 }, ip });

	test('status reports whether AI is on and how many are left', async () => {
		expect((await call('GET', '/api/ai')).body).toEqual({ enabled: true, remaining: 2 });
		setup({ withAi: false });
		expect((await call('GET', '/api/ai')).body).toEqual({ enabled: false, remaining: 0 });
		expect((await gen('space')).status).toBe(503);
	});

	test('generates an editable pack', async () => {
		const { status, body } = await gen('Space exploration');
		expect(status).toBe(201);
		expect(body.summary).toMatchObject({ title: 'AI: Space exploration', source: 'ai' });
		expect(body.editToken).toBeTruthy();
		expect(generator.calls).toEqual([
			{ topic: 'Space exploration', count: 5, difficulty: 'medium' }
		]);
	});

	test('repeat requests reuse the earlier generation without spending quota', async () => {
		const first = await gen('Space exploration');
		const second = await gen('  space  EXPLORATION! ', '2.2.2.2');
		expect(generator.calls).toHaveLength(1);
		expect(second.body.summary.code).not.toBe(first.body.summary.code);
		expect(second.body.editToken).not.toBe(first.body.editToken);
		expect((await call('GET', '/api/ai', { ip: '2.2.2.2' })).body).toMatchObject({ remaining: 2 });
	});

	test('enforces the daily per-client limit', async () => {
		expect((await gen('one')).status).toBe(201);
		expect((await gen('two')).status).toBe(201);
		const third = await gen('three');
		expect(third.status).toBe(429);
		expect((await gen('four', '9.9.9.9')).status).toBe(201);
	});

	test('a failed generation gives the quota back', async () => {
		generator.fail = true;
		expect((await gen('one')).status).toBe(500);
		expect((await call('GET', '/api/ai')).body).toMatchObject({ remaining: 2 });
	});

	test('validates the topic', async () => {
		expect((await gen('x')).status).toBe(400);
	});
});

describe('model output handling', () => {
	const out = {
		suitable: true,
		title: 'Space',
		description: 'Stars and such',
		emoji: '🚀',
		questions: [
			{ q: 'Closest star?', choices: ['Sun', 'Sirius', 'Vega', 'Rigel'], answer: 0, fact: '' },
			{ q: 'Red planet?', choices: ['Mars', 'Venus', 'Earth', 'Jupiter'], answer: 0, fact: 'Rust' },
			{ q: 'Broken', choices: ['a', 'b'], answer: 7, fact: '' },
			{ q: 'Moons of Mars?', choices: ['1', '2', '3', '4'], answer: 1, fact: 'Phobos, Deimos' },
			{ q: 'Extra', choices: ['a', 'b', 'c', 'd'], answer: 2, fact: '' }
		]
	};

	test('drops malformed questions and trims to the requested count', () => {
		const pack = toDraft(out, 3);
		expect(pack.questions.map((q) => q.q)).toEqual([
			'Closest star?',
			'Red planet?',
			'Moons of Mars?'
		]);
		expect(pack.questions[0]!.fact).toBeUndefined();
	});

	test('rejects output that fails the family filter', () => {
		expect(() => toDraft({ ...out, title: 'Shit space' }, 3)).toThrow('family filter');
	});

	test('topic keys ignore case, spacing and punctuation', () => {
		const a = topicKey({ topic: 'Space Exploration!', count: 5, difficulty: 'easy' });
		const b = topicKey({ topic: '  space   exploration ', count: 5, difficulty: 'easy' });
		expect(a).toBe(b);
		expect(a).not.toBe(topicKey({ topic: 'space exploration', count: 10, difficulty: 'easy' }));
	});
});

describe('family filter in rooms', () => {
	test('blocks profane names while on', () => {
		const host = rooms.create({ mode: 'party' });
		expect(() => rooms.join(host.code, { name: 'shithead', avatar: '🦊' })).toThrow();
		expect(() => rooms.create({ mode: 'online', name: 'fuckface', avatar: '🦊' })).toThrow();
		expect(rooms.roomCount).toBe(1);
		rooms.handle(host.session, { type: 'settings', familyFilter: false });
		expect(rooms.join(host.code, { name: 'shithead', avatar: '🦊' }).you.role).toBe('player');
	});

	test('only the host can change settings', () => {
		const host = rooms.create({ mode: 'party' });
		const ada = rooms.join(host.code, { name: 'Ada', avatar: '🦊' });
		expect(() => rooms.handle(ada.session, { type: 'settings', familyFilter: false })).toThrow();
	});
});
