#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
// `pnpm desktop:build`: The Last Rune as a desktop app (D-042, D-052). Packages the built web
// game (dist/, from `pnpm build`) in the ThunderClap Electron shell (the npm package
// @thunderclap-engine/host-electron) with the game's identity and its procedural icon, into
// dist/desktop/. Unsigned.
//
//   pnpm build && pnpm desktop:build [--mac | --win | --linux] [--dir]
//
// The npm host ships only the shell's built main process and preload (out/main.mjs,
// out/preload.cjs), no packaging script or electron-builder config. So this stages the app
// folder itself (build/desktop/app/: out/main.mjs, out/preload.cjs, out/renderer/ = dist/, and a
// package.json) and runs electron-builder with a config that mirrors the shell's upstream one:
// unsigned (CSC_IDENTITY_AUTO_DISCOVERY forced off, macOS ad-hoc "-"), asar, no node_modules.
// Run it after `pnpm build`: Vite empties dist/, desktop builds included.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, Platform } from 'electron-builder';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'package.json'));
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
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const electronVersion = JSON.parse(
  readFileSync(require.resolve('electron/package.json'), 'utf8'),
).version;

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);

// 1. The procedural icon (scripts/desktop/icon.mjs).
const icon = join(root, 'build/desktop/icon.png');
const r = spawnSync(process.execPath, [join(root, 'scripts/desktop/icon.mjs'), icon], {
  stdio: 'inherit',
});
if (r.status !== 0) process.exit(r.status ?? 1);

// 2. The app folder: the shell's out/ from the npm package, the game as out/renderer.
const shellOut = join(
  dirname(require.resolve('@thunderclap-engine/host-electron/package.json')),
  'out',
);
const app = join(root, 'build/desktop/app');
const output = join(dist, 'desktop');
rmSync(app, { recursive: true, force: true });
mkdirSync(join(app, 'out'), { recursive: true });
for (const f of ['main.mjs', 'preload.cjs']) cpSync(join(shellOut, f), join(app, 'out', f));
cpSync(dist, join(app, 'out/renderer'), {
  recursive: true,
  // dist/ may hold earlier desktop builds (dist/desktop/): never package those.
  filter: (src) => {
    const p = resolve(src);
    return p !== output && !p.startsWith(`${output}${sep}`);
  },
});
writeFileSync(
  join(app, 'package.json'),
  `${JSON.stringify(
    {
      name: 'the-last-rune',
      productName: DESKTOP_IDENTITY.productName,
      version,
      description: 'The Last Rune',
      license: 'MIT',
      author: 'ThunderClap',
      type: 'module',
      main: 'out/main.mjs',
    },
    null,
    2,
  )}\n`,
);

// 3. electron-builder, configured like the shell's upstream electron-builder.config.mjs.
const { productName, appId } = DESKTOP_IDENTITY;
const fileStem = productName.replace(/\s+/g, '-');
/** @type {import('electron-builder').Configuration} */
const config = {
  appId,
  productName,
  electronVersion,
  // Electron names the app (and its userData folder, where localStorage lives) from this.
  extraMetadata: { productName, version },
  icon,
  copyright: 'MIT License',
  directories: { output },
  files: ['out/**/*', 'package.json'],
  asar: true,
  npmRebuild: false,
  nodeGypRebuild: false,
  publish: null,
  // The escaped \${…} are electron-builder's own macros, filled in at packaging time.
  artifactName: `${fileStem}-\${version}-\${os}-\${arch}.\${ext}`,
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.games',
    identity: '-',
    hardenedRuntime: false,
    gatekeeperAssess: false,
  },
  dmg: { writeUpdateInfo: false },
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'zip', arch: ['x64'] },
    ],
    signAndEditExecutable: true,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    differentialPackage: false,
  },
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'tar.gz', arch: ['x64'] },
    ],
    category: 'Game',
    executableName: 'the-last-rune',
  },
};

// Never sign with a certificate: a developer certificate in the local keychain is not picked up.
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

const platforms = [
  flag('--mac') && Platform.MAC,
  flag('--win') && Platform.WINDOWS,
  flag('--linux') && Platform.LINUX,
].filter(Boolean);
if (!platforms.length) platforms.push(Platform.current());
const targets = new Map();
for (const p of platforms) {
  for (const [k, v] of p.createTarget(flag('--dir') ? 'dir' : undefined)) targets.set(k, v);
}

const files = await build({ projectDir: app, config, targets, publish: 'never' });
const out = files.filter((f) => !f.endsWith('.blockmap'));
console.log(`desktop:build: ${out.length} artefact(s)\n  ${out.join('\n  ')}`);
