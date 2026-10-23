import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('draws the inline signature once, keeps its reserved box stable, and stays out of LCP', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const root = () => document.documentElement;
    const setMetric = (key: string, value: string) => {
      const element = root();
      if (element) element.dataset[key] = value;
    };
    const count = (key: string) => {
      const element = root();
      if (element) element.dataset[key] = String(Number(element.dataset[key] ?? 0) + 1);
    };
    const isSignatureMask = (event: Event) =>
      event.target instanceof SVGPathElement && event.target.hasAttribute('data-signature-mask');

    document.addEventListener('animationstart', (event) => {
      if (event.animationName === 'signature-reveal' && isSignatureMask(event)) count('signatureStarts');
    });
    document.addEventListener('animationend', (event) => {
      if (event.animationName === 'signature-reveal' && isSignatureMask(event)) count('signatureEnds');
    });

    const sampleProgress = () => {
      const masks = [...document.querySelectorAll<SVGPathElement>('[data-signature-mask]')];
      if (masks.some((mask) => {
        const offset = Number.parseFloat(getComputedStyle(mask).strokeDashoffset);
        return offset > 0.02 && offset < 0.98;
      })) {
        setMetric('signatureProgressed', 'true');
        const box = document.querySelector('[data-signature]')?.getBoundingClientRect();
        if (box) {
          setMetric('signatureDrawWidth', String(box.width));
          setMetric('signatureDrawHeight', String(box.height));
        }
        return;
      }
      requestAnimationFrame(sampleProgress);
    };
    requestAnimationFrame(sampleProgress);

    const supported = PerformanceObserver.supportedEntryTypes ?? [];
    const publishSupport = () => {
      const element = root();
      if (!element) {
        requestAnimationFrame(publishSupport);
        return;
      }
      element.dataset.signatureClsSupported = String(supported.includes('layout-shift'));
      element.dataset.signatureLcpSupported = String(supported.includes('largest-contentful-paint'));
    };
    requestAnimationFrame(publishSupport);
    if (supported.includes('layout-shift')) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ('value' in entry && typeof entry.value === 'number' && 'hadRecentInput' in entry && entry.hadRecentInput === false) {
            const element = root();
            if (element) element.dataset.signatureCls = String(Number(element.dataset.signatureCls ?? 0) + entry.value);
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }

    if (supported.includes('largest-contentful-paint')) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ('element' in entry && entry.element instanceof Element && entry.element.closest('[data-signature]')) {
            setMetric('signatureWasLcp', 'true');
          }
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    }
  });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  const errors = await open(page);

  const signature = page.locator('[data-signature]');
  const masks = signature.locator('[data-signature-mask]');
  const fills = signature.locator('[data-signature-fill]');
  await expect(signature).toBeVisible();
  await expect(page.locator('.hero-copy > [data-signature-replay] > [data-signature]')).toHaveCount(1);
  expect(await signature.evaluate((element) => ({
    previous: element.parentElement?.previousElementSibling?.className,
    next: element.parentElement?.nextElementSibling?.className,
  }))).toEqual({ previous: 'hero-bio', next: 'hero-links' });
  await expect(masks).toHaveCount(3);
  await expect(fills).toHaveCount(3);
  const drawSeconds = await masks.evaluateAll((paths) => Math.max(...paths.map((path) => {
    const style = getComputedStyle(path);
    return Number.parseFloat(style.animationDelay) + Number.parseFloat(style.animationDuration);
  })));
  expect(drawSeconds).toBeGreaterThan(1.5);
  expect(drawSeconds).toBeLessThanOrEqual(1.85);
  if (testInfo.project.name === 'mobile') expect((await signature.boundingBox())!.width).toBeLessThanOrEqual(102.9);
  await expect.poll(() => page.locator('html').getAttribute('data-signature-progressed')).toBe('true');
  await expect.poll(() => page.locator('html').getAttribute('data-signature-ends'), { timeout: 4_000 }).toBe('3');
  await expect(page.locator('html')).toHaveAttribute('data-signature-starts', '3');

  const endOffsets = await masks.evaluateAll((paths) => paths.map((path) => Number.parseFloat(getComputedStyle(path).strokeDashoffset)));
  expect(endOffsets).toEqual([0, 0, 0]);
  expect(await masks.evaluateAll((paths) => paths.map((path) => path.getAttribute('pathLength')))).toEqual(['1', '1', '1']);
  expect(await masks.evaluateAll((paths) => paths.map((path) => getComputedStyle(path).animationIterationCount))).toEqual(['1', '1', '1']);
  expect(await fills.evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')))).toEqual(['currentColor', 'currentColor', 'currentColor']);

  await page.evaluate(() => document.fonts.ready);
  const before = await signature.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  const during = await page.locator('html').evaluate((element) => ({
    width: Number(element.dataset.signatureDrawWidth),
    height: Number(element.dataset.signatureDrawHeight),
  }));
  expect(during.width).toBeCloseTo(before.width, 1);
  expect(during.height).toBeCloseTo(before.height, 1);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.locator('html')).toHaveAttribute('data-signature-starts', '3');
  const after = await signature.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  expect(after).toEqual(before);

  if (await page.locator('html').getAttribute('data-signature-cls-supported') === 'true') {
    expect(Number(await page.locator('html').getAttribute('data-signature-cls'))).toBe(0);
  }
  if (testInfo.project.name === 'desktop') {
    const supported = await page.evaluate(() => PerformanceObserver.supportedEntryTypes ?? []);
    expect(supported).toContain('layout-shift');
    expect(supported).toContain('largest-contentful-paint');
    expect(await page.locator('html').getAttribute('data-signature-cls-supported')).toBe('true');
    expect(await page.locator('html').getAttribute('data-signature-lcp-supported')).toBe('true');
    expect(await page.locator('html').getAttribute('data-signature-was-lcp')).not.toBe('true');
  }
  expect(errors).toEqual([]);

  const screenshotDir = process.env.SIGNATURE_SCREENSHOT_DIR;
  const screenshotSize = testInfo.project.name === 'desktop'
    ? { width: 1440, height: 900, name: '1440' }
    : testInfo.project.name === 'mobile'
      ? { width: 390, height: 844, name: '390' }
      : undefined;
  if (screenshotDir && screenshotSize) {
    await mkdir(screenshotDir, { recursive: true });
    await page.setViewportSize({ width: screenshotSize.width, height: screenshotSize.height });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' });
      await page.screenshot({ path: resolve(screenshotDir, `signature-${screenshotSize.name}-${colorScheme}.png`) });
    }
  }
});

test('shows the complete signature without animation for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await open(page);

  const signature = page.locator('[data-signature]');
  const masks = signature.locator('[data-signature-mask]');
  await expect(signature).toBeVisible();
  await expect(masks).toHaveCount(3);
  expect(await masks.evaluateAll((paths) => paths.map((path) => Number.parseFloat(getComputedStyle(path).strokeDashoffset)))).toEqual([0, 0, 0]);
  expect(await masks.evaluateAll((paths) => paths.map((path) => getComputedStyle(path).animationName))).toEqual(['none', 'none', 'none']);
});

const dashOffsets = (page: import('@playwright/test').Page) =>
  page.locator('[data-signature-mask]').evaluateAll((paths) => paths.map((path) => Number.parseFloat(getComputedStyle(path).strokeDashoffset)));

test('clicking or pressing Enter on the signature replays the draw-in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  const replay = page.getByRole('button', { name: 'Replay signature' });
  await expect(replay).toBeVisible();
  // Let the first draw-in finish: every stroke fully revealed.
  await expect.poll(() => dashOffsets(page), { timeout: 10_000 }).toEqual([0, 0, 0]);

  for (const press of [() => replay.click(), async () => { await replay.focus(); await page.keyboard.press('Enter'); }, async () => { await replay.focus(); await page.keyboard.press('Space'); }]) {
    await press();
    // The first stroke starts hidden again, then the strokes redraw to complete.
    await expect.poll(async () => (await dashOffsets(page)).some((offset) => offset > 0.02), { timeout: 3000 }).toBe(true);
    await expect.poll(() => dashOffsets(page), { timeout: 10_000 }).toEqual([0, 0, 0]);
  }
});

test('replaying the signature under reduced motion redraws it instantly, without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.getByRole('button', { name: 'Replay signature' }).click();
  expect(await dashOffsets(page)).toEqual([0, 0, 0]);
  expect(await page.locator('[data-signature]').evaluate((svg) => svg.getAnimations({ subtree: true }).length)).toBe(0);
});
