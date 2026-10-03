import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive a host screen and several phones in separate
 * browser contexts. The game server is started by the tests themselves
 * (see e2e/server.ts) so they can restart it mid-game.
 */
export const E2E_WEB_PORT = 5180;
export const E2E_SERVER_PORT = 3101;

export default defineConfig({
	testDir: 'e2e',
	// *.e2e.ts so `bun test` doesn't pick these up.
	testMatch: '**/*.e2e.ts',
	fullyParallel: false,
	workers: 1,
	timeout: 60_000,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${E2E_WEB_PORT}`,
		trace: 'retain-on-failure'
	},
	projects: [
		{ name: 'chromium', use: devices['Desktop Chrome'] },
		// Every browser on iPhone and iPad (Safari, Brave, Chrome) is WebKit underneath.
		{ name: 'webkit', use: devices['Desktop Safari'] }
	],
	webServer: {
		command: `bun run --cwd apps/web build && bun run --cwd apps/web preview --port ${E2E_WEB_PORT} --strictPort`,
		url: `http://localhost:${E2E_WEB_PORT}`,
		env: { GAME_SERVER: `http://localhost:${E2E_SERVER_PORT}` },
		reuseExistingServer: false,
		timeout: 120_000
	}
});
