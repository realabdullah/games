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
 * Quick Maths. Everyone gets the same sum and races to type the answer.
 * Sooner is worth more, the first right answer gets a bonus, and three
 * wrong answers put you out for that sum.
 */

export const INTRO_MS = 4_000;
export const REVEAL_MS = 4_000;
/** More for answering sooner. */
export const ANSWER_POINTS = { min: 100, max: 500 };
export const FIRST_BONUS = 100;
export const MAX_TRIES = 3;
export const MAX_ANSWER_LENGTH = 9;

export type Level = 1 | 2 | 3;

export interface MathsConfig {
	rounds: number;
	secondsPerSum: number;
	level: Level;
}

export interface Sum {
	/** As shown, e.g. "7 × 8". */
	text: string;
	answer: number;
}

type Phase = 'intro' | 'sum' | 'reveal' | 'final';

export interface MathsState {
	phase: Phase;
	players: GamePlayer[];
	sums: Sum[];
	round: number;
	config: MathsConfig;
	phaseEndsAt: number;
	/** Players who got it this round, in order. */
	solved: string[];
	/** Wrong answers this round, by player. */
	wrong: Record<string, number[]>;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type MathsAction = { type: 'answer'; value: number } | { type: 'next' };

export interface MathsView {
	phase: Phase;
	round: number;
	rounds: number;
	endsAt: number;
	durationMs: number;
	sum: string | null;
	answer: number | null;
	solvedCount: number;
	playerCount: number;
	/** Who got it this round, fastest first. */
	solvers: GamePlayer[];
	you: {
		solved: boolean;
		wrong: number[];
		triesLeft: number;
		points: number;
		score: number;
		rank: number | null;
	} | null;
	leaderboard: LeaderboardEntry[];
}

export const maths = defineGame<MathsState, MathsAction, MathsConfig, null, MathsView>({
	meta: {
		id: 'maths',
		name: 'Quick Maths',
		tagline: 'Same sum for everyone. First right answer scores most.',
		tags: ['learning', 'fun'],
		modes: ['party', 'online', 'solo'],
		players: { min: 1, max: 12 },
		audience: false,
		durationMin: 4
	},

	defaultConfig: { rounds: 10, secondsPerSum: 20, level: 1 },

	setup({ config, players }, ctx) {
		return {
			phase: 'intro',
			players,
			sums: makeSums(config.level, config.rounds, ctx.rng),
			round: 0,
			config,
			phaseEndsAt: ctx.now + INTRO_MS,
			solved: [],
			wrong: {},
			scores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastPoints: {},
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (a.type === 'answer') {
			const value = parseAnswer(a.value);
			return value === null ? null : { type: 'answer', value };
		}
		return null;
	},

	reduce(state, action, actor, ctx) {
		switch (action.type) {
			case 'tick':
				return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
			case 'join':
				// Each sum is its own race, so a newcomer can play from here on.
				return admitPlayer(state, action.player, ctx);
			case 'roster': {
				const next = { ...state, active: [...ctx.active] };
				return next.phase === 'sum' && allDone(next) ? reveal(next, ctx) : next;
			}
			case 'next':
				return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
			case 'answer':
				return answer(state, action.value, actor, ctx);
		}
	},

	view(state, viewer) {
		const sum = state.sums[state.round];
		const inRound = state.phase === 'sum' || state.phase === 'reveal';
		const over = state.phase === 'reveal' || state.phase === 'final';
		const id = viewer.kind === 'player' ? viewer.playerId : null;
		const playing = id !== null && state.players.some((p) => p.id === id);
		const ranked = rankPlayers(state.players, state.scores, state.lastPoints);
		const wrong = (id && state.wrong[id]) || [];

		return {
			phase: state.phase,
			round: state.round,
			rounds: state.sums.length,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			sum: inRound ? (sum?.text ?? null) : null,
			answer: state.phase === 'reveal' ? (sum?.answer ?? null) : null,
			solvedCount: state.solved.length,
			playerCount: state.players.filter((p) => state.active.includes(p.id)).length,
			solvers: state.solved.flatMap((s) => state.players.find((p) => p.id === s) ?? []),
			you: playing
				? {
						solved: state.solved.includes(id),
						wrong,
						triesLeft: MAX_TRIES - wrong.length,
						points: state.lastPoints[id] ?? 0,
						score: state.scores[id] ?? 0,
						rank: ranked.find((e) => e.id === id)?.rank ?? null
					}
				: null,
			leaderboard: over ? ranked : []
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

/** A whole number from what was typed: "1,200" and " 42 " are fine. */
export function parseAnswer(raw: unknown): number | null {
	if (typeof raw === 'number') return Number.isSafeInteger(raw) ? raw : null;
	if (typeof raw !== 'string') return null;
	const text = raw.replace(/[\s,]/g, '').replace(/^−/, '-');
	if (!/^-?\d{1,9}$/.test(text)) return null;
	return Number(text);
}

// ---------- sums ----------

type Maker = (rng: Rng) => Sum;

const add = (a: number, b: number): Sum => ({ text: `${a} + ${b}`, answer: a + b });
const sub = (a: number, b: number): Sum => ({ text: `${a} − ${b}`, answer: a - b });
const mul = (a: number, b: number): Sum => ({ text: `${a} × ${b}`, answer: a * b });
/** Always divides exactly. */
const div = (divisor: number, quotient: number): Sum => ({
	text: `${divisor * quotient} ÷ ${divisor}`,
	answer: quotient
});

/** Answers are never negative, so a phone's number pad is enough. */
const makers: Record<Level, Maker[]> = {
	1: [
		(r) => add(r.int(2, 20), r.int(2, 20)),
		(r) => {
			const a = r.int(6, 30);
			return sub(a, r.int(1, a - 1));
		},
		(r) => mul(r.int(2, 10), r.int(2, 10))
	],
	2: [
		(r) => add(r.int(12, 99), r.int(12, 99)),
		(r) => {
			const a = r.int(30, 99);
			return sub(a, r.int(11, a - 5));
		},
		(r) => mul(r.int(3, 12), r.int(3, 12)),
		(r) => div(r.int(2, 12), r.int(2, 12))
	],
	3: [
		(r) => mul(r.int(12, 99), r.int(3, 9)),
		(r) => div(r.int(3, 15), r.int(6, 20)),
		(r) => {
			const [a, b, c] = [r.int(2, 30), r.int(3, 12), r.int(3, 12)];
			return { text: `${a} + ${b} × ${c}`, answer: a + b * c };
		},
		(r) => {
			const [a, b] = [r.int(4, 12), r.int(4, 12)];
			const c = r.int(2, a * b - 1);
			return { text: `${a} × ${b} − ${c}`, answer: a * b - c };
		},
		(r) => {
			const [a, b, c] = [r.int(2, 15), r.int(2, 15), r.int(3, 9)];
			return { text: `(${a} + ${b}) × ${c}`, answer: (a + b) * c };
		},
		(r) => {
			const n = r.int(11, 20);
			return { text: `${n}²`, answer: n * n };
		},
		(r) => {
			const pct = r.pick([10, 20, 25, 50, 75]);
			const base = (100 / gcd(pct, 100)) * r.int(2, 12);
			return { text: `${pct}% of ${base}`, answer: (pct * base) / 100 };
		}
	]
};

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

/** `count` different sums, cycling through the kinds so a game mixes them. */
export function makeSums(level: Level, count: number, rng: Rng): Sum[] {
	const kinds = makers[level] ?? makers[1];
	const order = rng.shuffle(kinds);
	const sums: Sum[] = [];
	const seen = new Set<string>();
	for (let i = 0; sums.length < count && i < count * 10; i++) {
		const sum = order[sums.length % order.length]!(rng);
		if (seen.has(sum.text)) continue;
		seen.add(sum.text);
		sums.push(sum);
	}
	return sums;
}

// ---------- transitions ----------

function advance(state: MathsState, ctx: GameContext): MathsState {
	switch (state.phase) {
		case 'intro':
			return startRound(state, 0, ctx);
		case 'sum':
			return reveal(state, ctx);
		case 'reveal':
			return state.round + 1 < state.sums.length
				? startRound(state, state.round + 1, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now };
		case 'final':
			return state;
	}
}

function startRound(state: MathsState, round: number, ctx: GameContext): MathsState {
	return {
		...state,
		phase: 'sum',
		round,
		phaseEndsAt: ctx.now + state.config.secondsPerSum * 1000,
		solved: [],
		wrong: {},
		lastPoints: {}
	};
}

function reveal(state: MathsState, ctx: GameContext): MathsState {
	return { ...state, phase: 'reveal', phaseEndsAt: ctx.now + REVEAL_MS };
}

function answer(state: MathsState, value: number, actor: Actor, ctx: GameContext): MathsState {
	if (state.phase !== 'sum' || ctx.now >= state.phaseEndsAt) return state;
	if (actor.kind !== 'player') return state;
	const id = actor.playerId;
	if (!state.players.some((p) => p.id === id) || state.solved.includes(id)) return state;
	const wrong = state.wrong[id] ?? [];
	if (wrong.length >= MAX_TRIES) return state;

	if (value !== state.sums[state.round]!.answer) {
		const next = { ...state, wrong: { ...state.wrong, [id]: [...wrong, value] } };
		return allDone(next) ? reveal(next, ctx) : next;
	}
	const left = Math.max(0, state.phaseEndsAt - ctx.now) / (state.config.secondsPerSum * 1000);
	const pts =
		Math.round((ANSWER_POINTS.min + (ANSWER_POINTS.max - ANSWER_POINTS.min) * left) / 10) * 10 +
		(state.solved.length === 0 ? FIRST_BONUS : 0);
	const next = {
		...state,
		solved: [...state.solved, id],
		scores: addPoints(state.scores, { [id]: pts }),
		lastPoints: { ...state.lastPoints, [id]: pts }
	};
	return allDone(next) ? reveal(next, ctx) : next;
}

/** Everyone here has either got it or used up their tries. */
function allDone(state: MathsState): boolean {
	const present = state.players.filter((p) => state.active.includes(p.id));
	return (
		present.length > 0 &&
		present.every(
			(p) => state.solved.includes(p.id) || (state.wrong[p.id]?.length ?? 0) >= MAX_TRIES
		)
	);
}

function phaseDuration(state: MathsState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'sum':
			return state.config.secondsPerSum * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
