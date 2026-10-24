import { expect, test } from '@playwright/test';
import { open } from './helpers';

/** E3 hero (t154): desktop + fine pointer only. Phones get the production hero with no extra bytes. */
test('E3 hero: desktop opens full-bleed, lands on the desk, zero errors; phones get the static hero and no E3 bytes', async ({ page }, info) => {
  const e3Requests: string[] = [];
  page.on('request', (r) => {
    if (/screen-v3|desk-nolaptop|desk-landed|hero-screen-v3|hero-laptop|hero-um|hero-frames/.test(r.url())) e3Requests.push(r.url());
  });
  const errors = await open(page);
  const mode = await page.evaluate(() => document.documentElement.dataset.heroZoom ?? null);
  const fine = await page.evaluate(() => matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches && CSS.supports('animation-timeline: scroll()'));
  await expect(page.locator('[data-hero-art] > picture img')).toBeVisible();
  if (!fine) {
    expect(mode).toBeNull();
    await page.evaluate(() => scrollTo(0, innerHeight * 1.2));
    await page.waitForTimeout(500);
    expect(e3Requests).toEqual([]);
    await expect(page.locator('.hero-screen')).toBeHidden();
  } else {
    expect(mode).toBe('laptop');
    // Headless WebKit has no WebGL here; it keeps the CSS-only fallback (overlay fades, landed desk).
    // E3 (three.js, textures, desk layers) loads on the first intent; a real visitor moves the mouse.
    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    await expect.poll(() => page.evaluate(() => 'e3' in document.documentElement.dataset)).toBe(true);
    if (info.project.name === 'desktop') {
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.hero3d ?? null), { timeout: 15000 }).toBe('ready');
    }
    await page.evaluate(() => scrollTo(0, innerHeight * 1.2));
    await expect.poll(() => page.locator('.hero-screen').evaluate((e) => getComputedStyle(e).opacity)).toBe('0');
    await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1');
  }
  // Nothing fixed blocks the hero links.
  const link = page.locator('.hero-bio a[href="#work"]');
  await link.scrollIntoViewIfNeeded();
  if (info.project.name === 'mobile') await link.tap();
  else await link.click();
  await expect(page).toHaveURL(/#work$/);
  expect(errors).toEqual([]);
});

test('E3 hero: reduced motion keeps the static desk', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = await open(page);
  expect(await page.evaluate(() => document.documentElement.dataset.heroZoom ?? null)).toBeNull();
  await expect(page.locator('.hero-screen')).toBeHidden();
  expect(errors).toEqual([]);
  await ctx.close();
});

/** ULTRAMOCK_LAPTOP (preview flag, ?um=1): the frame sequence replaces the three.js laptop on desktop only. */
test('Ultramock laptop: ?um=1 scrubs the frames on desktop and lands on the desk; phones get no frame bytes', async ({ page }, info) => {
  const frames: string[] = [];
  const three: string[] = [];
  page.on('request', (r) => {
    if (/\/hero-um\//.test(r.url())) frames.push(r.url());
    if (/hero-laptop/.test(r.url())) three.push(r.url());
  });
  const errors = await open(page, '/?um=1');
  const fine = await page.evaluate(() => matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches && CSS.supports('animation-timeline: scroll()'));
  if (!fine) {
    await page.evaluate(() => scrollTo(0, innerHeight * 1.2));
    await page.waitForTimeout(500);
    expect(frames).toEqual([]);
    expect(await page.evaluate(() => 'um' in document.documentElement.dataset)).toBe(false);
  } else {
    // Nothing loads before the first intent.
    expect(frames).toEqual([]);
    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    await expect.poll(() => page.evaluate(() => 'um' in document.documentElement.dataset)).toBe(true);
    if (info.project.name === 'desktop') {
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.hero3d ?? null), { timeout: 15000 }).toBe('ready');
      await expect.poll(() => frames.length, { timeout: 15000 }).toBe(90);
      expect(three).toEqual([]);
      // The canvas actually drew something.
      const painted = await page.locator('[data-hero-laptop]').evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 64) if (d[i] > 0) return true;
        return false;
      });
      expect(painted).toBe(true);
    }
    await page.evaluate(() => scrollTo(0, innerHeight * 1.2));
    await expect.poll(() => page.locator('.hero-screen').evaluate((e) => getComputedStyle(e).opacity)).toBe('0');
    await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1');
  }
  // The canvas never blocks the hero links.
  const link = page.locator('.hero-bio a[href="#work"]');
  await link.scrollIntoViewIfNeeded();
  if (info.project.name === 'mobile') await link.tap();
  else await link.click();
  await expect(page).toHaveURL(/#work$/);
  expect(errors).toEqual([]);
});
