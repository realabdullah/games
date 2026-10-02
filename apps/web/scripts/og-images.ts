/**
 * Renders the social share cards in static/og with headless Chromium, using the
 * app's own colour tokens and font. The PNGs are committed, so the Docker build
 * never needs a browser. Re-run after changing a game's name, tagline or art:
 *
 *   bun run --cwd apps/web og
 *
 * Set CHROMIUM_PATH to use a system Chromium instead of Playwright's own.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';
import { catalog, type CatalogEntry } from '../src/lib/catalog';
import { t } from '../src/lib/i18n';
import { OG_IMAGE_SIZE } from '../src/lib/seo';

interface Card {
	file: string;
	kicker: string;
	title: string;
	text: string;
	art: string;
}

const WEB_ROOT = join(import.meta.dir, '..');
const OUT_DIR = join(WEB_ROOT, 'static/og');

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const tile = (game: Pick<CatalogEntry, 'emoji' | 'color'>, size: number) =>
	`<div class="tile" style="--size:${size}px;background:${game.color}">${game.emoji}</div>`;

const live = catalog.filter((g) => g.status === 'live');

/** Up to three rows of tiles, so the grid stays inside the card as games are added. */
const gridCols = Math.max(2, Math.ceil(live.length / 3));
const gridTile = live.length > 6 ? 112 : 130;

const cards: Card[] = [
	{
		file: 'default.png',
		kicker: t.appName,
		title: 'Party games for any group',
		text: t.tagline,
		art: `<div class="grid" style="--cols:${gridCols};--tile:${gridTile}px">${live
			.map((g) => tile(g, gridTile))
			.join('')}</div>`
	},
	...live
		.filter((g) => g.modes.includes('solo'))
		.map((g) => ({
			file: `${g.id}.png`,
			kicker: t.appName,
			title: g.name,
			text: t.solo.intro[g.id] ?? g.tagline,
			art: tile(g, 300)
		}))
];

const rootTokens = async () => {
	const css = await readFile(join(WEB_ROOT, 'src/app.css'), 'utf8');
	const root = css.match(/:root\s*\{[^}]*\}/)?.[0];
	if (!root) throw new Error('No :root block in src/app.css');
	return root;
};

const fontFace = async () => {
	const pkg = Bun.resolveSync('@fontsource-variable/bricolage-grotesque/package.json', WEB_ROOT);
	const font = await readFile(
		join(dirname(pkg), 'files/bricolage-grotesque-latin-wght-normal.woff2')
	);
	return `@font-face {
		font-family: 'Bricolage Grotesque Variable';
		font-weight: 200 800;
		src: url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');
	}`;
};

const logo = await readFile(join(WEB_ROOT, 'src/lib/assets/favicon.svg'), 'utf8');

const page = (card: Card, styles: string) => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
	${styles}
	* { box-sizing: border-box; margin: 0; }
	body {
		width: ${OG_IMAGE_SIZE.width}px;
		height: ${OG_IMAGE_SIZE.height}px;
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 56px;
		padding: 72px 80px;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--font);
		border: 14px solid var(--ink);
	}
	.copy { display: grid; gap: 24px; }
	.kicker { display: flex; align-items: center; gap: 16px; font-size: 34px; font-weight: 800; }
	.kicker svg { width: 60px; height: 60px; }
	h1 { font-size: 84px; line-height: 0.98; font-weight: 800; letter-spacing: -0.02em; }
	p { font-size: 32px; line-height: 1.3; color: var(--ink-soft); font-weight: 500; }
	/* Wrapping flex rows keep a short last row centred. */
	.grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 24px;
		width: calc(var(--cols) * var(--tile) + (var(--cols) - 1) * 24px);
	}
	.tile {
		width: var(--size);
		height: var(--size);
		display: grid;
		place-items: center;
		font-size: calc(var(--size) * 0.55);
		border: 5px solid var(--ink);
		border-radius: calc(var(--size) * 0.18);
		box-shadow: 10px 10px 0 var(--ink);
	}
</style>
</head>
<body>
	<div class="copy">
		<div class="kicker">${logo}${escapeHtml(card.kicker)}</div>
		<h1>${escapeHtml(card.title)}</h1>
		<p>${escapeHtml(card.text)}</p>
	</div>
	${card.art}
</body>
</html>`;

const styles = `${await fontFace()}\n${await rootTokens()}`;
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
	const tab = await browser.newPage({ viewport: OG_IMAGE_SIZE });
	for (const card of cards) {
		await tab.setContent(page(card, styles), { waitUntil: 'load' });
		await tab.evaluate(() => document.fonts.ready);
		await tab.screenshot({ path: join(OUT_DIR, card.file), type: 'png' });
		console.log(`static/og/${card.file}`);
	}
} finally {
	await browser.close();
}
