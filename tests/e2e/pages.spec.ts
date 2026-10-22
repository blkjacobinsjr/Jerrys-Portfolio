import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

/** Phase 2: the dock's pages (writing, consultancy, contact) and the dock that links them. */

test('the dock links About on the page and Writing, Consultancy and Contact as pages', async ({ page }) => {
  await open(page);
  await scrollToSelector(page, '#work');
  const dock = page.getByRole('navigation', { name: 'Sections' });
  await expect(dock.getByRole('link')).toHaveText(['About', 'Writing', 'Consultancy', 'Contact']);
  await expect(dock.getByRole('link', { name: 'Writing' })).toHaveAttribute('href', '/writing');
  await expect(dock.getByRole('link', { name: 'Consultancy' })).toHaveAttribute('href', '/consultancy');
  await expect(dock.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
});

for (const [path, label] of [['/writing', 'Writing'], ['/consultancy', 'Consultancy'], ['/contact', 'Contact']] as const) {
  test(`${path} shows the dock straight away, with its own tab current`, async ({ page }) => {
    const errors = await open(page, path);
    const dock = page.locator('.dock');
    await expect(dock).toHaveAttribute('data-shown', 'true');
    await expect(dock.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    await expect(dock.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/#about');
    expect(errors).toEqual([]);
  });
}

test('/writing has an empty state and a feed, ready for markdown posts', async ({ page, request }) => {
  await open(page, '/writing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Writing');
  await expect(page.locator('[data-empty]')).toContainText('Nothing published yet');
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', '/rss.xml');
  const feed = await request.get('/rss.xml');
  expect(feed.ok()).toBe(true);
  expect(await feed.text()).toContain('<title>Writing, Jerry Doughan</title>');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const route of ['/writing', '/consultancy', '/contact']) expect(sitemap).toContain(`https://jerrydoughan.com${route}</loc>`);
});

test('/consultancy is the Leapfrog AI badge, with lfg-ai.com under it', async ({ page }) => {
  await open(page, '/consultancy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jerry Doughan, Founder of Leapfrog AI');
  await expect(page.getByRole('img', { name: /Leapfrog AI badge/ })).toBeVisible();
  const link = page.getByRole('link', { name: /lfg-ai\.com/ });
  await expect(link).toHaveAttribute('href', 'https://lfg-ai.com');
  await expect(link).toBeInViewport();
});

test('/consultancy keeps the still badge until the visitor moves, then hangs it on the lanyard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones wake it with the first touch.');
  await open(page, '/consultancy');
  await expect(page.locator('.badge-stage [data-model-state="static"]')).toHaveCount(1);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /Lanyard/.test(r.name)))).toBe(false);
  await page.mouse.move(400, 300);
  await page.mouse.move(440, 340, { steps: 4 });
  await expect(page.locator('.badge-stage [data-model-state="ready"]')).toHaveCount(1, { timeout: 15_000 });
});

test('/consultancy stays a still badge with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '/consultancy');
  await page.mouse.move(400, 300);
  await page.mouse.move(440, 340, { steps: 4 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.badge-stage [data-model-state="static"]')).toHaveCount(1);
});

test('/contact is a letter: write it, then the stub tears to send it through your mail app', async ({ page }) => {
  await open(page, '/contact');
  const letter = page.locator('form.letter');
  await expect(letter.getByRole('heading', { level: 1 })).toHaveText('Jerry Doughan');
  const send = letter.getByRole('button', { name: 'Send with your mail app' });
  const stub = page.locator('.letter-ticket [role="button"]');
  await expect(send).toBeDisabled();
  await expect(stub).toHaveAttribute('aria-disabled', 'true');
  await letter.getByText('Consultancy').click();
  await letter.getByPlaceholder('you@studio.com').fill('ana@studio.com');
  await letter.getByRole('textbox', { name: 'Your message' }).fill('An AI rollout for our support team.');
  await expect(send).toBeEnabled();
  await expect(stub).not.toHaveAttribute('aria-disabled', 'true');
  await expect(stub).toHaveAttribute('aria-label', 'Tear to send: tear off the stub to send the letter');
  await expect(page.locator('.ticket-body')).toContainText('Consultancy');
  await expect(page.locator('.ticket-body')).toContainText('ana@studio.com');
  await expect(page.locator('.ticket-body [role="status"]')).toHaveText('Ready to send');
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(letter.getByRole('textbox', { name: 'Your message' })).toHaveValue('');
  await expect(send).toBeDisabled();
});
