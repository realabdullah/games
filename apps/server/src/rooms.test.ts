import { beforeEach, describe, expect, test } from 'bun:test';
import { MAX_ROOM_PLAYERS, type RoomView, type You } from '@games/protocol';
import {
	IDLE_ROOM_TTL_MS,
	RoomError,
	RoomManager,
	VIP_GRACE_MS,
	type RoomEvents
} from './rooms.ts';

let clock: number;
let ids: number;
let views: Map<string, RoomView>;
let yous: Map<string, You>;
let ended: Map<string, string>;
let rooms: RoomManager;

beforeEach(() => {
	clock = 1_000;
	ids = 0;
	views = new Map();
	yous = new Map();
	ended = new Map();
	const events: RoomEvents = {
		roomChanged: (code, view) => views.set(code, view),
		youChanged: (session, you) => yous.set(session, you),
		sessionEnded: (session, reason) => ended.set(session, reason)
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
		expect(() => join(code, 'ada')).toThrow(RoomError);
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
			RoomError
		);

		rooms.handle(host.session, { type: 'kick', playerId: bob.you.id! });
		expect(ended.get(bob.session)).toBe('kicked');
		expect(views.get(host.code)?.players.map((p) => p.name)).toEqual(['Ada']);
		expect(() => rooms.connect(bob.session)).toThrow(RoomError);
	});

	test('host leaving closes the room for everyone', () => {
		const host = rooms.create({ mode: 'party' });
		const ada = join(host.code, 'Ada');
		rooms.handle(host.session, { type: 'leave' });
		expect(ended.get(ada.session)).toBe('left');
		expect(() => rooms.info(host.code)).toThrow(RoomError);
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
		expect(() => rooms.info(idle.code)).toThrow(RoomError);
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
			{ roomChanged() {}, youChanged() {}, sessionEnded() {} },
			() => clock
		);
		fresh.restore(snapshot);
		const { you, room } = fresh.connect(ada.session);
		expect(you.role).toBe('player');
		expect(room.hostConnected).toBe(false);
		expect(room.players).toMatchObject([{ name: 'Ada', connected: true }]);
	});
});
