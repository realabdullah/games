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
	CORRECT_POINTS,
	FOOLED_POINTS,
	INTRO_MS,
	REVEAL_MS,
	icebreakers,
	type IcebreakersState,
	type IcebreakersView
} from './index.ts';

const pack: PromptPack = {
	id: 'test',
	title: 'Test',
	items: ['Prompt A', 'Prompt B', 'Prompt C']
};
const players = [
	{ id: 'ada', name: 'Ada', avatar: '🦊' },
	{ id: 'bob', name: 'Bob', avatar: '🐸' },
	{ id: 'cy', name: 'Cy', avatar: '🐙' }
];
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;
const host: Actor = { kind: 'host' };

function setup(config: Partial<IcebreakersState['config']> = {}): GameSession {
	return startGame(icebreakers, {
		mode: 'party',
		players,
		content: pack,
		config: { rounds: 1, writeSeconds: 30, guessSeconds: 10, familyFilter: true, ...config },
		seed: 7,
		now: 0
	});
}
const state = (s: GameSession) => s.state as IcebreakersState;
const send = (
	s: GameSession,
	actor: Exclude<Actor, { kind: 'system' }>,
	action: unknown,
	now = INTRO_MS,
	active = ids
) => stepFromClient(icebreakers, s, action, actor, { now, active });
const tick = (s: GameSession, now: number, active = ids) =>
	stepSystem(icebreakers, s, { type: 'tick' }, { now, active });
const view = (s: GameSession, v: Parameters<typeof viewFor>[2]) =>
	viewFor(icebreakers, s, v) as IcebreakersView;

function allAnswer(s: GameSession) {
	tick(s, INTRO_MS);
	send(s, p('ada'), { type: 'answer', text: 'Learn the cello' });
	send(s, p('bob'), { type: 'answer', text: 'Pottery' });
	send(s, p('cy'), { type: 'answer', text: 'Skydiving' });
}

describe('writing', () => {
	test('starts writing after the intro, with a prompt', () => {
		const s = setup();
		tick(s, INTRO_MS);
		expect(state(s).phase).toBe('write');
		expect(pack.items).toContain(view(s, { kind: 'host' }).prompt!);
	});

	test('moves to guessing once everyone has answered', () => {
		const s = setup();
		allAnswer(s);
		expect(state(s).phase).toBe('guess');
		expect(state(s).order.toSorted()).toEqual(ids.toSorted());
	});

	test('answers are trimmed, capped, and censored when the filter is on', () => {
		const s = setup();
		tick(s, INTRO_MS);
		send(s, p('ada'), { type: 'answer', text: '   this   is shit  ' });
		expect(state(s).answers.ada).toStartWith('this is ');
		expect(state(s).answers.ada).not.toContain('shit');
		send(s, p('bob'), { type: 'answer', text: 'x'.repeat(500) });
		expect(state(s).answers.bob).toHaveLength(140);
	});

	test('leaves answers alone when the filter is off', () => {
		const s = setup({ familyFilter: false });
		tick(s, INTRO_MS);
		send(s, p('ada'), { type: 'answer', text: 'this is shit' });
		expect(state(s).answers.ada).toBe('this is shit');
	});

	test('ignores empty, repeat and late answers', () => {
		const s = setup();
		tick(s, INTRO_MS);
		expect(send(s, p('ada'), { type: 'answer', text: '   ' })).toBe(false);
		send(s, p('ada'), { type: 'answer', text: 'one' });
		expect(send(s, p('ada'), { type: 'answer', text: 'two' })).toBe(false);
		expect(send(s, p('bob'), { type: 'answer', text: 'late' }, INTRO_MS + 30_000)).toBe(false);
	});

	test('skips guessing entirely if nobody answers', () => {
		const s = setup();
		tick(s, INTRO_MS);
		tick(s, INTRO_MS + 30_000);
		expect(state(s).phase).toBe('final');
	});
});

describe('guessing', () => {
	test('the author cannot guess, and nobody can guess themselves', () => {
		const s = setup();
		allAnswer(s);
		const author = state(s).order[0]!;
		const other = ids.find((id) => id !== author)!;
		expect(send(s, p(author), { type: 'guess', playerId: other })).toBe(false);
		expect(send(s, p(other), { type: 'guess', playerId: other })).toBe(false);
		expect(send(s, p(other), { type: 'guess', playerId: 'nobody' })).toBe(false);
		expect(view(s, { kind: 'player', playerId: author }).you?.isAuthor).toBe(true);
	});

	test('the author stays secret until the reveal', () => {
		const s = setup();
		allAnswer(s);
		const author = state(s).order[0]!;
		for (const v of [
			view(s, { kind: 'host' }),
			view(s, { kind: 'player', playerId: ids.find((i) => i !== author)! })
		]) {
			expect(v.reveal).toBeNull();
			expect(v.current?.text).toBe(state(s).answers[author]!);
		}
		// Nothing in the host view ties the answer to its author.
		expect(JSON.stringify(view(s, { kind: 'host' }).current)).not.toContain(author);
	});

	test('scores correct guesses and rewards the author for each player fooled', () => {
		const s = setup();
		allAnswer(s);
		const author = state(s).order[0]!;
		const [g1, g2] = ids.filter((id) => id !== author) as [string, string];
		send(s, p(g1), { type: 'guess', playerId: author });
		send(s, p(g2), { type: 'guess', playerId: g1 });
		expect(state(s).phase).toBe('reveal');
		expect(state(s).lastPoints).toEqual({ [g1]: CORRECT_POINTS, [author]: FOOLED_POINTS });

		const v = view(s, { kind: 'host' });
		expect(v.reveal?.author.id).toBe(author);
		expect(v.reveal?.correct).toEqual([g1]);
		expect(v.reveal?.fooled).toBe(1);
	});

	test('works through every answer, then ends', () => {
		const s = setup();
		allAnswer(s);
		let now = INTRO_MS;
		for (let i = 0; i < 3; i++) {
			expect(state(s).phase).toBe('guess');
			expect(view(s, { kind: 'host' }).current?.number).toBe(i + 1);
			now += 10_000;
			tick(s, now);
			expect(state(s).phase).toBe('reveal');
			now += REVEAL_MS;
			tick(s, now);
		}
		expect(state(s).phase).toBe('final');
		expect(view(s, { kind: 'host' }).leaderboard).toHaveLength(3);
	});

	test('a guesser leaving can complete the round', () => {
		const s = setup();
		allAnswer(s);
		const author = state(s).order[0]!;
		const [g1, g2] = ids.filter((id) => id !== author) as [string, string];
		send(s, p(g1), { type: 'guess', playerId: author });
		stepSystem(
			icebreakers,
			s,
			{ type: 'roster' },
			{ now: INTRO_MS, active: ids.filter((i) => i !== g2) }
		);
		expect(state(s).phase).toBe('reveal');
	});

	test('audience guesses are kept separate and unscored', () => {
		const s = setup();
		allAnswer(s);
		const author = state(s).order[0]!;
		send(s, { kind: 'audience', audienceId: 'x' }, { type: 'guess', playerId: author });
		expect(state(s).audienceGuesses).toEqual({ x: author });
		expect(Object.keys(state(s).guesses)).toHaveLength(0);
	});

	test('the host can skip ahead; players cannot', () => {
		const s = setup();
		expect(send(s, p('ada'), { type: 'next' }, 0)).toBe(false);
		expect(send(s, host, { type: 'next' }, 0)).toBe(true);
		expect(state(s).phase).toBe('write');
	});
});

test('multiple rounds use different prompts', () => {
	const s = setup({ rounds: 2 });
	expect(new Set(state(s).prompts).size).toBe(2);
	allAnswer(s);
	let now = INTRO_MS;
	for (let i = 0; i < 3; i++) {
		now += 10_000;
		tick(s, now);
		now += REVEAL_MS;
		tick(s, now);
	}
	expect(state(s).phase).toBe('write');
	expect(state(s).round).toBe(1);
	expect(state(s).answers).toEqual({});
});
