import allowed from './allowed.json';

let words: Set<string> | null = null;

/**
 * Whether Word Race accepts this five-letter guess. Kept out of the main
 * content entry so the ~80 KB list only loads where guesses are checked.
 */
export function isWord(word: string): boolean {
	words ??= new Set(allowed.words.match(/.{5}/g));
	return words.has(word.toLowerCase());
}
