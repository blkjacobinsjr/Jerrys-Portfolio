import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
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

test('no axe violations with a project sheet open', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await scrollToSelector(page, '#work');
  await page.locator('.work-card').first().click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('dialog[open]').withTags(TAGS).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
