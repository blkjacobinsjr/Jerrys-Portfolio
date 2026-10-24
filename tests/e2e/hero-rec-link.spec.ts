import { expect, test } from './fixtures';
import { open } from './helpers';

/** The hero teaser's active author (name + role) is a real link to their LinkedIn, in dark mode too. */
test('hero teaser: Jerry Jiang reads as the mayoral candidate and links to his LinkedIn', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  const author = page.locator('.hero-recs .mt-author.is-active');
  await expect(author).toContainText('Jerry Jiang');
  await expect(author.locator('.mt-role')).toHaveText('Candidate for Mayor of Waterloo');
  const link = author.getByRole('link');
  await expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/jerrymjiang');
  await expect(link).toContainText('Candidate for Mayor of Waterloo');
  expect(await author.locator('.mt-role').evaluate((el) => el.getClientRects().length), 'role stays on one line').toBe(1);
  // Hidden authors are out of the tab order.
  await expect(page.locator('.hero-recs .mt-author:not(.is-active) a[tabindex="-1"]')).toHaveCount(2);
  // Visible focus ring.
  await link.focus();
  expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  // Click-through opens LinkedIn in a new tab (aborted, no network).
  await page.context().route('https://www.linkedin.com/**', (route) => route.fulfill({ body: 'ok' }));
  const [popup] = await Promise.all([page.waitForEvent('popup'), isMobile ? link.tap() : link.click()]);
  expect(popup.url()).toBe('https://www.linkedin.com/in/jerrymjiang');
  await popup.close();
  expect(errors).toEqual([]);
});
