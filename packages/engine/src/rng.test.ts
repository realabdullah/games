import { expect, test } from 'bun:test';
import { createRng } from './rng.ts';

test('same seed gives the same sequence', () => {
	const a = createRng(42);
	const b = createRng(42);
	expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
});

test('state can resume a sequence', () => {
	const a = createRng(7);
	a.next();
	const resumed = createRng(a.state);
	expect(resumed.next()).toBe(a.next());
});

test('shuffle is a permutation and leaves the input alone', () => {
	const input = [1, 2, 3, 4, 5, 6, 7, 8];
	const out = createRng(1).shuffle(input);
	expect(out.toSorted()).toEqual(input);
	expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

test('int stays in range', () => {
	const rng = createRng(3);
	for (let i = 0; i < 1000; i++) {
		const n = rng.int(2, 5);
		expect(n >= 2 && n <= 5).toBe(true);
	}
});
