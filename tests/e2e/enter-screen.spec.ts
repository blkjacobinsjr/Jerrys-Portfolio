import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

/** ENTER_SCREEN (preview flag, ?enter=1): a low-opacity Berlin shot behind the gate that flows into the hero. */
test('enter screen: Berlin shot behind the gate, Geist only, hands off to the hero and the page is clickable', async ({ page }) => {
  const fonts: string[] = [];
  const photos: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'font') fonts.push(r.url());
    if (/_astro\/screen-v3/.test(r.url())) photos.push(r.url());
  });
  const errors = await open(page, '/?enter=1');
  const gate = page.locator('[data-enter-screen]');
  await expect(gate).toBeVisible();
  const photo = page.locator('[data-enter-photo]');
  await expect(photo).toHaveCSS('background-image', /screen-v3/);
  expect(Number(await photo.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(0.3);
  await expect(page.locator('.enter-first')).toHaveCSS('font-family', /Geist/);
  const e3 = await page.evaluate(() => document.documentElement.dataset.heroZoom === 'laptop');
  // Desktop E3 reuses the hero's own full-bleed file; everyone else gets the small copy.
  await expect.poll(() => photos.length).toBeGreaterThan(0);
  if (e3) expect(new Set(photos).size).toBe(1);

  const { violations } = await new AxeBuilder({ page }).include('[data-enter-screen]').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.getByRole('button', { name: 'Enter with sound' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.enter)).toBe('done');
  await expect(gate).toBeHidden();
  if (e3) await expect(page.locator('.hero-screen')).toBeVisible();
  expect(fonts.filter((u) => /timeless/i.test(u))).toEqual([]);

  // Click-through (loop-prevention rule 9): the page under the gate takes clicks once it is gone.
  const link = page.locator('#main a[href]').first();
  await link.scrollIntoViewIfNeeded();
  expect(await link.evaluate((el) => el.closest('[inert]') === null)).toBe(true);
  expect(errors).toEqual([]);
});

test('enter screen: off without the query flag, and no Berlin shot is fetched for it', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('[data-enter-screen]')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.dataset.enter ?? null)).toBeNull();
  expect(errors).toEqual([]);
});
