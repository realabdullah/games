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
		packs: 'Make a question pack',
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
			n === 1 ? 'Waiting for a player to join' : `Needs at least ${n} players`,
		curated: 'Ready-made',
		myPacks: 'Your packs',
		code: 'Pack code',
		codePlaceholder: 'ABC123',
		useCode: 'Use',
		makePack: 'Make a pack',
		familyFilter: 'Family filter',
		familyFilterHint: 'Blocks rude names and packs with swearing.'
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
	packs: {
		title: 'Question packs',
		intro:
			'Write your own trivia, or describe a topic and let AI draft it. Packs are saved on this device, with a private link to edit them anywhere.',
		mine: 'Your packs',
		none: 'You haven’t made any packs yet.',
		newPack: 'Write a pack',
		newTitle: 'New pack',
		create: 'Create pack',
		save: 'Save changes',
		shareTitle: 'Play it',
		shareHow: 'In a room, pick “Pack code” and enter',
		editLinkTitle: 'Private edit link',
		editLinkHow: 'Anyone with this link can change or delete the pack. Keep it to yourself.',
		copy: 'Copy',
		copied: 'Copied!',
		delete: 'Delete pack',
		confirmDelete: 'Delete this pack for good? Rooms can’t use it after this.',
		noToken: 'You need this pack’s private edit link to change it.',
		flagged: 'Has words the family filter blocks. Hosts must turn the filter off to play it.',
		questions: (n: number) => (n === 1 ? '1 question' : `${n} questions`),
		ai: {
			title: 'Generate with AI',
			topic: 'Topic',
			topicPlaceholder: 'e.g. 90s cartoons, the human body, Lagos',
			count: 'Questions',
			difficulty: 'Difficulty',
			easy: 'Easy',
			medium: 'Medium',
			hard: 'Hard',
			generate: 'Generate',
			generating: 'Writing questions… (about 15 seconds)',
			remaining: (n: number) => (n === 1 ? '1 left today' : `${n} left today`),
			review: 'Check the questions before you play. AI can get facts wrong.',
			off: 'AI packs aren’t available on this server.'
		},
		editor: {
			emoji: 'Emoji',
			title: 'Pack title',
			description: 'Short description',
			question: (n: number) => `Question ${n}`,
			questionPlaceholder: 'Type the question',
			choicesHint: 'Choices. Select the correct one.',
			choice: (n: number) => `Choice ${n}`,
			markCorrect: (n: number) => `Mark choice ${n} as correct`,
			removeChoice: (n: number) => `Remove choice ${n}`,
			addChoice: '+ Add a choice',
			fact: 'Fun fact shown after the answer (optional)',
			addQuestion: '+ Add a question',
			remove: 'Remove',
			saving: 'Saving…',
			saved: 'Saved.',
			correctBlank: (n: number) => `Question ${n}: the correct choice is empty`
		}
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
