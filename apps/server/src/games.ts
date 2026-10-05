import { FLAVOUR, flavourItems, type Flavour, type TriviaPack } from '@games/content';
import {
	anagramPack,
	doodlePack,
	emojiPacks,
	findTriviaPack,
	hangmanPack,
	icebreakerPacks,
	witPack,
	wordRacePack
} from '@games/content/packs';
import { isWord } from '@games/content/dictionary';
import { createAnagram, wordsForLevel, type AnagramConfig } from '@games/anagram';
import { clock, type ClockConfig } from '@games/clock';
import { findIt, type FindItConfig } from '@games/findit';
import { memory, type MemoryConfig } from '@games/memory';
import { doodle, type DoodleConfig } from '@games/doodle';
import { emoji, type EmojiConfig } from '@games/emoji';
import { hangman, type HangmanConfig } from '@games/hangman';
import { icebreakers, type IcebreakersConfig } from '@games/icebreakers';
import { maths, type MathsConfig } from '@games/maths';
import { createWordRace, type WordRaceConfig } from '@games/wordrace';
import { wit, type WitConfig } from '@games/wit';
import { xo, type XoConfig } from '@games/xo';
import type { AnyGame } from '@games/engine';
import { trivia, type TriviaConfig } from '@games/trivia';
import type { PoolKind } from './ai-pool.ts';
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
	/**
	 * Pick this game's items so a room doesn't replay ones it has already had.
	 * `played` lists the keys used since the room last went through the whole pack.
	 */
	fresh?(content: unknown, config: unknown, played: readonly string[], random: () => number): Fresh;
	/**
	 * Which AI pool can add to this game's content when the lobby's "AI-written"
	 * setting is on. The content must be `{ items }` and the config have `rounds`.
	 */
	ai?: PoolKind;
}

export interface Fresh {
	content: unknown;
	/** Keys of the items picked this game. */
	used: string[];
	/** The pack ran out of unplayed items, so this game starts a new cycle. */
	cycled: boolean;
}

/** `n` items in random order, without repeats. */
function sample<T>(items: readonly T[], n: number, random: () => number): T[] {
	const pool = [...items];
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[pool[i], pool[j]] = [pool[j]!, pool[i]!];
	}
	return pool.slice(0, n);
}

/**
 * Unplayed items first; when too few are left, top up from played ones and
 * start over. `key` names an item in `played`.
 */
export function freshItems<T>(
	items: readonly T[],
	wanted: number,
	played: readonly string[],
	random: () => number,
	key: (item: T) => string
): { items: T[]; used: string[]; cycled: boolean } {
	const seen = new Set(played);
	const unplayed = items.filter((item) => !seen.has(key(item)));
	const n = Math.min(wanted, items.length);
	const cycled = unplayed.length < n;
	const picked = cycled
		? [
				...unplayed,
				...sample(
					items.filter((item) => seen.has(key(item))),
					n - unplayed.length,
					random
				)
			]
		: sample(unplayed, n, random);
	return { items: picked, used: picked.map(key), cycled };
}

export function freshTrivia(
	pack: TriviaPack,
	questionCount: number,
	played: readonly string[],
	random: () => number
): Fresh {
	const { items, used, cycled } = freshItems(
		pack.questions,
		questionCount,
		played,
		random,
		(q) => q.q
	);
	return { content: { ...pack, questions: items }, used, cycled };
}

/** For packs shaped `{ items }`: only this game's picks go into the game state. */
function freshPack<T>(key: (item: T) => string) {
	return (content: unknown, config: unknown, played: readonly string[], random: () => number) => {
		const pack = content as { items: T[] };
		const { rounds } = config as { rounds: number };
		const { items, used, cycled } = freshItems(pack.items, rounds, played, random, key);
		return { content: { ...pack, items }, used, cycled };
	};
}

/**
 * For packs kept per flavour (Naija, global): the lobby's "Content" setting
 * picks which, then rematches avoid repeats as with `freshPack`.
 */
function freshFlavour<T>(key: (item: T) => string) {
	return (content: unknown, config: unknown, played: readonly string[], random: () => number) => {
		const packs = content as Record<Flavour, { id: string; title: string; items: T[] }>;
		const { rounds, flavour } = config as { rounds: number; flavour: number };
		const pool = flavourItems(packs, flavour);
		const { items, used, cycled } = freshItems(pool, rounds, played, random, key);
		return { content: { id: 'curated', title: 'Curated', items }, used, cycled };
	};
}

const flavour = (n: unknown) => clamp(n, FLAVOUR.naija, FLAVOUR.global, FLAVOUR.naija);
const onOff = (n: unknown) => clamp(n, 0, 1, 0);

const wordRace = createWordRace(isWord);
const anagram = createAnagram(isWord);

type Level = 1 | 2 | 3;
const level = (n: unknown, fallback: Level) => clamp(n, 1, 3, fallback) as Level;

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
			}),
			fresh: (content, config, played, random) =>
				freshTrivia(content as TriviaPack, (config as TriviaConfig).questionCount, played, random)
		},
		icebreakers: {
			game: icebreakers,
			content: () => ({ content: icebreakerPacks, flagged: false }),
			config: (raw): Omit<IcebreakersConfig, 'familyFilter'> & { flavour: number; ai: number } => ({
				ai: onOff(raw?.ai),
				rounds: clamp(raw?.rounds, 1, 5, icebreakers.defaultConfig.rounds),
				writeSeconds: clamp(raw?.writeSeconds, 20, 180, icebreakers.defaultConfig.writeSeconds),
				guessSeconds: clamp(raw?.guessSeconds, 10, 60, icebreakers.defaultConfig.guessSeconds),
				flavour: flavour(raw?.flavour)
			}),
			fresh: freshFlavour<string>((prompt) => prompt),
			ai: 'icebreakers'
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
		wordrace: {
			game: wordRace,
			content: () => ({ content: wordRacePack, flagged: false }),
			config: (raw): Omit<WordRaceConfig, 'familyFilter'> => ({
				rounds: clamp(raw?.rounds, 1, 10, wordRace.defaultConfig.rounds),
				secondsPerWord: clamp(raw?.secondsPerWord, 30, 300, wordRace.defaultConfig.secondsPerWord)
			}),
			fresh: freshPack<string>((w) => w)
		},
		hangman: {
			game: hangman,
			content: () => ({ content: hangmanPack, flagged: false }),
			config: (raw): Omit<HangmanConfig, 'familyFilter'> => ({
				rounds: clamp(raw?.rounds, 1, 10, hangman.defaultConfig.rounds),
				turnSeconds: clamp(raw?.turnSeconds, 5, 60, hangman.defaultConfig.turnSeconds)
			}),
			fresh: freshPack<{ word: string }>((w) => w.word)
		},
		emoji: {
			game: emoji,
			content: () => ({ content: emojiPacks, flagged: false }),
			config: (raw): Omit<EmojiConfig, 'familyFilter'> & { flavour: number; ai: number } => ({
				ai: onOff(raw?.ai),
				flavour: flavour(raw?.flavour),
				rounds: clamp(raw?.rounds, 3, 15, emoji.defaultConfig.rounds),
				secondsPerPuzzle: clamp(
					raw?.secondsPerPuzzle,
					15,
					120,
					emoji.defaultConfig.secondsPerPuzzle
				)
			}),
			fresh: freshFlavour<{ answer: string }>((p) => p.answer),
			ai: 'emoji'
		},
		maths: {
			game: maths,
			content: () => ({ content: null, flagged: false }),
			config: (raw): MathsConfig => ({
				rounds: clamp(raw?.rounds, 3, 20, maths.defaultConfig.rounds),
				secondsPerSum: clamp(raw?.secondsPerSum, 5, 60, maths.defaultConfig.secondsPerSum),
				level: level(raw?.level, maths.defaultConfig.level)
			})
		},
		clock: {
			game: clock,
			content: () => ({ content: null, flagged: false }),
			config: (raw): ClockConfig => ({
				rounds: clamp(raw?.rounds, 1, 15, clock.defaultConfig.rounds),
				level: level(raw?.level, clock.defaultConfig.level)
			})
		},
		findit: {
			game: findIt,
			content: () => ({ content: null, flagged: false }),
			config: (raw): FindItConfig => ({
				rounds: clamp(raw?.rounds, 3, 20, findIt.defaultConfig.rounds),
				secondsPerGrid: clamp(raw?.secondsPerGrid, 5, 60, findIt.defaultConfig.secondsPerGrid),
				level: level(raw?.level, findIt.defaultConfig.level)
			})
		},
		anagram: {
			game: anagram,
			content: () => ({ content: anagramPack, flagged: false }),
			config: (raw): AnagramConfig => ({
				rounds: clamp(raw?.rounds, 3, 15, anagram.defaultConfig.rounds),
				secondsPerWord: clamp(raw?.secondsPerWord, 15, 120, anagram.defaultConfig.secondsPerWord),
				level: level(raw?.level, anagram.defaultConfig.level)
			}),
			// Only words of this level's length, so rematches don't repeat them.
			fresh(content, config, played, random) {
				const { rounds, level } = config as AnagramConfig;
				const pack = content as typeof anagramPack;
				const { items, used, cycled } = freshItems(
					wordsForLevel(pack.items, level),
					rounds,
					played,
					random,
					(w) => w.word
				);
				return { content: { ...pack, items }, used, cycled };
			}
		},
		memory: {
			game: memory,
			content: () => ({ content: null, flagged: false }),
			config: (raw): MemoryConfig => ({
				rounds: clamp(raw?.rounds, 3, 12, memory.defaultConfig.rounds),
				recallSeconds: clamp(raw?.recallSeconds, 5, 60, memory.defaultConfig.recallSeconds),
				level: level(raw?.level, memory.defaultConfig.level)
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
