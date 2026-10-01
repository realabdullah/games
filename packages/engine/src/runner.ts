import type { Actor, AnyGame, GameMode, GamePlayer, SystemAction, Viewer } from './game.ts';
import { createRng } from './rng.ts';

/**
 * Everything needed to resume a game: plain data, so it can be snapshotted
 * to SQLite and restored. The RNG is stored as its state and rebuilt per step.
 */
export interface GameSession {
	gameId: string;
	mode: GameMode;
	state: unknown;
	rngState: number;
}

export function startGame(
	game: AnyGame,
	opts: {
		mode: GameMode;
		players: GamePlayer[];
		content: unknown;
		config?: unknown;
		seed: number;
		now: number;
	}
): GameSession {
	const rng = createRng(opts.seed);
	const state = game.setup(
		{
			config: { ...game.defaultConfig, ...(opts.config ?? {}) },
			players: opts.players,
			content: opts.content,
			mode: opts.mode
		},
		{ rng, now: opts.now, active: opts.players.map((p) => p.id) }
	);
	return { gameId: game.meta.id, mode: opts.mode, state, rngState: rng.state };
}

/** Apply one action. Returns true if the state changed. */
export function step(
	game: AnyGame,
	session: GameSession,
	action: unknown,
	actor: Actor,
	ctx: { now: number; active: readonly string[] }
): boolean {
	const rng = createRng(session.rngState);
	const next = game.reduce(session.state, action, actor, { rng, now: ctx.now, active: ctx.active });
	if (next === session.state) return false;
	session.state = next;
	session.rngState = rng.state;
	return true;
}

/** Validate and apply an action from a client. Returns false if it was rejected or did nothing. */
export function stepFromClient(
	game: AnyGame,
	session: GameSession,
	raw: unknown,
	actor: Exclude<Actor, { kind: 'system' }>,
	ctx: { now: number; active: readonly string[] }
): boolean {
	const action = game.parseAction(raw);
	if (!action) return false;
	return step(game, session, action, actor, ctx);
}

/** Send a system action (tick/roster). */
export function stepSystem(
	game: AnyGame,
	session: GameSession,
	action: SystemAction,
	ctx: { now: number; active: readonly string[] }
): boolean {
	return step(game, session, action, { kind: 'system' }, ctx);
}

export function viewFor(game: AnyGame, session: GameSession, viewer: Viewer): unknown {
	return game.view(session.state, viewer);
}
