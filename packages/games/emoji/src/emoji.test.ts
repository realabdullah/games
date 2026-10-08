import { describe, expect, test } from 'bun:test';
import type { EmojiPack } from '@games/content';
import { startGame, stepFromClient, stepSystem, viewFor, type GameSession } from '@games/engine';
import {
	GUESS_POINTS,
	HINT_AT,
	INTRO_MS,
	REVEAL_MS,
	checkGuess,
	emoji,
	type EmojiState,
	type EmojiView
} from './index.ts';

const lionKing = { emoji: '🦁👑', answer: 'the lion king', category: 'Movies' };
const hotDog = { emoji: '🔥🐕', answer: 'hot dog', category: 'Food', also: ['hotdog'] };
const pack: EmojiPack = { id: 'test', title: 'Test', items: [lionKing, hotDog] };
const players = ['ada', 'bob'].map((id) => ({ id, name: id, avatar: 'rings' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;
const PUZZLE_MS = 40_000;

function setup(): GameSession {
	const s = startGame(emoji, {
		mode: 'party',
		players,
		content: pack,
		config: { rounds: 2, secondsPerPuzzle: PUZZLE_MS / 1000, familyFilter: true },
		seed: 5,
		now: 0
	});
	stepSystem(emoji, s, { type: 'tick' }, { now: INTRO_MS, active: ids });
	return s;
}
const state = (s: GameSession) => s.state as EmojiState;
const view = (s: GameSession, id?: string) =>
	viewFor(emoji, s, id ? { kind: 'player', playerId: id } : { kind: 'host' }) as EmojiView;
const send = (s: GameSession, id: string, text: string, now = INTRO_MS + 1) =>
	stepFromClient(emoji, s, { type: 'guess', text }, p(id), { now, active: ids });
const current = (s: GameSession) => state(s).puzzles[state(s).round]!;

describe('checking guesses', () => {
	test('ignores case, punctuation and a leading "the"', () => {
		expect(checkGuess('Lion King!', lionKing)).toBe('correct');
		expect(checkGuess('THE LION-KING', lionKing)).toBe('correct');
		expect(checkGuess('hotdog', hotDog)).toBe('correct');
	});

	test('long answers forgive one typo; near misses are "close"', () => {
		const saying = { emoji: '🌧️🐱🐶', answer: 'raining cats and dogs', category: 'Sayings' };
		expect(checkGuess('raining cats and dog', saying)).toBe('correct');
		expect(checkGuess('raining cat and dog', saying)).toBe('close');
		expect(checkGuess('lion kin', lionKing)).toBe('close');
		expect(checkGuess('hot dig', hotDog)).toBe('close');
		expect(checkGuess('cat', hotDog)).toBe('wrong');
	});
});

describe('Emoji Riddles', () => {
	test('a right guess scores more the sooner it comes', () => {
		const s = setup();
		send(s, 'ada', current(s).answer, INTRO_MS);
		send(s, 'bob', current(s).answer, INTRO_MS + PUZZLE_MS / 2);
		expect(state(s).scores.ada).toBe(GUESS_POINTS.max);
		expect(state(s).scores.bob).toBe((GUESS_POINTS.min + GUESS_POINTS.max) / 2);
		expect(state(s).phase).toBe('reveal');
	});

	test('wrong guesses show in the feed for everyone, censored', () => {
		const s = setup();
		send(s, 'ada', 'what the fuck');
		const feed = view(s, 'bob').feed;
		expect(feed).toHaveLength(1);
		expect(feed[0]!.text).not.toContain('fuck');
	});

	test('"close" hints only go to whoever guessed', () => {
		const s = setup();
		const answer = current(s).answer;
		send(s, 'ada', answer.slice(0, -1) + (answer.endsWith('z') ? 'y' : 'z'));
		expect(view(s, 'ada').feed[0]?.kind).toBe('close');
		expect(view(s, 'bob').feed).toHaveLength(0);
	});

	test('the answer stays hidden until the reveal; hints fill in letters', () => {
		const s = setup();
		const answer = current(s).answer;
		expect(JSON.stringify(view(s, 'ada'))).not.toContain(answer);
		expect(view(s).emoji).toBe(current(s).emoji);
		const hidden = () => view(s).mask.filter((c) => c === '_').length;
		const before = hidden();
		stepSystem(
			emoji,
			s,
			{ type: 'tick' },
			{ now: INTRO_MS + PUZZLE_MS * HINT_AT[0]!, active: ids }
		);
		expect(hidden()).toBeLessThan(before);
		expect(hidden()).toBeGreaterThan(0);
		stepSystem(emoji, s, { type: 'tick' }, { now: INTRO_MS + PUZZLE_MS, active: ids });
		expect(view(s).answer).toBe(answer);
		expect(view(s).mask).not.toContain('_');
	});

	test('audience guesses are acknowledged privately but never score', () => {
		const s = setup();
		stepFromClient(
			emoji,
			s,
			{ type: 'guess', text: current(s).answer },
			{ kind: 'audience', audienceId: 'aud' },
			{ now: INTRO_MS + 1, active: ids }
		);
		expect(state(s).guessed).toHaveLength(0);
		expect(view(s, 'ada').feed).toHaveLength(0);
	});

	test('plays through every puzzle to the final', () => {
		const s = setup();
		let now = INTRO_MS;
		for (let i = 0; i < 2; i++) {
			for (const id of ids) send(s, id, current(s).answer, ++now);
			now += REVEAL_MS;
			stepSystem(emoji, s, { type: 'tick' }, { now, active: ids });
		}
		expect(state(s).phase).toBe('final');
		expect(view(s).leaderboard.map((e) => e.id)).toEqual(['ada', 'bob']);
	});
});
