import { describe, expect, it } from 'vitest';
import { puzzleFor } from '../../content/puzzles';
import { type AltarLayout, cellAt, cellCenter, computeLayout, snapCell } from './layout';
import {
  blockRect,
  clampCam,
  FIT,
  needsZoom,
  offEdges,
  panBy,
  rendererCam,
  toScreen,
  toWorld,
  transformLayout,
  viewRect,
  ZOOM_BELOW_CSS,
  ZOOM_PITCH_CSS,
  ZoomCamera,
  zoomAt,
  zoomLevel,
} from './zoom';

// An iPhone-like landscape frame (design px per CSS px ≈ 2.27, cropped top and bottom).
const PHONE = { padL: 0, padR: 0, cssPx: 1920 / 844, top: 155, bottom: 925 };
const dense = computeLayout(puzzleFor('the-last-rune'), PHONE);
const small = computeLayout(puzzleFor('intake-desk'), PHONE);

describe('needsZoom', () => {
  it('zooms a phone board whose sockets are under 44 CSS px, not a roomy one', () => {
    expect(dense.pitch / PHONE.cssPx).toBeLessThan(ZOOM_BELOW_CSS);
    expect(needsZoom(dense)).toBe(true);
    expect(small.pitch / PHONE.cssPx).toBeGreaterThanOrEqual(ZOOM_BELOW_CSS);
    expect(needsZoom(small)).toBe(false);
    expect(zoomLevel(small)).toBe(1);
  });
  it('never zooms off phones', () => {
    const desk = computeLayout(puzzleFor('the-last-rune'));
    expect(needsZoom(desk)).toBe(false);
    expect(zoomLevel(desk)).toBe(1);
  });
  it('zooms to ZOOM_PITCH_CSS (≥ 44 CSS px) sockets', () => {
    const z = zoomLevel(dense);
    expect((dense.pitch * z) / PHONE.cssPx).toBeCloseTo(ZOOM_PITCH_CSS, 5);
    expect(ZOOM_PITCH_CSS).toBeGreaterThanOrEqual(44);
  });
});

describe('the camera', () => {
  it('keeps the tapped point under the finger (unless it must clamp)', () => {
    const v = viewRect(dense);
    const x = (v.x0 + v.x1) / 2;
    const y = (v.y0 + v.y1) / 2;
    const c = zoomAt(dense, x, y);
    const s = { x: 0, y: 0 };
    toScreen(c, x, y, s);
    expect(s.x).toBeCloseTo(x, 5);
    expect(s.y).toBeCloseTo(y, 5);
  });
  it('maps world to screen and back', () => {
    const c = { z: 2, ox: -300, oy: -120 };
    const s = { x: 0, y: 0 };
    const w = { x: 0, y: 0 };
    toScreen(c, 400, 500, s);
    expect(s).toEqual({ x: 500, y: 880 });
    toWorld(c, s.x, s.y, w);
    expect(w).toEqual({ x: 400, y: 500 });
  });
  it('never pans the board away: the block keeps covering the view', () => {
    const v = viewRect(dense);
    const b = blockRect(dense);
    let c = zoomAt(dense, v.x0, v.y0);
    c = panBy(dense, c, 5000, 5000);
    expect(c.ox + c.z * b.x0).toBeLessThanOrEqual(v.x0 + 1e-6);
    c = panBy(dense, c, -9000, -9000);
    expect(c.ox + c.z * b.x1).toBeGreaterThanOrEqual(v.x1 - 1e-6);
    expect(c.oy + c.z * b.y1).toBeGreaterThanOrEqual(v.y1 - 1e-6);
  });
  it('clamps a fit camera to FIT', () => {
    expect(clampCam(dense, { z: 1, ox: 40, oy: 9 })).toEqual(FIT);
  });
  it('matches the renderer camera (zoom about the view centre)', () => {
    const c = { z: 1.8, ox: -500, oy: -200 };
    const r = { x: 0, y: 0, zoom: 1 };
    rendererCam(c, 1920, 1080, r);
    // Renderer: screen = W/2 + zoom · (x − W/2 − cam.x).
    const x = 700;
    expect(960 + r.zoom * (x - 960 - r.x)).toBeCloseTo(c.ox + c.z * x, 6);
    const y = 333;
    expect(540 + r.zoom * (y - 540 - r.y)).toBeCloseTo(c.oy + c.z * y, 6);
  });
  it('says which way the board runs on past the view', () => {
    expect(offEdges(dense, FIT)).toEqual([false, false, false, false]);
    const v = viewRect(dense);
    const c = zoomAt(dense, v.x0, v.y0);
    const [n, , s, w] = offEdges(dense, c);
    expect(n || w).toBe(false);
    expect(s).toBe(true);
  });
});

describe('transformLayout', () => {
  it('is the fit layout itself at FIT', () => {
    expect(transformLayout(dense, FIT)).toBe(dense);
  });
  it('puts every socket where the camera draws it, so taps hit what is shown', () => {
    const c = zoomAt(dense, 600, 500);
    const S: AltarLayout = transformLayout(dense, c);
    const w = { x: 0, y: 0 };
    const s = { x: 0, y: 0 };
    const want = { x: 0, y: 0 };
    for (let y = 0; y < dense.rows; y++)
      for (let x = 0; x < dense.cols; x++) {
        cellCenter(dense, { x, y }, w);
        cellCenter(S, { x, y }, s);
        toScreen(c, w.x, w.y, want);
        expect(s.x).toBeCloseTo(want.x, 6);
        expect(s.y).toBeCloseTo(want.y, 6);
        expect(cellAt(S, s.x, s.y)).toEqual({ x, y });
        expect(snapCell(S, s.x, s.y, () => true)).toEqual({ x, y });
      }
    const m = dense.machines[0]!;
    toScreen(c, m.port.x, m.port.y, want);
    expect(S.machines[0]!.port.x).toBeCloseTo(want.x, 6);
    expect(S.machines[0]!.port.y).toBeCloseTo(want.y, 6);
  });
  it('leaves the column (tray, title) where it is', () => {
    const S = transformLayout(dense, zoomAt(dense, 600, 500));
    expect(S.tray).toBe(dense.tray);
    expect(S.titleX).toBe(dense.titleX);
    expect(S.phone).toBe(dense.phone);
  });
});

describe('ZoomCamera', () => {
  it('eases to the target within ZOOM_SECS, and jumps with reduced motion', () => {
    const z = new ZoomCamera();
    const to = { z: 2, ox: -100, oy: -50 };
    z.go(to, false);
    expect(z.moving).toBe(true);
    z.update(0.1);
    expect(z.cur.z).toBeGreaterThan(1);
    expect(z.cur.z).toBeLessThan(2);
    for (let i = 0; i < 20; i++) z.update(1 / 60);
    expect(z.moving).toBe(false);
    expect(z.cur).toEqual(to);
    z.go(FIT, true);
    expect(z.moving).toBe(false);
    expect(z.cur).toEqual(FIT);
  });
  it('keeps the zoom point fixed through the animation', () => {
    const z = new ZoomCamera();
    const c = zoomAt(dense, 640, 520);
    z.go(c, false);
    // The world point under (640, 520) at fit is (640, 520) itself.
    const s = { x: 0, y: 0 };
    for (let i = 0; i < 5; i++) {
      z.update(0.03);
      toScreen(z.cur, 640, 520, s);
      // Unclamped zooms hold it exactly; a clamped one drifts toward the clamp.
      if (c.ox === 640 - c.z * 640) expect(s.x).toBeCloseTo(640, 6);
    }
  });
});
