// electron-builder config for the ThunderClap shell (D-041, Phase 4). Unsigned: no certificate,
// key or notarisation credential is used or read (code signing is an open question, README.md).
// macOS builds are ad-hoc signed ("-"), which needs no certificate and lets Apple silicon run
// the app after the quarantine prompt.
//
// The app identity is a noun-free default; a game sets its own through the environment when it
// packages its renderer (ws/last-rune-desktop): TC_APP_ID, TC_PRODUCT_NAME.
// Output: dist/desktop/ at the repo root. Run through scripts/dist.mjs (`pnpm desktop:build`).

const productName = process.env.TC_PRODUCT_NAME || 'ThunderClap';

/** @type {import('electron-builder').Configuration} */
export default {
  appId: process.env.TC_APP_ID || 'dev.thunderclap.shell',
  productName,
  // Electron names the app (and its userData folder, where localStorage lives) from this.
  extraMetadata: { productName },
  copyright: 'MIT License',
  directories: { output: '../../dist/desktop' },
  // Everything the app needs is bundled into out/ (main, preload, renderer); no node_modules.
  files: ['out/**/*', 'package.json'],
  asar: true,
  npmRebuild: false,
  nodeGypRebuild: false,
  publish: null,
  // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder's own macros, not JS.
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
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
    executableName: productName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  },
};
