import { expect, type Page } from '@playwright/test';

/** Open the page, wait for islands, and collect console errors for the test to assert on. */
export async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Idle islands (mascot, work, dock) hydrate after load; visible-only islands wait until scrolled to.
  await expect(page.locator('astro-island[client="idle"][ssr]')).toHaveCount(0, { timeout: 10_000 });
  return errors;
}

/** Scroll the real document (works with and without Lenis). */
export async function scrollToSelector(page: Page, selector: string) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start', behavior: 'instant' }), selector);
  await page.waitForTimeout(400);
}
