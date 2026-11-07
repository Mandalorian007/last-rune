import { defineConfig } from '@playwright/test';

// The Last Rune in the Electron shell (tests/desktop/last-rune.spec.ts). Each test launches its
// own app through Playwright's Electron driver, so one worker. Run with `pnpm test:e2e:desktop`
// (scripts/desktop/e2e.mjs builds dist/ first; the shell is the prebuilt npm package).
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
});
