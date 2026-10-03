/**
 * One JSON line per room event on stdout, so an incident can be replayed by
 * filtering on the room code. Never log names, session tokens or game
 * content: ids and counts are enough to reconstruct what happened.
 */
export type RoomEvent =
	| { event: 'room_created'; room: string; mode: string }
	| {
			event: 'joined';
			room: string;
			player: string;
			role: 'player' | 'audience';
			/** The game running when they joined, if any. */
			midGame: string | null;
			/** Mid-game only: whether the game let them play now. */
			admitted?: boolean;
	  }
	| { event: 'left'; room: string; player: string; reason: 'kicked' | 'left' }
	| { event: 'connected' | 'disconnected'; room: string; player: string | null }
	| { event: 'replaced'; room: string; player: string | null }
	| { event: 'game_started'; room: string; game: string; players: number }
	| { event: 'game_finished' | 'game_ended'; room: string; game: string }
	| {
			event: 'action_ignored';
			room: string;
			player: string | null;
			game: string;
			action: string;
			/** Further ignored actions from this member since the last line. */
			suppressed: number;
	  }
	| { event: 'room_closed'; room: string; reason: 'left' | 'expired' };

export type ServerEvent =
	RoomEvent | { event: 'server_error'; where: 'http' | 'ws' | 'snapshot'; message: string };

export type RoomLogger = (e: RoomEvent) => void;
export type ServerLogger = (e: ServerEvent) => void;

/** An error as one short line: the message and the top of the stack, no request data. */
export function errorMessage(err: unknown): string {
	const text = err instanceof Error ? (err.stack ?? err.message) : String(err);
	return text.split('\n').slice(0, 4).join(' | ').slice(0, 500);
}

/** Log each event as a JSON line through `write` (stdout by default). */
export function jsonLogger(write: (line: string) => void = console.log): ServerLogger {
	return (e) => write(JSON.stringify({ t: new Date().toISOString(), ...e }));
}
