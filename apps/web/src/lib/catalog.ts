import { doodle } from '@games/doodle';
import type { GameMeta, GameMode, GameTag } from '@games/engine';
import { icebreakers } from '@games/icebreakers';
import { trivia } from '@games/trivia';
import { wit } from '@games/wit';

/** Catalog entries: each game's own `meta`, plus its card art. */
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
	live(icebreakers.meta, { emoji: '🧊', color: 'var(--teal)' }),
	live(wit.meta, { emoji: '✍️', color: 'var(--pink)' }),
	live(doodle.meta, { emoji: '🎨', color: 'var(--violet)' })
];
