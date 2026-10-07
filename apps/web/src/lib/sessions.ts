import { AVATARS, type AvatarId } from '@games/protocol';

/**
 * Session tokens are kept per room code so a refresh, a locked phone or a
 * server restart drops you straight back into your room. Storage can be
 * unavailable (private mode, blocked site data), so every access is guarded.
 * Host screens and players are stored apart so one browser can be both.
 */
export type SessionKind = 'host' | 'play';
const key = (kind: SessionKind, code: string) => `games:${kind}:${code.toUpperCase()}`;
const PROFILE_KEY = 'games:profile';

export function saveSession(kind: SessionKind, code: string, session: string) {
	try {
		localStorage.setItem(key(kind, code), session);
	} catch {}
}

export function loadSession(kind: SessionKind, code: string): string | null {
	try {
		return localStorage.getItem(key(kind, code));
	} catch {
		return null;
	}
}

export function clearSession(kind: SessionKind, code: string) {
	try {
		localStorage.removeItem(key(kind, code));
	} catch {}
}

export interface Profile {
	name: string;
	avatar: AvatarId;
}

/** Remember the last name/avatar so joining the next room is one tap. */
export function loadProfile(): Profile {
	try {
		const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as Profile | null;
		if (p && AVATARS.includes(p.avatar)) return p;
	} catch {}
	return { name: '', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)]! };
}

export function saveProfile(p: Profile) {
	try {
		localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
	} catch {}
}
