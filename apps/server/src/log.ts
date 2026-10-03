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

export type RoomLogger = (e: RoomEvent) => void;

export const stdoutLogger: RoomLogger = (e) => {
	console.log(JSON.stringify({ t: new Date().toISOString(), ...e }));
};
