import {
	startGame,
	stepFromClient,
	resumeSession,
	stepSystem,
	streamFromClient,
	streamSnapshot,
	viewFor,
	type Actor,
	type GameSession,
	type Viewer
} from '@games/engine';
import {
	MAX_ROOM_PLAYERS,
	ROOM_CODE_ALPHABET,
	ROOM_CODE_LENGTH,
	type ClientMessage,
	type CreateRoomBody,
	type GameUpdate,
	type JoinRoomBody,
	type RoomInfoResponse,
	type RoomMode,
	type RoomSettings,
	type RoomView,
	type SessionResponse,
	type You
} from '@games/protocol';
import { isProfane } from '@games/content';
import { ApiError } from './errors.ts';
import { createRegistry, type Registry } from './games.ts';
import { Metrics } from './metrics.ts';

/** How long a disconnected VIP keeps their crown before it passes on. */
export const VIP_GRACE_MS = 30_000;
/** Rooms with nobody connected are closed after this long. */
export const IDLE_ROOM_TTL_MS = 10 * 60_000;

interface Member {
	id: string;
	name: string;
	avatar: string;
	session: string;
	connected: boolean;
	disconnectedAt: number | null;
	joinedAt: number;
}

interface Room {
	code: string;
	mode: RoomMode;
	phase: RoomView['phase'];
	createdAt: number;
	/** Last time anyone was connected. */
	lastSeenAt: number;
	host: { session: string; connected: boolean } | null;
	players: Member[];
	audience: Member[];
	vipId: string | null;
	game: GameSession | null;
	/** Whether the current game's finish has been counted in metrics. */
	gameFinished?: boolean;
	settings: RoomSettings;
}

interface Session {
	code: string;
	role: You['role'];
	id: string | null;
}

/** Side effects the transport layer (WebSockets) carries out. */
export interface RoomEvents {
	roomChanged(code: string, view: RoomView): void;
	youChanged(session: string, you: You): void;
	sessionEnded(session: string, reason: 'kicked' | 'left' | 'expired'): void;
	/** Each connected-or-not member's own view of the game. */
	gameChanged(updates: { session: string; update: GameUpdate }[]): void;
	/** Relay a stream event to everyone in the room. */
	streamed(code: string, from: string | null, event: unknown): void;
}

export interface RoomSnapshot {
	version: 1;
	/** When it was taken, so restored games can make up for the downtime. */
	savedAt?: number;
	rooms: Room[];
}

export class RoomManager {
	private rooms = new Map<string, Room>();
	private sessions = new Map<string, Session>();

	constructor(
		private events: RoomEvents,
		private now: () => number = Date.now,
		private random: () => number = Math.random,
		private newId: () => string = () => crypto.randomUUID(),
		private registry: Registry = createRegistry(),
		readonly metrics: Metrics = new Metrics()
	) {}

	/** Live counts for gauges. */
	stats() {
		const playing = new Map<string, number>();
		let players = 0;
		for (const room of this.rooms.values()) {
			players += room.players.length + room.audience.length;
			if (room.game) playing.set(room.game.gameId, (playing.get(room.game.gameId) ?? 0) + 1);
		}
		return { rooms: this.rooms.size, players, playing };
	}

	get roomCount() {
		return this.rooms.size;
	}

	create(body: CreateRoomBody): SessionResponse {
		// New rooms start with the family filter on.
		if (body.mode === 'online' && isProfane(body.name)) {
			throw new ApiError('filtered', 'Please pick a different name');
		}
		const code = this.newCode();
		const t = this.now();
		const room: Room = {
			code,
			mode: body.mode,
			phase: 'lobby',
			createdAt: t,
			lastSeenAt: t,
			host: null,
			players: [],
			audience: [],
			vipId: null,
			game: null,
			settings: { familyFilter: true }
		};
		this.rooms.set(code, room);
		this.revision++;
		this.metrics.roomsCreated.inc({ mode: body.mode });

		if (body.mode === 'party') {
			const session = this.newId();
			room.host = { session, connected: false };
			this.sessions.set(session, { code, role: 'host', id: null });
			return { code, session, you: { role: 'host', id: null, vip: false } };
		}
		return this.addMember(room, body.name, body.avatar);
	}

	join(code: string, body: JoinRoomBody): SessionResponse {
		const room = this.mustGet(code);
		const name = body.name.toLowerCase();
		if ([...room.players, ...room.audience].some((m) => m.name.toLowerCase() === name)) {
			throw new ApiError('name_taken', 'Someone in this room already has that name');
		}
		this.checkName(room, body.name);
		return this.addMember(room, body.name, body.avatar);
	}

	info(code: string): RoomInfoResponse {
		const room = this.mustGet(code);
		return {
			code: room.code,
			mode: room.mode,
			phase: room.phase,
			playerCount: room.players.length,
			full: room.players.length >= MAX_ROOM_PLAYERS
		};
	}

	/** Mark a session connected. Returns what to send in the welcome message. */
	connect(session: string): { you: You; room: RoomView; game: GameUpdate | null } {
		const s = this.mustSession(session);
		const room = this.mustGet(s.code);
		if (s.role === 'host') room.host!.connected = true;
		else {
			const m = this.member(room, s);
			m.connected = true;
			m.disconnectedAt = null;
		}
		room.lastSeenAt = this.now();
		this.changed(room);
		const game = this.gameUpdate(room, s);
		if (game && room.game) {
			game.stream = streamSnapshot(this.registry[room.game.gameId]!.game, room.game);
		}
		return { you: this.you(room, s), room: this.view(room), game };
	}

	disconnect(session: string) {
		const s = this.sessions.get(session);
		const room = s && this.rooms.get(s.code);
		if (!s || !room) return;
		if (s.role === 'host') room.host!.connected = false;
		else {
			const m = this.member(room, s);
			m.connected = false;
			m.disconnectedAt = this.now();
		}
		room.lastSeenAt = this.now();
		this.changed(room);
	}

	handle(session: string, msg: ClientMessage) {
		const s = this.mustSession(session);
		const room = this.mustGet(s.code);
		switch (msg.type) {
			case 'kick': {
				if (!this.canControl(room, s)) throw new ApiError('forbidden', 'Only the host can kick');
				const target =
					room.players.find((p) => p.id === msg.playerId) ??
					room.audience.find((a) => a.id === msg.playerId);
				if (!target || target.id === s.id) return;
				this.removeMember(room, target, 'kicked');
				return;
			}
			case 'leave': {
				if (s.role === 'host') return this.close(room, 'left');
				this.removeMember(room, this.member(room, s), 'left');
				return;
			}
			case 'start':
				return this.startGame(room, s, msg);
			case 'action': {
				if (!room.game) return;
				const { game } = this.registry[room.game.gameId]!;
				const actor = this.actor(room, s) as Exclude<Actor, { kind: 'system' }>;
				const changed = stepFromClient(game, room.game, msg.action, actor, {
					now: this.now(),
					active: this.activeIds(room)
				});
				if (changed) this.gameChanged(room);
				return;
			}
			case 'settings': {
				if (!this.canControl(room, s))
					throw new ApiError('forbidden', 'Only the host can change settings');
				room.settings = { familyFilter: msg.familyFilter };
				this.changed(room);
				return;
			}
			case 'stream': {
				if (!room.game) return;
				const { game } = this.registry[room.game.gameId]!;
				const actor = this.actor(room, s) as Exclude<Actor, { kind: 'system' }>;
				const event = streamFromClient(game, room.game, msg.event, actor, {
					now: this.now(),
					active: this.activeIds(room)
				});
				if (event !== null) {
					this.revision++;
					this.events.streamed(room.code, s.id, event);
				}
				return;
			}
			case 'endGame': {
				if (!this.canControl(room, s))
					throw new ApiError('forbidden', 'Only the host can end the game');
				if (!room.game) return;
				room.game = null;
				room.phase = 'lobby';
				this.changed(room);
				return;
			}
		}
	}

	/** Fire game deadlines that have passed (timers, auto-advance). Call often. */
	tick() {
		const now = this.now();
		for (const room of this.rooms.values()) {
			if (!room.game) continue;
			const { game } = this.registry[room.game.gameId]!;
			const deadline = game.nextDeadline(room.game.state);
			if (deadline === null || now < deadline) continue;
			if (stepSystem(game, room.game, { type: 'tick' }, { now, active: this.activeIds(room) })) {
				this.gameChanged(room);
			}
		}
	}

	/** Periodic housekeeping: pass on VIP from long-gone players, close idle rooms. */
	sweep() {
		const t = this.now();
		for (const room of this.rooms.values()) {
			if (this.anyoneConnected(room)) room.lastSeenAt = t;
			else if (t - room.lastSeenAt > IDLE_ROOM_TTL_MS) {
				this.close(room, 'expired');
				continue;
			}
			const vip = room.players.find((p) => p.id === room.vipId);
			if (vip && !vip.connected && t - (vip.disconnectedAt ?? t) > VIP_GRACE_MS) {
				const next = room.players.find((p) => p.connected);
				if (next) this.setVip(room, next.id);
			}
		}
	}

	/** Bumped on every change, so periodic snapshots can skip when nothing happened. */
	revision = 0;

	snapshot(): RoomSnapshot {
		return { version: 1, savedAt: this.now(), rooms: structuredClone([...this.rooms.values()]) };
	}

	/**
	 * Load rooms saved before a restart. Everyone comes back as disconnected
	 * and reconnects with their session token; the restart counts as activity
	 * so rooms don't instantly expire.
	 */
	restore(snapshot: RoomSnapshot): { restored: number; skipped: number; gamesDropped: number } {
		const result = { restored: 0, skipped: 0, gamesDropped: 0 };
		if (snapshot?.version !== 1 || !Array.isArray(snapshot.rooms)) return result;
		const t = this.now();
		const downtime = snapshot.savedAt ? Math.max(0, t - snapshot.savedAt) : 0;
		for (const room of snapshot.rooms) {
			// One bad room must never stop the others from coming back.
			try {
				if (this.restoreRoom(room, t, downtime)) result.gamesDropped++;
				result.restored++;
			} catch (err) {
				result.skipped++;
				console.error(`skipped room ${room?.code} on restore`, err);
			}
		}
		return result;
	}

	/** Returns true if the room's game had to be dropped. */
	private restoreRoom(room: Room, t: number, downtime: number): boolean {
		if (typeof room.code !== 'string' || !Array.isArray(room.players))
			throw new Error('malformed room');
		room.lastSeenAt = t;
		room.game ??= null;
		room.audience ??= [];
		room.settings ??= { familyFilter: true };

		let dropped = false;
		if (room.game) {
			const entry = this.registry[room.game.gameId];
			const resumed = entry ? resumeSession(entry.game, room.game, downtime) : null;
			if (resumed) room.game = resumed;
			else {
				// The game changed shape (or no longer exists) since the snapshot: back to the lobby.
				room.game = null;
				room.phase = 'lobby';
				dropped = true;
			}
		}

		if (room.host) {
			room.host.connected = false;
			this.sessions.set(room.host.session, { code: room.code, role: 'host', id: null });
		}
		for (const [list, role] of [
			[room.players, 'player'],
			[room.audience, 'audience']
		] as const) {
			for (const m of list) {
				m.connected = false;
				m.disconnectedAt = t;
				this.sessions.set(m.session, { code: room.code, role, id: m.id });
			}
		}
		this.rooms.set(room.code, room);
		return dropped;
	}

	// ---------- internals ----------

	private startGame(room: Room, s: Session, msg: Extract<ClientMessage, { type: 'start' }>) {
		if (!this.canControl(room, s))
			throw new ApiError('forbidden', 'Only the host can start a game');
		if (room.game && !this.registry[room.game.gameId]!.game.isOver(room.game.state)) {
			throw new ApiError('bad_request', 'A game is already running');
		}
		const entry = this.registry[msg.gameId];
		if (!entry || !entry.game.meta.modes.includes(room.mode)) {
			throw new ApiError('bad_request', 'That game isn’t available here');
		}
		const { min, max } = entry.game.meta.players;
		if (room.players.length < min) {
			throw new ApiError('bad_request', `This game needs at least ${min} players`);
		}
		if (room.players.length > max) {
			throw new ApiError('bad_request', `This game allows at most ${max} players`);
		}
		const loaded = entry.content(msg.packId);
		if (!loaded) throw new ApiError('bad_request', 'That question pack doesn’t exist');
		if (loaded.flagged && room.settings.familyFilter) {
			throw new ApiError(
				'filtered',
				'This pack has words the family filter blocks. Turn the filter off to play it.'
			);
		}

		room.game = startGame(entry.game, {
			mode: room.mode,
			players: room.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })),
			content: loaded.content,
			config: { ...(entry.config(msg.config) as object), familyFilter: room.settings.familyFilter },
			seed: Math.floor(this.random() * 2 ** 32),
			now: this.now()
		});
		room.phase = 'playing';
		room.gameFinished = false;
		this.metrics.gamesStarted.inc({ game: msg.gameId });
		if (loaded.customCode) this.onCustomPackPlayed?.(loaded.customCode);
		this.changed(room);
		this.gameChanged(room);
	}

	/** Hook for counting plays of custom packs. */
	onCustomPackPlayed?: (code: string) => void;

	private checkName(room: Room, name: string) {
		if (room.settings.familyFilter && isProfane(name)) {
			throw new ApiError('filtered', 'Please pick a different name');
		}
	}

	private actor(room: Room, s: Session): Actor {
		if (s.role === 'host') return { kind: 'host' };
		if (s.role === 'audience') return { kind: 'audience', audienceId: s.id! };
		return { kind: 'player', playerId: s.id!, vip: s.id === room.vipId };
	}

	private viewer(s: Session): Viewer {
		if (s.role === 'host') return { kind: 'host' };
		if (s.role === 'audience') return { kind: 'audience', audienceId: s.id! };
		return { kind: 'player', playerId: s.id! };
	}

	private activeIds(room: Room) {
		return room.players.map((p) => p.id);
	}

	private gameUpdate(room: Room, s: Session): GameUpdate | null {
		if (!room.game) return null;
		const { game } = this.registry[room.game.gameId]!;
		return {
			gameId: room.game.gameId,
			view: viewFor(game, room.game, this.viewer(s)),
			now: this.now()
		};
	}

	private gameChanged(room: Room) {
		this.revision++;
		if (
			room.game &&
			!room.gameFinished &&
			this.registry[room.game.gameId]!.game.isOver(room.game.state)
		) {
			room.gameFinished = true;
			this.metrics.gamesFinished.inc({ game: room.game.gameId });
		}
		const updates = [...this.sessions.entries()]
			.filter(([, s]) => s.code === room.code)
			.map(([session, s]) => ({ session, update: this.gameUpdate(room, s)! }));
		this.events.gameChanged(updates);
	}

	private addMember(room: Room, name: string, avatar: string): SessionResponse {
		const role = room.players.length < MAX_ROOM_PLAYERS ? 'player' : 'audience';
		const member: Member = {
			id: this.newId(),
			name,
			avatar,
			session: this.newId(),
			connected: false,
			disconnectedAt: null,
			joinedAt: this.now()
		};
		(role === 'player' ? room.players : room.audience).push(member);
		const s: Session = { code: room.code, role, id: member.id };
		this.metrics.playersJoined.inc({ role });
		this.sessions.set(member.session, s);
		if (role === 'player' && room.mode === 'online' && room.vipId === null) room.vipId = member.id;
		this.changed(room);
		return { code: room.code, session: member.session, you: this.you(room, s) };
	}

	private removeMember(room: Room, m: Member, reason: 'kicked' | 'left') {
		room.players = room.players.filter((p) => p.id !== m.id);
		room.audience = room.audience.filter((a) => a.id !== m.id);
		this.sessions.delete(m.session);
		this.events.sessionEnded(m.session, reason);
		// Online rooms only exist for their players.
		if (room.mode === 'online' && room.players.length === 0) return this.close(room, 'expired');
		if (room.game) {
			const { game } = this.registry[room.game.gameId]!;
			const ctx = { now: this.now(), active: this.activeIds(room) };
			if (stepSystem(game, room.game, { type: 'roster' }, ctx)) this.gameChanged(room);
		}
		if (room.vipId === m.id) {
			const next = room.players.find((p) => p.connected) ?? room.players[0];
			this.setVip(room, next?.id ?? null);
		}
		this.changed(room);
	}

	private setVip(room: Room, id: string | null) {
		const prev = room.players.find((p) => p.id === room.vipId);
		room.vipId = id;
		const next = room.players.find((p) => p.id === id);
		for (const m of [prev, next]) {
			if (m) this.events.youChanged(m.session, this.you(room, this.sessions.get(m.session)!));
		}
		this.changed(room);
	}

	private close(room: Room, reason: 'left' | 'expired') {
		this.rooms.delete(room.code);
		this.revision++;
		const sessions = [
			room.host?.session,
			...room.players.map((p) => p.session),
			...room.audience.map((a) => a.session)
		];
		for (const session of sessions) {
			if (!session) continue;
			this.sessions.delete(session);
			this.events.sessionEnded(session, reason === 'left' ? 'left' : 'expired');
		}
	}

	private canControl(room: Room, s: Session) {
		return room.mode === 'party' ? s.role === 'host' : s.role === 'player' && s.id === room.vipId;
	}

	private anyoneConnected(room: Room) {
		return (
			!!room.host?.connected ||
			room.players.some((p) => p.connected) ||
			room.audience.some((a) => a.connected)
		);
	}

	private member(room: Room, s: Session): Member {
		const m = (s.role === 'player' ? room.players : room.audience).find((x) => x.id === s.id);
		if (!m) throw new ApiError('session_invalid', 'You are no longer in this room');
		return m;
	}

	private you(room: Room, s: Session): You {
		return { role: s.role, id: s.id, vip: s.role === 'player' && s.id === room.vipId };
	}

	private view(room: Room): RoomView {
		return {
			code: room.code,
			mode: room.mode,
			phase: room.phase,
			gameId: room.game?.gameId ?? null,
			players: room.players.map((p) => ({
				id: p.id,
				name: p.name,
				avatar: p.avatar,
				connected: p.connected,
				vip: p.id === room.vipId
			})),
			audienceCount: room.audience.length,
			hostConnected: !!room.host?.connected,
			settings: room.settings
		};
	}

	private changed(room: Room) {
		this.revision++;
		if (this.rooms.has(room.code)) this.events.roomChanged(room.code, this.view(room));
	}

	private mustGet(code: string): Room {
		const room = this.rooms.get(code.toUpperCase());
		if (!room) throw new ApiError('room_not_found', 'No room with that code');
		return room;
	}

	private mustSession(session: string): Session {
		const s = this.sessions.get(session);
		if (!s || !this.rooms.has(s.code)) throw new ApiError('session_invalid', 'Session expired');
		return s;
	}

	private newCode(): string {
		for (let attempt = 0; attempt < 100; attempt++) {
			let code = '';
			for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
				code += ROOM_CODE_ALPHABET[Math.floor(this.random() * ROOM_CODE_ALPHABET.length)];
			}
			if (!this.rooms.has(code)) return code;
		}
		throw new Error('Could not allocate a room code');
	}
}
