import { describe, expect, test } from 'bun:test';
import {
	startGame,
	stepFromClient,
	stepSystem,
	viewFor,
	type Actor,
	type GameSession
} from '@games/engine';
import {
	DRAW_POINTS,
	INTRO_MS,
	RESULT_MS,
	WIN_POINTS,
	lineOf,
	xo,
	type XoState,
	type XoView
} from './index.ts';

const mk = (ids: string[]) => ids.map((id) => ({ id, name: id, avatar: '🦊' }));
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;

function setup(ids = ['ada', 'bob'], matches = 3): GameSession {
	return startGame(xo, {
		mode: 'online',
		players: mk(ids),
		content: null,
		config: { matches, turnSeconds: 10, familyFilter: true },
		seed: 5,
		now: 0
	});
}
const state = (s: GameSession) => s.state as XoState;
const tick = (s: GameSession, now: number, active = state(s).players.map((x) => x.id)) =>
	stepSystem(xo, s, { type: 'tick' }, { now, active });
const send = (
	s: GameSession,
	actor: Exclude<Actor, { kind: 'system' }>,
	action: unknown,
	now = INTRO_MS
) => stepFromClient(xo, s, action, actor, { now, active: state(s).players.map((x) => x.id) });
const view = (s: GameSession, v: Parameters<typeof viewFor>[2]) => viewFor(xo, s, v) as XoView;

/** Play cells in order, alternating X and O. */
function play(s: GameSession, cells: number[]) {
	for (const cell of cells) {
		const current = state(s).turn === 'X' ? state(s).x : state(s).o;
		expect(send(s, p(current), { type: 'move', cell })).toBe(true);
	}
}

test('detects lines', () => {
	expect(lineOf(['X', 'X', 'X', null, null, null, null, null, null])?.line).toEqual([0, 1, 2]);
	expect(lineOf(['O', null, null, null, 'O', null, null, null, 'O'])?.mark).toBe('O');
	expect(lineOf(Array(9).fill(null))).toBeNull();
});

describe('a match', () => {
	test('X moves first; players can only move on their turn, into empty cells', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const { x, o } = state(s);
		expect(send(s, p(o), { type: 'move', cell: 0 })).toBe(false);
		expect(send(s, p(x), { type: 'move', cell: 0 })).toBe(true);
		expect(send(s, p(x), { type: 'move', cell: 1 })).toBe(false);
		expect(send(s, p(o), { type: 'move', cell: 0 })).toBe(false);
		expect(view(s, { kind: 'player', playerId: o }).you).toMatchObject({
			mark: 'O',
			yourTurn: true
		});
	});

	test('three in a row wins and scores', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const { x } = state(s);
		play(s, [0, 3, 1, 4, 2]);
		expect(state(s).phase).toBe('result');
		expect(state(s).winner).toBe(x);
		expect(state(s).winLine).toEqual([0, 1, 2]);
		expect(state(s).scores[x]).toBe(WIN_POINTS);
	});

	test('a full board is a draw, both score a little', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const { x, o } = state(s);
		play(s, [0, 1, 2, 4, 3, 5, 7, 6, 8]);
		expect(state(s).phase).toBe('result');
		expect(state(s).winner).toBeNull();
		expect(view(s, { kind: 'host' }).draw).toBe(true);
		expect(state(s).lastPoints).toEqual({ [x]: DRAW_POINTS, [o]: DRAW_POINTS });
	});

	test('running out of time plays a random move', () => {
		const s = setup();
		tick(s, INTRO_MS);
		tick(s, INTRO_MS + 10_000);
		expect(state(s).board.filter(Boolean)).toHaveLength(1);
		expect(state(s).turn).toBe('O');
	});

	test('a player leaving mid-match forfeits it', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const { x, o } = state(s);
		stepSystem(xo, s, { type: 'roster' }, { now: INTRO_MS, active: [o] });
		expect(state(s).winner).toBe(o);
		void x;
	});
});

describe('king of the hill', () => {
	test('winner stays on, the loser goes to the back, the next challenger moves first', () => {
		const s = setup(['ada', 'bob', 'cy'], 5);
		tick(s, INTRO_MS);
		const { x: first, o: second } = state(s);
		const third = ['ada', 'bob', 'cy'].find((id) => id !== first && id !== second)!;
		expect(view(s, { kind: 'host' }).upNext?.id).toBe(third);

		play(s, [0, 3, 1, 4, 2]); // X (first) wins
		expect(state(s).queue).toEqual([first, third, second]);

		tick(s, INTRO_MS + RESULT_MS);
		expect(state(s).x).toBe(third); // challenger
		expect(state(s).o).toBe(first); // champion
	});

	test('on a draw the champion keeps their spot', () => {
		const s = setup(['ada', 'bob', 'cy'], 5);
		tick(s, INTRO_MS);
		play(s, [0, 3, 1, 4, 2]);
		tick(s, INTRO_MS + RESULT_MS);
		const { x: challenger, o: champion } = state(s);
		play(s, [0, 1, 2, 4, 3, 5, 7, 6, 8]);
		expect(state(s).queue[0]).toBe(champion);
		expect(state(s).queue.at(-1)).toBe(challenger);
	});

	test('ends after the configured number of matches', () => {
		const s = setup(['ada', 'bob'], 3);
		let now = INTRO_MS;
		tick(s, now);
		for (let m = 0; m < 3; m++) {
			play(s, [0, 3, 1, 4, 2]);
			now += RESULT_MS;
			tick(s, now);
		}
		expect(state(s).phase).toBe('final');
		expect(view(s, { kind: 'host' }).leaderboard[0]!.score).toBeGreaterThan(0);
	});

	test('the controller cannot skip someone’s turn', () => {
		const s = setup();
		tick(s, INTRO_MS);
		expect(send(s, { kind: 'host' }, { type: 'next' })).toBe(false);
	});
});
