import { expect, test } from 'bun:test';
import { metricsAllowed } from './metrics.ts';

test('metrics are open without a token, and need the exact token once set', () => {
	expect(metricsAllowed(null, null)).toBe(true);
	expect(metricsAllowed(null, 's3cret')).toBe(false);
	expect(metricsAllowed('Bearer nope', 's3cret')).toBe(false);
	expect(metricsAllowed('Bearer s3cret-but-longer', 's3cret')).toBe(false);
	expect(metricsAllowed('Bearer s3cret', 's3cret')).toBe(true);
	expect(metricsAllowed('bearer s3cret', 's3cret')).toBe(true);
});
