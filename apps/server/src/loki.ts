/**
 * Ships log lines to Grafana Loki's push API in batches, so logs live in
 * Grafana Cloud instead of on the VPS disk. Logging never waits on the
 * network: lines go into a bounded in-memory buffer that a timer flushes.
 * If Loki is unreachable, lines are kept up to the buffer limit, then the
 * oldest are dropped (and counted) rather than growing memory.
 */
export interface LokiOptions {
	/** Base URL, e.g. https://logs-prod-012.grafana.net */
	url: string;
	/** Grafana Cloud Loki user (a number) and an access token with logs:write. */
	user: string;
	token: string;
	/** Stream labels. Keep them few and fixed; put per-event details in the line. */
	labels: Record<string, string>;
	flushEveryMs?: number;
	/** Flush early once this many lines are waiting. */
	batchSize?: number;
	/** Most lines held while Loki is unreachable. */
	maxBuffered?: number;
	fetch?: typeof fetch;
	now?: () => number;
	/** Called after each push attempt, for metrics. */
	onResult?: (result: 'ok' | 'error' | 'dropped', lines: number) => void;
}

export class LokiShipper {
	private buffer: [string, string][] = [];
	private timer: ReturnType<typeof setInterval> | undefined;
	private inFlight: Promise<void> | null = null;
	private readonly endpoint: string;
	private readonly auth: string;
	private readonly batchSize: number;
	private readonly maxBuffered: number;
	private readonly fetch: typeof fetch;
	private readonly now: () => number;

	constructor(private opts: LokiOptions) {
		this.endpoint = `${opts.url.replace(/\/$/, '')}/loki/api/v1/push`;
		this.auth = `Basic ${btoa(`${opts.user}:${opts.token}`)}`;
		this.batchSize = opts.batchSize ?? 500;
		this.maxBuffered = opts.maxBuffered ?? 5_000;
		this.fetch = opts.fetch ?? globalThis.fetch;
		this.now = opts.now ?? Date.now;
	}

	start() {
		this.timer ??= setInterval(() => void this.flush(), this.opts.flushEveryMs ?? 5_000);
		// Don't keep the process alive just to ship logs.
		(this.timer as { unref?: () => void }).unref?.();
	}

	/** Queue one line. Cheap and synchronous; never throws. */
	push(line: string) {
		// Loki wants nanoseconds as a string.
		this.buffer.push([`${this.now()}000000`, line]);
		if (this.buffer.length > this.maxBuffered) {
			const extra = this.buffer.length - this.maxBuffered;
			this.buffer.splice(0, extra);
			this.opts.onResult?.('dropped', extra);
		}
		if (this.buffer.length >= this.batchSize) void this.flush();
	}

	/** Send what's waiting. One request at a time; failures keep the lines for next time. */
	flush(): Promise<void> {
		if (this.inFlight || this.buffer.length === 0) return this.inFlight ?? Promise.resolve();
		const batch = this.buffer;
		this.buffer = [];
		this.inFlight = this.send(batch).finally(() => (this.inFlight = null));
		return this.inFlight;
	}

	/** Stop the timer and send the rest, giving up after `timeoutMs`. */
	async stop(timeoutMs = 2_000) {
		clearInterval(this.timer);
		this.timer = undefined;
		const drain = (async () => {
			await this.inFlight;
			await this.flush();
		})();
		await Promise.race([drain, Bun.sleep(timeoutMs)]);
	}

	private async send(batch: [string, string][]) {
		try {
			const res = await this.fetch(this.endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json', authorization: this.auth },
				body: JSON.stringify({ streams: [{ stream: this.opts.labels, values: batch }] }),
				signal: AbortSignal.timeout(10_000)
			});
			const { status } = res;
			if (res.ok) return this.opts.onResult?.('ok', batch.length);
			// A 4xx (bad token, rejected payload) won't succeed on retry: report it and move on.
			if (status >= 400 && status < 500 && status !== 429) {
				console.error(`Loki push rejected: ${status} ${(await res.text()).slice(0, 300)}`);
				return this.opts.onResult?.('dropped', batch.length);
			}
		} catch {
			// Network error or timeout: retry below.
		}
		this.opts.onResult?.('error', batch.length);
		const merged = [...batch, ...this.buffer];
		const extra = merged.length - this.maxBuffered;
		if (extra > 0) this.opts.onResult?.('dropped', extra);
		this.buffer = extra > 0 ? merged.slice(extra) : merged;
	}
}
