import { expect, test } from 'bun:test';
import { censorText, isProfane, packIsProfane } from './filter.ts';
import { triviaPacks } from './index.ts';

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
