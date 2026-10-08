import { describe, expect, test } from 'bun:test';
import type { PromptPack } from '@games/content';
import { startGame, stepFromClient, stepSystem, viewFor, type GameSession } from '@games/engine';
import {
	INTRO_MS,
	MAX_GUESSES,
	REVEAL_MS,
	SOLVE_POINTS,
	SPEED_BONUS,
	createWordRace,
	markGuess,
	type WordRaceState,
	type WordRaceView
} from './index.ts';

const pack: PromptPack = {
	id: 'test',
	title: 'Test',
	items: ['crane', 'slate', 'pious', 'bloom', 'cider']
};
const DICTIONARY = new Set([...pack.items, 'adieu', 'stare', 'tears', 'hello', 'eerie']);
const game = createWordRace((w) => DICTIONARY.has(w));
const players = ['ada', 'bob'].map((id) => ({ id, name: id, avatar: 'rings' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;
const host = { kind: 'host' } as const;

function setup(config: Partial<WordRaceState['config']> = {}): GameSession {
	return startGame(game, {
		mode: 'party',
		players,
		content: pack,
		config: { rounds: 2, secondsPerWord: 100, familyFilter: true, ...config },
		seed: 7,
		now: 0
	});
}
const state = (s: GameSession) => s.state as WordRaceState;
const view = (s: GameSession, id?: string) =>
	viewFor(game, s, id ? { kind: 'player', playerId: id } : { kind: 'host' }) as WordRaceView;
const send = (s: GameSession, id: string, word: string, now: number) =>
	stepFromClient(game, s, { type: 'guess', word }, p(id), { now, active: ids });
const tick = (s: GameSession, now: number) =>
	stepSystem(game, s, { type: 'tick' }, { now, active: ids });

/** Skip the intro; returns the round's answer. */
function begin(s: GameSession): string {
	tick(s, INTRO_MS);
	return state(s).words[state(s).round]!;
}

/** A dictionary word that isn't the answer. */
const wrong = (answer: string) => [...DICTIONARY].find((w) => w !== answer)!;

describe('marking guesses', () => {
	test('right spot, wrong spot and missing letters', () => {
		expect(markGuess('crate', 'crane')).toEqual(['hit', 'hit', 'hit', 'miss', 'hit']);
		expect(markGuess('nacre', 'crane')).toEqual(['near', 'near', 'near', 'near', 'hit']);
	});

	test('repeated letters only count as often as the answer has them', () => {
		// One E in the answer: the first E takes it, the other Es miss.
		expect(markGuess('eerie', 'cider')).toEqual(['near', 'miss', 'near', 'near', 'miss']);
		expect(markGuess('hello', 'bloom')).toEqual(['miss', 'miss', 'near', 'miss', 'near']);
		// Hits claim both Es first, so the earlier E misses.
		expect(markGuess('geese', 'these')).toEqual(['miss', 'miss', 'hit', 'hit', 'hit']);
	});
});

describe('Word Race', () => {
	test('a solve scores by guesses used plus a speed bonus', () => {
		const s = setup();
		const answer = begin(s);
		send(s, 'ada', wrong(answer), INTRO_MS + 1_000);
		send(s, 'ada', answer, INTRO_MS + 50_000);
		// Half the time left: half the speed bonus.
		expect(state(s).scores.ada).toBe(SOLVE_POINTS[2] + SPEED_BONUS / 2);
		expect(view(s, 'ada').you?.solved).toBe(true);
	});

	test('guesses that aren’t words are refused, not counted', () => {
		const s = setup();
		begin(s);
		send(s, 'ada', 'qqqqq', INTRO_MS + 100);
		send(s, 'ada', 'qqqqq', INTRO_MS + 200);
		const you = view(s, 'ada').you!;
		expect(you.guesses).toHaveLength(0);
		expect(you.rejected).toEqual({ word: 'qqqqq', n: 2 });
	});

	test('malformed guesses are rejected at parse time', () => {
		for (const word of ['four', 'sixsix', 'ab1de', 42]) {
			expect(game.parseAction({ type: 'guess', word })).toBeNull();
		}
		expect(game.parseAction({ type: 'guess', word: ' CRANE ' })).toEqual({
			type: 'guess',
			word: 'crane'
		});
	});

	test('the round ends once everyone has solved or run out of guesses', () => {
		const s = setup();
		const answer = begin(s);
		send(s, 'ada', answer, INTRO_MS + 1_000);
		for (let i = 0; i < MAX_GUESSES; i++) send(s, 'bob', wrong(answer), INTRO_MS + 2_000 + i);
		expect(state(s).phase).toBe('reveal');
		expect(view(s, 'bob').you?.out).toBe(true);
		expect(view(s).answer).toBe(answer);
		// No more guesses after running out.
		expect(send(s, 'bob', answer, INTRO_MS + 3_000)).toBe(false);
	});

	test('the big screen sees tiles but never letters or the answer', () => {
		const s = setup();
		const answer = begin(s);
		send(s, 'ada', wrong(answer), INTRO_MS + 1_000);
		const v = view(s);
		expect(v.answer).toBeNull();
		expect(v.you).toBeNull();
		expect(v.boards.find((b) => b.player.id === 'ada')?.marks).toHaveLength(1);
		expect(JSON.stringify(v)).not.toContain(answer);
		expect(JSON.stringify(v)).not.toContain(wrong(answer));
	});

	test('the keyboard keeps each letter’s best mark', () => {
		const s = setup({ rounds: 1 });
		const answer = begin(s);
		const other = wrong(answer);
		send(s, 'ada', other, INTRO_MS + 1_000);
		send(s, 'ada', answer, INTRO_MS + 2_000);
		const keys = view(s, 'ada').you!.keys;
		for (const ch of answer) expect(keys[ch]).toBe('hit');
	});

	test('time running out reveals, then moves on to the next word and the final', () => {
		const s = setup();
		const first = begin(s);
		tick(s, INTRO_MS + 100_000);
		expect(state(s).phase).toBe('reveal');
		tick(s, INTRO_MS + 100_000 + REVEAL_MS);
		expect(state(s).round).toBe(1);
		expect(state(s).words[1]).not.toBe(first);
		stepFromClient(game, s, { type: 'next' }, host, { now: 200_000, active: ids });
		stepFromClient(game, s, { type: 'next' }, host, { now: 200_001, active: ids });
		expect(state(s).phase).toBe('final');
		expect(view(s).leaderboard).toHaveLength(2);
	});

	test('players can’t skip ahead; only the controller can', () => {
		const s = setup();
		expect(stepFromClient(game, s, { type: 'next' }, p('ada'), { now: 1, active: ids })).toBe(
			false
		);
		expect(stepFromClient(game, s, { type: 'next' }, host, { now: 1, active: ids })).toBe(true);
	});

	test('a player leaving doesn’t hold up the round', () => {
		const s = setup();
		const answer = begin(s);
		send(s, 'ada', answer, INTRO_MS + 1_000);
		stepSystem(game, s, { type: 'roster' }, { now: INTRO_MS + 2_000, active: ['ada'] });
		expect(state(s).phase).toBe('reveal');
	});
});
