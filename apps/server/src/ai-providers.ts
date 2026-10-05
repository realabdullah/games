import {
	FailoverGenerator,
	FailoverWriter,
	type JsonWriter,
	type NamedGenerator,
	type PackGenerator
} from './ai.ts';
import { ClaudePackGenerator } from './ai-claude.ts';
import { GeminiPackGenerator } from './ai-gemini.ts';
import { OpenAiCompatibleGenerator } from './ai-openai-compatible.ts';

/**
 * Providers the server can use, by the name AI_PROVIDERS refers to. Each needs
 * its own credentials; a provider without them is skipped.
 */
const PROVIDERS: Record<
	string,
	{ configured: () => boolean; create: () => PackGenerator & JsonWriter }
> = {
	'claude-sonnet': {
		configured: () => !!process.env.ANTHROPIC_API_KEY,
		create: () => new ClaudePackGenerator({ model: 'claude-sonnet-5-5', search: 'dynamic' })
	},
	'claude-opus': {
		configured: () => !!process.env.ANTHROPIC_API_KEY,
		create: () => new ClaudePackGenerator({ model: 'claude-opus-5-5', search: 'dynamic' })
	},
	'claude-haiku': {
		configured: () => !!process.env.ANTHROPIC_API_KEY,
		create: () => new ClaudePackGenerator({ model: 'claude-haiku-4-5', search: 'basic' })
	},
	gemini: {
		configured: () => !!process.env.GEMINI_API_KEY,
		create: () =>
			new GeminiPackGenerator({
				apiKey: process.env.GEMINI_API_KEY!,
				model: process.env.GEMINI_MODEL || 'gemini-3.8-flash'
			})
	},
	deepseek: {
		configured: () => !!process.env.DEEPSEEK_API_KEY,
		create: () =>
			new OpenAiCompatibleGenerator({
				name: 'deepseek',
				baseUrl: 'https://api.deepseek.com',
				apiKey: process.env.DEEPSEEK_API_KEY!,
				model: process.env.DEEPSEEK_MODEL || 'deepseek-flash'
			})
	},
	kimi: {
		configured: () => !!process.env.KIMI_API_KEY,
		create: () =>
			new OpenAiCompatibleGenerator({
				name: 'kimi',
				// Accounts on the China platform use https://api.moonshot.cn/v1
				baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1',
				apiKey: process.env.KIMI_API_KEY!,
				model: process.env.KIMI_MODEL || 'kimi-k3'
			})
	}
};

/** Providers that research the web come first; the rest write without sources. */
export const DEFAULT_AI_PROVIDERS = 'claude-sonnet,gemini,claude-haiku,kimi,deepseek';

/** The configured providers from a comma-separated, ordered list (first is preferred). */
function providerChain(list: string): NamedGenerator<PackGenerator & JsonWriter>[] {
	const names = list
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean);
	const unknown = names.filter((name) => !PROVIDERS[name]);
	if (unknown.length > 0) {
		throw new Error(
			`Unknown AI provider(s): ${unknown.join(', ')}. Known: ${Object.keys(PROVIDERS).join(', ')}`
		);
	}
	return names
		.filter((name) => PROVIDERS[name]!.configured())
		.map((name) => ({ name, generator: PROVIDERS[name]!.create() }));
}

/**
 * The failover chain for trivia packs, or null when none of the providers are
 * configured, which turns AI packs off.
 */
export function createPackGenerator(
	list = process.env.AI_PROVIDERS || DEFAULT_AI_PROVIDERS,
	onAttempt?: (provider: string, result: 'ok' | 'failed') => void
): PackGenerator | null {
	const chain = providerChain(list);
	return chain.length > 0 ? new FailoverGenerator(chain, onAttempt) : null;
}

/** The same providers, for writing other content (emoji riddles, icebreakers). */
export function createJsonWriter(
	list = process.env.AI_PROVIDERS || DEFAULT_AI_PROVIDERS,
	onAttempt?: (provider: string, result: 'ok' | 'failed') => void
): JsonWriter | null {
	const chain = providerChain(list);
	return chain.length > 0 ? new FailoverWriter(chain, onAttempt) : null;
}
