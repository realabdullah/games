import type { GameMode, GameTag } from '@games/engine';

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

export const catalog: CatalogEntry[] = [
	{
		id: 'trivia',
		name: 'Trivia Rush',
		tagline: 'Fast questions, faster fingers. Points for speed.',
		tags: ['learning', 'fun'],
		modes: ['party', 'online', 'solo'],
		players: { min: 1, max: 12 },
		emoji: '🧠',
		color: 'var(--yellow)',
		status: 'soon'
	},
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
