/** Fixed-window counter per key. Good enough for one process on one VPS. */
export class RateLimiter {
	private hits = new Map<string, { count: number; resetAt: number }>();

	constructor(
		private opts: { windowMs: number; max: number },
		private now: () => number = Date.now
	) {}

	allow(key: string): boolean {
		const t = this.now();
		const entry = this.hits.get(key);
		if (!entry || t >= entry.resetAt) {
			this.hits.set(key, { count: 1, resetAt: t + this.opts.windowMs });
			return true;
		}
		entry.count++;
		return entry.count <= this.opts.max;
	}

	sweep() {
		const t = this.now();
		for (const [key, entry] of this.hits) if (t >= entry.resetAt) this.hits.delete(key);
	}
}
