import {
	CloseCode,
	type ClientMessage,
	type GameUpdate,
	type RoomView,
	type ServerMessage,
	type You
} from '@games/protocol';
import type { GameStream } from './games/types';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'ended';
export type EndReason = 'kicked' | 'closed' | 'invalid' | 'replaced';

const MAX_BACKOFF_MS = 5_000;
/** Messages sent while reconnecting are held this long, then dropped as stale. */
const QUEUE_TTL_MS = 5_000;

/**
 * A live connection to one room. Reconnects on its own (network blips, locked
 * phones, server restarts) until the server says the session is over.
 */
export class RoomConnection {
	status = $state<ConnectionStatus>('connecting');
	ended = $state<EndReason | null>(null);
	room = $state<RoomView | null>(null);
	you = $state<You | null>(null);
	game = $state<GameUpdate | null>(null);
	error = $state<string | null>(null);
	/** Server clock minus local clock, so countdowns match the server's deadlines. */
	clockOffset = $state(0);

	#ws: WebSocket | null = null;
	#attempt = 0;
	#retryTimer: ReturnType<typeof setTimeout> | undefined;
	#stopped = false;
	#errorTimer: ReturnType<typeof setTimeout> | undefined;
	#queue: { msg: ClientMessage; at: number }[] = [];
	#streamListeners = new Set<(from: string | null, event: unknown) => void>();
	/** Catch-up for the game's stream channel, from the latest welcome. */
	streamSnapshot: unknown = null;

	constructor(private session: string) {
		this.#connect();
		document.addEventListener('visibilitychange', this.#onVisible);
		window.addEventListener('online', this.#onVisible);
	}

	/**
	 * Send now if connected; otherwise hold it briefly so a tap during a
	 * reconnect (e.g. right after a server restart) isn't silently lost.
	 */
	send(msg: ClientMessage) {
		if (this.status === 'open' && this.#ws?.readyState === WebSocket.OPEN) {
			this.#ws.send(JSON.stringify(msg));
		} else if (!this.#stopped) {
			this.#queue.push({ msg, at: Date.now() });
		}
	}

	#flush() {
		const fresh = this.#queue.filter((q) => Date.now() - q.at < QUEUE_TTL_MS);
		this.#queue = [];
		for (const { msg } of fresh) this.#ws?.send(JSON.stringify(msg));
	}

	/** This connection as a game stream (drawing strokes) for game screens. */
	get stream(): GameStream {
		return {
			snapshot: this.streamSnapshot,
			send: (event) => this.send({ type: 'stream', event }),
			subscribe: (fn) => this.onStream(fn)
		};
	}

	/** Listen for stream events (e.g. drawing strokes). Returns an unsubscribe function. */
	onStream(fn: (from: string | null, event: unknown) => void): () => void {
		this.#streamListeners.add(fn);
		return () => this.#streamListeners.delete(fn);
	}

	destroy() {
		this.#stopped = true;
		clearTimeout(this.#retryTimer);
		document.removeEventListener('visibilitychange', this.#onVisible);
		window.removeEventListener('online', this.#onVisible);
		this.#ws?.close(1000);
	}

	#connect() {
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		const ws = new WebSocket(
			`${proto}://${location.host}/ws?session=${encodeURIComponent(this.session)}`
		);
		this.#ws = ws;

		ws.onmessage = (e) => {
			const msg = JSON.parse(e.data as string) as ServerMessage;
			switch (msg.type) {
				case 'welcome':
					this.#attempt = 0;
					this.status = 'open';
					this.you = msg.you;
					this.room = msg.room;
					this.streamSnapshot = msg.game?.stream ?? null;
					this.#setGame(msg.game);
					this.#flush();
					break;
				case 'room':
					this.room = msg.room;
					if (!msg.room.gameId) this.game = null;
					break;
				case 'game':
					this.#setGame(msg);
					break;
				case 'stream':
					for (const fn of this.#streamListeners) fn(msg.from, msg.event);
					break;
				case 'you':
					this.you = msg.you;
					break;
				case 'kicked':
					this.#end('kicked');
					break;
				case 'closed':
					this.#end('closed');
					break;
				case 'error':
					this.error = msg.message;
					clearTimeout(this.#errorTimer);
					this.#errorTimer = setTimeout(() => (this.error = null), 5_000);
					break;
			}
		};

		ws.onclose = (e) => {
			if (ws !== this.#ws || this.#stopped) return;
			const reason = endReasonFor(e.code);
			if (reason) return this.#end(reason);
			this.status = 'reconnecting';
			this.#scheduleRetry();
		};
	}

	#setGame(update: GameUpdate | null) {
		this.game = update && { gameId: update.gameId, view: update.view, now: update.now };
		if (update) this.clockOffset = update.now - Date.now();
	}

	#scheduleRetry() {
		clearTimeout(this.#retryTimer);
		const delay = Math.min(MAX_BACKOFF_MS, 400 * 2 ** this.#attempt++) * (0.75 + Math.random() / 2);
		this.#retryTimer = setTimeout(() => this.#connect(), delay);
	}

	#end(reason: EndReason) {
		if (this.#stopped) return;
		this.ended = reason;
		this.status = 'ended';
		this.destroy();
	}

	/** Phones suspend sockets in the background; reconnect right away when we're back. */
	#onVisible = () => {
		if (document.visibilityState !== 'visible' || this.#stopped) return;
		if (this.#ws?.readyState === WebSocket.CLOSED || this.#ws?.readyState === WebSocket.CLOSING) {
			this.#attempt = 0;
			clearTimeout(this.#retryTimer);
			this.#connect();
		}
	};
}

function endReasonFor(code: number): EndReason | null {
	switch (code) {
		case CloseCode.Kicked:
			return 'kicked';
		case CloseCode.RoomClosed:
			return 'closed';
		case CloseCode.SessionInvalid:
			return 'invalid';
		case CloseCode.Replaced:
			return 'replaced';
		default:
			return null;
	}
}
