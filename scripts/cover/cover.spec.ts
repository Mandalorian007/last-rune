import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { trackProblems } from '../../tests/e2e/helpers';
import { COVER_PORT } from '../../tests/e2e/ports';

// `pnpm cover` (see playwright.config.ts): wait for the itch cover to paint, check it, and save
// build/last-rune-itch-cover.png (630×500) and build/last-rune-itch-cover-thumb.png (315×250).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(root, 'build/last-rune-itch-cover.png');
const THUMB = resolve(root, 'build/last-rune-itch-cover-thumb.png');

declare global {
  interface Window {
    /** Set by games/last-rune/cover/main.ts. */
    __cover?: { painted: boolean; error?: string };
  }
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function fromDataUrl(url: string): Buffer {
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

test('renders the itch cover and saves it at 630×500 and 315×250', async ({ page }) => {
  const problems = trackProblems(page);
  await page.goto(`http://localhost:${COVER_PORT}/`);
  await page.waitForFunction(() => !!window.__cover?.painted || !!window.__cover?.error, null, {
    timeout: 60_000,
  });
  expect(await page.evaluate(() => window.__cover?.error)).toBeUndefined();

  // The cover is 630×500 and has real picture in it (not black, not one flat colour).
  const stats = await page.evaluate(() => {
    const c = document.getElementById('full') as HTMLCanvasElement;
    const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
    if (!d) return { w: c.width, h: c.height, lit: 0, spread: 0 };
    let lit = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4 * 7) {
      const l = (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
      if (l > 12) lit++;
      if (l < min) min = l;
      if (l > max) max = l;
    }
    return { w: c.width, h: c.height, lit: lit / (d.length / 28), spread: max - min };
  });
  expect(stats.w).toBe(630);
  expect(stats.h).toBe(500);
  expect(stats.lit).toBeGreaterThan(0.2);
  expect(stats.spread).toBeGreaterThan(100);

  // The page's own canvases are what we save: the full cover and its browse-size copy.
  const { full, thumb } = await page.evaluate(() => ({
    full: (document.getElementById('full') as HTMLCanvasElement).toDataURL('image/png'),
    thumb: (document.getElementById('thumb') as HTMLCanvasElement).toDataURL('image/png'),
  }));
  const fullPng = fromDataUrl(full);
  const thumbPng = fromDataUrl(thumb);
  expect(pngSize(fullPng)).toEqual({ w: 630, h: 500 });
  expect(pngSize(thumbPng)).toEqual({ w: 315, h: 250 });

  // Download PNG saves the same 630×500 cover.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNG' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('last-rune-itch-cover.png');
  expect(pngSize(readFileSync(await download.path()))).toEqual({ w: 630, h: 500 });

  expect(problems).toEqual([]);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, fullPng);
  writeFileSync(THUMB, thumbPng);
  console.log(`Wrote ${OUT}\nWrote ${THUMB}`);
});
