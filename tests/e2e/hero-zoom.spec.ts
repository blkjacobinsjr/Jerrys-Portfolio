import { expect, test } from '@playwright/test';
import { open } from './helpers';

/** t141 preview: HERO_ZOOM defaults off; ?zoom= switches variants on preview builds only. */
test('hero zoom is off by default: the desk hero as on main, no zoom attribute', async ({ page }) => {
  const errors = await open(page);
  expect(await page.evaluate(() => document.documentElement.dataset.heroZoom ?? null)).toBeNull();
  await expect(page.locator('[data-hero-art] > picture img')).toBeVisible();
  expect(errors).toEqual([]);
});

/** E3 preview (?zoom=laptop): only on builds that ship the preview markup (VERCEL_ENV set at build). */
test.describe('E3 laptop hero', () => {
  test('opens full-bleed, lands on the desk, zero errors, taps pass through', async ({ page }, info) => {
    const errors = await open(page, '/?zoom=laptop');
    const shipped = await page.locator('[data-hero-screen]').count();
    test.skip(!shipped, 'preview markup not in this build');
    expect(await page.evaluate(() => document.documentElement.dataset.heroZoom)).toBe('laptop');
    const screen = page.locator('[data-hero-screen]');
    const vh = await page.evaluate(() => innerHeight);
    const timeline = await page.evaluate(() => CSS.supports('animation-timeline: scroll()'));
    // Headless WebKit has no WebGL here; it gets the CSS-only fallback (overlay fades, static desk).
    if (info.project.name === 'desktop' && timeline) {
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.hero3d ?? null), { timeout: 15000 }).toBe('ready');
    }
    await page.evaluate((y) => scrollTo(0, y), vh * 1.2);
    // Without scroll timelines (WebKit here) the overlay stays off and the hero is the static desk.
    if (timeline) await expect.poll(() => screen.evaluate((e) => getComputedStyle(e).opacity)).toBe('0');
    await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1');
    // Nothing fixed blocks the hero links once the laptop has landed.
    const link = page.locator('.hero-bio a[href="#work"]');
    await link.scrollIntoViewIfNeeded();
    if (info.project.name === 'mobile') await link.tap();
    else await link.click();
    await expect(page).toHaveURL(/#work$/);
    expect(errors).toEqual([]);
  });
});
