import { expect, test } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

test('FluidGlass mounts over the footer heading only after intent, and reduced motion keeps the plain heading', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Phones and touch never mount the lens (see below).');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors = await open(page);
  await scrollToSelector(page, '#contact-title');
  await expect(page.locator('.contact-glass')).toHaveCount(0);

  // A wheel never mounts it; a pointer in the footer does (a tap on phones).
  // Mobile WebKit has no Playwright mouse wheel.
  if (test.info().project.name !== 'safari') await page.mouse.wheel(0, 10);
  await page.waitForTimeout(300);
  await expect(page.locator('.contact-glass')).toHaveCount(0);
  await page.mouse.move(200, 300);
  await page.mouse.move(400, 320, { steps: 3 });
  await expect(page.locator('.contact-glass canvas')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#contact-title')).toHaveAttribute('data-glass', '');
  await expect(page.locator('#contact-title')).toHaveAccessibleName('Have an app that should feel this good?');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.contact-glass')).toHaveCount(0);
  await expect(page.locator('#contact-title')).not.toHaveAttribute('data-glass', '');
  expect(errors).toEqual([]);
});

test.describe('phones and touch', () => {
  test('the lens never mounts on a coarse pointer, and the heading and Copy email work under it', async ({ page, context }, info) => {
    test.skip(info.project.name === 'desktop', 'Touch projects only.');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const errors = await open(page);
    await scrollToSelector(page, '#contact-title');
    const t = (await page.locator('#contact-title').boundingBox())!;
    await page.touchscreen.tap(t.x + 4, t.y + t.height / 2);
    await page.waitForTimeout(1200);
    await expect(page.locator('.contact-glass')).toHaveCount(0);
    await expect(page.locator('#contact-title')).not.toHaveAttribute('data-glass', '');
    const cta = page.getByRole('button', { name: /copy email/i });
    await cta.tap();
    await expect(page.getByText('Email copied')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test('desktop: Copy email still clicks through with the lens mounted over the heading', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop only.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = await open(page);
  await scrollToSelector(page, '#contact-title');
  await page.mouse.move(200, 300);
  await page.mouse.move(400, 320, { steps: 3 });
  await expect(page.locator('.contact-glass canvas')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /copy email/i }).click();
  await expect(page.getByText('Email copied')).toBeVisible();
  expect(errors).toEqual([]);
});
