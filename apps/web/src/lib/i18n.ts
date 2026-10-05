/**
 * UI copy lives here so translations can be added later without touching
 * components. English only for now.
 */
export const t = {
	appName: 'Games',
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
		change: 'Change',
		close: 'Close',
		searchGames: 'Search games',
		searchPacks: 'Search packs',
		noMatches: 'Nothing matches that.',
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
		sittingOut:
			'This game started before you joined, so you’re watching this one. You’re in the next game.',
		points: (n: number) => `+${n}`,
		feedEmpty: 'Guesses show up here.',
		guessedIt: (name: string) => `${name} guessed it!`,
		settings: {
			rounds: 'Rounds',
			words: 'Words',
			puzzles: 'Puzzles',
			drawSeconds: 'Seconds to draw',
			secondsPerWord: 'Seconds per word',
			secondsPerPuzzle: 'Seconds per puzzle',
			sums: 'Sums',
			secondsPerSum: 'Seconds per sum',
			level: 'Level',
			levels: { 1: 'Easy', 2: 'Medium', 3: 'Hard' } as Record<number, string>,
			flavour: 'Content',
			aiWritten: 'AI-written',
			aiWrittenOptions: { 0: 'Off', 1: '✨ New every game' } as Record<number, string>,
			flavours: { 1: '🇳🇬 Naija', 2: 'Mix', 3: '🌍 Global' } as Record<number, string>,
			clockLevels: { 1: '2–6 seconds', 2: '5–12 seconds', 3: '10–25 seconds' } as Record<
				number,
				string
			>,
			gridSize: 'Grid',
			gridSizes: { 1: '5 × 5', 2: '6 × 6', 3: '7 × 7' } as Record<number, string>,
			grids: 'Grids',
			secondsPerGrid: 'Seconds per grid',
			wordLevels: { 1: '5 letters', 2: '6–7 letters', 3: '8+ letters' } as Record<number, string>,
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
	wordrace: {
		howTo:
			'Everyone gets the same secret five-letter word and six tries. Fewer tries, more points.',
		legend: 'Green: right letter, right spot. Yellow: in the word, wrong spot.',
		wordOf: (i: number, n: number) => `Word ${i} of ${n}`,
		done: (d: number, n: number) => `${d} of ${n} done`,
		guessOnPhone: 'Guess on your phone',
		enter: 'Enter',
		backspace: 'Delete letter',
		notAWord: (word: string) => `“${word.toUpperCase()}” isn’t in the word list`,
		tooShort: 'Five letters, please',
		solvedIn: (n: number) => (n === 1 ? 'First try! 🤯' : `Solved in ${n}!`),
		out: 'Out of guesses',
		waiting: 'Waiting for the others…',
		theWordWas: 'The word was',
		tile: (letter: string, mark: string) => `${letter.toUpperCase()}, ${mark}`,
		marks: { hit: 'right spot', near: 'wrong spot', miss: 'not in the word' } as Record<
			string,
			string
		>,
		row: (n: number) => `Guess ${n}`,
		board: (name: string) => `${name}’s tiles`,
		yourBoard: 'Your guesses'
	},
	hangman: {
		howTo: 'Take turns picking letters. Six wrong letters and the word wins.',
		wordOf: (i: number, n: number) => `Word ${i} of ${n}`,
		turn: (name: string) => `${name}’s turn`,
		yourTurn: 'Your turn! Pick a letter.',
		youreNext: 'You’re up next!',
		upNext: (name: string) => `Up next: ${name}`,
		solve: 'Solve it',
		solvePlaceholder: 'The whole word or phrase',
		cancel: 'Back to letters',
		lives: (left: number) => (left === 1 ? '1 life left' : `${left} lives left`),
		letters: 'Letters',
		letter: (ch: string, state: string) => `${ch.toUpperCase()}${state ? `, ${state}` : ''}`,
		hitState: 'in the word',
		missState: 'not in the word',
		hit: (name: string, letter: string, count: number) =>
			count === 1
				? `${name} found ${article(letter)} ${letter.toUpperCase()}`
				: `${name} found ${count} ${letter.toUpperCase()}s`,
		miss: (name: string, letter: string) => `${name} picked ${letter.toUpperCase()}. Not there!`,
		timeout: (name: string) => `${name} ran out of time`,
		wrongSolve: (name: string, text: string) => `${name} guessed “${text}”. Nope!`,
		you: {
			hit: (letter: string, count: number) =>
				count === 1
					? `You found ${article(letter)} ${letter.toUpperCase()}`
					: `You found ${count} ${letter.toUpperCase()}s`,
			miss: (letter: string) => `No ${letter.toUpperCase()} in this one`,
			timeout: 'Out of time',
			wrongSolve: (text: string) => `“${text}”? Nope!`,
			solved: 'You solved it!'
		},
		solvedBy: (name: string) => `${name} solved it!`,
		wordWins: 'The word wins this time',
		gallows: (misses: number, max: number) => `${misses} of ${max} wrong`
	},
	emoji: {
		howTo: 'Read the emojis and type what they spell: a word, a film or a saying.',
		puzzleOf: (i: number, n: number) => `Puzzle ${i} of ${n}`,
		guessPlaceholder: 'Your guess',
		guess: 'Guess',
		youGotIt: 'You got it! 🎉',
		got: (d: number, n: number) => `${d} of ${n} got it`,
		answerWas: 'It was'
	},
	maths: {
		howTo: 'Everyone gets the same sum. Type the answer fast. You get three tries.',
		sumOf: (i: number, n: number) => `Sum ${i} of ${n}`,
		answerLabel: 'Your answer',
		send: 'Go',
		solved: (d: number, n: number) => `${d} of ${n} got it`,
		first: 'First!',
		correct: 'Correct! 🎉',
		notIt: (n: number) => `Not ${n.toLocaleString('en')}`,
		triesLeft: (n: number) => (n === 1 ? '1 try left' : `${n} tries left`),
		out: 'Out of tries. Wait for the next one.',
		answerWas: 'The answer is',
		noneYet: 'Nobody yet…'
	},
	clock: {
		howTo:
			'You’ll see a time. When the hidden clock starts, count in your head and tap when it’s up.',
		roundOf: (i: number, n: number) => `Round ${i} of ${n}`,
		target: (s: string) => `Tap at ${s}`,
		getSet: 'Get set…',
		running: 'The clock is running…',
		countInHead: 'Count in your head',
		tap: 'Tap!',
		tapLabel: (s: string) => `Tap when ${s} have passed`,
		tapped: 'Tapped! Wait for the others…',
		tappedCount: (d: number, n: number) => `${d} of ${n} tapped`,
		noTap: 'No tap',
		perfect: 'Perfect!',
		early: (s: string) => `${s} early`,
		late: (s: string) => `${s} late`
	},
	findit: {
		howTo: 'Everyone gets the same grid. Find it and tap it. A wrong tap freezes you for a moment.',
		gridOf: (i: number, n: number) => `Grid ${i} of ${n}`,
		find: (s: string) => `Find ${s}`,
		findOdd: 'Find the odd one out',
		found: (d: number, n: number) => `${d} of ${n} found it`,
		youFound: 'Found it! 🎉',
		frozen: 'Wrong one! Wait a moment…',
		first: 'First!',
		noneYet: 'Nobody yet…'
	},
	anagram: {
		howTo: 'Unscramble the letters to make a word. Faster answers score more.',
		wordOf: (i: number, n: number) => `Word ${i} of ${n}`,
		guessLabel: 'Your answer',
		guess: 'Go',
		shuffle: 'Shuffle letters',
		solved: (d: number, n: number) => `${d} of ${n} got it`,
		youGotIt: 'You got it! 🎉',
		notIt: (text: string) => `“${text}” isn’t it`,
		answerWas: 'It was',
		first: 'First!',
		noneYet: 'Nobody yet…',
		letters: (n: number) => `${n} letters`
	},
	memory: {
		howTo:
			'Tiles light up for a moment. Remember them, then tap them all. One wrong tap ends your turn.',
		roundOf: (i: number, n: number) => `Round ${i} of ${n}`,
		watch: 'Watch closely…',
		tapThem: (n: number) => `Tap the ${n} tiles`,
		found: (d: number, n: number) => `${d} of ${n}`,
		done: (d: number, n: number) => `${d} of ${n} done`,
		perfect: 'Perfect! 🎉',
		oops: 'Oops, wrong tile',
		got: (d: number, n: number) => `${d} of ${n} tiles`,
		tile: (i: number, state: string) => `Tile ${i + 1}${state ? `, ${state}` : ''}`,
		lit: 'lit',
		right: 'right',
		wrong: 'wrong',
		grid: 'Tile grid'
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
			xo: 'Take on the computer. Pick how tough it plays.',
			wordrace: 'A secret five-letter word and six tries. Same rules, no room needed.',
			hangman: 'Pick letters and solve the word before you run out of lives.',
			emoji: 'Decode emoji riddles against the clock. Faster answers score more.',
			maths: 'Mental maths against the clock. Pick a level and beat your best score.',
			clock: 'How good is your sense of time? Tap when you think the hidden clock hits the target.',
			findit:
				'Hunt for the number, emoji or odd one out. The faster you find it, the more you score.',
			anagram: 'Unscramble the letters against the clock. Longer words on harder levels.',
			memory: 'Remember which tiles lit up. One more tile every round.'
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

/** "an A", "a B": by how the letter's name sounds. */
function article(letter: string): string {
	return 'aefhilmnorsx'.includes(letter.toLowerCase()) ? 'an' : 'a';
}

function ordinal(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
