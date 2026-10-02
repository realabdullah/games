/**
 * Builds src/words/allowed.json: every five-letter guess Word Race accepts.
 * Source is Webster's Second (public domain), as shipped at /usr/share/dict/web2
 * on macOS. It has few inflections, so common ones (bears, baked, boxes,
 * going) are added by rule. Over-accepting a few odd words is fine; rejecting
 * a real one is not. Re-run after changing the answer list:
 *
 *   bun packages/content/scripts/allowed-words.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = process.env.DICT_PATH ?? '/usr/share/dict/web2';
const OUT = join(import.meta.dir, '../src/words/allowed.json');
const answers: string[] = (await import('../src/words/answers.json')).words;

const dict = readFileSync(SOURCE, 'utf8')
	.split('\n')
	.filter((w) => /^[a-z]+$/.test(w));
const byLength = (n: number) => dict.filter((w) => w.length === n);

/** Everyday words the 1934 dictionary lacks. */
const EXTRA = `boxes foxes taxes fixes mixes emoji pixel email vegan video photo radar laser
robot nylon jeans pizza pasta salsa sushi tacos gecko panda llama koala sonar turbo disco
blogs vlogs texts apps memes drone selfie`
	.split(/\s+/)
	.filter((w) => w.length === 5);

const words = new Set([...byLength(5), ...answers, ...EXTRA]);
for (const w of byLength(4)) {
	words.add(`${w}s`);
	if (w.endsWith('e')) words.add(`${w}d`).add(`${w}r`);
}
for (const w of byLength(3)) {
	words.add(`${w}ed`).add(`${w}er`).add(`${w}ly`);
	if (/(s|x|z|ch|sh|o)$/.test(w)) words.add(`${w}es`);
	if (w.endsWith('y')) words.add(`${w.slice(0, 2)}ies`);
}
for (const w of byLength(2)) words.add(`${w}ing`);

const sorted = [...words].filter((w) => w.length === 5).sort();
// One long string: about half the size of a JSON array of words.
writeFileSync(OUT, `${JSON.stringify({ source: 'web2', words: sorted.join('') })}\n`);
console.log(`${sorted.length} words -> ${OUT}`);
