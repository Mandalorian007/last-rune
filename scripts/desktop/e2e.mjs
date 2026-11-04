#!/usr/bin/env node
// The Last Rune's desktop e2e (tests/desktop/): builds the web game (dist/; E2E_SKIP_BUILD=1
// reuses an existing one) and the shell's main process and preload (packages/host-electron/out/),
// then runs the Electron-driver specs. `pnpm test:e2e:desktop` runs the shell's own smoke first.
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
run(process.execPath, [join(root, 'packages/host-electron/scripts/build.mjs'), '--no-renderer']);
run('pnpm', [
  'exec',
  'playwright',
  'test',
  '-c',
  'tests/desktop/playwright.config.ts',
  ...process.argv.slice(2),
]);
