import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { open, scrollToSelector } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

for (const colorScheme of ['light', 'dark'] as const) {
  test(`no axe violations on the page (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await open(page);
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`no axe violations on a project page (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await open(page, '/work/scenaryo');
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('no axe violations with a path drawer open', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await scrollToSelector(page, '#path');
  const stop = page.locator('[data-stop="draper"]');
  await stop.focus();
  await stop.click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('dialog[open]').withTags(TAGS).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

for (const stop of ['desk', 'buildspace']) {
  test(`no axe violations with the ${stop} model and keyboard controls ready`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await page.locator(`[data-stop="${stop}"]`).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog[open] [data-model-state="ready"]')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).include('dialog[open]').withTags(TAGS).analyze();
    expect(violations.map((violation) => violation.id)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.locator(`[data-stop="${stop}"]`)).toBeFocused();
  });

  test(`no axe violations when the ${stop} model falls back without WebGL`, async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
          if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
          return Reflect.apply(original, this, [type, ...args]);
        },
      });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await page.locator(`[data-stop="${stop}"]`).click();
    await expect(page.locator('dialog[open] [data-model-state="error"]')).toBeVisible();
    await expect(page.locator('dialog[open]').getByRole('alert')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).include('dialog[open]').withTags(TAGS).analyze();
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
}
