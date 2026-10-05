import type { TriviaPack } from './trivia/schema.ts';

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

/** A list of prompts (icebreakers, Quick Wit) or words (Doodle Dash). */
export interface PromptPack {
	id: string;
	title: string;
	items: string[];
}

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

/** An anagram answer, with a category as the clue where there is one. */
export interface AnagramWord {
	word: string;
	category: string | null;
}
