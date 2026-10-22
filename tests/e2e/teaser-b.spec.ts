import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers';

// The hero teaser (21st.dev Minimal Testimonial): the published layout at every width.

async function measure(page: Page) {
  return page.evaluate(() => {
    // Line boxes of an element's text, ignoring inline images such as the company mark.
    const count = (el: Element) => {
      const tops = new Set<number>();
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walk.nextNode(); node; node = walk.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) if (rect.width > 0) tops.add(Math.round(rect.top));
      }
      return tops.size;
    };
    const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const active = document.querySelector('.mt-quote.is-active')!;
    const range = document.createRange();
    range.selectNodeContents(active);
    const text = [...range.getClientRects()].filter((rect) => rect.width > 0);
    return {
      quotes: box('.mt-quotes').toJSON() as DOMRect,
      avatars: box('.mt-avatars').toJSON() as DOMRect,
      teaser: box('.mt').toJSON() as DOMRect,
      link: box('.hero-recs-all').toJSON() as DOMRect,
      textTop: Math.min(...text.map((rect) => rect.top)),
      textBottom: Math.max(...text.map((rect) => rect.bottom)),
      quoteLines: [...document.querySelectorAll('.mt-quote')].map(count),
      nameLines: [...document.querySelectorAll('.mt-name')].map(count),
      roleLines: [...document.querySelectorAll('.mt-role')].map(count),
    };
  });
}

test('the quote, the avatar row and the byline never collide', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.fonts.ready);
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const at = `${width}px ${colorScheme}`;
      const m = await measure(page);
      expect(m.quotes.bottom, `${at}: the quote box ends well above the avatars`).toBeLessThanOrEqual(m.avatars.top - 24);
      expect(m.textTop, `${at}: the quote text starts inside its box`).toBeGreaterThanOrEqual(m.quotes.top - 0.5);
      expect(m.textBottom, `${at}: the quote text ends inside its box`).toBeLessThanOrEqual(m.quotes.bottom + 0.5);
      expect(m.quotes.width, `${at}: the quote uses the full column`).toBeGreaterThanOrEqual(m.teaser.width - 0.5);
      // Every quote fits two lines from 1024px; the narrower columns allow three.
      for (const lines of m.quoteLines) expect(lines, `${at}: quote lines`).toBeLessThanOrEqual(width >= 1024 ? 2 : 3);
      // Phones reserve only the tallest quote (20px x 1.625 per line), no empty floor below it.
      if (width < 768) expect(m.quotes.height, `${at}: no empty space under the quote`).toBeLessThanOrEqual(Math.max(...m.quoteLines) * 32.5 + 1);
      expect(m.nameLines, `${at}: each name on one line`).toEqual([1, 1, 1]);
      expect(m.roleLines, `${at}: each role on one line`).toEqual([1, 1, 1]);
    }
  }
});

test('picking a person crossfades to their quote, by pointer and keyboard', async ({ page }) => {
  await open(page);
  const teaser = page.locator('.mt');
  const quotes = teaser.locator('.mt-quote');
  expect(await quotes.first().evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0\.5s/);
  // Sample the incoming quote's opacity on every frame after the click: it must pass through the middle.
  const opacities = await teaser.getByRole('button', { name: 'Christoph Suessmeier, Exxeta' }).evaluate(async (button: HTMLElement) => {
    const incoming = button.closest('.mt')!.querySelectorAll('.mt-quote')[2]!;
    button.click();
    const seen: number[] = [];
    for (const end = performance.now() + 800; performance.now() < end; ) {
      await new Promise(requestAnimationFrame);
      seen.push(Number(getComputedStyle(incoming).opacity));
    }
    return seen;
  });
  expect(opacities.some((value) => value > 0.05 && value < 0.95), `animates: ${opacities.join(' ')}`).toBe(true);
  expect(opacities.at(-1)).toBe(1);
  await expect(quotes.nth(2)).toHaveClass(/is-active/);
  await expect(teaser.locator('.mt-quote.is-active')).toHaveText('"Extraordinary eye for user experience"');
  await expect(teaser.locator('.mt-author.is-active .mt-name')).toHaveText('Christoph Suessmeier');

  // Colour for the active face, greyscale for the others.
  await page.mouse.move(0, 0);
  const avatars = teaser.locator('.mt-avatar');
  await expect(avatars.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => avatars.evaluateAll((all) => all.map((el) => getComputedStyle(el).filter))).toEqual(['grayscale(1)', 'grayscale(1)', 'none']);

  // Keyboard: Enter and Space pick a person too.
  await avatars.nth(0).focus();
  await page.keyboard.press('Enter');
  await expect(teaser.locator('.mt-quote.is-active')).toHaveText('"One of the scrappiest builders I know"');
  await avatars.nth(1).focus();
  await page.keyboard.press('Space');
  await expect(teaser.locator('.mt-author.is-active .mt-name')).toHaveText('Iñigo Martín-Calero');
});

test('with reduced motion the quote switches at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const teaser = page.locator('.mt');
  expect(await teaser.locator('.mt-quote').first().evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s(, 0s)*$/);
  const opacities = await teaser.getByRole('button', { name: 'Christoph Suessmeier, Exxeta' }).evaluate(async (button: HTMLElement) => {
    const incoming = button.closest('.mt')!.querySelectorAll('.mt-quote')[2]!;
    button.click();
    const seen: number[] = [];
    for (let frame = 0; frame < 10; frame++) {
      await new Promise(requestAnimationFrame);
      seen.push(Number(getComputedStyle(incoming).opacity));
    }
    return seen;
  });
  expect(opacities).toEqual(Array(10).fill(1));
});

test('B is the only teaser: server-rendered, with no style switch', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  expect(html, 'the first paint is already the testimonial: no swap when the island hydrates').toContain('class="mt-quote is-active"');
  expect(html).not.toContain('teaser-switch');
  expect(html).not.toContain('ut-quote');
  await open(page);
  await expect(page.getByRole('radiogroup', { name: 'Testimonial style' })).toHaveCount(0);
  await page.goto('/?t=a');
  await expect(page.locator('.mt-quote.is-active')).toBeVisible();
});
