/** Lowercase, strip accents, spaces and punctuation, so "Ice-Cream" matches "ice cream". */
export function normalize(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Levenshtein distance, for "so close!" hints. */
export function editDistance(a: string, b: string): number {
	const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let prev = dp[0]!;
		dp[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const tmp = dp[j]!;
			dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = tmp;
		}
	}
	return dp[b.length]!;
}

const LETTER = /[\p{L}\p{N}]/u;

/** Positions of the letters and digits a mask hides. */
export function letterPositions(word: string): number[] {
	return [...word].flatMap((ch, i) => (LETTER.test(ch) ? [i] : []));
}

/**
 * e.g. ["_", "a", "_", " ", "_"]. Spaces and punctuation show; letters show
 * only at `revealed` positions.
 */
export function maskWord(word: string, revealed: readonly number[]): string[] {
	return [...word].map((ch, i) => (!LETTER.test(ch) || revealed.includes(i) ? ch : '_'));
}
