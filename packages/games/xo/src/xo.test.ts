import { describe, expect, test } from 'bun:test';
import {
	createRng,
	startGame,
	stepFromClient,
	stepSystem,
	viewFor,
	type Actor,
	type GameSession
} from '@games/engine';
import {
	BOT_ID,
	BOT_THINK_MS,
	DRAW_POINTS,
	INTRO_MS,
	RESULT_MS,
	WIN_POINTS,
	botMove,
	lineOf,
	xo,
	type BotLevel,
	type Mark,
	type XoState,
	type XoView
} from './index.ts';

const mk = (ids: string[]) => ids.map((id) => ({ id, name: id, avatar: 'rings' }));
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;

function setup(ids = ['ada', 'bob'], matches = 3): GameSession {
	return startGame(xo, {
		mode: 'online',
		players: mk(ids),
		content: null,
		config: { matches, turnSeconds: 10, botLevel: 0, familyFilter: true },
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

describe('the computer', () => {
	type Cell = Mark | null;
	const E = null;

	function solo(level: BotLevel, matches = 1): GameSession {
		return startGame(xo, {
			mode: 'solo',
			players: mk(['me']),
			content: null,
			config: { matches, turnSeconds: 20, botLevel: level, familyFilter: true },
			seed: 9,
			now: 0
		});
	}

	test('solo adds a computer opponent, and you move first', () => {
		const s = solo(2);
		expect(state(s).players.map((x) => x.id)).toEqual(['me', BOT_ID]);
		stepSystem(xo, s, { type: 'tick' }, { now: INTRO_MS, active: ['me'] });
		expect(state(s).x).toBe('me');
		expect(view(s, { kind: 'player', playerId: 'me' }).you).toMatchObject({
			mark: 'X',
			yourTurn: true
		});
	});

	test('the computer answers after a short pause, and you cannot move for it', () => {
		const s = solo(3);
		stepSystem(xo, s, { type: 'tick' }, { now: INTRO_MS, active: ['me'] });
		stepFromClient(xo, s, { type: 'move', cell: 0 }, p('me'), { now: INTRO_MS, active: ['me'] });
		expect(state(s).turn).toBe('O');
		expect(state(s).phaseEndsAt).toBe(INTRO_MS + BOT_THINK_MS);
		expect(
			stepFromClient(xo, s, { type: 'move', cell: 4 }, p('me'), { now: INTRO_MS, active: ['me'] })
		).toBe(false);
		stepSystem(xo, s, { type: 'tick' }, { now: INTRO_MS + BOT_THINK_MS, active: ['me'] });
		expect(state(s).board.filter(Boolean)).toHaveLength(2);
		expect(state(s).turn).toBe('X');
	});

	test('the computer never counts as having left', () => {
		const s = solo(1);
		stepSystem(xo, s, { type: 'tick' }, { now: INTRO_MS, active: ['me'] });
		stepSystem(xo, s, { type: 'roster' }, { now: INTRO_MS, active: ['me'] });
		expect(state(s).phase).toBe('turn');
	});

	test('medium and hard take a win and block yours', () => {
		const rng = createRng(1);
		const canWin: Cell[] = ['O', 'O', E, 'X', 'X', E, E, E, E];
		const mustBlock: Cell[] = ['X', 'X', E, E, 'O', E, E, E, E];
		for (const level of [2, 3] as const) {
			expect(botMove(canWin, 'O', level, rng)).toBe(2);
		}
		expect(botMove(mustBlock, 'O', 3, rng)).toBe(2);
		// Medium blocks most of the time.
		let blocked = 0;
		for (let i = 0; i < 100; i++) if (botMove(mustBlock, 'O', 2, createRng(i)) === 2) blocked++;
		expect(blocked).toBeGreaterThan(75);
	});

	test('every level only plays empty cells', () => {
		const board: Cell[] = ['X', 'O', 'X', E, 'O', E, E, 'X', E];
		for (const level of [1, 2, 3] as const) {
			for (let i = 0; i < 50; i++)
				expect(board[botMove(board, 'O', level, createRng(i))]).toBeNull();
		}
	});

	/** Play a full game: `level` as O against a random X. Returns the winner's mark or null. */
	function playOut(level: BotLevel, seed: number): Mark | null {
		const rng = createRng(seed);
		let board: Cell[] = Array(9).fill(null);
		let turn: Mark = 'X';
		while (!lineOf(board) && board.includes(null)) {
			const empty = board.flatMap((c, i) => (c === null ? [i] : []));
			const cell = turn === 'O' ? botMove(board, 'O', level, rng) : rng.pick(empty);
			board = board.slice();
			board[cell] = turn;
			turn = turn === 'X' ? 'O' : 'X';
		}
		return lineOf(board)?.mark ?? null;
	}

	test('hard never loses; easy loses plenty', () => {
		let hardLosses = 0;
		let easyLosses = 0;
		for (let seed = 0; seed < 300; seed++) {
			if (playOut(3, seed) === 'X') hardLosses++;
			if (playOut(1, seed) === 'X') easyLosses++;
		}
		expect(hardLosses).toBe(0);
		expect(easyLosses).toBeGreaterThan(50);
	});

	test('a whole solo game plays out to the final screen', () => {
		const s = solo(3, 3);
		let now = INTRO_MS;
		stepSystem(xo, s, { type: 'tick' }, { now, active: ['me'] });
		for (let guard = 0; guard < 200 && state(s).phase !== 'final'; guard++) {
			const st = state(s);
			if (st.phase === 'turn' && (st.turn === 'X' ? st.x : st.o) === 'me') {
				const empty = st.board.flatMap((c, i) => (c === null ? [i] : []));
				stepFromClient(xo, s, { type: 'move', cell: empty[0] }, p('me'), { now, active: ['me'] });
			} else {
				now = Math.max(now, st.phaseEndsAt);
				stepSystem(xo, s, { type: 'tick' }, { now, active: ['me'] });
			}
		}
		expect(state(s).phase).toBe('final');
		expect(view(s, { kind: 'player', playerId: 'me' }).leaderboard).toHaveLength(2);
	});
});
