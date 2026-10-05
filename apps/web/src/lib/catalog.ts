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
	live(doodle.meta, { emoji: '🎨', color: 'var(--violet)' }),
	live(xo.meta, { emoji: '⭕', color: 'var(--teal)' }),
	live(wordRace.meta, { emoji: '🟩', color: 'var(--yellow)' }),
	live(hangman.meta, { emoji: '🪢', color: 'var(--violet)' }),
	live(emoji.meta, { emoji: '🤔', color: 'var(--pink)' }),
	live(maths.meta, { emoji: '🧮', color: 'var(--teal)' }),
	live(clock.meta, { emoji: '⏱️', color: 'var(--yellow)' }),
	live(findIt.meta, { emoji: '🔍', color: 'var(--violet)' }),
	live(anagram.meta, { emoji: '🔤', color: 'var(--pink)' }),
	live(memory.meta, { emoji: '🧩', color: 'var(--teal)' })
];
