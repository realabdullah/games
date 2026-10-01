import type { GamePlayer } from './game.ts';

export interface LeaderboardEntry {
	id: string;
	name: string;
	avatar: string;
	score: number;
	/** Points from the latest round, for "+250" animations. */
	delta: number;
	rank: number;
}

/** Players sorted by score, ties sharing a rank (1, 1, 3). */
export function rankPlayers(
	players: readonly GamePlayer[],
	scores: Readonly<Record<string, number>>,
	deltas: Readonly<Record<string, number>> = {}
): LeaderboardEntry[] {
	const sorted = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
	let rank = 0;
	let prev = Number.NaN;
	return sorted.map((p, i) => {
		const score = scores[p.id] ?? 0;
		if (score !== prev) rank = i + 1;
		prev = score;
		return { id: p.id, name: p.name, avatar: p.avatar, score, delta: deltas[p.id] ?? 0, rank };
	});
}

/** Add points to a score table, returning a new table. */
export function addPoints(
	scores: Readonly<Record<string, number>>,
	points: Readonly<Record<string, number>>
): Record<string, number> {
	const next = { ...scores };
	for (const [id, n] of Object.entries(points)) next[id] = (next[id] ?? 0) + n;
	return next;
}
