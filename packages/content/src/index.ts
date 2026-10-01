import * as v from 'valibot';
import { TriviaPack } from './trivia/schema.ts';
import general from './trivia/general.json';
import science from './trivia/science.json';
import geography from './trivia/geography.json';

export * from './trivia/schema.ts';

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
