import { describe, expect, test } from 'bun:test';
import type { PromptPack } from '@games/content';
import {
	startGame,
	stepFromClient,
	stepSystem,
	streamFromClient,
	streamSnapshot,
	viewFor,
	type Actor,
	type GameSession
} from '@games/engine';
import {
	CHOOSE_MS,
	DRAWER_POINTS,
	GUESS_POINTS,
	INTRO_MS,
	MAX_POINTS_PER_TURN,
	REVEAL_MS,
	doodle,
	editDistance,
	maskWord,
	normalize,
	parseStreamEvent,
	type DoodleState,
	type DoodleView,
	type Stroke
} from './index.ts';

const pack: PromptPack = {
	id: 'test',
	title: 'Test',
	items: [
		'giraffe',
		'ice cream',
		'pizza',
		'rocket',
		'tree',
		'castle',
		'guitar',
		'owl',
		'kite',
		'drum'
	]
};
const players = ['ada', 'bob', 'cy'].map((id) => ({ id, name: id, avatar: 'rings' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;

function setup(config: Partial<DoodleState['config']> = {}): GameSession {
	return startGame(doodle, {
		mode: 'party',
		players,
		content: pack,
		config: { rounds: 1, drawSeconds: 60, familyFilter: true, ...config },
		seed: 11,
		now: 0
	});
}
const state = (s: GameSession) => s.state as DoodleState;
const drawer = (s: GameSession) => state(s).turns[state(s).turn]!;
const others = (s: GameSession) => ids.filter((id) => id !== drawer(s));
const send = (
	s: GameSession,
	actor: Exclude<Actor, { kind: 'system' }>,
	action: unknown,
	now = INTRO_MS,
	active = ids
) => stepFromClient(doodle, s, action, actor, { now, active });
const tick = (s: GameSession, now: number, active = ids) =>
	stepSystem(doodle, s, { type: 'tick' }, { now, active });
const view = (s: GameSession, v: Parameters<typeof viewFor>[2]) =>
	viewFor(doodle, s, v) as DoodleView;
const stream = (
	s: GameSession,
	actor: Exclude<Actor, { kind: 'system' }>,
	event: unknown,
	now = INTRO_MS
) => streamFromClient(doodle, s, event, actor, { now, active: ids });

/** Intro → choose → draw, with the drawer picking the first word. */
function toDrawing(s: GameSession) {
	tick(s, INTRO_MS);
	send(s, p(drawer(s)), { type: 'choose', index: 0 });
}

describe('turns', () => {
	test('everyone draws once per round, in a shuffled order', () => {
		const s = setup({ rounds: 2 });
		expect(state(s).turns).toHaveLength(6);
		expect(state(s).turns.slice(0, 3).toSorted()).toEqual(ids.toSorted());
	});

	test('only the drawer sees the word choices, and then the word', () => {
		const s = setup();
		tick(s, INTRO_MS);
		expect(state(s).phase).toBe('choose');
		expect(view(s, { kind: 'player', playerId: drawer(s) }).choices).toHaveLength(3);
		expect(view(s, { kind: 'player', playerId: others(s)[0]! }).choices).toBeNull();
		expect(view(s, { kind: 'host' }).choices).toBeNull();

		send(s, p(drawer(s)), { type: 'choose', index: 1 });
		const word = state(s).word!;
		expect(view(s, { kind: 'player', playerId: drawer(s) }).word).toBe(word);
		expect(view(s, { kind: 'player', playerId: others(s)[0]! }).word).toBeNull();
		expect(view(s, { kind: 'host' }).word).toBeNull();
		expect(view(s, { kind: 'host' }).mask).toHaveLength(word.length);
	});

	test('picks a word automatically if the drawer runs out of time', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const first = state(s).choices[0];
		tick(s, INTRO_MS + CHOOSE_MS);
		expect(state(s).phase).toBe('draw');
		expect(state(s).word).toBe(first!);
	});

	test('non-drawers cannot choose', () => {
		const s = setup();
		tick(s, INTRO_MS);
		expect(send(s, p(others(s)[0]!), { type: 'choose', index: 0 })).toBe(false);
	});
});

describe('guessing', () => {
	test('correct guesses score by speed; the drawer scores per guesser', () => {
		const s = setup();
		toDrawing(s);
		const [g1, g2] = others(s) as [string, string];
		send(s, p(g1), { type: 'guess', text: state(s).word!.toUpperCase() }, INTRO_MS);
		expect(state(s).scores[g1]).toBe(GUESS_POINTS.max);
		send(s, p(g2), { type: 'guess', text: `  ${state(s).word!}! ` }, INTRO_MS + 30_000);
		expect(state(s).scores[g2]).toBeLessThan(GUESS_POINTS.max);
		expect(state(s).scores[g2]).toBeGreaterThan(GUESS_POINTS.min);
		// Everyone got it: the turn ends early.
		expect(state(s).phase).toBe('reveal');
		expect(state(s).scores[drawer(s)]).toBe(2 * DRAWER_POINTS);
	});

	test('wrong guesses show in the feed; correct ones never reveal the word', () => {
		const s = setup();
		toDrawing(s);
		const [g1, g2] = others(s) as [string, string];
		send(s, p(g1), { type: 'guess', text: 'banana' });
		send(s, p(g2), { type: 'guess', text: state(s).word! });
		const feed = view(s, { kind: 'host' }).feed;
		expect(feed.map((f) => f.kind)).toEqual(['guess', 'correct']);
		expect(JSON.stringify(feed)).not.toContain(state(s).word!);
	});

	test('near misses get a private "so close" hint', () => {
		const s = setup();
		tick(s, INTRO_MS);
		// Force a known word for the test.
		const i = state(s).choices.indexOf('giraffe');
		if (i < 0) state(s).choices[0] = 'giraffe';
		send(s, p(drawer(s)), { type: 'choose', index: Math.max(0, i) });
		const [g1, g2] = others(s) as [string, string];
		send(s, p(g1), { type: 'guess', text: 'girafe' });
		expect(view(s, { kind: 'player', playerId: g1 }).feed.map((f) => f.kind)).toEqual(['close']);
		expect(view(s, { kind: 'player', playerId: g2 }).feed).toHaveLength(0);
	});

	test('the drawer and players who already got it cannot guess', () => {
		const s = setup();
		toDrawing(s);
		expect(send(s, p(drawer(s)), { type: 'guess', text: state(s).word! })).toBe(false);
		const g1 = others(s)[0]!;
		send(s, p(g1), { type: 'guess', text: state(s).word! });
		expect(send(s, p(g1), { type: 'guess', text: 'again' })).toBe(false);
	});

	test('wrong guesses are censored with the filter on', () => {
		const s = setup();
		toDrawing(s);
		send(s, p(others(s)[0]!), { type: 'guess', text: 'shit' });
		expect(view(s, { kind: 'host' }).feed[0]!.text).not.toContain('shit');
	});

	test('audience can guess but never scores', () => {
		const s = setup();
		toDrawing(s);
		send(s, { kind: 'audience', audienceId: 'x' }, { type: 'guess', text: state(s).word! });
		expect(state(s).guessed).toEqual([]);
		expect(state(s).phase).toBe('draw');
	});
});

describe('hints and timing', () => {
	test('letters are revealed partway through, never all of them', () => {
		const s = setup();
		tick(s, INTRO_MS);
		const i = state(s).choices.findIndex((w) => w.length >= 5);
		send(s, p(drawer(s)), { type: 'choose', index: Math.max(0, i) });
		const start = INTRO_MS;
		tick(s, start + 29_000);
		expect(state(s).revealed).toHaveLength(0);
		tick(s, start + 30_000);
		expect(state(s).revealed).toHaveLength(1);
		tick(s, start + 45_000);
		expect(state(s).revealed).toHaveLength(2);
		expect(doodle.nextDeadline(state(s))).toBe(start + 60_000);
	});

	test('runs every turn, then ends', () => {
		const s = setup();
		let now = INTRO_MS;
		tick(s, now);
		for (let t = 0; t < 3; t++) {
			expect(state(s).phase).toBe('choose');
			now += CHOOSE_MS;
			tick(s, now);
			now += 60_000;
			tick(s, now);
			expect(state(s).phase).toBe('reveal');
			now += REVEAL_MS;
			tick(s, now);
		}
		expect(state(s).phase).toBe('final');
	});

	test('the drawer leaving ends their turn', () => {
		const s = setup();
		toDrawing(s);
		const gone = drawer(s);
		stepSystem(
			doodle,
			s,
			{ type: 'roster' },
			{ now: INTRO_MS, active: ids.filter((id) => id !== gone) }
		);
		expect(state(s).phase).toBe('reveal');
	});
});

describe('drawing stream', () => {
	const stroke = (id: string, pts: number[]) => ({ t: 'stroke', id, c: 0, w: 1, p: pts });

	test('only the drawer can draw, and only while drawing', () => {
		const s = setup();
		tick(s, INTRO_MS);
		expect(stream(s, p(drawer(s)), stroke('a', [0.1, 0.1]))).toBeNull();
		send(s, p(drawer(s)), { type: 'choose', index: 0 });
		expect(stream(s, p(others(s)[0]!), stroke('a', [0.1, 0.1]))).toBeNull();
		expect(stream(s, p(drawer(s)), stroke('a', [0.1, 0.1]))).not.toBeNull();
	});

	test('batches extend a stroke; undo and clear work', () => {
		const s = setup();
		toDrawing(s);
		const d = p(drawer(s));
		stream(s, d, stroke('a', [0.1, 0.1, 0.2, 0.2]));
		stream(s, d, stroke('a', [0.3, 0.3]));
		stream(s, d, stroke('b', [0.5, 0.5]));
		expect(state(s).strokes.map((x: Stroke) => x.p.length)).toEqual([6, 2]);
		stream(s, d, { t: 'undo' });
		expect(state(s).strokes).toHaveLength(1);
		stream(s, d, { t: 'clear' });
		expect(state(s).strokes).toHaveLength(0);
	});

	test('snapshots carry the current turn’s strokes for late joiners', () => {
		const s = setup();
		toDrawing(s);
		stream(s, p(drawer(s)), stroke('a', [0.1, 0.2]));
		expect(streamSnapshot(doodle, s)).toEqual({
			turn: 0,
			strokes: [{ id: 'a', c: 0, w: 1, p: [0.1, 0.2] }]
		});
	});

	test('rejects malformed events and clamps coordinates', () => {
		expect(parseStreamEvent({ t: 'stroke', id: 'a', c: 99, w: 1, p: [0, 0] })).toBeNull();
		expect(parseStreamEvent({ t: 'stroke', id: 'a', c: 0, w: 1, p: [0] })).toBeNull();
		expect(parseStreamEvent({ t: 'stroke', id: 'a', c: 0, w: 1, p: [0, 'x'] })).toBeNull();
		expect(parseStreamEvent({ t: 'erase' })).toBeNull();
		expect(parseStreamEvent({ t: 'stroke', id: 'a', c: 0, w: 1, p: [-1, 2.5] })).toMatchObject({
			p: [0, 1]
		});
	});

	test('caps total points per turn', () => {
		const s = setup();
		toDrawing(s);
		const d = p(drawer(s));
		const batch = Array.from({ length: 400 }, () => 0.5);
		let accepted = 0;
		for (let i = 0; i < MAX_POINTS_PER_TURN / 400 + 5; i++) {
			if (stream(s, d, stroke(`s${i}`, batch))) accepted++;
		}
		expect(accepted).toBe(MAX_POINTS_PER_TURN / 400);
	});
});

test('helpers', () => {
	expect(normalize('Ice-Cream!')).toBe('icecream');
	expect(normalize('Café')).toBe('cafe');
	expect(maskWord('ice cream', [0])).toEqual(['i', '_', '_', ' ', '_', '_', '_', '_', '_']);
	expect(editDistance('girafe', 'giraffe')).toBe(1);
	expect(editDistance('kitten', 'sitting')).toBe(3);
});
