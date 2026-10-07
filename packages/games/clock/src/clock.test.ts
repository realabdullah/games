import { describe, expect, test } from 'bun:test';
import { startGame, stepFromClient, stepSystem, viewFor, type GameSession } from '@games/engine';
import {
	CLOSEST_BONUS,
	INTRO_MS,
	MAX_POINTS,
	READY_MS,
	REVEAL_MS,
	TAP_SLACK_MS,
	clock,
	pointsFor,
	type ClockState,
	type ClockView
} from './index.ts';

const players = ['ada', 'bob'].map((id) => ({ id, name: id, avatar: '🦊' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;

/** Through the intro and the countdown, so the hidden clock is running. */
function setup(): GameSession {
	const s = startGame(clock, {
		mode: 'party',
		players,
		content: null,
		config: { rounds: 2, level: 1 },
		seed: 3,
		now: 0
	});
	stepSystem(clock, s, { type: 'tick' }, { now: INTRO_MS, active: ids });
	stepSystem(clock, s, { type: 'tick' }, { now: INTRO_MS + READY_MS, active: ids });
	return s;
}
const START = INTRO_MS + READY_MS;
const state = (s: GameSession) => s.state as ClockState;
const view = (s: GameSession, id?: string) =>
	viewFor(clock, s, id ? { kind: 'player', playerId: id } : { kind: 'host' }) as ClockView;
const target = (s: GameSession) => state(s).targets[state(s).round]!;
/** Tap claiming `ms`, arriving at the server `lag` ms later. */
const tap = (s: GameSession, id: string, ms: number, lag = 100) =>
	stepFromClient(clock, s, { type: 'tap', ms }, p(id), { now: START + ms + lag, active: ids });

describe('Stop the Clock', () => {
	test('targets are whole tenths of a second within the level', () => {
		const s = setup();
		for (const t of state(s).targets) {
			expect(t % 100).toBe(0);
			expect(t).toBeGreaterThanOrEqual(2_000);
			expect(t).toBeLessThanOrEqual(6_000);
		}
	});

	test('closest tap wins the bonus; the clock stays hidden until the reveal', () => {
		const s = setup();
		expect(view(s).phase).toBe('run');
		expect(view(s).durationMs).toBe(0);
		tap(s, 'ada', target(s) - 100);
		expect(view(s, 'bob').results).toEqual([]);
		tap(s, 'bob', target(s) + 600);
		expect(state(s).phase).toBe('reveal');
		const [first, second] = view(s).results;
		expect(first).toMatchObject({ player: { id: 'ada' }, off: 100 });
		expect(second).toMatchObject({ player: { id: 'bob' }, off: 600 });
		expect(state(s).scores.ada).toBe(pointsFor(100, target(s)) + CLOSEST_BONUS);
		expect(state(s).scores.bob).toBe(pointsFor(600, target(s)));
	});

	test('points: full when spot on, none when 50% off', () => {
		expect(pointsFor(0, 5_000)).toBe(MAX_POINTS);
		expect(pointsFor(2_500, 5_000)).toBe(0);
		expect(pointsFor(9_000, 5_000)).toBe(0);
	});

	test('a tap claiming more time than has passed is refused', () => {
		const s = setup();
		stepFromClient(clock, s, { type: 'tap', ms: 5_000 }, p('ada'), {
			now: START + 5_000 - TAP_SLACK_MS - 1,
			active: ids
		});
		expect(state(s).taps).toEqual({});
	});

	test('one tap each; no-shows score nothing when time runs out', () => {
		const s = setup();
		tap(s, 'ada', 1_000);
		tap(s, 'ada', target(s));
		expect(state(s).taps.ada).toBe(1_000);
		stepSystem(clock, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		expect(state(s).phase).toBe('reveal');
		expect(view(s).results.at(-1)).toMatchObject({ player: { id: 'bob' }, ms: null, points: 0 });
	});

	test('plays every round to the final', () => {
		const s = setup();
		tap(s, 'ada', target(s));
		tap(s, 'bob', target(s));
		let now = state(s).phaseEndsAt;
		stepSystem(clock, s, { type: 'tick' }, { now, active: ids });
		now += READY_MS;
		stepSystem(clock, s, { type: 'tick' }, { now, active: ids });
		expect(state(s).round).toBe(1);
		stepSystem(clock, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		stepSystem(clock, s, { type: 'tick' }, { now: state(s).phaseEndsAt + REVEAL_MS, active: ids });
		expect(state(s).phase).toBe('final');
	});
});

describe('round history', () => {
	test('everyone sees every round’s taps at each reveal and at the end', () => {
		const s = setup();
		tap(s, 'ada', target(s) - 300);
		tap(s, 'bob', target(s) + 200);
		const first = { ada: target(s) - 300, bob: target(s) + 200 };
		expect(view(s, 'bob').history).toEqual([{ target: target(s), taps: first }]);

		// Round two: only Ada taps.
		stepSystem(clock, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		stepSystem(clock, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		expect(view(s, 'ada').history).toEqual([]); // hidden while the next round plays
		stepFromClient(clock, s, { type: 'tap', ms: target(s) }, p('ada'), {
			now: state(s).startedAt + target(s) + 100,
			active: ids
		});
		stepSystem(clock, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		stepSystem(clock, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });

		expect(state(s).phase).toBe('final');
		expect(view(s).history).toEqual([
			{ target: state(s).targets[0]!, taps: first },
			{ target: state(s).targets[1]!, taps: { ada: state(s).targets[1]! } }
		]);
	});

	test('your own tap shows straight away; others’ stay hidden until the reveal', () => {
		const s = setup();
		tap(s, 'ada', 1_234);
		expect(view(s, 'ada').you?.ms).toBe(1_234);
		expect(view(s, 'bob').you?.ms).toBeNull();
		expect(JSON.stringify(view(s, 'bob'))).not.toContain('1234');
	});
});
