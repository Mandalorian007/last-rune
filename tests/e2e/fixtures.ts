/**
 * The e2e `test` (harden-tests): Playwright's, plus an automatic guard that fails a test when
 * any page in its context logs a `[layout] …` warning (a widget larger than its region, a
 * widget placed in a region its form lacks). The engine warns once per widget in dev and
 * preview alike, so a new overflow anywhere the suite goes fails here rather than scrolling by
 * in the log. Specs import `test` and `expect` from this file instead of '@playwright/test'.
 */
import { test as base } from '@playwright/test';

export * from '@playwright/test';

export const test = base.extend<{ layoutWarnings: string[] }>({
  layoutWarnings: [
    async ({ context }, use) => {
      const seen: string[] = [];
      context.on('console', (msg) => {
        if (msg.type() === 'warning' && msg.text().startsWith('[layout]')) {
          seen.push(`${msg.page()?.viewportSize()?.width ?? '?'}px: ${msg.text()}`);
        }
      });
      await use(seen);
      if (seen.length) throw new Error(`[layout] warnings:\n${[...new Set(seen)].join('\n')}`);
    },
    { auto: true },
  ],
});
