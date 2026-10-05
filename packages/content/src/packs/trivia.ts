import * as v from 'valibot';
import { TriviaPack } from '../trivia/schema.ts';
import general from '../trivia/general.json';
import geography from '../trivia/geography.json';
import science from '../trivia/science.json';

/** Curated packs, validated at load so a typo in JSON fails fast. */
export const triviaPacks: TriviaPack[] = [general, science, geography].map((p) =>
	v.parse(TriviaPack, p)
);

export function findTriviaPack(id: string): TriviaPack | undefined {
	return triviaPacks.find((p) => p.id === id);
}
