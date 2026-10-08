import { describe, expect, test } from 'bun:test';
import {
	createRng,
	startGame,
	stepFromClient,
	stepSystem,
	viewFor,
	type GameSession
} from '@games/engine';
import {
	INTRO_MS,
	PERFECT_BONUS,
	REVEAL_MS,
	TILE_POINTS,
	makePatterns,
	memory,
	type MemoryState,
	type MemoryView
} from './index.ts';

const players = ['ada', 'bob'].map((id) => ({ id, name: id, avatar: 'rings' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;

/** Through the intro and the showing, so players are recalling. */
function setup(): GameSession {
	const s = startGame(memory, {
		mode: 'party',
		players,
		content: null,
		config: { rounds: 2, recallSeconds: 15, level: 1 },
		seed: 9,
		now: 0
	});
	stepSystem(memory, s, { type: 'tick' }, { now: INTRO_MS, active: ids });
	stepSystem(memory, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
	return s;
}
const state = (s: GameSession) => s.state as MemoryState;
const view = (s: GameSession, id?: string) =>
	viewFor(memory, s, id ? { kind: 'player', playerId: id } : { kind: 'host' }) as MemoryView;
const pattern = (s: GameSession) => state(s).patterns[state(s).round]!;
const pick = (s: GameSession, id: string, index: number) =>
	stepFromClient(memory, s, { type: 'pick', index }, p(id), {
		now: state(s).phaseEndsAt - 1,
		active: ids
	});
const wrongTile = (s: GameSession) =>
	[...Array(pattern(s).size ** 2).keys()].find((i) => !pattern(s).tiles.includes(i))!;

describe('patterns', () => {
	test('one more tile each round, all different, inside the grid', () => {
		const patterns = makePatterns(2, 8, createRng(1));
		patterns.forEach((pt, i) => {
			expect(pt.tiles).toHaveLength(4 + i);
			expect(new Set(pt.tiles).size).toBe(pt.tiles.length);
			for (const t of pt.tiles) expect(t).toBeLessThan(pt.size ** 2);
			expect(pt.size ** 2).toBeGreaterThan(pt.tiles.length * 2);
		});
	});
});

describe('Memory Grid', () => {
	test('the pattern shows, then is hidden while players recall', () => {
		const s = startGame(memory, {
			mode: 'party',
			players,
			content: null,
			config: { rounds: 1, recallSeconds: 15, level: 1 },
			seed: 1,
			now: 0
		});
		stepSystem(memory, s, { type: 'tick' }, { now: INTRO_MS, active: ids });
		expect(view(s, 'ada').tiles).toEqual(pattern(s).tiles);
		stepSystem(memory, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		expect(view(s, 'ada').phase).toBe('recall');
		expect(view(s, 'ada').tiles).toEqual([]);
		expect(view(s).tiles).toEqual([]);
	});

	test('the whole pattern earns a bonus; a wrong tap ends your turn', () => {
		const s = setup();
		const tiles = pattern(s).tiles;
		for (const t of tiles) pick(s, 'ada', t);
		pick(s, 'bob', tiles[0]!);
		pick(s, 'bob', wrongTile(s));
		pick(s, 'bob', tiles[1]!);
		expect(state(s).phase).toBe('reveal');
		expect(state(s).scores.ada).toBe(tiles.length * (TILE_POINTS + PERFECT_BONUS));
		expect(state(s).scores.bob).toBe(TILE_POINTS);
		expect(view(s).results.map((r) => r.player.id)).toEqual(['ada', 'bob']);
	});

	test('you see whether each of your taps was right', () => {
		const s = setup();
		pick(s, 'ada', pattern(s).tiles[0]!);
		pick(s, 'ada', wrongTile(s));
		expect(view(s, 'ada').you?.picks.map((p) => p.right)).toEqual([true, false]);
		expect(view(s, 'ada').you?.done).toBe(true);
	});

	test('plays every round to the final', () => {
		const s = setup();
		stepSystem(memory, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		stepSystem(memory, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		expect(state(s).round).toBe(1);
		expect(pattern(s).tiles).toHaveLength(4);
		stepSystem(memory, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		stepSystem(memory, s, { type: 'tick' }, { now: state(s).phaseEndsAt, active: ids });
		stepSystem(memory, s, { type: 'tick' }, { now: state(s).phaseEndsAt + REVEAL_MS, active: ids });
		expect(state(s).phase).toBe('final');
	});
});
