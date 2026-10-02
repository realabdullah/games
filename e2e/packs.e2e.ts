import { expect, test, type Page } from '@playwright/test';
import { E2E_SERVER_PORT } from '../playwright.config.ts';
import { TestServer } from './server.ts';

const server = new TestServer(E2E_SERVER_PORT);
test.beforeAll(() => server.start());
test.afterAll(() => server.dispose());

/** Open the host's pack chooser and pick a pack by its share code. */
async function useCode(host: Page, code: string) {
	await host
		.getByRole('region', { name: 'Question pack' })
		.getByRole('button', { name: 'Change' })
		.click();
	await host.getByLabel('Pack code').fill(code);
	await host.getByRole('button', { name: 'Use', exact: true }).click();
}

const questions = [
	['Which city is our office in?', ['Lagos', 'Abuja', 'Accra', 'Nairobi'], 0],
	['What do we drink most?', ['Coffee', 'Tea', 'Zobo', 'Water'], 2],
	['When is standup?', ['9:00', '9:30', '10:00', '11:00'], 1]
] as const;

async function writePack(page: Page, title: string) {
	await page.goto('/packs/new');
	await page.getByLabel('Pack title').fill(title);
	await page.getByLabel('Short description').fill('How well do we know each other?');
	const cards = page.locator('.question');
	for (const [i, [q, choices, answer]] of questions.entries()) {
		const card = cards.nth(i);
		await card.getByPlaceholder('Type the question').fill(q);
		for (const [j, c] of choices.entries())
			await card.getByLabel(`Choice ${j + 1}`, { exact: true }).fill(c);
		await card.getByLabel(`Mark choice ${answer + 1} as correct`).check();
	}
	await page.getByRole('button', { name: 'Create pack' }).click();
	await expect(page).toHaveURL(/\/packs\/[A-Z2-9]{6}$/);
	return (await page.locator('.share .code').textContent())!.trim();
}

test('write a pack, then host a game with it by code from another device', async ({ browser }) => {
	const author = await (await browser.newContext()).newPage();
	const code = await writePack(author, 'Team Trivia');
	await expect(author.getByRole('heading', { name: 'Team Trivia' })).toBeVisible();

	// A different browser (no saved packs) hosts with the share code.
	const host = await (await browser.newContext()).newPage();
	await host.goto('/');
	await host.getByRole('button', { name: 'Host on a big screen' }).click();
	await expect(host).toHaveURL(/\/host\/[A-Z]{4}$/);
	const roomCode = host.url().split('/').pop()!;

	const phone = await (await browser.newContext()).newPage();
	await phone.goto(`/play/${roomCode}`);
	await phone.getByLabel('Your name').fill('Ada');
	await phone.getByRole('button', { name: 'Join' }).click();

	await useCode(host, code);
	await expect(host.locator('.pack.chosen')).toContainText('Team Trivia');
	await host.getByRole('button', { name: 'Start game' }).click();
	await expect(host.getByText('Team Trivia')).toBeVisible();
	await host.getByRole('button', { name: 'Start now' }).click();
	await expect(host.locator('.q')).toHaveText(/office|drink|standup/);
});

test('the edit link works on another device; the share code alone does not edit', async ({
	browser
}) => {
	const author = await (await browser.newContext()).newPage();
	const code = await writePack(author, 'Edit Me');
	const editToken = await author.evaluate(
		(c) =>
			JSON.parse(localStorage.getItem('games:my-packs')!).find(
				(p: { code: string }) => p.code === c
			).editToken,
		code
	);

	const stranger = await (await browser.newContext()).newPage();
	await stranger.goto(`/packs/${code}`);
	await expect(stranger.getByText('You need this pack’s private edit link')).toBeVisible();

	const otherDevice = await (await browser.newContext()).newPage();
	await otherDevice.goto(`/packs/${code}#${editToken}`);
	await expect(otherDevice.getByLabel('Pack title')).toHaveValue('Edit Me');
	await expect(otherDevice).toHaveURL(new RegExp(`/packs/${code}$`)); // token removed from the URL
	await otherDevice.getByLabel('Pack title').fill('Edited');
	await otherDevice.getByRole('button', { name: 'Save changes' }).click();
	await expect(otherDevice.getByRole('heading', { name: 'Edited' })).toBeVisible();
});

test('flagged packs are blocked until the host turns the family filter off', async ({
	browser,
	request
}) => {
	const q = (text: string) => ({ q: text, choices: ['a', 'b'], answer: 0 });
	const res = await request.post('/api/packs', {
		data: {
			game: 'trivia',
			pack: { title: 'Shit jokes', description: '', questions: [q('One?'), q('Two?'), q('Three?')] }
		}
	});
	const { summary } = await res.json();

	const host = await (await browser.newContext()).newPage();
	await host.goto('/');
	await host.getByRole('button', { name: 'Host on a big screen' }).click();
	await expect(host).toHaveURL(/\/host\/[A-Z]{4}$/);
	const roomCode = host.url().split('/').pop()!;
	const phone = await (await browser.newContext()).newPage();
	await phone.goto(`/play/${roomCode}`);
	await phone.getByLabel('Your name').fill('Ada');
	await phone.getByRole('button', { name: 'Join' }).click();

	await useCode(host, summary.code);
	await expect(host.getByText('Has words the family filter blocks')).toBeVisible();
	await expect(host.getByRole('button', { name: 'Start game' })).toBeDisabled();

	await host.getByLabel(/Family filter/).uncheck();
	await expect(host.getByRole('button', { name: 'Start game' })).toBeEnabled();
	await host.getByRole('button', { name: 'Start game' }).click();
	await expect(host.getByText('Get ready!')).toBeVisible();
});

test('AI generation is hidden when the server has no API key', async ({ page }) => {
	await page.goto('/packs/new');
	await expect(page.getByLabel('Pack title')).toBeVisible();
	await expect(page.getByText('Generate with AI')).toHaveCount(0);
});
