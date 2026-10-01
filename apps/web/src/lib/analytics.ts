/**
 * Privacy-friendly analytics via a self-hosted GoatCounter: no cookies, no
 * personal data, so no consent banner. Off unless VITE_GOATCOUNTER_URL is set
 * at build time (e.g. https://stats.example.com).
 *
 * Room and pack codes are stripped from paths before counting, so stats show
 * "/play/:code" rather than which rooms people were in.
 */

interface GoatCounter {
	count(vars: { path: string; title?: string; event?: boolean }): void;
}

declare global {
	interface Window {
		goatcounter?: GoatCounter & { no_onload?: boolean; allow_local?: boolean };
	}
}

const BASE = (import.meta.env.VITE_GOATCOUNTER_URL as string | undefined)?.replace(/\/$/, '');
let loaded = false;

export function initAnalytics() {
	if (!BASE || loaded || typeof document === 'undefined') return;
	loaded = true;
	// We count pages ourselves (with codes stripped), so turn off the automatic first count.
	window.goatcounter = {
		...(window.goatcounter ?? {}),
		no_onload: true
	} as typeof window.goatcounter;
	const script = document.createElement('script');
	script.async = true;
	script.src = `${BASE}/count.js`;
	script.dataset.goatcounter = `${BASE}/count`;
	script.onload = () => trackPage(location.pathname);
	document.head.append(script);
}

/** Replace room and pack codes so paths can't identify a session. */
export function anonymizePath(path: string): string {
	return path
		.replace(/^\/(host|play)\/[A-Za-z]{4}$/, '/$1/:code')
		.replace(/^\/packs\/[A-Za-z0-9]{6}$/, '/packs/:code');
}

export function trackPage(path: string) {
	window.goatcounter?.count?.({ path: anonymizePath(path) });
}

/** Count an event, e.g. trackEvent('game-start', 'trivia'). */
export function trackEvent(name: string, detail?: string) {
	window.goatcounter?.count?.({
		path: detail ? `${name}/${detail}` : name,
		title: detail ? `${name}: ${detail}` : name,
		event: true
	});
}
