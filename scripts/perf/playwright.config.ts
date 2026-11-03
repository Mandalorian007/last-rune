import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';
import { DEV_URL, PREVIEW_PORT } from '../../tests/e2e/ports';

// Frame-time harness (not part of `pnpm test:e2e`). Dev server: the scenes are reached through
// the DEV-only `window.__game` handle. PERF_LOAD=1 runs the load harness instead, against
// `vite preview` of an existing dist/ (run `pnpm build` first). See scripts/perf/README.md.
const load = !!process.env.PERF_LOAD;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const servers = Array.isArray(base.webServer)
  ? base.webServer
  : base.webServer
    ? [base.webServer]
    : [];
const baseArgs = (base.projects?.[0]?.use?.launchOptions?.args ?? []) as string[];
// Vsync stays on (what a player sees on a 60 Hz screen); the harness times GPU work per
// frame separately. PERF_UNCAPPED=1 drops the frame-rate limit.
const uncapped = process.env.PERF_UNCAPPED
  ? ['--disable-gpu-vsync', '--disable-frame-rate-limit']
  : [];

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: load ? /load\.spec\.ts/ : /perf\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 900_000,
  outputDir: resolve(root, 'test-results/perf'),
  projects: [
    {
      name: 'perf',
      use: {
        ...base.projects?.[0]?.use,
        viewport: {
          width: Number(process.env.PERF_W ?? 1920),
          height: Number(process.env.PERF_H ?? 1080),
        },
        deviceScaleFactor: Number(process.env.PERF_DPR ?? 1),
        launchOptions: { args: [...baseArgs, ...uncapped] },
      },
    },
  ],
  webServer: load
    ? [
        {
          command: `pnpm exec vite preview --port ${PREVIEW_PORT} --strictPort`,
          url: `http://localhost:${PREVIEW_PORT}`,
          reuseExistingServer: false,
          timeout: 60_000,
          cwd: root,
        },
      ]
    : servers.filter((s) => s.url === DEV_URL).map((s) => ({ ...s, cwd: root })),
});
