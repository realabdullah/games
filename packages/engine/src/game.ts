import type { Rng } from './rng.ts';

export type GameMode = 'party' | 'online' | 'solo';
export type GameTag = 'bonding' | 'creative' | 'learning' | 'fun';

export interface GameMeta {
	id: string;
	name: string;
	tagline: string;
	tags: GameTag[];
	modes: GameMode[];
	players: { min: number; max: number };
	/** Whether audience members (beyond max players) can take part, e.g. by voting. */
	audience: boolean;
	/** Typical length of one game, in minutes. */
	durationMin: number;
}

export interface GamePlayer {
	id: string;
	name: string;
	avatar: string;
}

/** Who a view is being projected for. */
export type Viewer =
	| { kind: 'host' }
	| { kind: 'player'; playerId: string }
	| { kind: 'audience'; audienceId: string };

/** Who sent an action. The runner fills this in, so clients can't claim to be someone else. */
export type Actor =
	| { kind: 'host' }
	| { kind: 'player'; playerId: string; vip: boolean }
	| { kind: 'audience'; audienceId: string }
	| { kind: 'system' };

/** The party host screen, or the VIP in online and solo play, runs the game. */
export function isController(actor: Actor): boolean {
	return actor.kind === 'host' || (actor.kind === 'player' && actor.vip);
}

/**
 * Actions the runner sends on its own, with actor `system`:
 * - `tick`: time has passed; check deadlines from `nextDeadline`.
 * - `roster`: players left or were kicked; `ctx.active` has the new list.
 */
export type SystemAction = { type: 'tick' } | { type: 'roster' };

export interface GameContext {
	rng: Rng;
	/** Server time in ms. Passed in rather than read from the clock so reduce stays pure. */
	now: number;
	/** Ids of players still in the room (disconnected players count; they may be back). */
	active: readonly string[];
}

export interface SetupInput<Config, Content> {
	config: Config;
	players: GamePlayer[];
	content: Content;
	mode: GameMode;
}

/**
 * A game is a pure state machine. The server (or the browser, in solo mode)
 * owns the state, feeds actions through `reduce`, and sends each viewer only
 * what `view` returns for them. That way secrets (answers, other players'
 * drawings before reveal) never leave the server.
 */
export interface GameDefinition<
	State,
	Action,
	Config = unknown,
	Content = unknown,
	View = unknown
> {
	meta: GameMeta;
	defaultConfig: Config;
	setup(input: SetupInput<Config, Content>, ctx: GameContext): State;
	reduce(state: State, action: Action | SystemAction, actor: Actor, ctx: GameContext): State;
	view(state: State, viewer: Viewer): View;
	/** Validate an action from a client. Return null to reject it. */
	parseAction(raw: unknown): Action | null;
	/** The next time something should happen on its own; the runner sends a `tick` then. */
	nextDeadline(state: State): number | null;
	isOver(state: State): boolean;
	/**
	 * Bump when the state's shape changes in a way old snapshots can't load.
	 * Restored games with a different version are dropped (room returns to
	 * the lobby) instead of crashing. Defaults to 1.
	 */
	stateVersion?: number;
	/**
	 * Move every absolute time in the state forward by `ms`. Used after a
	 * restart so the downtime doesn't eat into players' timers.
	 */
	shiftTime?(state: State, ms: number): State;
	/**
	 * Optional high-frequency channel (e.g. drawing strokes). Stream events
	 * update state like actions, but instead of re-sending every viewer's full
	 * view, the runner relays the event itself to the room. `snapshot` is sent
	 * when someone connects, so late joiners and reconnects catch up.
	 */
	stream?: GameStream<State>;
}

export interface GameStream<State> {
	parse(raw: unknown): unknown | null;
	/** Apply an event; return null to reject it (e.g. not the drawer). */
	apply(state: State, event: unknown, actor: Actor, ctx: GameContext): State | null;
	snapshot(state: State): unknown;
}

export type AnyGame = GameDefinition<any, any, any, any, any>;

export function defineGame<State, Action, Config, Content, View>(
	def: GameDefinition<State, Action, Config, Content, View>
): GameDefinition<State, Action, Config, Content, View> {
	return def;
}
