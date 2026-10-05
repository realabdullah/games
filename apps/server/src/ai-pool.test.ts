import { describe, expect, test } from 'bun:test';
import { emojiPacks } from '@games/content/packs';
import type { z } from 'zod';
import { AiPool, DEFAULT_POOL_OPTIONS, type PoolOptions } from './ai-pool.ts';
import type { JsonWriter } from './ai.ts';
import { openDb } from './db/index.ts';

const DAY = 24 * 60 * 60 * 1000;

/** Replies with the given batches in turn, and records each prompt. */
function fakeWriter(batches: unknown[][]) {
	const prompts: string[] = [];
	const writer: JsonWriter = {
		async writeJson<T>(_system: string, user: string, schema: z.ZodType<T>) {
			prompts.push(user);
			return schema.parse({ items: batches.shift() ?? [] });
		}
	};
	return { writer, prompts };
}

const riddle = (answer: string, emoji = '🦁🌙', category = 'Nollywood') => ({
	emoji,
	answer,
	category,
	also: []
});

function setup(batches: unknown[][], options: Partial<PoolOptions> = {}, db = openDb(':memory:')) {
	let now = 1_000_000;
	const { writer, prompts } = fakeWriter(batches);
	const batchesSeen: { result: string; added: number }[] = [];
	const pool = new AiPool(
		db,
		writer,
		{ ...DEFAULT_POOL_OPTIONS, ...options },
		{ batch: (b) => batchesSeen.push(b) },
		() => now
	);
	return { pool, db, prompts, batchesSeen, advance: (ms: number) => (now += ms) };
}

describe('AI pool', () => {
	test('keeps good riddles and drops bad ones', async () => {
		const curated = emojiPacks.naija.items[0]!.answer;
		const { pool } = setup([
			[
				riddle('Moon Lion'),
				riddle('spelled out', 'abc'),
				riddle('no emoji', '123'),
				riddle('a flag', '🇳🇬🎉'),
				riddle('wrong category', '🎬', 'Movies'),
				riddle('what the fuck'),
				riddle(curated),
				riddle('moon lion')
			]
		]);
		expect(await pool.refill('emoji', 'naija')).toBe(1);
		expect(pool.sample('emoji', ['naija'], 10, new Set())).toEqual([
			{ key: 'moonlion', item: { emoji: '🦁🌙', answer: 'moon lion', category: 'Nollywood' } }
		]);
	});

	test('icebreakers must be questions', async () => {
		const { pool } = setup([
			['What is your favourite Lagos beach?', 'Tell me about yourself', 'Hi?']
		]);
		expect(await pool.refill('icebreakers', 'naija')).toBe(1);
	});

	test('asks the model to avoid what it already has', async () => {
		const { pool, prompts } = setup([[riddle('moon lion')]]);
		await pool.refill('emoji', 'naija');
		expect(prompts[0]).toContain("Don't use any of these answers");
		const curated = [...emojiPacks.naija.items, ...emojiPacks.global.items].map((i) => i.answer);
		expect(curated.some((answer) => prompts[0]!.includes(answer))).toBe(true);
	});

	test('sampling skips what the room has played and never waits', async () => {
		const { pool } = setup([[riddle('one'), riddle('two'), riddle('three')]]);
		await pool.refill('emoji', 'naija');
		const picked = pool.sample('emoji', ['naija'], 5, new Set(['one', 'two']));
		expect(picked.map((p) => p.key)).toEqual(['three']);
		expect(pool.sample('emoji', ['global'], 5, new Set())).toEqual([]);
	});

	test('stops at the daily budget', async () => {
		const { pool, advance } = setup([[riddle('one')], [riddle('two')], [riddle('three')]], {
			dailyBatches: 2
		});
		await pool.refill('emoji', 'naija');
		await pool.refill('emoji', 'global');
		expect(await pool.refill('emoji', 'naija')).toBe(0);
		advance(DAY);
		expect(await pool.refill('emoji', 'naija')).toBe(1); // a new day, a new budget
	});

	test('tops up only when small or stale, one batch at a time', async () => {
		const { pool, advance, batchesSeen } = setup(
			[[riddle('one'), riddle('two')], [riddle('three')], [riddle('four')]],
			{ minSize: 2, refreshMs: DAY }
		);
		pool.topUp('emoji', ['naija']);
		pool.topUp('emoji', ['naija']); // already running
		await Bun.sleep(0);
		expect(batchesSeen).toHaveLength(1);
		pool.topUp('emoji', ['naija']); // big enough and fresh
		await Bun.sleep(0);
		expect(batchesSeen).toHaveLength(1);
		advance(DAY + 1);
		pool.topUp('emoji', ['naija']); // stale
		await Bun.sleep(0);
		expect(batchesSeen).toHaveLength(2);
	});

	test('drops the oldest past the size cap, and reloads after a restart', async () => {
		const db = openDb(':memory:');
		const first = setup([[riddle('one'), riddle('two')], [riddle('three')]], { maxSize: 2 }, db);
		await first.pool.refill('emoji', 'naija');
		await first.pool.refill('emoji', 'naija');
		const keys = (p: AiPool) =>
			p
				.sample('emoji', ['naija'], 10, new Set())
				.map((i) => i.key)
				.sort();
		expect(keys(first.pool)).toEqual(['three', 'two']);
		const restarted = setup([], {}, db);
		expect(keys(restarted.pool)).toEqual(['three', 'two']);
	});

	test('a failed batch is reported, not thrown', async () => {
		const db = openDb(':memory:');
		const pool = new AiPool(db, {
			writeJson: () => Promise.reject(new Error('down'))
		});
		expect(await pool.refill('emoji', 'naija')).toBe(0);
	});
});
