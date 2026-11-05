import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { trackProblems } from '../../tests/e2e/helpers';
import { COVER_PORT } from '../../tests/e2e/ports';

// `pnpm social` (see playwright.config.ts): wait for the social card to paint, check it, and save
// public/social.jpg (1200×630, og:image) and public/apple-touch-icon.png (180×180).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(root, 'public/social.jpg');
const ICON = resolve(root, 'public/apple-touch-icon.png');

declare global {
  interface Window {
    /** Set by games/last-rune/cover/main.ts. */
    __cover?: { painted: boolean; error?: string };
  }
}

/** Width and height from a JPEG's first SOF marker. */
function jpegSize(buf: Buffer): { w: number; h: number } {
  expect(buf[0]).toBe(0xff);
  expect(buf[1]).toBe(0xd8);
  let i = 2;
  while (i < buf.length) {
    const m = buf[i + 1]!;
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function fromDataUrl(url: string): Buffer {
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

test('renders the social card at 1200×630 and the icon at 180×180', async ({ page }) => {
  const problems = trackProblems(page);
  await page.goto(`http://localhost:${COVER_PORT}/`);
  await page.waitForFunction(() => !!window.__cover?.painted || !!window.__cover?.error, null, {
    timeout: 60_000,
  });
  expect(await page.evaluate(() => window.__cover?.error)).toBeUndefined();

  // Real picture in it (not black, not one flat colour).
  const stats = await page.evaluate(() => {
    const c = document.getElementById('full') as HTMLCanvasElement;
    const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
    if (!d) return { lit: 0, spread: 0 };
    let lit = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4 * 7) {
      const l = (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
      if (l > 12) lit++;
      if (l < min) min = l;
      if (l > max) max = l;
    }
    return { lit: lit / (d.length / 28), spread: max - min };
  });
  expect(stats.lit).toBeGreaterThan(0.2);
  expect(stats.spread).toBeGreaterThan(100);

  const { full, icon } = await page.evaluate(() => ({
    full: (document.getElementById('full') as HTMLCanvasElement).toDataURL('image/jpeg', 0.9),
    icon: (document.getElementById('icon') as HTMLCanvasElement).toDataURL('image/png'),
  }));
  const fullPng = fromDataUrl(full);
  const iconPng = fromDataUrl(icon);
  expect(jpegSize(fullPng)).toEqual({ w: 1200, h: 630 });
  expect(pngSize(iconPng)).toEqual({ w: 180, h: 180 });
  expect(problems).toEqual([]);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, fullPng);
  writeFileSync(ICON, iconPng);
  console.log(`Wrote ${OUT}\nWrote ${ICON}`);
});
