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
 * Quick Wit. Each prompt goes to two players; everyone else votes for the
 * funnier answer. Every player answers two prompts per round.
 */

export const INTRO_MS = 4_000;
export const RESULT_MS = 7_000;
export const MAX_ANSWER_LENGTH = 80;
export const VOTE_POINTS = 100;
export const AUDIENCE_VOTE_POINTS = 50;
export const SWEEP_BONUS = 200;
export const FORFEIT_POINTS = 100;

export interface WitConfig {
	rounds: number;
	writeSeconds: number;
	voteSeconds: number;
	familyFilter: boolean;
}

type Phase = 'intro' | 'write' | 'vote' | 'result' | 'final';
type Side = 'a' | 'b';

interface Matchup {
	prompt: string;
	a: string;
	b: string;
}

export interface WitState {
	phase: Phase;
	players: GamePlayer[];
	/** Unused prompts, in play order. */
	deck: string[];
	round: number;
	config: WitConfig;
	phaseEndsAt: number;
	matchups: Matchup[];
	/** answers[matchup index][player id] */
	answers: Record<number, Record<string, string>>;
	index: number;
	votes: Record<string, Side>;
	audienceVotes: Record<string, Side>;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type WitAction =
	{ type: 'answer'; match: number; text: string } | { type: 'vote'; side: Side } | { type: 'next' };

export interface WitView {
	phase: Phase;
	round: number;
	rounds: number;
	endsAt: number;
	durationMs: number;
	doneCount: number;
	expectedCount: number;
	/** Voting and results: the current prompt and its two answers. */
	current: {
		number: number;
		total: number;
		prompt: string;
		a: string | null;
		b: string | null;
	} | null;
	you: {
		/** Write phase: your prompts and whether you've answered them. */
		prompts: { match: number; prompt: string; answered: boolean }[];
		/** You wrote one of the two current answers. */
		inMatchup: boolean;
		vote: Side | null;
		points: number;
		score: number;
		rank: number | null;
	} | null;
	result: {
		a: { player: GamePlayer; votes: number; points: number };
		b: { player: GamePlayer; votes: number; points: number };
		sweep: Side | null;
	} | null;
	leaderboard: LeaderboardEntry[];
}

export const wit = defineGame<WitState, WitAction, WitConfig, PromptPack, WitView>({
	meta: {
		id: 'wit',
		name: 'Quick Wit',
		tagline: 'Write the funniest answer. The room votes.',
		tags: ['creative', 'fun'],
		modes: ['party', 'online'],
		players: { min: 3, max: 10 },
		audience: true,
		durationMin: 12
	},

	defaultConfig: { rounds: 2, writeSeconds: 90, voteSeconds: 20, familyFilter: true },

	setup({ config, players, content }, ctx) {
		return {
			phase: 'intro',
			players,
			deck: ctx.rng.shuffle(content.items),
			round: 0,
			config,
			phaseEndsAt: ctx.now + INTRO_MS,
			matchups: [],
			answers: {},
			index: 0,
			votes: {},
			audienceVotes: {},
			scores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastPoints: {},
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (a.type === 'answer' && Number.isInteger(a.match) && typeof a.text === 'string') {
			return { type: 'answer', match: a.match as number, text: a.text };
		}
		if (a.type === 'vote' && (a.side === 'a' || a.side === 'b'))
			return { type: 'vote', side: a.side };
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
				return answer(state, action.match, action.text, actor, ctx);
			case 'vote':
				return vote(state, action.side, actor, ctx);
		}
	},

	view(state, viewer) {
		const m = state.matchups[state.index];
		const showCurrent = (state.phase === 'vote' || state.phase === 'result') && m;
		const ranked = rankPlayers(state.players, state.scores, state.lastPoints);
		const playing = viewer.kind === 'player' && state.players.some((p) => p.id === viewer.playerId);

		let you: WitView['you'] = null;
		if (playing) {
			const id = viewer.playerId;
			you = {
				prompts:
					state.phase === 'write'
						? state.matchups.flatMap((mu, i) =>
								mu.a === id || mu.b === id
									? [{ match: i, prompt: mu.prompt, answered: id in (state.answers[i] ?? {}) }]
									: []
							)
						: [],
				inMatchup: !!showCurrent && (m.a === id || m.b === id),
				vote: state.votes[id] ?? null,
				points: state.phase === 'result' ? (state.lastPoints[id] ?? 0) : 0,
				score: state.scores[id] ?? 0,
				rank: ranked.find((e) => e.id === id)?.rank ?? null
			};
		} else if (viewer.kind === 'audience') {
			you = {
				prompts: [],
				inMatchup: false,
				vote: state.audienceVotes[viewer.audienceId] ?? null,
				points: 0,
				score: 0,
				rank: null
			};
		}

		let result: WitView['result'] = null;
		if (state.phase === 'result' && m) {
			const tally = tallyVotes(state);
			const player = (id: string) => state.players.find((p) => p.id === id)!;
			result = {
				a: { player: player(m.a), votes: tally.a, points: state.lastPoints[m.a] ?? 0 },
				b: { player: player(m.b), votes: tally.b, points: state.lastPoints[m.b] ?? 0 },
				sweep: sweepOf(state)
			};
		}

		const answers = m ? (state.answers[state.index] ?? {}) : {};
		return {
			phase: state.phase,
			round: state.round,
			rounds: state.config.rounds,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			doneCount:
				state.phase === 'write'
					? state.matchups.reduce((n, _, i) => n + Object.keys(state.answers[i] ?? {}).length, 0)
					: Object.keys(state.votes).filter((id) => state.active.includes(id)).length,
			expectedCount: state.phase === 'write' ? state.matchups.length * 2 : voters(state).length,
			current: showCurrent
				? {
						number: state.index + 1,
						total: state.matchups.length,
						prompt: m.prompt,
						a: answers[m.a] ?? null,
						b: answers[m.b] ?? null
					}
				: null,
			you,
			result,
			leaderboard: state.phase === 'result' || state.phase === 'final' ? ranked : []
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

function advance(state: WitState, ctx: GameContext): WitState {
	switch (state.phase) {
		case 'intro':
			return startRound(state, 0, ctx);
		case 'write':
			return startVote(state, 0, ctx);
		case 'vote':
			return showResult(state, ctx);
		case 'result':
			return startVote(state, state.index + 1, ctx);
		case 'final':
			return state;
	}
}

/** Pair players around a circle: each prompt gets two players, each player two prompts. */
function startRound(state: WitState, round: number, ctx: GameContext): WitState {
	const order = ctx.rng.shuffle(
		state.players.filter((p) => state.active.includes(p.id)).map((p) => p.id)
	);
	if (order.length < 2 || state.deck.length < order.length) return finish(state, ctx);
	const matchups = order.map((id, i) => ({
		prompt: state.deck[i]!,
		a: id,
		b: order[(i + 1) % order.length]!
	}));
	return {
		...state,
		phase: 'write',
		round,
		deck: state.deck.slice(order.length),
		matchups,
		answers: {},
		index: 0,
		votes: {},
		audienceVotes: {},
		lastPoints: {},
		phaseEndsAt: ctx.now + state.config.writeSeconds * 1000
	};
}

/** Go to matchup `index`, skipping ones nobody answered; forfeits go straight to the result. */
function startVote(state: WitState, index: number, ctx: GameContext): WitState {
	for (let i = index; i < state.matchups.length; i++) {
		const m = state.matchups[i]!;
		const got = state.answers[i] ?? {};
		const hasA = m.a in got;
		const hasB = m.b in got;
		if (!hasA && !hasB) continue;
		const next: WitState = {
			...state,
			phase: 'vote',
			index: i,
			votes: {},
			audienceVotes: {},
			lastPoints: {},
			phaseEndsAt: ctx.now + state.config.voteSeconds * 1000
		};
		return hasA && hasB ? next : showResult(next, ctx);
	}
	return state.round + 1 < state.config.rounds
		? startRound(state, state.round + 1, ctx)
		: finish(state, ctx);
}

function showResult(state: WitState, ctx: GameContext): WitState {
	const m = state.matchups[state.index]!;
	const got = state.answers[state.index] ?? {};
	const points: Record<string, number> = { [m.a]: 0, [m.b]: 0 };

	if (!(m.a in got)) points[m.b] = FORFEIT_POINTS;
	else if (!(m.b in got)) points[m.a] = FORFEIT_POINTS;
	else {
		for (const side of Object.values(state.votes)) points[m[side]]! += VOTE_POINTS;
		for (const side of Object.values(state.audienceVotes)) points[m[side]]! += AUDIENCE_VOTE_POINTS;
		const sweep = sweepOf(state);
		if (sweep) points[m[sweep]]! += SWEEP_BONUS;
	}

	return {
		...state,
		phase: 'result',
		scores: addPoints(state.scores, points),
		lastPoints: points,
		phaseEndsAt: ctx.now + RESULT_MS
	};
}

function finish(state: WitState, ctx: GameContext): WitState {
	return { ...state, phase: 'final', phaseEndsAt: ctx.now };
}

function answer(
	state: WitState,
	match: number,
	raw: string,
	actor: Actor,
	ctx: GameContext
): WitState {
	if (state.phase !== 'write' || ctx.now >= state.phaseEndsAt || actor.kind !== 'player')
		return state;
	const m = state.matchups[match];
	const id = actor.playerId;
	if (!m || (m.a !== id && m.b !== id)) return state;
	const got = state.answers[match] ?? {};
	if (id in got) return state;
	let text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER_LENGTH);
	if (!text) return state;
	if (state.config.familyFilter) text = censorText(text);
	return maybeFinishEarly(
		{ ...state, answers: { ...state.answers, [match]: { ...got, [id]: text } } },
		ctx
	);
}

function vote(state: WitState, side: Side, actor: Actor, ctx: GameContext): WitState {
	if (state.phase !== 'vote' || ctx.now >= state.phaseEndsAt) return state;
	if (actor.kind === 'audience') {
		if (actor.audienceId in state.audienceVotes) return state;
		return { ...state, audienceVotes: { ...state.audienceVotes, [actor.audienceId]: side } };
	}
	if (actor.kind !== 'player') return state;
	const id = actor.playerId;
	if (!voters(state).some((p) => p.id === id) || id in state.votes) return state;
	return maybeFinishEarly({ ...state, votes: { ...state.votes, [id]: side } }, ctx);
}

function maybeFinishEarly(state: WitState, ctx: GameContext): WitState {
	if (state.phase === 'write') {
		const present = new Set(state.active);
		const done = state.matchups.every((m, i) =>
			[m.a, m.b].every((id) => !present.has(id) || id in (state.answers[i] ?? {}))
		);
		if (done) return startVote(state, 0, ctx);
	}
	if (state.phase === 'vote') {
		const v = voters(state);
		if (v.length === 0 || v.every((p) => p.id in state.votes)) return showResult(state, ctx);
	}
	return state;
}

/** Present players who didn't write either current answer. */
function voters(state: WitState) {
	const m = state.matchups[state.index];
	return state.players.filter(
		(p) => state.active.includes(p.id) && (!m || (p.id !== m.a && p.id !== m.b))
	);
}

function tallyVotes(state: WitState) {
	const all = [...Object.values(state.votes), ...Object.values(state.audienceVotes)];
	return { a: all.filter((s) => s === 'a').length, b: all.filter((s) => s === 'b').length };
}

/** Every player vote went to one side (at least one vote). */
function sweepOf(state: WitState): Side | null {
	const sides = Object.values(state.votes);
	if (sides.length === 0) return null;
	if (sides.every((s) => s === 'a')) return 'a';
	if (sides.every((s) => s === 'b')) return 'b';
	return null;
}

function phaseDuration(state: WitState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'write':
			return state.config.writeSeconds * 1000;
		case 'vote':
			return state.config.voteSeconds * 1000;
		case 'result':
			return RESULT_MS;
		case 'final':
			return 0;
	}
}
