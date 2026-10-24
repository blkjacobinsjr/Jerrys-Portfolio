import { test as base } from '@playwright/test';

export * from '@playwright/test';

/** The enter screen is live once per tab session: specs see the page behind it unless they ask for it with ?enter=1. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!/[?&]enter=1/.test(location.search)) sessionStorage.setItem('jp-enter', 'quiet');
    });
    await use(page);
  },
});
