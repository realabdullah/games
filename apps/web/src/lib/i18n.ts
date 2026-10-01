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
		gamesSoon: 'Games are coming next. For now, this lobby is the whole show.',
		kick: (name: string) => `Remove ${name}`,
		leave: 'Leave room',
		closeRoom: 'Close room',
		offline: 'offline'
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
