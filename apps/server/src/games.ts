import { doodlePack, findTriviaPack, icebreakerPack, witPack } from '@games/content';
import { doodle, type DoodleConfig } from '@games/doodle';
import { icebreakers, type IcebreakersConfig } from '@games/icebreakers';
import { wit, type WitConfig } from '@games/wit';
import { xo, type XoConfig } from '@games/xo';
import type { AnyGame } from '@games/engine';
import { trivia, type TriviaConfig } from '@games/trivia';
import type { PackStore } from './packs.ts';

type RawConfig = Record<string, string | number | boolean> | undefined;

export interface LoadedContent {
	content: unknown;
	/** Contains words the family filter blocks. */
	flagged: boolean;
	/** Custom pack code, to count plays. */
	customCode?: string;
}

export interface RegisteredGame {
	game: AnyGame;
	/** Load the content to play with, or null if the pack doesn't exist. */
	content(packId: string | undefined): LoadedContent | null;
	/** Turn client-supplied settings into safe values. Room settings (family filter) are added after. */
	config(raw: RawConfig): unknown;
}

export type Registry = Record<string, RegisteredGame>;

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
	typeof n === 'number' && Number.isFinite(n)
		? Math.min(max, Math.max(min, Math.round(n)))
		: fallback;

/** Curated packs have lowercase ids ("science"); custom packs have uppercase share codes. */
export function createRegistry(packs?: PackStore): Registry {
	return {
		trivia: {
			game: trivia,
			content(packId) {
				const curated = findTriviaPack(packId ?? 'general');
				if (curated) return { content: curated, flagged: false };
				const custom = packId ? packs?.forPlay(packId) : null;
				if (!custom) return null;
				return { content: custom.pack, flagged: custom.flagged, customCode: custom.pack.id };
			},
			config: (raw): TriviaConfig => ({
				questionCount: clamp(raw?.questionCount, 3, 20, trivia.defaultConfig.questionCount),
				secondsPerQuestion: clamp(
					raw?.secondsPerQuestion,
					5,
					60,
					trivia.defaultConfig.secondsPerQuestion
				)
			})
		},
		icebreakers: {
			game: icebreakers,
			content: () => ({ content: icebreakerPack, flagged: false }),
			config: (raw): Omit<IcebreakersConfig, 'familyFilter'> => ({
				rounds: clamp(raw?.rounds, 1, 5, icebreakers.defaultConfig.rounds),
				writeSeconds: clamp(raw?.writeSeconds, 20, 180, icebreakers.defaultConfig.writeSeconds),
				guessSeconds: clamp(raw?.guessSeconds, 10, 60, icebreakers.defaultConfig.guessSeconds)
			})
		},
		wit: {
			game: wit,
			content: () => ({ content: witPack, flagged: false }),
			config: (raw): Omit<WitConfig, 'familyFilter'> => ({
				rounds: clamp(raw?.rounds, 1, 3, wit.defaultConfig.rounds),
				writeSeconds: clamp(raw?.writeSeconds, 30, 180, wit.defaultConfig.writeSeconds),
				voteSeconds: clamp(raw?.voteSeconds, 10, 60, wit.defaultConfig.voteSeconds)
			})
		},
		doodle: {
			game: doodle,
			content: () => ({ content: doodlePack, flagged: false }),
			config: (raw): Omit<DoodleConfig, 'familyFilter'> => ({
				rounds: clamp(raw?.rounds, 1, 3, doodle.defaultConfig.rounds),
				drawSeconds: clamp(raw?.drawSeconds, 30, 120, doodle.defaultConfig.drawSeconds)
			})
		},
		xo: {
			game: xo,
			content: () => ({ content: null, flagged: false }),
			config: (raw): Omit<XoConfig, 'familyFilter'> => ({
				matches: clamp(raw?.matches, 1, 15, xo.defaultConfig.matches),
				turnSeconds: clamp(raw?.turnSeconds, 5, 30, xo.defaultConfig.turnSeconds),
				// Rooms always have two or more people, so no computer player.
				botLevel: 0
			})
		}
	};
}
