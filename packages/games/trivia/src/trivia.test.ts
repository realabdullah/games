import { describe, expect, test } from 'bun:test';
import type { TriviaPack } from '@games/content';
import { triviaPacks } from '@games/content';
import {
	startGame,
	stepFromClient,
	stepSystem,
	viewFor,
	type Actor,
	type GameSession
} from '@games/engine';
import {
	INTRO_MS,
	MAX_POINTS,
	REVEAL_MS,
	pointsFor,
	trivia,
	type TriviaState,
	type TriviaView
} from './index.ts';

const pack: TriviaPack = {
	id: 'test',
	title: 'Test Pack',
	description: '',
	language: 'en',
	questions: [
		{ q: 'Q1', choices: ['a', 'b', 'c', 'd'], answer: 0 },
		{ q: 'Q2', choices: ['a', 'b', 'c', 'd'], answer: 1, fact: 'fun fact' },
		{ q: 'Q3', choices: ['a', 'b'], answer: 1 }
	]
};

const players = [
	{ id: 'ada', name: 'Ada', avatar: '🦊' },
	{ id: 'bob', name: 'Bob', avatar: '🐸' }
];
const ids = players.map((p) => p.id);
const host: Actor = { kind: 'host' };
const ada = { kind: 'player', playerId: 'ada', vip: false } as const;
const bob = { kind: 'player', playerId: 'bob', vip: false } as const;

function setup(now = 0, questionCount = 3): GameSession {
	return startGame(trivia, {
		mode: 'party',
		players,
		content: pack,
		config: { questionCount, secondsPerQuestion: 10 },
		seed: 1,
		now
	});
}

const state = (s: GameSession) => s.state as TriviaState;
const correct = (s: GameSession) => state(s).questions[state(s).index]!.answer;
const wrong = (s: GameSession) =>
	(correct(s) + 1) % state(s).questions[state(s).index]!.choices.length;
const send = (
	s: GameSession,
	actor: Exclude<Actor, { kind: 'system' }>,
	action: unknown,
	now: number,
	active = ids
) => stepFromClient(trivia, s, action, actor, { now, active });
const tick = (s: GameSession, now: number, active = ids) =>
	stepSystem(trivia, s, { type: 'tick' }, { now, active });
const view = (s: GameSession, v: Parameters<typeof viewFor>[2]) =>
	viewFor(trivia, s, v) as TriviaView;

describe('setup', () => {
	test('shuffles choices but keeps the right answer', () => {
		const s = setup();
		for (const q of state(s).questions) {
			const original = pack.questions.find((p) => p.q === q.q)!;
			expect(q.choices[q.answer]).toBe(original.choices[original.answer]!);
			expect(q.choices.toSorted()).toEqual(original.choices.toSorted());
		}
	});

	test('same seed gives the same game', () => {
		expect(setup().state).toEqual(setup().state);
	});

	test('caps question count to the pack size', () => {
		expect(state(setup(0, 50)).questions).toHaveLength(3);
	});
});

describe('flow', () => {
	test('intro → question on deadline, not before', () => {
		const s = setup();
		expect(tick(s, INTRO_MS - 1)).toBe(false);
		tick(s, INTRO_MS);
		expect(state(s).phase).toBe('question');
	});

	test('reveals early when everyone has answered', () => {
		const s = setup();
		tick(s, INTRO_MS);
		send(s, ada, { type: 'answer', choice: correct(s) }, INTRO_MS + 1000);
		expect(state(s).phase).toBe('question');
		send(s, bob, { type: 'answer', choice: wrong(s) }, INTRO_MS + 2000);
		expect(state(s).phase).toBe('reveal');
	});

	test('reveals on the deadline with missing answers', () => {
		const s = setup();
		tick(s, INTRO_MS);
		send(s, ada, { type: 'answer', choice: correct(s) }, INTRO_MS + 1000);
		tick(s, INTRO_MS + 10_000);
		expect(state(s).phase).toBe('reveal');
		expect(state(s).lastPoints.bob).toBe(0);
	});

	test('a player leaving can complete the round', () => {
		const s = setup();
		tick(s, INTRO_MS);
		send(s, ada, { type: 'answer', choice: correct(s) }, INTRO_MS + 1000);
		stepSystem(trivia, s, { type: 'roster' }, { now: INTRO_MS + 1500, active: ['ada'] });
		expect(state(s).phase).toBe('reveal');
	});

	test('runs through to the final screen', () => {
		const s = setup();
		let now = INTRO_MS;
		tick(s, now);
		for (let i = 0; i < 3; i++) {
			now += 10_000;
			tick(s, now);
			expect(state(s).phase).toBe('reveal');
			now += REVEAL_MS;
			tick(s, now);
		}
		expect(state(s).phase).toBe('final');
		expect(trivia.isOver(state(s))).toBe(true);
		expect(trivia.nextDeadline(state(s))).toBeNull();
	});

	test('only the controller can skip ahead', () => {
		const s = setup();
		expect(send(s, ada, { type: 'next' }, 0)).toBe(false);
		expect(send(s, host, { type: 'next' }, 0)).toBe(true);
		expect(state(s).phase).toBe('question');
		const vip = { kind: 'player', playerId: 'ada', vip: true } as const;
		expect(send(s, vip, { type: 'next' }, 1)).toBe(true);
		expect(state(s).phase).toBe('reveal');
	});
});

describe('answers', () => {
	test('first answer counts; changes and late answers are ignored', () => {
		const s = setup();
		tick(s, INTRO_MS);
		send(s, ada, { type: 'answer', choice: 0 }, INTRO_MS + 100);
		expect(send(s, ada, { type: 'answer', choice: 1 }, INTRO_MS + 200)).toBe(false);
		expect(state(s).answers.ada?.choice).toBe(0);
		expect(send(s, bob, { type: 'answer', choice: 0 }, INTRO_MS + 10_000)).toBe(false);
	});

	test('rejects malformed actions and out-of-range choices', () => {
		const s = setup();
		tick(s, INTRO_MS);
		expect(send(s, ada, { type: 'answer', choice: 9 }, INTRO_MS + 1)).toBe(false);
		expect(send(s, ada, { type: 'answer', choice: '1' }, INTRO_MS + 1)).toBe(false);
		expect(send(s, ada, { type: 'cheat' }, INTRO_MS + 1)).toBe(false);
		expect(send(s, ada, null, INTRO_MS + 1)).toBe(false);
	});

	test('late joiners cannot answer and watch without a score', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const late = { kind: 'player', playerId: 'zed', vip: false } as const;
		expect(send(s, late, { type: 'answer', choice: 0 }, INTRO_MS + 1)).toBe(false);
		expect(view(s, { kind: 'player', playerId: 'zed' }).you).toBeNull();
	});

	test('audience answers are tallied but not scored', () => {
		const s = setup();
		tick(s, INTRO_MS);
		send(
			s,
			{ kind: 'audience', audienceId: 'x' },
			{ type: 'answer', choice: correct(s) },
			INTRO_MS + 1
		);
		send(
			s,
			{ kind: 'audience', audienceId: 'y' },
			{ type: 'answer', choice: wrong(s) },
			INTRO_MS + 1
		);
		tick(s, INTRO_MS + 10_000);
		expect(view(s, { kind: 'host' }).reveal?.audienceCorrectPct).toBe(50);
		expect(state(s).scores).toEqual({ ada: 0, bob: 0 });
	});
});

describe('scoring', () => {
	test('faster correct answers score more', () => {
		expect(pointsFor(0, 10_000, 0)).toBe(MAX_POINTS);
		expect(pointsFor(10_000, 10_000, 0)).toBe(MAX_POINTS / 2);
		expect(pointsFor(2_000, 10_000, 0)).toBeGreaterThan(pointsFor(8_000, 10_000, 0));
	});

	test('streaks add a capped bonus', () => {
		expect(pointsFor(0, 10_000, 1)).toBe(MAX_POINTS + 100);
		expect(pointsFor(0, 10_000, 10)).toBe(MAX_POINTS + 300);
	});

	test('wrong answers score nothing and reset the streak', () => {
		const s = setup();
		let now = INTRO_MS;
		tick(s, now);
		send(s, ada, { type: 'answer', choice: correct(s) }, now);
		send(s, bob, { type: 'answer', choice: wrong(s) }, now);
		expect(state(s).scores.ada).toBe(MAX_POINTS);
		expect(state(s).scores.bob).toBe(0);
		expect(state(s).streaks).toEqual({ ada: 1, bob: 0 });

		now += REVEAL_MS;
		tick(s, now);
		send(s, ada, { type: 'answer', choice: correct(s) }, now);
		send(s, bob, { type: 'answer', choice: correct(s) }, now);
		expect(state(s).lastPoints).toEqual({ ada: MAX_POINTS + 100, bob: MAX_POINTS });
	});
});

describe('views', () => {
	test('the answer is hidden until the reveal', () => {
		const s = setup();
		tick(s, INTRO_MS);
		for (const v of [view(s, { kind: 'host' }), view(s, { kind: 'player', playerId: 'ada' })]) {
			expect(v.reveal).toBeNull();
			expect(JSON.stringify(v)).not.toContain('"answer"');
			expect(v.question?.choices).toHaveLength(state(s).questions[0]!.choices.length);
		}
	});

	test('the question is hidden during the intro', () => {
		expect(view(setup(), { kind: 'host' }).question).toBeNull();
	});

	test('players see their own result and rank after the reveal', () => {
		const s = setup();
		tick(s, INTRO_MS);
		send(s, ada, { type: 'answer', choice: correct(s) }, INTRO_MS);
		send(s, bob, { type: 'answer', choice: wrong(s) }, INTRO_MS);
		const v = view(s, { kind: 'player', playerId: 'bob' });
		expect(v.you).toMatchObject({ correct: false, points: 0, rank: 2 });
		expect(v.reveal?.counts.reduce((a, b) => a + b)).toBe(2);
		expect(v.leaderboard.map((e) => e.name)).toEqual(['Ada', 'Bob']);
	});

	test('ties share a rank', () => {
		const s = setup();
		const v = view(s, { kind: 'player', playerId: 'ada' });
		expect(v.you?.rank).toBe(1);
		expect(view(s, { kind: 'player', playerId: 'bob' }).you?.rank).toBe(1);
	});
});

test('curated packs load and are valid', () => {
	expect(triviaPacks.length).toBeGreaterThanOrEqual(3);
	for (const p of triviaPacks) expect(p.questions.length).toBeGreaterThanOrEqual(10);
});
