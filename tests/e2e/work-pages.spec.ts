import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers';

/**
 * Every selected project has a page of its own (pages/work/[slug].astro), not a drawer: the same
 * story, a gallery whose slides keep a gutter from the screen edge, a lightbox on tap (PhotoSwipe,
 * fetched on the first tap), and a card-to-page view transition on the home page's links.
 */
const PSWP = /photoswipe/i;

async function slugs(page: Page) {
  await page.goto('/');
  const hrefs = await page.locator('.work-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('href')!));
  return hrefs.map((href) => href.replace('/work/', ''));
}

test('each project page has its own title, canonical URL, hero and way back, and loads no WebGL or lightbox code', async ({ page }) => {
  test.setTimeout(90_000);
  const requested: string[] = [];
  page.on('request', (request) => {
    if (/FlexCarousel|photoswipe/i.test(new URL(request.url()).pathname)) requested.push(request.url());
  });
  for (const slug of await slugs(page)) {
    await open(page, `/work/${slug}`);
    const name = (await page.getByRole('heading', { level: 1 }).textContent())!;
    await expect(page).toHaveTitle(new RegExp(name));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://jerrydoughan.com/work/${slug}/`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', new RegExp(name));
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Selected work' })).toHaveAttribute('href', '/#work');
    await expect(page.locator('.detail-facts')).toContainText('Role');
    await expect(page.getByRole('heading', { name: 'What I shaped' })).toBeVisible();
    // The hero image is the LCP: prioritised, sized, and a modern format.
    const hero = page.locator('.work-hero-shot img');
    await expect(hero).toHaveAttribute('fetchpriority', 'high');
    await expect(hero).not.toHaveAttribute('loading', 'lazy');
    expect(Number(await hero.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(await hero.getAttribute('height'))).toBeGreaterThan(0);
    expect(await hero.getAttribute('srcset')).toMatch(/\.webp/);
  }
  expect(requested, 'the carousel and the lightbox are never fetched before they are needed').toEqual([]);
});

test('the home page links each card to its page, and the page repeats the card’s transition names', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Cross-document view transitions are Chromium-only so far.');
  await page.addInitScript(() => addEventListener('pageswap', (event) => sessionStorage.setItem('swap', String(Boolean((event as Event & { viewTransition?: unknown }).viewTransition)))));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  const names = await page.locator('.work-card').evaluateAll((cards) =>
    cards.map((card) => [card.getAttribute('href'), getComputedStyle(card.closest('.work-face')!).viewTransitionName, getComputedStyle(card.closest('.work-face')!.querySelector('.work-phone')!).viewTransitionName]),
  );
  expect(names.length).toBeGreaterThanOrEqual(5);
  for (const [href, face, phone] of names) {
    const id = href!.replace('/work/', '');
    expect([face, phone]).toEqual([`work-${id}`, `phone-${id}`]);
  }
  await page.locator('.work-card').first().click();
  await page.waitForURL('**/work/scenaryo');
  expect(await page.evaluate(() => sessionStorage.getItem('swap')), 'the browser ran a view transition').toBe('true');
  expect(await page.locator('.work-hero').evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe('work-scenaryo');
  expect(await page.locator('.work-hero-shot img').evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe('phone-scenaryo');
});

test('reduced motion changes page without a view transition', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Cross-document view transitions are Chromium-only so far.');
  await page.addInitScript(() => addEventListener('pageswap', (event) => sessionStorage.setItem('swap', String(Boolean((event as Event & { viewTransition?: unknown }).viewTransition)))));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.locator('.work-card').first().click();
  await page.waitForURL('**/work/scenaryo');
  expect(await page.evaluate(() => sessionStorage.getItem('swap'))).toBe('false');
});

test('gallery slides keep a gutter from both screen edges and snap to it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of await slugs(page)) {
    await open(page, `/work/${slug}?gl=off`);
    const strip = page.locator('.work-gallery .detail-gallery');
    await strip.scrollIntoViewIfNeeded();
    const css = await strip.evaluate((el) => {
      const style = getComputedStyle(el);
      return { type: style.scrollSnapType, pad: style.paddingLeft, padEnd: style.paddingRight, scrollPad: style.scrollPaddingLeft, scrollPadEnd: style.scrollPaddingRight };
    });
    expect(css.type, slug).toBe('x mandatory');
    expect(parseFloat(css.pad), slug).toBeGreaterThanOrEqual(16);
    expect([css.padEnd, css.scrollPad, css.scrollPadEnd], `${slug}: padding and scroll padding are one gutter`).toEqual([css.pad, css.pad, css.pad]);
    const edges = async () =>
      strip.evaluate((el) => {
        const view = el.getBoundingClientRect();
        const slides = [...el.children].map((child) => child.getBoundingClientRect());
        return { first: slides[0]!.left - view.left, last: view.right - slides.at(-1)!.right };
      });
    expect((await edges()).first, `${slug} first slide, at rest`).toBeGreaterThanOrEqual(15.5);
    await strip.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
    // The mandatory snap settles one gutter in from the right edge, never flush against it.
    await expect.poll(async () => (await edges()).last, `${slug} last slide, scrolled to the end`).toBeGreaterThanOrEqual(15.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${slug} does not scroll sideways`).toBeLessThanOrEqual(390);
  }
});

/** The gallery is a client:visible island: it hydrates as it nears the screen, and a tap before that follows the link to the image. */
async function hydrated(page: Page) {
  await page.locator('.work-gallery').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('astro-island:has(.work-gallery)')).not.toHaveAttribute('ssr', '');
}

test.describe('lightbox', () => {
  test('opens on a tap, steps with the arrows, closes with Escape and gives focus back', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => PSWP.test(request.url()) && requested.push(request.url()));
    await open(page, '/work/scenaryo?gl=off');
    const shots = page.locator('.work-gallery .work-shot-link');
    await expect(shots).toHaveCount(3);
    await hydrated(page);
    expect(requested, 'nothing is fetched before the first tap').toEqual([]);

    await shots.first().focus();
    await page.keyboard.press('Enter');
    const box = page.locator('.pswp');
    await expect(box).toHaveAttribute('role', 'dialog');
    await expect(box.locator('.pswp__counter')).toHaveText('1 / 3');
    await expect(box).toHaveAttribute('data-opened', '');
    await expect(page.locator('html')).toHaveAttribute('data-scroll-locked', '');
    await expect(box).toHaveAttribute('data-overlay', '');
    expect(requested.length, 'fetched on the first tap').toBeGreaterThan(0);
    await expect(box.locator('.pswp__img').first()).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(box.locator('.pswp__counter')).toHaveText('2 / 3');
    await page.keyboard.press('ArrowLeft');
    await expect(box.locator('.pswp__counter')).toHaveText('1 / 3');
    // Focus stays inside while it is open.
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.pswp')))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('.pswp')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-scroll-locked', '');
    await expect(shots.first()).toBeFocused();
  });

  test('closes with its X and with a tap on the backdrop', async ({ page }) => {
    await open(page, '/work/tiding?gl=off');
    const shots = page.locator('.work-gallery .work-shot-link');
    await hydrated(page);
    await shots.nth(1).click();
    await expect(page.locator('.pswp[data-opened] .pswp__counter')).toHaveText('2 / 3');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.pswp')).toHaveCount(0);

    await shots.nth(2).click();
    await expect(page.locator('.pswp[data-opened] .pswp__counter')).toHaveText('3 / 3');
    // The top-left corner of the screen is backdrop, not the image.
    await page.mouse.click(3, page.viewportSize()!.height - 3);
    await expect(page.locator('.pswp')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-scroll-locked', '');
  });

  test('swiping or dragging down closes it, a drag across steps to the next shot', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Playwright drags a pointer in Chromium desktop only.');
    await open(page, '/work/scenaryo?gl=off');
    const shot = page.locator('.work-gallery .work-shot-link').first();
    await hydrated(page);
    await shot.click();
    const counter = page.locator('.pswp__counter');
    await expect(counter).toHaveText('1 / 3');
    await expect(page.locator('.pswp[data-opened]')).toBeVisible();
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(width / 2 - i * (width / 24), height / 2, { steps: 2 });
    await page.mouse.up();
    await expect(counter).toHaveText('2 / 3');
    await page.waitForTimeout(500);
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(width / 2, height / 2 + i * (height / 20), { steps: 2 });
    await page.mouse.up();
    await expect(page.locator('.pswp')).toHaveCount(0);
  });

  test('a tap on the running carousel opens it on the screenshot in front', async ({ page, browserName }) => {
    await open(page, '/work/scenaryo');
    await hydrated(page);
    const carousel = page.locator('.flex-carousel');
    await expect(carousel.locator('canvas')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Next screenshot' }).click();
    await expect(carousel.locator('.flex-carousel__live')).toHaveText(/, 2 of 3$/);
    const box = (await carousel.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
    await expect(page.locator('.pswp[data-opened] .pswp__counter')).toHaveText('2 / 3');
    await page.keyboard.press('Escape');
    await expect(page.locator('.pswp')).toHaveCount(0);
    await page.getByRole('button', { name: 'View this screenshot full size' }).click();
    await expect(page.locator('.pswp[data-opened] .pswp__counter')).toHaveText('2 / 3');
    await page.keyboard.press('Escape');
    // WebKit does not focus a clicked button, so there is nothing to give back there.
    if (browserName !== 'webkit') await expect(page.getByRole('button', { name: 'View this screenshot full size' })).toBeFocused();
  });

  test('under reduced motion it opens and closes at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/work/scenaryo');
    const shot = page.locator('.work-gallery .work-shot-link').first();
    await hydrated(page);
    await shot.click();
    await expect(page.locator('.pswp__counter')).toHaveText('1 / 3');
    expect(await page.locator('.pswp').evaluate((el) => el.className)).not.toMatch(/pswp--animate_opacity|pswp--zoom-allowed.*pswp--animated-in/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.pswp')).toHaveCount(0, { timeout: 500 });
  });
});
