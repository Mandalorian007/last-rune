import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';
import { DEV_URL } from '../../tests/e2e/ports';

// v1.0 regression baselines (D-041, Phase 0). Not part of `pnpm test:e2e`.
//
//   pnpm baseline                    # diff every scene against docs/design/screens/v1.0/
//   BASELINE_UPDATE=1 pnpm baseline  # regenerate the set (then commit it)
//   pnpm baseline --project=desktop-1080 -g altar
//
// Dev server only: scenes are reached through the DEV-only `window.__game` handle. Every
// shot boots a fresh page on a fake clock with a seeded Math.random and a seeded save (see
// stage.ts), so the same tree gives the same pixels. The compare (compare.ts) and its
// tolerance are explained in README.md.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const servers = Array.isArray(base.webServer)
  ? base.webServer
  : base.webServer
    ? [base.webServer]
    : [];
const args = (base.projects?.[0]?.use?.launchOptions?.args ?? []) as string[];

/** Shared by every project: 1× pixels (no retina doubling), WebGPU flags from the e2e config. */
const common = {
  deviceScaleFactor: 1,
  launchOptions: { args },
  // A stable clock time zone and locale (the end card prints play time and dates).
  locale: 'en-US',
  timezoneId: 'UTC',
  colorScheme: 'dark' as const,
};

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  outputDir: resolve(root, 'test-results/baseline'),
  // One GPU, one clock: shots run one page at a time so a busy GPU never races the capture.
  fullyParallel: false,
  workers: Number(process.env.BASELINE_WORKERS ?? 2),
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  expect: { timeout: 20_000 },
  use: {
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'desktop-720',
      use: { ...common, viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'desktop-1080',
      use: { ...common, viewport: { width: 1920, height: 1080 } },
    },
    {
      // The iPad the mobile playtests use (1180×820 landscape, touch), at 1× for size.
      name: 'ipad',
      use: {
        ...common,
        viewport: { width: 1180, height: 820 },
        screen: { width: 1180, height: 820 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // Only the dev server; no release label, so the title is the same on every machine.
  webServer: servers
    .filter((s) => s.url === DEV_URL)
    .map((s) => ({ ...s, cwd: root, env: { ...s.env, VITE_RELEASE_LABEL: '' } })),
});
