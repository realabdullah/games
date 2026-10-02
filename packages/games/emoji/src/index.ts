import { censorText, type EmojiPack, type EmojiPuzzle } from '@games/content';
import {
	addPoints,
	defineGame,
	editDistance,
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
 * Emoji Riddles. Everyone sees the same row of emojis and races to type what
 * they spell: a word, a film, a saying. Letters of the answer show up as
 * hints while the clock runs down.
 */

export const INTRO_MS = 4_000;
export const REVEAL_MS = 6_000;
export const MAX_GUESS_LENGTH = 60;
export const FEED_LENGTH = 30;
/** More for guessing sooner. */
export const GUESS_POINTS = { min: 100, max: 500 };
/** Letter hints appear at these fractions of the time. */
export const HINT_AT = [0.4, 0.7];
/** Long answers forgive one typo. */
const TYPO_FROM = 10;

export interface EmojiConfig {
	rounds: number;
	secondsPerPuzzle: number;
	familyFilter: boolean;
}

type Phase = 'intro' | 'puzzle' | 'reveal' | 'final';

interface FeedItem {
	n: number;
	playerId: string;
	kind: 'guess' | 'correct' | 'close';
	text: string;
}

export interface EmojiState {
	phase: Phase;
	players: GamePlayer[];
	puzzles: EmojiPuzzle[];
	round: number;
	config: EmojiConfig;
	phaseEndsAt: number;
	hintTimes: number[];
	revealed: number[];
	/** Players who got it this round, in order. */
	guessed: string[];
	feed: FeedItem[];
	feedCounter: number;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type EmojiAction = { type: 'guess'; text: string } | { type: 'next' };

export interface EmojiView {
	phase: Phase;
	round: number;
	rounds: number;
	endsAt: number;
	durationMs: number;
	emoji: string | null;
	category: string | null;
	/** The answer with hidden letters as "_"; the whole answer at the reveal. */
	mask: string[];
	answer: string | null;
	guessedCount: number;
	playerCount: number;
	feed: { n: number; player: GamePlayer | null; kind: FeedItem['kind']; text: string }[];
	you: { guessed: boolean; points: number; score: number; rank: number | null } | null;
	leaderboard: LeaderboardEntry[];
}

export const emoji = defineGame<EmojiState, EmojiAction, EmojiConfig, EmojiPack, EmojiView>({
	meta: {
		id: 'emoji',
		name: 'Emoji Riddles',
		tagline: 'Read the emojis, name the thing. Fastest guess scores most.',
		tags: ['fun', 'learning'],
		modes: ['party', 'online', 'solo'],
		players: { min: 1, max: 12 },
		audience: true,
		durationMin: 6
	},

	defaultConfig: { rounds: 8, secondsPerPuzzle: 45, familyFilter: true },

	setup({ config, players, content }, ctx) {
		const puzzles = ctx.rng.shuffle(content.items).slice(0, config.rounds);
		return {
			phase: 'intro',
			players,
			puzzles,
			round: 0,
			config: { ...config, rounds: puzzles.length },
			phaseEndsAt: ctx.now + INTRO_MS,
			hintTimes: [],
			revealed: [],
			guessed: [],
			feed: [],
			feedCounter: 0,
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
			const text = a.text.replace(/\s+/g, ' ').trim().slice(0, MAX_GUESS_LENGTH);
			return text ? { type: 'guess', text } : null;
		}
		return null;
	},

	reduce(state, action, actor, ctx) {
		switch (action.type) {
			case 'tick':
				return tick(state, ctx);
			case 'roster': {
				const next = { ...state, active: [...ctx.active] };
				return next.phase === 'puzzle' && allGuessed(next) ? reveal(next, ctx) : next;
			}
			case 'next':
				return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
			case 'guess':
				return guess(state, action.text, actor, ctx);
		}
	},

	view(state, viewer) {
		const puzzle = state.puzzles[state.round];
		const inRound = state.phase === 'puzzle' || state.phase === 'reveal';
		const over = state.phase === 'reveal' || state.phase === 'final';
		const viewerId =
			viewer.kind === 'player'
				? viewer.playerId
				: viewer.kind === 'audience'
					? viewer.audienceId
					: null;
		const playing = viewer.kind === 'player' && state.players.some((p) => p.id === viewer.playerId);
		const ranked = rankPlayers(state.players, state.scores, state.lastPoints);
		const player = (id: string) => state.players.find((p) => p.id === id) ?? null;
		const answer = puzzle?.answer ?? '';

		return {
			phase: state.phase,
			round: state.round,
			rounds: state.puzzles.length,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			emoji: inRound ? (puzzle?.emoji ?? null) : null,
			category: inRound ? (puzzle?.category ?? null) : null,
			mask: inRound
				? maskWord(answer, state.phase === 'reveal' ? letterPositions(answer) : state.revealed)
				: [],
			answer: state.phase === 'reveal' ? answer : null,
			guessedCount: state.guessed.length,
			playerCount: state.players.filter((p) => state.active.includes(p.id)).length,
			// "Close!" hints are private to whoever guessed.
			feed: state.feed
				.filter((f) => f.kind !== 'close' || f.playerId === viewerId)
				.map((f) => ({ n: f.n, player: player(f.playerId), kind: f.kind, text: f.text })),
			you: playing
				? {
						guessed: state.guessed.includes(viewerId!),
						points: state.lastPoints[viewerId!] ?? 0,
						score: state.scores[viewerId!] ?? 0,
						rank: ranked.find((e) => e.id === viewerId)?.rank ?? null
					}
				: null,
			leaderboard: over ? ranked : []
		};
	},

	nextDeadline(state) {
		if (state.phase === 'final') return null;
		const hint = state.phase === 'puzzle' ? state.hintTimes[state.revealed.length] : undefined;
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

/** Normalized, without a leading "the" or "a", so "Lion King" matches "The Lion King". */
export function answerKey(text: string): string {
	return normalize(text.replace(/^\s*(the|a|an)\s+/i, ''));
}

/** 'correct', 'close' (one or two letters off) or 'wrong'. */
export function checkGuess(text: string, puzzle: EmojiPuzzle): 'correct' | 'close' | 'wrong' {
	const attempt = answerKey(text);
	let best = Infinity;
	let length = 0;
	for (const answer of [puzzle.answer, ...(puzzle.also ?? [])]) {
		const key = answerKey(answer);
		if (attempt === key) return 'correct';
		const d = editDistance(attempt, key);
		if (d < best) [best, length] = [d, key.length];
	}
	if (length >= TYPO_FROM && best === 1) return 'correct';
	if ((length >= 4 && best === 1) || (length >= TYPO_FROM && best === 2)) return 'close';
	return 'wrong';
}

// ---------- transitions ----------

function tick(state: EmojiState, ctx: GameContext): EmojiState {
	if (state.phase === 'puzzle') {
		const hintAt = state.hintTimes[state.revealed.length];
		if (hintAt !== undefined && ctx.now >= hintAt && ctx.now < state.phaseEndsAt) {
			return revealHint(state, ctx);
		}
	}
	return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
}

function advance(state: EmojiState, ctx: GameContext): EmojiState {
	switch (state.phase) {
		case 'intro':
			return startRound(state, 0, ctx);
		case 'puzzle':
			return reveal(state, ctx);
		case 'reveal':
			return state.round + 1 < state.puzzles.length
				? startRound(state, state.round + 1, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now };
		case 'final':
			return state;
	}
}

function startRound(state: EmojiState, round: number, ctx: GameContext): EmojiState {
	const ms = state.config.secondsPerPuzzle * 1000;
	const letters = letterPositions(state.puzzles[round]!.answer).length;
	return {
		...state,
		phase: 'puzzle',
		round,
		phaseEndsAt: ctx.now + ms,
		// Short answers get one hint at most.
		hintTimes: HINT_AT.slice(0, letters <= 3 ? 0 : letters <= 5 ? 1 : 2).map(
			(f) => ctx.now + ms * f
		),
		revealed: [],
		guessed: [],
		feed: [],
		lastPoints: {}
	};
}

/** Each hint shows about a sixth of the letters, always leaving some hidden. */
function revealHint(state: EmojiState, ctx: GameContext): EmojiState {
	const answer = state.puzzles[state.round]!.answer;
	const all = letterPositions(answer);
	const hidden = all.filter((i) => !state.revealed.includes(i));
	const count = Math.min(hidden.length - 2, Math.max(1, Math.round(all.length / 6)));
	if (count <= 0) return { ...state, hintTimes: [] };
	const picked = ctx.rng.shuffle(hidden).slice(0, count);
	return { ...state, revealed: [...state.revealed, ...picked] };
}

function reveal(state: EmojiState, ctx: GameContext): EmojiState {
	return { ...state, phase: 'reveal', phaseEndsAt: ctx.now + REVEAL_MS };
}

function guess(state: EmojiState, text: string, actor: Actor, ctx: GameContext): EmojiState {
	if (state.phase !== 'puzzle' || ctx.now >= state.phaseEndsAt) return state;
	if (actor.kind !== 'player' && actor.kind !== 'audience') return state;
	const id = actor.kind === 'player' ? actor.playerId : actor.audienceId;
	const isPlayer = actor.kind === 'player' && state.players.some((p) => p.id === id);
	if (state.guessed.includes(id)) return state;

	const result = checkGuess(text, state.puzzles[state.round]!);
	if (result === 'correct') {
		// Audience can play along, but only players score.
		if (!isPlayer) return addFeed(state, { playerId: id, kind: 'close', text: 'You got it!' });
		const left = Math.max(0, state.phaseEndsAt - ctx.now) / (state.config.secondsPerPuzzle * 1000);
		const pts =
			Math.round((GUESS_POINTS.min + (GUESS_POINTS.max - GUESS_POINTS.min) * left) / 10) * 10;
		const next = {
			...addFeed(state, { playerId: id, kind: 'correct', text: '' }),
			guessed: [...state.guessed, id],
			scores: addPoints(state.scores, { [id]: pts }),
			lastPoints: { ...state.lastPoints, [id]: pts }
		};
		return allGuessed(next) ? reveal(next, ctx) : next;
	}
	if (result === 'close') {
		return addFeed(state, { playerId: id, kind: 'close', text: `“${text}” is so close!` });
	}
	const shown = state.config.familyFilter ? censorText(text) : text;
	return addFeed(state, { playerId: id, kind: 'guess', text: shown });
}

function addFeed(state: EmojiState, item: Omit<FeedItem, 'n'>): EmojiState {
	const n = state.feedCounter + 1;
	return { ...state, feedCounter: n, feed: [...state.feed, { ...item, n }].slice(-FEED_LENGTH) };
}

function allGuessed(state: EmojiState): boolean {
	const present = state.players.filter((p) => state.active.includes(p.id));
	return present.length > 0 && present.every((p) => state.guessed.includes(p.id));
}

function phaseDuration(state: EmojiState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'puzzle':
			return state.config.secondsPerPuzzle * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
