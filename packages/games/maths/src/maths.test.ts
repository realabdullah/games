import { describe, expect, test } from 'bun:test';
import {
	createRng,
	startGame,
	stepFromClient,
	stepSystem,
	viewFor,
	type GameSession
} from '@games/engine';
import {
	ANSWER_POINTS,
	FIRST_BONUS,
	INTRO_MS,
	MAX_TRIES,
	REVEAL_MS,
	makeSums,
	maths,
	parseAnswer,
	type Level,
	type MathsState,
	type MathsView
} from './index.ts';

const players = ['ada', 'bob'].map((id) => ({ id, name: id, avatar: '🦊' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;
const SUM_MS = 20_000;

function setup(level: Level = 1): GameSession {
	const s = startGame(maths, {
		mode: 'party',
		players,
		content: null,
		config: { rounds: 2, secondsPerSum: SUM_MS / 1000, level },
		seed: 7,
		now: 0
	});
	stepSystem(maths, s, { type: 'tick' }, { now: INTRO_MS, active: ids });
	return s;
}
const state = (s: GameSession) => s.state as MathsState;
const view = (s: GameSession, id?: string) =>
	viewFor(maths, s, id ? { kind: 'player', playerId: id } : { kind: 'host' }) as MathsView;
const send = (s: GameSession, id: string, value: unknown, now = INTRO_MS + 1) =>
	stepFromClient(maths, s, { type: 'answer', value }, p(id), { now, active: ids });
const answer = (s: GameSession) => state(s).sums[state(s).round]!.answer;

describe('sums', () => {
	test.each([1, 2, 3] as Level[])('level %i: right answers, whole and never negative', (level) => {
		const sums = makeSums(level, 200, createRng(level));
		expect(new Set(sums.map((s) => s.text)).size).toBe(sums.length);
		for (const sum of sums) {
			expect(Number.isInteger(sum.answer)).toBe(true);
			expect(sum.answer).toBeGreaterThanOrEqual(0);
			const js = sum.text
				.replace(/×/g, '*')
				.replace(/÷/g, '/')
				.replace(/−/g, '-')
				.replace(/(\d+)²/, '$1**2')
				.replace(/(\d+)% of (\d+)/, '$1/100*$2');
			expect(sum.answer).toBe(new Function(`return ${js}`)());
		}
	});

	test('reads typed answers leniently', () => {
		expect(parseAnswer(' 1,200 ')).toBe(1200);
		expect(parseAnswer('42')).toBe(42);
		expect(parseAnswer('4.2')).toBeNull();
		expect(parseAnswer('abc')).toBeNull();
		expect(parseAnswer('')).toBeNull();
	});
});

describe('Quick Maths', () => {
	test('sooner scores more, and the first right answer gets a bonus', () => {
		const s = setup();
		send(s, 'ada', answer(s), INTRO_MS);
		send(s, 'bob', String(answer(s)), INTRO_MS + SUM_MS / 2);
		expect(state(s).scores.ada).toBe(ANSWER_POINTS.max + FIRST_BONUS);
		expect(state(s).scores.bob).toBe((ANSWER_POINTS.min + ANSWER_POINTS.max) / 2);
		expect(state(s).phase).toBe('reveal');
		expect(view(s).solvers.map((p) => p.id)).toEqual(['ada', 'bob']);
	});

	test('the answer stays hidden until the reveal', () => {
		const s = setup();
		expect(view(s, 'ada').answer).toBeNull();
		expect(state(s).sums.length).toBe(2);
		stepSystem(maths, s, { type: 'tick' }, { now: INTRO_MS + SUM_MS, active: ids });
		expect(view(s, 'ada').answer).toBe(answer(s));
	});

	test(`${MAX_TRIES} wrong answers and you're out for that sum`, () => {
		const s = setup();
		const wrong = answer(s) + 1;
		for (let i = 0; i < MAX_TRIES; i++) send(s, 'ada', wrong + i);
		expect(view(s, 'ada').you).toMatchObject({
			triesLeft: 0,
			wrong: [wrong, wrong + 1, wrong + 2]
		});
		// Other players don't see your wrong answers.
		expect(view(s, 'bob').you?.wrong).toEqual([]);
		send(s, 'ada', answer(s));
		expect(state(s).scores.ada).toBe(0);
		// Once everyone is done, the sum ends early.
		send(s, 'bob', answer(s));
		expect(state(s).phase).toBe('reveal');
	});

	test('plays through every sum to the final', () => {
		const s = setup(3);
		let now = INTRO_MS;
		for (let i = 0; i < 2; i++) {
			send(s, 'bob', answer(s), ++now);
			send(s, 'ada', answer(s), ++now);
			now += REVEAL_MS;
			stepSystem(maths, s, { type: 'tick' }, { now, active: ids });
		}
		expect(state(s).phase).toBe('final');
		expect(view(s).leaderboard.map((e) => e.id)).toEqual(['bob', 'ada']);
	});

	test('a player who joins mid-game can answer the next sum', () => {
		const s = setup();
		const cy = { id: 'cy', name: 'cy', avatar: '🐸' };
		stepSystem(
			maths,
			s,
			{ type: 'join', player: cy },
			{ now: INTRO_MS + 1, active: [...ids, 'cy'] }
		);
		stepFromClient(maths, s, { type: 'answer', value: answer(s) }, p('cy'), {
			now: INTRO_MS + 2,
			active: [...ids, 'cy']
		});
		expect(state(s).scores.cy).toBeGreaterThan(0);
	});
});
