import { describe, expect, test } from 'bun:test';
import type { HangmanPack } from '@games/content';
import { startGame, stepFromClient, stepSystem, viewFor, type GameSession } from '@games/engine';
import {
	INTRO_MS,
	LETTER_POINTS,
	MAX_MISSES,
	REVEAL_MS,
	SOLVE_POINTS,
	hangman,
	type HangmanState,
	type HangmanView
} from './index.ts';

const pack: HangmanPack = {
	id: 'test',
	title: 'Test',
	items: [{ word: 'ice cream', category: 'Food' }]
};
const players = ['ada', 'bob', 'cy'].map((id) => ({ id, name: id, avatar: '🦊' }));
const ids = players.map((p) => p.id);
const p = (id: string) => ({ kind: 'player', playerId: id, vip: false }) as const;
const TURN_MS = 15_000;

function setup(): GameSession {
	const s = startGame(hangman, {
		mode: 'party',
		players,
		content: pack,
		config: { rounds: 1, turnSeconds: TURN_MS / 1000, familyFilter: true },
		seed: 3,
		now: 0
	});
	stepSystem(hangman, s, { type: 'tick' }, { now: INTRO_MS, active: ids });
	return s;
}
const state = (s: GameSession) => s.state as HangmanState;
const view = (s: GameSession, id?: string) =>
	viewFor(hangman, s, id ? { kind: 'player', playerId: id } : { kind: 'host' }) as HangmanView;
/** The player whose turn it is sends an action. */
const play = (s: GameSession, action: object, now = INTRO_MS + 1) =>
	stepFromClient(hangman, s, action, p(state(s).turn), { now, active: ids });

describe('Hangman', () => {
	test('a found letter scores per copy, shows in the mask and passes the turn', () => {
		const s = setup();
		const first = state(s).turn;
		play(s, { type: 'letter', letter: 'C' });
		expect(state(s).scores[first]).toBe(2 * LETTER_POINTS);
		expect(view(s).mask.join('')).toBe('_c_ c____');
		expect(state(s).turn).not.toBe(first);
		expect(view(s).event).toMatchObject({ kind: 'hit', letter: 'c', count: 2 });
	});

	test('only the player whose turn it is can move, and each letter only once', () => {
		const s = setup();
		const other = ids.find((id) => id !== state(s).turn)!;
		expect(
			stepFromClient(hangman, s, { type: 'letter', letter: 'e' }, p(other), {
				now: INTRO_MS + 1,
				active: ids
			})
		).toBe(false);
		play(s, { type: 'letter', letter: 'e' });
		expect(play(s, { type: 'letter', letter: 'e' })).toBe(false);
	});

	test('wrong letters cost a shared life; six ends the word', () => {
		const s = setup();
		for (const letter of 'bdfghj'.slice(0, MAX_MISSES)) play(s, { type: 'letter', letter });
		expect(state(s).misses).toBe(MAX_MISSES);
		expect(state(s).phase).toBe('reveal');
		expect(view(s).word).toBe('ice cream');
		expect(view(s).solvedBy).toBeNull();
		expect(view(s).wrong).toEqual([...'bdfghj']);
	});

	test('solving outright scores a bonus for every hidden letter', () => {
		const s = setup();
		play(s, { type: 'letter', letter: 'c' });
		const solver = state(s).turn;
		play(s, { type: 'solve', text: '  Ice-Cream ' });
		expect(state(s).phase).toBe('reveal');
		expect(view(s).solvedBy?.id).toBe(solver);
		// 8 letters, 2 already showing.
		expect(state(s).scores[solver]).toBe(SOLVE_POINTS + 6 * LETTER_POINTS);
	});

	test('a wrong solve costs a life and is shown, censored', () => {
		const s = setup();
		play(s, { type: 'solve', text: 'shit cream' });
		expect(state(s).misses).toBe(1);
		expect(view(s).event?.kind).toBe('wrong-solve');
		expect(view(s).event?.text).not.toContain('shit');
	});

	test('finishing the word with a letter earns the completion bonus', () => {
		const s = setup();
		for (const letter of 'icear') play(s, { type: 'letter', letter });
		const last = state(s).turn;
		const before = state(s).scores[last]!;
		play(s, { type: 'letter', letter: 'm' });
		expect(state(s).phase).toBe('reveal');
		expect(state(s).scores[last]).toBe(before + LETTER_POINTS + SOLVE_POINTS);
	});

	test('running out of time counts as a miss and moves on', () => {
		const s = setup();
		const first = state(s).turn;
		stepSystem(hangman, s, { type: 'tick' }, { now: INTRO_MS + TURN_MS, active: ids });
		expect(state(s).misses).toBe(1);
		expect(state(s).turn).not.toBe(first);
		expect(view(s).event?.kind).toBe('timeout');
	});

	test('the player whose turn it is leaving passes the turn for free', () => {
		const s = setup();
		const leaving = state(s).turn;
		stepSystem(
			hangman,
			s,
			{ type: 'roster' },
			{ now: INTRO_MS + 10, active: ids.filter((id) => id !== leaving) }
		);
		expect(state(s).turn).not.toBe(leaving);
		expect(state(s).misses).toBe(0);
	});

	test('the word stays hidden until the reveal, then the game ends', () => {
		const s = setup();
		expect(JSON.stringify(view(s, 'ada'))).not.toContain('cream');
		expect(view(s).category).toBe('Food');
		play(s, { type: 'solve', text: 'ice cream' });
		stepSystem(hangman, s, { type: 'tick' }, { now: INTRO_MS + 1 + REVEAL_MS, active: ids });
		expect(state(s).phase).toBe('final');
	});

	test('solo: every turn is yours', () => {
		const s = startGame(hangman, {
			mode: 'solo',
			players: [players[0]!],
			content: pack,
			config: { rounds: 1, turnSeconds: 15 },
			seed: 1,
			now: 0
		});
		stepSystem(hangman, s, { type: 'tick' }, { now: INTRO_MS, active: ['ada'] });
		for (const letter of 'bc') {
			stepFromClient(hangman, s, { type: 'letter', letter }, p('ada'), {
				now: INTRO_MS + 1,
				active: ['ada']
			});
		}
		expect(state(s).guessed).toEqual(['b', 'c']);
		expect(view(s, 'ada').you?.yourTurn).toBe(true);
	});
});

test('someone joining mid-game sits it out instead of breaking the seat order', () => {
	const s = setup();
	const dee = { id: 'dee', name: 'dee', avatar: '🦊' };
	const changed = stepSystem(
		hangman,
		s,
		{ type: 'join', player: dee },
		{ now: INTRO_MS + 1, active: [...ids, 'dee'] }
	);
	expect(changed).toBe(false);
	expect(view(s, 'dee').you).toBeNull();
});
