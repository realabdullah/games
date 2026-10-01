/** What the lobby sends to start (or restart) a game. */
export interface StartRequest {
	gameId: string;
	packId?: string;
	config?: Record<string, number>;
}
