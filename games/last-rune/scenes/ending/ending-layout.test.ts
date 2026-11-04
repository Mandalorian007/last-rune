import { describe, expect, it } from 'vitest';
import { PHONE_CLIP, phoneClipRest, type VisibleBand } from './ending-scene';

// mobile-7-ending: on a phone the clipboard (rotated) always rests wholly inside the visible
// band, with a margin, and never moves out from its designed spot.

/** The design-px band a phone shows: cropped top/bottom (fill) and right (insets, if any). */
const band = (vw: number, vh: number, insetCss = 0): VisibleBand => {
  const k = vw / 1920; // css px per design px (the stage is fitted to the width)
  const perCss = 1 / k;
  const visibleH = vh * perCss;
  const crop = Math.max(0, (1080 - visibleH) / 2);
  return { l: insetCss * perCss, t: crop, r: 1920 - insetCss * perCss, b: 1080 - crop, perCss };
};

const extents = (c: { w: number; h: number; rot: number }) => {
  const s = Math.abs(Math.sin(c.rot));
  const co = Math.abs(Math.cos(c.rot));
  return { ex: (c.w / 2) * co + (c.h / 2) * s, ey: (c.w / 2) * s + (c.h / 2) * co };
};

describe('phoneClipRest', () => {
  const phones = [
    ['iphone', 750, 340, 0],
    ['se', 667, 320, 0],
    ['promax', 814, 380, 0],
    ['android', 915, 360, 0],
    ['inset', 915, 360, 40],
  ] as const;
  for (const [name, vw, vh, inset] of phones) {
    it(`keeps the whole board ≥24 CSS px inside on ${name}`, () => {
      const b = band(vw, vh, inset);
      const c = phoneClipRest(b);
      const { ex, ey } = extents(c);
      expect(c.x + ex).toBeLessThanOrEqual(b.r - 24 * b.perCss + 1e-6);
      expect(c.y + ey).toBeLessThanOrEqual(b.b - 24 * b.perCss + 1e-6);
      expect(c.x).toBeLessThanOrEqual(PHONE_CLIP.x);
      expect(c.y).toBeLessThanOrEqual(PHONE_CLIP.y);
      expect(c.w).toBe(PHONE_CLIP.w);
      expect(c.rot).toBe(PHONE_CLIP.rot);
    });
  }

  it('leaves the designed spot alone when there is room', () => {
    const c = phoneClipRest({ l: 0, t: 0, r: 1920, b: 1080, perCss: 1 }, 0);
    const { ex, ey } = extents(PHONE_CLIP);
    if (PHONE_CLIP.x + ex <= 1920 && PHONE_CLIP.y + ey <= 1080) {
      expect(c.x).toBe(PHONE_CLIP.x);
      expect(c.y).toBe(PHONE_CLIP.y);
    }
  });
});
