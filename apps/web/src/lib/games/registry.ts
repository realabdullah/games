import ClockHost from './clock/ClockHost.svelte';
import ClockPlayer from './clock/ClockPlayer.svelte';
import DoodleHost from './doodle/DoodleHost.svelte';
import DoodlePlayer from './doodle/DoodlePlayer.svelte';
import EmojiHost from './emoji/EmojiHost.svelte';
import EmojiPlayer from './emoji/EmojiPlayer.svelte';
import HangmanHost from './hangman/HangmanHost.svelte';
import HangmanPlayer from './hangman/HangmanPlayer.svelte';
import IcebreakersHost from './icebreakers/IcebreakersHost.svelte';
import IcebreakersPlayer from './icebreakers/IcebreakersPlayer.svelte';
import MathsHost from './maths/MathsHost.svelte';
import MathsPlayer from './maths/MathsPlayer.svelte';
import TriviaHost from './trivia/TriviaHost.svelte';
import TriviaPlayer from './trivia/TriviaPlayer.svelte';
import type { GameStream, GameUi } from './types';
import WitHost from './wit/WitHost.svelte';
import WitPlayer from './wit/WitPlayer.svelte';
import WordRaceHost from './wordrace/WordRaceHost.svelte';
import WordRacePlayer from './wordrace/WordRacePlayer.svelte';
import XoHost from './xo/XoHost.svelte';
import XoPlayer from './xo/XoPlayer.svelte';
import { t } from '$lib/i18n';

const s = t.games.settings;

/** Screens and lobby settings for each game, by game id. */
export const gameUi: Record<string, GameUi> = {
	trivia: { Host: TriviaHost, Player: TriviaPlayer, settings: [] },
	icebreakers: {
		Host: IcebreakersHost,
		Player: IcebreakersPlayer,
		settings: [{ key: 'rounds', label: s.rounds, options: [1, 2, 3], default: 2 }]
	},
	wit: {
		Host: WitHost,
		Player: WitPlayer,
		settings: [{ key: 'rounds', label: s.rounds, options: [1, 2], default: 2 }]
	},
	doodle: {
		Host: DoodleHost,
		Player: DoodlePlayer,
		settings: [
			{ key: 'rounds', label: s.rounds, options: [1, 2], default: 1 },
			{ key: 'drawSeconds', label: s.drawSeconds, options: [60, 75, 90], default: 75 }
		]
	},
	xo: {
		Host: XoHost,
		Player: XoPlayer,
		settings: [
			{ key: 'matches', label: s.matches, options: [3, 5, 7, 9], default: 5 },
			{ key: 'turnSeconds', label: s.turnSeconds, options: [5, 10, 15], default: 10 }
		],
		soloSettings: [
			{ key: 'botLevel', label: s.botLevel, options: [1, 2, 3], default: 2, labels: s.botLevels },
			{ key: 'matches', label: s.matches, options: [1, 3, 5], default: 3 },
			{ key: 'turnSeconds', label: s.turnSeconds, options: [10, 20, 30], default: 20 }
		]
	},
	wordrace: {
		Host: WordRaceHost,
		Player: WordRacePlayer,
		settings: [
			{ key: 'rounds', label: s.words, options: [1, 3, 5], default: 3 },
			{ key: 'secondsPerWord', label: s.secondsPerWord, options: [90, 120, 180], default: 120 }
		]
	},
	hangman: {
		Host: HangmanHost,
		Player: HangmanPlayer,
		settings: [
			{ key: 'rounds', label: s.words, options: [3, 5, 8], default: 5 },
			{ key: 'turnSeconds', label: s.turnSeconds, options: [10, 15, 20], default: 15 }
		],
		soloSettings: [
			{ key: 'rounds', label: s.words, options: [3, 5, 8], default: 5 },
			{ key: 'turnSeconds', label: s.turnSeconds, options: [15, 20, 30], default: 20 }
		]
	},
	emoji: {
		Host: EmojiHost,
		Player: EmojiPlayer,
		settings: [
			{ key: 'rounds', label: s.puzzles, options: [5, 8, 12], default: 8 },
			{ key: 'secondsPerPuzzle', label: s.secondsPerPuzzle, options: [30, 45, 60], default: 45 }
		]
	},
	maths: {
		Host: MathsHost,
		Player: MathsPlayer,
		settings: [
			{ key: 'level', label: s.level, options: [1, 2, 3], default: 1, labels: s.levels },
			{ key: 'rounds', label: s.sums, options: [5, 10, 15], default: 10 },
			{ key: 'secondsPerSum', label: s.secondsPerSum, options: [10, 20, 30], default: 20 }
		]
	},
	clock: {
		Host: ClockHost,
		Player: ClockPlayer,
		settings: [
			{ key: 'level', label: s.level, options: [1, 2, 3], default: 1, labels: s.clockLevels },
			{ key: 'rounds', label: s.rounds, options: [3, 5, 8], default: 5 }
		]
	}
};

/** For screens that never stream (solo trivia). */
export const noStream: GameStream = { snapshot: null, send() {}, subscribe: () => () => {} };
