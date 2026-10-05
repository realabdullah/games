import { expect, test } from 'bun:test';
import { summarize, triviaPackSummaries } from './index.ts';
import { triviaPacks } from './packs/index.ts';

test('the lobby’s trivia summaries match the packs', () => {
	expect(triviaPackSummaries).toEqual(triviaPacks.map(summarize));
});
