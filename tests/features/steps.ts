import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given('I open the portfolio', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
});

Given('I prefer reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

When('I open the project {string}', async ({ page }, name: string) => {
  await page.evaluate(() => document.getElementById('work')?.scrollIntoView({ behavior: 'instant' }));
  await page.getByRole('button', { name: new RegExp(`^${name}:`) }).click();
});

Then('I see a sheet titled {string}', async ({ page }, title: string) => {
  await expect(page.locator('dialog[open]').getByRole('heading', { name: title })).toBeVisible();
});

Then('the sheet links to {string}', async ({ page }, host: string) => {
  await expect(page.locator('dialog[open]').getByRole('link', { name: new RegExp(host.replace('.', '\\.')) })).toBeVisible();
});

When('I close the sheet', async ({ page }) => {
  await page.keyboard.press('Escape');
});

Then('no sheet is open', async ({ page }) => {
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

When('I open the path stop {string}', async ({ page }, place: string) => {
  await page.evaluate(() => document.getElementById('path')?.scrollIntoView({ behavior: 'instant' }));
  await page.waitForTimeout(400);
  const stop = page.locator('.stop-btn', { hasText: place });
  await stop.focus();
  await page.waitForTimeout(800);
  await stop.click();
});

Then('I read {string}', async ({ page }, text: string) => {
  await expect(page.locator('.stop-pop:popover-open')).toContainText(text);
});

When('I expand {string}', async ({ page }, label: string) => {
  const summary = page.locator('summary', { hasText: label });
  await summary.scrollIntoViewIfNeeded();
  await summary.click();
});

Then('I see a link to {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('link', { name })).toBeVisible();
});

When('I copy the email address', async ({ page }) => {
  await page.evaluate(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'instant' }));
  // The CTA is an island; click once it has hydrated, as a person would after it rendered.
  await expect(page.locator('#contact astro-island[ssr]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Copy email' }).click();
});

Then('the button says {string}', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: label })).toBeVisible();
});

Then('a toast confirms {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).toBeVisible();
});

Then('smooth scrolling is off', async ({ page }) => {
  await page.waitForTimeout(1200);
  await expect(page.locator('html')).not.toHaveClass(/lenis/);
});

Then('the career path is not pinned', async ({ page }) => {
  await expect(page.locator('html')).not.toHaveClass(/is-pinned/);
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
});
