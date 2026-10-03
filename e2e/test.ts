import { test as base } from '@playwright/test';

export * from '@playwright/test';

/**
 * Tests open a browser context per phone. Close them all after each test so
 * pages don't pile up and slow the next tests down (WebKit keeps animating
 * pages nobody is looking at).
 */
export const test = base.extend<{ closeContexts: void }>({
	closeContexts: [
		async ({ browser }, use) => {
			await use();
			await Promise.all(browser.contexts().map((c) => c.close()));
		},
		{ auto: true }
	]
});
