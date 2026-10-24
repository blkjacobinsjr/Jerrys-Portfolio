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

test('enter screen: oil lens (apple-music-effect) on desktop only, name readable after, sounds on the click, music only after it', async ({ page }, info) => {
  const desktop = info.project.name === 'desktop' || info.project.name === 'webkit-desktop';
  const audio: string[] = [];
  page.on('request', (r) => /\/sfx\/(drop|enter|jazz)\./.test(r.url()) && audio.push(r.url().split('/sfx/')[1]!));
  await page.addInitScript(() => {
    const w = window as Window & { __starts?: number[]; __click?: number; __handled?: number };
    w.__starts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<AudioBufferSourceNode['start']>) {
      w.__starts!.push(performance.now());
      return start.apply(this, args);
    };
    addEventListener('click', (e) => ((w.__click = e.timeStamp), (w.__handled = performance.now())), true);
  });
  await page.goto('/?enter=1');
  const title = page.locator('.enter-title');
  if (desktop) {
    // The lens plays (or its 3 s fallback shows the plain name); either way the name ends up visible.
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.enterOil ?? 'off'), { timeout: 20_000 }).toMatch(/settled|off/);
  } else {
    expect(await page.evaluate(() => document.documentElement.dataset.enterOil)).toBeUndefined();
    expect(await page.locator('.enter-oil').count()).toBe(0);
  }
  await expect(title).toHaveCSS('opacity', '1');
  expect(audio.filter((a) => a.startsWith('jazz'))).toEqual([]);
  // Click-through: the lens canvases never take the pointer, so the button underneath gets the click.
  const go = page.locator('.enter-go');
  if (desktop) {
    // A person rests on the button for a few hundred ms before clicking; that is when the click's sounds load.
    await go.hover();
    await expect.poll(() => audio.filter((a) => /^(drop|enter)\./.test(a)).length).toBe(2);
    await page.waitForTimeout(300);
  }
  await go.click();
  await expect(page.locator('html')).toHaveAttribute('data-enter', 'done', { timeout: 5000 });
  await expect.poll(() => audio.some((a) => a.startsWith('jazz')), { timeout: 10_000 }).toBe(true);
  const { starts, click, handled } = await page.evaluate(() => {
    const w = window as Window & { __starts?: number[]; __click?: number; __handled?: number };
    return { starts: w.__starts!, click: w.__click!, handled: w.__handled! };
  });
  expect(starts.length).toBeGreaterThanOrEqual(2);
  // Hovered first on desktop, so the drop and swell were decoded before the click and start within 2 frames.
  // Input delay (event → handler) depends on the GPU: headless software GL holds a frame for ~80 ms. What the
  // code owns is handler → start, which must be synchronous once the sounds are warm.
  console.log(`input delay ${(handled - click).toFixed(1)} ms, handler→first source start ${(starts[0]! - handled).toFixed(1)} ms (${info.project.name})`);
  // Guards the 391 ms regression (sounds awaited behind the leave work). Chromium's headless AudioContext
  // constructor alone costs ~25 ms here; Linux WebKit is reported, not gated.
  if (info.project.name === 'desktop') expect(starts[0]! - handled).toBeLessThan(50);
});
