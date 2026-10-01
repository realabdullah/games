import { expect, test, type Browser, type Page } from '@playwright/test';
import { E2E_SERVER_PORT } from '../playwright.config.ts';
import { TestServer } from './server.ts';

const server = new TestServer(E2E_SERVER_PORT);
test.beforeAll(() => server.start());
test.afterAll(() => server.dispose());

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const SHOTS = process.env.E2E_SCREENSHOTS;

async function shot(page: Page, name: string) {
	if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function setupRoom(browser: Browser, names: string[]) {
	const host = await (
		await browser.newContext({ viewport: { width: 1280, height: 800 } })
	).newPage();
	await host.goto('/');
	await host.getByRole('button', { name: 'Host on a big screen' }).click();
	await expect(host).toHaveURL(/\/host\/[A-Z]{4}$/);
	const code = host.url().split('/').pop()!;
	const phones: Page[] = [];
	for (const name of names) {
		const phone = await (await browser.newContext(PHONE)).newPage();
		phone.on('pageerror', (e) => console.log(`[${name} pageerror]`, e.message));
		if (process.env.E2E_WS_DEBUG) {
			phone.on('websocket', (ws) =>
				ws.on('framereceived', (f) => {
					const msg = JSON.parse(String(f.payload));
					const v = msg.view ?? msg.game?.view;
					console.log(
						`[${name} ws]`,
						msg.type,
						v ? `${v.phase} cur=${v.current?.number ?? '-'}` : ''
					);
				})
			);
		}
		await phone.goto(`/play/${code}`);
		await phone.getByLabel('Your name').fill(name);
		await phone.getByRole('button', { name: 'Join' }).click();
		await expect(phone.getByText('You’re in!')).toBeVisible();
		phones.push(phone);
	}
	return { host, phones };
}

async function start(host: Page, gameName: string, settings: Record<string, string> = {}) {
	await host.locator('.game', { hasText: gameName }).click();
	for (const [label, value] of Object.entries(settings)) {
		await host.getByLabel(label, { exact: true }).selectOption(value);
	}
	await host.getByRole('button', { name: 'Start game' }).click();
	await host.getByRole('button', { name: 'Start now' }).click();
}

test('Who Said It? — answer, guess, reveal, final', async ({ browser }) => {
	const { host, phones } = await setupRoom(browser, ['Ada', 'Bob', 'Cy']);
	await start(host, 'Who Said It?', { Rounds: '1' });

	const answers = ['I want to learn the cello', 'Pottery, obviously', 'Skydiving over Lagos'];
	for (const [i, phone] of phones.entries()) {
		await phone.getByLabel('Your answer').fill(answers[i]!);
		await shot(phone, 'ice-phone-write');
		await phone.getByRole('button', { name: 'Send' }).click();
	}

	for (let n = 1; n <= 3; n++) {
		await expect(host.getByText(`Answer ${n} of 3`)).toBeVisible();
		if (n === 1) await shot(host, 'ice-host-guess');
		// Each phone guesses the first person offered (authors see "yours").
		for (const phone of phones) {
			// Guess buttons, the "it's yours" note, or (once everyone else has guessed) the result.
			await expect(phone.locator('.person, .note, .result').first()).toBeVisible();
			if (!(await phone.locator('.person').first().isVisible())) continue;
			await phone.locator('.person').first().click();
		}
		await expect(host.getByText('It was')).toBeVisible();
		if (n === 1) {
			await shot(host, 'ice-host-reveal');
			await shot(phones[0]!, 'ice-phone-reveal');
		}
		await host.getByRole('button', { name: 'Next' }).click();
	}
	await expect(host.getByText('Final scores')).toBeVisible();
	await shot(host, 'ice-host-final');
});

test('Quick Wit — two prompts each, vote, sweep, final', async ({ browser }) => {
	const { host, phones } = await setupRoom(browser, ['Ada', 'Bob', 'Cy']);
	await start(host, 'Quick Wit', { Rounds: '1' });
	await shot(host, 'wit-host-write');

	for (const [i, phone] of phones.entries()) {
		for (let k = 0; k < 2; k++) {
			await expect(phone.getByText(`Prompt ${k + 1} of 2`)).toBeVisible();
			if (i === 0 && k === 0) await shot(phone, 'wit-phone-write');
			await phone.locator('textarea').fill(`${['Ada', 'Bob', 'Cy'][i]} joke ${k + 1}`);
			await phone.getByRole('button', { name: 'Send' }).click();
		}
	}

	for (let n = 1; n <= 3; n++) {
		await expect(host.getByText(`${n} of 3`, { exact: true })).toBeVisible();
		if (n === 1) await shot(host, 'wit-host-vote');
		for (const phone of phones) {
			// Vote buttons, or the result once everyone else has voted.
			await expect(phone.locator('.option-btn, .res').first()).toBeVisible();
			const canVote = await phone.locator('.option-btn:not(:disabled)').first().isVisible();
			if (!canVote) continue;
			await phone.locator('.option-btn').first().click();
		}
		await expect(host.getByText(/vote/).first()).toBeVisible();
		await expect(host.getByText('Clean sweep! +200')).toBeVisible();
		if (n === 1) {
			await shot(host, 'wit-host-result');
			await shot(phones[0]!, 'wit-phone-result');
		}
		await host.getByRole('button', { name: 'Next' }).click();
	}
	await expect(host.getByText('Final scores')).toBeVisible();
});

test('Doodle Dash — choose, draw, strokes reach everyone, guess, reveal', async ({ browser }) => {
	const { host, phones } = await setupRoom(browser, ['Ada', 'Bob', 'Cy']);
	await start(host, 'Doodle Dash', { 'Seconds to draw': '60' });

	// Find the drawer: the only phone offered word choices.
	await expect(host.getByText(/is choosing a word/)).toBeVisible();
	let drawer: Page | null = null;
	for (const phone of phones) {
		if (await phone.getByText('Pick a word to draw').isVisible()) drawer = phone;
	}
	expect(drawer).not.toBeNull();
	await shot(drawer!, 'doodle-phone-choose');
	const word = (await drawer!.locator('.choices .btn').first().textContent())!.trim();
	await drawer!.locator('.choices .btn').first().click();

	// Draw a squiggle.
	const canvas = drawer!.locator('canvas');
	await expect(canvas).toBeVisible();
	const box = (await canvas.boundingBox())!;
	await drawer!.mouse.move(box.x + 40, box.y + 40);
	await drawer!.mouse.down();
	for (let i = 0; i <= 20; i++) {
		await drawer!.mouse.move(box.x + 40 + i * 14, box.y + 60 + Math.sin(i / 2) * 40, { steps: 2 });
	}
	await drawer!.mouse.up();

	// The host canvas receives the strokes (it's no longer blank white).
	await expect
		.poll(async () =>
			host.locator('canvas').evaluate((c: HTMLCanvasElement) => {
				const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
				let ink = 0;
				for (let i = 0; i < d.length; i += 16) if (d[i]! < 200) ink++;
				return ink;
			})
		)
		.toBeGreaterThan(20);
	await shot(host, 'doodle-host-draw');
	await shot(drawer!, 'doodle-phone-draw');

	const guessers = phones.filter((p) => p !== drawer);
	await guessers[0]!.getByPlaceholder('Type your guess').fill('banana split');
	await guessers[0]!.getByRole('button', { name: 'Guess' }).click();
	await expect(host.getByText('banana split')).toBeVisible();
	await shot(guessers[0]!, 'doodle-phone-guess');

	for (const g of guessers) {
		await g.getByPlaceholder('Type your guess').fill(word);
		await g.getByRole('button', { name: 'Guess' }).click();
	}
	await expect(host.getByText('The word was')).toBeVisible();
	await expect(host.locator('.word')).toHaveText(word);
	await shot(host, 'doodle-host-reveal');

	// A player who reloads mid-reveal gets the drawing back from the snapshot.
	await guessers[1]!.reload();
	await expect(guessers[1]!.getByText('The word was')).toBeVisible();
});

test('X-O Battle — king of the hill, winner stays on', async ({ browser }) => {
	const { host, phones } = await setupRoom(browser, ['Ada', 'Bob', 'Cy']);
	await start(host, 'X-O Battle', { Matches: '3' });
	await expect(host.getByText('Match 1 of 3')).toBeVisible();
	await shot(host, 'xo-host-turn');

	/** Whoever's turn it is plays the next cell from the list. */
	async function playMoves(cells: number[]) {
		for (const cell of cells) {
			let mover: Page | null = null;
			await expect
				.poll(async () => {
					for (const phone of phones) {
						if (await phone.getByText('Your turn!').isVisible()) {
							mover = phone;
							return true;
						}
					}
					return false;
				})
				.toBe(true);
			const filled = await mover!.locator('.cell .mark').count();
			await mover!.locator('.cell').nth(cell).click();
			// Wait for the move to land before looking for the next player.
			await expect(mover!.locator('.cell .mark')).toHaveCount(filled + 1);
		}
	}

	// X takes the top row.
	await playMoves([0, 3, 1, 4, 2]);
	await expect(host.getByText(/wins!/)).toBeVisible();
	await shot(host, 'xo-host-result');
	await shot(phones[0]!, 'xo-phone-result');

	// The third player is up next and gets a turn in match 2.
	await host.getByRole('button', { name: 'Next' }).click();
	await expect(host.getByText('Match 2 of 3')).toBeVisible();
	await playMoves([0, 1, 2, 4, 3, 5, 7, 6, 8]);
	await expect(host.getByText('It’s a draw!')).toBeVisible();
	await host.getByRole('button', { name: 'Next' }).click();
	await playMoves([0, 3, 1, 4, 2]);
	await host.getByRole('button', { name: 'Next' }).click();
	await expect(host.getByText('Final scores')).toBeVisible();
});
