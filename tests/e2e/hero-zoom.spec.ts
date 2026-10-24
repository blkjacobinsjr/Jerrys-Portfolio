import { expect, test } from '@playwright/test';
import { open } from './helpers';

/** E3 hero (t154): desktop + fine pointer only. Phones get the production hero with no extra bytes. */
test('E3 hero: desktop opens full-bleed, lands on the desk, zero errors; phones get the static hero and no E3 bytes', async ({ page }, info) => {
  const e3Requests: string[] = [];
  page.on('request', (r) => {
    if (/screen-v2|desk-nolaptop|desk-landed|hero-screen-v2|hero-laptop/.test(r.url())) e3Requests.push(r.url());
  });
  const errors = await open(page);
  const mode = await page.evaluate(() => document.documentElement.dataset.heroZoom ?? null);
  const fine = await page.evaluate(() => matchMedia('(min-width: 900px) and (any-hover: hover) and (any-pointer: fine)').matches && CSS.supports('animation-timeline: scroll()'));
  // The desk is always shown: the static image, or, once the 3D laptop is ready, the laptop-free desk under it.
  const is3d = await page.evaluate(() => 'hero3d' in document.documentElement.dataset);
  await expect(page.locator(is3d ? '[data-hero-art] > .hero-bare' : '[data-hero-art] > picture img')).toBeVisible();
  if (!fine) {
    expect(mode).toBeNull();
    // Off with a reason, and phones (no fine pointer anywhere) never pass a re-check either.
    expect(await page.evaluate(() => document.documentElement.dataset.heroZoomOff)).toMatch(/^(width|pointer|timeline)$/);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    if (info.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.dataset.heroZoom ?? null)).toBeNull();
    await page.setViewportSize(info.project.use.viewport!);
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

test('E3 hero: a wide touch tablet (no fine pointer) gets no E3 and no E3 bytes', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const e3: string[] = [];
  page.on('request', (r) => /screen-v2|desk-nolaptop|desk-landed|hero-laptop/.test(r.url()) && e3.push(r.url()));
  await page.goto('/');
  await page.evaluate(() => scrollTo(0, 600));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => [document.documentElement.dataset.heroZoom ?? null, document.documentElement.dataset.heroZoomOff])).toEqual([null, 'pointer']);
  expect(e3).toEqual([]);
  await ctx.close();
});
