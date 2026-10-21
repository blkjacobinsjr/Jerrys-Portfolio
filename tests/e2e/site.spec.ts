import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

test.describe('page', () => {
  test('renders the hero with no console errors', async ({ page }) => {
    const errors = await open(page);
    await expect(page).toHaveTitle(/Jerry Doughan/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jerry Doughan');
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
  test('opens the same drawer for a stop, with the building and its story', async ({ page }) => {
    await open(page);
    await scrollToSelector(page, '#path');
    const stop = page.locator('[data-stop="benify"]');
    // Focus first: on a pinned desktop strip, focusing a stop brings it on screen.
    await stop.focus();
    await page.waitForTimeout(800);
    await expect(stop).toBeInViewport();
    await stop.click();
    const sheet = page.locator('dialog[open]');
    await expect(sheet.getByRole('heading', { name: 'Benify' })).toBeVisible();
    await expect(sheet).toContainText('Beat the previous regional campaigns by 50%.');
    await expect(sheet.locator('.model img')).toHaveAttribute('alt', /Benify/);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('tells the Draper University story with the award and the demo day post', async ({ page }) => {
    await open(page);
    await scrollToSelector(page, '#path');
    const stop = page.locator('[data-stop="draper"]');
    await stop.focus();
    await page.waitForTimeout(800);
    await stop.click();
    const sheet = page.locator('dialog[open]');
    await expect(sheet.getByRole('heading', { name: 'Draper University' })).toBeVisible();
    await expect(sheet).toContainText('shark-infested water');
    await expect(sheet.getByRole('img', { name: /Degree of Change Agent/ })).toBeAttached();
    await expect(sheet.getByRole('link', { name: /demo day story/ })).toHaveAttribute('href', /linkedin\.com\/posts\/jasdoughan/);
  });

  test('has a diorama and a glow for every stop, oldest to now', async ({ page }) => {
    await open(page);
    await expect(page.locator('.stop')).toHaveCount(13);
    await expect(page.locator('.stop-art img')).toHaveCount(13);
    await expect(page.locator('.stop-glow')).toHaveCount(13);
    const ids = await page.locator('[data-stop]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.stop));
    expect(ids.slice(-3)).toEqual(['buildspace', 'draper', 'scenaryo']);
  });
});

test.describe('statement', () => {
  test('resolves word by word on a scroll timeline that survived minification', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'scroll timelines are asserted in Chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    const timeline = await page.locator('.statement .word').first().evaluate((el) => getComputedStyle(el).animationTimeline);
    expect(timeline).toBe('--statement');
    // Before the stage is reached, unread words are blurred.
    const blur = await page.locator('.statement .word').last().evaluate((el) => getComputedStyle(el).filter);
    expect(blur).toContain('blur');
  });

  test('never folds a scroll timeline into the animation shorthand', async ({ page }) => {
    const html = await (await page.request.get('/')).text();
    const shorthands = [...html.matchAll(/animation:([^;}]*)/g)].map((m) => m[1] ?? '');
    const broken = shorthands.filter((value) => /(^|\s)--[\w-]+|view\(|scroll\(/.test(value));
    expect(broken).toEqual([]);
  });
});

test.describe('keyring', () => {
  test('hangs in the sky and swings when the page moves', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'physics timing asserted in Chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    const keyring = page.getByRole('img', { name: /keyring/ });
    await expect(keyring).toHaveAttribute('aria-label', /locket with a photo of my baby/);
    await page.evaluate(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(1200);
    const rig = page.locator('[data-keyring] .rig');
    const before = await rig.evaluate((el) => (el as HTMLElement).style.rotate);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(150);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(400);
    const after = await rig.evaluate((el) => (el as HTMLElement).style.rotate);
    expect(after).not.toBe('');
    expect(after).not.toBe(before);
  });

  test('stops swinging and settles at rest when reduced motion is switched on', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'physics timing asserted in Chromium');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    await page.evaluate(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(1200);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300);
    const rig = page.locator('[data-keyring] .rig');
    const first = await rig.evaluate((el) => (el as HTMLElement).style.rotate);
    await page.waitForTimeout(600);
    const second = await rig.evaluate((el) => (el as HTMLElement).style.rotate);
    expect(first).toBe('0deg');
    expect(second).toBe(first);
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
    const response = await page.request.get('/jerry-doughan-cv.pdf');
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
