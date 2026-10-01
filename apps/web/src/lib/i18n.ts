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
		description: 'Got a room code? Join the game on your phone. No app or account needed.',
		submit: 'Join',
		submitting: 'Joining…'
	},
	online: {
		title: 'Start an online room',
		description:
			'Start a room and invite friends to play party games together, each on their own screen.',
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
		makePack: 'Write a pack by hand',
		generate: '✨ New questions on any topic',
		generated: 'Your new pack is selected. Check the answers below, fix anything wrong, then save.',
		saveChanges: 'Save changes',
		doneReviewing: 'Done',
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
		newDescription:
			'Write a trivia pack question by question, or describe a topic and let AI draft it.',
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
			generating: 'Researching and writing questions… (up to a minute)',
			remaining: (n: number) => (n === 1 ? '1 left today' : `${n} left today`),
			review:
				'Check the answers before you play. AI can get facts wrong, so questions link to where it found them.',
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
			source: (site: string) => `Check the answer on ${site}`,
			addQuestion: '+ Add a question',
			remove: 'Remove',
			saving: 'Saving…',
			saved: 'Saved.',
			correctBlank: (n: number) => `Question ${n}: the correct choice is empty`
		}
	},
	games: {
		send: 'Send',
		roundOf: (r: number, n: number) => `Round ${r} of ${n}`,
		done: (d: number, n: number) => `${d} of ${n} done`,
		getReady: 'Get ready!',
		startNow: 'Start now',
		skip: 'Skip timer',
		next: 'Next',
		lockedIn: 'Locked in! Waiting for the others…',
		points: (n: number) => `+${n}`,
		settings: {
			rounds: 'Rounds',
			drawSeconds: 'Seconds to draw',
			matches: 'Matches',
			turnSeconds: 'Seconds per move',
			botLevel: 'Computer',
			botLevels: { 1: 'Easy', 2: 'Medium', 3: 'Unbeatable' } as Record<number, string>
		}
	},
	icebreakers: {
		howTo: 'Answer about yourself. Then everyone guesses who wrote what.',
		writeOnPhone: 'Answer on your phone',
		yourAnswer: 'Your answer',
		placeholder: 'Be honest, be specific…',
		whoSaidIt: 'Who said it?',
		answerOf: (i: number, n: number) => `Answer ${i} of ${n}`,
		yours: 'This one’s yours. Keep a straight face 🤫',
		youGuessed: (name: string) => `You guessed ${name}`,
		itWas: 'It was',
		gotIt: (names: string) => `Got it: ${names}`,
		nobodyGotIt: 'Nobody guessed it!',
		fooled: (n: number) => (n === 1 ? 'Fooled 1 person' : `Fooled ${n} people`),
		correct: 'You got it!',
		wrong: 'Not this time',
		noGuess: 'No guess'
	},
	wit: {
		howTo: 'Answer two prompts. Then the room votes for the funnier answer.',
		writeOnPhone: 'Answer your prompts on your phone',
		promptOf: (i: number, n: number) => `Prompt ${i} of ${n}`,
		placeholder: 'Make them laugh…',
		allDone: 'All done! Waiting for the others…',
		vote: 'Vote for your favorite',
		yours: 'One of these is yours. Sit back and hope.',
		voted: 'Vote in!',
		noAnswer: 'No answer',
		votes: (n: number) => (n === 1 ? '1 vote' : `${n} votes`),
		sweep: 'Clean sweep! +200',
		matchupOf: (i: number, n: number) => `${i} of ${n}`
	},
	doodle: {
		howTo: 'Take turns drawing a word. Everyone else races to guess it.',
		choosing: (name: string) => `${name} is choosing a word…`,
		pickWord: 'Pick a word to draw',
		draw: 'Draw:',
		drawing: (name: string) => `${name} is drawing`,
		guessPlaceholder: 'Type your guess',
		guess: 'Guess',
		feedEmpty: 'Guesses show up here.',
		guessedIt: (name: string) => `${name} guessed it!`,
		youGotIt: 'You got it! 🎉',
		guessed: (d: number, n: number) => `${d} of ${n} guessed`,
		theWordWas: 'The word was',
		turnOf: (i: number, n: number) => `Turn ${i} of ${n}`,
		undo: 'Undo',
		clear: 'Clear',
		color: (n: number) => `Color ${n}`,
		size: (n: number) => `Brush size ${n}`,
		canvas: 'Drawing canvas'
	},
	xo: {
		howTo: 'Tic-tac-toe, king of the hill. Win and you stay on; the next challenger steps up.',
		matchOf: (i: number, n: number) => `Match ${i} of ${n}`,
		vs: 'vs',
		yourTurn: 'Your turn!',
		theirTurn: (name: string) => `${name}’s turn`,
		youAre: (mark: string) => `You’re ${mark}`,
		watching: 'Watching this one.',
		upNext: (name: string) => `Up next: ${name}`,
		youreNext: 'You’re up next!',
		wins: (name: string) => `${name} wins!`,
		draw: 'It’s a draw!',
		cell: (i: number, mark: string | null) => `Cell ${i + 1}${mark ? `, ${mark}` : ', empty'}`
	},
	solo: {
		title: (game: string) => `${game}: solo`,
		intro: {
			trivia: 'Play on your own. Same questions, same scoring, no room needed.',
			xo: 'Take on the computer. Pick how tough it plays.'
		} as Record<string, string>,
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
