import type { Component } from 'svelte';

/** What the lobby sends to start (or restart) a game. */
export interface StartRequest {
	gameId: string;
	packId?: string;
	config?: Record<string, number>;
}

/** A live channel for high-frequency game events (drawing strokes). */
export interface GameStream {
	/** Catch-up state sent on connect, e.g. strokes drawn so far. */
	snapshot: unknown;
	send(event: unknown): void;
	subscribe(fn: (from: string | null, event: unknown) => void): () => void;
}

interface CommonProps {
	clockOffset: number;
	onaction: (action: unknown) => void;
	onplayagain: () => void;
	onendgame: () => void;
	stream: GameStream;
}

/** The shared big screen (party mode). */
export interface HostViewProps extends CommonProps {
	view: unknown;
}

/** A player's own screen: phone in party mode, or their screen online. */
export interface PlayerViewProps extends CommonProps {
	view: unknown;
	youId: string | null;
	audience: boolean;
	/** Online VIP: runs the game from their own screen. */
	canControl: boolean;
}

export interface GameUi {
	Host: Component<HostViewProps>;
	Player: Component<PlayerViewProps>;
	/** Extra lobby settings (trivia's pack choice is handled separately). */
	settings: { key: string; label: string; options: number[]; default: number }[];
}
