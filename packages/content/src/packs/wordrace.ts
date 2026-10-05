import * as v from 'valibot';
import type { PromptPack } from '../types.ts';
import wordRaceWords from '../words/answers.json';

/** Word Race answers: common five-letter words. Guesses are checked with `@games/content/dictionary`. */
export const wordRacePack: PromptPack = v.parse(
	v.object({
		id: v.string(),
		title: v.string(),
		items: v.pipe(v.array(v.pipe(v.string(), v.regex(/^[a-z]{5}$/))), v.minLength(10))
	}),
	{ id: wordRaceWords.id, title: wordRaceWords.title, items: wordRaceWords.words }
);
