import { expect, test } from '../e2e/fixtures'; // the page behind the once-per-session enter gate (its oil lens is WebGL by design)

/**
 * Budgets for what Lighthouse cannot see: work done while the visitor scrolls.
 * Desktop Chrome only; numbers are generous enough for CI noise and tight enough to catch regressions.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __long: number[]; __cls: number; __webgl: string[] };
    w.__webgl = [];
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') w.__webgl.push(type);
        return Reflect.apply(getContext, this, [type, ...args]);
      },
    });
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
  const initial = await page.evaluate(() => ({
    bytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).encodedBodySize, 0),
    webgl: (window as unknown as { __webgl: string[] }).__webgl,
  }));
  expect(initial.bytes, 'initial encoded resource bytes').toBeLessThan(500 * 1024);
  expect(initial.webgl, 'no WebGL contexts before user intent').toEqual([]);
  await expect(page.locator('.desk-stage canvas, .lanyard-canvas')).toHaveCount(0);
  expect(scripts.map((script) => script.name).join(' ')).not.toMatch(/\/(Desk\.|Lanyard\.|three\.module)/);
  const total = scripts.reduce((sum, s) => sum + s.kb, 0);
  await test.info().attach('initial-budget.json', { body: JSON.stringify({ javascriptKiB: total, resourcesKiB: initial.bytes / 1024, webglContexts: initial.webgl.length }), contentType: 'application/json' });
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
  await test.info().attach('scroll-budget.json', { body: JSON.stringify({ cls, longestTaskMs: Math.max(0, ...long), p95FrameMs: p95, samples: frames.length }), contentType: 'application/json' });
  expect(cls, 'cumulative layout shift').toBeLessThan(0.05);
  expect(Math.max(0, ...long), 'longest task (ms)').toBeLessThan(200);
  expect(p95, 'p95 frame time (ms)').toBeLessThan(50);
});


test('the work gradient remains static on and offscreen and under reduced motion', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const face = page.locator('.work-face').first();
  expect(await face.evaluate((el) => getComputedStyle(el, '::before').animationName)).toBe('none');
  await face.scrollIntoViewIfNeeded();
  expect(await face.evaluate((el) => getComputedStyle(el, '::before').backgroundImage)).toContain('radial-gradient');
  expect(await face.evaluate((el) => getComputedStyle(el, '::before').animationName)).toBe('none');
  expect(await page.locator('.work-phone').first().evaluate((el) => getComputedStyle(el).filter)).toContain('drop-shadow');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await face.evaluate((el) => getComputedStyle(el, '::before').animationName)).toBe('none');
});

test('allocates a model WebGL context only after the Berlin desk is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(await page.evaluate(() => (window as unknown as { __webgl: string[] }).__webgl)).toEqual([]);
  const stop = page.locator('[data-stop="desk"]');
  await stop.focus();
  await stop.click();
  await expect(page.locator('.desk-stage canvas')).toBeVisible();
  await expect(page.locator('[data-model-state="ready"]')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __webgl: string[] }).__webgl.length)).toBeGreaterThan(0);
});
