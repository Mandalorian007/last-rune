import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';
import { COVER_PORT } from '../../tests/e2e/ports';

// The social card (D-050). Not part of `pnpm test:e2e`.
//
//   pnpm social   # → public/social.jpg (1200×630) and public/apple-touch-icon.png (180×180)
//
// Builds games/last-rune/cover/ with vite.cover.config.ts into build/cover-image/, serves it on
// its own port and saves what the page paints (cover.spec.ts). WebGPU flags from the e2e config.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = (base.projects?.[0]?.use?.launchOptions?.args ?? []) as string[];

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  outputDir: resolve(root, 'test-results/cover'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  expect: { timeout: 20_000 },
  use: {
    trace: 'off',
    screenshot: 'off',
    deviceScaleFactor: 1,
    viewport: { width: 1280, height: 1000 },
    colorScheme: 'dark',
    launchOptions: { args },
  },
  projects: [{ name: 'cover' }],
  webServer: {
    command: `pnpm exec vite build -c vite.cover.config.ts && pnpm exec vite preview -c vite.cover.config.ts --port ${COVER_PORT} --strictPort`,
    cwd: root,
    url: `http://localhost:${COVER_PORT}/`,
    // Always a fresh build of this checkout's source, never a server some other run left up.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
