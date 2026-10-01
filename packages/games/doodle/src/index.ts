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
 * Doodle Dash. Players take turns drawing a word on their own screen while
 * everyone else races to guess it. Strokes travel over the game's stream
 * channel so they don't resend the whole view on every pen movement.
 */

export const INTRO_MS = 4_000;
export const CHOOSE_MS = 12_000;
export const REVEAL_MS = 6_000;
export const WORD_CHOICES = 3;
export const MAX_GUESS_LENGTH = 40;
export const FEED_LENGTH = 30;
/** Guessers earn more the faster they get it. */
export const GUESS_POINTS = { min: 50, max: 300 };
/** The drawer earns this for every player who guesses the word. */
export const DRAWER_POINTS = 50;
/** Letter hints appear at these fractions of the drawing time. */
export const HINT_AT = [0.5, 0.75];

/** Stroke colors and widths are picked from fixed palettes (indexes on the wire). */
export const COLORS = [
	'#211d30',
	'#ffffff',
	'#e6457a',
	'#f2c94c',
	'#3fb8a8',
	'#7b5cd6',
	'#4a90e2',
	'#8b5a2b'
];
export const WIDTHS = [3, 6, 12, 24];
/** Points are normalized to 0..1 on a 4:3 canvas. Cap per turn to keep payloads sane. */
export const MAX_POINTS_PER_TURN = 40_000;
const MAX_POINTS_PER_EVENT = 400;

export interface DoodleConfig {
	rounds: number;
	drawSeconds: number;
	familyFilter: boolean;
}

type Phase = 'intro' | 'choose' | 'draw' | 'reveal' | 'final';

export interface Stroke {
	id: string;
	/** Index into COLORS. */
	c: number;
	/** Index into WIDTHS. */
	w: number;
	/** Flat [x0, y0, x1, y1, ...], each 0..1. */
	p: number[];
}

export type StreamEvent =
	{ t: 'stroke'; id: string; c: number; w: number; p: number[] } | { t: 'undo' } | { t: 'clear' };

interface FeedItem {
	n: number;
	playerId: string;
	kind: 'guess' | 'correct' | 'close';
	text: string;
}

export interface DoodleState {
	phase: Phase;
	players: GamePlayer[];
	/** Drawer for each turn, in order. */
	turns: string[];
	turn: number;
	deck: string[];
	choices: string[];
	word: string | null;
	config: DoodleConfig;
	phaseEndsAt: number;
	drawStartedAt: number;
	hintTimes: number[];
	/** Letter positions revealed as hints. */
	revealed: number[];
	/** Correct guessers this turn, in order. */
	guessed: string[];
	feed: FeedItem[];
	feedCounter: number;
	strokes: Stroke[];
	pointCount: number;
	scores: Record<string, number>;
	lastPoints: Record<string, number>;
	active: string[];
}

export type DoodleAction =
	{ type: 'choose'; index: number } | { type: 'guess'; text: string } | { type: 'next' };

export interface DoodleView {
	phase: Phase;
	/** Changes every turn; clients clear the canvas when it does. */
	turn: number;
	turns: number;
	endsAt: number;
	durationMs: number;
	drawer: GamePlayer | null;
	/** The word for the drawer (and everyone at the reveal); masked for guessers. */
	word: string | null;
	/** e.g. ["_", "a", "_", " ", "_"] — spaces are shown, hints fill letters in. */
	mask: string[];
	/** Choose phase, drawer only. */
	choices: string[] | null;
	guessedCount: number;
	guesserCount: number;
	feed: { n: number; player: GamePlayer | null; kind: FeedItem['kind']; text: string }[];
	you: {
		isDrawer: boolean;
		guessed: boolean;
		points: number;
		score: number;
		rank: number | null;
	} | null;
	leaderboard: LeaderboardEntry[];
}

export const doodle = defineGame<DoodleState, DoodleAction, DoodleConfig, PromptPack, DoodleView>({
	meta: {
		id: 'doodle',
		name: 'Doodle Dash',
		tagline: 'Draw it on your phone. Everyone guesses.',
		tags: ['creative', 'fun'],
		modes: ['party', 'online'],
		players: { min: 3, max: 10 },
		audience: true,
		durationMin: 12
	},

	defaultConfig: { rounds: 1, drawSeconds: 75, familyFilter: true },

	setup({ config, players, content }, ctx) {
		const order = ctx.rng.shuffle(players.map((p) => p.id));
		const turns = Array.from({ length: config.rounds }, () => order).flat();
		return {
			phase: 'intro',
			players,
			turns,
			turn: 0,
			deck: ctx.rng.shuffle(content.items),
			choices: [],
			word: null,
			config,
			phaseEndsAt: ctx.now + INTRO_MS,
			drawStartedAt: 0,
			hintTimes: [],
			revealed: [],
			guessed: [],
			feed: [],
			feedCounter: 0,
			strokes: [],
			pointCount: 0,
			scores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastPoints: {},
			active: players.map((p) => p.id)
		};
	},

	parseAction(raw) {
		if (typeof raw !== 'object' || raw === null) return null;
		const a = raw as Record<string, unknown>;
		if (a.type === 'next') return { type: 'next' };
		if (a.type === 'choose' && Number.isInteger(a.index))
			return { type: 'choose', index: a.index as number };
		if (a.type === 'guess' && typeof a.text === 'string') return { type: 'guess', text: a.text };
		return null;
	},

	reduce(state, action, actor, ctx) {
		switch (action.type) {
			case 'tick':
				return tick(state, ctx);
			case 'roster':
				return roster({ ...state, active: [...ctx.active] }, ctx);
			case 'next':
				return isController(actor) && state.phase !== 'final' ? advance(state, ctx) : state;
			case 'choose':
				return choose(state, action.index, actor, ctx);
			case 'guess':
				return guess(state, action.text, actor, ctx);
		}
	},

	view(state, viewer) {
		const drawerId = state.turns[state.turn];
		const drawer = state.players.find((p) => p.id === drawerId) ?? null;
		const viewerId = viewer.kind === 'player' ? viewer.playerId : null;
		const isDrawer = viewerId !== null && viewerId === drawerId;
		const showWord = isDrawer || state.phase === 'reveal';
		const ranked = rankPlayers(state.players, state.scores, state.lastPoints);
		const playing = viewerId !== null && state.players.some((p) => p.id === viewerId);
		const player = (id: string) => state.players.find((p) => p.id === id) ?? null;

		return {
			phase: state.phase,
			turn: state.turn,
			turns: state.turns.length,
			endsAt: state.phaseEndsAt,
			durationMs: phaseDuration(state),
			drawer: state.phase === 'intro' || state.phase === 'final' ? null : drawer,
			word: showWord ? state.word : null,
			mask: state.word ? maskWord(state.word, state.revealed) : [],
			choices: isDrawer && state.phase === 'choose' ? state.choices : null,
			guessedCount: state.guessed.length,
			guesserCount: guessers(state).length,
			// "Close!" hints are private to whoever guessed.
			feed: state.feed
				.filter((f) => f.kind !== 'close' || f.playerId === viewerId)
				.map((f) => ({ n: f.n, player: player(f.playerId), kind: f.kind, text: f.text })),
			you: playing
				? {
						isDrawer,
						guessed: state.guessed.includes(viewerId!),
						points: state.phase === 'reveal' ? (state.lastPoints[viewerId!] ?? 0) : 0,
						score: state.scores[viewerId!] ?? 0,
						rank: ranked.find((e) => e.id === viewerId)?.rank ?? null
					}
				: null,
			leaderboard: state.phase === 'reveal' || state.phase === 'final' ? ranked : []
		};
	},

	nextDeadline(state) {
		if (state.phase === 'final') return null;
		const hint = state.phase === 'draw' ? state.hintTimes[state.revealed.length] : undefined;
		return hint !== undefined ? Math.min(hint, state.phaseEndsAt) : state.phaseEndsAt;
	},

	shiftTime(state, ms) {
		return {
			...state,
			phaseEndsAt: state.phaseEndsAt + ms,
			drawStartedAt: state.drawStartedAt + ms,
			hintTimes: state.hintTimes.map((t) => t + ms)
		};
	},

	isOver(state) {
		return state.phase === 'final';
	},

	stream: {
		parse: parseStreamEvent,
		apply(state, raw, actor) {
			const event = raw as StreamEvent;
			if (state.phase !== 'draw' || actor.kind !== 'player') return null;
			if (actor.playerId !== state.turns[state.turn]) return null;
			switch (event.t) {
				case 'clear':
					return { ...state, strokes: [], pointCount: 0 };
				case 'undo': {
					const last = state.strokes.at(-1);
					if (!last) return null;
					return {
						...state,
						strokes: state.strokes.slice(0, -1),
						pointCount: state.pointCount - last.p.length
					};
				}
				case 'stroke': {
					if (state.pointCount + event.p.length > MAX_POINTS_PER_TURN) return null;
					const last = state.strokes.at(-1);
					// Batches of the same stroke extend it; a new id starts a new stroke.
					const strokes =
						last && last.id === event.id
							? [...state.strokes.slice(0, -1), { ...last, p: [...last.p, ...event.p] }]
							: [...state.strokes, { id: event.id, c: event.c, w: event.w, p: event.p }];
					return { ...state, strokes, pointCount: state.pointCount + event.p.length };
				}
			}
		},
		snapshot: (state) => ({
			turn: state.turn,
			strokes: state.phase === 'draw' || state.phase === 'reveal' ? state.strokes : []
		})
	}
});

export function parseStreamEvent(raw: unknown): StreamEvent | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const e = raw as Record<string, unknown>;
	if (e.t === 'undo' || e.t === 'clear') return { t: e.t };
	if (e.t !== 'stroke') return null;
	const { id, c, w, p } = e;
	if (typeof id !== 'string' || id.length === 0 || id.length > 16) return null;
	if (!Number.isInteger(c) || (c as number) < 0 || (c as number) >= COLORS.length) return null;
	if (!Number.isInteger(w) || (w as number) < 0 || (w as number) >= WIDTHS.length) return null;
	if (!Array.isArray(p) || p.length === 0 || p.length % 2 !== 0 || p.length > MAX_POINTS_PER_EVENT)
		return null;
	const points: number[] = [];
	for (const n of p) {
		if (typeof n !== 'number' || !Number.isFinite(n)) return null;
		points.push(Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000);
	}
	return { t: 'stroke', id, c: c as number, w: w as number, p: points };
}

// ---------- transitions ----------

function tick(state: DoodleState, ctx: GameContext): DoodleState {
	if (state.phase === 'draw') {
		const hintAt = state.hintTimes[state.revealed.length];
		if (hintAt !== undefined && ctx.now >= hintAt && ctx.now < state.phaseEndsAt) {
			return revealHint(state, ctx);
		}
	}
	return ctx.now >= state.phaseEndsAt ? advance(state, ctx) : state;
}

function advance(state: DoodleState, ctx: GameContext): DoodleState {
	switch (state.phase) {
		case 'intro':
			return startTurn(state, 0, ctx);
		case 'choose':
			// Time's up: pick the first option for them.
			return startDrawing(state, state.choices[0]!, ctx);
		case 'draw':
			return reveal(state, ctx);
		case 'reveal':
			return startTurn(state, state.turn + 1, ctx);
		case 'final':
			return state;
	}
}

/** Start turn `turn`, skipping drawers who have left. */
function startTurn(state: DoodleState, turn: number, ctx: GameContext): DoodleState {
	let t = turn;
	while (t < state.turns.length && !state.active.includes(state.turns[t]!)) t++;
	if (t >= state.turns.length || state.deck.length < WORD_CHOICES) {
		return { ...state, phase: 'final', phaseEndsAt: ctx.now, word: null, strokes: [] };
	}
	return {
		...state,
		phase: 'choose',
		turn: t,
		choices: state.deck.slice(0, WORD_CHOICES),
		deck: state.deck.slice(WORD_CHOICES),
		word: null,
		revealed: [],
		hintTimes: [],
		guessed: [],
		feed: [],
		strokes: [],
		pointCount: 0,
		lastPoints: {},
		phaseEndsAt: ctx.now + CHOOSE_MS
	};
}

function startDrawing(state: DoodleState, word: string, ctx: GameContext): DoodleState {
	const ms = state.config.drawSeconds * 1000;
	const letters = word.replace(/\s/g, '').length;
	return {
		...state,
		phase: 'draw',
		word,
		drawStartedAt: ctx.now,
		phaseEndsAt: ctx.now + ms,
		// Short words get one hint at most; two-letter words none.
		hintTimes: HINT_AT.slice(0, letters <= 2 ? 0 : letters <= 4 ? 1 : 2).map(
			(f) => ctx.now + ms * f
		)
	};
}

function revealHint(state: DoodleState, ctx: GameContext): DoodleState {
	const word = state.word!;
	const hidden = [...word].flatMap((ch, i) =>
		ch !== ' ' && !state.revealed.includes(i) ? [i] : []
	);
	if (hidden.length <= 1) return { ...state, hintTimes: [] };
	return { ...state, revealed: [...state.revealed, ctx.rng.pick(hidden)] };
}

/** End the drawing. Guessers were scored as they guessed; the drawer scores per correct guesser. */
function reveal(state: DoodleState, ctx: GameContext): DoodleState {
	const drawerId = state.turns[state.turn]!;
	const drawerPoints = state.guessed.length * DRAWER_POINTS;
	return {
		...state,
		phase: 'reveal',
		scores: addPoints(state.scores, { [drawerId]: drawerPoints }),
		lastPoints: { ...state.lastPoints, [drawerId]: drawerPoints },
		phaseEndsAt: ctx.now + REVEAL_MS
	};
}

function choose(state: DoodleState, index: number, actor: Actor, ctx: GameContext): DoodleState {
	if (state.phase !== 'choose' || actor.kind !== 'player') return state;
	if (actor.playerId !== state.turns[state.turn]) return state;
	const word = state.choices[index];
	return word ? startDrawing(state, word, ctx) : state;
}

function guess(state: DoodleState, raw: string, actor: Actor, ctx: GameContext): DoodleState {
	if (state.phase !== 'draw' || ctx.now >= state.phaseEndsAt || !state.word) return state;
	if (actor.kind !== 'player' && actor.kind !== 'audience') return state;
	const id = actor.kind === 'player' ? actor.playerId : actor.audienceId;
	const isPlayer = actor.kind === 'player' && state.players.some((p) => p.id === id);
	if (id === state.turns[state.turn] || state.guessed.includes(id)) return state;
	const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_GUESS_LENGTH);
	if (!text) return state;

	const target = normalize(state.word);
	const attempt = normalize(text);
	if (attempt === target) {
		// Audience can play along, but only players score.
		if (!isPlayer) return addFeed(state, { playerId: id, kind: 'close', text: 'You got it!' });
		const remaining = Math.max(0, state.phaseEndsAt - ctx.now) / (state.config.drawSeconds * 1000);
		const pts =
			Math.round((GUESS_POINTS.min + (GUESS_POINTS.max - GUESS_POINTS.min) * remaining) / 10) * 10;
		let next = addFeed(state, { playerId: id, kind: 'correct', text: '' });
		next = {
			...next,
			guessed: [...state.guessed, id],
			scores: addPoints(state.scores, { [id]: pts }),
			lastPoints: { ...state.lastPoints, [id]: pts }
		};
		const all = guessers(next);
		return all.length > 0 && all.every((p) => next.guessed.includes(p.id))
			? reveal(next, ctx)
			: next;
	}
	if (target.length >= 4 && editDistance(attempt, target) === 1) {
		return addFeed(state, { playerId: id, kind: 'close', text: `“${text}” is so close!` });
	}
	const shown = state.config.familyFilter ? censorText(text) : text;
	return addFeed(state, { playerId: id, kind: 'guess', text: shown });
}

function roster(state: DoodleState, ctx: GameContext): DoodleState {
	const drawerId = state.turns[state.turn];
	// The drawer left: end their turn.
	if (
		(state.phase === 'choose' || state.phase === 'draw') &&
		drawerId &&
		!state.active.includes(drawerId)
	) {
		return state.phase === 'draw' ? reveal(state, ctx) : startTurn(state, state.turn + 1, ctx);
	}
	if (state.phase === 'draw') {
		const all = guessers(state);
		if (all.length === 0 || all.every((p) => state.guessed.includes(p.id)))
			return reveal(state, ctx);
	}
	return state;
}

function addFeed(state: DoodleState, item: Omit<FeedItem, 'n'>): DoodleState {
	const n = state.feedCounter + 1;
	return { ...state, feedCounter: n, feed: [...state.feed, { ...item, n }].slice(-FEED_LENGTH) };
}

/** Present players other than the drawer. */
function guessers(state: DoodleState) {
	const drawerId = state.turns[state.turn];
	return state.players.filter((p) => p.id !== drawerId && state.active.includes(p.id));
}

export function normalize(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, '');
}

export function maskWord(word: string, revealed: number[]): string[] {
	return [...word].map((ch, i) => (ch === ' ' ? ' ' : revealed.includes(i) ? ch : '_'));
}

/** Levenshtein distance, for "so close!" hints. */
export function editDistance(a: string, b: string): number {
	const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let prev = dp[0]!;
		dp[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const tmp = dp[j]!;
			dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = tmp;
		}
	}
	return dp[b.length]!;
}

function phaseDuration(state: DoodleState): number {
	switch (state.phase) {
		case 'intro':
			return INTRO_MS;
		case 'choose':
			return CHOOSE_MS;
		case 'draw':
			return state.config.drawSeconds * 1000;
		case 'reveal':
			return REVEAL_MS;
		case 'final':
			return 0;
	}
}
