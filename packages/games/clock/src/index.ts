import {
	addPoints,
	admitPlayer,
	defineGame,
	isController,
	rankPlayers,
	type Actor,
	type GameContext,
	type GamePlayer,
	type LeaderboardEntry
} from '@games/engine';

/**
 * Stop the Clock. Everyone sees a target time, say 7.4 seconds. After a
 * countdown a clock starts that nobody can see, and everyone taps when they
 * think the time is up. Closest tap wins.
 *
 * Each screen times from the moment it shows "go", using the synced server
 * clock, so a slow connection doesn't cost anyone. The server only refuses
 * taps that claim more time than has really passed.
 */

export const INTRO_MS = 4_000;
/** The 3, 2, 1 before the hidden clock starts. */
export const READY_MS = 3_000;
export const REVEAL_MS = 6_000;
/** Up to this much on top of the target for the closest tap. */
export const CLOSEST_BONUS = 200;
export const MAX_POINTS = 500;
/** Within this much is "perfect". */
export const PERFECT_MS = 50;
/** Leeway for clock sync when checking a tap's claimed time. */
export const TAP_SLACK_MS = 1_500;

export type Level = 1 | 2 | 3;

/** Target range in tenths of a second, by level. */
const TARGETS: Record<Level, [number, number]> = {
	1: [20, 60],
	2: [50, 120],
	3: [100, 250]
};

export interface ClockConfig {
	rounds: number;
	level: Level;
}

type Phase = 'intro' | 'ready' | 'run' | 'reveal' | 'final';

export interface ClockState {
	phase: Phase;
	players: GamePlayer[];
	/** Target per round, in ms. */
	targets: number[];
	round: number;
	config: ClockConfig;
	phaseEndsAt: number;
	/** When the hidden clock started (the end of `ready`). */
	startedAt: number;
	/** Each player's tap this round, in ms after the start. */
	taps: Record<string, number>;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type ClockAction = { type: 'tap'; ms: number } | { type: 'next' };

export interface ClockResult {
	player: GamePlayer;
	ms: number | null;
	/** How far off, in ms. */
	off: number | null;
	points: number;
}

export interface ClockView {
	phase: Phase;
	round: number;
	rounds: number;
	endsAt: number;
	durationMs: number;
	target: number | null;
	/** Server time the hidden clock starts (during `ready`) or started. */
	startsAt: number;
	tappedCount: number;
	playerCount: number;
	/** Closest first. Only at the reveal. */
	results: ClockResult[];
	you: { tapped: boolean; points: number; score: number; rank: number | null } | null;
	leaderboard: LeaderboardEntry[];
}

export const clock = defineGame<ClockState, ClockAction, ClockConfig, null, ClockView>({
	meta: {
		id: 'clock',
		name: 'Stop the Clock',
		tagline: 'Count in your head and tap when time’s up. Closest wins.',
		tags: ['fun'],
		modes: ['party', 'online', 'solo'],
		players: { min: 1, max: 12 },
		audience: false,
		durationMin: 3
	},

	defaultConfig: { rounds: 5, level: 1 },

	setup({ config, players }, ctx) {
		const [min, max] = TARGETS[config.level] ?? TARGETS[1];
		return {
			phase: 'intro',
			players,
			targets: Array.from({ length: config.rounds }, () => ctx.rng.int(min, max) * 100),
			round: 0,
			config,
			phaseEndsAt: ctx.now + INTRO_MS,
			startedAt: 0,
			taps: {},
			scores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastPoints: {},
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (a.type === 'tap' && typeof a.ms === 'number' && Number.isFinite(a.ms) && a.ms >= 0) {
			return { type: 'tap', ms: Math.round(a.ms) };
		}
		return null;
	},

	reduce(state, action, actor, ctx) {
		switch (action.type) {
			case 'tick':
				return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
			case 'join':
				// Each round is its own race, so a newcomer can play from here on.
				return admitPlayer(state, action.player, ctx);
			case 'roster': {
				const next = { ...state, active: [...ctx.active] };
				return next.phase === 'run' && allTapped(next) ? reveal(next, ctx) : next;
			}
			case 'next':
				return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
			case 'tap':
				return tap(state, action.ms, actor, ctx);
		}
	},

	view(state, viewer) {
		const id = viewer.kind === 'player' ? viewer.playerId : null;
		const playing = id !== null && state.players.some((p) => p.id === id);
		const ranked = rankPlayers(state.players, state.scores, state.lastPoints);
		const target = state.targets[state.round] ?? 0;
		const inRound = state.phase !== 'intro' && state.phase !== 'final';

		return {
			phase: state.phase,
			round: state.round,
			rounds: state.targets.length,
			endsAt: state.phaseEndsAt,
			// The run has no visible deadline: a bar would give the time away.
			durationMs: state.phase === 'run' ? 0 : phaseDuration(state),
			target: inRound ? target : null,
			startsAt: state.startedAt,
			tappedCount: Object.keys(state.taps).length,
			playerCount: state.players.filter((p) => state.active.includes(p.id)).length,
			results: state.phase === 'reveal' ? results(state) : [],
			you: playing
				? {
						tapped: id in state.taps,
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
		return { ...state, phaseEndsAt: state.phaseEndsAt + ms, startedAt: state.startedAt + ms };
	},

	isOver(state) {
		return state.phase === 'final';
	}
});

/** Points for a tap `off` ms from `target`: full marks when spot on, none at 50% off. */
export function pointsFor(off: number, target: number): number {
	const share = Math.max(0, 1 - (2 * off) / target);
	return Math.round((MAX_POINTS * share) / 10) * 10;
}

/** Players this round, closest first; no-shows last. */
function results(state: ClockState): ClockResult[] {
	const target = state.targets[state.round]!;
	return state.players
		.filter((p) => p.id in state.taps || state.active.includes(p.id))
		.map((p) => {
			const ms = state.taps[p.id] ?? null;
			return {
				player: p,
				ms,
				off: ms === null ? null : Math.abs(ms - target),
				points: state.lastPoints[p.id] ?? 0
			};
		})
		.sort((a, b) => (a.off ?? Infinity) - (b.off ?? Infinity));
}

// ---------- transitions ----------

function advance(state: ClockState, ctx: GameContext): ClockState {
	switch (state.phase) {
		case 'intro':
			return ready(state, 0, ctx);
		case 'ready':
			return {
				...state,
				phase: 'run',
				// Long enough for anyone to tap well past the target.
				phaseEndsAt: state.startedAt + state.targets[state.round]! * 2 + 2_000
			};
		case 'run':
			return reveal(state, ctx);
		case 'reveal':
			return state.round + 1 < state.targets.length
				? ready(state, state.round + 1, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now };
		case 'final':
			return state;
	}
}

function ready(state: ClockState, round: number, ctx: GameContext): ClockState {
	const startedAt = ctx.now + READY_MS;
	return {
		...state,
		phase: 'ready',
		round,
		phaseEndsAt: startedAt,
		startedAt,
		taps: {},
		lastPoints: {}
	};
}

function reveal(state: ClockState, ctx: GameContext): ClockState {
	const target = state.targets[state.round]!;
	const points: Record<string, number> = {};
	const offs = Object.entries(state.taps).map(([id, ms]) => [id, Math.abs(ms - target)] as const);
	const best = Math.min(...offs.map(([, off]) => off));
	for (const [id, off] of offs) {
		points[id] = pointsFor(off, target) + (off === best ? CLOSEST_BONUS : 0);
	}
	return {
		...state,
		phase: 'reveal',
		phaseEndsAt: ctx.now + REVEAL_MS,
		scores: addPoints(state.scores, points),
		lastPoints: points
	};
}

function tap(state: ClockState, ms: number, actor: Actor, ctx: GameContext): ClockState {
	if (state.phase !== 'run' || actor.kind !== 'player') return state;
	const id = actor.playerId;
	if (!state.players.some((p) => p.id === id) || id in state.taps) return state;
	// A tap can't claim more time than has passed (plus leeway for clock sync).
	if (ms > ctx.now - state.startedAt + TAP_SLACK_MS) return state;
	const next = { ...state, taps: { ...state.taps, [id]: ms } };
	return allTapped(next) ? reveal(next, ctx) : next;
}

function allTapped(state: ClockState): boolean {
	const present = state.players.filter((p) => state.active.includes(p.id));
	return present.length > 0 && present.every((p) => p.id in state.taps);
}

function phaseDuration(state: ClockState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'ready':
			return READY_MS;
		case 'run':
			return 0;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
