import * as v from 'valibot';
import { TriviaPack } from './trivia/schema.ts';
import general from './trivia/general.json';
import science from './trivia/science.json';
import geography from './trivia/geography.json';

export * from './trivia/schema.ts';
import icebreakerPrompts from './prompts/icebreakers.json';
import witPrompts from './prompts/wit.json';
import doodleWords from './prompts/doodle.json';

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
