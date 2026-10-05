import { describe, expect, test } from 'bun:test';
import { FLAVOUR, flavourItems, summarize, triviaPackSummaries } from './index.ts';
import { emojiPacks, icebreakerPacks, triviaPacks, witPacks } from './packs/index.ts';

test('the lobby’s trivia summaries match the packs', () => {
	expect(triviaPackSummaries).toEqual(triviaPacks.map(summarize));
});

describe('flavours', () => {
	const packs = { naija: { items: ['a'] }, global: { items: ['b'] } };

	test('Naija by default, global or both on request', () => {
		expect(flavourItems(packs, undefined)).toEqual(['a']);
		expect(flavourItems(packs, FLAVOUR.naija)).toEqual(['a']);
		expect(flavourItems(packs, FLAVOUR.global)).toEqual(['b']);
		expect(flavourItems(packs, FLAVOUR.mix)).toEqual(['a', 'b']);
	});

	test('every flavour has enough for a long game', () => {
		const packs = [emojiPacks, icebreakerPacks, witPacks].flatMap(Object.values);
		for (const pack of packs) expect(pack.items.length).toBeGreaterThanOrEqual(40);
	});

	test('Mix never repeats an item: no overlap between flavours', () => {
		for (const packs of [icebreakerPacks, witPacks]) {
			const naija = new Set(packs.naija.items);
			expect(packs.global.items.filter((i) => naija.has(i))).toEqual([]);
		}
	});
});

describe('emoji riddles', () => {
	const all = [...emojiPacks.naija.items, ...emojiPacks.global.items];

	test('clues are emoji only, so they never spell the answer', () => {
		for (const item of all) expect(item.emoji).not.toMatch(/[a-z]/i);
	});

	test('no flags: some phones show them as letters, which gives answers away', () => {
		for (const item of all) expect(item.emoji).not.toMatch(/\p{Regional_Indicator}/u);
	});

	test('no answer appears twice, even across flavours', () => {
		const answers = all.map((item) => item.answer.toLowerCase());
		expect(new Set(answers).size).toBe(answers.length);
	});
});

test('no icebreaker appears twice, even across flavours', () => {
	const prompts = [...icebreakerPacks.naija.items, ...icebreakerPacks.global.items];
	expect(new Set(prompts).size).toBe(prompts.length);
});
