import * as v from 'valibot';
import { TriviaPack } from './trivia/schema.ts';
import general from './trivia/general.json';
import science from './trivia/science.json';
import geography from './trivia/geography.json';

export * from './trivia/schema.ts';
import icebreakerPrompts from './prompts/icebreakers.json';
import witPrompts from './prompts/wit.json';
import doodleWords from './prompts/doodle.json';
import emojiPuzzles from './prompts/emoji.json';
import wordRaceWords from './words/answers.json';
import hangmanWords from './words/hangman.json';

/** Curated packs, validated at load so a typo in JSON fails fast. */
export const triviaPacks: TriviaPack[] = [general, science, geography].map((p) =>
	v.parse(TriviaPack, p)
);

export interface PackSummary {
	id: string;
	title: string;
	description: string;
	emoji?: string;
	count: number;
}

export function summarize(pack: TriviaPack): PackSummary {
	return {
		id: pack.id,
		title: pack.title,
		description: pack.description,
		emoji: pack.emoji,
		count: pack.questions.length
	};
}

export function findTriviaPack(id: string): TriviaPack | undefined {
	return triviaPacks.find((p) => p.id === id);
}
export * from './filter.ts';

/** A list of prompts (icebreakers, Quick Wit) or words (Doodle Dash). */
export interface PromptPack {
	id: string;
	title: string;
	items: string[];
}

const PromptPackSchema = v.object({
	id: v.string(),
	title: v.string(),
	items: v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
		v.minLength(10)
	)
});

const toPromptPack = (raw: { id: string; title: string; prompts?: string[]; words?: string[] }) =>
	v.parse(PromptPackSchema, {
		id: raw.id,
		title: raw.title,
		items: raw.prompts ?? raw.words ?? []
	});

export const icebreakerPack: PromptPack = toPromptPack(icebreakerPrompts);
export const witPack: PromptPack = toPromptPack(witPrompts);
export const doodlePack: PromptPack = toPromptPack(doodleWords);

/** Word Race answers: common five-letter words. Guesses are checked with `@games/content/dictionary`. */
export const wordRacePack: PromptPack = v.parse(
	v.object({
		id: v.string(),
		title: v.string(),
		items: v.pipe(v.array(v.pipe(v.string(), v.regex(/^[a-z]{5}$/))), v.minLength(10))
	}),
	{ id: wordRaceWords.id, title: wordRaceWords.title, items: wordRaceWords.words }
);

/** A Hangman word or short phrase (letters and single spaces), with a category as the clue. */
export interface HangmanWord {
	word: string;
	category: string;
}

export interface HangmanPack {
	id: string;
	title: string;
	items: HangmanWord[];
}

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

/** An emoji riddle: the emojis spell out the answer. `also` lists other accepted answers. */
export interface EmojiPuzzle {
	emoji: string;
	answer: string;
	category: string;
	also?: string[];
}

export interface EmojiPack {
	id: string;
	title: string;
	items: EmojiPuzzle[];
}

const answerText = v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(60));

export const emojiPack: EmojiPack = v.parse(
	v.object({
		id: v.string(),
		title: v.string(),
		items: v.pipe(
			v.array(
				v.object({
					emoji: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
					answer: answerText,
					category: v.pipe(v.string(), v.minLength(1), v.maxLength(30)),
					also: v.optional(v.array(answerText))
				})
			),
			v.minLength(10)
		)
	}),
	emojiPuzzles
);
