import {
	addPoints,
	admitPlayer,
	defineGame,
	isController,
	rankPlayers,
	type Actor,
	type GameContext,
	type GamePlayer,
	type LeaderboardEntry,
	type Rng
} from '@games/engine';

/**
 * Find It. Everyone gets the same grid and hunts for one cell: a number, an
 * emoji, or the odd one out among look-alikes. Sooner finds score more; a
 * wrong tap locks you out for a moment, so tapping at random doesn't pay.
 */

export const INTRO_MS = 4_000;
export const REVEAL_MS = 4_000;
export const LOCK_MS = 2_000;
export const FIND_POINTS = { min: 100, max: 500 };
export const FIRST_BONUS = 100;

export type Level = 1 | 2 | 3;
/** Grid width and height, by level. */
export const GRID_SIZE: Record<Level, number> = { 1: 5, 2: 6, 3: 7 };

export type Kind = 'number' | 'emoji' | 'odd';

export interface Puzzle {
	kind: Kind;
	size: number;
	cells: string[];
	/** What to look for; null for "the odd one out". */
	find: string | null;
	answer: number;
}

export interface FindItConfig {
	rounds: number;
	secondsPerGrid: number;
	level: Level;
}

type Phase = 'intro' | 'find' | 'reveal' | 'final';

export interface FindItState {
	phase: Phase;
	players: GamePlayer[];
	puzzles: Puzzle[];
	round: number;
	config: FindItConfig;
	phaseEndsAt: number;
	/** Players who found it this round, in order. */
	found: string[];
	/** Locked out after a wrong tap until this time, by player. */
	lockedUntil: Record<string, number>;
	/** Wrong cells tapped this round, by player. */
	misses: Record<string, number[]>;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type FindItAction = { type: 'tap'; index: number } | { type: 'next' };

export interface FindItView {
	phase: Phase;
	round: number;
	rounds: number;
	endsAt: number;
	durationMs: number;
	kind: Kind | null;
	size: number;
	cells: string[];
	find: string | null;
	/** The cell, at the reveal. */
	answer: number | null;
	foundCount: number;
	playerCount: number;
	finders: GamePlayer[];
	you: {
		found: boolean;
		misses: number[];
		lockedUntil: number;
		points: number;
		score: number;
		rank: number | null;
	} | null;
	leaderboard: LeaderboardEntry[];
}

export const findIt = defineGame<FindItState, FindItAction, FindItConfig, null, FindItView>({
	meta: {
		id: 'findit',
		name: 'Find It',
		tagline: 'Spot it in the grid before anyone else.',
		tags: ['fun'],
		modes: ['party', 'online', 'solo'],
		players: { min: 1, max: 12 },
		audience: false,
		durationMin: 4
	},

	defaultConfig: { rounds: 8, secondsPerGrid: 20, level: 1 },

	setup({ config, players }, ctx) {
		return {
			phase: 'intro',
			players,
			puzzles: makePuzzles(config.level, config.rounds, ctx.rng),
			round: 0,
			config,
			phaseEndsAt: ctx.now + INTRO_MS,
			found: [],
			lockedUntil: {},
			misses: {},
			scores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastPoints: {},
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (a.type === 'tap' && Number.isInteger(a.index) && (a.index as number) >= 0) {
			return { type: 'tap', index: a.index as number };
		}
		return null;
	},

	reduce(state, action, actor, ctx) {
		switch (action.type) {
			case 'tick':
				return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
			case 'join':
				return admitPlayer(state, action.player, ctx);
			case 'roster': {
				const next = { ...state, active: [...ctx.active] };
				return next.phase === 'find' && allFound(next) ? reveal(next, ctx) : next;
			}
			case 'next':
				return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
			case 'tap':
				return tap(state, action.index, actor, ctx);
		}
	},

	view(state, viewer) {
		const puzzle = state.puzzles[state.round];
		const inRound = state.phase === 'find' || state.phase === 'reveal';
		const id = viewer.kind === 'player' ? viewer.playerId : null;
		const playing = id !== null && state.players.some((p) => p.id === id);
		const ranked = rankPlayers(state.players, state.scores, state.lastPoints);

		return {
			phase: state.phase,
			round: state.round,
			rounds: state.puzzles.length,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			kind: inRound ? (puzzle?.kind ?? null) : null,
			size: inRound ? (puzzle?.size ?? 0) : 0,
			cells: inRound ? (puzzle?.cells ?? []) : [],
			find: inRound ? (puzzle?.find ?? null) : null,
			answer: state.phase === 'reveal' ? (puzzle?.answer ?? null) : null,
			foundCount: state.found.length,
			playerCount: state.players.filter((p) => state.active.includes(p.id)).length,
			finders: state.found.flatMap((f) => state.players.find((p) => p.id === f) ?? []),
			you: playing
				? {
						found: state.found.includes(id),
						misses: state.misses[id] ?? [],
						lockedUntil: state.lockedUntil[id] ?? 0,
						points: state.lastPoints[id] ?? 0,
						score: state.scores[id] ?? 0,
						rank: ranked.find((e) => e.id === id)?.rank ?? null
					}
				: null,
			leaderboard: state.phase === 'reveal' || state.phase === 'final' ? ranked : []
		};
	},

	nextDeadline(state) {
		return state.phase === 'final' ? null : state.phaseEndsAt;
	},

	shiftTime(state, ms) {
		return {
			...state,
			phaseEndsAt: state.phaseEndsAt + ms,
			lockedUntil: Object.fromEntries(
				Object.entries(state.lockedUntil).map(([id, t]) => [id, t + ms])
			)
		};
	},

	isOver(state) {
		return state.phase === 'final';
	}
});

// ---------- puzzles ----------

/** Easy to tell apart, and render on every phone. */
export const EMOJI = [
	...'🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦆🦉🐴🦄🐝🐛🦋🐌🐞🐢🐍🦖🐙🦀🐠🐬🐳🦈🐊🦒🐘🦔🍎🍐🍊🍋🍌🍉🍇🍓🍒🍑🍍🥥🥝🍅🥕🌽🍄🥐🧀🍕🍔🍟🌭🍩🍪🎂'
];

/** Look-alike pairs: a grid of the first with one of the second. */
const LOOKALIKES: [string, string][] = [
	['O', 'Q'],
	['E', 'F'],
	['M', 'N'],
	['b', 'd'],
	['p', 'q'],
	['6', '9'],
	['5', 'S'],
	['8', 'B'],
	['C', 'G'],
	['P', 'R'],
	['V', 'U'],
	['🙂', '🙃'],
	['😀', '😃'],
	['😐', '😑'],
	['🌲', '🌳'],
	['🍎', '🍅']
];

function makePuzzle(kind: Kind, size: number, rng: Rng): Puzzle {
	const n = size * size;
	const answer = rng.int(0, n - 1);
	switch (kind) {
		case 'number': {
			const start = rng.int(1, 40);
			const cells = rng.shuffle(Array.from({ length: n }, (_, i) => String(start + i)));
			return { kind, size, cells, find: cells[answer]!, answer };
		}
		case 'emoji': {
			const cells = rng.shuffle(EMOJI).slice(0, n);
			return { kind, size, cells, find: cells[answer]!, answer };
		}
		case 'odd': {
			const pair = rng.pick(LOOKALIKES);
			const [common, odd] = rng.next() < 0.5 ? pair : [pair[1], pair[0]];
			const cells = Array.from({ length: n }, (_, i) => (i === answer ? odd : common));
			return { kind, size, cells, find: null, answer };
		}
	}
}

/** Kinds take turns, so every game mixes them. */
export function makePuzzles(level: Level, count: number, rng: Rng): Puzzle[] {
	const size = GRID_SIZE[level] ?? GRID_SIZE[1];
	const kinds = rng.shuffle<Kind>(['number', 'emoji', 'odd']);
	return Array.from({ length: count }, (_, i) => makePuzzle(kinds[i % kinds.length]!, size, rng));
}

// ---------- transitions ----------

function advance(state: FindItState, ctx: GameContext): FindItState {
	switch (state.phase) {
		case 'intro':
			return startRound(state, 0, ctx);
		case 'find':
			return reveal(state, ctx);
		case 'reveal':
			return state.round + 1 < state.puzzles.length
				? startRound(state, state.round + 1, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now };
		case 'final':
			return state;
	}
}

function startRound(state: FindItState, round: number, ctx: GameContext): FindItState {
	return {
		...state,
		phase: 'find',
		round,
		phaseEndsAt: ctx.now + state.config.secondsPerGrid * 1000,
		found: [],
		lockedUntil: {},
		misses: {},
		lastPoints: {}
	};
}

function reveal(state: FindItState, ctx: GameContext): FindItState {
	return { ...state, phase: 'reveal', phaseEndsAt: ctx.now + REVEAL_MS };
}

function tap(state: FindItState, index: number, actor: Actor, ctx: GameContext): FindItState {
	if (state.phase !== 'find' || ctx.now >= state.phaseEndsAt) return state;
	if (actor.kind !== 'player') return state;
	const id = actor.playerId;
	if (!state.players.some((p) => p.id === id) || state.found.includes(id)) return state;
	if ((state.lockedUntil[id] ?? 0) > ctx.now) return state;
	const puzzle = state.puzzles[state.round]!;
	if (index >= puzzle.cells.length) return state;

	if (index !== puzzle.answer) {
		return {
			...state,
			lockedUntil: { ...state.lockedUntil, [id]: ctx.now + LOCK_MS },
			misses: { ...state.misses, [id]: [...(state.misses[id] ?? []), index] }
		};
	}
	const left = Math.max(0, state.phaseEndsAt - ctx.now) / (state.config.secondsPerGrid * 1000);
	const pts =
		Math.round((FIND_POINTS.min + (FIND_POINTS.max - FIND_POINTS.min) * left) / 10) * 10 +
		(state.found.length === 0 ? FIRST_BONUS : 0);
	const next = {
		...state,
		found: [...state.found, id],
		scores: addPoints(state.scores, { [id]: pts }),
		lastPoints: { ...state.lastPoints, [id]: pts }
	};
	return allFound(next) ? reveal(next, ctx) : next;
}

function allFound(state: FindItState): boolean {
	const present = state.players.filter((p) => state.active.includes(p.id));
	return present.length > 0 && present.every((p) => state.found.includes(p.id));
}

function phaseDuration(state: FindItState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'find':
			return state.config.secondsPerGrid * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
