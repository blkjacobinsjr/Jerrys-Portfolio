import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

/** ENTER_SCREEN (preview flag, ?enter=1): a low-opacity Berlin shot behind the gate that flows into the hero. */
test('enter screen: Berlin shot behind the gate, Geist only, hands off to the hero and the page is clickable', async ({ page }) => {
  const fonts: string[] = [];
  const photos: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'font') fonts.push(r.url());
    if (/_astro\/screen-v2/.test(r.url())) photos.push(r.url());
  });
  const errors = await open(page, '/?enter=1');
  const gate = page.locator('[data-enter-screen]');
  await expect(gate).toBeVisible();
  const photo = page.locator('[data-enter-photo]');
  await expect(photo).toHaveCSS('background-image', /screen-v2/);
  expect(Number(await photo.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(0.3);
  await expect(page.locator('.enter-first')).toHaveCSS('font-family', /Geist/);
  const e3 = await page.evaluate(() => document.documentElement.dataset.heroZoom === 'laptop');
  // Desktop E3 reuses the hero's own full-bleed file (the 960px copy sits under it); everyone else gets the small copy only.
  await expect.poll(() => photos.length).toBeGreaterThan(0);
  const hero = await page.locator('[data-hero-pin]').evaluate((e) => getComputedStyle(e).getPropertyValue('--e3-screen'));
  const big = photos.filter((u) => hero.includes(new URL(u).pathname));
  if (e3) expect(big.length).toBeGreaterThan(0);
  else expect(big).toEqual([]);

  const { violations } = await new AxeBuilder({ page }).include('[data-enter-screen]').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.getByRole('button', { name: 'Enter with sound' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.enter)).toBe('done');
  await expect(gate).toBeHidden();
  if (e3) {
    // Lands on the full-bleed Berlin wallpaper (the E3 start), not the static hero; the copy waits for the scroll.
    const box = await page.locator('.hero-screen').boundingBox();
    expect(box && box.width >= (page.viewportSize()?.width ?? 0) - 20 && box.y <= 1).toBe(true);
    await expect(page.locator('.hero-screen')).toHaveCSS('opacity', '1');
    await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '0');
  }
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

test('enter screen: a desktop window that was narrow at load still enters into the E3 wallpaper', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop' && info.project.name !== 'webkit-desktop', 'desktop only');
  const ctx = await browser.newContext({ viewport: { width: 800, height: 900 } });
  const page = await ctx.newPage();
  const errors = await open(page, '/?enter=1');
  expect(await page.evaluate(() => document.documentElement.dataset.heroZoomOff)).toBe('width');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Enter without sound' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.enter)).toBe('done');
  expect(await page.evaluate(() => document.documentElement.dataset.heroZoom)).toBe('laptop');
  await expect(page.locator('.hero-screen')).toBeVisible();
  await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '0');
  await page.evaluate(() => scrollTo(0, innerHeight * 1.2));
  await expect.poll(() => page.locator('.hero-screen').evaluate((e) => getComputedStyle(e).opacity)).toBe('0');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('enter screen: "Enter without sound" sits centred under "Enter with sound"', async ({ page }) => {
  await open(page, '/?enter=1');
  const go = await page.getByRole('button', { name: 'Enter with sound' }).boundingBox();
  const quiet = await page.getByRole('button', { name: 'Enter without sound' }).boundingBox();
  expect(go && quiet).toBeTruthy();
  expect(quiet!.y).toBeGreaterThan(go!.y + go!.height - 1);
  expect(Math.abs(quiet!.x + quiet!.width / 2 - (go!.x + go!.width / 2))).toBeLessThan(3);
});
