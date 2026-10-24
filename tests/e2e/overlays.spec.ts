import { expect, test, type Locator, type Page } from './fixtures';
import { open } from './helpers';

/**
 * The regression guard for the overlay contract (src/lib/overlay.ts, components/Drawer.tsx).
 * Every drawer entry point on the page (the path stops; projects have pages of their own), on a short laptop and a small phone: long content
 * scrolls to its last line with the visitor's own input (wheel or touch), the page behind
 * stays put, and the drawer still closes. New entry points are picked up automatically.
 */
const ENTRY_POINTS = '[data-stop]';

const VIEWPORTS = [
  { name: 'small laptop', viewport: { width: 1024, height: 640 }, touch: false },
  { name: 'small phone', viewport: { width: 390, height: 664 }, touch: true },
] as const;

/** Where a visitor would put their finger or cursor: on the drawer's text, not on a draggable 3D model. */
async function readingPoint(page: Page, panel: Locator) {
  const point = await panel.evaluate((el) => {
    const visible = (r: DOMRect) => r.height > 0 && r.top + r.height / 2 > 0 && r.top + r.height / 2 < innerHeight;
    const text = [...el.querySelectorAll('.sheet-body > :is(header, p, ul, dl)')].map((n) => n.getBoundingClientRect()).find(visible);
    const r = text ?? el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: Math.min(r.top + r.height / 2, innerHeight - 24) };
  });
  return point;
}

async function scrollBy(page: Page, panel: Locator, touch: boolean) {
  const { x, y } = await readingPoint(page, panel);
  if (touch) {
    // Raw touch points: Chromium 156 no longer scrolls for Input.synthesizeScrollGesture, even on a plain page.
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', dy = 0) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: y - dy }] });
    await touch('touchStart');
    for (let step = 1; step <= 16; step++) {
      await touch('touchMove', step * 20);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 320);
  }
}

for (const { name, viewport, touch } of VIEWPORTS) {
  test.describe(`overlays on a ${name}`, () => {
    test.use({ viewport, hasTouch: touch, isMobile: touch });

    test('every drawer scrolls to its last line and still closes', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'Runs once, in Chromium, at its own viewports.');
      test.setTimeout(180_000);
      await open(page);
      const entries = page.locator(ENTRY_POINTS);
      const count = await entries.count();
      expect(count).toBeGreaterThan(10);

      for (let i = 0; i < count; i++) {
        const entry = entries.nth(i);
        const label = (await entry.getAttribute('data-stop')) ?? (await entry.getAttribute('aria-label')) ?? `entry ${i}`;
        // The pinned strip moves sideways with vertical scroll, so scrollIntoView alone cannot reach a stop; focus
        // brings it to the middle (motion/index.ts), as a keyboard user would. The click below is still a real mouse click.
        await entry.focus();
        await entry.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        await entry.click();
        const sheet = page.locator('dialog[open]');
        const panel = sheet.locator('[data-overlay]');
        await expect(panel, label).toBeVisible();
        await expect(page.locator('html'), label).toHaveAttribute('data-scroll-locked', '');
        // Measured once locked: the page behind must not move while the drawer scrolls.
        const pageTop = await page.evaluate(() => scrollY);
        const last = panel.locator('.sheet-body > :last-child');
        const start = await panel.evaluate((el) => el.scrollTop);

        await expect(async () => {
          await scrollBy(page, panel, touch);
          await expect(last).toBeInViewport({ ratio: 1, timeout: 400 });
        }, label).toPass({ timeout: 15_000 });

        const port = await panel.evaluate((el) => ({ top: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
        // Content that runs well past the drawer must have been reached by scrolling the drawer itself.
        // (A phone sheet may first grow to full height, which can be enough for a short entry.)
        if (port.scrollHeight - port.clientHeight > 40) expect(port.top, `${label} scrolls its own panel`).toBeGreaterThan(start);
        expect(await page.evaluate(() => scrollY), `${label} leaves the page behind alone`).toBe(pageTop);

        const close = sheet.locator('.scrollsheet-close');
        await close.scrollIntoViewIfNeeded();
        await expect(close, label).toBeInViewport();
        await close.click();
        await expect(page.locator('dialog[open]'), label).toHaveCount(0);
        await expect(page.locator('html'), label).not.toHaveAttribute('data-scroll-locked', '');
        expect(Math.abs((await page.evaluate(() => scrollY)) - pageTop), `${label} returns to the same place`).toBeLessThan(2);
      }
    });

    test('every path stop ends its text before the before-and-after wheel, which scrolls into reach', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'Runs once, in Chromium, at its own viewports.');
      test.setTimeout(120_000);
      await open(page);
      const stops = page.locator('[data-stop]');
      const count = await stops.count();
      expect(count).toBeGreaterThan(5);

      for (let i = 0; i < count; i++) {
        const entry = stops.nth(i);
        const label = (await entry.getAttribute('data-stop')) ?? `stop ${i}`;
        await entry.focus();
        await entry.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        await entry.click();
        const sheet = page.locator('dialog[open]');
        const panel = sheet.locator('[data-overlay]');
        const wheel = panel.locator('.model-wheel');
        await expect(wheel, label).toBeVisible();

        // In the DOM and on screen, the header, story and notes all come first.
        const order = await panel.evaluate((el) => {
          const nav = el.querySelector('.model-wheel')!;
          const text = [...el.querySelectorAll('.sheet-body > :is(.model-caption, .detail-story, .detail-list)')];
          const top = nav.getBoundingClientRect().top;
          return {
            texts: text.length,
            before: text.every((n) => Boolean(n.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING)),
            gap: Math.min(...text.map((n) => top - n.getBoundingClientRect().bottom)),
          };
        });
        expect(order.texts, `${label} has a caption and notes`).toBeGreaterThanOrEqual(2);
        expect(order.before, `${label} keeps the wheel after its text in the DOM`).toBe(true);
        expect(order.gap, `${label} sets the wheel visibly below its text`).toBeGreaterThanOrEqual(16);

        // The visitor's own wheel or touch brings the whole wheel into view.
        await expect(async () => {
          await scrollBy(page, panel, touch);
          await expect(wheel).toBeInViewport({ ratio: 1, timeout: 400 });
        }, label).toPass({ timeout: 15_000 });

        await sheet.locator('.scrollsheet-close').click();
        await expect(page.locator('dialog[open]'), label).toHaveCount(0);
      }
    });
  });
}
