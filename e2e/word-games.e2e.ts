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

async function solo(browser: Browser, gameName: string, path: string) {
	const page = await (await browser.newContext(PHONE)).newPage();
	await page.goto('/');
	await page
		.locator('.game', { hasText: gameName })
		.getByRole('link', { name: 'Play solo' })
		.click();
	await expect(page).toHaveURL(new RegExp(`/solo/${path}$`));
	await page.getByRole('button', { name: 'Start game' }).click();
	await page.getByRole('button', { name: 'Start now' }).click();
	return page;
}

test('Word Race solo: refuses non-words, colours real guesses', async ({ browser }) => {
	const page = await solo(browser, 'Word Race', 'wordrace');
	await expect(page.getByText('Word 1 of 3')).toBeVisible();

	await page.keyboard.type('qzxvj');
	await page.keyboard.press('Enter');
	await expect(page.getByText('“QZXVJ” isn’t in the word list')).toBeVisible();

	// Fix it with the on-screen keyboard.
	for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Delete letter' }).click();
	for (const letter of 'crane')
		await page.getByRole('button', { name: letter.toUpperCase(), exact: true }).click();
	await page.getByRole('button', { name: 'Enter' }).click();
	await expect(page.locator('.tile.hit, .tile.near, .tile.miss')).toHaveCount(5);
	await shot(page, 'wordrace-solo-guess');

	await page.getByRole('button', { name: 'Skip timer' }).click();
	await expect(page.getByText('The word was')).toBeVisible();
});

test('Hangman solo: letters, a wrong solve, and lives', async ({ browser }) => {
	const page = await solo(browser, 'Hangman', 'hangman');
	await expect(page.getByText('Your turn! Pick a letter.')).toBeVisible();
	await expect(page.getByText('6 lives left')).toBeVisible();

	await page.getByRole('button', { name: 'Solve it' }).click();
	await page.getByPlaceholder('The whole word or phrase').fill('not the answer at all');
	await page.getByRole('button', { name: 'Solve it' }).click();
	await expect(page.getByText('5 lives left')).toBeVisible();

	await page.getByRole('button', { name: 'E', exact: true }).click();
	await expect(page.getByRole('button', { name: /^E, / })).toBeDisabled();
	await shot(page, 'hangman-solo');
});

test('Emoji Riddles party: guesses show on the big screen', async ({ browser }) => {
	const host = await (
		await browser.newContext({ viewport: { width: 1280, height: 800 } })
	).newPage();
	await host.goto('/');
	await host.getByRole('button', { name: 'Host on a big screen' }).click();
	await expect(host).toHaveURL(/\/host\/[A-Z]{4}$/);
	const code = host.url().split('/').pop()!;
	await host
		.getByRole('group', { name: 'Pick a game' })
		.getByRole('button', { name: /Emoji Riddles/ })
		.click();
	await host.getByLabel('Puzzles', { exact: true }).selectOption('5');

	const phones: Page[] = [];
	for (const name of ['Ada', 'Bob']) {
		const phone = await (await browser.newContext(PHONE)).newPage();
		await phone.goto(`/play/${code}`);
		await phone.getByLabel('Your name').fill(name);
		await phone.getByRole('button', { name: 'Join' }).click();
		await expect(phone.getByText('You’re in!')).toBeVisible();
		phones.push(phone);
	}

	await host.getByRole('button', { name: 'Start game' }).click();
	await host.getByRole('button', { name: 'Start now' }).click();
	await expect(host.getByText('Puzzle 1 of 5')).toBeVisible();

	await phones[0]!.getByPlaceholder('Your guess').fill('definitely wrong');
	await phones[0]!.getByRole('button', { name: 'Guess' }).click();
	await expect(host.getByText('definitely wrong')).toBeVisible();
	await shot(host, 'emoji-host');

	await host.getByRole('button', { name: 'Skip timer' }).click();
	await expect(host.getByRole('button', { name: 'Next' })).toBeVisible();
	await expect(phones[1]!.getByText('It was')).toBeVisible();
});
