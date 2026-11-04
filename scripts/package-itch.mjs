#!/usr/bin/env node
// Build the game and zip dist/ for an itch.io HTML5 upload.
//
//   pnpm package:itch                  # pnpm build, validate, zip
//   pnpm package:itch --skip-build     # validate + zip the existing dist/
//   pnpm package:itch --allow-sourcemaps
//
// Output: build/last-rune-itch-<version>.zip with index.html at the zip root.
// Nothing is uploaded; see docs/shipping-itch.md for the upload steps.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBytes, validateBuild, ZIP_BUDGET_BYTES } from './lib/itch-validate.mjs';
import { createZip } from './lib/zip.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const distDir = join(root, 'dist');
const outDir = join(root, 'build');

for (const a of args) {
  if (!['--skip-build', '--allow-sourcemaps'].includes(a)) {
    console.error(`package-itch: unknown option ${a}`);
    process.exit(2);
  }
}

if (!args.has('--skip-build')) {
  console.log('package-itch: running pnpm build…');
  const r = spawnSync('pnpm', ['build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    // dist/desktop/ holds the Electron builds (`pnpm desktop:build`) and dist/cover-image/ the
    // itch cover candidates page (Pages only); neither belongs in the web upload.
    if (e.isDirectory() && dir === distDir && (e.name === 'desktop' || e.name === 'cover-image'))
      continue;
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

let absFiles;
try {
  absFiles = walk(distDir);
} catch {
  console.error('package-itch: dist/ not found. Run without --skip-build.');
  process.exit(1);
}

const TEXT = /\.(html?|css|m?js|json|svg|wgsl|txt)$/i;
const files = absFiles
  .map((abs) => {
    const path = relative(distDir, abs).split(sep).join('/');
    const data = readFileSync(abs);
    return { path, abs, data, size: statSync(abs).size };
  })
  // Never ship OS junk even if it lands in dist/.
  .filter((f) => !/(^|\/)(\.DS_Store|Thumbs\.db)$/.test(f.path));

const { errors, warnings } = validateBuild(
  files.map((f) => ({
    path: f.path,
    size: f.size,
    text: TEXT.test(f.path) ? f.data.toString('utf8') : undefined,
  })),
  { allowSourceMaps: args.has('--allow-sourcemaps') },
);

for (const w of warnings) console.warn(`  warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`  error: ${e}`);
  console.error(`package-itch: ${errors.length} problem(s); not writing a zip.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const zip = createZip(files.map((f) => ({ path: f.path, data: f.data })));
mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, `last-rune-itch-${pkg.version}.zip`);
writeFileSync(zipPath, zip);

const total = files.reduce((n, f) => n + f.size, 0);
console.log(
  `package-itch: ${relative(root, zipPath)}  ${files.length} files, ` +
    `${formatBytes(total)} unpacked, ${formatBytes(zip.length)} zipped`,
);
if (zip.length > ZIP_BUDGET_BYTES) {
  console.warn(
    `  warn: zip is over the ${formatBytes(ZIP_BUDGET_BYTES)} download budget (docs/engineering.md).`,
  );
}
