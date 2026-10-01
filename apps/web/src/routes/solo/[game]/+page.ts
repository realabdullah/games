import { error } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import type { EntryGenerator, PageLoad } from './$types';

const soloGames = catalog.filter((g) => g.status === 'live' && g.modes.includes('solo'));

/** Prerender a page for every game that can be played alone. */
export const entries: EntryGenerator = () => soloGames.map((g) => ({ game: g.id }));

export const load: PageLoad = ({ params }) => {
	const game = soloGames.find((g) => g.id === params.game);
	if (!game) error(404, 'That game can’t be played solo');
	return { game };
};
