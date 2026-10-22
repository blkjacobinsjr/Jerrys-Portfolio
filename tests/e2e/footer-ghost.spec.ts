import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

/** Footer ghost cursor (React Bits GhostCursor): lazy, gated, and invisible to layout. */

const ghostChunk = (page: import('@playwright/test').Page) =>
  page.evaluate(() => performance.getEntriesByType('resource').some((r) => /GhostCursor/.test(r.name)));

test('the ghost cursor is not fetched until the footer nears the viewport, then adds no layout shift', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Coarse pointers never get it.');
  const errors = await open(page);
  expect(await ghostChunk(page)).toBe(false);
  await expect(page.locator('.ghost-cursor')).toHaveCount(0);

  await page.evaluate(() => {
    (window as unknown as { shift: number }).shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { shift: number }).shift += e.value;
    }).observe({ type: 'layout-shift', buffered: false });
  });
  const before = await page.locator('#contact').evaluate((el) => el.getBoundingClientRect().height);
  await scrollToSelector(page, '#contact');

  const ghost = page.locator('#contact .ghost-cursor');
  await expect(ghost).toHaveCount(1);
  await expect(ghost).toHaveCSS('pointer-events', 'none');
  await expect(ghost).toHaveCSS('position', 'absolute');
  await expect(ghost.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
  expect(await ghostChunk(page)).toBe(true);
  expect(await page.locator('#contact').evaluate((el) => el.getBoundingClientRect().height)).toBe(before);
  expect(await page.evaluate(() => (window as unknown as { shift: number }).shift)).toBe(0);
  expect(errors).toEqual([]);
});

test('the ghost colour follows the footer theme', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Coarse pointers never get it.');
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await scrollToSelector(page, '#contact');
    // Dark footer: glowing trail composited with screen. Light footer: ink with normal blending.
    await expect(page.locator('#contact .ghost-cursor canvas')).toHaveCSS('mix-blend-mode', scheme === 'dark' ? 'screen' : 'normal');
  }
});

test('the ghost cursor is skipped with reduced motion and with ?gl=off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await scrollToSelector(page, '#contact');
  await expect(page.locator('#contact h2')).toBeVisible();
  await expect(page.locator('.ghost-cursor')).toHaveCount(0);
  expect(await ghostChunk(page)).toBe(false);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, '/?gl=off');
  await scrollToSelector(page, '#contact');
  await expect(page.locator('#contact h2')).toBeVisible();
  await expect(page.locator('.ghost-cursor')).toHaveCount(0);
  expect(await ghostChunk(page)).toBe(false);
});

test('the ghost cursor is skipped on coarse pointers (phones)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Desktop has a fine pointer.');
  await open(page);
  await scrollToSelector(page, '#contact');
  await expect(page.locator('#contact h2')).toBeVisible();
  await expect(page.locator('.ghost-cursor')).toHaveCount(0);
  expect(await ghostChunk(page)).toBe(false);
});
