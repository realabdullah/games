import {
	CloseCode,
	type ClientMessage,
	type RoomView,
	type ServerMessage,
	type You
} from '@games/protocol';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'ended';
export type EndReason = 'kicked' | 'closed' | 'invalid' | 'replaced';

const MAX_BACKOFF_MS = 5_000;

/**
 * A live connection to one room. Reconnects on its own (network blips, locked
 * phones, server restarts) until the server says the session is over.
 */
export class RoomConnection {
	status = $state<ConnectionStatus>('connecting');
	ended = $state<EndReason | null>(null);
	room = $state<RoomView | null>(null);
	you = $state<You | null>(null);
	error = $state<string | null>(null);

	#ws: WebSocket | null = null;
	#attempt = 0;
	#retryTimer: ReturnType<typeof setTimeout> | undefined;
	#stopped = false;

	constructor(private session: string) {
		this.#connect();
		document.addEventListener('visibilitychange', this.#onVisible);
		window.addEventListener('online', this.#onVisible);
	}

	send(msg: ClientMessage) {
		if (this.#ws?.readyState === WebSocket.OPEN) this.#ws.send(JSON.stringify(msg));
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
					break;
				case 'room':
					this.room = msg.room;
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
