import type { PromptPack } from '@games/content';
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
 * Word Race. Everyone gets the same secret five-letter word and six tries to
 * find it on their own screen. Tiles show which letters are right. The big
 * screen shows everyone's tiles but never their letters, so nobody can copy.
 */

export const INTRO_MS = 4_000;
export const REVEAL_MS = 8_000;
export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
/** Points for solving, by the number of guesses it took. */
export const SOLVE_POINTS = [0, 1000, 800, 600, 450, 300, 200] as const;
/** Up to this much more for solving early in the round. */
export const SPEED_BONUS = 200;

export interface WordRaceConfig {
	rounds: number;
	secondsPerWord: number;
	familyFilter: boolean;
}

type Phase = 'intro' | 'guess' | 'reveal' | 'final';

/** hit: right letter, right spot. near: in the word, elsewhere. miss: not in the word. */
export type Mark = 'hit' | 'near' | 'miss';

export interface WordRaceState {
	phase: Phase;
	players: GamePlayer[];
	words: string[];
	round: number;
	config: WordRaceConfig;
	phaseEndsAt: number;
	roundStartedAt: number;
	/** This round's guesses, by player id. */
	guesses: Record<string, string[]>;
	solved: string[];
	/** The latest guess each player sent that isn't a word; `n` changes each time. */
	rejected: Record<string, { word: string; n: number }>;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type WordRaceAction = { type: 'guess'; word: string } | { type: 'next' };

export interface Guess {
	word: string;
	marks: Mark[];
}

export interface WordRaceView {
	phase: Phase;
	round: number;
	rounds: number;
	endsAt: number;
	durationMs: number;
	/** Only once the round is over. */
	answer: string | null;
	/** Everyone's tiles, without letters. */
	boards: {
		player: GamePlayer;
		marks: Mark[][];
		solved: boolean;
		/** Used every guess without solving. */
		out: boolean;
		points: number;
	}[];
	doneCount: number;
	playerCount: number;
	/** Null for the host, audience and late joiners. */
	you: {
		guesses: Guess[];
		solved: boolean;
		out: boolean;
		/** Best mark per letter so far, for the keyboard. */
		keys: Record<string, Mark>;
		rejected: { word: string; n: number } | null;
		points: number;
		score: number;
		rank: number | null;
	} | null;
	leaderboard: LeaderboardEntry[];
}

/** Five letters, a to z, lowercase. */
const GUESS = new RegExp(`^[a-z]{${WORD_LENGTH}}$`);

/**
 * `isWord` decides which guesses count. The dictionary is large, so it's
 * passed in where it's loaded (server, solo page) instead of imported here.
 * `wordRace` itself accepts any five letters; use it for metadata and types.
 */
export function createWordRace(isWord: (word: string) => boolean = () => true) {
	return defineGame<WordRaceState, WordRaceAction, WordRaceConfig, PromptPack, WordRaceView>({
		meta: {
			id: 'wordrace',
			name: 'Word Race',
			tagline: 'One secret word, six tries each. Crack it first.',
			tags: ['learning', 'fun'],
			modes: ['party', 'online', 'solo'],
			players: { min: 1, max: 12 },
			audience: false,
			durationMin: 8
		},

		defaultConfig: { rounds: 3, secondsPerWord: 120, familyFilter: true },

		setup({ config, players, content }, ctx) {
			const words = ctx.rng.shuffle(content.items).slice(0, config.rounds);
			return {
				phase: 'intro',
				players,
				words,
				round: 0,
				config: { ...config, rounds: words.length },
				phaseEndsAt: ctx.now + INTRO_MS,
				roundStartedAt: 0,
				guesses: {},
				solved: [],
				rejected: {},
				scores: Object.fromEntries(players.map((p) => [p.id, 0])),
				lastPoints: {},
				active: players.map((p) => p.id)
			};
		},

		parseAction(raw) {
			if (typeof raw !== 'object' || raw === null) return null;
			const a = raw as Record<string, unknown>;
			if (a.type === 'next') return { type: 'next' };
			if (a.type === 'guess' && typeof a.word === 'string') {
				const word = a.word.trim().toLowerCase();
				return GUESS.test(word) ? { type: 'guess', word } : null;
			}
			return null;
		},

		reduce(state, action, actor, ctx) {
			switch (action.type) {
				case 'tick':
					return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
				case 'join':
					// Everyone races on their own board, so a newcomer can play from here on.
					return admitPlayer(state, action.player, ctx);
				case 'roster': {
					const next = { ...state, active: [...ctx.active] };
					return next.phase === 'guess' && allDone(next) ? reveal(next, ctx) : next;
				}
				case 'next':
					return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
				case 'guess':
					return guess(state, action.word, actor, ctx, isWord);
			}
		},

		view(state, viewer) {
			const answer = state.words[state.round] ?? '';
			const over = state.phase === 'reveal' || state.phase === 'final';
			const ranked = rankPlayers(state.players, state.scores, state.lastPoints);
			const viewerId = viewer.kind === 'player' ? viewer.playerId : null;
			const playing = viewerId !== null && state.players.some((p) => p.id === viewerId);
			const showBoards = state.phase === 'guess' || state.phase === 'reveal';

			let you: WordRaceView['you'] = null;
			if (playing) {
				const guesses = (state.guesses[viewerId] ?? []).map((word) => ({
					word,
					marks: markGuess(word, answer)
				}));
				you = {
					guesses,
					solved: state.solved.includes(viewerId),
					out: isOut(state, viewerId),
					keys: keyMarks(guesses),
					rejected: state.rejected[viewerId] ?? null,
					points: state.lastPoints[viewerId] ?? 0,
					score: state.scores[viewerId] ?? 0,
					rank: ranked.find((e) => e.id === viewerId)?.rank ?? null
				};
			}

			return {
				phase: state.phase,
				round: state.round,
				rounds: state.words.length,
				endsAt: state.phaseEndsAt,
				durationMs: phaseDuration(state),
				answer: over && state.phase !== 'final' ? answer : null,
				boards: showBoards
					? state.players
							.filter((p) => state.active.includes(p.id) || p.id in state.guesses)
							.map((player) => ({
								player,
								marks: (state.guesses[player.id] ?? []).map((w) => markGuess(w, answer)),
								solved: state.solved.includes(player.id),
								out: isOut(state, player.id),
								points: state.lastPoints[player.id] ?? 0
							}))
					: [],
				doneCount: state.players.filter((p) => state.active.includes(p.id) && isDone(state, p.id))
					.length,
				playerCount: state.active.length,
				you,
				leaderboard: over ? ranked : []
			};
		},

		nextDeadline(state) {
			return state.phase === 'final' ? null : state.phaseEndsAt;
		},

		shiftTime(state, ms) {
			return {
				...state,
				phaseEndsAt: state.phaseEndsAt + ms,
				roundStartedAt: state.roundStartedAt + ms
			};
		},

		isOver(state) {
			return state.phase === 'final';
		}
	});
}

export const wordRace = createWordRace();

/** Tiles for a guess, Wordle-style: a repeated letter is only "near" as often as it's left over. */
export function markGuess(guess: string, answer: string): Mark[] {
	const marks: Mark[] = Array(guess.length).fill('miss');
	const left: Record<string, number> = {};
	for (let i = 0; i < answer.length; i++) {
		if (guess[i] === answer[i]) marks[i] = 'hit';
		else left[answer[i]!] = (left[answer[i]!] ?? 0) + 1;
	}
	for (let i = 0; i < guess.length; i++) {
		const ch = guess[i]!;
		if (marks[i] === 'hit' || !left[ch]) continue;
		marks[i] = 'near';
		left[ch]--;
	}
	return marks;
}

const RANK: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };

function keyMarks(guesses: Guess[]): Record<string, Mark> {
	const keys: Record<string, Mark> = {};
	for (const g of guesses) {
		[...g.word].forEach((ch, i) => {
			const mark = g.marks[i]!;
			if (!keys[ch] || RANK[mark] > RANK[keys[ch]]) keys[ch] = mark;
		});
	}
	return keys;
}

// ---------- transitions ----------

function advance(state: WordRaceState, ctx: GameContext): WordRaceState {
	switch (state.phase) {
		case 'intro':
			return startRound(state, 0, ctx);
		case 'guess':
			return reveal(state, ctx);
		case 'reveal':
			return state.round + 1 < state.words.length
				? startRound(state, state.round + 1, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now };
		case 'final':
			return state;
	}
}

function startRound(state: WordRaceState, round: number, ctx: GameContext): WordRaceState {
	return {
		...state,
		phase: 'guess',
		round,
		roundStartedAt: ctx.now,
		phaseEndsAt: ctx.now + state.config.secondsPerWord * 1000,
		guesses: {},
		solved: [],
		rejected: {},
		lastPoints: {}
	};
}

function reveal(state: WordRaceState, ctx: GameContext): WordRaceState {
	return { ...state, phase: 'reveal', phaseEndsAt: ctx.now + REVEAL_MS };
}

function guess(
	state: WordRaceState,
	word: string,
	actor: Actor,
	ctx: GameContext,
	isWord: (word: string) => boolean
): WordRaceState {
	if (state.phase !== 'guess' || ctx.now >= state.phaseEndsAt || actor.kind !== 'player') {
		return state;
	}
	const id = actor.playerId;
	if (!state.players.some((p) => p.id === id) || isDone(state, id)) return state;

	const answer = state.words[state.round]!;
	if (word !== answer && !isWord(word)) {
		const n = (state.rejected[id]?.n ?? 0) + 1;
		return { ...state, rejected: { ...state.rejected, [id]: { word, n } } };
	}

	const mine = [...(state.guesses[id] ?? []), word];
	let next: WordRaceState = { ...state, guesses: { ...state.guesses, [id]: mine } };
	if (word === answer) {
		const duration = state.config.secondsPerWord * 1000;
		const left = Math.max(0, state.phaseEndsAt - ctx.now) / duration;
		const pts = SOLVE_POINTS[mine.length]! + Math.round((SPEED_BONUS * left) / 10) * 10;
		next = {
			...next,
			solved: [...state.solved, id],
			scores: addPoints(state.scores, { [id]: pts }),
			lastPoints: { ...state.lastPoints, [id]: pts }
		};
	}
	return allDone(next) ? reveal(next, ctx) : next;
}

function isOut(state: WordRaceState, id: string): boolean {
	return !state.solved.includes(id) && (state.guesses[id]?.length ?? 0) >= MAX_GUESSES;
}

function isDone(state: WordRaceState, id: string): boolean {
	return state.solved.includes(id) || isOut(state, id);
}

function allDone(state: WordRaceState): boolean {
	const present = state.players.filter((p) => state.active.includes(p.id));
	return present.length > 0 && present.every((p) => isDone(state, p.id));
}

function phaseDuration(state: WordRaceState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'guess':
			return state.config.secondsPerWord * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
