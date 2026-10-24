import { expect, test } from './fixtures';

const targets = ['about', 'recommendations', 'contact', 'work', 'path'] as const;
const motionPreferences = ['no-preference', 'reduce'] as const;

for (const target of targets) {
  for (const reducedMotion of motionPreferences) {
    test(`/#${target} stays aligned with ${reducedMotion} motion`, async ({ page }, testInfo) => {
      const desktop = testInfo.project.name === 'desktop';
      const width = desktop ? 1440 : 390;
      await page.setViewportSize({ width, height: desktop ? 900 : 844 });
      await page.emulateMedia({ reducedMotion });
      await page.goto(`/#${target}`);
      await page.waitForLoadState('networkidle');

      const pinExpected = desktop && reducedMotion === 'no-preference';
      if (pinExpected) await expect(page.locator('html')).toHaveClass(/is-pinned/);
      else await expect(page.locator('html')).not.toHaveClass(/is-pinned/);

      // Base starts motion after load and idle. Allow its later refreshes to settle.
      await page.waitForTimeout(2500);

      const alignment = await page.locator(`#${target}`).evaluate((element) => ({
        top: element.getBoundingClientRect().top,
        margin: Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0,
      }));
      expect(Math.abs(alignment.top - alignment.margin), `/#${target} top matches its scroll margin`).toBeLessThanOrEqual(4);
    });
  }
}

test('a late path pin preserves manual scroll input after load', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The path pin only runs on desktop Chromium.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#about', { waitUntil: 'load' });
  await page.mouse.wheel(0, 240);
  await expect(page.locator('html')).toHaveAttribute('data-user-intent', 'true');
  await expect(page.locator('html')).toHaveClass(/is-pinned/);
  await page.waitForTimeout(2500);

  const alignment = await page.locator('#about').evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    margin: Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0,
  }));
  expect(Math.abs(alignment.top - alignment.margin), 'late pin must not undo manual scroll input').toBeGreaterThan(4);
});
