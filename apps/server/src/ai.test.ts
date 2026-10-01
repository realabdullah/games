import { describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { TriviaPackDraft } from '@games/content';
import { FailoverGenerator, type GenerateRequest, type PackGenerator } from './ai.ts';
import { collectResearch } from './ai-claude.ts';
import { createPackGenerator } from './ai-providers.ts';
import { ApiError } from './errors.ts';

const req: GenerateRequest = { topic: 'Nollywood', count: 5, difficulty: 'medium' };
const pack: TriviaPackDraft = {
	title: 'Nollywood',
	description: '',
	language: 'en',
	questions: [
		{ q: 'One?', choices: ['a', 'b'], answer: 0 },
		{ q: 'Two?', choices: ['a', 'b'], answer: 1 },
		{ q: 'Three?', choices: ['a', 'b'], answer: 0 }
	]
};

const provider = (behaviour: () => Promise<TriviaPackDraft>): PackGenerator & { calls: number } => {
	const p = {
		calls: 0,
		generate: async () => {
			p.calls++;
			return behaviour();
		}
	};
	return p;
};

describe('failover between providers', () => {
	test('uses the first provider that succeeds and reports each attempt', async () => {
		const down = provider(() => Promise.reject(new Error('503')));
		const up = provider(() => Promise.resolve(pack));
		const attempts: string[] = [];
		const chain = new FailoverGenerator(
			[
				{ name: 'first', generator: down },
				{ name: 'second', generator: up }
			],
			(name, result) => attempts.push(`${name}:${result}`)
		);
		expect(await chain.generate(req)).toBe(pack);
		expect(attempts).toEqual(['first:failed', 'second:ok']);
	});

	test('a filtered topic stops the chain', async () => {
		const strict = provider(() => Promise.reject(new ApiError('filtered', 'Not that topic')));
		const next = provider(() => Promise.resolve(pack));
		const chain = new FailoverGenerator([
			{ name: 'a', generator: strict },
			{ name: 'b', generator: next }
		]);
		await expect(chain.generate(req)).rejects.toThrow('Not that topic');
		expect(next.calls).toBe(0);
	});

	test('when every provider fails, the caller gets an unavailable error', async () => {
		const chain = new FailoverGenerator([
			{ name: 'a', generator: provider(() => Promise.reject(new Error('boom'))) }
		]);
		const err = await chain.generate(req).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect((err as ApiError).code).toBe('unavailable');
	});
});

describe('provider list', () => {
	test('rejects names it does not know', () => {
		expect(() => createPackGenerator('claude-sonnet, gpt-unknown')).toThrow('gpt-unknown');
	});

	test('is off when no listed provider has credentials', () => {
		const key = process.env.ANTHROPIC_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		try {
			expect(createPackGenerator('claude-sonnet,claude-haiku')).toBeNull();
		} finally {
			if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
		}
	});
});

describe('research results', () => {
	const searchResult = (url: string) => ({
		type: 'web_search_result' as const,
		url,
		title: url,
		encrypted_content: '',
		page_age: null
	});

	test('collects notes and every page search returned or cited, web URLs only', () => {
		const content = [
			{
				type: 'web_search_tool_result',
				tool_use_id: 't1',
				content: [searchResult('https://a.example/1'), searchResult('ftp://b.example/2')]
			},
			{
				type: 'text',
				text: 'Lagos is the largest city.',
				citations: [
					{
						type: 'web_search_result_location',
						url: 'https://c.example/3',
						title: null,
						cited_text: '',
						encrypted_index: ''
					}
				]
			}
		] as unknown as Anthropic.ContentBlock[];
		expect(collectResearch(content)).toEqual({
			notes: 'Lagos is the largest city.',
			sources: ['https://a.example/1', 'https://c.example/3']
		});
	});

	test('no sources means no grounding', () => {
		const content = [
			{ type: 'text', text: 'From memory', citations: null }
		] as unknown as Anthropic.ContentBlock[];
		expect(collectResearch(content)).toBeNull();
	});

	test('a failed search (error object, not a list) is skipped', () => {
		const content = [
			{
				type: 'web_search_tool_result',
				tool_use_id: 't1',
				content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' }
			},
			{ type: 'text', text: 'Notes', citations: null }
		] as unknown as Anthropic.ContentBlock[];
		expect(collectResearch(content)).toBeNull();
	});
});
