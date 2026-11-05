import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// D-050: the page carries share tags, and the image they point at ships in public/ at the size
// they claim (1200×630). Regenerate the images with `pnpm social`.
const root = resolve(__dirname, '../..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const SITE = 'https://mandalorian007.github.io/last-rune/';

function meta(attr: 'property' | 'name', key: string): string | undefined {
  const re = new RegExp(`<meta\\s+${attr}="${key.replace(/[:.]/g, '\\$&')}"\\s+content="([^"]*)"`);
  return re.exec(html)?.[1];
}

function jpegSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  expect([b[0], b[1]]).toEqual([0xff, 0xd8]);
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1]!;
    if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error('no SOF marker');
}

function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('social embed (D-050)', () => {
  it('has Open Graph and Twitter tags with an absolute image URL', () => {
    for (const k of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt'])
      expect(meta('property', k), k).toBeTruthy();
    for (const k of ['description', 'theme-color', 'twitter:card', 'twitter:image'])
      expect(meta('name', k), k).toBeTruthy();
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(meta('property', 'og:url')).toBe(SITE);
    expect(meta('property', 'og:image')).toBe(`${SITE}social.jpg`);
    expect(meta('name', 'twitter:image')).toBe(`${SITE}social.jpg`);
  });

  it('ships the share image and home-screen icon at the sizes the tags claim', () => {
    expect(jpegSize(resolve(root, 'public/social.jpg'))).toEqual({
      w: Number(meta('property', 'og:image:width')),
      h: Number(meta('property', 'og:image:height')),
    });
    expect(pngSize(resolve(root, 'public/apple-touch-icon.png'))).toEqual({ w: 180, h: 180 });
  });
});
