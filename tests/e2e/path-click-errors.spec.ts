import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

// Regression (live 56cf3c0): wheel down the Path section, click a stop that is only partly in view, and the snap
// stopper threw "getTween(...)?.kill is not a function" inside pointerdown and the scroll lock, freezing the page.
test('a stop partly out of view opens its drawer with no page errors, and the page still scrolls after closing', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/GL Driver|WebGL|GPU stall/.test(m.text()) && errors.push(m.text()));
  await open(page);
  const vp = page.viewportSize()!;

  // Reach Path the way a visitor does: wheel on desktop, a touch scroll on phones.
  const path = page.locator('#path');
  const cdp = isMobile ? await page.context().newCDPSession(page) : null;
  // Phones: synthetic vertical touch scrolls do not move this page in headless Chromium, so reach the strip
  // directly; the strip itself is the native touch scroller, and its edge stops are the partly visible ones.
  if (cdp) await scrollToSelector(page, '#path .path-track');
  else await expect(async () => {
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await page.mouse.wheel(0, 500);
    const r = (await path.locator('.path-track').boundingBox())!;
    expect(r.y).toBeLessThan(vp.height * 0.5);
  }).toPass({ timeout: 30_000 });
  if (!isMobile) for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 300);
  await page.waitForTimeout(150);

  // A stop cut by the viewport edge, clicked on its visible part while the strip may still be gliding.
  const target = await page.locator('[data-stop]').evaluateAll((els, w) => {
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.left < w && r.right > w && r.top >= 0) return { id: (el as HTMLElement).dataset.stop!, x: (r.left + w) / 2, y: r.top + r.height / 2 };
    }
    return null;
  }, vp.width);
  expect(target, 'a stop straddles the right edge').not.toBeNull();
  if (isMobile) await page.touchscreen.tap(target!.x, target!.y);
  else await page.mouse.click(target!.x, target!.y);

  await expect(page.locator('dialog[open] [data-overlay]')).toBeVisible();
  await page.locator('dialog[open] .scrollsheet-close').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-scroll-locked', '');

  const y0 = await page.evaluate(() => scrollY);
  // Not frozen: the page scrolls again (a touch scroll on phones has no headless equivalent, so scrollBy there).
  if (cdp) await page.evaluate(() => scrollBy(0, 400));
  else {
    await page.mouse.move(vp.width / 2, 40);
    await page.mouse.wheel(0, 800);
  }
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 50);
  expect(errors).toEqual([]);
});
