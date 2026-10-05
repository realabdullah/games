import * as v from 'valibot';
import emojiPuzzles from '../prompts/emoji.json';
import type { EmojiPack } from '../types.ts';

const answerText = v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(60));

export const EmojiPuzzleSchema = v.object({
	emoji: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
	answer: answerText,
	category: v.pipe(v.string(), v.minLength(1), v.maxLength(30)),
	also: v.optional(v.array(answerText))
});

const EmojiPackSchema = v.object({
	id: v.string(),
	title: v.string(),
	items: v.pipe(v.array(EmojiPuzzleSchema), v.minLength(10))
});

export const emojiPack: EmojiPack = v.parse(EmojiPackSchema, emojiPuzzles);
