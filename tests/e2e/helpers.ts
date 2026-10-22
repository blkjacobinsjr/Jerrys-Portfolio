import { expect, type Page } from '@playwright/test';

/** Open the page, wait for islands, and collect console errors for the test to assert on. */
export async function open(page: Page, path = '/') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  // Idle islands (mascot, work, dock) hydrate after load; visible-only islands wait until scrolled to.
  await expect(page.locator('astro-island[client="idle"][ssr]')).toHaveCount(0, { timeout: 10_000 });
  // The pages of their own have no media-gated islands, so every after-load island hydrates there.
  if (path.split('?')[0] !== '/') await expect(page.locator('astro-island[client="afterload"][ssr]')).toHaveCount(0, { timeout: 10_000 });
  return errors;
}

/** Scroll the real document (works with and without Lenis). */
export async function scrollToSelector(page: Page, selector: string) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start', behavior: 'instant' }), selector);
  await page.waitForTimeout(400);
}

/** Expand through the public handle, then scroll the native content port. Works in mobile WebKit, which has no Playwright mouse wheel. */
export async function scrollSheetToEnd(page: Page) {
  const sheet = page.locator('dialog[open]');
  if ((page.viewportSize()?.width ?? 0) < 768) await sheet.locator('.scrollsheet-handle').click();
  await expect(sheet).toHaveAttribute('data-scrollsheet-at-max', '');
  await sheet.locator('.sheet').evaluate((panel) => panel.scrollTo({ top: panel.scrollHeight, behavior: 'instant' }));
}

/**
 * Bring a drawer element into reach the way a visitor does: grow the phone sheet to full height first,
 * then scroll the native content port. Letting Playwright scroll a part-height WebKit sheet can snap it shut.
 */
export async function revealInSheet(page: Page, selector: string) {
  const sheet = page.locator('dialog[open]');
  if ((page.viewportSize()?.width ?? 0) < 768) await sheet.locator('.scrollsheet-handle').click();
  await expect(sheet).toHaveAttribute('data-scrollsheet-at-max', '');
  await sheet.locator('.sheet').evaluate((panel, s) => {
    const target = panel.querySelector(s)!;
    panel.scrollTo({ top: panel.scrollTop + target.getBoundingClientRect().top - panel.getBoundingClientRect().top - 24, behavior: 'instant' });
  }, selector);
  await expect(sheet.locator(selector)).toBeInViewport({ ratio: 1 });
}
