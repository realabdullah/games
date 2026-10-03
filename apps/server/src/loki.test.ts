import { describe, expect, test } from 'bun:test';
import { LokiShipper, type LokiOptions } from './loki.ts';

function setup(replies: (number | Error)[], opts: Partial<LokiOptions> = {}) {
	const requests: { url: string; init: RequestInit }[] = [];
	const results: [string, number][] = [];
	const fetch = (async (url: string, init: RequestInit) => {
		requests.push({ url, init });
		const reply = replies.shift() ?? 204;
		if (reply instanceof Error) throw reply;
		return new Response(reply === 204 ? null : 'nope', { status: reply });
	}) as unknown as typeof globalThis.fetch;
	const loki = new LokiShipper({
		url: 'https://logs.example.net/',
		user: '123',
		token: 'tok',
		labels: { app: 'games' },
		fetch,
		now: () => 1_700_000_000_000,
		onResult: (r, n) => results.push([r, n]),
		...opts
	});
	const values = (i: number) =>
		JSON.parse(String(requests[i]!.init.body)).streams[0].values as [string, string][];
	return { loki, requests, results, values };
}

describe('LokiShipper', () => {
	test('pushes a batch with basic auth, labels and nanosecond timestamps', async () => {
		const { loki, requests, results, values } = setup([204]);
		loki.push('a');
		loki.push('b');
		await loki.flush();

		expect(requests).toHaveLength(1);
		expect(requests[0]!.url).toBe('https://logs.example.net/loki/api/v1/push');
		expect((requests[0]!.init.headers as Record<string, string>).authorization).toBe(
			`Basic ${btoa('123:tok')}`
		);
		expect(JSON.parse(String(requests[0]!.init.body)).streams[0].stream).toEqual({ app: 'games' });
		expect(values(0)).toEqual([
			['1700000000000000000', 'a'],
			['1700000000000000000', 'b']
		]);
		expect(results).toEqual([['ok', 2]]);
	});

	test('does nothing when there is nothing to send', async () => {
		const { loki, requests } = setup([]);
		await loki.flush();
		expect(requests).toHaveLength(0);
	});

	test('flushes early once a batch is full', async () => {
		const { loki, requests } = setup([], { batchSize: 3 });
		for (const l of ['a', 'b', 'c']) loki.push(l);
		await loki.flush();
		expect(requests).toHaveLength(1);
	});

	test('keeps lines after a network error and sends them next time', async () => {
		const { loki, results, values } = setup([new Error('offline'), 204]);
		loki.push('a');
		await loki.flush();
		loki.push('b');
		await loki.flush();
		expect(values(1).map(([, l]) => l)).toEqual(['a', 'b']);
		expect(results).toEqual([
			['error', 1],
			['ok', 2]
		]);
	});

	test('retries server errors and rate limits, drops other rejections', async () => {
		const { loki, results } = setup([500, 429, 401]);
		loki.push('a');
		await loki.flush();
		await loki.flush();
		await loki.flush();
		await loki.flush();
		expect(results).toEqual([
			['error', 1],
			['error', 1],
			['dropped', 1]
		]);
	});

	test('memory stays bounded while Loki is down: oldest lines go first', async () => {
		const { loki, results, values } = setup([new Error('down'), 204], {
			maxBuffered: 3,
			batchSize: 100
		});
		for (const l of ['a', 'b', 'c', 'd']) loki.push(l);
		expect(results).toEqual([['dropped', 1]]);
		await loki.flush();
		loki.push('e');
		await loki.flush();
		expect(values(1).map(([, l]) => l)).toEqual(['c', 'd', 'e']);
	});

	test('stop sends what is left', async () => {
		const { loki, requests } = setup([204]);
		loki.start();
		loki.push('last words');
		await loki.stop();
		expect(requests).toHaveLength(1);
	});
});
