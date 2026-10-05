import * as v from 'valibot';
import type { HangmanPack } from '../types.ts';
import hangmanWords from '../words/hangman.json';

export const hangmanPack: HangmanPack = v.parse(
	v.object({
		id: v.string(),
		title: v.string(),
		items: v.pipe(
			v.array(
				v.object({
					word: v.pipe(v.string(), v.regex(/^[a-z]+( [a-z]+)*$/), v.maxLength(24)),
					category: v.pipe(v.string(), v.minLength(1), v.maxLength(30))
				})
			),
			v.minLength(10)
		)
	}),
	hangmanWords
);
