/**
 * The baseline matcher: an "equivalent" of `toHaveScreenshot` for 8-bit palette baselines.
 *
 * Update (`BASELINE_UPDATE=1`): the screenshot is quantized to ≤256 colours (png.ts) and written
 * to `docs/design/screens/v1.0/<project>/<name>.png`.
 *
 * Compare: the new screenshot is mapped onto the *baseline's* palette with the same
 * nearest-colour rule the update used, and the indices are compared. An unchanged render maps
 * to exactly the same indices, so an unchanged tree diffs at 0 pixels. A changed pixel counts
 * when it lands on a different palette entry, which any visible change does (a moved widget,
 * a different shader, a shifted tone across a gradient's band edges). Changes smaller than a
 * palette step inside a flat band are not seen; that is the price of an 8-bit set.
 *
 * The test fails when more than `MAX_DIFF_RATIO` of the pixels changed (README.md has the why).
 * On failure the raw screenshot and a diff image (changed pixels red over a dimmed baseline)
 * are attached and written under test-results/baseline/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { decodeIndexed, decodePng, encodeIndexed, mapToPalette, quantize } from './png';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE_DIR = resolve(root, 'docs/design/screens/v1.0');
const OUT_DIR = resolve(root, 'test-results/baseline');

/**
 * Pixels allowed to change before a shot fails, as a fraction of the frame. 0.0005 is about
 * 1,000 px at 1920×1080 and 460 px at 1280×720: well under one changed word of UI text
 * (a 16 px label is ~1,500 px of glyph edges) and far under any layout or shader change,
 * but above the handful of band-edge flips seen between runs under heavy GPU load.
 * `BASELINE_MAX_DIFF` overrides it (0 = exact).
 */
export const MAX_DIFF_RATIO = Number(process.env.BASELINE_MAX_DIFF ?? 0.0005);

export async function matchBaseline(png: Buffer, name: string) {
  const info = test.info();
  const file = resolve(BASELINE_DIR, info.project.name, `${name}.png`);
  const actual = decodePng(png);

  if (process.env.BASELINE_UPDATE) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, encodeIndexed(quantize(actual)));
    return;
  }

  if (!existsSync(file)) {
    throw new Error(`No baseline ${file}. Run BASELINE_UPDATE=1 pnpm baseline to create it.`);
  }
  const base = decodeIndexed(readFileSync(file));
  if (base.width !== actual.width || base.height !== actual.height) {
    throw new Error(
      `${name}: size ${actual.width}×${actual.height}, baseline ${base.width}×${base.height}`,
    );
  }
  const index = mapToPalette(actual, base.palette);
  let changed = 0;
  for (let i = 0; i < index.length; i++) if (index[i] !== base.index[i]) changed++;
  const ratio = changed / index.length;
  const line = `${info.project.name}/${name}: ${changed} px changed (${(ratio * 100).toFixed(4)}%)`;
  info.annotations.push({ type: 'baseline', description: line });
  console.log(`  ${line}`);

  if (ratio > MAX_DIFF_RATIO) {
    const out = resolve(OUT_DIR, info.project.name);
    mkdirSync(out, { recursive: true });
    // Diff: the baseline as dim grey (entries 0–254), changed pixels red (entry 255).
    const pal = new Uint8Array(256 * 3);
    for (let g = 0; g < 255; g++) pal.set([g, g, g], g * 3);
    pal.set([255, 0, 0], 255 * 3);
    const diff = new Uint8Array(base.index.length);
    for (let i = 0; i < diff.length; i++) {
      const p = base.index[i]! * 3;
      const lum =
        base.palette[p]! * 0.3 + base.palette[p + 1]! * 0.59 + base.palette[p + 2]! * 0.11;
      diff[i] = index[i] !== base.index[i] ? 255 : Math.round(lum * 0.35);
    }
    const diffPng = encodeIndexed({
      width: base.width,
      height: base.height,
      palette: pal,
      index: diff,
    });
    writeFileSync(resolve(out, `${name}-actual.png`), png);
    writeFileSync(resolve(out, `${name}-diff.png`), diffPng);
    await info.attach(`${name}-actual`, { body: png, contentType: 'image/png' });
    await info.attach(`${name}-diff`, { body: diffPng, contentType: 'image/png' });
  }
  expect
    .soft(ratio, `${line}; allowed ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`)
    .toBeLessThanOrEqual(MAX_DIFF_RATIO);
}
