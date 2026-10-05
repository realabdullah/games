import type { PackSummary } from '../types.ts';

/**
 * The curated trivia packs, without their questions, for the lobby's pack
 * list. Kept apart so the home page doesn't download every question; a test
 * checks it against the packs.
 */
export const triviaPackSummaries: PackSummary[] = [
	{
		id: 'general',
		title: 'General Knowledge',
		description: 'A bit of everything. A good warm-up for any group.',
		emoji: '🌍',
		count: 15
	},
	{
		id: 'science',
		title: 'Science & Nature',
		description: 'Atoms, animals and the odd fact about space.',
		emoji: '🔬',
		count: 12
	},
	{
		id: 'geography',
		title: 'Around the World',
		description: 'Capitals, rivers and where on Earth things are.',
		emoji: '🗺️',
		count: 12
	}
];
