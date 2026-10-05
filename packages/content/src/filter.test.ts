import { expect, test } from 'bun:test';
import { censorText, isProfane, packIsProfane } from './filter.ts';
import {
	doodlePack,
	emojiPack,
	hangmanPack,
	icebreakerPack,
	triviaPacks,
	witPack,
	wordRacePack
} from './packs/index.ts';
import { isWord } from './words/dictionary.ts';

test('catches profanity, including obfuscated spellings', () => {
	expect(isProfane('what the fuck')).toBe(true);
	expect(isProfane('sh1t happens')).toBe(true);
});

test('leaves ordinary words alone', () => {
	for (const word of ['Scunthorpe', 'class', 'assistant', 'Ada', 'cocktail']) {
		expect(isProfane(word)).toBe(false);
	}
});

test('censors only the matched part', () => {
	const out = censorText('this is shit');
	expect(out.startsWith('this is ')).toBe(true);
	expect(out).not.toContain('shit');
});

test('curated packs are clean', () => {
	for (const p of triviaPacks) expect(packIsProfane(p)).toBe(false);
});

test('curated prompts and words are clean', () => {
	for (const pack of [icebreakerPack, witPack, doodlePack, wordRacePack]) {
		for (const item of pack.items) expect(isProfane(item)).toBe(false);
	}
});

test('curated word games are clean', () => {
	for (const item of hangmanPack.items) expect(isProfane(item.word)).toBe(false);
	for (const item of emojiPack.items) {
		for (const answer of [item.answer, ...(item.also ?? [])]) expect(isProfane(answer)).toBe(false);
	}
});

test('every Word Race answer is an accepted guess', () => {
	for (const word of wordRacePack.items) expect(isWord(word)).toBe(true);
	expect(isWord('BEARS')).toBe(true);
	expect(isWord('xqzzt')).toBe(false);
});
