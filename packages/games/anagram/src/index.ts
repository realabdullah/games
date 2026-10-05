import type { AnagramWord } from '@games/content';
import {
	addPoints,
	admitPlayer,
	defineGame,
	isController,
	maskWord,
	normalize,
	rankPlayers,
	type Actor,
	type GameContext,
	type GamePlayer,
	type LeaderboardEntry,
	type Rng
} from '@games/engine';

/**
 * Anagram Race. Everyone gets the same jumbled word and races to unscramble
 * it. The first and last letters show up as hints while the clock runs down.
 */

export const INTRO_MS = 4_000;
export const REVEAL_MS = 4_000;
export const MAX_GUESS_LENGTH = 20;
export const GUESS_POINTS = { min: 100, max: 500 };
export const FIRST_BONUS = 100;
/** The first letter shows at the first time, the last letter at the second. */
export const HINT_AT = [0.5, 0.75];

export type Level = 1 | 2 | 3;

/** Word lengths, by level. */
const LENGTHS: Record<Level, [number, number]> = { 1: [5, 5], 2: [6, 7], 3: [8, 12] };

export function wordsForLevel(items: readonly AnagramWord[], level: Level): AnagramWord[] {
	const [min, max] = LENGTHS[level] ?? LENGTHS[1];
	return items.filter((w) => w.word.length >= min && w.word.length <= max);
}

export interface AnagramConfig {
	rounds: number;
	secondsPerWord: number;
	level: Level;
}

export interface AnagramPuzzle extends AnagramWord {
	letters: string;
}

type Phase = 'intro' | 'solve' | 'reveal' | 'final';

export interface AnagramState {
	phase: Phase;
	players: GamePlayer[];
	puzzles: AnagramPuzzle[];
	round: number;
	config: AnagramConfig;
	phaseEndsAt: number;
	hintTimes: number[];
	hints: number;
	/** Players who got it this round, in order. */
	solved: string[];
	/** Each player's last wrong guess this round, shown only to them. */
	lastWrong: Record<string, string>;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type AnagramAction = { type: 'guess'; text: string } | { type: 'next' };

export interface AnagramView {
	phase: Phase;
	round: number;
	rounds: number;
	endsAt: number;
	durationMs: number;
	letters: string | null;
	category: string | null;
	/** Hint letters, or the whole word at the reveal. */
	mask: string[];
	answer: string | null;
	solvedCount: number;
	playerCount: number;
	solvers: GamePlayer[];
	you: {
		solved: boolean;
		lastWrong: string | null;
		points: number;
		score: number;
		rank: number | null;
	} | null;
	leaderboard: LeaderboardEntry[];
}

/**
 * `isWord` checks five-letter words, so any real anagram counts ("melon"
 * for "lemon"). Pass it in so the dictionary only loads where it's needed.
 */
export function createAnagram(isWord: (word: string) => boolean = () => false) {
	return defineGame<
		AnagramState,
		AnagramAction,
		AnagramConfig,
		{ items: AnagramWord[] },
		AnagramView
	>({
		meta: {
			id: 'anagram',
			name: 'Anagram Race',
			tagline: 'Unscramble the letters before anyone else.',
			tags: ['learning', 'fun'],
			modes: ['party', 'online', 'solo'],
			players: { min: 1, max: 12 },
			audience: false,
			durationMin: 5
		},

		defaultConfig: { rounds: 8, secondsPerWord: 45, level: 1 },

		setup({ config, players, content }, ctx) {
			const pool = wordsForLevel(content.items, config.level);
			const puzzles = ctx.rng
				.shuffle(pool.length ? pool : content.items)
				.slice(0, config.rounds)
				.map((w) => ({ ...w, letters: scramble(w.word, ctx.rng) }));
			return {
				phase: 'intro',
				players,
				puzzles,
				round: 0,
				config: { ...config, rounds: puzzles.length },
				phaseEndsAt: ctx.now + INTRO_MS,
				hintTimes: [],
				hints: 0,
				solved: [],
				lastWrong: {},
				scores: Object.fromEntries(players.map((p) => [p.id, 0])),
				lastPoints: {},
				active: players.map((p) => p.id)
			};
		},

		parseAction(raw) {
			if (typeof raw !== 'object' || raw === null) return null;
			const a = raw as Record<string, unknown>;
			if (a.type === 'next') return { type: 'next' };
			if (a.type === 'guess' && typeof a.text === 'string') {
				const text = a.text.trim().slice(0, MAX_GUESS_LENGTH);
				return text ? { type: 'guess', text } : null;
			}
			return null;
		},

		reduce(state, action, actor, ctx) {
			switch (action.type) {
				case 'tick':
					return tick(state, ctx);
				case 'join':
					return admitPlayer(state, action.player, ctx);
				case 'roster': {
					const next = { ...state, active: [...ctx.active] };
					return next.phase === 'solve' && allSolved(next) ? reveal(next, ctx) : next;
				}
				case 'next':
					return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
				case 'guess':
					return guess(state, action.text, actor, ctx);
			}
		},

		view(state, viewer) {
			const puzzle = state.puzzles[state.round];
			const inRound = state.phase === 'solve' || state.phase === 'reveal';
			const id = viewer.kind === 'player' ? viewer.playerId : null;
			const playing = id !== null && state.players.some((p) => p.id === id);
			const ranked = rankPlayers(state.players, state.scores, state.lastPoints);
			const word = puzzle?.word ?? '';

			return {
				phase: state.phase,
				round: state.round,
				rounds: state.puzzles.length,
				endsAt: state.phaseEndsAt,
				durationMs: phaseDuration(state),
				letters: inRound ? (puzzle?.letters ?? null) : null,
				category: inRound ? (puzzle?.category ?? null) : null,
				mask: inRound
					? maskWord(
							word,
							state.phase === 'reveal'
								? [...word].map((_, i) => i)
								: [0, word.length - 1].slice(0, state.hints)
						)
					: [],
				answer: state.phase === 'reveal' ? word : null,
				solvedCount: state.solved.length,
				playerCount: state.players.filter((p) => state.active.includes(p.id)).length,
				solvers: state.solved.flatMap((s) => state.players.find((p) => p.id === s) ?? []),
				you: playing
					? {
							solved: state.solved.includes(id),
							lastWrong: state.lastWrong[id] ?? null,
							points: state.lastPoints[id] ?? 0,
							score: state.scores[id] ?? 0,
							rank: ranked.find((e) => e.id === id)?.rank ?? null
						}
					: null,
				leaderboard: state.phase === 'reveal' || state.phase === 'final' ? ranked : []
			};
		},

		nextDeadline(state) {
			if (state.phase === 'final') return null;
			const hint = state.phase === 'solve' ? state.hintTimes[state.hints] : undefined;
			return hint !== undefined ? Math.min(hint, state.phaseEndsAt) : state.phaseEndsAt;
		},

		shiftTime(state, ms) {
			return {
				...state,
				phaseEndsAt: state.phaseEndsAt + ms,
				hintTimes: state.hintTimes.map((t) => t + ms)
			};
		},

		isOver(state) {
			return state.phase === 'final';
		}
	});

	function guess(state: AnagramState, text: string, actor: Actor, ctx: GameContext): AnagramState {
		if (state.phase !== 'solve' || ctx.now >= state.phaseEndsAt) return state;
		if (actor.kind !== 'player') return state;
		const id = actor.playerId;
		if (!state.players.some((p) => p.id === id) || state.solved.includes(id)) return state;

		if (!isAnswer(normalize(text), state.puzzles[state.round]!.word)) {
			return { ...state, lastWrong: { ...state.lastWrong, [id]: text } };
		}
		const left = Math.max(0, state.phaseEndsAt - ctx.now) / (state.config.secondsPerWord * 1000);
		const pts =
			Math.round((GUESS_POINTS.min + (GUESS_POINTS.max - GUESS_POINTS.min) * left) / 10) * 10 +
			(state.solved.length === 0 ? FIRST_BONUS : 0);
		const next = {
			...state,
			solved: [...state.solved, id],
			scores: addPoints(state.scores, { [id]: pts }),
			lastPoints: { ...state.lastPoints, [id]: pts }
		};
		return allSolved(next) ? reveal(next, ctx) : next;
	}

	/** The word itself, or a real five-letter word with the same letters. */
	function isAnswer(attempt: string, word: string): boolean {
		if (attempt === word) return true;
		return word.length === 5 && sameLetters(attempt, word) && isWord(attempt);
	}
}

/** The default game, accepting only the listed word. */
export const anagram = createAnagram();

export function sameLetters(a: string, b: string): boolean {
	return a.length === b.length && [...a].sort().join('') === [...b].sort().join('');
}

/** Jumbled so it never reads as the word itself. */
export function scramble(word: string, rng: Rng): string {
	for (let i = 0; i < 10; i++) {
		const letters = rng.shuffle([...word]).join('');
		if (letters !== word) return letters;
	}
	return [...word].reverse().join('');
}

// ---------- transitions ----------

function tick(state: AnagramState, ctx: GameContext): AnagramState {
	if (state.phase === 'solve') {
		const hintAt = state.hintTimes[state.hints];
		if (hintAt !== undefined && ctx.now >= hintAt && ctx.now < state.phaseEndsAt) {
			return { ...state, hints: state.hints + 1 };
		}
	}
	return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
}

function advance(state: AnagramState, ctx: GameContext): AnagramState {
	switch (state.phase) {
		case 'intro':
			return startRound(state, 0, ctx);
		case 'solve':
			return reveal(state, ctx);
		case 'reveal':
			return state.round + 1 < state.puzzles.length
				? startRound(state, state.round + 1, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now };
		case 'final':
			return state;
	}
}

function startRound(state: AnagramState, round: number, ctx: GameContext): AnagramState {
	const ms = state.config.secondsPerWord * 1000;
	return {
		...state,
		phase: 'solve',
		round,
		phaseEndsAt: ctx.now + ms,
		hintTimes: HINT_AT.map((f) => ctx.now + ms * f),
		hints: 0,
		solved: [],
		lastWrong: {},
		lastPoints: {}
	};
}

function reveal(state: AnagramState, ctx: GameContext): AnagramState {
	return { ...state, phase: 'reveal', phaseEndsAt: ctx.now + REVEAL_MS };
}

function allSolved(state: AnagramState): boolean {
	const present = state.players.filter((p) => state.active.includes(p.id));
	return present.length > 0 && present.every((p) => state.solved.includes(p.id));
}

function phaseDuration(state: AnagramState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'solve':
			return state.config.secondsPerWord * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
