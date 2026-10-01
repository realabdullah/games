import { describe, expect, test } from 'bun:test';
import type { GenerateRequest, WrittenPack } from './ai.ts';
import { collectGrounding, GeminiPackGenerator } from './ai-gemini.ts';
import { OpenAiCompatibleGenerator } from './ai-openai-compatible.ts';
import { ApiError } from './errors.ts';

const req: GenerateRequest = { topic: 'Nigerian music', count: 3, difficulty: 'easy' };

const written = (source = 0): WrittenPack => ({
	suitable: true,
	title: 'Naija hits',
	description: 'Afrobeats and more',
	emoji: '🎶',
	questions: ['Fela?', 'Burna?', 'Wizkid?'].map((q) => ({
		q,
		choices: ['Lagos', 'Abuja', 'Kano', 'Ibadan'],
		answer: 0,
		fact: '',
		source
	}))
});

/** A fetch that records requests and answers from a queue. */
function fakeFetch(...replies: (object | Response)[]) {
	const requests: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
	const fn = (async (url: string, init: RequestInit) => {
		requests.push({ url, init, body: JSON.parse(String(init.body)) });
		const reply = replies.shift();
		return reply instanceof Response ? reply : Response.json(reply);
	}) as unknown as typeof fetch;
	return { fn, requests };
}

describe('OpenAI-compatible providers (DeepSeek, Kimi)', () => {
	const make = (f: typeof fetch) =>
		new OpenAiCompatibleGenerator({
			name: 'deepseek',
			baseUrl: 'https://api.deepseek.com/',
			apiKey: 'sk-test',
			model: 'deepseek-flash',
			fetch: f
		});

	test('asks for JSON and turns the reply into a pack without sources', async () => {
		const { fn, requests } = fakeFetch({
			choices: [{ message: { content: JSON.stringify(written(1)) }, finish_reason: 'stop' }]
		});
		const pack = await make(fn).generate(req);

		expect(requests[0]!.url).toBe('https://api.deepseek.com/chat/completions');
		expect(new Headers(requests[0]!.init.headers).get('authorization')).toBe('Bearer sk-test');
		expect(requests[0]!.body).toMatchObject({
			model: 'deepseek-flash',
			response_format: { type: 'json_object' }
		});
		expect(pack.questions).toHaveLength(3);
		expect(pack.questions.every((q) => q.source === undefined)).toBe(true);
	});

	test('accepts JSON wrapped in a code fence', async () => {
		const { fn } = fakeFetch({
			choices: [{ message: { content: '```json\n' + JSON.stringify(written()) + '\n```' } }]
		});
		expect((await make(fn).generate(req)).title).toBe('Naija hits');
	});

	test('a reply that is not the expected JSON is an error, not a broken pack', async () => {
		const { fn } = fakeFetch({ choices: [{ message: { content: '{"title": 3}' } }] });
		await expect(make(fn).generate(req)).rejects.toThrow('didn’t come out right');
	});

	test('rate limits and outages become errors the failover chain can act on', async () => {
		const limited = fakeFetch(new Response('slow down', { status: 429 }));
		const err = await make(limited.fn)
			.generate(req)
			.catch((e: unknown) => e);
		expect((err as ApiError).code).toBe('rate_limited');

		const down = fakeFetch(new Response('oops', { status: 503 }));
		expect(
			(
				(await make(down.fn)
					.generate(req)
					.catch((e: unknown) => e)) as ApiError
			).code
		).toBe('unavailable');
	});
});

describe('Gemini', () => {
	const grounded = {
		candidates: [
			{
				content: { parts: [{ text: 'Fela Kuti pioneered Afrobeat.' }] },
				groundingMetadata: {
					groundingChunks: [
						{ web: { uri: 'https://example.org/fela', title: 'example.org' } },
						{ web: { uri: 'https://example.org/fela', title: 'example.org' } },
						{ web: { uri: 'javascript:alert(1)', title: 'bad' } }
					]
				}
			}
		]
	};

	test('researches with Google Search, then writes JSON citing the grounded pages', async () => {
		const { fn, requests } = fakeFetch(grounded, {
			candidates: [{ content: { parts: [{ text: JSON.stringify(written(1)) }] } }]
		});
		const pack = await new GeminiPackGenerator({
			apiKey: 'g-test',
			model: 'gemini-3.8-flash',
			fetch: fn
		}).generate(req);

		expect(requests[0]!.url).toBe(
			'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent'
		);
		expect(new Headers(requests[0]!.init.headers).get('x-goog-api-key')).toBe('g-test');
		expect(requests[0]!.body.tools).toEqual([{ google_search: {} }]);
		expect(requests[1]!.body).toMatchObject({
			generationConfig: { responseMimeType: 'application/json' }
		});
		expect(JSON.stringify(requests[1]!.body.contents)).toContain('1. https://example.org/fela');
		expect(pack.questions[0]!.source).toBe('https://example.org/fela');
	});

	test('if research fails, it still writes the pack, without sources', async () => {
		const { fn } = fakeFetch(new Response('no search', { status: 400 }), {
			candidates: [{ content: { parts: [{ text: JSON.stringify(written(1)) }] } }]
		});
		const pack = await new GeminiPackGenerator({ apiKey: 'k', model: 'm', fetch: fn }).generate(
			req
		);
		expect(pack.questions[0]!.source).toBeUndefined();
	});

	test('grounding keeps unique web links only', () => {
		expect(collectGrounding(grounded)).toEqual({
			notes: 'Fela Kuti pioneered Afrobeat.',
			sources: ['https://example.org/fela']
		});
		expect(collectGrounding({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] })).toBeNull();
	});
});
