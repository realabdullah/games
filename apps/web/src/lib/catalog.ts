import type { GameMeta, GameMode, GameTag } from '@games/engine';
import { trivia } from '@games/trivia';

/**
 * Catalog entries. Once a game package exists, its entry comes from its
 * `meta`; until then, upcoming games are listed so the catalog isn't empty.
 */
export interface CatalogEntry {
	id: string;
	name: string;
	tagline: string;
	tags: GameTag[];
	modes: GameMode[];
	players: { min: number; max: number };
	emoji: string;
	color: string;
	status: 'live' | 'soon';
}

const live = (meta: GameMeta, art: Pick<CatalogEntry, 'emoji' | 'color'>): CatalogEntry => ({
	id: meta.id,
	name: meta.name,
	tagline: meta.tagline,
	tags: meta.tags,
	modes: meta.modes,
	players: meta.players,
	...art,
	status: 'live'
});

export const catalog: CatalogEntry[] = [
	live(trivia.meta, { emoji: '🧠', color: 'var(--yellow)' }),
	{
		id: 'icebreakers',
		name: 'Who Said It?',
		tagline: 'Answer about yourself, then guess who wrote what.',
		tags: ['bonding'],
		modes: ['party', 'online'],
		players: { min: 3, max: 12 },
		emoji: '🧊',
		color: 'var(--teal)',
		status: 'soon'
	},
	{
		id: 'wit',
		name: 'Quick Wit',
		tagline: 'Write the funniest answer. The room votes.',
		tags: ['creative', 'fun'],
		modes: ['party', 'online'],
		players: { min: 3, max: 10 },
		emoji: '✍️',
		color: 'var(--pink)',
		status: 'soon'
	},
	{
		id: 'drawing',
		name: 'Doodle Dash',
		tagline: 'Draw it on your phone. Everyone guesses.',
		tags: ['creative', 'fun'],
		modes: ['party', 'online', 'solo'],
		players: { min: 3, max: 10 },
		emoji: '🎨',
		color: 'var(--violet)',
		status: 'soon'
	}
];
