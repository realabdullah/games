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
 * Memory Grid. Some tiles light up for a moment, then go dark. Everyone taps
 * the ones they remember. Each round lights one more tile; a wrong tap ends
 * your turn for that round. The pattern never leaves the server while you
 * recall it.
 */

export const INTRO_MS = 4_000;
export const REVEAL_MS = 4_000;
/** How long the pattern shows: a base plus a little per tile. */
export const SHOW_MS = { base: 1_200, perTile: 300 };
export const TILE_POINTS = 100;
/** Per tile, for getting the whole pattern. */
export const PERFECT_BONUS = 50;

export type Level = 1 | 2 | 3;
/** Tiles in the first round, by level. */
const FIRST_TILES: Record<Level, number> = { 1: 3, 2: 4, 3: 6 };

export interface MemoryConfig {
	rounds: number;
	recallSeconds: number;
	level: Level;
}

export interface Pattern {
	size: number;
	tiles: number[];
}

type Phase = 'intro' | 'show' | 'recall' | 'reveal' | 'final';

export interface MemoryState {
	phase: Phase;
	players: GamePlayer[];
	patterns: Pattern[];
	round: number;
	config: MemoryConfig;
	phaseEndsAt: number;
	/** Tiles tapped this round, in order, by player. */
	picks: Record<string, number[]>;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type MemoryAction = { type: 'pick'; index: number } | { type: 'next' };

export interface MemoryResult {
	player: GamePlayer;
	right: number;
	perfect: boolean;
	points: number;
}

export interface MemoryView {
	phase: Phase;
	round: number;
	rounds: number;
	endsAt: number;
	durationMs: number;
	size: number;
	/** How many tiles to find. */
	count: number;
	/** The lit tiles: while showing and at the reveal only. */
	tiles: number[];
	doneCount: number;
	playerCount: number;
	results: MemoryResult[];
	you: {
		picks: { index: number; right: boolean }[];
		done: boolean;
		points: number;
		score: number;
		rank: number | null;
	} | null;
	leaderboard: LeaderboardEntry[];
}

export const memory = defineGame<MemoryState, MemoryAction, MemoryConfig, null, MemoryView>({
	meta: {
		id: 'memory',
		name: 'Memory Grid',
		tagline: 'Watch the tiles light up, then tap them from memory.',
		tags: ['learning', 'fun'],
		modes: ['party', 'online', 'solo'],
		players: { min: 1, max: 12 },
		audience: false,
		durationMin: 4
	},

	defaultConfig: { rounds: 6, recallSeconds: 15, level: 1 },

	setup({ config, players }, ctx) {
		return {
			phase: 'intro',
			players,
			patterns: makePatterns(config.level, config.rounds, ctx.rng),
			round: 0,
			config,
			phaseEndsAt: ctx.now + INTRO_MS,
			picks: {},
			scores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastPoints: {},
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (a.type === 'pick' && Number.isInteger(a.index) && (a.index as number) >= 0) {
			return { type: 'pick', index: a.index as number };
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
				return next.phase === 'recall' && allDone(next) ? reveal(next, ctx) : next;
			}
			case 'next':
				return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
			case 'pick':
				return pick(state, action.index, actor, ctx);
		}
	},

	view(state, viewer) {
		const pattern = state.patterns[state.round];
		const inRound = state.phase !== 'intro' && state.phase !== 'final';
		const id = viewer.kind === 'player' ? viewer.playerId : null;
		const playing = id !== null && state.players.some((p) => p.id === id);
		const ranked = rankPlayers(state.players, state.scores, state.lastPoints);
		const tiles = pattern?.tiles ?? [];
		const picks = (id && state.picks[id]) || [];

		return {
			phase: state.phase,
			round: state.round,
			rounds: state.patterns.length,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			size: inRound ? (pattern?.size ?? 0) : 0,
			count: inRound ? tiles.length : 0,
			tiles: state.phase === 'show' || state.phase === 'reveal' ? tiles : [],
			doneCount: state.players.filter((p) => isDone(state, p.id)).length,
			playerCount: state.players.filter((p) => state.active.includes(p.id)).length,
			results: state.phase === 'reveal' ? results(state) : [],
			you: playing
				? {
						picks: picks.map((index) => ({ index, right: tiles.includes(index) })),
						done: isDone(state, id),
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
		return { ...state, phaseEndsAt: state.phaseEndsAt + ms };
	},

	isOver(state) {
		return state.phase === 'final';
	}
});

// ---------- patterns ----------

/** The grid grows with the pattern so there's always room to get it wrong. */
export function gridSize(tiles: number): number {
	return tiles <= 4 ? 4 : tiles <= 7 ? 5 : 6;
}

/** One more tile each round. */
export function makePatterns(level: Level, rounds: number, rng: Rng): Pattern[] {
	const first = FIRST_TILES[level] ?? FIRST_TILES[1];
	return Array.from({ length: rounds }, (_, i) => {
		const count = first + i;
		const size = gridSize(count);
		const cells = Array.from({ length: size * size }, (_, c) => c);
		return { size, tiles: rng.shuffle(cells).slice(0, count) };
	});
}

// ---------- transitions ----------

function advance(state: MemoryState, ctx: GameContext): MemoryState {
	switch (state.phase) {
		case 'intro':
			return show(state, 0, ctx);
		case 'show':
			return {
				...state,
				phase: 'recall',
				phaseEndsAt: ctx.now + state.config.recallSeconds * 1000
			};
		case 'recall':
			return reveal(state, ctx);
		case 'reveal':
			return state.round + 1 < state.patterns.length
				? show(state, state.round + 1, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now };
		case 'final':
			return state;
	}
}

function showMs(pattern: Pattern): number {
	return SHOW_MS.base + SHOW_MS.perTile * pattern.tiles.length;
}

function show(state: MemoryState, round: number, ctx: GameContext): MemoryState {
	return {
		...state,
		phase: 'show',
		round,
		phaseEndsAt: ctx.now + showMs(state.patterns[round]!),
		picks: {},
		lastPoints: {}
	};
}

function reveal(state: MemoryState, ctx: GameContext): MemoryState {
	const points: Record<string, number> = {};
	for (const r of results(state)) if (r.points) points[r.player.id] = r.points;
	return {
		...state,
		phase: 'reveal',
		phaseEndsAt: ctx.now + REVEAL_MS,
		scores: addPoints(state.scores, points),
		lastPoints: points
	};
}

/** Scored from the picks, best first. */
function results(state: MemoryState): MemoryResult[] {
	const tiles = state.patterns[state.round]!.tiles;
	return state.players
		.filter((p) => p.id in state.picks || state.active.includes(p.id))
		.map((p) => {
			const right = (state.picks[p.id] ?? []).filter((i) => tiles.includes(i)).length;
			const perfect = right === tiles.length;
			return {
				player: p,
				right,
				perfect,
				points: right * TILE_POINTS + (perfect ? PERFECT_BONUS * tiles.length : 0)
			};
		})
		.sort((a, b) => b.points - a.points);
}

function pick(state: MemoryState, index: number, actor: Actor, ctx: GameContext): MemoryState {
	if (state.phase !== 'recall' || actor.kind !== 'player') return state;
	const id = actor.playerId;
	if (!state.players.some((p) => p.id === id) || isDone(state, id)) return state;
	const pattern = state.patterns[state.round]!;
	const picks = state.picks[id] ?? [];
	if (index >= pattern.size * pattern.size || picks.includes(index)) return state;
	const next = { ...state, picks: { ...state.picks, [id]: [...picks, index] } };
	return allDone(next) ? reveal(next, ctx) : next;
}

/** All tiles found, or a wrong tap. */
function isDone(state: MemoryState, id: string): boolean {
	const picks = state.picks[id];
	if (!picks) return false;
	const tiles = state.patterns[state.round]!.tiles;
	return picks.length >= tiles.length || picks.some((i) => !tiles.includes(i));
}

function allDone(state: MemoryState): boolean {
	const present = state.players.filter((p) => state.active.includes(p.id));
	return present.length > 0 && present.every((p) => isDone(state, p.id));
}

function phaseDuration(state: MemoryState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'show':
			return showMs(state.patterns[state.round]!);
		case 'recall':
			return state.config.recallSeconds * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
