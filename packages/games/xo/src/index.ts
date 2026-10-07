import {
	addPoints,
	type Rng,
	defineGame,
	isController,
	rankPlayers,
	type Actor,
	type GameContext,
	type GamePlayer,
	type LeaderboardEntry
} from '@games/engine';

/**
 * X-O Battle: tic-tac-toe, king of the hill. Two players face off; the
 * winner stays on and the next player in the queue challenges them. With two
 * players it's simply a best-of series.
 */

export const INTRO_MS = 4_000;
export const RESULT_MS = 4_000;
export const WIN_POINTS = 100;
export const DRAW_POINTS = 30;
/** The computer "thinks" this long before moving, so its moves are easy to follow. */
export const BOT_THINK_MS = 700;
export const BOT_ID = 'bot';

/** 0 = no computer player; 1 easy, 2 medium, 3 hard (unbeatable). */
export type BotLevel = 0 | 1 | 2 | 3;

export interface XoConfig {
	matches: number;
	turnSeconds: number;
	/** Play against the computer (solo). Ignored when there are two or more people. */
	botLevel: number;
	familyFilter: boolean;
}

export type Mark = 'X' | 'O';
type Cell = Mark | null;
type Phase = 'intro' | 'turn' | 'result' | 'final';

const LINES = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6]
] as const;

export interface XoState {
	phase: Phase;
	players: GamePlayer[];
	/** Front is the reigning champion, then challengers in order. */
	queue: string[];
	match: number;
	config: XoConfig;
	phaseEndsAt: number;
	x: string;
	o: string;
	board: Cell[];
	turn: Mark;
	winner: string | null;
	winLine: number[] | null;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
	/** The computer opponent, if playing solo. */
	bot: { id: string; level: BotLevel } | null;
}

export type XoAction = { type: 'move'; cell: number } | { type: 'next' };

export interface XoView {
	phase: Phase;
	match: number;
	matches: number;
	endsAt: number;
	durationMs: number;
	board: Cell[];
	turn: Mark;
	x: GamePlayer | null;
	o: GamePlayer | null;
	/** Who plays the winner of this match. */
	upNext: GamePlayer | null;
	winner: GamePlayer | null;
	winLine: number[] | null;
	draw: boolean;
	you: { mark: Mark | null; yourTurn: boolean; points: number } | null;
	leaderboard: LeaderboardEntry[];
}

export const xo = defineGame<XoState, XoAction, XoConfig, unknown, XoView>({
	meta: {
		id: 'xo',
		name: 'X-O Battle',
		tagline: 'Tic-tac-toe, king of the hill. Winner stays on.',
		tags: ['fun'],
		modes: ['party', 'online', 'solo'],
		players: { min: 2, max: 12 },
		audience: true,
		durationMin: 6
	},

	defaultConfig: { matches: 5, turnSeconds: 10, botLevel: 0, familyFilter: true },

	setup({ config, players: people, mode }, ctx) {
		// Alone (solo mode, or one person): add the computer as the opponent.
		const level = Math.min(3, Math.max(0, Math.round(config.botLevel))) as BotLevel;
		const bot =
			people.length === 1 && (mode === 'solo' || level > 0)
				? { id: BOT_ID, level: (level || 2) as BotLevel }
				: null;
		const players = bot ? [...people, { id: bot.id, name: 'Computer', avatar: 'bot' }] : people;
		// Against the computer, the person always gets the first move.
		const queue = bot ? players.map((p) => p.id) : ctx.rng.shuffle(players.map((p) => p.id));
		return {
			bot,
			phase: 'intro',
			players,
			queue,
			match: 0,
			config,
			phaseEndsAt: ctx.now + INTRO_MS,
			x: queue[0]!,
			o: queue[1]!,
			board: Array(9).fill(null),
			turn: 'X',
			winner: null,
			winLine: null,
			scores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastPoints: {},
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (
			a.type === 'move' &&
			Number.isInteger(a.cell) &&
			(a.cell as number) >= 0 &&
			(a.cell as number) < 9
		) {
			return { type: 'move', cell: a.cell as number };
		}
		return null;
	},

	reduce(state, action, actor, ctx) {
		switch (action.type) {
			case 'tick':
				return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
			case 'join':
				// Matches are paired at the start; newcomers play the next game.
				return state;
			case 'roster':
				// The computer never leaves.
				return roster(
					{ ...state, active: state.bot ? [...ctx.active, state.bot.id] : [...ctx.active] },
					ctx
				);
			case 'next':
				// Skipping only moves past the intro and results; turns belong to the players.
				return isController(actor) && (state.phase === 'intro' || state.phase === 'result')
					? advance(state, ctx)
					: state;
			case 'move':
				return move(state, action.cell, actor, ctx);
		}
	},

	view(state, viewer) {
		const player = (id: string | null) => state.players.find((p) => p.id === id) ?? null;
		const inMatch = state.phase === 'turn' || state.phase === 'result';
		let you: XoView['you'] = null;
		if (viewer.kind === 'player' && state.players.some((p) => p.id === viewer.playerId)) {
			const id = viewer.playerId;
			const mark: Mark | null = !inMatch
				? null
				: id === state.x
					? 'X'
					: id === state.o
						? 'O'
						: null;
			you = {
				mark,
				yourTurn: state.phase === 'turn' && mark === state.turn,
				points: state.phase === 'result' ? (state.lastPoints[id] ?? 0) : 0
			};
		}
		return {
			phase: state.phase,
			match: state.match,
			matches: state.config.matches,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			board: state.board,
			turn: state.turn,
			x: state.phase === 'final' ? null : player(state.x),
			o: state.phase === 'final' ? null : player(state.o),
			upNext: player(nextChallenger(state)),
			winner: state.phase === 'result' ? player(state.winner) : null,
			winLine: state.phase === 'result' ? state.winLine : null,
			draw: state.phase === 'result' && state.winner === null,
			you,
			leaderboard: rankPlayers(state.players, state.scores, state.lastPoints)
		};
	},

	nextDeadline(state) {
		return state.phase === 'final' ? null : state.phaseEndsAt;
	},

	isOver(state) {
		return state.phase === 'final';
	},

	// 2: added the computer opponent (`bot`).
	stateVersion: 2,

	shiftTime(state, ms) {
		return { ...state, phaseEndsAt: state.phaseEndsAt + ms };
	}
});

// ---------- rules ----------

export function lineOf(board: Cell[]): { mark: Mark; line: number[] } | null {
	for (const line of LINES) {
		const [a, b, c] = line;
		const m = board[a];
		if (m && m === board[b] && m === board[c]) return { mark: m, line: [...line] };
	}
	return null;
}

function advance(state: XoState, ctx: GameContext): XoState {
	switch (state.phase) {
		case 'intro':
			return startMatch(state, ctx);
		case 'turn': {
			// The computer's turn comes due after its thinking pause.
			if (state.bot && mover(state) === state.bot.id) {
				return place(state, botMove(state.board, state.turn, state.bot.level, ctx.rng), ctx);
			}
			// A person ran out of time: play a random empty cell so the game keeps moving.
			return place(state, ctx.rng.pick(emptyCells(state.board)), ctx);
		}
		case 'result':
			return state.match + 1 < state.config.matches
				? startMatch({ ...state, match: state.match + 1 }, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now };
		case 'final':
			return state;
	}
}

/** Champion (front of the queue) vs the next present challenger. The challenger is X and moves first. */
function startMatch(state: XoState, ctx: GameContext): XoState {
	const present = state.queue.filter((id) => state.active.includes(id));
	if (present.length < 2) return { ...state, phase: 'final', phaseEndsAt: ctx.now };
	const [champion, challenger] = present as [string, string];
	const firstMatch = state.match === 0;
	return withTurnDeadline(
		{
			...state,
			phase: 'turn',
			x: firstMatch ? champion : challenger,
			o: firstMatch ? challenger : champion,
			board: Array(9).fill(null),
			turn: 'X',
			winner: null,
			winLine: null,
			lastPoints: {},
			phaseEndsAt: 0
		},
		ctx
	);
}

function move(state: XoState, cell: number, actor: Actor, ctx: GameContext): XoState {
	if (state.phase !== 'turn' || actor.kind !== 'player') return state;
	const current = state.turn === 'X' ? state.x : state.o;
	if (actor.playerId !== current || state.board[cell] !== null) return state;
	return place(state, cell, ctx);
}

function place(state: XoState, cell: number, ctx: GameContext): XoState {
	const board = state.board.slice();
	board[cell] = state.turn;
	const won = lineOf(board);
	if (won)
		return finishMatch({ ...state, board }, won.mark === 'X' ? state.x : state.o, won.line, ctx);
	if (emptyCells(board).length === 0) return finishMatch({ ...state, board }, null, null, ctx);
	return withTurnDeadline({ ...state, board, turn: state.turn === 'X' ? 'O' : 'X' }, ctx);
}

/**
 * Winner goes to the front of the queue, loser to the back. On a draw the
 * champion keeps their spot and the challenger goes to the back.
 */
function finishMatch(
	state: XoState,
	winner: string | null,
	winLine: number[] | null,
	ctx: GameContext
): XoState {
	const champion = state.queue.find((id) => id === state.x || id === state.o)!;
	const loser =
		winner === null
			? champion === state.x
				? state.o
				: state.x
			: winner === state.x
				? state.o
				: state.x;
	const stays = winner ?? champion;
	const queue = [stays, ...state.queue.filter((id) => id !== stays && id !== loser), loser];
	const points: Record<string, number> =
		winner === null ? { [state.x]: DRAW_POINTS, [state.o]: DRAW_POINTS } : { [winner]: WIN_POINTS };
	return {
		...state,
		phase: 'result',
		queue,
		winner,
		winLine,
		scores: addPoints(state.scores, points),
		lastPoints: points,
		phaseEndsAt: ctx.now + RESULT_MS
	};
}

/** A player in the current match left: the other one wins it. */
function roster(state: XoState, ctx: GameContext): XoState {
	const queue = state.queue.filter((id) => state.active.includes(id));
	const next = { ...state, queue: [...queue, ...state.queue.filter((id) => !queue.includes(id))] };
	if (state.phase !== 'turn') return next;
	const xHere = state.active.includes(state.x);
	const oHere = state.active.includes(state.o);
	if (xHere && oHere) return next;
	if (!xHere && !oHere) return finishMatch(next, null, null, ctx);
	return finishMatch(next, xHere ? state.x : state.o, null, ctx);
}

/** Whose move it is. */
function mover(state: XoState): string {
	return state.turn === 'X' ? state.x : state.o;
}

/** People get the turn timer; the computer moves after a short pause. */
function withTurnDeadline(state: XoState, ctx: GameContext): XoState {
	const isBot = state.bot !== null && mover(state) === state.bot.id;
	return {
		...state,
		phaseEndsAt: ctx.now + (isBot ? BOT_THINK_MS : state.config.turnSeconds * 1000)
	};
}

// ---------- the computer ----------

/**
 * Pick a move for `mark`.
 * - Easy: mostly random; takes a win only sometimes.
 * - Medium: takes wins and blocks yours, but slips up now and then.
 * - Hard: perfect play (minimax); it can't be beaten, only drawn.
 */
export function botMove(board: Cell[], mark: Mark, level: BotLevel, rng: Rng): number {
	const empty = emptyCells(board);
	const other: Mark = mark === 'X' ? 'O' : 'X';
	const winningMove = (m: Mark) => empty.find((i) => lineOf(withMark(board, i, m)) !== null);

	if (level <= 1) {
		const win = winningMove(mark);
		return win !== undefined && rng.next() < 0.3 ? win : rng.pick(empty);
	}
	if (level === 2) {
		const win = winningMove(mark);
		if (win !== undefined) return win;
		const block = winningMove(other);
		if (block !== undefined && rng.next() < 0.85) return block;
		if (rng.next() < 0.25) return rng.pick(empty);
		const preferred = [4, 0, 2, 6, 8].filter((i) => board[i] === null);
		return preferred.length ? rng.pick(preferred) : rng.pick(empty);
	}

	// Hard: score every move by minimax and pick randomly among the best.
	let best = -Infinity;
	let bestMoves: number[] = [];
	for (const i of empty) {
		const score = -negamax(withMark(board, i, mark), other, 1);
		if (score > best) {
			best = score;
			bestMoves = [i];
		} else if (score === best) bestMoves.push(i);
	}
	return rng.pick(bestMoves);
}

/**
 * Scores by position, shared across games. Tic-tac-toe has only ~5,500
 * reachable positions, so after warming up every lookup is instant, even
 * on a slow phone.
 */
const negamaxCache = new Map<string, number>();

/** Score from the perspective of `toMove`: win soon > win later > draw > lose later > lose soon. */
function negamax(board: Cell[], toMove: Mark, depth: number): number {
	const key = board.map((c) => c ?? '-').join('') + toMove + depth;
	const cached = negamaxCache.get(key);
	if (cached !== undefined) return cached;
	const score = negamaxUncached(board, toMove, depth);
	negamaxCache.set(key, score);
	return score;
}

function negamaxUncached(board: Cell[], toMove: Mark, depth: number): number {
	const won = lineOf(board);
	if (won) return won.mark === toMove ? 10 - depth : depth - 10;
	const empty = emptyCells(board);
	if (empty.length === 0) return 0;
	const other: Mark = toMove === 'X' ? 'O' : 'X';
	let best = -Infinity;
	for (const i of empty)
		best = Math.max(best, -negamax(withMark(board, i, toMove), other, depth + 1));
	return best;
}

function withMark(board: Cell[], i: number, mark: Mark): Cell[] {
	const next = board.slice();
	next[i] = mark;
	return next;
}

function nextChallenger(state: XoState): string | null {
	const present = state.queue.filter((id) => state.active.includes(id));
	if (state.phase === 'turn') {
		return present.find((id) => id !== state.x && id !== state.o) ?? null;
	}
	return present[1] ?? null;
}

function emptyCells(board: Cell[]): number[] {
	return board.flatMap((c, i) => (c === null ? [i] : []));
}

function phaseDuration(state: XoState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'turn':
			return state.config.turnSeconds * 1000;
		case 'result':
			return RESULT_MS;
		case 'final':
			return 0;
	}
}
