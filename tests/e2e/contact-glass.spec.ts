import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

test('FluidGlass mounts over the footer heading only after intent, and reduced motion keeps the plain heading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = await open(page);
  await scrollToSelector(page, '#contact-title');
  await expect(page.locator('.contact-glass')).toHaveCount(0);

  // A wheel never mounts it; a pointer in the footer does (a tap on phones).
  // Mobile WebKit has no Playwright mouse wheel.
  if (test.info().project.name !== 'safari') await page.mouse.wheel(0, 10);
  await page.waitForTimeout(300);
  await expect(page.locator('.contact-glass')).toHaveCount(0);
  await page.mouse.move(200, 300);
  await page.mouse.move(400, 320, { steps: 3 });
  await expect(page.locator('.contact-glass canvas')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#contact-title')).toHaveAttribute('data-glass', '');
  await expect(page.locator('#contact-title')).toHaveAccessibleName('Have an app that should feel this good?');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.contact-glass')).toHaveCount(0);
  await expect(page.locator('#contact-title')).not.toHaveAttribute('data-glass', '');
  expect(errors).toEqual([]);
});
