import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const bddDir = defineBddConfig({ features: 'tests/features/*.feature', steps: 'tests/features/steps.ts' });

export default defineConfig({
  fullyParallel: true,
  // The perf project measures real frame times on the same machine.
  // Keep browser runs sequential so concurrent test browsers cannot distort it.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'reports/e2e', open: 'never' }], ['json', { outputFile: 'reports/e2e/results.json' }]],
  // BASE_URL runs the same suite against a deployment (preview or production) instead of a local build.
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:4321', trace: 'retain-on-failure' },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run preview -- --port 4321', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', testDir: 'tests/e2e', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', testDir: 'tests/e2e', use: { ...devices['Pixel 7'] } },
    { name: 'safari', testDir: 'tests/e2e', use: { ...devices['iPhone 15'] } },
    // Desktop Safari (mouse, wide): the E3 hero and the enter screen.
    { name: 'webkit-desktop', testDir: 'tests/e2e', testMatch: /(enter-screen|hero-zoom|a11y|polish)\.spec\.ts/, use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'perf', testDir: 'tests/perf', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'journeys', testDir: bddDir, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
