import { expect, test } from './fixtures';
import { open, scrollToSelector } from './helpers';

test('mounts Liquid Object canvas only on hover of an in-view desktop card, at most one at a time, while static image stays', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = await open(page);
  await scrollToSelector(page, '#work');

  const cards = page.locator('.work-face');
  const first = cards.nth(0);
  const second = cards.nth(1);

  await expect(first.locator('.work-phone')).toBeVisible();
  await expect(page.locator('.work-liquid canvas')).toHaveCount(0);

  if (isMobile) {
    // Touch never loads the host, so a tap only opens the project page.
    await expect(page.locator('[data-work-liquid-host]')).toHaveCount(0);
    await expect(page.locator('.work-liquid canvas')).toHaveCount(0);
    await expect(first.locator('.work-phone')).toBeVisible();
    expect(errors).toEqual([]);
    return;
  }

  // Hovering the first in-view card mounts its Liquid Object canvas and keeps the static image.
  await first.hover();
  await expect(first.locator('.work-liquid[data-ready="true"] canvas')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.work-liquid canvas')).toHaveCount(1);
  await expect(first.locator('.work-phone')).toBeVisible();

  // Pauses when the document becomes hidden (visibilitychange) and resumes when visible.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(first.locator('.work-liquid')).toHaveAttribute('data-paused', 'true');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(first.locator('.work-liquid')).toHaveAttribute('data-paused', 'false');

  // Hovering a second card transfers the single WebGL renderer to the new card.
  await second.scrollIntoViewIfNeeded();
  await second.hover();
  await expect(second.locator('.work-liquid[data-ready="true"] canvas')).toBeVisible({ timeout: 10_000 });
  await expect(first.locator('.work-liquid canvas')).toHaveCount(0);
  await expect(page.locator('.work-liquid canvas')).toHaveCount(1);
  await expect(second.locator('.work-phone')).toBeVisible();

  // Scrolling the card out of the viewport unmounts its renderer.
  await scrollToSelector(page, '#contact');
  await expect(page.locator('.work-liquid canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('keeps only the static image with reduced motion', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await open(page);
  await scrollToSelector(page, '#work');
  const first = page.locator('.work-face').first();
  await expect(first.locator('.work-phone')).toBeVisible();
  if (!isMobile) {
    await first.hover();
    await page.waitForTimeout(500);
  }
  await expect(page.locator('.work-liquid canvas')).toHaveCount(0);
  await expect(first.locator('.work-phone')).toBeVisible();
  expect(errors).toEqual([]);
});

test('keeps only the static image when ?gl=off disables WebGL', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?gl=off');
  await page.waitForLoadState('networkidle');
  await scrollToSelector(page, '#work');
  const first = page.locator('.work-face').first();
  await expect(first.locator('.work-phone')).toBeVisible();
  if (!isMobile) {
    await first.hover();
    await page.waitForTimeout(500);
  }
  await expect(page.locator('.work-liquid canvas')).toHaveCount(0);
  await expect(first.locator('.work-phone')).toBeVisible();
  expect(errors).toEqual([]);
});
