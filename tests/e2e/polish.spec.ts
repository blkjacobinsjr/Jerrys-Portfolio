import { expect, test } from './fixtures';
import { open, scrollToSelector } from './helpers';

/** POLISH (t174, live; ?polish=0 off for a visit): icon swap, Magic UI theme toggler + highlighter, enter beam. */

test('?polish=0 turns the polish set off for a visit: no toggle, no icons, no highlighter', async ({ page }) => {
  await open(page, '/?polish=0');
  await expect(page.locator('html')).not.toHaveAttribute('data-polish', 'on');
  await expect(page.locator('.theme-toggle')).toHaveCount(0);
  for (const icon of await page.locator('#contact .t-icon-swap').all()) await expect(icon).toBeHidden();
  await expect(page.locator('.rough-annotation')).toHaveCount(0);
});

test('polish: theme toggler flips the existing dark tokens, persists, and the page underneath stays clickable', async ({ page }) => {
  const errors = await open(page, '/?polish=1');
  const toggle = page.locator('.theme-toggle');
  await expect(toggle).toBeVisible();
  const box = await toggle.boundingBox();
  expect(box && box.x > (page.viewportSize()?.width ?? 0) / 2 && box.y < 80).toBe(true);
  const before = await page.evaluate(() => [document.documentElement.classList.contains('dark'), getComputedStyle(document.documentElement).getPropertyValue('--bg')]);
  await toggle.click();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!before[0]);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg'))).not.toBe(before[1]);
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(before[0] ? 'light' : 'dark');
  // No flash: the class is on <html> before any island runs.
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!before[0]);
  // Click-through: the sound toggle in the footer still works, and swaps its icon.
  await scrollToSelector(page, '#contact');
  const sound = page.locator('#contact [data-sound-toggle]');
  // Centre it, clear of the phone dock, the way a thumb would reach it.
  await sound.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(sound.locator('.t-icon-swap')).toBeVisible();
  // On a 393px iPhone the footer toggle sits under the dock at the end of the page on main too (pre-existing), so phones use the keyboard path.
  if ((page.viewportSize()?.width ?? 0) < 768) await sound.press('Enter');
  else await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await expect(sound.locator('.t-icon-swap')).toHaveAttribute('data-state', 'b');
  await expect(sound).toContainText('Sound off');
  expect(errors).toEqual([]);
});

test('polish: highlighter marks the Kindle line once it scrolls into view', async ({ page }) => {
  test.slow(); // cold first load in the full suite: the About islands hydrate late
  await open(page, '/?polish=1');
  await scrollToSelector(page, '#about');
  // Mid-reveal the words are still blurred, so nothing is drawn yet.
  await expect(page.locator('#about .rough-annotation')).toHaveCount(0);
  // Read on: the marks land once the scroll reveal has un-blurred their words.
  await expect
    .poll(async () => {
      await page.evaluate(() => window.scrollBy({ top: 80, behavior: 'instant' }));
      return page.locator('#about .rough-annotation').count();
    }, { timeout: 15_000, intervals: [100] })
    .toBeGreaterThanOrEqual(3);
  // Scroll-linked: reading on draws the strokes, scrolling back undraws them.
  const drawn = () =>
    page.evaluate(() => {
      // The first mark: its start is the earliest, so the scrolls below move it fully either way.
      const path = document.querySelector('#about svg.rough-annotation path') as SVGPathElement | null;
      return path ? 1 - Number.parseFloat(path.style.strokeDashoffset) / path.getTotalLength() : -1;
    });
  await page.evaluate(() => window.scrollBy({ top: 320, behavior: 'instant' }));
  await expect.poll(drawn).toBeGreaterThan(0.95);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(drawn).toBeLessThan(0.05);
});

test('polish: beam rides "Enter with sound" and entering still works', async ({ page }) => {
  await open(page, '/?enter=1&polish=1');
  await expect(page.locator('[data-enter-screen] .enter-beam-fx')).toBeAttached();
  await page.getByRole('button', { name: 'Enter with sound' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.enter)).toBe('done');
});
