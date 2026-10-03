import { expect, test, type Browser, type Page } from './test.ts';
import { E2E_SERVER_PORT } from '../playwright.config.ts';
import { TestServer } from './server.ts';

const server = new TestServer(E2E_SERVER_PORT);
test.beforeAll(() => server.start());
test.afterAll(() => server.dispose());

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function hostRoom(browser: Browser) {
	const host = await (await browser.newContext()).newPage();
	await host.goto('/');
	await host.getByRole('button', { name: 'Host on a big screen' }).click();
	await expect(host).toHaveURL(/\/host\/[A-Z]{4}$/);
	const code = host.url().split('/').pop()!;
	return { host, code };
}

async function joinRoom(browser: Browser, code: string, name: string) {
	const phone = await (await browser.newContext(PHONE)).newPage();
	await phone.goto(`/play/${code}`);
	await phone.getByLabel('Your name').fill(name);
	await phone.getByRole('button', { name: 'Join' }).click();
	await expect(phone.getByText('You’re in! Watch the main screen.')).toBeVisible();
	return phone;
}

async function startTrivia(host: Page, playerCount: number) {
	await expect(host.getByRole('heading', { name: `${playerCount} players` })).toBeVisible();
	await host.getByLabel('Questions', { exact: true }).selectOption('5');
	await host.getByRole('button', { name: 'Start game' }).click();
	await expect(host.getByText('Get ready!')).toBeVisible();
	await host.getByRole('button', { name: 'Start now' }).click();
	await expect(host.getByText('Question 1 of 5')).toBeVisible();
}

const choices = (page: Page) => page.locator('.choice');

test('a host and three phones play a full game of trivia', async ({ browser }) => {
	const { host, code } = await hostRoom(browser);
	const phones = await Promise.all(['Ada', 'Bob', 'Cy'].map((n) => joinRoom(browser, code, n)));
	await startTrivia(host, 3);

	for (let q = 1; q <= 5; q++) {
		await expect(host.getByText(`Question ${q} of 5`)).toBeVisible();
		await expect(host.getByText('0 of 3 answered')).toBeVisible();
		// Everyone answers; the round reveals as soon as the last answer is in.
		for (const [i, phone] of phones.entries()) {
			await choices(phone)
				.nth(i % 2)
				.click();
			if (i < phones.length - 1) await expect(phone.getByText('Locked in!')).toBeVisible();
		}
		await expect(host.getByLabel('Correct answer')).toBeVisible();
		for (const phone of phones) {
			await expect(phone.getByText(/Correct!|Not quite/)).toBeVisible();
		}
		await host.getByRole('button', { name: q < 5 ? 'Next question' : 'See results' }).click();
	}

	await expect(host.getByText('Final scores')).toBeVisible();
	await expect(host.locator('.board .row')).toHaveCount(3);
	for (const phone of phones) await expect(phone.getByText(/\d(st|nd|rd|th) place/)).toBeVisible();

	// Back to the lobby, everyone still there.
	await host.getByRole('button', { name: 'Back to lobby' }).click();
	await expect(host.getByRole('heading', { name: '3 players' })).toBeVisible();
});

test('someone who joins after the game starts can still answer', async ({ browser }) => {
	const { host, code } = await hostRoom(browser);
	const early = await Promise.all(['Ada', 'Bob', 'Cy'].map((n) => joinRoom(browser, code, n)));
	await startTrivia(host, 3);

	// The fourth friend arrives late, mid-question.
	const late = await (await browser.newContext(PHONE)).newPage();
	await late.goto(`/play/${code}`);
	await late.getByLabel('Your name').fill('Dee');
	await late.getByRole('button', { name: 'Join' }).click();

	await expect(host.getByText('0 of 4 answered')).toBeVisible();
	await expect(choices(late).first()).toBeEnabled();
	await choices(late).first().click();
	await expect(late.getByText('Locked in!')).toBeVisible();
	await expect(host.getByText('1 of 4 answered')).toBeVisible();

	for (const phone of early) await choices(phone).first().click();
	await expect(host.getByLabel('Correct answer')).toBeVisible();
	await expect(late.getByText(/Correct!|Not quite/)).toBeVisible();
});

test('a phone that reloads mid-question rejoins the same question', async ({ browser }) => {
	const { host, code } = await hostRoom(browser);
	const phone = await joinRoom(browser, code, 'Ada');
	await joinRoom(browser, code, 'Bob');
	await startTrivia(host, 2);

	const question = await phone.locator('.q').textContent();
	// Like a phone browser discarding the tab: the stored session brings it back.
	await phone.reload();

	await expect(phone.locator('.q')).toHaveText(question!);
	await choices(phone).first().click();
	await expect(phone.getByText('Locked in!')).toBeVisible();
	await expect(host.getByText('1 of 2 answered')).toBeVisible();
});

test('a server restart mid-game picks up where it left off', async ({ browser }) => {
	const { host, code } = await hostRoom(browser);
	const ada = await joinRoom(browser, code, 'Ada');
	const bob = await joinRoom(browser, code, 'Bob');
	await startTrivia(host, 2);

	await choices(ada).first().click();
	await expect(host.getByText('1 of 2 answered')).toBeVisible();
	const question = await host.locator('.q').textContent();

	await server.restart();

	// Everyone reconnects to the same question, with Ada's answer kept.
	await expect(host.locator('.q')).toHaveText(question!, { timeout: 15_000 });
	await expect(host.getByText('1 of 2 answered')).toBeVisible({ timeout: 15_000 });
	await expect(ada.getByText('Locked in!')).toBeVisible({ timeout: 15_000 });

	// Bob taps straight away, possibly while still reconnecting; the tap must not be lost.
	await choices(bob).first().click();
	await expect(host.getByLabel('Correct answer')).toBeVisible({ timeout: 15_000 });
	await expect(host.getByRole('button', { name: 'Next question' })).toBeVisible();
});

test('a crash (no shutdown) recovers from the periodic snapshot', async ({ browser }) => {
	const { host, code } = await hostRoom(browser);
	const ada = await joinRoom(browser, code, 'Ada');
	await joinRoom(browser, code, 'Bob');
	await startTrivia(host, 2);

	await choices(ada).first().click();
	await expect(host.getByText('1 of 2 answered')).toBeVisible();
	const question = await host.locator('.q').textContent();
	// Give the periodic snapshot (every 500ms in tests) a moment to catch the answer.
	await host.waitForTimeout(1200);

	await server.crash();
	await server.start();

	await expect(host.locator('.q')).toHaveText(question!, { timeout: 15_000 });
	await expect(host.getByText('1 of 2 answered')).toBeVisible({ timeout: 15_000 });
	await expect(ada.getByText('Locked in!')).toBeVisible({ timeout: 15_000 });
});

test('solo trivia runs entirely in the browser', async ({ browser }) => {
	const page = await (await browser.newContext(PHONE)).newPage();
	await page.goto('/solo/trivia');
	await page.getByLabel('Questions', { exact: true }).selectOption('5');
	await page.getByRole('button', { name: 'Start game' }).click();
	await page.getByRole('button', { name: 'Start now' }).click();
	for (let q = 1; q <= 5; q++) {
		await expect(page.getByText(`Question ${q} of 5`)).toBeVisible();
		await choices(page).first().click();
		await page.getByRole('button', { name: q < 5 ? 'Next question' : 'See results' }).click();
	}
	await expect(page.getByText('1st place')).toBeVisible();
});
