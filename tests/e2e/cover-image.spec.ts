import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PREVIEW_URL, trackProblems } from './helpers';

// The itch cover candidates page (D-043, ws/cover-art), built into dist/cover-image/ and served
// by GitHub Pages at /cover-image/. Smoke only: it loads, all eight covers render, and Download
// saves a 630×500 PNG.

const URL = `${PREVIEW_URL}/cover-image/`;

declare global {
  interface Window {
    /** Set by games/last-rune/cover/main.ts. */
    __covers?: { total: number; painted: number; error?: string };
  }
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test('cover page renders eight covers and downloads 630×500 PNGs', async ({ page }) => {
  test.setTimeout(90_000);
  const problems = trackProblems(page);
  await page.goto(URL);
  await page.waitForFunction(
    () => {
      const s = window.__covers;
      return !!s && (!!s.error || s.painted === s.total);
    },
    null,
    { timeout: 60_000 },
  );
  const state = await page.evaluate(() => window.__covers);
  expect(state?.error).toBeUndefined();
  expect(state?.total).toBe(8);

  const covers = page.locator('section.cover');
  await expect(covers).toHaveCount(8);

  // Every cover canvas is 630×500 and has real picture in it (not black, not one flat colour).
  const stats = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>('canvas.full')].map((c) => {
      const g = c.getContext('2d');
      if (!g) return { w: c.width, h: c.height, lit: 0, spread: 0 };
      const d = g.getImageData(0, 0, c.width, c.height).data;
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
    }),
  );
  expect(stats).toHaveLength(8);
  for (const s of stats) {
    expect(s.w).toBe(630);
    expect(s.h).toBe(500);
    expect(s.lit).toBeGreaterThan(0.2);
    expect(s.spread).toBeGreaterThan(100);
  }

  // Download: the first and last cover each save a 630×500 PNG.
  for (const i of [0, 7]) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      covers.nth(i).getByRole('button', { name: 'Download PNG' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^last-rune-cover-\d-[a-z-]+\.png$/);
    const path = await download.path();
    const size = pngSize(readFileSync(path));
    expect(size).toEqual({ w: 630, h: 500 });
  }

  expect(problems).toEqual([]);
});
