import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

test.describe('page', () => {
  test('renders the hero with no console errors', async ({ page }) => {
    const errors = await open(page);
    await expect(page).toHaveTitle(/Jerry Schmalz/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jerry Schmalz');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /consumer apps/);
    await expect(page.locator('.hero-art img')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('never scrolls sideways', async ({ page }) => {
    await open(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('every image has alt text and every new-tab link is safe', async ({ page }) => {
    await open(page);
    expect(await page.locator('img:not([alt])').count()).toBe(0);
    const unsafe = await page.locator('a[target="_blank"]:not([rel*="noopener"])').count();
    expect(unsafe).toBe(0);
  });
});

test.describe('mascot', () => {
  test('smiles when poked, winks on the third poke', async ({ page }) => {
    await open(page);
    const mascot = page.locator('.hero .mascot');
    await mascot.click();
    await expect(mascot).toHaveAttribute('data-frame', '7');
    await mascot.click();
    await mascot.click();
    await expect(mascot).toHaveAttribute('data-frame', '15');
  });
});

test.describe('work', () => {
  test('opens a project sheet and closes it with Escape', async ({ page }) => {
    await open(page);
    await scrollToSelector(page, '#work');
    const card = page.locator('.work-card').first();
    await card.click();
    const sheet = page.locator('dialog[open]');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Scenaryo' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: /Visit scenaryo\.app/ })).toHaveAttribute('href', 'https://scenaryo.app/research');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('returns focus to the card after a keyboard open', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard journey');
    await open(page);
    await scrollToSelector(page, '#work');
    const card = page.locator('.work-card').first();
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(card).toBeFocused();
  });

  test('opens a sheet from the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard journey');
    await open(page);
    await scrollToSelector(page, '#work');
    await page.locator('.work-card').nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog[open]').getByRole('heading', { name: 'Tiding' })).toBeVisible();
  });

  test('discloses earlier work on demand', async ({ page }) => {
    await open(page);
    const details = page.locator('details.earlier');
    await details.locator('summary').scrollIntoViewIfNeeded();
    await expect(details.getByRole('link', { name: 'SceneXtras' })).toBeHidden();
    await details.locator('summary').click();
    await expect(details.getByRole('link', { name: 'SceneXtras' })).toBeVisible();
  });
});

test.describe('path', () => {
  test('shows the story behind a stop', async ({ page }) => {
    await open(page);
    await scrollToSelector(page, '#path');
    const stop = page.locator('.stop-btn', { hasText: 'Benify' });
    // Focus first: on a pinned desktop strip, focusing a stop brings it on screen.
    await stop.focus();
    await page.waitForTimeout(800);
    await expect(stop).toBeInViewport();
    await stop.click();
    const pop = page.locator('.stop-pop:popover-open');
    await expect(pop).toContainText('Beat the previous regional campaigns by 50%.');
    await page.keyboard.press('Escape');
    await expect(page.locator('.stop-pop:popover-open')).toHaveCount(0);
  });

  test('has a diorama for every stop', async ({ page }) => {
    await open(page);
    await expect(page.locator('.stop')).toHaveCount(11);
    await expect(page.locator('.stop-art img')).toHaveCount(11);
  });
});

test.describe('dock', () => {
  test('stays out of the way on the hero, then navigates', async ({ page }) => {
    await open(page);
    const dock = page.locator('.dock');
    await expect(dock).toHaveAttribute('data-shown', 'false');
    await scrollToSelector(page, '#work');
    await expect(dock).toHaveAttribute('data-shown', 'true');
    await dock.getByRole('link', { name: 'About' }).click();
    await expect(page.locator('#about')).toBeInViewport();
    await expect(dock.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('contact', () => {
  test('copies the email, celebrates, and confirms', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission is chromium-only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    await scrollToSelector(page, '#contact');
    const button = page.getByRole('button', { name: 'Copy email' });
    await button.click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    await expect(page.getByText('Email copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('jr.a.schmalz@gmail.com');
  });

  test('offers a CV download', async ({ page }) => {
    await open(page);
    const response = await page.request.get('/jerry-schmalz-cv.pdf');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('pdf');
  });
});

test.describe('preferences', () => {
  test('reduced motion: no smooth scroll, no pinning, statement fully readable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await page.waitForTimeout(1500);
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
    await expect(page.locator('html')).not.toHaveClass(/is-pinned/);
    const dim = await page.locator('.statement .word').evaluateAll((els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
    expect(dim).toBe(0);
  });

  test('dark mode paints a dark page', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page);
    const lightness = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = getComputedStyle(document.body).backgroundColor;
      document.body.append(probe);
      const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)!.map(Number);
      probe.remove();
      return (rgb[0]! + rgb[1]! + rgb[2]!) / 3;
    });
    expect(lightness).toBeLessThan(60);
  });
});
