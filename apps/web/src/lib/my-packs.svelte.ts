import type { PackSummary } from '@games/protocol';

/**
 * Packs this browser created. There are no accounts, so the edit token kept
 * here (or in the edit link) is the only way to change a pack.
 */
export interface MyPack {
	code: string;
	title: string;
	emoji?: string;
	count: number;
	flagged: boolean;
	editToken: string;
}

const KEY = 'games:my-packs';

function load(): MyPack[] {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		return Array.isArray(raw) ? raw : [];
	} catch {
		return [];
	}
}

function save(list: MyPack[]) {
	try {
		localStorage.setItem(KEY, JSON.stringify(list));
	} catch {}
}

class MyPacks {
	list = $state<MyPack[]>(typeof localStorage === 'undefined' ? [] : load());

	get(code: string): MyPack | undefined {
		return this.list.find((p) => p.code === code.toUpperCase());
	}

	remember(summary: PackSummary, editToken: string) {
		const entry: MyPack = {
			code: summary.code,
			title: summary.title,
			emoji: summary.emoji,
			count: summary.count,
			flagged: summary.flagged,
			editToken
		};
		this.list = [entry, ...this.list.filter((p) => p.code !== summary.code)];
		save(this.list);
	}

	forget(code: string) {
		this.list = this.list.filter((p) => p.code !== code);
		save(this.list);
	}
}

export const myPacks = new MyPacks();

/** The private edit link. The token is in the fragment, so it never reaches server logs. */
export function editLink(code: string, token: string): string {
	return `${location.origin}/packs/${code}#${token}`;
}
