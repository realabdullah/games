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

/** Who sent an action. The server fills this in — clients can't claim to be someone else. */
export type Actor =
	| { kind: 'host' }
	| { kind: 'player'; playerId: string; vip: boolean }
	| { kind: 'audience'; audienceId: string }
	| { kind: 'system' };

export interface GameContext {
	rng: Rng;
	/** Server time in ms. Pass it in rather than reading the clock so reduce stays pure. */
	now: number;
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
 * what `view` returns for them — so secrets (answers, other players' drawings
 * before reveal) never leave the server.
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
	reduce(state: State, action: Action, actor: Actor, ctx: GameContext): State;
	view(state: State, viewer: Viewer): View;
	/**
	 * When the state wants a timed transition (e.g. the answer window closes),
	 * return the deadline. The runner dispatches a `tick` with actor `system`
	 * at that time. Return null when nothing is pending.
	 */
	nextDeadline?(state: State): number | null;
	isOver(state: State): boolean;
}

export function defineGame<State, Action, Config, Content, View>(
	def: GameDefinition<State, Action, Config, Content, View>
): GameDefinition<State, Action, Config, Content, View> {
	return def;
}
