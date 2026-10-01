import { findTriviaPack } from '@games/content';
import type { AnyGame } from '@games/engine';
import { trivia, type TriviaConfig } from '@games/trivia';

type RawConfig = Record<string, string | number | boolean> | undefined;

export interface RegisteredGame {
	game: AnyGame;
	/** Load the content to play with, or null if the pack doesn't exist. */
	content(packId: string | undefined): unknown | null;
	/** Turn client-supplied settings into safe values. */
	config(raw: RawConfig): unknown;
}

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
	typeof n === 'number' && Number.isFinite(n)
		? Math.min(max, Math.max(min, Math.round(n)))
		: fallback;

export const registry: Record<string, RegisteredGame> = {
	trivia: {
		game: trivia,
		content: (packId) => findTriviaPack(packId ?? 'general') ?? null,
		config: (raw): TriviaConfig => ({
			questionCount: clamp(raw?.questionCount, 3, 20, trivia.defaultConfig.questionCount),
			secondsPerQuestion: clamp(
				raw?.secondsPerQuestion,
				5,
				60,
				trivia.defaultConfig.secondsPerQuestion
			)
		})
	}
};
