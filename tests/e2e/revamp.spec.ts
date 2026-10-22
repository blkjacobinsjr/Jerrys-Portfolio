import { expect, test } from '@playwright/test';
import { open, revealInSheet, scrollSheetToEnd } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('keeps 3D code deferred until the matching Path drawer opens', async ({ page }) => {
  const errors = await open(page);
  await page.waitForTimeout(1000);
  const models = () => page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /\/(Desk\.|Lanyard\.|three\.module)/.test(name)));
  expect(await models()).toEqual([]);
  await page.locator('[data-stop="desk"]').click();
  await expect(page.locator('.desk-stage[data-ready="true"]')).toBeVisible();
  const desk = page.locator('.desk-stage canvas');
  const originalDesk = await desk.screenshot();
  await page.getByRole('button', { name: 'Rotate desk right' }).click();
  expect((await desk.screenshot()).equals(originalDesk), 'rotating the desk changes the visible model').toBe(false);
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
  const panel = page.locator('dialog[open] .sheet');
  await scrollSheetToEnd(page);
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


test('presents six consistent local recommendations and the honorary mention', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'recommendations do not widen the mobile viewport').toBe(0);
  const track = page.locator('[data-recs-track]');
  await expect(track.locator('.rec-byline > a')).toHaveText([
    'Iñigo Martín-Calero', 'Woundioun Sissoko', 'Jerry Jiang', 'Gavin Laugenie', 'Ian Green', 'Christoph Suessmeier',
  ]);
  await expect(track.locator('.rec-person img')).toHaveCount(6);
  for (const image of await track.locator('img').all()) await expect(image).toHaveAttribute('src', /^\/_astro\//);
  for (const name of await track.locator('.rec-byline > a').all()) await expect(name).toHaveAttribute('href', /^https:\/\/www\.linkedin\.com\/in\//);
  const notes = page.locator('.honorary-mention');
  await expect(notes).toContainText('Congrats Jerry Schmalz, good luck lots of support from here!');
  await expect(notes.getByRole('link', { name: /Congrats Jerry Schmalz/ })).toHaveAttribute('href', 'https://www.linkedin.com/posts/jasdoughan_late-to-the-linkedin-party-but-weve-been-ugcPost-7222291638549671936-LUng');
});

test('the option wheel shows the stops before and after, then navigates by keyboard', async ({ page }) => {
  await open(page);
  await page.locator('[data-stop="buildspace"]').click();
  const sheet = page.locator('dialog[open]');
  const wheel = sheet.getByRole('listbox', { name: 'Stops on the path' });
  await expect(wheel.getByRole('option', { selected: true })).toHaveText('2024 · buildspace');
  // The wheel closes the entry, under the notes.
  await revealInSheet(page, '.model-wheel');
  for (const label of ['2023 · WBS Coding School', '2024 · Draper University']) {
    const neighbor = wheel.getByRole('option', { name: label, exact: true });
    await expect(neighbor).toBeVisible();
    const visible = await neighbor.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const viewport = element.closest('[role="listbox"]')!.getBoundingClientRect();
      return box.bottom > viewport.top && box.top < viewport.bottom && Number(getComputedStyle(element).opacity) > 0;
    });
    expect(visible, `${label} is visible in the wheel`).toBe(true);
  }
  await wheel.focus();
  await page.keyboard.press('ArrowDown');
  await expect(sheet.getByRole('heading', { name: 'Draper University', exact: true })).toBeVisible();
  await expect(wheel.getByRole('option', { selected: true })).toHaveText('2024 · Draper University');
  await expect(wheel).toHaveAttribute('data-wheel-state', 'ready');
  for (const label of ['2024 · buildspace', 'These days · My Berlin desk']) {
    const neighbor = wheel.getByRole('option', { name: label, exact: true });
    await expect(neighbor).toBeVisible();
    expect(await neighbor.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const viewport = element.closest('[role="listbox"]')!.getBoundingClientRect();
      return box.bottom > viewport.top && box.top < viewport.bottom && Number(getComputedStyle(element).opacity) > 0;
    }), `${label} remains visible after navigation`).toBe(true);
  }
});

test('Scenaryo CTA is tappable at 390px after scrolling the full drawer', async ({ page, context, isMobile }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.route('https://scenaryo.app/research', (route) => route.fulfill({ body: '<title>Scenaryo research</title>' }));
  await open(page);
  await page.getByRole('button', { name: /^Scenaryo:/ }).click();
  const panel = page.locator('dialog[open] .sheet');
  await scrollSheetToEnd(page);
  const visit = panel.getByRole('link', { name: /Visit scenaryo\.app/ });
  await expect(visit).toBeInViewport({ ratio: 1 });
  const popupEvent = page.waitForEvent('popup');
  if (isMobile) await visit.tap();
  else await visit.click();
  const popup = await popupEvent;
  await popup.waitForURL('https://scenaryo.app/research');
  expect(popup.url()).toBe('https://scenaryo.app/research');
  await popup.close();
});

test('all recommendation cards keep the same quote, avatar, byline and wins composition', async ({ page }) => {
  await open(page);
  const cards = page.locator('.rec-card');
  await expect(cards).toHaveCount(6);
  for (const card of await cards.all()) {
    await expect(card.locator(':scope > blockquote')).toHaveCount(1);
    await expect(card.locator(':scope > figcaption')).toHaveCount(1);
    await expect(card.locator('figcaption .rec-person img')).toHaveCount(1);
    await expect(card.locator('figcaption .rec-byline > a')).toHaveCount(1);
    await expect(card.locator('figcaption .rec-role')).not.toBeEmpty();
    await expect(card.locator('figcaption .rec-detail')).not.toBeEmpty();
    await expect(card.locator('figcaption .rec-proof')).not.toBeEmpty();
    expect(await card.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
    const avatar = card.locator('.rec-person img');
    expect(await avatar.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('50%');
  }
});

test('hover decrypt animates only on a fine hover pointer and settles to the readable name', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  const heading = page.getByRole('heading', { level: 1 });
  if (isMobile) {
    await heading.tap();
    await expect(heading.locator('.decrypting')).toHaveCount(0);
    await expect(page.locator('astro-island[component-export="default"][component-url*="DecryptedText"][ssr]')).not.toHaveCount(0);
  } else {
    await expect(heading.locator('.decrypting')).toHaveCount(0);
    await expect(page.locator('astro-island[component-url*="DecryptedText"][ssr]')).toHaveCount(0);
    await heading.locator('astro-island > span').hover();
    await expect(heading.locator('.decrypting')).not.toHaveCount(0);
    await page.mouse.move(0, 0);
    await expect(heading.locator('.decrypting')).toHaveCount(0);
  }
  await expect(heading).toHaveAccessibleName('Jerry Doughan');
});

test('a path drawer leads with the organisation mark, then the title, role and one when-and-where line', async ({ page }) => {
  await open(page);
  await page.locator('[data-stop="coventry"]').click();
  const header = page.locator('dialog[open] .model-caption');
  const logo = header.getByRole('img', { name: 'Coventry University logo' });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('width', '24');
  await expect(logo).toHaveAttribute('height', '24');
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), 'the mark loads').toBe(true);
  await expect(header.locator(':scope > *')).toHaveText(['', 'Coventry University', 'BA Advertising and Marketing', '2013 · Coventry, UK']);
  await expect(page.locator('dialog[open] .detail-list li')).toContainText(['Classes of 30+', 'Full circle, 2024']);
});
