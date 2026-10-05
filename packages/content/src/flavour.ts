/** Where content is from: written for Nigerian players, or for anyone. */
export type Flavour = 'naija' | 'global';

/** The lobby's "Content" setting. Naija is the default. */
export const FLAVOUR = { naija: 1, mix: 2, global: 3 } as const;

export function flavoursFor(setting: number | undefined): Flavour[] {
	if (setting === FLAVOUR.global) return ['global'];
	if (setting === FLAVOUR.mix) return ['naija', 'global'];
	return ['naija'];
}

/** The items for a setting, from packs kept per flavour. */
export function flavourItems<T>(
	packs: Record<Flavour, { items: T[] }>,
	setting: number | undefined
): T[] {
	return flavoursFor(setting).flatMap((f) => packs[f].items);
}
