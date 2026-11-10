/**
 * The e2e `test` (harden-tests, engine-1-3): Playwright's, plus an automatic guard that fails a
 * test when any page in its context ends it with a layout overflow (a widget larger than its
 * region). It asks the engine's `layout.overflows()` through the game's `window.__lrOverflows`
 * handle (main.ts, in every build), because the engine's `[layout] …` console warning is dev-only
 * and the production preview is silent. Dev pages still warn, so a `[layout]` warning seen
 * mid-test fails it too. Specs import `test` and `expect` from this file instead of
 * '@playwright/test'.
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
      for (const page of context.pages()) {
        if (page.isClosed()) continue;
        const width = page.viewportSize()?.width ?? '?';
        const over = await page
          .evaluate(() => {
            const fn = (window as unknown as { __lrOverflows?: () => unknown[] }).__lrOverflows;
            return fn ? JSON.parse(JSON.stringify(fn())) : [];
          })
          .catch(() => [] as unknown[]);
        for (const o of over as {
          id: string;
          region: string;
          w: number;
          h: number;
          rw: number;
          rh: number;
        }[]) {
          seen.push(
            `${width}px: ${o.id} (${Math.round(o.w)}×${Math.round(o.h)}) overflows ${o.region} (${Math.round(o.rw)}×${Math.round(o.rh)})`,
          );
        }
      }
      if (seen.length) throw new Error(`[layout] overflows:\n${[...new Set(seen)].join('\n')}`);
    },
    { auto: true },
  ],
});
