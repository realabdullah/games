import { isProfane, type EmojiPuzzle, type Flavour } from '@games/content';
import { emojiPacks, icebreakerPacks } from '@games/content/packs';
import { normalize } from '@games/engine';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { JsonWriter } from './ai.ts';
import type { Db } from './db/index.ts';
import { aiItems, aiUsage } from './db/schema.ts';

/**
 * A growing pool of AI-written content, so groups who know the curated packs
 * by heart still get new riddles and questions.
 *
 * Nothing waits on the AI: a game takes what's already in the pool (from
 * memory, no disk or network) and falls back to curated content. Starting a
 * game may ask for a top-up, which runs in the background, at most one batch
 * per pool at a time and a few batches a day in total, so cost stays bounded
 * however many rooms play.
 */

export type PoolKind = 'emoji' | 'icebreakers';
export const FLAVOURS: Flavour[] = ['naija', 'global'];

export interface PoolItem<T = unknown> {
	key: string;
	item: T;
}

export interface PoolOptions {
	/** Items to ask for per batch. */
	batch: number;
	/** Top up when a pool has fewer than this. */
	minSize: number;
	/** Also top up when the newest item is older than this, so content keeps changing. */
	refreshMs: number;
	/** Oldest items go once a pool is this big, so memory and disk stay bounded. */
	maxSize: number;
	/** Batches per day across all pools. */
	dailyBatches: number;
}

export const DEFAULT_POOL_OPTIONS: PoolOptions = {
	batch: 20,
	minSize: 60,
	refreshMs: 12 * 60 * 60 * 1000,
	maxSize: 1500,
	dailyBatches: 24
};

interface Spec<T> {
	schema: z.ZodType<{ items: unknown[] }>;
	/** How to show an item in the "don't repeat these" list. */
	label(item: T): string;
	system: string;
	prompt(flavour: Flavour, count: number, avoid: string[]): string;
	/** Tidy and check one item; null drops it. */
	accept(raw: unknown, flavour: Flavour): T | null;
	key(item: T): string;
}

// ---------- what to write ----------

const AUDIENCE: Record<Flavour, string> = {
	naija:
		'Nigerians at home and abroad, all ages. Use references most Nigerians know: food, Nollywood, Afrobeats and older Naija hits, everyday life, slang and pidgin, places and festivals. Spell Nigerian words the way Nigerians usually do.',
	global: 'Friends, families and coworkers anywhere in the world. Use references most adults know.'
};

const SAFE = `Keep it family-friendly and kind. No profanity, sex, gore, politics, religion, or jokes about any tribe, ethnic group, region or nationality. Nothing about a real private person.`;

const EMOJI_CATEGORIES: Record<Flavour, string[]> = {
	naija: [
		'Naija food',
		'Nollywood',
		'Naija books',
		'Naija music',
		'Naija slang',
		'Around Naija',
		'Naija life'
	],
	global: ['Movies', 'Food & drink', 'Sayings', 'Compound words']
};

const emojiSpec: Spec<EmojiPuzzle> = {
	schema: z.object({
		items: z.array(
			z.object({
				emoji: z.string().describe('2 to 5 emojis that spell out the answer; no letters'),
				answer: z.string().describe('The answer, lowercase, at most 40 characters'),
				category: z.string().describe('One of the categories given'),
				also: z.array(z.string()).describe('Other spellings to accept; may be empty')
			})
		)
	}),
	system: `You write emoji riddles for a party game: a few emojis spell out a word, a film, a song or a saying, and players race to type it.

Rules:
- Every riddle is solvable: each emoji clearly stands for part of the answer, or the whole row clearly suggests it.
- The answer is something most of the audience knows well. Real titles only; never make one up.
- Use only common emojis that show on older phones. No letters or words in the clue, and no flags (some phones show them as letters).
- ${SAFE}`,
	prompt: (flavour, count, avoid) =>
		`Audience: ${AUDIENCE[flavour]}\nWrite ${count} new riddles, spread across these categories: ${EMOJI_CATEGORIES[flavour].join(', ')}.\nDon't use any of these answers: ${avoid.join('; ')}`,
	accept(raw, flavour) {
		const r = raw as { emoji: string; answer: string; category: string; also: string[] };
		const answer = r.answer.trim().toLowerCase().replace(/\s+/g, ' ');
		const emoji = r.emoji.replace(/\s+/g, '');
		const also = r.also.map((a) => a.trim().toLowerCase()).filter((a) => a && a.length <= 40);
		if (answer.length < 2 || answer.length > 40) return null;
		if (
			!emoji ||
			emoji.length > 24 ||
			/[a-z]/i.test(emoji) ||
			/\p{Regional_Indicator}/u.test(emoji) ||
			!/\p{Extended_Pictographic}/u.test(emoji)
		) {
			return null;
		}
		if (!EMOJI_CATEGORIES[flavour].includes(r.category)) return null;
		if ([answer, ...also].some((a) => isProfane(a))) return null;
		return {
			emoji,
			answer,
			category: r.category,
			...(also.length ? { also: also.slice(0, 3) } : {})
		};
	},
	key: (item) => normalize(item.answer),
	label: (item) => item.answer
};

const icebreakerSpec: Spec<string> = {
	schema: z.object({
		items: z.array(z.string().describe('One question, at most 140 characters, ending in "?"'))
	}),
	system: `You write icebreaker questions for a party game. Everyone answers the same question about themselves, then the group guesses who wrote which answer.

Rules:
- Good questions get answers that are personal, specific and a bit surprising, so friends can tell people apart.
- Short and easy to answer in a sentence. One question each.
- ${SAFE}`,
	prompt: (flavour, count, avoid) =>
		`Audience: ${AUDIENCE[flavour]}\nWrite ${count} new questions.\nDon't repeat or closely copy any of these: ${avoid.join(' | ')}`,
	accept(raw) {
		const text = String(raw).trim().replace(/\s+/g, ' ');
		if (text.length < 12 || text.length > 160 || !text.endsWith('?') || isProfane(text))
			return null;
		return text;
	},
	key: (item) => normalize(item),
	label: (item) => item
};

const SPECS: Record<PoolKind, Spec<unknown>> = {
	emoji: emojiSpec as Spec<unknown>,
	icebreakers: icebreakerSpec as Spec<unknown>
};

/** Curated items, so the AI doesn't write what we already have. */
const CURATED: Record<PoolKind, unknown[]> = {
	emoji: FLAVOURS.flatMap((f) => emojiPacks[f].items),
	icebreakers: FLAVOURS.flatMap((f) => icebreakerPacks[f].items)
};

// ---------- the pool ----------

interface Entry extends PoolItem {
	id: number;
	createdAt: number;
}

export interface PoolEvents {
	batch(info: {
		kind: PoolKind;
		flavour: Flavour;
		result: 'ok' | 'failed';
		added: number;
		ms: number;
	}): void;
}

export class AiPool {
	private pools = new Map<string, Entry[]>();
	/** Every item we have, curated or written, by key, with its label. */
	private known = new Map<PoolKind, Map<string, string>>();
	private inflight = new Set<string>();

	constructor(
		private db: Db,
		private writer: JsonWriter,
		private options: PoolOptions = DEFAULT_POOL_OPTIONS,
		private events: Partial<PoolEvents> = {},
		private now: () => number = Date.now,
		private random: () => number = Math.random
	) {
		for (const kind of Object.keys(SPECS) as PoolKind[]) {
			const spec = SPECS[kind];
			this.known.set(kind, new Map(CURATED[kind].map((i) => [spec.key(i), spec.label(i)])));
			for (const flavour of FLAVOURS) this.pools.set(`${kind}:${flavour}`, []);
		}
		const rows = db.select().from(aiItems).orderBy(asc(aiItems.id)).all();
		for (const row of rows) {
			const pool = this.pools.get(`${row.kind}:${row.flavour}`);
			if (!pool) continue;
			pool.push({ id: row.id, key: row.key, item: JSON.parse(row.item), createdAt: row.createdAt });
			const item = pool.at(-1)!.item;
			this.known.get(row.kind as PoolKind)!.set(row.key, SPECS[row.kind as PoolKind].label(item));
		}
	}

	size(kind: PoolKind, flavour: Flavour): number {
		return this.pools.get(`${kind}:${flavour}`)!.length;
	}

	/** Up to `n` random items, none in `exclude`. Memory only. */
	sample(kind: PoolKind, flavours: Flavour[], n: number, exclude: ReadonlySet<string>): PoolItem[] {
		const pool = flavours.flatMap((f) => this.pools.get(`${kind}:${f}`) ?? []);
		const open = pool.filter((e) => !exclude.has(e.key));
		for (let i = open.length - 1; i > 0; i--) {
			const j = Math.floor(this.random() * (i + 1));
			[open[i], open[j]] = [open[j]!, open[i]!];
		}
		return open.slice(0, n).map(({ key, item }) => ({ key, item }));
	}

	/** Start a background batch for each pool that's small or stale. Never waits. */
	topUp(kind: PoolKind, flavours: Flavour[]) {
		for (const flavour of flavours) {
			if (!this.wantsMore(kind, flavour)) continue;
			void this.refill(kind, flavour);
		}
	}

	private wantsMore(kind: PoolKind, flavour: Flavour): boolean {
		if (this.inflight.has(`${kind}:${flavour}`)) return false;
		const pool = this.pools.get(`${kind}:${flavour}`)!;
		const newest = pool.at(-1)?.createdAt ?? 0;
		return pool.length < this.options.minSize || this.now() - newest > this.options.refreshMs;
	}

	/** One batch. Exposed for tests; normally started by `topUp`. */
	async refill(kind: PoolKind, flavour: Flavour): Promise<number> {
		const id = `${kind}:${flavour}`;
		if (this.inflight.has(id) || !this.takeBudget()) return 0;
		this.inflight.add(id);
		const started = this.now();
		try {
			const spec = SPECS[kind];
			const known = this.known.get(kind)!;
			const avoid = this.sampleKnown(known, 80);
			const out = await this.writer.writeJson(
				spec.system,
				spec.prompt(flavour, this.options.batch, avoid),
				spec.schema
			);
			const fresh: PoolItem[] = [];
			for (const raw of out.items) {
				const item = spec.accept(raw, flavour);
				if (item === null) continue;
				const key = spec.key(item);
				if (!key || known.has(key)) continue;
				known.set(key, spec.label(item));
				fresh.push({ key, item });
			}
			this.store(kind, flavour, fresh);
			this.events.batch?.({
				kind,
				flavour,
				result: 'ok',
				added: fresh.length,
				ms: this.now() - started
			});
			return fresh.length;
		} catch {
			this.events.batch?.({ kind, flavour, result: 'failed', added: 0, ms: this.now() - started });
			return 0;
		} finally {
			this.inflight.delete(id);
		}
	}

	private store(kind: PoolKind, flavour: Flavour, items: PoolItem[]) {
		const pool = this.pools.get(`${kind}:${flavour}`)!;
		const createdAt = this.now();
		for (const { key, item } of items) {
			const row = this.db
				.insert(aiItems)
				.values({ kind, flavour, key, item: JSON.stringify(item), createdAt })
				.onConflictDoNothing()
				.returning({ id: aiItems.id })
				.get();
			if (row) pool.push({ id: row.id, key, item, createdAt });
		}
		const extra = pool.length - this.options.maxSize;
		if (extra > 0) {
			const gone = pool.splice(0, extra);
			this.db
				.delete(aiItems)
				.where(
					inArray(
						aiItems.id,
						gone.map((e) => e.id)
					)
				)
				.run();
			for (const e of gone) this.known.get(kind)!.delete(e.key);
		}
	}

	/** Some existing answers, so the model avoids them. A sample keeps the prompt short. */
	private sampleKnown(known: Map<string, string>, n: number): string[] {
		const all = [...known.values()];
		for (let i = all.length - 1; i > 0 && all.length - i <= n; i--) {
			const j = Math.floor(this.random() * (i + 1));
			[all[i], all[j]] = [all[j]!, all[i]!];
		}
		return all.slice(-n);
	}

	/** Reserve one batch from today's budget, or say no. */
	private takeBudget(): boolean {
		const day = new Date(this.now()).toISOString().slice(0, 10);
		const key = 'pool';
		const used =
			this.db
				.select()
				.from(aiUsage)
				.where(and(eq(aiUsage.day, day), eq(aiUsage.key, key)))
				.get()?.count ?? 0;
		if (used >= this.options.dailyBatches) return false;
		this.db
			.insert(aiUsage)
			.values({ day, key, count: 1 })
			.onConflictDoUpdate({
				target: [aiUsage.day, aiUsage.key],
				set: { count: sql`${aiUsage.count} + 1` }
			})
			.run();
		return true;
	}
}
