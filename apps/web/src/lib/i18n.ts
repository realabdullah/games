/**
 * UI copy lives here so translations can be added later without touching
 * components. English only for now.
 */
export const t = {
	appName: 'Game Night',
	tagline:
		'Party games, brain teasers and icebreakers for any group. One screen, everyone’s phones.',
	home: {
		hostParty: 'Host on a big screen',
		hostPartyHint: 'Share your screen or TV. Everyone joins on their phone.',
		playOnline: 'Play online',
		playOnlineHint: 'Everyone plays on their own screen.',
		join: 'Join a game',
		catalogTitle: 'The games',
		catalogEmpty: 'The first games are on their way.'
	},
	join: {
		title: 'Join a game',
		codeLabel: 'Room code',
		nameLabel: 'Your name',
		avatarLabel: 'Pick an avatar',
		submit: 'Join',
		submitting: 'Joining…'
	},
	online: {
		title: 'Start an online room',
		submit: 'Create room',
		submitting: 'Creating…'
	},
	lobby: {
		joinAt: 'Join at',
		withCode: 'and enter',
		waiting: 'Waiting for players…',
		players: (n: number) => (n === 1 ? '1 player' : `${n} players`),
		audience: (n: number) => (n === 1 ? '+1 in the audience' : `+${n} in the audience`),
		youAreVip: 'You’re the host. You pick the game and start it.',
		waitingForHost: 'You’re in! Watch the main screen.',
		waitingForVip: (name: string) => `You’re in! Waiting for ${name} to start.`,
		youAreAudience: 'The room is full, so you’re in the audience. You can still vote.',
		kick: (name: string) => `Remove ${name}`,
		leave: 'Leave room',
		endGame: 'End game',
		closeRoom: 'Close room',
		offline: 'offline'
	},
	picker: {
		title: 'Pick a game',
		pack: 'Question pack',
		questions: 'Questions',
		seconds: 'Seconds per question',
		start: 'Start game',
		starting: 'Starting…',
		needPlayers: (n: number) =>
			n === 1 ? 'Waiting for a player to join' : `Needs at least ${n} players`
	},
	trivia: {
		getReady: 'Get ready!',
		startNow: 'Start now',
		questionsCount: (n: number) => `${n} questions`,
		questionOf: (i: number, n: number) => `Question ${i} of ${n}`,
		answered: (a: number, n: number) => `${a} of ${n} answered`,
		lockedIn: 'Locked in!',
		nextRound: 'This game started before you joined. You’re in the next one.',
		skip: 'Skip timer',
		correct: 'Correct!',
		wrong: 'Not quite',
		tooSlow: 'Out of time',
		answerWas: 'The answer was',
		scoreLine: (score: number, rank: number, of: number) =>
			of > 1
				? `${score.toLocaleString()} points · ${ordinal(rank)} of ${of}`
				: `${score.toLocaleString()} points`,
		streak: (n: number) => `🔥 ${n} in a row`,
		next: 'Next question',
		seeResults: 'See results',
		finalTitle: 'Final scores',
		place: (rank: number) => `${ordinal(rank)} place`,
		points: (n: number) => `${n.toLocaleString()} points`,
		wins: 'wins!',
		playAgain: 'Play again',
		backToLobby: 'Back to lobby',
		waitingForHost: 'Waiting for the host to pick what’s next.',
		audienceGot: (pct: number) => `The audience got it ${pct}% right`
	},
	solo: {
		title: 'Solo trivia',
		intro: 'Play on your own. Same questions, same scoring, no room needed.',
		start: 'Play',
		quit: 'Quit'
	},
	status: {
		connecting: 'Connecting…',
		reconnecting: 'Reconnecting…',
		kicked: 'The host removed you from this room.',
		closed: 'This room has closed.',
		invalid: 'That room has ended or your spot expired.',
		replaced: 'You opened this room in another tab.',
		backHome: 'Back to home'
	}
} as const;

function ordinal(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
