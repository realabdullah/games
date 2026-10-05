import * as v from 'valibot';
import type { PromptPack } from '../types.ts';

const PromptPackSchema = v.object({
	id: v.string(),
	title: v.string(),
	items: v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
		v.minLength(10)
	)
});

/** Prompt files list `prompts` or `words`; validated at load so a typo in JSON fails fast. */
export const toPromptPack = (raw: {
	id: string;
	title: string;
	prompts?: string[];
	words?: string[];
}): PromptPack =>
	v.parse(PromptPackSchema, {
		id: raw.id,
		title: raw.title,
		items: raw.prompts ?? raw.words ?? []
	});
