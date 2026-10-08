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
	EMOJI,
	FIND_POINTS,
	FIRST_BONUS,
	GRID_SIZE,
	INTRO_MS,
	LOCK_MS,
	REVEAL_MS,
	findIt,
	makePuzzles,
	type FindItState,
	type FindItView,
	type Level
} from './index.ts';

const players = ['ada', 'bob'].map((id) => ({ id, name: id, avatar: 'rings' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;
const GRID_MS = 20_000;

function setup(): GameSession {
	const s = startGame(findIt, {
		mode: 'party',
		players,
		content: null,
		config: { rounds: 3, secondsPerGrid: GRID_MS / 1000, level: 1 },
		seed: 11,
		now: 0
	});
	stepSystem(findIt, s, { type: 'tick' }, { now: INTRO_MS, active: ids });
	return s;
}
const state = (s: GameSession) => s.state as FindItState;
const view = (s: GameSession, id?: string) =>
	viewFor(findIt, s, id ? { kind: 'player', playerId: id } : { kind: 'host' }) as FindItView;
const answer = (s: GameSession) => state(s).puzzles[state(s).round]!.answer;
const tap = (s: GameSession, id: string, index: number, now = INTRO_MS + 1) =>
	stepFromClient(findIt, s, { type: 'tap', index }, p(id), { now, active: ids });

describe('grids', () => {
	test('emoji are single, distinct characters, enough for the biggest grid', () => {
		expect(new Set(EMOJI).size).toBe(EMOJI.length);
		expect(EMOJI.length).toBeGreaterThanOrEqual(GRID_SIZE[3] ** 2);
	});

	test.each([1, 2, 3] as Level[])('level %i: exactly one cell matches', (level) => {
		for (const puzzle of makePuzzles(level, 30, createRng(level))) {
			expect(puzzle.cells).toHaveLength(GRID_SIZE[level] ** 2);
			if (puzzle.find === null) {
				const odd = puzzle.cells[puzzle.answer];
				expect(puzzle.cells.filter((c) => c === odd)).toHaveLength(1);
			} else {
				expect(puzzle.cells.indexOf(puzzle.find)).toBe(puzzle.answer);
				expect(puzzle.cells.lastIndexOf(puzzle.find)).toBe(puzzle.answer);
			}
		}
	});

	test('a game mixes every kind', () => {
		const kinds = makePuzzles(1, 3, createRng(1)).map((p) => p.kind);
		expect(new Set(kinds).size).toBe(3);
	});
});

describe('Find It', () => {
	test('first find gets the bonus; sooner scores more', () => {
		const s = setup();
		tap(s, 'ada', answer(s), INTRO_MS);
		tap(s, 'bob', answer(s), INTRO_MS + GRID_MS / 2);
		expect(state(s).scores.ada).toBe(FIND_POINTS.max + FIRST_BONUS);
		expect(state(s).scores.bob).toBe((FIND_POINTS.min + FIND_POINTS.max) / 2);
		expect(view(s).finders.map((f) => f.id)).toEqual(['ada', 'bob']);
		expect(view(s).answer).toBe(answer(s));
	});

	test('a wrong tap locks you out for a moment', () => {
		const s = setup();
		const wrong = (answer(s) + 1) % state(s).puzzles[0]!.cells.length;
		tap(s, 'ada', wrong, INTRO_MS + 100);
		expect(view(s, 'ada').you).toMatchObject({
			misses: [wrong],
			lockedUntil: INTRO_MS + 100 + LOCK_MS
		});
		tap(s, 'ada', answer(s), INTRO_MS + 200);
		expect(state(s).found).toEqual([]);
		tap(s, 'ada', answer(s), INTRO_MS + 100 + LOCK_MS);
		expect(state(s).found).toEqual(['ada']);
	});

	test('the answer is hidden until the reveal', () => {
		const s = setup();
		expect(view(s, 'ada').answer).toBeNull();
	});

	test('plays every grid to the final', () => {
		const s = setup();
		let now = INTRO_MS;
		for (let i = 0; i < 3; i++) {
			for (const id of ids) tap(s, id, answer(s), ++now);
			now += REVEAL_MS;
			stepSystem(findIt, s, { type: 'tick' }, { now, active: ids });
		}
		expect(state(s).phase).toBe('final');
	});
});
