import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from './fixtures';
import { open } from './helpers';

/**
 * The screenshots on every project page (components/WorkGallery.tsx): React Bits Flex Carousel
 * (WebGL) once the gallery is on screen, the static strip otherwise.
 * It flips with its buttons, the arrow keys and a swipe, announces each step, lets a vertical wheel
 * or touch scroll the page, and releases its WebGL context when reduced motion is switched on.
 */
const CHUNK = /\/FlexCarousel\.[^/]+\.js$/;

/** The project slugs, from the cards on the home page. */
async function slugs(page: Page) {
  await page.goto('/');
  const hrefs = await page.locator('.work-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('href')!));
  return hrefs.map((href) => href.replace('/work/', ''));
}

async function openProject(page: Page, slug: string, query = '') {
  await open(page, `/work/${slug}${query}`);
}

/** Bring the gallery to the middle of the screen the way a visitor scrolls to it. */
async function revealGallery(page: Page) {
  await page.locator('.work-gallery').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('.work-gallery')).toBeInViewport({ ratio: 1 });
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

test('every project page flips through its screenshots with the buttons, the arrow keys and a swipe', async ({ page, browserName }, info) => {
  test.setTimeout(150_000);
  const touch = info.project.name !== 'desktop';
  const all = await slugs(page);
  expect(all.length).toBeGreaterThanOrEqual(5);

  for (const slug of all) {
    await openProject(page, slug);
    const label = (await page.getByRole('heading', { level: 1 }).textContent()) ?? slug;
    await revealGallery(page);
    const pageTop = await page.evaluate(() => scrollY);

    await expect(page.locator('.work-carousel canvas'), label).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.work-gallery .detail-gallery'), `${label} swaps the strip out`).toHaveCount(0);
    const group = page.getByRole('group', { name: `${label} screenshots` });
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

    expect(await page.evaluate(() => scrollY), `${label} leaves the page alone`).toBe(pageTop);
  }
});

test('a revisited project starts again on the first screenshot, with its textures cached', async ({ page }) => {
  test.setTimeout(150_000);
  const [first] = await slugs(page);
  for (let visit = 1; visit <= 3; visit++) {
    await openProject(page, first!);
    await revealGallery(page);
    await expect(page.locator('.work-carousel canvas')).toBeVisible({ timeout: 15_000 });
    const live = page.locator('.flex-carousel__live');
    await expect(live, `visit ${visit}`).toHaveText(/, 1 of 3$/);
    await page.waitForTimeout(600);
    await expect(live, `visit ${visit} stays on the first`).toHaveText(/, 1 of 3$/);
    await page.getByRole('button', { name: 'Next screenshot' }).click();
    await expect(live, `visit ${visit} still steps`).toHaveText(/, 2 of 3$/);
  }
});

test('a vertical wheel or touch scroll over the carousel scrolls the page, not the carousel', async ({ page }, info) => {
  test.skip(info.project.name === 'safari', 'Playwright has no wheel or touch scroll gesture in mobile WebKit.');
  // A short laptop, so the page still has room to scroll once the carousel is in view.
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1024, height: 640 });
  const [first] = await slugs(page);
  await openProject(page, first!);
  await revealGallery(page);
  const carousel = page.locator('.flex-carousel');
  await expect(carousel.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await expect(carousel).toBeInViewport();
  const live = carousel.locator('.flex-carousel__live');
  const before = { page: await page.evaluate(() => scrollY), live: await live.textContent() };
  const box = (await carousel.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  if (info.project.name === 'desktop') {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 240);
  } else {
    // Raw touch points: Chromium 156 no longer scrolls for Input.synthesizeScrollGesture, even on a plain page.
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', dy = 0) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: y - dy }] });
    await touch('touchStart');
    for (let step = 1; step <= 12; step++) {
      await touch('touchMove', step * 20);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    await cdp.detach();
  }

  await expect.poll(() => page.evaluate(() => scrollY), 'the page scrolls').toBeGreaterThan(before.page);
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
    const [first] = await slugs(page);
    await openProject(page, first!);
    const gallery = page.locator('.work-gallery');
    await expect(gallery, 'the gallery starts below the fold').not.toBeInViewport();
    await page.waitForTimeout(800);
    expect(requested, 'no WebGL code before the gallery is on screen').toEqual([]);

    await revealGallery(page);
    await expect.poll(() => requested.length, 'the carousel is requested once the gallery is on screen').toBe(1);
    await expect(page.locator('.work-gallery .detail-gallery img'), 'the strip stays while the carousel loads').toHaveCount(3);
    const measure = () =>
      page.evaluate(() => {
        const box = document.querySelector('.work-gallery')!.getBoundingClientRect();
        const link = document.querySelector('.detail-visit')!.getBoundingClientRect();
        return { top: Math.round(box.top + scrollY), height: Math.round(box.height), link: Math.round(link.top + scrollY) };
      });
    const before = await measure();
    resume();
    await expect(page.locator('.work-carousel canvas')).toBeVisible({ timeout: 15_000 });
    expect(await measure(), 'the carousel fills the strip’s box exactly').toEqual(before);
  } finally {
    resume();
  }
});

test('no axe violations with the carousel running', async ({ page }) => {
  const [first] = await slugs(page);
  await openProject(page, first!);
  await revealGallery(page);
  await expect(page.locator('.work-carousel canvas')).toBeVisible({ timeout: 15_000 });
  // The caption and counter appear once the intro has played.
  await expect(page.locator('.flex-carousel__caption')).toBeVisible({ timeout: 10_000 });
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
  const { violations } = await new AxeBuilder({ page }).include('main').withTags(tags).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('changing to reduced motion releases the running carousel and keeps the strip', async ({ page }) => {
  const [first] = await slugs(page);
  await openProject(page, first!);
  await revealGallery(page);
  const canvas = page.locator('.work-carousel canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const gl = await canvas.evaluateHandle((el) => (el as HTMLCanvasElement).getContext('webgl2'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.flex-carousel')).toHaveCount(0);
  await expect(page.locator('.detail-gallery img')).toHaveCount(3);
  expect(await gl.evaluate((context) => context!.isContextLost())).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.work-carousel canvas')).toBeVisible({ timeout: 15_000 });
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
    const [first] = await slugs(page);
    await openProject(page, first!);
    await revealGallery(page);
    const strip = page.locator('.detail-gallery');
    await expect(strip).toBeVisible();
    await expect(strip.locator('img')).toHaveCount(3);
    await expect.poll(() => strip.locator('img').first().evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.waitForTimeout(600);
    await expect(page.locator('.work-gallery canvas')).toHaveCount(0);
    await expect(page.locator('.detail-visit')).toHaveAttribute('href', 'https://scenaryo.app/research');
  });
}

for (const { name, query, reduce } of [
  { name: 'reduced motion', query: '', reduce: true },
  { name: '?gl=off', query: '?gl=off', reduce: false },
]) {
  test(`${name} keeps the static strip on every project page`, async ({ page }) => {
    test.setTimeout(90_000);
    if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
    const requested: string[] = [];
    page.on('request', (request) => {
      if (CHUNK.test(new URL(request.url()).pathname)) requested.push(request.url());
    });
    const all = await slugs(page);
    for (const slug of all) {
      await openProject(page, slug, query);
      await revealGallery(page);
      const strip = page.locator('.work-gallery .detail-gallery');
      await expect(strip, slug).toBeVisible();
      await expect(strip.locator('img')).toHaveCount(3);
      const first = strip.locator('img').first();
      await expect.poll(() => first.evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true);
      await page.waitForTimeout(400);
      await expect(page.locator('.flex-carousel, .work-gallery canvas')).toHaveCount(0);
    }
    expect(requested, 'the WebGL carousel is never fetched').toEqual([]);
  });
}
