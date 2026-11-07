#!/usr/bin/env node
// The Last Rune's desktop e2e (tests/desktop/): builds the web game (dist/; E2E_SKIP_BUILD=1
// reuses an existing one), then runs the Electron-driver specs on the npm shell
// (@thunderclap-engine/host-electron, prebuilt, so there is nothing else to build).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: root,
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!process.env.E2E_SKIP_BUILD || !existsSync(join(root, 'dist/index.html'))) {
  run('pnpm', ['build']);
}
run('pnpm', [
  'exec',
  'playwright',
  'test',
  '-c',
  'tests/desktop/playwright.config.ts',
  ...process.argv.slice(2),
]);
