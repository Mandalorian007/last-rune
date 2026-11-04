import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePng, renderIcon } from './icon.mjs';

describe('desktop icon', () => {
  const size = 64;
  const px: Buffer = renderIcon(size);
  const at = (x: number, y: number) => [...px.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];

  it('is clear outside the tile and opaque inside it', () => {
    expect(at(0, 0)[3]).toBe(0);
    expect(at(size - 1, size - 1)[3]).toBe(0);
    expect(at(size / 2, size / 2)[3]).toBe(255);
    expect(at(size / 2, Math.round(size * 0.15))[3]).toBe(255);
  });

  it('puts the cyan gem at the centre', () => {
    const [r, g, b] = at(size / 2 - 6, size / 2 + 6);
    expect(b).toBeGreaterThan(r!);
    expect(g).toBeGreaterThan(r!);
  });

  it('is the same every run (no randomness)', () => {
    expect(renderIcon(size).equals(px)).toBe(true);
  });

  it('encodes a valid 8-bit RGBA PNG', () => {
    const png: Buffer = encodePng(size, px);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
    const idatLen = png.readUInt32BE(33);
    expect(png.subarray(37, 41).toString('ascii')).toBe('IDAT');
    const raw = inflateSync(png.subarray(41, 41 + idatLen));
    expect(raw.length).toBe(size * (size * 4 + 1));
  });
});
