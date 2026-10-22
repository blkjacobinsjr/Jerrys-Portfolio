import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, revealInSheet, scrollToSelector } from './helpers';

/**
 * The screenshots in every selected-work drawer (components/WorkGallery.tsx): React Bits Flex Carousel
 * (WebGL) once the drawer is open and the gallery is on screen, the static strip otherwise.
 * It flips with its buttons, the arrow keys and a swipe, announces each step, lets a vertical wheel
 * or touch scroll the drawer, and releases its WebGL context when the drawer closes.
 */
const CHUNK = /\/FlexCarousel\.[^/]+\.js$/;

async function openWork(page: Page, path = '/') {
  await open(page, path);
  // The cards are server-rendered; wait for the island so the first click opens a drawer.
  await expect(page.locator('astro-island:has(.work-list)')).not.toHaveAttribute('ssr', '');
  await scrollToSelector(page, '#work');
  return page.locator('.work-card').count();
}

async function openDrawer(page: Page, index: number) {
  const card = page.locator('.work-card').nth(index);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await card.click();
  const sheet = page.locator('dialog[open]');
  await expect(sheet.locator('[data-overlay]')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-scroll-locked', '');
  return sheet;
}

async function closeDrawer(page: Page, sheet: Locator) {
  const close = sheet.locator('.scrollsheet-close');
  await close.scrollIntoViewIfNeeded();
  await close.click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-scroll-locked', '');
}

/** A horizontal swipe across the carousel that rests before lifting, so it lands on the neighbouring card. */
async function swipe(page: Page, carousel: Locator, direction: -1 | 1, browserName: string) {
  const box = (await carousel.boundingBox())!;
  const y = box.y + box.height * 0.4;
  const from = box.x + box.width * (direction < 0 ? 0.8 : 0.2);
  const to = from + direction * box.width * 0.6;
  if (browserName === 'chromium') {
    // Real touch input through the browser's input pipeline, touch-action included.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + ((to - from) * i) / 10, y }] });
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    return;
  }
  // Playwright cannot drag a finger in WebKit; send the touch pointer events the carousel listens for.
  await carousel.evaluate(
    async (el, { from, to, y }) => {
      const fire = (type: string, x: number) =>
        el.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y, bubbles: true }));
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      fire('pointerdown', from);
      for (let i = 1; i <= 10; i++) {
        fire('pointermove', from + ((to - from) * i) / 10);
        await wait(16);
      }
      await wait(150);
      fire('pointerup', to);
    },
    { from, to, y },
  );
}

test('every work drawer flips through its screenshots with the buttons, the arrow keys and a swipe', async ({ page, browserName }, info) => {
  test.setTimeout(150_000);
  const touch = info.project.name !== 'desktop';
  const count = await openWork(page);
  expect(count).toBeGreaterThanOrEqual(5);

  for (let i = 0; i < count; i++) {
    const sheet = await openDrawer(page, i);
    const label = (await sheet.locator('.detail-title').textContent()) ?? `drawer ${i}`;
    const pageTop = await page.evaluate(() => scrollY);
    await revealInSheet(page, '.work-gallery');

    await expect(sheet.locator('.work-carousel canvas'), label).toBeVisible({ timeout: 15_000 });
    await expect(sheet.locator('.work-gallery .detail-gallery'), `${label} swaps the strip out`).toHaveCount(0);
    const group = sheet.getByRole('group', { name: `${label} screenshots` });
    await expect(group).toBeVisible();
    const carousel = group.locator('.flex-carousel');
    const live = carousel.locator('.flex-carousel__live');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live, label).toHaveText(/, 1 of 3$/);

    const next = group.getByRole('button', { name: 'Next screenshot' });
    const prev = group.getByRole('button', { name: 'Previous screenshot' });
    await next.click();
    await expect(live, `${label} next`).toHaveText(/, 2 of 3$/);
    await next.click();
    await expect(live, `${label} next again`).toHaveText(/, 3 of 3$/);
    await next.click();
    await expect(live, `${label} wraps to the first`).toHaveText(/, 1 of 3$/);
    await prev.click();
    await expect(live, `${label} previous wraps to the last`).toHaveText(/, 3 of 3$/);

    await carousel.focus();
    await page.keyboard.press('ArrowRight');
    await expect(live, `${label} ArrowRight`).toHaveText(/, 1 of 3$/);
    await page.keyboard.press('ArrowRight');
    await expect(live, `${label} ArrowRight again`).toHaveText(/, 2 of 3$/);
    await page.keyboard.press('ArrowLeft');
    await expect(live, `${label} ArrowLeft`).toHaveText(/, 1 of 3$/);

    if (touch) {
      await swipe(page, carousel, -1, browserName);
      await expect(live, `${label} swipe left`).toHaveText(/, 2 of 3$/);
      await swipe(page, carousel, 1, browserName);
      await expect(live, `${label} swipe right`).toHaveText(/, 1 of 3$/);
    }

    expect(await page.evaluate(() => scrollY), `${label} leaves the page behind alone`).toBe(pageTop);
    const gl = await carousel.locator('canvas').evaluateHandle((canvas) => (canvas as HTMLCanvasElement).getContext('webgl2'));
    await closeDrawer(page, sheet);
    expect(Math.abs((await page.evaluate(() => scrollY)) - pageTop), `${label} returns to the same place`).toBeLessThan(2);
    await expect(page.locator('.flex-carousel')).toHaveCount(0);
    expect(await gl.evaluate((context) => context!.isContextLost()), `${label} releases its WebGL context`).toBe(true);
  }
});

test('a reopened drawer starts again on the first screenshot, with its textures cached', async ({ page }) => {
  await openWork(page);
  for (let visit = 1; visit <= 3; visit++) {
    const sheet = await openDrawer(page, 0);
    // Not revealInSheet: scrollsheet leaves data-scrollsheet-at-max off when the same drawer reopens
    // (with or without the carousel), though the drawer is fully open.
    if ((page.viewportSize()?.width ?? 0) < 768) {
      await sheet.locator('.scrollsheet-handle').click();
      await page.waitForTimeout(700);
    }
    await sheet.locator('[data-overlay]').evaluate((panel) => {
      const gallery = panel.querySelector('.work-gallery')!;
      panel.scrollTo({ top: panel.scrollTop + gallery.getBoundingClientRect().top - panel.getBoundingClientRect().top - 24, behavior: 'instant' });
    });
    await expect(sheet.locator('.work-gallery')).toBeInViewport({ ratio: 1 });
    await expect(sheet.locator('.work-carousel canvas')).toBeVisible({ timeout: 15_000 });
    const live = sheet.locator('.flex-carousel__live');
    await expect(live, `visit ${visit}`).toHaveText(/, 1 of 3$/);
    await page.waitForTimeout(600);
    await expect(live, `visit ${visit} stays on the first`).toHaveText(/, 1 of 3$/);
    await sheet.getByRole('button', { name: 'Next screenshot' }).click();
    await expect(live, `visit ${visit} still steps`).toHaveText(/, 2 of 3$/);
    await closeDrawer(page, sheet);
  }
});

test('a vertical wheel or touch scroll over the carousel scrolls the drawer, not the carousel or the page', async ({ page }, info) => {
  test.skip(info.project.name === 'safari', 'Playwright has no wheel or touch scroll gesture in mobile WebKit.');
  // A short laptop, so the drawer still has room to scroll once the carousel is in view.
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1024, height: 640 });
  await openWork(page);
  const sheet = await openDrawer(page, 0);
  const panel = sheet.locator('[data-overlay]');
  await revealInSheet(page, '.work-gallery');
  const carousel = sheet.locator('.flex-carousel');
  await expect(carousel.locator('canvas')).toBeVisible({ timeout: 15_000 });
  // Park the carousel at the bottom of the drawer, so the drawer has room left to scroll.
  await panel.evaluate((el) => {
    const gallery = el.querySelector('.work-gallery')!.getBoundingClientRect();
    el.scrollTo({ top: el.scrollTop + gallery.bottom - Math.min(el.getBoundingClientRect().bottom, innerHeight) + 8, behavior: 'instant' });
  });
  await expect(carousel).toBeInViewport();
  const live = carousel.locator('.flex-carousel__live');
  const before = { top: await panel.evaluate((el) => el.scrollTop), page: await page.evaluate(() => scrollY), live: await live.textContent() };
  const box = (await carousel.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  if (info.project.name === 'desktop') {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 240);
  } else {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.synthesizeScrollGesture', { x, y, yDistance: -240, gestureSourceType: 'touch', speed: 1200 });
    await cdp.detach();
  }

  await expect.poll(() => panel.evaluate((el) => el.scrollTop), 'the drawer scrolls').toBeGreaterThan(before.top);
  expect(await page.evaluate(() => scrollY), 'the page behind stays put').toBe(before.page);
  await expect(live, 'a vertical scroll does not flip the carousel').toHaveText(before.live!);
});

test('the carousel loads only once its gallery is on screen and swaps in without moving anything', async ({ page }, info) => {
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1024, height: 640 });
  const requested: string[] = [];
  page.on('request', (request) => {
    if (CHUNK.test(new URL(request.url()).pathname)) requested.push(request.url());
  });
  let resume = () => {};
  const held = new Promise<void>((resolve) => (resume = resolve));
  await page.route(CHUNK, async (route) => {
    await held;
    await route.continue();
  });
  try {
    await openWork(page);
    const sheet = await openDrawer(page, 0);
    const gallery = sheet.locator('.work-gallery');
    await expect(gallery, 'the gallery starts below the fold').not.toBeInViewport();
    await page.waitForTimeout(800);
    expect(requested, 'no WebGL code before the gallery is on screen').toEqual([]);

    await revealInSheet(page, '.work-gallery');
    await expect.poll(() => requested.length, 'the carousel is requested once the gallery is on screen').toBe(1);
    await expect(sheet.locator('.work-gallery .detail-gallery img'), 'the strip stays while the carousel loads').toHaveCount(3);
    const measure = () =>
      sheet.evaluate((el) => {
        const box = el.querySelector('.work-gallery')!.getBoundingClientRect();
        const link = el.querySelector('.detail-visit')!.getBoundingClientRect();
        return { top: Math.round(box.top), height: Math.round(box.height), link: Math.round(link.top) };
      });
    const before = await measure();
    resume();
    await expect(sheet.locator('.work-carousel canvas')).toBeVisible({ timeout: 15_000 });
    expect(await measure(), 'the carousel fills the strip’s box exactly').toEqual(before);
  } finally {
    resume();
  }
});

test('no axe violations with the carousel running', async ({ page }) => {
  await openWork(page);
  const sheet = await openDrawer(page, 0);
  await revealInSheet(page, '.work-gallery');
  await expect(sheet.locator('.work-carousel canvas')).toBeVisible({ timeout: 15_000 });
  // The caption and counter appear once the intro has played.
  await expect(sheet.locator('.flex-carousel__caption')).toBeVisible({ timeout: 10_000 });
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
  const { violations } = await new AxeBuilder({ page }).include('dialog[open]').withTags(tags).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('changing to reduced motion releases the running carousel and keeps the strip', async ({ page }) => {
  await openWork(page);
  const sheet = await openDrawer(page, 0);
  await revealInSheet(page, '.work-gallery');
  const canvas = sheet.locator('.work-carousel canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const gl = await canvas.evaluateHandle((el) => (el as HTMLCanvasElement).getContext('webgl2'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(sheet.locator('.flex-carousel')).toHaveCount(0);
  await expect(sheet.locator('.detail-gallery img')).toHaveCount(3);
  expect(await gl.evaluate((context) => context!.isContextLost())).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(sheet.locator('.work-carousel canvas')).toBeVisible({ timeout: 15_000 });
});

for (const fallback of ['data saver', 'no WebGL', 'failed chunk']) {
  test(`${fallback} leaves usable screenshot images`, async ({ page }) => {
    if (fallback === 'data saver') {
      await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));
    } else if (fallback === 'no WebGL') {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
          value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
            return type.includes('webgl') ? null : Reflect.apply(original, this, [type, ...args]);
          },
        });
      });
    } else {
      await page.route(CHUNK, (route) => route.abort());
    }
    await openWork(page);
    const sheet = await openDrawer(page, 0);
    await revealInSheet(page, '.work-gallery');
    const strip = sheet.locator('.detail-gallery');
    await expect(strip).toBeVisible();
    await expect(strip.locator('img')).toHaveCount(3);
    await expect.poll(() => strip.locator('img').first().evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.waitForTimeout(600);
    await expect(sheet.locator('.work-gallery canvas')).toHaveCount(0);
    await expect(sheet.locator('.detail-visit')).toHaveAttribute('href', 'https://scenaryo.app/research');
  });
}

for (const { name, path, reduce } of [
  { name: 'reduced motion', path: '/', reduce: true },
  { name: '?gl=off', path: '/?gl=off', reduce: false },
]) {
  test(`${name} keeps the static strip in every work drawer`, async ({ page }) => {
    test.setTimeout(90_000);
    if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
    const requested: string[] = [];
    page.on('request', (request) => {
      if (CHUNK.test(new URL(request.url()).pathname)) requested.push(request.url());
    });
    const count = await openWork(page, path);
    for (let i = 0; i < count; i++) {
      const sheet = await openDrawer(page, i);
      await revealInSheet(page, '.work-gallery');
      const strip = sheet.locator('.work-gallery .detail-gallery');
      await expect(strip).toBeVisible();
      await expect(strip.locator('img')).toHaveCount(3);
      const first = strip.locator('img').first();
      await expect.poll(() => first.evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await page.waitForTimeout(400);
      await expect(sheet.locator('.flex-carousel, .work-gallery canvas')).toHaveCount(0);
      await closeDrawer(page, sheet);
    }
    expect(requested, 'the WebGL carousel is never fetched').toEqual([]);
  });
}
