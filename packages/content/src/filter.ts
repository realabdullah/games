import {
	RegExpMatcher,
	TextCensor,
	englishDataset,
	englishRecommendedTransformers
} from 'obscenity';
import type { TriviaPack } from './trivia/schema.ts';

/**
 * The family filter. Built on obscenity's English dataset, which handles
 * leetspeak, repeated letters and spacing tricks, with a whitelist to avoid
 * false positives like "Scunthorpe".
 */
const matcher = new RegExpMatcher({
	...englishDataset.build(),
	...englishRecommendedTransformers
});
const censor = new TextCensor();

export function isProfane(text: string): boolean {
	return matcher.hasMatch(text);
}

/** Replace matched words with grawlix (e.g. "%@$\!"), keeping the rest of the text. */
export function censorText(text: string): string {
	return censor.applyTo(text, matcher.getAllMatches(text));
}

/** Whether any player-visible text in the pack would be blocked by the family filter. */
export function packIsProfane(
	pack: Pick<TriviaPack, 'title' | 'description' | 'questions'>
): boolean {
	const texts = [pack.title, pack.description];
	for (const q of pack.questions) texts.push(q.q, ...q.choices, q.fact ?? '');
	return texts.some(isProfane);
}
