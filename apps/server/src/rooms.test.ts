import { beforeEach, describe, expect, test } from 'bun:test';
import { MAX_ROOM_PLAYERS, type GameUpdate, type RoomView, type You } from '@games/protocol';
import type { TriviaView } from '@games/trivia';
import { INTRO_MS } from '@games/trivia';
import { findTriviaPack } from '@games/content';
import { ApiError } from './errors.ts';
import type { RoomEvent } from './log.ts';
import {
	IDLE_ROOM_TTL_MS,
	IGNORED_LOG_EVERY_MS,
	RoomManager,
	VIP_GRACE_MS,
	type RoomEvents
} from './rooms.ts';

let clock: number;
let ids: number;
let views: Map<string, RoomView>;
let yous: Map<string, You>;
let ended: Map<string, string>;
let games: Map<string, GameUpdate>;
let rooms: RoomManager;

beforeEach(() => {
	clock = 1_000;
	ids = 0;
	views = new Map();
	yous = new Map();
	ended = new Map();
	games = new Map();
	const events: RoomEvents = {
		roomChanged: (code, view) => views.set(code, view),
		youChanged: (session, you) => yous.set(session, you),
		sessionEnded: (session, reason) => ended.set(session, reason),
		gameChanged: (updates) => {
			for (const { session, update } of updates) games.set(session, update);
		},
		streamed: () => {}
	};
	rooms = new RoomManager(
		events,
		() => clock,
		Math.random,
		() => `id${++ids}`
	);
});

const join = (code: string, name: string) => rooms.join(code, { name, avatar: '🦊' });

describe('party rooms', () => {
	test('host creates, players join and connect', () => {
		const host = rooms.create({ mode: 'party' });
		expect(host.code).toMatch(/^[A-Z]{4}$/);
		expect(host.you).toEqual({ role: 'host', id: null, vip: false });

		const ada = join(host.code, 'Ada');
		expect(ada.you.role).toBe('player');
		expect(ada.you.vip).toBe(false); // party rooms are run by the host screen

		const { room } = rooms.connect(ada.session);
		expect(room.players).toMatchObject([{ name: 'Ada', connected: true }]);
	});

	test('names are unique per room, case-insensitively', () => {
		const { code } = rooms.create({ mode: 'party' });
		join(code, 'Ada');
		expect(() => join(code, 'ada')).toThrow(ApiError);
	});

	test('players beyond the cap join as audience', () => {
		const { code } = rooms.create({ mode: 'party' });
		for (let i = 0; i < MAX_ROOM_PLAYERS; i++) join(code, `P${i}`);
		expect(join(code, 'Extra').you.role).toBe('audience');
		expect(views.get(code)?.audienceCount).toBe(1);
		expect(rooms.info(code).full).toBe(true);
	});

	test('only the host can kick', () => {
		const host = rooms.create({ mode: 'party' });
		const ada = join(host.code, 'Ada');
		const bob = join(host.code, 'Bob');
		expect(() => rooms.handle(ada.session, { type: 'kick', playerId: bob.you.id! })).toThrow(
			ApiError
		);

		rooms.handle(host.session, { type: 'kick', playerId: bob.you.id! });
		expect(ended.get(bob.session)).toBe('kicked');
		expect(views.get(host.code)?.players.map((p) => p.name)).toEqual(['Ada']);
		expect(() => rooms.connect(bob.session)).toThrow(ApiError);
	});

	test('host leaving closes the room for everyone', () => {
		const host = rooms.create({ mode: 'party' });
		const ada = join(host.code, 'Ada');
		rooms.handle(host.session, { type: 'leave' });
		expect(ended.get(ada.session)).toBe('left');
		expect(() => rooms.info(host.code)).toThrow(ApiError);
	});
});

describe('online rooms', () => {
	test('creator is a VIP player', () => {
		const ada = rooms.create({ mode: 'online', name: 'Ada', avatar: '🦊' });
		expect(ada.you).toMatchObject({ role: 'player', vip: true });
		const bob = join(ada.code, 'Bob');
		expect(bob.you.vip).toBe(false);
	});

	test('VIP passes on when the VIP leaves', () => {
		const ada = rooms.create({ mode: 'online', name: 'Ada', avatar: '🦊' });
		const bob = join(ada.code, 'Bob');
		rooms.connect(bob.session);
		rooms.handle(ada.session, { type: 'leave' });
		expect(yous.get(bob.session)?.vip).toBe(true);
	});

	test('VIP passes on after a long disconnect, not a short one', () => {
		const ada = rooms.create({ mode: 'online', name: 'Ada', avatar: '🦊' });
		const bob = join(ada.code, 'Bob');
		rooms.connect(ada.session);
		rooms.connect(bob.session);
		rooms.disconnect(ada.session);

		clock += VIP_GRACE_MS - 1;
		rooms.sweep();
		expect(views.get(ada.code)?.players.find((p) => p.vip)?.name).toBe('Ada');

		clock += 2;
		rooms.sweep();
		expect(views.get(ada.code)?.players.find((p) => p.vip)?.name).toBe('Bob');
	});

	test('room closes when the last player leaves', () => {
		const ada = rooms.create({ mode: 'online', name: 'Ada', avatar: '🦊' });
		rooms.handle(ada.session, { type: 'leave' });
		expect(rooms.roomCount).toBe(0);
	});
});

describe('lifecycle', () => {
	test('idle rooms expire; active ones do not', () => {
		const idle = rooms.create({ mode: 'party' });
		const busy = rooms.create({ mode: 'party' });
		rooms.connect(busy.session);

		clock += IDLE_ROOM_TTL_MS + 1;
		rooms.sweep();
		expect(() => rooms.info(idle.code)).toThrow(ApiError);
		expect(rooms.info(busy.code).code).toBe(busy.code);
		expect(ended.get(idle.session)).toBe('expired');
	});

	test('snapshot + restore keeps rooms and sessions, everyone reconnects', () => {
		const host = rooms.create({ mode: 'party' });
		const ada = join(host.code, 'Ada');
		rooms.connect(host.session);
		rooms.connect(ada.session);
		const snapshot = JSON.parse(JSON.stringify(rooms.snapshot()));

		const fresh = new RoomManager(
			{ roomChanged() {}, youChanged() {}, sessionEnded() {}, gameChanged() {}, streamed() {} },
			() => clock
		);
		fresh.restore(snapshot);
		const { you, room } = fresh.connect(ada.session);
		expect(you.role).toBe('player');
		expect(room.hostConnected).toBe(false);
		expect(room.players).toMatchObject([{ name: 'Ada', connected: true }]);
	});
});

describe('games', () => {
	const trivia = (session: string) => games.get(session)?.view as TriviaView | undefined;

	function partyWithPlayers(n: number) {
		const host = rooms.create({ mode: 'party' });
		const players = Array.from({ length: n }, (_, i) => join(host.code, `P${i}`));
		return { host, players };
	}

	test('host starts trivia; everyone gets their own view', () => {
		const { host, players } = partyWithPlayers(2);
		rooms.handle(host.session, { type: 'start', gameId: 'trivia', packId: 'science' });
		expect(views.get(host.code)).toMatchObject({ phase: 'playing', gameId: 'trivia' });
		expect(trivia(host.session)).toMatchObject({
			phase: 'intro',
			packTitle: 'Science & Nature',
			you: null
		});
		expect(trivia(players[0]!.session)?.you).toMatchObject({ score: 0 });
	});

	test('players cannot start games in party rooms', () => {
		const { host, players } = partyWithPlayers(2);
		expect(() => rooms.handle(players[0]!.session, { type: 'start', gameId: 'trivia' })).toThrow(
			ApiError
		);
		expect(views.get(host.code)?.phase).toBe('lobby');
	});

	test('rejects unknown games and packs', () => {
		const { host } = partyWithPlayers(1);
		expect(() => rooms.handle(host.session, { type: 'start', gameId: 'nope' })).toThrow(ApiError);
		expect(() =>
			rooms.handle(host.session, { type: 'start', gameId: 'trivia', packId: 'nope' })
		).toThrow(ApiError);
	});

	test('the online VIP starts the game', () => {
		const ada = rooms.create({ mode: 'online', name: 'Ada', avatar: '🦊' });
		rooms.handle(ada.session, { type: 'start', gameId: 'trivia' });
		expect(trivia(ada.session)?.phase).toBe('intro');
	});

	test('timers advance the game through tick()', () => {
		const { host } = partyWithPlayers(1);
		rooms.handle(host.session, { type: 'start', gameId: 'trivia' });
		rooms.tick();
		expect(trivia(host.session)?.phase).toBe('intro');
		clock += INTRO_MS;
		rooms.tick();
		expect(trivia(host.session)?.phase).toBe('question');
	});

	test('answers flow through and the round reveals when everyone answers', () => {
		const { host, players } = partyWithPlayers(2);
		rooms.handle(host.session, { type: 'start', gameId: 'trivia' });
		clock += INTRO_MS;
		rooms.tick();
		for (const p of players) {
			rooms.handle(p.session, { type: 'action', action: { type: 'answer', choice: 0 } });
		}
		expect(trivia(host.session)?.phase).toBe('reveal');
		expect(trivia(players[0]!.session)?.you?.answered).toBe(0);
	});

	test('kicking the last unanswered player reveals the round', () => {
		const { host, players } = partyWithPlayers(2);
		rooms.handle(host.session, { type: 'start', gameId: 'trivia' });
		clock += INTRO_MS;
		rooms.tick();
		rooms.handle(players[0]!.session, { type: 'action', action: { type: 'answer', choice: 0 } });
		rooms.handle(host.session, { type: 'kick', playerId: players[1]!.you.id! });
		expect(trivia(host.session)?.phase).toBe('reveal');
	});

	test('someone who joins mid-game can answer the current question', () => {
		const { host, players } = partyWithPlayers(3);
		rooms.handle(host.session, { type: 'start', gameId: 'trivia' });
		clock += INTRO_MS;
		rooms.tick();

		const late = join(host.code, 'Late');
		expect(trivia(late.session)?.you).toMatchObject({ answered: null, score: 0 });
		expect(trivia(host.session)?.playerCount).toBe(4);

		rooms.handle(late.session, { type: 'action', action: { type: 'answer', choice: 1 } });
		expect(trivia(late.session)?.you?.answered).toBe(1);
		// Still waiting on the others: the newcomer counts toward "everyone answered".
		expect(trivia(host.session)?.phase).toBe('question');
		for (const p of players) {
			rooms.handle(p.session, { type: 'action', action: { type: 'answer', choice: 0 } });
		}
		expect(trivia(host.session)?.phase).toBe('reveal');
		expect(trivia(host.session)?.leaderboard.map((e) => e.name)).toContain('Late');
	});

	test('endGame returns to the lobby', () => {
		const { host } = partyWithPlayers(1);
		rooms.handle(host.session, { type: 'start', gameId: 'trivia' });
		rooms.handle(host.session, { type: 'endGame' });
		expect(views.get(host.code)).toMatchObject({ phase: 'lobby', gameId: null });
	});

	test('a game in progress survives snapshot + restore', () => {
		const { host, players } = partyWithPlayers(1);
		rooms.handle(host.session, { type: 'start', gameId: 'trivia' });
		clock += INTRO_MS;
		rooms.tick();
		const before = trivia(players[0]!.session)!;

		const fresh = new RoomManager(
			{ roomChanged() {}, youChanged() {}, sessionEnded() {}, gameChanged() {}, streamed() {} },
			() => clock
		);
		fresh.restore(JSON.parse(JSON.stringify(rooms.snapshot())));
		const { game } = fresh.connect(players[0]!.session);
		expect((game?.view as TriviaView).question).toEqual(before.question);
	});
});

describe('phase 4 games', () => {
	function partyOf(n: number) {
		const host = rooms.create({ mode: 'party' });
		const players = Array.from({ length: n }, (_, i) => join(host.code, `P${i}`));
		return { host, players };
	}

	test.each(['icebreakers', 'wit', 'doodle'])('%s starts with 3 players, not 2', (gameId) => {
		const small = partyOf(2);
		expect(() => rooms.handle(small.host.session, { type: 'start', gameId })).toThrow(
			'at least 3 players'
		);
		const { host } = partyOf(3);
		rooms.handle(host.session, { type: 'start', gameId });
		expect(views.get(host.code)).toMatchObject({ phase: 'playing', gameId });
	});

	test('the room’s family filter setting reaches the game', () => {
		const { host, players } = partyOf(3);
		rooms.handle(host.session, { type: 'settings', familyFilter: false });
		rooms.handle(host.session, { type: 'start', gameId: 'icebreakers' });
		const snap = rooms.snapshot().rooms[0]!;
		expect((snap.game!.state as { config: { familyFilter: boolean } }).config.familyFilter).toBe(
			false
		);
		void players;
	});

	test('doodle strokes from the drawer are relayed; others are ignored', () => {
		const relayed: unknown[] = [];
		const fresh = new RoomManager(
			{
				roomChanged() {},
				youChanged() {},
				sessionEnded() {},
				gameChanged: (updates) => {
					for (const { session, update } of updates) games.set(session, update);
				},
				streamed: (_code, from, event) => relayed.push({ from, event })
			},
			() => clock
		);
		const host = fresh.create({ mode: 'party' });
		const ps = ['A', 'B', 'C'].map((n) => fresh.join(host.code, { name: n, avatar: '🦊' }));
		fresh.handle(host.session, { type: 'start', gameId: 'doodle' });
		fresh.handle(host.session, { type: 'action', action: { type: 'next' } }); // skip intro
		const drawerSession = ps.find(
			(p) => (games.get(p.session)?.view as { choices: unknown }).choices
		)!;
		fresh.handle(drawerSession.session, { type: 'action', action: { type: 'choose', index: 0 } });

		const stroke = { t: 'stroke', id: 's1', c: 0, w: 1, p: [0.1, 0.2] };
		const other = ps.find((p) => p !== drawerSession)!;
		fresh.handle(other.session, { type: 'stream', event: stroke });
		expect(relayed).toHaveLength(0);
		fresh.handle(drawerSession.session, { type: 'stream', event: stroke });
		expect(relayed).toEqual([{ from: drawerSession.you.id, event: stroke }]);

		// A reconnecting client gets the strokes so far.
		const { game } = fresh.connect(other.session);
		expect(game?.stream).toMatchObject({ strokes: [{ id: 's1' }] });
	});
});

describe('word games', () => {
	const start = (session: string, gameId: string, config: Record<string, number> = {}) =>
		rooms.handle(session, { type: 'start', gameId, config });
	const gameState = <T>() => rooms.snapshot().rooms[0]!.game!.state as T;

	test.each(['wordrace', 'hangman', 'emoji'])('%s starts with one player', (gameId) => {
		const host = rooms.create({ mode: 'party' });
		join(host.code, 'Ada');
		start(host.session, gameId, { rounds: 3 });
		expect(views.get(host.code)).toMatchObject({ phase: 'playing', gameId });
	});

	test('rematches pick words the room hasn’t had yet', () => {
		const host = rooms.create({ mode: 'party' });
		join(host.code, 'Ada');
		start(host.session, 'wordrace', { rounds: 5 });
		const first = gameState<{ words: string[] }>().words;
		expect(first).toHaveLength(5);
		rooms.handle(host.session, { type: 'endGame' });
		start(host.session, 'wordrace', { rounds: 5 });
		const second = gameState<{ words: string[] }>().words;
		expect(second.filter((w) => first.includes(w))).toEqual([]);
	});

	test('Word Race checks guesses against the dictionary', () => {
		const host = rooms.create({ mode: 'party' });
		const ada = join(host.code, 'Ada');
		start(host.session, 'wordrace', { rounds: 1 });
		rooms.handle(host.session, { type: 'action', action: { type: 'next' } }); // skip intro
		const answer = gameState<{ words: string[] }>().words[0]!;
		const guess = answer === 'house' ? 'mouse' : 'house';
		rooms.handle(ada.session, { type: 'action', action: { type: 'guess', word: 'zzzzz' } });
		rooms.handle(ada.session, { type: 'action', action: { type: 'guess', word: guess } });
		expect(gameState<{ guesses: Record<string, string[]> }>().guesses[ada.you.id!]).toEqual([
			guess
		]);
	});
});

describe('restore hardening', () => {
	const noEvents = {
		roomChanged() {},
		youChanged() {},
		sessionEnded() {},
		gameChanged() {},
		streamed() {}
	};

	function triviaInQuestion() {
		const host = rooms.create({ mode: 'party' });
		const ada = join(host.code, 'Ada');
		rooms.handle(host.session, {
			type: 'start',
			gameId: 'trivia',
			config: { secondsPerQuestion: 20 }
		});
		clock += INTRO_MS;
		rooms.tick();
		return { host, ada };
	}

	test('downtime is added back to game timers', () => {
		const { ada } = triviaInQuestion();
		const before = (games.get(ada.session)!.view as TriviaView).endsAt;
		const snapshot = JSON.parse(JSON.stringify(rooms.snapshot()));

		clock += 60_000; // a minute offline: without shifting, the question would be long over
		const fresh = new RoomManager(noEvents, () => clock);
		expect(fresh.restore(snapshot)).toEqual({ restored: 1, skipped: 0, gamesDropped: 0 });
		const { game } = fresh.connect(ada.session);
		const view = game!.view as TriviaView;
		expect(view.phase).toBe('question');
		expect(view.endsAt).toBe(before + 60_000);
	});

	test('a game saved by an incompatible version goes back to the lobby', () => {
		const { ada } = triviaInQuestion();
		const snapshot = JSON.parse(JSON.stringify(rooms.snapshot()));
		snapshot.rooms[0].game.stateVersion = 999;

		const fresh = new RoomManager(noEvents, () => clock);
		expect(fresh.restore(snapshot)).toMatchObject({ restored: 1, gamesDropped: 1 });
		const { room, game } = fresh.connect(ada.session);
		expect(room.phase).toBe('lobby');
		expect(game).toBeNull();
	});

	test('a malformed room is skipped without losing the others', () => {
		const a = rooms.create({ mode: 'party' });
		rooms.create({ mode: 'party' });
		const snapshot = JSON.parse(JSON.stringify(rooms.snapshot()));
		snapshot.rooms[1] = { code: 42 };

		const fresh = new RoomManager(noEvents, () => clock);
		const origError = console.error;
		console.error = () => {};
		try {
			expect(fresh.restore(snapshot)).toMatchObject({ restored: 1, skipped: 1 });
		} finally {
			console.error = origError;
		}
		expect(fresh.info(a.code).code).toBe(a.code);
	});

	test('garbage snapshots are ignored', () => {
		const fresh = new RoomManager(noEvents, () => clock);
		expect(fresh.restore({ version: 2 } as never)).toMatchObject({ restored: 0 });
		expect(fresh.restore(null as never)).toMatchObject({ restored: 0 });
	});

	test('the revision only moves when something changes', () => {
		const r0 = rooms.revision;
		rooms.sweep();
		expect(rooms.revision).toBe(r0);
		rooms.create({ mode: 'party' });
		expect(rooms.revision).toBeGreaterThan(r0);
	});
});

describe('metrics', () => {
	test('counts rooms, joins, starts and finishes', () => {
		const host = rooms.create({ mode: 'party' });
		join(host.code, 'Ada');
		rooms.handle(host.session, { type: 'start', gameId: 'trivia', config: { questionCount: 3 } });
		const m = rooms.metrics;
		expect(m.roomsCreated.get({ mode: 'party' })).toBe(1);
		expect(m.playersJoined.get({ role: 'player' })).toBe(1);
		expect(m.gamesStarted.get({ game: 'trivia' })).toBe(1);

		// Skip to the end: intro, then each question and reveal.
		for (let i = 0; i < 7; i++)
			rooms.handle(host.session, { type: 'action', action: { type: 'next' } });
		expect(m.gamesFinished.get({ game: 'trivia' })).toBe(1);
		// Further updates don't double count.
		rooms.handle(host.session, { type: 'action', action: { type: 'next' } });
		expect(m.gamesFinished.get({ game: 'trivia' })).toBe(1);

		const text = m.render();
		expect(text).toContain('games_started_total{game="trivia"} 1');
		expect(text).toContain('# TYPE games_rooms_created_total counter');
	});
});

describe('fresh questions in a room', () => {
	const playedQuestions = (code: string) => {
		const room = rooms.snapshot().rooms.find((r) => r.code === code)!;
		return (room.game!.state as { questions: { q: string }[] }).questions.map((q) => q.q);
	};

	test('a rematch on the same pack only asks questions the room hasn’t had', () => {
		const host = rooms.create({ mode: 'party' });
		join(host.code, 'Ada');
		const pack = findTriviaPack('general')!;
		const start = () =>
			rooms.handle(host.session, {
				type: 'start',
				gameId: 'trivia',
				packId: 'general',
				config: { questionCount: 5 }
			});

		start();
		const first = playedQuestions(host.code);
		rooms.handle(host.session, { type: 'endGame' });
		start();
		const second = playedQuestions(host.code);
		rooms.handle(host.session, { type: 'endGame' });
		start();
		const third = playedQuestions(host.code);

		expect(first).toHaveLength(5);
		expect(new Set([...first, ...second, ...third]).size).toBe(pack.questions.length);
	});

	test('once a pack runs out, the room starts a new cycle', () => {
		const host = rooms.create({ mode: 'party' });
		join(host.code, 'Ada');
		const start = () =>
			rooms.handle(host.session, {
				type: 'start',
				gameId: 'trivia',
				packId: 'science',
				config: { questionCount: 10 }
			});
		start();
		const first = playedQuestions(host.code);
		rooms.handle(host.session, { type: 'endGame' });
		start();
		const second = playedQuestions(host.code);
		const science = findTriviaPack('science')!;
		// 12 questions: the two unplayed ones, topped up with eight already played.
		const unplayed = science.questions.map((q) => q.q).filter((q) => !first.includes(q));
		expect(unplayed).toHaveLength(2);
		expect(second).toEqual(expect.arrayContaining(unplayed));
		expect(new Set(second).size).toBe(10);
	});
});

describe('event log', () => {
	let logged: RoomEvent[];
	beforeEach(() => {
		logged = [];
		rooms.log = (e) => logged.push(e);
	});

	test('a late join shows up between the game start and the answers', () => {
		const host = rooms.create({ mode: 'party' });
		join(host.code, 'Ada');
		rooms.handle(host.session, { type: 'start', gameId: 'hangman' });
		const late = join(host.code, 'Bob');

		expect(logged.map((e) => e.event)).toEqual([
			'room_created',
			'joined',
			'game_started',
			'joined'
		]);
		expect(logged.at(-1)).toEqual({
			event: 'joined',
			room: host.code,
			player: late.you.id!,
			role: 'player',
			midGame: 'hangman',
			admitted: false
		});
	});

	test('never logs names or session tokens', () => {
		const host = rooms.create({ mode: 'party' });
		const ada = join(host.code, 'Ada');
		rooms.connect(ada.session);
		const text = JSON.stringify(logged);
		expect(text).not.toContain('Ada');
		expect(text).not.toContain(ada.session);
		expect(text).not.toContain(host.session);
	});

	test('ignored actions are throttled per member, with a count of the rest', () => {
		const host = rooms.create({ mode: 'party' });
		const ada = join(host.code, 'Ada');
		rooms.handle(host.session, { type: 'start', gameId: 'trivia' });
		// Still in the intro: answers do nothing.
		const answer = () =>
			rooms.handle(ada.session, { type: 'action', action: { type: 'answer', choice: 0 } });
		for (let i = 0; i < 50; i++) answer();
		clock += IGNORED_LOG_EVERY_MS;
		answer();

		const ignored = logged.filter((e) => e.event === 'action_ignored');
		expect(ignored).toHaveLength(2);
		expect(ignored[1]).toMatchObject({ player: ada.you.id, action: 'answer', suppressed: 49 });
	});
});
