import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

test('path captions are one fixed-height line with one separator, a date and a place on every stop', async ({ page }) => {
  const errors = await open(page);
  const whens = page.locator('#path .stop .stop-when');
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
  expect(errors).toEqual([]);
});

test('the circular gallery hands the caption to the stop in the middle, and a click still opens it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop pinned scroll');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = await open(page);
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
  expect(errors).toEqual([]);
});

test('phones: dragging the strip glides only the art; the caption and glow stay put and crossfade to the new stop', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch strip');
  test.skip(test.info().project.name === 'safari', 'Real touch drags go through CDP, which WebKit does not have.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = await open(page);
  await scrollToSelector(page, '#path');
  await expect(page.locator('#path[data-gl]')).toHaveCount(1, { timeout: 10_000 });
  const caption = page.locator('#path .path-caption-item[data-on]');
  await expect(caption).toHaveCount(1);
  const before = { id: await caption.getAttribute('data-for'), box: (await caption.locator('.stop-place').boundingBox())! };
  // The strip's own text and glow are out of the picture while the gallery draws.
  await expect(page.locator('#path .stop .stop-place').first()).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('#path .stop .stop-glow').first()).toHaveCSS('visibility', 'hidden');

  const s = (await page.locator('[data-path-scroller]').boundingBox())!;
  const y = s.y + s.height / 2;
  // A real finger: touch points across the strip, the caption measured mid-drag and after.
  const cdp = await page.context().newCDPSession(page);
  const x0 = s.x + s.width * 0.8;
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const capX = async () => (await caption.locator('.stop-place').boundingBox())!.x;
  const x1 = await capX();
  await touch('touchStart', x0);
  const xs: number[] = [];
  for (let i = 1; i <= 12; i++) {
    await touch('touchMove', x0 - (s.width * 0.6 * i) / 12);
    if (i % 4 === 0) xs.push(await page.locator('#path .path-caption').boundingBox().then((b) => b!.x));
  }
  await touch('touchEnd', 0);
  await cdp.detach();
  // The caption box never moves with the finger; the title in it stays at the same x mid-drag.
  for (const x of xs) expect(Math.abs(x - xs[0]!)).toBeLessThan(1);
  if ((await caption.getAttribute('data-for')) === before.id) expect(Math.abs((await capX()) - x1)).toBeLessThan(1);
  await expect.poll(() => caption.getAttribute('data-for')).not.toBe(before.id);
  const after = (await caption.locator('.stop-place').boundingBox())!;
  expect(Math.abs(after.y - before.box.y)).toBeLessThan(1);

  // Click-through: tapping the stop in the middle still opens its drawer.
  const id = await caption.getAttribute('data-for');
  await page.locator(`[data-stop="${id}"]`).tap();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
