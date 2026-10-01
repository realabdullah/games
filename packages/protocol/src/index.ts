import * as v from 'valibot';
import { TriviaPackDraft } from '@games/content';

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
	/** The game being played, while phase is 'playing'. */
	gameId: string | null;
	players: PlayerInfo[];
	audienceCount: number;
	/** Party mode only: whether the shared host screen is connected. */
	hostConnected: boolean;
	settings: RoomSettings;
}

export interface RoomSettings {
	/** Block profanity in names, packs and (later) free-text answers. On by default. */
	familyFilter: boolean;
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
	| 'not_found'
	| 'rate_limited'
	| 'filtered'
	| 'unavailable';

// ---------- Packs ----------

export const PACK_CODE_LENGTH = 6;
export const PACK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

export const PackCode = v.pipe(
	v.string(),
	v.trim(),
	v.toUpperCase(),
	v.regex(new RegExp(`^[${PACK_CODE_ALPHABET}]{${PACK_CODE_LENGTH}}$`), 'Invalid pack code')
);

/** What anyone with the code can see. Never includes the questions or answers. */
export interface PackSummary {
	code: string;
	game: 'trivia';
	title: string;
	description: string;
	emoji?: string;
	count: number;
	source: 'custom' | 'ai';
	/** Contains words the family filter blocks. */
	flagged: boolean;
}

export const SavePackBody = v.object({ game: v.literal('trivia'), pack: TriviaPackDraft });
export type SavePackBody = v.InferInput<typeof SavePackBody>;

/** Returned once, when a pack is created. The edit token is the only way to change it later. */
export interface CreatedPackResponse {
	summary: PackSummary;
	editToken: string;
}

export interface EditPackResponse {
	summary: PackSummary;
	pack: v.InferOutput<typeof TriviaPackDraft>;
}

export const GeneratePackBody = v.object({
	topic: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(3, 'Describe a topic in a few words'),
		v.maxLength(100, 'Keep the topic under 100 characters')
	),
	count: v.picklist([5, 10, 15]),
	difficulty: v.optional(v.picklist(['easy', 'medium', 'hard']), 'medium')
});
export type GeneratePackBody = v.InferInput<typeof GeneratePackBody>;

export interface AiStatusResponse {
	enabled: boolean;
	/** Generations left today for this client. */
	remaining: number;
}

// ---------- WebSocket ----------

export const ClientMessage = v.variant('type', [
	v.object({ type: v.literal('kick'), playerId: v.string() }),
	v.object({ type: v.literal('leave') }),
	v.object({
		type: v.literal('start'),
		gameId: v.pipe(v.string(), v.maxLength(40)),
		packId: v.optional(v.pipe(v.string(), v.maxLength(80))),
		config: v.optional(v.record(v.string(), v.union([v.number(), v.string(), v.boolean()])))
	}),
	/** A game action; the game validates its shape. */
	v.object({ type: v.literal('action'), action: v.unknown() }),
	/** Leave the current game and go back to the lobby. */
	v.object({ type: v.literal('endGame') }),
	v.object({ type: v.literal('settings'), familyFilter: v.boolean() })
]);
export type ClientMessage = v.InferOutput<typeof ClientMessage>;

/** A game view for one viewer, plus server time so clients can correct for clock skew. */
export interface GameUpdate {
	gameId: string;
	view: unknown;
	now: number;
}

export type ServerMessage =
	| { type: 'welcome'; you: You; room: RoomView; game: GameUpdate | null }
	| ({ type: 'game' } & GameUpdate)
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
