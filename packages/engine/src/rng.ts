/**
 * Seeded PRNG (mulberry32). Game logic must only use this for randomness so
 * that the same seed + actions always produce the same state — that's what lets
 * a game run identically on the server (rooms) and in the browser (solo), and
 * what makes snapshot/restore and tests deterministic.
 */
export interface Rng {
	/** Float in [0, 1). */
	next(): number;
	/** Integer in [min, max] inclusive. */
	int(min: number, max: number): number;
	pick<T>(items: readonly T[]): T;
	shuffle<T>(items: readonly T[]): T[];
	/** Current internal state, for snapshotting. */
	readonly state: number;
}

export function createRng(seed: number): Rng {
	let s = seed >>> 0;
	const next = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
	return {
		next,
		int,
		pick(items) {
			if (items.length === 0) throw new Error('pick from empty list');
			return items[int(0, items.length - 1)]!;
		},
		shuffle(items) {
			const out = [...items];
			for (let i = out.length - 1; i > 0; i--) {
				const j = int(0, i);
				[out[i], out[j]] = [out[j]!, out[i]!];
			}
			return out;
		},
		get state() {
			return s;
		}
	};
}
