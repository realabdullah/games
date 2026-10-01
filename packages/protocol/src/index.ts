import * as v from 'valibot';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O
export const ROOM_CODE_LENGTH = 4;
export const MAX_ROOM_PLAYERS = 12;
export const AVATARS = [
	'🦊',
	'🐸',
	'🐙',
	'🦄',
	'🐼',
	'🦁',
	'🐧',
	'🐝',
	'🦖',
	'🐳',
	'🦉',
	'🐢',
	'🦩',
	'🐨',
	'🦔',
	'🐞'
] as const;

// ---------- shared shapes ----------

export const RoomCode = v.pipe(
	v.string(),
	v.trim(),
	v.toUpperCase(),
	v.regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`), 'Invalid room code')
);

export const PlayerName = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, 'Enter a name'),
	v.maxLength(16, 'Names can be 16 characters at most')
);

export const Avatar = v.picklist(AVATARS);

export const RoomMode = v.picklist(['party', 'online']);
export type RoomMode = v.InferOutput<typeof RoomMode>;

export type Role = 'host' | 'player' | 'audience';

export interface PlayerInfo {
	id: string;
	name: string;
	avatar: string;
	connected: boolean;
	vip: boolean;
}

/** What every client sees about the room itself (same for everyone). */
export interface RoomView {
	code: string;
	mode: RoomMode;
	phase: 'lobby' | 'playing';
	players: PlayerInfo[];
	audienceCount: number;
	/** Party mode only: whether the shared host screen is connected. */
	hostConnected: boolean;
}

export interface You {
	role: Role;
	/** Player or audience id; null for the party host screen. */
	id: string | null;
	vip: boolean;
}

// ---------- HTTP ----------

export const CreateRoomBody = v.variant('mode', [
	v.object({ mode: v.literal('party') }),
	v.object({ mode: v.literal('online'), name: PlayerName, avatar: Avatar })
]);
export type CreateRoomBody = v.InferInput<typeof CreateRoomBody>;

export const JoinRoomBody = v.object({ name: PlayerName, avatar: Avatar });
export type JoinRoomBody = v.InferInput<typeof JoinRoomBody>;

export interface SessionResponse {
	code: string;
	session: string;
	you: You;
}

export interface RoomInfoResponse {
	code: string;
	mode: RoomMode;
	phase: RoomView['phase'];
	playerCount: number;
	full: boolean;
}

export interface ErrorResponse {
	error: { code: ErrorCode; message: string };
}

export type ErrorCode =
	| 'bad_request'
	| 'room_not_found'
	| 'session_invalid'
	| 'name_taken'
	| 'forbidden'
	| 'rate_limited';

// ---------- WebSocket ----------

export const ClientMessage = v.variant('type', [
	v.object({ type: v.literal('kick'), playerId: v.string() }),
	v.object({ type: v.literal('leave') })
]);
export type ClientMessage = v.InferOutput<typeof ClientMessage>;

export type ServerMessage =
	| { type: 'welcome'; you: You; room: RoomView }
	| { type: 'room'; room: RoomView }
	| { type: 'you'; you: You }
	| { type: 'kicked' }
	| { type: 'closed'; reason: 'expired' | 'left' }
	| { type: 'error'; code: ErrorCode; message: string };

/** WebSocket close codes the client acts on (4000–4999 are app-defined). */
export const CloseCode = {
	SessionInvalid: 4001,
	Kicked: 4002,
	Replaced: 4003,
	RoomClosed: 4004
} as const;

export function parseClientMessage(raw: string): ClientMessage | null {
	try {
		const result = v.safeParse(ClientMessage, JSON.parse(raw));
		return result.success ? result.output : null;
	} catch {
		return null;
	}
}

export { v };
