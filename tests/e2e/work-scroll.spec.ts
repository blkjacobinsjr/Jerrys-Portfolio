import { expect, test } from './fixtures';
import { open } from './helpers';

/** Selected work: the sticky receding deck on a fine pointer (GSAP); on touch the same deck as pure CSS (t144):
 *  sticky cards, a compositor recede on scroll timelines, and nothing written to the cards during a swipe. */
test('selected work stacks on touch with pure CSS and keeps the deck on desktop', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  const card = page.locator('.work-item').first();
  const position = await card.evaluate((el) => getComputedStyle(el).position);
  if (info.project.name === 'desktop') {
    expect(position).toBe('sticky');
  } else {
    expect(position, 'touch gets the sticky stack back (t144)').toBe('sticky');
    const tops = await page.locator('.work-item').evaluateAll((all) => all.map((el) => parseFloat(getComputedStyle(el).top)));
    for (let i = 1; i < tops.length; i++) expect(tops[i], 'each card pins a little lower than the last').toBeGreaterThan(tops[i - 1]);
    const timelines = await page.evaluate(() => CSS.supports('animation-timeline: view()') && CSS.supports('timeline-scope: --t'));
    if (timelines) {
      const anim = await card.locator('.work-face').evaluate((el) => getComputedStyle(el).animationName);
      expect(anim, 'the covered card recedes on a scroll timeline').toBe('work-recede');
    }
    // Count style writes on the cards through a swipe: the deck must be pure CSS.
    await page.evaluate(() => {
      (window as unknown as { __writes: number }).__writes = 0;
      new MutationObserver((m) => ((window as unknown as { __writes: number }).__writes += m.length)).observe(document.querySelector('.work-list')!, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
    });
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
    expect(await page.evaluate(() => (window as unknown as { __writes: number }).__writes), 'zero style mutations during the swipe').toBe(0);
    if (timelines) {
      // Mid-deck the card under the next one has receded (transform from the CSS timeline, not a script).
      const scale = await card.locator('.work-face').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
      expect(scale).toBeLessThan(0.99);
    }
    // Click-through: the first card's link still works on a phone.
    const last = page.locator('.work-item').last().locator('a.work-card');
    await last.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const href = await last.getAttribute('href');
    await last.click();
    await expect(page).toHaveURL(new RegExp(`${href}/?$`));
  }
  if (info.project.name === 'desktop') {
    await page.locator('#work').scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(600);
    await expect(card.locator('a').first()).toBeAttached();
    // Click-through on desktop: the card on top of the deck opens its project page.
    const top = page.locator('.work-item').nth(1).locator('a.work-card');
    await top.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const href = await top.getAttribute('href');
    await top.click();
    await expect(page).toHaveURL(new RegExp(`${href}/?$`));
  }
  expect(errors).toEqual([]);
});
