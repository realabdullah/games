import DoodleHost from './doodle/DoodleHost.svelte';
import DoodlePlayer from './doodle/DoodlePlayer.svelte';
import IcebreakersHost from './icebreakers/IcebreakersHost.svelte';
import IcebreakersPlayer from './icebreakers/IcebreakersPlayer.svelte';
import TriviaHost from './trivia/TriviaHost.svelte';
import TriviaPlayer from './trivia/TriviaPlayer.svelte';
import type { GameStream, GameUi } from './types';
import WitHost from './wit/WitHost.svelte';
import WitPlayer from './wit/WitPlayer.svelte';
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
		]
	}
};

/** For screens that never stream (solo trivia). */
export const noStream: GameStream = { snapshot: null, send() {}, subscribe: () => () => {} };
