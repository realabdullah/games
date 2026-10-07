import { anagram } from '@games/anagram';
import { clock } from '@games/clock';
import { doodle } from '@games/doodle';
import { emoji } from '@games/emoji';
import { findIt } from '@games/findit';
import type { GameMeta, GameMode, GameTag } from '@games/engine';
import { hangman } from '@games/hangman';
import { icebreakers } from '@games/icebreakers';
import { maths } from '@games/maths';
import { memory } from '@games/memory';
import { trivia } from '@games/trivia';
import { wit } from '@games/wit';
import { wordRace } from '@games/wordrace';
import { xo } from '@games/xo';

export type Dye = 'indigo' | 'madder' | 'kola' | 'forest' | 'plum' | 'lagoon';

/** Catalog entries: each game's own `meta`, plus its card art. */
export interface CatalogEntry {
	id: string;
	name: string;
	tagline: string;
	tags: GameTag[];
	modes: GameMode[];
	players: { min: number; max: number };
	/** Card art: one of the avatar motifs. */
	motif: string;
	/** The cloth colour while this game is on screen. */
	dye: Dye;
	status: 'live' | 'soon';
}

const live = (meta: GameMeta, art: Pick<CatalogEntry, 'motif' | 'dye'>): CatalogEntry => ({
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
	live(trivia.meta, { motif: 'target', dye: 'indigo' }),
	live(icebreakers.meta, { motif: 'dots', dye: 'lagoon' }),
	live(wit.meta, { motif: 'sun', dye: 'madder' }),
	live(doodle.meta, { motif: 'zigzag', dye: 'kola' }),
	live(xo.meta, { motif: 'checks', dye: 'forest' }),
	live(wordRace.meta, { motif: 'grid', dye: 'forest' }),
	live(hangman.meta, { motif: 'ladder', dye: 'plum' }),
	live(emoji.meta, { motif: 'moon', dye: 'madder' }),
	live(maths.meta, { motif: 'crosses', dye: 'lagoon' }),
	live(clock.meta, { motif: 'quarters', dye: 'kola' }),
	live(findIt.meta, { motif: 'seeds', dye: 'plum' }),
	live(anagram.meta, { motif: 'scales', dye: 'indigo' }),
	live(memory.meta, { motif: 'diamonds', dye: 'lagoon' })
];

const dyes = new Map<string, Dye>(catalog.map((g) => [g.id, g.dye]));

/** Dye the page's cloth for a game, or back to indigo with no game. */
export function dyeFor(gameId: string | null | undefined): Dye {
	return (gameId && dyes.get(gameId)) || 'indigo';
}
