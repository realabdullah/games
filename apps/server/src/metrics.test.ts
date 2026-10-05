import { expect, test } from 'bun:test';
import { Metrics, metricsAllowed } from './metrics.ts';

test('metrics are open without a token, and need the exact token once set', () => {
	expect(metricsAllowed(null, null)).toBe(true);
	expect(metricsAllowed(null, 's3cret')).toBe(false);
	expect(metricsAllowed('Bearer nope', 's3cret')).toBe(false);
	expect(metricsAllowed('Bearer s3cret-but-longer', 's3cret')).toBe(false);
	expect(metricsAllowed('Bearer s3cret', 's3cret')).toBe(true);
	expect(metricsAllowed('bearer s3cret', 's3cret')).toBe(true);
});

test('render includes the log-line counter', () => {
	const metrics = new Metrics();
	metrics.logLines.inc({ result: 'ok' }, 3);
	expect(metrics.render()).toContain('games_log_lines_total{result="ok"} 3');
});
