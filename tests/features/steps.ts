import { expect } from '@playwright/test';
import { createBdd, test as bdd } from 'playwright-bdd';
import { skipEnterGate } from '../e2e/fixtures';

export const test = bdd.extend(skipEnterGate);
const { Given, When, Then } = createBdd(test);

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
  await page.getByRole('link', { name: new RegExp(`^${name}:`) }).click();
  await page.waitForURL(/\/work\//);
});

Then('I see a project page titled {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
});

Then('the page links to {string}', async ({ page }, host: string) => {
  await expect(page.getByRole('main').getByRole('link', { name: new RegExp(host.replace('.', '\\.')) })).toBeVisible();
});

When('I go back to the selected work', async ({ page }) => {
  await page.getByRole('link', { name: 'Selected work' }).click();
  await page.waitForURL('**/#work');
});

Then('I am on the home page at its work section', async ({ page }) => {
  await expect(page.locator('#work')).toBeAttached();
  expect(new URL(page.url()).pathname).toBe('/');
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
  const stop = page.locator('.stop-btn', { hasText: place }).first();
  await stop.focus();
  await page.waitForTimeout(800);
  await stop.click();
});

Then('I read {string}', async ({ page }, text: string) => {
  await expect(page.locator('dialog[open]')).toContainText(text);
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

Given('the viewport is 390 pixels wide', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

Then('no 3D model has been downloaded', async ({ page }) => {
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  expect(resources.filter((url) => /\/(Desk\.|Lanyard\.|three\.module)/.test(url))).toEqual([]);
  await expect(page.locator('.desk-stage canvas, .lanyard-canvas')).toHaveCount(0);
});

Then('the 3D model is ready', async ({ page }) => {
  await expect(page.locator('dialog[open] [data-model-state="ready"]')).toBeVisible();
});

Then('the path wheel offers {string} and {string}', async ({ page }, before: string, after: string) => {
  const wheel = page.getByRole('listbox', { name: 'Stops on the path' });
  await expect(wheel.getByRole('option', { name: before, exact: true })).toBeVisible();
  await expect(wheel.getByRole('option', { name: after, exact: true })).toBeVisible();
});

When('I turn the desk right', async ({ page }) => {
  await page.getByRole('button', { name: 'Rotate desk right' }).click();
});

Then('no model canvas remains', async ({ page }) => {
  await expect(page.locator('.desk-stage canvas, .lanyard-canvas')).toHaveCount(0);
});

When('I flip the Buildspace badge', async ({ page }) => {
  await page.getByRole('button', { name: 'Flip badge' }).click();
});

Then('the lanyard is visible', async ({ page }) => {
  await expect(page.locator('.lanyard-canvas')).toBeVisible();
});

When('I scroll the page to its end', async ({ page }) => {
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(400);
});

Then('its research CTA is fully visible', async ({ page }) => {
  await expect(page.getByRole('link', { name: /Visit scenaryo\.app/ })).toBeInViewport({ ratio: 1 });
});

When('I follow its research CTA', async ({ page, context }) => {
  await context.route('https://scenaryo.app/research', (route) => route.fulfill({ body: '<title>Scenaryo research</title>' }));
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: /Visit scenaryo\.app/ }).click();
  const research = await popup;
  await research.waitForURL('https://scenaryo.app/research');
});

Then('the research URL opens', async ({ context }) => {
  expect(context.pages().some((page) => page.url() === 'https://scenaryo.app/research')).toBe(true);
});

Then('six recommendations share the same composition', async ({ page }) => {
  const cards = page.locator('.rec-card');
  await expect(cards).toHaveCount(6);
  for (const card of await cards.all()) {
    await expect(card.locator(':scope > blockquote')).toHaveCount(1);
    await expect(card.locator('figcaption .rec-person img')).toHaveCount(1);
    await expect(card.locator('figcaption .rec-byline > a')).toHaveCount(1);
    await expect(card.locator('figcaption .rec-role')).not.toBeEmpty();
    await expect(card.locator('figcaption .rec-proof')).not.toBeEmpty();
  }
});

Then('Dan Goldin has an honorary mention', async ({ page }) => {
  await expect(page.locator('.honorary-mention')).toContainText('Dan Goldin');
  await expect(page.locator('.honorary-mention')).toContainText('Congrats Jerry Schmalz, good luck lots of support from here!');
});

Then('the canonical URL is {string}', async ({ page }, url: string) => {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', url);
});
