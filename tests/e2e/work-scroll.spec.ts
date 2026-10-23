import { expect, test } from '@playwright/test';
import { open } from './helpers';

/** Selected work: a sticky receding deck on a fine pointer, plain native scroll on phones and touch. */
test('selected work scrolls natively on touch and keeps the deck on desktop', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  const card = page.locator('.work-item').first();
  const position = await card.evaluate((el) => getComputedStyle(el).position);
  if (info.project.name === 'desktop') {
    expect(position).toBe('sticky');
  } else {
    expect(position, 'no sticky stack on touch').toBe('static');
    const gap = await page.evaluate(() => {
      const row = document.querySelector('.programs')!.getBoundingClientRect().bottom;
      return document.querySelector('.work-item')!.getBoundingClientRect().top - row;
    });
    expect(gap, 'the Startup programs row sits close to the first card').toBeLessThan(140);
    await page.locator('#work').scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await page.evaluate(() => scrollBy(0, 1200));
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before + 1000);
    const styled = await page.locator('.work-item').evaluateAll((all) => all.filter((el) => el.getAttribute('style')?.includes('scale')).length);
    expect(styled, 'nothing scroll-linked writes to the cards').toBe(0);
    // Click-through: the first card's link still works on a phone.
    const link = card.locator('a').first();
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
  }
  if (info.project.name === 'desktop') {
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(600);
    await expect(card.locator('a').first()).toBeAttached();
  }
  expect(errors).toEqual([]);
});
