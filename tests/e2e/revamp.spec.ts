import { expect, test } from '@playwright/test';
import { open } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('keeps 3D code deferred until the matching Path drawer opens', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'WebGL lifecycle checked in Chromium');
  const errors = await open(page);
  await page.waitForTimeout(1000);
  const models = () => page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /\/(Desk\.|Lanyard\.|three\.module)/.test(name)));
  expect(await models()).toEqual([]);
  await page.locator('[data-stop="desk"]').click();
  await expect(page.locator('.desk-stage[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Rotate desk right' }).click();
  expect((await models()).some((name) => /\/Desk\./.test(name))).toBe(true);
  expect((await models()).some((name) => /\/Lanyard\./.test(name))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('.desk-stage canvas')).toHaveCount(0);
  await page.locator('[data-stop="buildspace"]').click();
  await expect(page.locator('.lanyard-canvas')).toBeVisible();
  const badge = page.locator('.lanyard-canvas');
  await page.waitForLoadState('networkidle');
  const before = await badge.screenshot();
  const box = await badge.boundingBox();
  if (!box) throw new Error('Missing badge canvas');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height * 0.65, { steps: 3 });
  await page.mouse.up();
  expect((await badge.screenshot()).equals(before), 'reduced-motion dragging must not flip the badge').toBe(true);
  await page.getByRole('button', { name: 'Flip badge' }).click();
  expect((await badge.screenshot()).equals(before), 'explicit badge flip changes the face').toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.lanyard-canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('keeps the Scenaryo visit link reachable above the padded drawer edge', async ({ page }) => {
  await open(page);
  await page.locator('.work-card').first().click();
  // Scrolling expands the mobile sheet, then scrolls its content to the end.
  const panel = page.locator('dialog[open] .sheet');
  await panel.hover({ position: { x: 150, y: 150 } });
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(500);
  const visit = page.getByRole('link', { name: /Visit scenaryo\.app/ });
  await expect(visit).toHaveAttribute('href', 'https://scenaryo.app/research');
  await expect(visit).toBeInViewport({ ratio: 1 });
  const space = await panel.evaluate((element) => {
    const link = element.querySelector('.detail-visit');
    if (!link) throw new Error('Missing project visit link');
    return Math.min(innerHeight, element.getBoundingClientRect().bottom) - link.getBoundingClientRect().bottom;
  });
  expect(space).toBeGreaterThanOrEqual(24);
});

test('uses real project logos, adds Leapfrog AI and points metadata at the new domain', async ({ page }) => {
  await open(page);
  await expect(page.locator('.work-logo')).toHaveCount(5);
  await page.getByRole('button', { name: /^Leapfrog AI:/ }).click();
  await expect(page.locator('dialog[open]').getByRole('heading', { name: 'Leapfrog AI' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Visit lfg-ai.com' })).toHaveAttribute('href', 'https://lfg-ai.com');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://jerrydoughan.com/');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://jerrydoughan.com/');
  const sitemap = await page.request.get('/sitemap.xml');
  expect(await sitemap.text()).toContain('<loc>https://jerrydoughan.com/</loc>');
});


test('presents six consistent local recommendations and the exact notable reactions', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'recommendations do not widen the mobile viewport').toBe(0);
  const track = page.locator('[data-recs-track]');
  await expect(track.locator('.rec-byline > a')).toHaveText([
    'Iñigo Martín-Calero', 'Woundioun Sissoko', 'Jerry Jiang', 'Gavin Laugenie', 'Ian Green', 'Christoph Suessmeier',
  ]);
  await expect(track.locator('.rec-person img')).toHaveCount(6);
  for (const image of await track.locator('img').all()) await expect(image).toHaveAttribute('src', /^\/_astro\//);
  for (const name of await track.locator('.rec-byline > a').all()) await expect(name).toHaveAttribute('href', /^https:\/\/www\.linkedin\.com\/in\//);
  const notes = page.locator('.rec-more-track');
  for (const quote of [
    'Thank you Jerry! Love the mission.',
    'Just tested a chat with Michael Burry from The Big Short, had to laugh, really cool work.',
    'I watched the demo video, very impressive!',
    'Congrats Jerry Schmalz, good luck lots of support from here!',
  ]) await expect(notes).toContainText(quote);
  await expect(notes.getByRole('link', { name: /Congrats Jerry Schmalz/ })).toHaveAttribute('href', 'https://www.linkedin.com/posts/jasdoughan_late-to-the-linkedin-party-but-weve-been-ugcPost-7222291638549671936-LUng');
});
