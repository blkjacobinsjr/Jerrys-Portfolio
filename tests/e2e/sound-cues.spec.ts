import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

/** t138 cues: nothing audio-related loads before a gesture; afterwards hovers, reversals and the footer play samples. */
test('sound cues load after the first gesture and play on hover, upward reversal and the footer', async ({ page, isMobile }) => {
  await page.addInitScript(() => {
    (window as unknown as { __starts: number }).__starts = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      (window as unknown as { __starts: number }).__starts++;
      return start.apply(this, args);
    };
  });
  const sfx: string[] = [];
  page.on('request', (r) => r.url().includes('/sfx/') && sfx.push(r.url()));
  const errors = await open(page);
  const starts = () => page.evaluate(() => (window as unknown as { __starts: number }).__starts);
  expect(sfx, 'no audio before a gesture').toEqual([]);

  await page.keyboard.press('Shift');
  await expect.poll(() => sfx.length).toBe(9);
  expect(sfx.every((u) => /\.(webm|m4a)$/.test(u))).toBe(true);
  await page.waitForLoadState('networkidle');

  // Upward reversal after real downward travel plays the rewind once.
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(200);
  let before = await starts();
  await page.evaluate(async () => {
    for (let y = 0; y <= 1200; y += 100) { scrollTo(0, y); await new Promise((r) => requestAnimationFrame(() => r(0))); }
    for (let y = 1200; y >= 1000; y -= 50) { scrollTo(0, y); await new Promise((r) => requestAnimationFrame(() => r(0))); }
  });
  await expect.poll(starts).toBeGreaterThan(before);

  if (!isMobile) {
    const decrypt = page.locator('.work [data-decrypt]').first();
    await scrollToSelector(page, '.work [data-decrypt]');
    await page.mouse.move(0, 0);
    before = await starts();
    await decrypt.hover();
    await expect.poll(starts).toBeGreaterThan(before);

    await page.evaluate(() => document.querySelector('[data-keyring]')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(400);
    await page.mouse.move(0, 0);
    before = await starts();
    const ring = (await page.locator('[data-keyring] .charm img').first().boundingBox())!;
    await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height / 2, { steps: 4 });
    await expect.poll(starts).toBeGreaterThan(before);

    // Footer: wind and city loops start once; moving more does not stack new sources.
    const box = (await page.locator('footer').boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 20 + i * 40, box.y + box.height / 2, { steps: 2 });
    const looped = await starts();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 420 - i * 40, box.y + box.height / 2, { steps: 2 });
    expect(await starts()).toBe(looped);

    // Muted: hovers stay silent.
    await page.locator('[data-sound-toggle]').click();
    await expect(page.locator('[data-sound-toggle]')).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.move(0, 0);
    before = await starts();
    await scrollToSelector(page, '.work [data-decrypt]');
    await decrypt.hover();
    await page.waitForTimeout(300);
    expect(await starts()).toBe(before);
  }
  expect(errors).toEqual([]);
});
