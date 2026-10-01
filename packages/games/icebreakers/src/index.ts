import { censorText, type PromptPack } from '@games/content';
import {
	addPoints,
	defineGame,
	isController,
	rankPlayers,
	type Actor,
	type GameContext,
	type GamePlayer,
	type LeaderboardEntry
} from '@games/engine';

/**
 * Who Said It? Everyone answers a personal prompt, then the room guesses who
 * wrote each answer. Correct guesses score; authors score for every player
 * they fool.
 */

export const INTRO_MS = 4_000;
export const REVEAL_MS = 7_000;
export const MAX_ANSWER_LENGTH = 140;
export const CORRECT_POINTS = 100;
export const FOOLED_POINTS = 50;

export interface IcebreakersConfig {
	rounds: number;
	writeSeconds: number;
	guessSeconds: number;
	/** Set by the room: censor answers. */
	familyFilter: boolean;
}

type Phase = 'intro' | 'write' | 'guess' | 'reveal' | 'final';

export interface IcebreakersState {
	phase: Phase;
	players: GamePlayer[];
	prompts: string[];
	round: number;
	config: IcebreakersConfig;
	phaseEndsAt: number;
	/** This round's answers by author id. */
	answers: Record<string, string>;
	/** Authors in the order their answers are guessed. */
	order: string[];
	index: number;
	/** Guesses for the current answer: guesser id → suspected author id. */
	guesses: Record<string, string>;
	audienceGuesses: Record<string, string>;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type IcebreakersAction =
	{ type: 'answer'; text: string } | { type: 'guess'; playerId: string } | { type: 'next' };

export interface IcebreakersView {
	phase: Phase;
	round: number;
	rounds: number;
	prompt: string | null;
	endsAt: number;
	durationMs: number;
	players: GamePlayer[];
	/** Write phase: how many have answered. Guess phase: how many have guessed. */
	doneCount: number;
	expectedCount: number;
	/** The answer being guessed (guess and reveal phases). */
	current: { text: string; number: number; total: number } | null;
	you: {
		answered: boolean;
		myAnswer: string | null;
		/** Your guess for the current answer. */
		guess: string | null;
		/** The current answer is yours: sit tight while others guess. */
		isAuthor: boolean;
		points: number;
		score: number;
		rank: number | null;
	} | null;
	reveal: {
		author: GamePlayer;
		/** How many guessed each player. */
		tally: { playerId: string; count: number }[];
		correct: string[];
		fooled: number;
	} | null;
	leaderboard: LeaderboardEntry[];
}

export const icebreakers = defineGame<
	IcebreakersState,
	IcebreakersAction,
	IcebreakersConfig,
	PromptPack,
	IcebreakersView
>({
	meta: {
		id: 'icebreakers',
		name: 'Who Said It?',
		tagline: 'Answer about yourself, then guess who wrote what.',
		tags: ['bonding'],
		modes: ['party', 'online'],
		players: { min: 3, max: 12 },
		audience: true,
		durationMin: 10
	},

	defaultConfig: { rounds: 2, writeSeconds: 60, guessSeconds: 20, familyFilter: true },

	setup({ config, players, content }, ctx) {
		const zero = Object.fromEntries(players.map((p) => [p.id, 0]));
		return {
			phase: 'intro',
			players,
			prompts: ctx.rng.shuffle(content.items).slice(0, config.rounds),
			round: 0,
			config,
			phaseEndsAt: ctx.now + INTRO_MS,
			answers: {},
			order: [],
			index: 0,
			guesses: {},
			audienceGuesses: {},
			scores: zero,
			lastPoints: {},
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (a.type === 'answer' && typeof a.text === 'string') return { type: 'answer', text: a.text };
		if (a.type === 'guess' && typeof a.playerId === 'string') {
			return { type: 'guess', playerId: a.playerId };
		}
		return null;
	},

	reduce(state, action, actor, ctx) {
		switch (action.type) {
			case 'tick':
				return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
			case 'roster':
				return maybeFinishEarly({ ...state, active: [...ctx.active] }, ctx);
			case 'next':
				return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
			case 'answer':
				return answer(state, action.text, actor, ctx);
			case 'guess':
				return guess(state, action.playerId, actor, ctx);
		}
	},

	view(state, viewer) {
		const authorId = state.order[state.index];
		const showCurrent = (state.phase === 'guess' || state.phase === 'reveal') && authorId;
		const playing = viewer.kind === 'player' && state.players.some((p) => p.id === viewer.playerId);
		const ranked = rankPlayers(state.players, state.scores, state.lastPoints);

		let you: IcebreakersView['you'] = null;
		if (playing) {
			const id = viewer.playerId;
			you = {
				answered: id in state.answers,
				myAnswer: state.answers[id] ?? null,
				guess: state.guesses[id] ?? null,
				isAuthor: !!showCurrent && authorId === id,
				points: state.phase === 'reveal' ? (state.lastPoints[id] ?? 0) : 0,
				score: state.scores[id] ?? 0,
				rank: ranked.find((e) => e.id === id)?.rank ?? null
			};
		} else if (viewer.kind === 'audience') {
			you = {
				answered: false,
				myAnswer: null,
				guess: state.audienceGuesses[viewer.audienceId] ?? null,
				isAuthor: false,
				points: 0,
				score: 0,
				rank: null
			};
		}

		let reveal: IcebreakersView['reveal'] = null;
		if (state.phase === 'reveal' && authorId) {
			const counts = new Map<string, number>();
			for (const g of Object.values(state.guesses)) counts.set(g, (counts.get(g) ?? 0) + 1);
			const correct = Object.entries(state.guesses)
				.filter(([, g]) => g === authorId)
				.map(([id]) => id);
			reveal = {
				author: state.players.find((p) => p.id === authorId)!,
				tally: [...counts].map(([playerId, count]) => ({ playerId, count })),
				correct,
				fooled: Object.values(state.guesses).filter((g) => g !== authorId).length
			};
		}

		return {
			phase: state.phase,
			round: state.round,
			rounds: state.prompts.length,
			prompt:
				state.phase === 'intro' || state.phase === 'final' ? null : state.prompts[state.round]!,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			players: state.players,
			doneCount:
				state.phase === 'write'
					? Object.keys(state.answers).filter((id) => state.active.includes(id)).length
					: Object.keys(state.guesses).filter((id) => state.active.includes(id)).length,
			expectedCount:
				state.phase === 'write' ? presentPlayers(state).length : guessers(state).length,
			current: showCurrent
				? { text: state.answers[authorId]!, number: state.index + 1, total: state.order.length }
				: null,
			you,
			reveal,
			leaderboard: state.phase === 'reveal' || state.phase === 'final' ? ranked : []
		};
	},

	nextDeadline(state) {
		return state.phase === 'final' ? null : state.phaseEndsAt;
	},

	isOver(state) {
		return state.phase === 'final';
	}
});

// ---------- transitions ----------

function advance(state: IcebreakersState, ctx: GameContext): IcebreakersState {
	switch (state.phase) {
		case 'intro':
			return startWrite(state, 0, ctx);
		case 'write':
			return startGuessing(state, ctx);
		case 'guess':
			return reveal(state, ctx);
		case 'reveal':
			if (state.index + 1 < state.order.length) return startGuess(state, state.index + 1, ctx);
			return nextRound(state, ctx);
		case 'final':
			return state;
	}
}

function startWrite(state: IcebreakersState, round: number, ctx: GameContext): IcebreakersState {
	return {
		...state,
		phase: 'write',
		round,
		answers: {},
		order: [],
		index: 0,
		guesses: {},
		audienceGuesses: {},
		lastPoints: {},
		phaseEndsAt: ctx.now + state.config.writeSeconds * 1000
	};
}

function startGuessing(state: IcebreakersState, ctx: GameContext): IcebreakersState {
	const order = ctx.rng.shuffle(Object.keys(state.answers));
	// Nothing to guess (nobody answered): move on.
	if (order.length === 0) return nextRound(state, ctx);
	return startGuess({ ...state, order }, 0, ctx);
}

function startGuess(state: IcebreakersState, index: number, ctx: GameContext): IcebreakersState {
	return {
		...state,
		phase: 'guess',
		index,
		guesses: {},
		audienceGuesses: {},
		lastPoints: {},
		phaseEndsAt: ctx.now + state.config.guessSeconds * 1000
	};
}

function nextRound(state: IcebreakersState, ctx: GameContext): IcebreakersState {
	if (state.round + 1 < state.prompts.length) return startWrite(state, state.round + 1, ctx);
	return { ...state, phase: 'final', phaseEndsAt: ctx.now };
}

function reveal(state: IcebreakersState, ctx: GameContext): IcebreakersState {
	const authorId = state.order[state.index]!;
	const points: Record<string, number> = {};
	for (const [guesser, suspect] of Object.entries(state.guesses)) {
		if (suspect === authorId) points[guesser] = (points[guesser] ?? 0) + CORRECT_POINTS;
		else points[authorId] = (points[authorId] ?? 0) + FOOLED_POINTS;
	}
	return {
		...state,
		phase: 'reveal',
		scores: addPoints(state.scores, points),
		lastPoints: points,
		phaseEndsAt: ctx.now + REVEAL_MS
	};
}

function answer(state: IcebreakersState, raw: string, actor: Actor, ctx: GameContext) {
	if (state.phase !== 'write' || ctx.now >= state.phaseEndsAt || actor.kind !== 'player')
		return state;
	const id = actor.playerId;
	if (!state.players.some((p) => p.id === id) || id in state.answers) return state;
	let text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER_LENGTH);
	if (!text) return state;
	if (state.config.familyFilter) text = censorText(text);
	return maybeFinishEarly({ ...state, answers: { ...state.answers, [id]: text } }, ctx);
}

function guess(state: IcebreakersState, suspect: string, actor: Actor, ctx: GameContext) {
	if (state.phase !== 'guess' || ctx.now >= state.phaseEndsAt) return state;
	if (!state.players.some((p) => p.id === suspect)) return state;
	if (actor.kind === 'audience') {
		if (actor.audienceId in state.audienceGuesses) return state;
		return { ...state, audienceGuesses: { ...state.audienceGuesses, [actor.audienceId]: suspect } };
	}
	if (actor.kind !== 'player') return state;
	const id = actor.playerId;
	const authorId = state.order[state.index];
	// You can't guess your own answer, or guess yourself.
	if (!state.players.some((p) => p.id === id) || id === authorId || suspect === id) return state;
	if (id in state.guesses) return state;
	return maybeFinishEarly({ ...state, guesses: { ...state.guesses, [id]: suspect } }, ctx);
}

/** Move on as soon as everyone still here has done their part. */
function maybeFinishEarly(state: IcebreakersState, ctx: GameContext): IcebreakersState {
	if (state.phase === 'write') {
		const present = presentPlayers(state);
		if (present.length > 0 && present.every((p) => p.id in state.answers)) {
			return startGuessing(state, ctx);
		}
	}
	if (state.phase === 'guess') {
		const g = guessers(state);
		if (g.length > 0 && g.every((p) => p.id in state.guesses)) return reveal(state, ctx);
	}
	return state;
}

function presentPlayers(state: IcebreakersState) {
	return state.players.filter((p) => state.active.includes(p.id));
}

/** Present players who can guess the current answer (everyone but its author). */
function guessers(state: IcebreakersState) {
	const authorId = state.order[state.index];
	return presentPlayers(state).filter((p) => p.id !== authorId);
}

function phaseDuration(state: IcebreakersState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'write':
			return state.config.writeSeconds * 1000;
		case 'guess':
			return state.config.guessSeconds * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
