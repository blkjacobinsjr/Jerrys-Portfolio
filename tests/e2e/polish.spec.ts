import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

/** POLISH (t174, ?polish=1 on previews): icon swap, Magic UI theme toggler + highlighter, enter beam. */

test('polish off by default: no toggle, no icons, no highlighter', async ({ page }) => {
  await open(page, '/');
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
  await open(page, '/?polish=1');
  await scrollToSelector(page, '#about');
  await page.getByText('Kindle', { exact: false }).first().evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('#about .rough-annotation').first()).toBeAttached({ timeout: 10_000 });
});

test('polish: beam rides "Enter with sound" and entering still works', async ({ page }) => {
  await open(page, '/?enter=1&polish=1');
  await expect(page.locator('[data-enter-screen] .enter-beam-fx')).toBeAttached();
  await page.getByRole('button', { name: 'Enter with sound' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.enter)).toBe('done');
});
