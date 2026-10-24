import { expect, test } from './fixtures';
import { open, revealInSheet } from './helpers';

const models = [
  { stop: 'desk', chunk: /\/Desk\.[^/]+\.js$/, image: /\/desk\.[^/]+\.webp$/, title: 'My Berlin desk' },
  { stop: 'buildspace', chunk: /\/Lanyard\.[^/]+\.js$/, image: /\/buildspace-front\.[^/]+\.webp$/, title: 'buildspace' },
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const model of models) {
  test(`${model.stop} does not mount a stale model after closing during import`, async ({ page }) => {
    let resume = () => {};
    const held = new Promise<void>((resolve) => { resume = resolve; });
    await page.route(model.chunk, async (route) => { await held; await route.continue(); });
    await open(page);
    try {
      await page.locator(`[data-stop="${model.stop}"]`).click();
      await expect(page.locator('[data-model-state="loading"]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
    } finally {
      resume();
    }
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.desk-stage canvas, .lanyard-canvas')).toHaveCount(0);
    await page.locator('[data-stop="draper"]').click();
    await expect(page.locator('dialog[open]').getByRole('heading', { name: 'Draper University', exact: true })).toBeVisible();
    await expect(page.locator('[data-model-state]')).toHaveCount(0);
  });

  test(`${model.stop} loads on request, shows progress and becomes ready`, async ({ page }) => {
    let resume = () => {};
    const held = new Promise<void>((resolve) => { resume = resolve; });
    await page.route(model.chunk, async (route) => { await held; await route.continue(); });
    await open(page);
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
    expect(resources.filter((url) => /\/(Desk\.|Lanyard\.|three\.module)/.test(url))).toEqual([]);
    await expect(page.locator('.desk-stage canvas, .lanyard-canvas')).toHaveCount(0);
    try {
      await page.locator(`[data-stop="${model.stop}"]`).click();
      await expect(page.locator('[data-model-state="loading"]')).toBeVisible();
      await expect(page.locator('dialog[open]').getByRole('status')).toBeVisible();
    } finally {
      resume();
    }
    await expect(page.locator('[data-model-state="ready"]')).toBeVisible();
    await expect(page.locator('dialog[open] canvas')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open] canvas')).toHaveCount(0);
  });

  test(`${model.stop} keeps readable drawer content and artwork when the model chunk fails`, async ({ page }) => {
    await page.route(model.chunk, (route) => route.abort('failed'));
    await open(page);
    await page.locator(`[data-stop="${model.stop}"]`).click();
    const sheet = page.locator('dialog[open]');
    await expect(sheet.locator('[data-model-state="error"]')).toBeVisible();
    await expect(sheet.getByRole('alert')).toBeVisible();
    await expect(sheet.getByRole('heading', { name: model.title, exact: true })).toBeVisible();
    const fallback = sheet.locator('[data-model-state="error"] img').first();
    await expect(fallback).toBeVisible();
    await expect.poll(() => fallback.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
    const wheel = sheet.getByRole('listbox', { name: 'Stops on the path' });
    await expect(wheel).toBeVisible();
    // The wheel closes the entry, under the notes.
    await revealInSheet(page, '.model-wheel');
    await wheel.getByRole('option', { name: '2024 · Draper University', exact: true }).click();
    await expect(sheet.getByRole('heading', { name: 'Draper University', exact: true })).toBeVisible();
    await expect(sheet.locator('.sheet-body')).toHaveAttribute('data-drawer-state', 'ready');
    await expect(sheet.getByRole('alert')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test(`${model.stop} recovers from a failed texture when the visitor retries`, async ({ page }) => {
    let textureRequests = 0;
    // Give imperative renderer images a fresh URL. The visible fallback keeps its
    // original URL, so the browser cannot reuse that decoded image for this probe.
    await page.addInitScript((pattern) => {
      const NativeImage = window.Image;
      const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
      window.Image = new Proxy(NativeImage, {
        construct(target, args) {
          const image = Reflect.construct(target, args) as HTMLImageElement;
          Object.defineProperty(image, 'src', {
            get: () => src.get!.call(image),
            set(value: string) {
              const url = new URL(value, location.href);
              if (new RegExp(pattern).test(url.pathname)) url.searchParams.set('texture-probe', 'renderer');
              src.set!.call(image, url.href);
            },
          });
          return image;
        },
      });
    }, model.image.source);
    let resume = () => {};
    const held = new Promise<void>((resolve) => { resume = resolve; });
    await page.route(model.chunk, async (route) => { await held; await route.continue(); });
    const textureRoute = '**/*texture-probe=renderer';
    await page.route(textureRoute, (route) => {
      textureRequests++;
      return route.abort('failed');
    });
    await open(page);
    await page.locator(`[data-stop="${model.stop}"]`).click();
    const sheet = page.locator('dialog[open]');
    try {
      const fallback = sheet.locator('.model-loader__fallback');
      await expect.poll(() => fallback.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
    } finally {
      resume();
    }
    await expect(sheet.locator('[data-model-state="error"]')).toBeVisible();
    await expect(sheet.getByRole('alert')).toBeVisible();
    expect(textureRequests, 'the renderer made a real failed texture request').toBeGreaterThanOrEqual(1);
    await page.unroute(textureRoute);
    await sheet.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(sheet.locator('[data-model-state="ready"]')).toBeVisible();
    await expect(sheet.locator('canvas')).toBeVisible();
    await expect(sheet.locator('.sheet-body')).toHaveAttribute('data-drawer-state', 'ready');
    await expect(sheet.getByRole('alert')).toHaveCount(0);
  });
}
