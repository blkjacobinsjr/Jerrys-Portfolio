import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

test('path captions are one fixed-height line with one separator, a date and a place on every stop', async ({ page }) => {
  await open(page);
  const whens = page.locator('#path .stop-when');
  const rows = await whens.evaluateAll((els) =>
    els.map((el) => ({ h: el.getBoundingClientRect().height, ws: getComputedStyle(el).whiteSpace, text: el.textContent ?? '' })),
  );
  expect(rows.length).toBeGreaterThan(10);
  for (const row of rows) {
    expect(row.ws).toBe('nowrap');
    expect(row.h).toBeCloseTo(rows[0]!.h, 0);
    const [when, where, ...rest] = row.text.split('·').map((s) => s.trim());
    expect(rest).toEqual([]);
    expect(when).not.toBe('');
    expect(where).not.toBe('');
  }
});

test('the circular gallery hands the caption to the stop in the middle, and a click still opens it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop pinned scroll');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await scrollToSelector(page, '#path');
  await expect(page.locator('#path[data-gl]')).toHaveCount(1, { timeout: 10_000 });
  const focused = page.locator('#path .stop[data-focus]');
  await expect(focused).toHaveCount(1);
  const first = await focused.locator('.stop-btn').getAttribute('data-stop');
  await page.mouse.move(700, 450);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await expect.poll(() => focused.locator('.stop-btn').getAttribute('data-stop')).not.toBe(first);
  await expect(page.locator('#path .stop:not([data-focus]) .stop-place').first()).toHaveCSS('opacity', '0.25');
  // Click-through: the gallery canvas never takes the click from the focused stop.
  await page.waitForTimeout(900);
  await focused.locator('.stop-btn').click();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
});
