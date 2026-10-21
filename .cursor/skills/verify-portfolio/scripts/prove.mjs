#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:4322';
const evidence = new URL('../../../../reports/verification/portfolio/', import.meta.url);
await mkdir(evidence, { recursive: true });
const response = await fetch(origin);
assert.equal(response.status, 200);
const html = await response.text();
assert.match(html, /<title>Jerry Doughan/);
assert.match(html, /rel="canonical" href="https:\/\/jerrydoughan.com\/"/);
if (process.argv[2] === 'doctor') {
  await writeFile(new URL('doctor.json', evidence), JSON.stringify({ origin, status: response.status, canonical: 'https://jerrydoughan.com/', checkedAt: new Date().toISOString() }, null, 2));
  console.log('Doctor passed: owned preview serves the portfolio and expected canonical domain.');
} else if (process.argv[2] === 'drive') {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  try {
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('astro-island[component-url*="Work."][ssr]').waitFor({ state: 'detached' });
    assert.equal(requests.filter((url) => /\/(Desk\.|Lanyard\.|three\.module)/.test(url)).length, 0);
    await page.getByRole('button', { name: /^Scenaryo:/ }).click();
    const panel = page.locator('dialog[open] .sheet');
    await panel.hover({ position: { x: 150, y: 150 } });
    await page.mouse.wheel(0, 2000);
    await page.waitForFunction(() => document.querySelector('dialog[open]')?.hasAttribute('data-scrollsheet-at-max'));
    await page.mouse.wheel(0, 2000);
    const visit = panel.getByRole('link', { name: /Visit scenaryo\.app/ });
    await visit.waitFor({ state: 'visible' });
    const href = await visit.getAttribute('href');
    assert.equal(href, 'https://scenaryo.app/research');
    await page.waitForFunction(() => {
      const link = document.querySelector('dialog[open] .detail-visit');
      return !!link && link.getBoundingClientRect().bottom <= innerHeight - 24;
    });
    const box = await visit.boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= 820, 'CTA fits above the padded mobile drawer edge');
    await page.screenshot({ path: new URL('scenaryo-390.png', evidence).pathname });
    await writeFile(new URL('scenaryo-390.aria.yml', evidence), await page.locator('body').ariaSnapshot());
    await writeFile(new URL('drive.json', evidence), JSON.stringify({ feature: 'selected-work.research', action: 'Open Scenaryo, expand drawer and scroll to CTA', result: { href, bounds: box }, modelRequestsBeforeTap: 0, checkedAt: new Date().toISOString() }, null, 2));
    console.log('Drive passed: Scenaryo research CTA is visible with bottom space at 390px.');
  } catch (error) {
    await page.screenshot({ path: new URL('failure.png', evidence).pathname }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
} else {
  throw new Error('Use doctor or drive');
}
