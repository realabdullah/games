import {
	startGame,
	stepFromClient,
	stepSystem,
	viewFor,
	type AnyGame,
	type GamePlayer,
	type GameSession
} from '@games/engine';

/**
 * Runs a game in the browser for solo play: the same pure game logic the
 * server uses, with local timers instead of the server's ticker.
 */
export class LocalGame<View> {
	view = $state<View | null>(null);

	#session: GameSession;
	#timer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private game: AnyGame,
		private player: GamePlayer,
		opts: { content: unknown; config?: unknown }
	) {
		this.#session = startGame(game, {
			mode: 'solo',
			players: [player],
			content: opts.content,
			config: opts.config,
			seed: Math.floor(Math.random() * 2 ** 32),
			now: Date.now()
		});
		this.#update();
	}

	send(action: unknown) {
		const changed = stepFromClient(
			this.game,
			this.#session,
			action,
			{ kind: 'player', playerId: this.player.id, vip: true },
			{ now: Date.now(), active: [this.player.id] }
		);
		if (changed) this.#update();
	}

	destroy() {
		clearTimeout(this.#timer);
	}

	#update() {
		this.view = viewFor(this.game, this.#session, {
			kind: 'player',
			playerId: this.player.id
		}) as View;
		clearTimeout(this.#timer);
		const deadline = this.game.nextDeadline(this.#session.state);
		if (deadline === null) return;
		this.#timer = setTimeout(
			() => {
				const now = Math.max(Date.now(), deadline);
				if (
					stepSystem(this.game, this.#session, { type: 'tick' }, { now, active: [this.player.id] })
				) {
					this.#update();
				}
			},
			Math.max(0, deadline - Date.now())
		);
	}
}
