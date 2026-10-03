import type { TriviaPack } from '@games/content';
import {
	admitPlayer,
	defineGame,
	isController,
	rankPlayers,
	type Actor,
	type GameContext,
	type GamePlayer,
	type LeaderboardEntry
} from '@games/engine';

export type { LeaderboardEntry };

export const INTRO_MS = 4_000;
export const REVEAL_MS = 9_000;
export const MAX_POINTS = 1_000;
export const STREAK_BONUS = 100;
export const MAX_STREAK_BONUS = 300;

export interface TriviaConfig {
	questionCount: number;
	secondsPerQuestion: number;
}

type Phase = 'intro' | 'question' | 'reveal' | 'final';

interface Question {
	q: string;
	choices: string[];
	answer: number;
	fact?: string;
}

export interface TriviaState {
	phase: Phase;
	packTitle: string;
	players: GamePlayer[];
	questions: Question[];
	index: number;
	config: TriviaConfig;
	phaseEndsAt: number;
	questionStartedAt: number;
	/** This question's answers, by player id. Cleared for each new question. */
	answers: Record<string, { choice: number; at: number }>;
	audienceAnswers: Record<string, number>;
	scores: Record<string, number>;
	streaks: Record<string, number>;
	/** Points each player earned on the current question (set at reveal). */
	lastPoints: Record<string, number>;
	/** Players still in the room, to know when "everyone has answered". */
	active: string[];
}

export type TriviaAction = { type: 'answer'; choice: number } | { type: 'next' };

export interface TriviaView {
	phase: Phase;
	packTitle: string;
	index: number;
	total: number;
	endsAt: number;
	durationMs: number;
	question: { q: string; choices: string[] } | null;
	answeredCount: number;
	playerCount: number;
	/** Present for players in this game and audience; null for the host and late joiners. */
	you: {
		answered: number | null;
		correct: boolean | null;
		points: number;
		score: number;
		rank: number | null;
		streak: number;
	} | null;
	/** Only after the answer window closes. */
	reveal: {
		answer: number;
		fact: string | null;
		counts: number[];
		audienceCorrectPct: number | null;
	} | null;
	leaderboard: LeaderboardEntry[];
}

export const trivia = defineGame<TriviaState, TriviaAction, TriviaConfig, TriviaPack, TriviaView>({
	meta: {
		id: 'trivia',
		name: 'Trivia Rush',
		tagline: 'Fast questions, faster fingers. Points for speed.',
		tags: ['learning', 'fun'],
		modes: ['party', 'online', 'solo'],
		players: { min: 1, max: 12 },
		audience: true,
		durationMin: 8
	},

	defaultConfig: { questionCount: 10, secondsPerQuestion: 20 },

	setup({ config, players, content }, ctx) {
		const picked = ctx.rng.shuffle(content.questions).slice(0, config.questionCount);
		const questions = picked.map((q) => {
			// Shuffle choices so the answer isn't always in the same spot.
			const order = ctx.rng.shuffle(q.choices.map((_, i) => i));
			return {
				q: q.q,
				choices: order.map((i) => q.choices[i]!),
				answer: order.indexOf(q.answer),
				fact: q.fact
			};
		});
		const zero = Object.fromEntries(players.map((p) => [p.id, 0]));
		return {
			phase: 'intro',
			packTitle: content.title,
			players,
			questions,
			index: 0,
			config: { ...config, questionCount: questions.length },
			phaseEndsAt: ctx.now + INTRO_MS,
			questionStartedAt: 0,
			answers: {},
			audienceAnswers: {},
			scores: { ...zero },
			streaks: { ...zero },
			lastPoints: { ...zero },
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (a.type === 'answer' && Number.isInteger(a.choice)) {
			return { type: 'answer', choice: a.choice as number };
		}
		return null;
	},

	reduce(state, action, actor, ctx) {
		switch (action.type) {
			case 'tick':
				return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
			case 'join':
				// Each question is its own race, so a newcomer can play from here on.
				return admitPlayer(state, action.player, ctx);
			case 'roster': {
				const next = { ...state, active: [...ctx.active] };
				return next.phase === 'question' && allAnswered(next) ? reveal(next, ctx) : next;
			}
			case 'next':
				return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
			case 'answer':
				return answer(state, action.choice, actor, ctx);
		}
	},

	view(state, viewer) {
		const question = state.questions[state.index]!;
		const showQuestion = state.phase === 'question' || state.phase === 'reveal';
		const revealed = state.phase === 'reveal' || state.phase === 'final';
		const leaderboard = revealed ? rankings(state) : [];

		let you: TriviaView['you'] = null;
		// Players who joined after the start watch along without a `you`.
		if (viewer.kind === 'player' && state.players.some((p) => p.id === viewer.playerId)) {
			const id = viewer.playerId;
			const mine = state.answers[id];
			const ranked = rankings(state).find((e) => e.id === id);
			you = {
				answered: mine?.choice ?? null,
				correct: state.phase === 'reveal' && mine ? mine.choice === question.answer : null,
				points: state.phase === 'reveal' ? (state.lastPoints[id] ?? 0) : 0,
				score: state.scores[id] ?? 0,
				rank: ranked?.rank ?? null,
				streak: state.streaks[id] ?? 0
			};
		} else if (viewer.kind === 'audience') {
			const mine = state.audienceAnswers[viewer.audienceId];
			you = {
				answered: mine ?? null,
				correct: state.phase === 'reveal' && mine !== undefined ? mine === question.answer : null,
				points: 0,
				score: 0,
				rank: null,
				streak: 0
			};
		}

		let reveal: TriviaView['reveal'] = null;
		if (state.phase === 'reveal') {
			const counts = question.choices.map(() => 0);
			for (const a of Object.values(state.answers)) counts[a.choice]!++;
			const aud = Object.values(state.audienceAnswers);
			reveal = {
				answer: question.answer,
				fact: question.fact ?? null,
				counts,
				audienceCorrectPct: aud.length
					? Math.round((aud.filter((c) => c === question.answer).length / aud.length) * 100)
					: null
			};
		}

		return {
			phase: state.phase,
			packTitle: state.packTitle,
			index: state.index,
			total: state.questions.length,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			question: showQuestion ? { q: question.q, choices: question.choices } : null,
			answeredCount: Object.keys(state.answers).filter((id) => state.active.includes(id)).length,
			playerCount: state.active.length,
			you,
			reveal,
			leaderboard
		};
	},

	nextDeadline(state) {
		return state.phase === 'final' ? null : state.phaseEndsAt;
	},

	shiftTime(state, ms) {
		return {
			...state,
			phaseEndsAt: state.phaseEndsAt + ms,
			questionStartedAt: state.questionStartedAt + ms,
			answers: Object.fromEntries(
				Object.entries(state.answers).map(([id, a]) => [id, { ...a, at: a.at + ms }])
			)
		};
	},

	isOver(state) {
		return state.phase === 'final';
	}
});

// ---------- transitions ----------

function advance(state: TriviaState, ctx: GameContext): TriviaState {
	switch (state.phase) {
		case 'intro':
			return startQuestion(state, 0, ctx);
		case 'question':
			return reveal(state, ctx);
		case 'reveal':
			return state.index + 1 < state.questions.length
				? startQuestion(state, state.index + 1, ctx)
				: { ...state, phase: 'final', phaseEndsAt: ctx.now };
		case 'final':
			return state;
	}
}

function startQuestion(state: TriviaState, index: number, ctx: GameContext): TriviaState {
	return {
		...state,
		phase: 'question',
		index,
		questionStartedAt: ctx.now,
		phaseEndsAt: ctx.now + state.config.secondsPerQuestion * 1000,
		answers: {},
		audienceAnswers: {},
		lastPoints: {}
	};
}

function answer(state: TriviaState, choice: number, actor: Actor, ctx: GameContext): TriviaState {
	if (state.phase !== 'question' || ctx.now >= state.phaseEndsAt) return state;
	const question = state.questions[state.index]!;
	if (choice < 0 || choice >= question.choices.length) return state;

	if (actor.kind === 'audience') {
		if (actor.audienceId in state.audienceAnswers) return state;
		return { ...state, audienceAnswers: { ...state.audienceAnswers, [actor.audienceId]: choice } };
	}
	if (actor.kind !== 'player') return state;
	const id = actor.playerId;
	// Only players who started the game answer; late joiners wait for the next one.
	if (!state.players.some((p) => p.id === id) || id in state.answers) return state;

	const next = { ...state, answers: { ...state.answers, [id]: { choice, at: ctx.now } } };
	return allAnswered(next) ? reveal(next, ctx) : next;
}

function reveal(state: TriviaState, ctx: GameContext): TriviaState {
	const question = state.questions[state.index]!;
	const duration = state.config.secondsPerQuestion * 1000;
	const scores = { ...state.scores };
	const streaks = { ...state.streaks };
	const lastPoints: Record<string, number> = {};

	for (const p of state.players) {
		const a = state.answers[p.id];
		if (a && a.choice === question.answer) {
			lastPoints[p.id] = pointsFor(a.at - state.questionStartedAt, duration, streaks[p.id] ?? 0);
			streaks[p.id] = (streaks[p.id] ?? 0) + 1;
		} else {
			lastPoints[p.id] = 0;
			streaks[p.id] = 0;
		}
		scores[p.id] = (scores[p.id] ?? 0) + lastPoints[p.id]!;
	}

	return {
		...state,
		phase: 'reveal',
		phaseEndsAt: ctx.now + REVEAL_MS,
		scores,
		streaks,
		lastPoints
	};
}

/** Faster answers score more: full points instantly, half at the buzzer. Streaks add a bonus. */
export function pointsFor(elapsedMs: number, durationMs: number, streakBefore: number): number {
	const ratio = Math.min(1, Math.max(0, elapsedMs / durationMs));
	const base = Math.round(MAX_POINTS * (1 - ratio / 2));
	return base + Math.min(MAX_STREAK_BONUS, STREAK_BONUS * streakBefore);
}

function allAnswered(state: TriviaState): boolean {
	const present = state.players.filter((p) => state.active.includes(p.id));
	return present.length > 0 && present.every((p) => p.id in state.answers);
}

function phaseDuration(state: TriviaState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'question':
			return state.config.secondsPerQuestion * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}

function rankings(state: TriviaState): LeaderboardEntry[] {
	return rankPlayers(state.players, state.scores, state.lastPoints);
}
