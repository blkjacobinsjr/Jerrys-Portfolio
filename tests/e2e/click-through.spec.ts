import { expect, test, type Locator, type Page } from './fixtures';
import { open, scrollToSelector } from './helpers';

/**
 * Standing rule: every interactive effect lets the click reach what is under it. Each test mounts the effect, then
 * checks that the topmost element at the centre of each control is that control (or inside it), and clicks one for real.
 */
const hitsItself = async (page: Page, target: Locator) => {
  const box = await target.boundingBox();
  if (!box) throw new Error('no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const handle = await target.elementHandle();
  return page.evaluate(([px, py, el]) => {
    const top = document.elementFromPoint(px as number, py as number);
    return !!top && (el as Element).contains(top);
  }, [x, y, handle] as const);
};

test('footer smoke and glass never cover the footer links', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Coarse pointers never get the footer effects.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await scrollToSelector(page, '#contact');
  await page.mouse.move(300, 300);
  await page.mouse.move(360, 340, { steps: 4 });
  await expect(page.locator('#contact .ghost-cursor canvas')).toBeVisible({ timeout: 10_000 });
  for (const link of await page.locator('#contact .contact-links a, #contact [data-sound-toggle]').all()) {
    await link.scrollIntoViewIfNeeded();
    await link.hover();
    expect(await hitsItself(page, link)).toBe(true);
  }
  const toggle = page.locator('#contact [data-sound-toggle]');
  const before = await toggle.getAttribute('aria-pressed');
  await toggle.click({ noWaitAfter: true, trial: false });
  await expect(toggle).not.toHaveAttribute('aria-pressed', before ?? '');
});

test('the startup-program tooltip never blocks the marks under it', async ({ page }) => {
  await open(page);
  const marks = page.locator('[data-programs] > li');
  const count = await marks.count();
  for (let i = 0; i < count; i++) {
    const mark = marks.nth(i);
    await mark.hover();
    expect(await hitsItself(page, mark)).toBe(true);
  }
  await expect(page.locator('.p17-tooltip')).toHaveCSS('pointer-events', 'none');
});

test('the hero signature replays on a real click', async ({ page }) => {
  await open(page);
  const replay = page.locator('[data-signature-replay]');
  expect(await hitsItself(page, replay)).toBe(true);
  await replay.click();
});

test('the program tooltip follows transitions.dev tooltip-open-close: 80ms delay, 150ms in, 50ms out, glides between marks', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover behaviour; a tap toggles it on phones.');
  await open(page);
  const tip = page.locator('.p17-tooltip');
  const marks = page.locator('[data-programs] > li');
  await marks.nth(0).hover();
  await expect(tip).toHaveAttribute('data-show', 'true');
  await expect(tip).toHaveText('Microsoft for Startups');
  const t = await tip.evaluate((el) => getComputedStyle(el).transitionDuration + ' | ' + getComputedStyle(el).transitionDelay);
  expect(t).toBe('0.15s, 0.15s, 0.16s, 0.16s | 0.08s, 0.08s, 0s, 0s');
  await marks.nth(1).hover();
  await expect(tip).toHaveText('Google for Startups');
  await page.mouse.move(5, 5);
  await expect(tip).toHaveAttribute('data-show', 'false');
  expect(await tip.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.05s, 0.05s, 0.16s, 0.16s');
});
