import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { open } from './helpers';

/**
 * Visual regression for the hard vertical line that ran down the selected-work cards at about
 * 45% of their width. The phone's shadow is painted inside .work-shot, whose
 * content-visibility: auto clips its children's paint at its padding box. The band either side of
 * the phone's edge must render the same with the containment as without it: nothing is cut off.
 */
async function band(page: Page, clip: { x: number; y: number; width: number; height: number }) {
  const png = await page.screenshot({ clip, animations: 'disabled' });
  return sharp(png).removeAlpha().raw().toBuffer();
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`selected-work cards have no clipped shadow edge at ${viewport.width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Pixel comparison runs once, in Chromium.');
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const shots = page.locator('.work-shot:not(.work-shot-site)');
    const count = await shots.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const shot = shots.nth(i);
      await shot.evaluate((el) => el.closest('.work-item')!.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.waitForTimeout(500);
      const clip = await shot.evaluate((el) => {
        // The phone's own edge: its shadow falls to the left of it, inside .work-shot's padding.
        const s = el.querySelector('.work-phone')!.getBoundingClientRect();
        const face = el.closest('.work-face')!.getBoundingClientRect();
        const top = Math.max(s.top, face.top, 0) + 8;
        const bottom = Math.min(s.bottom, face.bottom, innerHeight) - 8;
        return { x: Math.round(s.left - 48), y: Math.round(top), width: 64, height: Math.round(bottom - top) };
      });
      expect(clip.height, `card ${i} band is on screen`).toBeGreaterThan(80);
      const contained = await band(page, clip);
      const style = await page.addStyleTag({ content: '.work-shot { content-visibility: visible !important; contain: none !important; }' });
      await page.waitForTimeout(200);
      const free = await band(page, clip);
      await style.evaluate((el) => (el as Element).remove());
      let total = 0;
      for (let p = 0; p < contained.length; p++) total += Math.abs(contained[p]! - free[p]!);
      const mean = total / contained.length;
      expect(mean, `card ${i} paints the same across the shot's edge with and without containment`).toBeLessThan(0.15);
    }
  });
}
