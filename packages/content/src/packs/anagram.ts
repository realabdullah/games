import type { AnagramWord } from '../types.ts';
import { hangmanPack } from './hangman.ts';
import { wordRacePack } from './wordrace.ts';

/** Five-letter Word Race words, plus the single words from Hangman. */
export const anagramPack: { id: string; title: string; items: AnagramWord[] } = {
	id: 'anagrams',
	title: 'Everyday words',
	items: [
		...wordRacePack.items.map((word) => ({ word, category: null })),
		...hangmanPack.items.filter((w) => !w.word.includes(' ') && w.word.length > 5)
	]
};
