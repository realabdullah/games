import { censorText, type HangmanPack, type HangmanWord } from '@games/content';
import {
	addPoints,
	defineGame,
	isController,
	letterPositions,
	maskWord,
	normalize,
	rankPlayers,
	type Actor,
	type GameContext,
	type GamePlayer,
	type LeaderboardEntry
} from '@games/engine';

/**
 * Hangman. Players take turns picking a letter for the same hidden word; the
 * room shares six lives. Found letters score, and whoever completes the word,
 * by letter or by solving it outright, takes a bonus.
 */

export const INTRO_MS = 4_000;
export const REVEAL_MS = 6_000;
export const MAX_MISSES = 6;
/** Per copy of a letter found. */
export const LETTER_POINTS = 50;
/** For completing the word, plus LETTER_POINTS per letter still hidden when solved outright. */
export const SOLVE_POINTS = 100;
export const MAX_SOLVE_LENGTH = 40;

export interface HangmanConfig {
	rounds: number;
	turnSeconds: number;
	familyFilter: boolean;
}

type Phase = 'intro' | 'turn' | 'reveal' | 'final';

/** What just happened, for the big screen and phones to call out. */
export interface HangmanEvent {
	/** Changes every event, so screens can animate it. */
	n: number;
	playerId: string;
	kind: 'hit' | 'miss' | 'solve' | 'wrong-solve' | 'timeout';
	letter?: string;
	/** How many of the letter were found. */
	count?: number;
	/** A wrong solve attempt (censored with the family filter on). */
	text?: string;
}

export interface HangmanState {
	phase: Phase;
	players: GamePlayer[];
	words: HangmanWord[];
	round: number;
	config: HangmanConfig;
	phaseEndsAt: number;
	/** Fixed turn order; each word starts one seat further on. */
	order: string[];
	turn: string;
	guessed: string[];
	misses: number;
	/** Letter positions showing. */
	revealed: number[];
	solvedBy: string | null;
	event: HangmanEvent | null;
	eventCounter: number;
	scores: Record<string, number>;
	/** Points each player earned on the current word. */
	lastPoints: Record<string, number>;
	active: string[];
}

export type HangmanAction =
	{ type: 'letter'; letter: string } | { type: 'solve'; text: string } | { type: 'next' };

export interface HangmanView {
	phase: Phase;
	round: number;
	rounds: number;
	endsAt: number;
	durationMs: number;
	category: string | null;
	/** Hidden letters are "_"; the whole word once the round is over. */
	mask: string[];
	/** Only once the round is over. */
	word: string | null;
	/** Letters tried that aren't in the word. */
	wrong: string[];
	guessed: string[];
	misses: number;
	maxMisses: number;
	turn: GamePlayer | null;
	upNext: GamePlayer | null;
	event: (Omit<HangmanEvent, 'playerId'> & { player: GamePlayer | null }) | null;
	solvedBy: GamePlayer | null;
	you: { yourTurn: boolean; points: number; score: number; rank: number | null } | null;
	leaderboard: LeaderboardEntry[];
}

export const hangman = defineGame<
	HangmanState,
	HangmanAction,
	HangmanConfig,
	HangmanPack,
	HangmanView
>({
	meta: {
		id: 'hangman',
		name: 'Hangman',
		tagline: 'Take turns picking letters. Six wrong and the word wins.',
		tags: ['learning', 'fun'],
		modes: ['party', 'online', 'solo'],
		players: { min: 1, max: 10 },
		audience: false,
		durationMin: 8
	},

	defaultConfig: { rounds: 5, turnSeconds: 15, familyFilter: true },

	setup({ config, players, content }, ctx) {
		const words = ctx.rng.shuffle(content.items).slice(0, config.rounds);
		const order = ctx.rng.shuffle(players.map((p) => p.id));
		return {
			phase: 'intro',
			players,
			words,
			round: 0,
			config: { ...config, rounds: words.length },
			phaseEndsAt: ctx.now + INTRO_MS,
			order,
			turn: order[0]!,
			guessed: [],
			misses: 0,
			revealed: [],
			solvedBy: null,
			event: null,
			eventCounter: 0,
			scores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastPoints: {},
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (a.type === 'letter' && typeof a.letter === 'string' && /^[a-z]$/i.test(a.letter)) {
			return { type: 'letter', letter: a.letter.toLowerCase() };
		}
		if (a.type === 'solve' && typeof a.text === 'string') {
			const text = a.text.replace(/\s+/g, ' ').trim().slice(0, MAX_SOLVE_LENGTH);
			return text ? { type: 'solve', text } : null;
		}
		return null;
	},

	reduce(state, action, actor, ctx) {
		switch (action.type) {
			case 'tick':
				if (ctx.now < state.phaseEndsAt) return state;
				return state.phase === 'turn' ? timeout(state, ctx) : advance(state, ctx);
			case 'join':
				// The seat order is fixed at the start; newcomers play the next game.
				return state;
			case 'roster': {
				const next = { ...state, active: [...ctx.active] };
				// Whoever's turn it was left: move on without costing a life.
				return next.phase === 'turn' && !next.active.includes(next.turn)
					? passTurn(next, ctx)
					: next;
			}
			case 'next':
				return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
			case 'letter':
				return letter(state, action.letter, actor, ctx);
			case 'solve':
				return solve(state, action.text, actor, ctx);
		}
	},

	view(state, viewer) {
		const current = state.words[state.round];
		const over = state.phase === 'reveal' || state.phase === 'final';
		const inRound = state.phase === 'turn' || state.phase === 'reveal';
		const ranked = rankPlayers(state.players, state.scores, state.lastPoints);
		const player = (id: string | null) => state.players.find((p) => p.id === id) ?? null;
		const viewerId = viewer.kind === 'player' ? viewer.playerId : null;
		const playing = viewerId !== null && state.players.some((p) => p.id === viewerId);
		const word = current?.word ?? '';

		return {
			phase: state.phase,
			round: state.round,
			rounds: state.words.length,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			category: inRound ? (current?.category ?? null) : null,
			mask: inRound ? maskWord(word, over ? letterPositions(word) : state.revealed) : [],
			word: state.phase === 'reveal' ? word : null,
			wrong: state.guessed.filter((ch) => !word.includes(ch)),
			guessed: state.guessed,
			misses: state.misses,
			maxMisses: MAX_MISSES,
			turn: state.phase === 'turn' ? player(state.turn) : null,
			upNext: state.phase === 'turn' ? player(nextSeat(state, state.turn)) : null,
			event: state.event ? { ...state.event, player: player(state.event.playerId) } : null,
			solvedBy: state.phase === 'reveal' ? player(state.solvedBy) : null,
			you: playing
				? {
						yourTurn: state.phase === 'turn' && state.turn === viewerId,
						points: state.lastPoints[viewerId!] ?? 0,
						score: state.scores[viewerId!] ?? 0,
						rank: ranked.find((e) => e.id === viewerId)?.rank ?? null
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

// ---------- transitions ----------

function advance(state: HangmanState, ctx: GameContext): HangmanState {
	switch (state.phase) {
		case 'intro':
			return startRound(state, 0, ctx);
		case 'turn':
			return reveal(state, null, ctx);
		case 'reveal':
			return state.round + 1 < state.words.length
				? startRound(state, state.round + 1, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now, event: null };
		case 'final':
			return state;
	}
}

function startRound(state: HangmanState, round: number, ctx: GameContext): HangmanState {
	// Each word starts one seat on from the last, so nobody always goes first.
	const seat = state.order[round % state.order.length]!;
	const first = state.active.includes(seat) ? seat : nextSeat(state, seat);
	return {
		...state,
		phase: 'turn',
		round,
		turn: first,
		guessed: [],
		misses: 0,
		revealed: [],
		solvedBy: null,
		event: null,
		lastPoints: {},
		phaseEndsAt: ctx.now + state.config.turnSeconds * 1000
	};
}

function reveal(state: HangmanState, solvedBy: string | null, ctx: GameContext): HangmanState {
	return { ...state, phase: 'reveal', solvedBy, phaseEndsAt: ctx.now + REVEAL_MS };
}

/** The next present player after `id`, in seat order (or `id` itself if alone). */
function nextSeat(state: HangmanState, id: string): string {
	const at = state.order.indexOf(id);
	for (let i = 1; i <= state.order.length; i++) {
		const candidate = state.order[(at + i) % state.order.length]!;
		if (state.active.includes(candidate)) return candidate;
	}
	return id;
}

function passTurn(state: HangmanState, ctx: GameContext): HangmanState {
	return {
		...state,
		turn: nextSeat(state, state.turn),
		phaseEndsAt: ctx.now + state.config.turnSeconds * 1000
	};
}

function withEvent(state: HangmanState, event: Omit<HangmanEvent, 'n'>): HangmanState {
	const n = state.eventCounter + 1;
	return { ...state, eventCounter: n, event: { ...event, n } };
}

/** A miss ends the word once the room runs out of lives; otherwise play passes on. */
function miss(state: HangmanState, ctx: GameContext): HangmanState {
	const next = { ...state, misses: state.misses + 1 };
	return next.misses >= MAX_MISSES ? reveal(next, null, ctx) : passTurn(next, ctx);
}

function timeout(state: HangmanState, ctx: GameContext): HangmanState {
	return miss(withEvent(state, { playerId: state.turn, kind: 'timeout' }), ctx);
}

function score(state: HangmanState, id: string, points: number): HangmanState {
	return {
		...state,
		scores: addPoints(state.scores, { [id]: points }),
		lastPoints: addPoints(state.lastPoints, { [id]: points })
	};
}

/** The actor's id if it's their turn, else null. */
function turnOf(state: HangmanState, actor: Actor, ctx: GameContext): string | null {
	const live = state.phase === 'turn' && ctx.now < state.phaseEndsAt;
	return live && actor.kind === 'player' && actor.playerId === state.turn ? actor.playerId : null;
}

function letter(state: HangmanState, ch: string, actor: Actor, ctx: GameContext): HangmanState {
	const id = turnOf(state, actor, ctx);
	if (!id || state.guessed.includes(ch)) return state;
	const word = state.words[state.round]!.word;
	const found = [...word].flatMap((c, i) => (c === ch ? [i] : []));
	let next: HangmanState = { ...state, guessed: [...state.guessed, ch] };
	if (found.length === 0) {
		return miss(withEvent(next, { playerId: id, kind: 'miss', letter: ch }), ctx);
	}
	next = withEvent(next, { playerId: id, kind: 'hit', letter: ch, count: found.length });
	next = score(
		{ ...next, revealed: [...state.revealed, ...found] },
		id,
		found.length * LETTER_POINTS
	);
	const done = letterPositions(word).every((i) => next.revealed.includes(i));
	return done ? reveal(score(next, id, SOLVE_POINTS), id, ctx) : passTurn(next, ctx);
}

function solve(state: HangmanState, text: string, actor: Actor, ctx: GameContext): HangmanState {
	const id = turnOf(state, actor, ctx);
	if (!id) return state;
	const word = state.words[state.round]!.word;
	if (normalize(text) === normalize(word)) {
		const hidden = letterPositions(word).filter((i) => !state.revealed.includes(i)).length;
		const next = withEvent(state, { playerId: id, kind: 'solve' });
		return reveal(score(next, id, SOLVE_POINTS + hidden * LETTER_POINTS), id, ctx);
	}
	const shown = state.config.familyFilter ? censorText(text) : text;
	return miss(withEvent(state, { playerId: id, kind: 'wrong-solve', text: shown }), ctx);
}

function phaseDuration(state: HangmanState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'turn':
			return state.config.turnSeconds * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
