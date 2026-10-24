import { expect, test } from './fixtures';
import { open } from './helpers';

test('footer film: nothing fetched until the footer nears, then it plays over the skyline and pauses offscreen', async ({ page }) => {
  const film: string[] = [];
  page.on('request', (r) => r.url().includes('/video/footer-omni-v1.') && !r.url().endsWith('.webp') && film.push(r.url()));
  const errors = await open(page);
  expect(film, 'no film before the footer').toEqual([]);
  const video = page.locator('[data-sky-video]');
  await expect(video).toHaveAttribute('preload', 'none');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('.sky[data-film]')).toHaveCount(1, { timeout: 15_000 });
  expect(await video.evaluate((v: HTMLVideoElement) => !v.paused && v.muted)).toBe(true);
  await expect(page.locator('.roof-near')).toBeAttached();
  // The ghost-cursor clouds still sit above the film.
  const order = await page.evaluate(() => {
    const v = document.querySelector('[data-sky-video]')!;
    const ghost = document.querySelector('.contact canvas, .contact [class*=ghost]');
    return ghost ? Boolean(v.compareDocumentPosition(ghost) & Node.DOCUMENT_POSITION_FOLLOWING) : true;
  });
  expect(order).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  expect(errors).toEqual([]);
});

test('footer film: reduced motion keeps the still layered skyline and never fetches the film', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const film: string[] = [];
  page.on('request', (r) => r.url().includes('/video/footer-omni-v1.') && !r.url().endsWith('.webp') && film.push(r.url()));
  const errors = await open(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-sky-video]')).toBeHidden();
  await expect(page.locator('.roof-near')).toBeVisible();
  expect(film).toEqual([]);
  expect(errors).toEqual([]);
});
