import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const bddDir = defineBddConfig({ features: 'tests/features/*.feature', steps: 'tests/features/steps.ts' });

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'reports/e2e', open: 'never' }], ['json', { outputFile: 'reports/e2e/results.json' }]],
  use: { baseURL: 'http://localhost:4321', trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --port 4321', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', testDir: 'tests/e2e', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', testDir: 'tests/e2e', use: { ...devices['Pixel 7'] } },
    { name: 'safari', testDir: 'tests/e2e', use: { ...devices['iPhone 15'] } },
    { name: 'perf', testDir: 'tests/perf', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'journeys', testDir: bddDir, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
