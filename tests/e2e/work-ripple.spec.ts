import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

/** C: Ripple Distortion + spec sheet on a hovered desktop card; nothing on phones; the card link always clicks. */
test('desktop hover: one ripple renderer and a spec sheet of real project data; click still opens the project', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = await open(page);
  await scrollToSelector(page, '#work');
  const first = page.locator('.work-face').first();
  const spec = JSON.parse((await first.getAttribute('data-spec'))!) as Record<string, string | number>;
  if (isMobile) {
    await first.locator('.work-card').tap({ trial: true });
    await expect(page.locator('.work-ripple, .work-spec')).toHaveCount(0);
    expect(errors).toEqual([]);
    return;
  }
  // Nothing before intent.
  await expect(page.locator('.work-ripple')).toHaveCount(0);
  await first.hover();
  await page.mouse.move(400, 500, { steps: 4 });
  await first.hover({ position: { x: 200, y: 200 } });
  await expect(first.locator('.work-ripple[data-ready="true"] canvas')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.work-ripple canvas')).toHaveCount(1);
  const sheet = first.locator('.work-spec');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('dt')).toHaveText(['PRJCT', 'CREATED AT', 'NAME', 'TYPE', 'SCOPE']);
  // DecryptedText keeps a screen-reader copy beside the animated glyphs, so each value reads twice in textContent.
  const values = ['/01', String(spec.created), String(spec.name), String(spec.type), String(spec.scope)];
  await expect(sheet.locator('dd')).toHaveText(values.map((v) => v + v), { timeout: 5_000 });
  await expect(first.locator('.work-phone')).toBeVisible();
  // Moving across the card leaves a wake but the link under it still takes the click.
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, { steps: 10 });
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 10 });
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await expect(page).toHaveURL(/\/work\/[a-z-]+/);
  expect(errors).toEqual([]);
});

test('leaving the card removes the spec sheet', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop hover');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = await open(page);
  await scrollToSelector(page, '#work');
  const first = page.locator('.work-face').first();
  await page.mouse.move(10, 10);
  await first.hover({ position: { x: 200, y: 200 } });
  await page.mouse.move(400, 500, { steps: 3 });
  await first.hover({ position: { x: 220, y: 220 } });
  await expect(first.locator('.work-spec')).toBeVisible({ timeout: 10_000 });
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x - 5 > 0 ? box.x - 5 : 2, box.y + box.height + 40, { steps: 3 });
  await expect(first.locator('.work-spec')).toHaveCount(0);
  expect(errors).toEqual([]);
});
