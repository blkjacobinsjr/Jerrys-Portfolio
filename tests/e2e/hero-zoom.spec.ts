import { expect, test } from '@playwright/test';
import { open } from './helpers';

/** t141 preview: HERO_ZOOM defaults off; ?zoom= switches variants on preview builds only. */
test('hero zoom is off by default: the desk hero as on main, no zoom attribute', async ({ page }) => {
  const errors = await open(page);
  expect(await page.evaluate(() => document.documentElement.dataset.heroZoom ?? null)).toBeNull();
  await expect(page.locator('[data-hero-art] img')).toBeVisible();
  expect(errors).toEqual([]);
});
