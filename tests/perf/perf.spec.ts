import { expect, test } from '@playwright/test';

/**
 * Budgets for what Lighthouse cannot see: work done while the visitor scrolls.
 * Desktop Chrome only; numbers are generous enough for CI noise and tight enough to catch regressions.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __long: number[]; __cls: number };
    w.__long = [];
    w.__cls = 0;
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((list) =>
      list.getEntries().forEach((e) => {
        const shift = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) w.__cls += shift.value;
      }),
    ).observe({ type: 'layout-shift', buffered: true });
  });
});

test('keeps the first-visit JavaScript small and the WebGL effects for later', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const scripts = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => r.name.endsWith('.js'))
      .map((r) => ({ name: r.name, kb: (r as PerformanceResourceTiming).encodedBodySize / 1024 })),
  );
  const total = scripts.reduce((sum, s) => sum + s.kb, 0);
  expect(total, 'compressed JS before any interaction (KB)').toBeLessThan(180);
  // metal-fx and simple-liquid-glass only arrive on the first pointer, wheel or key intent.
  const before = scripts.map((s) => s.name).join(' ');
  await page.mouse.move(600, 400);
  await page.mouse.move(640, 420, { steps: 4 });
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.endsWith('.js')).length);
  expect(after, 'intent loads the deferred effects').toBeGreaterThan(scripts.length);
  expect(before).not.toMatch(/index\.es|liquid/i);
});

test('scrolling the whole page stays smooth and stable', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  // A real visitor moves the pointer while reading the hero; that warms the dock's glass.
  await page.mouse.move(700, 400);
  await page.mouse.move(760, 420, { steps: 5 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    (window as unknown as { __long: number[] }).__long = [];
  });
  await page.evaluate(() => {
    (window as unknown as { __frames: number[] }).__frames = [];
    let last = performance.now();
    const tick = (t: number) => {
      (window as unknown as { __frames: number[] }).__frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 300) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1500);
  const { long, cls, frames } = await page.evaluate(() => {
    const w = window as unknown as { __long: number[]; __cls: number; __frames: number[] };
    return { long: w.__long, cls: w.__cls, frames: w.__frames.slice(5).sort((a, b) => a - b) };
  });
  const p95 = frames[Math.floor(frames.length * 0.95)] ?? 0;
  expect(cls, 'cumulative layout shift').toBeLessThan(0.05);
  expect(Math.max(0, ...long), 'longest task (ms)').toBeLessThan(200);
  expect(p95, 'p95 frame time (ms)').toBeLessThan(50);
});
