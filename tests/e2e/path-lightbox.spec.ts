import { expect, test } from './fixtures';
import { open } from './helpers';

test('a photo in a Path drawer expands into the lightbox above it; Escape closes only the lightbox', async ({ page }) => {
  const errors = await open(page, '/?gl=off');
  await page.locator('[data-stop="buildspace"]').focus();
  await page.keyboard.press('Enter');
  const sheet = page.locator('dialog[open]');
  await expect(sheet).toHaveCount(1);
  const photos = sheet.locator('.detail-photo');
  const count = await photos.count();
  expect(count).toBeGreaterThan(1);
  await photos.first().scrollIntoViewIfNeeded();
  await photos.first().click();

  const box = page.locator('.pswp');
  await expect(box).toHaveAttribute('data-opened', '');
  await expect(box.locator('.pswp__counter')).toHaveText(`1 / ${count}`);
  // Opaque backdrop: the drawer's text must not ghost through behind the photo (phones showed it at 0.92).
  await expect(box.locator('.pswp__bg')).toHaveCSS('opacity', '1');
  // Shown above the drawer: the topmost element in the middle of the screen belongs to the lightbox.
  const vp = page.viewportSize()!;
  expect(await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x!, y!)?.closest('.pswp')), [vp.width / 2, vp.height / 2])).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect(box.locator('.pswp__counter')).toHaveText(`2 / ${count}`);

  await page.keyboard.press('Escape');
  await expect(page.locator('.pswp')).toHaveCount(0);
  await expect(sheet).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-scroll-locked', '');

  // X closes it too.
  await photos.first().click();
  await expect(box).toHaveAttribute('data-opened', '');
  await box.locator('.pswp__button--close').click();
  await expect(page.locator('.pswp')).toHaveCount(0);
  await expect(sheet).toHaveCount(1);
  expect(errors).toEqual([]);
});
