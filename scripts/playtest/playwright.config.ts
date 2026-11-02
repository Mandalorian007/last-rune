import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

// Exploratory playtest captures (not part of `pnpm test:e2e`). Same browser flags and servers
// as the e2e suite; run from the repo root:
//   PLAYTEST_OUT=/tmp/pt-explore pnpm exec playwright test -c scripts/playtest/playwright.config.ts
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const servers = Array.isArray(base.webServer)
  ? base.webServer
  : base.webServer
    ? [base.webServer]
    : [];

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  outputDir: resolve(root, 'test-results/playtest'),
  // Servers run from the repo root, not from this folder.
  webServer: servers.map((s) => ({ ...s, cwd: root })),
});
