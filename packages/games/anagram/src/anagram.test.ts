import { describe, expect, test } from 'bun:test';
import { anagramPack } from '@games/content/packs';
import {
	createRng,
	startGame,
	stepFromClient,
	stepSystem,
	viewFor,
	type GameSession
} from '@games/engine';
import {
	FIRST_BONUS,
	GUESS_POINTS,
	HINT_AT,
	INTRO_MS,
	REVEAL_MS,
	createAnagram,
	sameLetters,
	scramble,
	wordsForLevel,
	type AnagramState,
	type AnagramView,
	type Level
} from './index.ts';

const players = ['ada', 'bob'].map((id) => ({ id, name: id, avatar: 'rings' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;
const WORD_MS = 40_000;
const game = createAnagram((w) => ['lemon', 'melon'].includes(w));
const pack = { items: [{ word: 'lemon', category: null }] };

function setup(): GameSession {
	const s = startGame(game, {
		mode: 'party',
		players,
		content: pack,
		config: { rounds: 1, secondsPerWord: WORD_MS / 1000, level: 1 },
		seed: 2,
		now: 0
	});
	stepSystem(game, s, { type: 'tick' }, { now: INTRO_MS, active: ids });
	return s;
}
const state = (s: GameSession) => s.state as AnagramState;
const view = (s: GameSession, id?: string) =>
	viewFor(game, s, id ? { kind: 'player', playerId: id } : { kind: 'host' }) as AnagramView;
const send = (s: GameSession, id: string, text: string, now = INTRO_MS) =>
	stepFromClient(game, s, { type: 'guess', text }, p(id), { now, active: ids });

describe('words', () => {
	test.each([1, 2, 3] as Level[])('level %i has plenty of words', (level) => {
		expect(wordsForLevel(anagramPack.items, level).length).toBeGreaterThanOrEqual(15);
	});

	test('a scramble uses the same letters but never spells the word', () => {
		const rng = createRng(4);
		for (const { word } of anagramPack.items.slice(0, 200)) {
			const letters = scramble(word, rng);
			expect(letters).not.toBe(word);
			expect(sameLetters(letters, word)).toBe(true);
		}
	});
});

describe('Anagram Race', () => {
	test('any real anagram counts; sooner scores more', () => {
		const s = setup();
		expect(view(s, 'ada').answer).toBeNull();
		expect(view(s, 'ada').letters).not.toBe('lemon');
		send(s, 'ada', 'MELON');
		send(s, 'bob', 'lemon', INTRO_MS + WORD_MS / 2);
		expect(state(s).scores.ada).toBe(GUESS_POINTS.max + FIRST_BONUS);
		expect(state(s).scores.bob).toBe((GUESS_POINTS.min + GUESS_POINTS.max) / 2);
		expect(view(s).answer).toBe('lemon');
	});

	test('wrong guesses are private', () => {
		const s = setup();
		send(s, 'ada', 'mole');
		send(s, 'ada', 'nolem');
		expect(view(s, 'ada').you?.lastWrong).toBe('nolem');
		expect(view(s, 'bob').you?.lastWrong).toBeNull();
		expect(state(s).solved).toEqual([]);
	});

	test('hints show the first then the last letter', () => {
		const s = setup();
		expect(view(s).mask.join('')).toBe('_____');
		stepSystem(game, s, { type: 'tick' }, { now: INTRO_MS + WORD_MS * HINT_AT[0]!, active: ids });
		expect(view(s).mask.join('')).toBe('l____');
		stepSystem(game, s, { type: 'tick' }, { now: INTRO_MS + WORD_MS * HINT_AT[1]!, active: ids });
		expect(view(s).mask.join('')).toBe('l___n');
		stepSystem(game, s, { type: 'tick' }, { now: INTRO_MS + WORD_MS, active: ids });
		expect(state(s).phase).toBe('reveal');
		stepSystem(game, s, { type: 'tick' }, { now: INTRO_MS + WORD_MS + REVEAL_MS, active: ids });
		expect(state(s).phase).toBe('final');
	});
});
