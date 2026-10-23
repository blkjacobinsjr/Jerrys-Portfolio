import { expect, test } from '@playwright/test';
import { open } from './helpers';

const lcpAndCls = () =>
  new Promise<{ lcp: string; cls: number }>((resolve) => {
    let lcp = '';
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { element?: Element }>) lcp = e.element?.closest('[data-hero-art]') ? 'desk' : (e.element?.tagName ?? '');
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => resolve({ lcp, cls }), 600);
  });

/** t139 preview: the hero opens on the laptop screen and scroll pulls back to the desk; the desk stays the LCP. */
test('hero zoom: scroll pulls back from the laptop screen to the desk, transform only, desk stays LCP', async ({ page, browserName }) => {
  const errors = await open(page);
  const pic = page.locator('[data-hero-art][data-zoom] picture');
  const supported = await page.evaluate(() => CSS.supports('animation-timeline: scroll()'));
  test.skip(!supported, `${browserName} has no scroll-driven animations: it keeps the static desk`);
  const { lcp, cls } = await page.evaluate(lcpAndCls);
  expect(lcp, 'the LCP is still the desk image').toBe('desk');
  expect(cls).toBeLessThan(0.001);
  await expect(pic).toHaveCSS('animation-name', 'hero-pull');
  const scale = () => pic.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  const vh = await page.evaluate(() => innerHeight);
  await page.evaluate((y) => scrollTo(0, y), vh * 3);
  await expect.poll(scale).toBeCloseTo(1, 2);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  const narrow = (page.viewportSize()?.width ?? 0) < 900;
  if (!narrow) expect(await scale()).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('hero zoom: reduced motion keeps the static desk', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await open(page);
  const pic = page.locator('[data-hero-art] picture');
  await expect(pic).toHaveCSS('animation-name', 'none');
  await expect(pic).toHaveCSS('transform', 'none');
  expect(errors).toEqual([]);
});
