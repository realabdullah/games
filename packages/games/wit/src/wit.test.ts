import { describe, expect, test } from 'bun:test';
import type { PromptPack } from '@games/content';
import {
	startGame,
	stepFromClient,
	stepSystem,
	viewFor,
	type Actor,
	type GameSession
} from '@games/engine';
import {
	AUDIENCE_VOTE_POINTS,
	FORFEIT_POINTS,
	INTRO_MS,
	RESULT_MS,
	SWEEP_BONUS,
	VOTE_POINTS,
	wit,
	type WitState,
	type WitView
} from './index.ts';

const pack: PromptPack = {
	id: 'test',
	title: 'Test',
	items: Array.from({ length: 20 }, (_, i) => `Prompt ${i + 1}`)
};
const players = ['ada', 'bob', 'cy', 'dee'].map((id) => ({ id, name: id, avatar: 'rings' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;

function setup(config: Partial<WitState['config']> = {}): GameSession {
	return startGame(wit, {
		mode: 'party',
		players,
		content: pack,
		config: { rounds: 1, writeSeconds: 60, voteSeconds: 15, familyFilter: true, ...config },
		seed: 3,
		now: 0
	});
}
const state = (s: GameSession) => s.state as WitState;
const send = (
	s: GameSession,
	actor: Exclude<Actor, { kind: 'system' }>,
	action: unknown,
	now = INTRO_MS,
	active = ids
) => stepFromClient(wit, s, action, actor, { now, active });
const tick = (s: GameSession, now: number, active = ids) =>
	stepSystem(wit, s, { type: 'tick' }, { now, active });
const view = (s: GameSession, v: Parameters<typeof viewFor>[2]) => viewFor(wit, s, v) as WitView;

function answerAll(s: GameSession, skip: string[] = []) {
	state(s).matchups.forEach((m, i) => {
		for (const id of [m.a, m.b]) {
			if (!skip.includes(`${i}:${id}`))
				send(s, p(id), { type: 'answer', match: i, text: `${id} answer ${i}` });
		}
	});
}

describe('matchups', () => {
	test('every player answers exactly two prompts, each prompt has two different players', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const { matchups } = state(s);
		expect(matchups).toHaveLength(4);
		for (const m of matchups) expect(m.a).not.toBe(m.b);
		for (const id of ids) {
			expect(matchups.filter((m) => m.a === id || m.b === id)).toHaveLength(2);
			expect(view(s, { kind: 'player', playerId: id }).you?.prompts).toHaveLength(2);
		}
		expect(new Set(matchups.map((m) => m.prompt)).size).toBe(4);
	});

	test('players can only answer their own prompts, once', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const m = state(s).matchups[0]!;
		const outsider = ids.find((id) => id !== m.a && id !== m.b)!;
		expect(send(s, p(outsider), { type: 'answer', match: 0, text: 'hi' })).toBe(false);
		expect(send(s, p(m.a), { type: 'answer', match: 0, text: 'hi' })).toBe(true);
		expect(send(s, p(m.a), { type: 'answer', match: 0, text: 'again' })).toBe(false);
	});

	test('answers are censored with the filter on', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const m = state(s).matchups[0]!;
		send(s, p(m.a), { type: 'answer', match: 0, text: 'holy shit' });
		expect(state(s).answers[0]![m.a]).not.toContain('shit');
	});
});

describe('voting', () => {
	test('starts once every answer is in; writers cannot vote on their own matchup', () => {
		const s = setup();
		tick(s, INTRO_MS);
		answerAll(s);
		expect(state(s).phase).toBe('vote');
		const m = state(s).matchups[state(s).index]!;
		expect(send(s, p(m.a), { type: 'vote', side: 'a' })).toBe(false);
		expect(view(s, { kind: 'player', playerId: m.a }).you?.inMatchup).toBe(true);
	});

	test('authors stay anonymous while voting', () => {
		const s = setup();
		tick(s, INTRO_MS);
		answerAll(s);
		const v = view(s, { kind: 'host' });
		expect(v.result).toBeNull();
		expect(v.current?.a).toBeTruthy();
		expect(v.current?.b).toBeTruthy();
	});

	test('votes score; a clean sweep adds a bonus', () => {
		const s = setup();
		tick(s, INTRO_MS);
		answerAll(s);
		const m = state(s).matchups[state(s).index]!;
		const voterIds = ids.filter((id) => id !== m.a && id !== m.b);
		for (const id of voterIds) send(s, p(id), { type: 'vote', side: 'b' });
		expect(state(s).phase).toBe('result');
		expect(state(s).lastPoints[m.b]).toBe(voterIds.length * VOTE_POINTS + SWEEP_BONUS);
		expect(state(s).lastPoints[m.a]).toBe(0);
		expect(view(s, { kind: 'host' }).result?.sweep).toBe('b');
	});

	test('a split vote has no sweep; audience votes count for less', () => {
		const s = setup();
		tick(s, INTRO_MS);
		answerAll(s);
		const m = state(s).matchups[state(s).index]!;
		const [v1, v2] = ids.filter((id) => id !== m.a && id !== m.b) as [string, string];
		send(s, { kind: 'audience', audienceId: 'x' }, { type: 'vote', side: 'a' });
		send(s, p(v1), { type: 'vote', side: 'a' });
		send(s, p(v2), { type: 'vote', side: 'b' });
		expect(state(s).lastPoints).toEqual({
			[m.a]: VOTE_POINTS + AUDIENCE_VOTE_POINTS,
			[m.b]: VOTE_POINTS
		});
		expect(view(s, { kind: 'host' }).result).toMatchObject({
			sweep: null,
			a: { votes: 2 },
			b: { votes: 1 }
		});
	});

	test('a missing answer forfeits straight to the result', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const m0 = state(s).matchups[0]!;
		answerAll(s, [`0:${m0.b}`]);
		tick(s, INTRO_MS + 60_000);
		expect(state(s).phase).toBe('result');
		expect(state(s).index).toBe(0);
		expect(state(s).lastPoints).toEqual({ [m0.a]: FORFEIT_POINTS, [m0.b]: 0 });
	});

	test('runs every matchup, then ends', () => {
		const s = setup();
		tick(s, INTRO_MS);
		answerAll(s);
		let now = INTRO_MS;
		for (let i = 0; i < 4; i++) {
			expect(state(s).phase).toBe('vote');
			now += 15_000;
			tick(s, now);
			now += RESULT_MS;
			tick(s, now);
		}
		expect(state(s).phase).toBe('final');
	});
});

test('round two deals new prompts', () => {
	const s = setup({ rounds: 2 });
	tick(s, INTRO_MS);
	const first = state(s).matchups.map((m) => m.prompt);
	answerAll(s);
	let now = INTRO_MS;
	for (let i = 0; i < 4; i++) {
		now += 15_000;
		tick(s, now);
		now += RESULT_MS;
		tick(s, now);
	}
	expect(state(s).phase).toBe('write');
	expect(state(s).round).toBe(1);
	for (const m of state(s).matchups) expect(first).not.toContain(m.prompt);
});
