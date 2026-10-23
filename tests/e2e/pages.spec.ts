import { expect, test, type Page } from '@playwright/test';
import { open, scrollToSelector } from './helpers';

/** Phase 2: the dock's pages (writing, consultancy, contact) and the dock that links them. */

test('the dock links About on the page and Writing, Consultancy and Contact as pages', async ({ page }) => {
  await open(page);
  await scrollToSelector(page, '#work');
  const dock = page.getByRole('navigation', { name: 'Sections' });
  await expect(dock.getByRole('link')).toHaveText(['About', 'Writing', 'Consultancy', 'Contact']);
  await expect(dock.getByRole('link', { name: 'Writing' })).toHaveAttribute('href', '/writing');
  await expect(dock.getByRole('link', { name: 'Consultancy' })).toHaveAttribute('href', '/consultancy');
  await expect(dock.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
});

for (const [path, label] of [['/writing', 'Writing'], ['/consultancy', 'Consultancy'], ['/contact', 'Contact']] as const) {
  test(`${path} shows the dock straight away, with its own tab current`, async ({ page }) => {
    const errors = await open(page, path);
    const dock = page.locator('.dock');
    await expect(dock).toHaveAttribute('data-shown', 'true');
    await expect(dock.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    await expect(dock.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/#about');
    expect(errors).toEqual([]);
  });
}

test('/writing has an empty state and a feed, ready for markdown posts', async ({ page, request }) => {
  await open(page, '/writing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Writing');
  await expect(page.locator('[data-empty]')).toContainText('Nothing published yet');
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', '/rss.xml');
  const feed = await request.get('/rss.xml');
  expect(feed.ok()).toBe(true);
  expect(await feed.text()).toContain('<title>Writing, Jerry Doughan</title>');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const route of ['/writing', '/consultancy', '/contact']) expect(sitemap).toContain(`https://jerrydoughan.com${route}</loc>`);
});

test('/consultancy is the Leapfrog AI badge, with lfg-ai.com under it', async ({ page }) => {
  await open(page, '/consultancy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jerry Doughan, Founder of Leapfrog AI');
  await expect(page.getByRole('img', { name: /Leapfrog AI badge/ })).toBeVisible();
  const link = page.getByRole('link', { name: /lfg-ai\.com/ });
  await expect(link).toHaveAttribute('href', 'https://lfg-ai.com');
  await expect(link).toBeInViewport();
});

test('/consultancy keeps the still badge until the visitor moves, then hangs it on the lanyard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones wake it with the first touch.');
  await open(page, '/consultancy');
  await expect(page.locator('.badge-stage [data-model-state="static"]')).toHaveCount(1);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /Lanyard/.test(r.name)))).toBe(false);
  await page.mouse.move(400, 300);
  await page.mouse.move(440, 340, { steps: 4 });
  await expect(page.locator('.badge-stage [data-model-state="ready"]')).toHaveCount(1, { timeout: 15_000 });
});

test('/consultancy stays a still badge with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '/consultancy');
  await page.mouse.move(400, 300);
  await page.mouse.move(440, 340, { steps: 4 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.badge-stage [data-model-state="static"]')).toHaveCount(1);
});

/** Record the mail the page hands to the mail app instead of launching it. */
async function catchMail(page: Page) {
  await page.addInitScript(() => {
    const mail: string[] = [];
    (window as unknown as { __mail: string[] }).__mail = mail;
    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest?.('a[href^="mailto:"]');
      if (a && !a.closest('.letter-alt')) {
        e.preventDefault();
        mail.push(a.getAttribute('href')!);
      }
    }, true);
  });
  return () => page.evaluate(() => (window as unknown as { __mail: string[] }).__mail);
}

/** Count how many times the crumple scene was mounted; a click can outlast the whole animation, so the test cannot poll for it. */
async function countPaper(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __paper: number };
    w.__paper = 0;
    let seen = false;
    new MutationObserver(() => {
      const now = !!document.querySelector('.letter-paper');
      if (now && !seen) w.__paper += 1;
      seen = now;
    }).observe(document, { childList: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { __paper: number }).__paper);
}

async function write(page: Page) {
  const letter = page.locator('form.letter');
  await letter.getByText('Consultancy').click();
  await letter.getByPlaceholder('you@studio.com').fill('ana@studio.com');
  await letter.getByRole('textbox', { name: 'Your message' }).fill('An AI rollout for our support team.');
}

test('/contact is a letter: write it, then the stub tears to send it through your mail app', async ({ page }) => {
  await open(page, '/contact');
  const letter = page.locator('form.letter');
  await expect(letter.getByRole('heading', { level: 1 })).toHaveText('Jerry Doughan');
  const send = letter.getByRole('button', { name: 'Send with your mail app' });
  const stub = page.locator('.letter-ticket [role="button"]');
  await expect(send).toBeDisabled();
  await expect(stub).toHaveAttribute('aria-disabled', 'true');
  await write(page);
  await expect(send).toBeEnabled();
  await expect(stub).not.toHaveAttribute('aria-disabled', 'true');
  await expect(stub).toHaveAttribute('aria-label', 'Tear to send: tear off the stub to send the letter');
  await expect(page.locator('.ticket-body')).toContainText('Consultancy');
  await expect(page.locator('.ticket-body')).toContainText('ana@studio.com');
  await expect(page.locator('.ticket-body [role="status"]')).toHaveText('Ready to send');
});

test('/contact: tearing the stub sends exactly what the send button sends', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The drag is driven with the Chromium mouse');
  const mail = await catchMail(page);
  await open(page, '/contact');
  await write(page);
  await page.getByRole('button', { name: 'Send with your mail app' }).click();
  const [viaButton] = await mail();
  expect(viaButton).toContain('subject=Consultancy');
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.locator('form.letter[data-hidden]')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('.letter-paper')).toHaveCount(0, { timeout: 10_000 });
  await write(page);
  await page.locator('.ticket-stub').scrollIntoViewIfNeeded();
  const box = (await page.locator('.ticket-stub').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 40; i += 1) {
    await page.mouse.move(x + i * 3, y + i * 3);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await expect.poll(async () => (await mail()).length).toBe(2);
  expect((await mail())[1]).toBe(viaButton);
  await page.waitForTimeout(1500);
  expect(await mail()).toHaveLength(2);
  await expect(page.locator('.ticket-body [role="status"]')).toHaveText('Sent to your mail app');
});

test('/contact: the stub also sends from the keyboard', async ({ page }) => {
  const mail = await catchMail(page);
  await open(page, '/contact');
  await write(page);
  await page.locator('.letter-ticket [role="button"]').focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await mail()).length).toBe(1);
});

/** The letter's scale and the ball's opacity at a given point of the intro, sampled by pausing every animation there. */
const sampleIntro = (page: Page, at: number) =>
  page.evaluate((time) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
    const letter = getComputedStyle(document.querySelector('form.letter')!);
    const ball = document.querySelector('.letter-ball')!.getBoundingClientRect();
    return { scale: new DOMMatrix(letter.transform).a, ball: Number(getComputedStyle(document.querySelector('.letter-ball')!).opacity), ballWidth: ball.width };
  }, at);

test('/contact: the letter starts as a crumpled paper ball and unfolds open, with no WebGL on load', async ({ page }) => {
  const webgl: string[] = [];
  page.on('request', (request) => /PaperCrumple|three/i.test(new URL(request.url()).pathname) && webgl.push(request.url()));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  const ball = page.locator('.letter-ball');
  await expect(ball).toBeVisible();
  await expect(ball).toHaveJSProperty('complete', true);
  expect(await ball.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const start = await sampleIntro(page, 100);
  expect(start.ball, 'the ball is showing').toBe(1);
  expect(start.ballWidth, 'the ball is a ball, not the sheet').toBeLessThan(200);
  expect(start.scale, 'the letter is folded away under it').toBeLessThan(0.15);
  const unfolding = await sampleIntro(page, 1000);
  expect(unfolding.scale, 'the letter is part way open').toBeGreaterThan(0.2);
  expect(unfolding.scale).toBeLessThan(1);
  const end = await sampleIntro(page, 1500);
  expect(end.scale).toBe(1);
  expect(end.ball).toBe(0);
  expect(webgl, 'the crumple scene is not fetched on load').toEqual([]);
});

test('/contact: after about two seconds the letter is open and usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const letter = page.locator('form.letter');
  expect(await letter.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).isIdentity), 'the letter is full size').toBe(true);
  expect(await page.locator('.letter-ball').evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
  await expect(letter).not.toHaveAttribute('data-hidden', '');
  await expect(letter.getByRole('textbox', { name: 'Your message' })).toBeVisible();
  await expect(page.locator('.letter-ticket')).toHaveCSS('opacity', '1');
});

test('/contact: under reduced motion the letter is open immediately, with no ball', async ({ browser }) => {
  const still = await browser.newContext({ reducedMotion: 'reduce' });
  const calm = await still.newPage();
  await calm.goto('/contact', { waitUntil: 'domcontentloaded' });
  await expect(calm.locator('.letter-ball')).toBeHidden();
  expect(await calm.locator('form.letter').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  expect(await calm.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(calm.getByRole('textbox', { name: 'Your message' })).toBeVisible();
  await open(calm, '/contact');
  await calm.getByRole('textbox', { name: 'Your message' }).fill('x');
  await calm.getByRole('button', { name: 'Start over' }).click();
  await expect(calm.getByRole('textbox', { name: 'Your message' })).toHaveValue('');
  await still.close();
});

test('/contact: Start over lives in the letter, crumples it and opens it blank', async ({ page }) => {
  const papers = await countPaper(page);
  await open(page, '/contact');
  const letter = page.locator('form.letter');
  await expect(page.locator('.letter-paper')).toHaveCount(0, { timeout: 10_000 });
  expect(await papers()).toBe(0);
  await expect(page.locator('.letter-note')).toHaveCount(0);
  await expect(page.getByText('Not quite right?')).toHaveCount(0);
  await write(page);
  const message = letter.getByRole('textbox', { name: 'Your message' });
  await expect(message).not.toHaveValue('');
  await letter.getByRole('button', { name: 'Start over' }).click();
  await expect.poll(papers).toBe(1);
  await expect(page.locator('.letter-paper')).toHaveCount(0, { timeout: 10_000 });
  await expect(message).toHaveValue('');
  await expect(letter.getByRole('button', { name: 'Send with your mail app' })).toBeDisabled();
  await expect(page.locator('.ticket-body [role="status"]')).toHaveText('Being written');
});
