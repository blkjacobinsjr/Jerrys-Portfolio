import { expect, test } from './fixtures';
import { open, scrollToSelector } from './helpers';

// Click-through rule: an interactive effect must never swallow the click under it. Every selected-work card is
// hovered (so the Liquid Object mounts on desktop) and then clicked with a real mouse, and must open its project page.
test('every selected-work card opens its project page after hover, with the liquid effect mounted', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop pointer behaviour; touch is covered by work-pages');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  const hrefs = await page.locator('.work-list .work-card').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);

  for (const [index, href] of hrefs.entries()) {
    await scrollToSelector(page, '#work');
    const face = page.locator('.work-list .work-face').nth(index);
    await face.scrollIntoViewIfNeeded();
    const box = await face.boundingBox();
    if (!box) throw new Error(`card ${index} has no box`);
    const x = box.x + box.width * 0.3;
    const y = box.y + box.height * 0.6;
    await page.mouse.move(x, y, { steps: 5 });
    await expect(face.locator('.work-liquid[data-ready="true"] canvas')).toBeVisible({ timeout: 10_000 });
    await page.mouse.move(x + 8, y + 4, { steps: 3 });
    await page.mouse.click(x + 8, y + 4);
    await expect(page).toHaveURL(new RegExp(`${href}/?$`));
    await page.goBack();
    await expect(page.locator('.work-list .work-card')).toHaveCount(hrefs.length);
  }
});
