import type { TriviaPackDraft } from '@games/content';
import {
	JSON_WRITER_SYSTEM,
	parseWritten,
	providerError,
	writerPrompt,
	type GenerateRequest,
	type PackGenerator
} from './ai.ts';
import { ApiError } from './errors.ts';

export interface OpenAiCompatibleOptions {
	/** For logs, e.g. "deepseek". */
	name: string;
	/** Up to and including the version, e.g. https://api.deepseek.com */
	baseUrl: string;
	apiKey: string;
	model: string;
	fetch?: typeof fetch;
}

interface ChatCompletion {
	choices?: { message?: { content?: string | null }; finish_reason?: string }[];
}

/**
 * Providers that speak the OpenAI Chat Completions format (DeepSeek, Kimi).
 * They write from the model's own knowledge: no web research, so no sources.
 */
export class OpenAiCompatibleGenerator implements PackGenerator {
	private fetch: typeof fetch;

	constructor(private options: OpenAiCompatibleOptions) {
		this.fetch = options.fetch ?? globalThis.fetch;
	}

	async generate(req: GenerateRequest): Promise<TriviaPackDraft> {
		const { name, baseUrl, apiKey, model } = this.options;
		let res: Response;
		try {
			res = await this.fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
				body: JSON.stringify({
					model,
					max_tokens: 8000,
					response_format: { type: 'json_object' },
					messages: [
						{ role: 'system', content: JSON_WRITER_SYSTEM },
						{ role: 'user', content: writerPrompt(req, null) }
					]
				}),
				signal: AbortSignal.timeout(120_000)
			});
		} catch (err) {
			console.error(`${name} request failed`, err instanceof Error ? err.message : err);
			throw new ApiError('unavailable', 'Couldn’t generate questions right now. Try again later.');
		}
		if (!res.ok) throw providerError(name, res.status, await res.text());

		const choice = ((await res.json()) as ChatCompletion).choices?.[0];
		if (choice?.finish_reason === 'length') {
			throw new ApiError('unavailable', 'Couldn’t generate questions for that topic. Try another.');
		}
		return parseWritten(choice?.message?.content, req);
	}
}
