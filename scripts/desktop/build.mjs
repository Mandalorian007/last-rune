#!/usr/bin/env node
// `pnpm desktop:build`: The Last Rune as a desktop app (D-042). Packages the built web game
// (dist/, from `pnpm build`) in the ThunderClap Electron shell (packages/host-electron) with the
// game's identity and its procedural icon, into dist/desktop/. Unsigned.
//
//   pnpm build && pnpm desktop:build [--mac | --win | --linux] [--dir]
//
// The flags pass through to packages/host-electron/scripts/dist.mjs. Run it after `pnpm build`:
// Vite empties dist/, desktop builds included.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('desktop:build: no dist/index.html; run `pnpm build` first');
  process.exit(1);
}

/** The identity a release keeps forever: the product name names the save folder (userData). */
const DESKTOP_IDENTITY = {
  productName: 'The Last Rune',
  appId: 'com.thunderclap.lastrune',
};

const icon = join(root, 'build/desktop/icon.png');
const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run([join(root, 'scripts/desktop/icon.mjs'), icon]);
run(
  [
    join(root, 'packages/host-electron/scripts/dist.mjs'),
    '--renderer',
    dist,
    ...process.argv.slice(2),
  ],
  {
    TC_PRODUCT_NAME: DESKTOP_IDENTITY.productName,
    TC_APP_ID: DESKTOP_IDENTITY.appId,
    TC_APP_VERSION: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
    TC_ICON: icon,
  },
);
