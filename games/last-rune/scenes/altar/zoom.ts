/**
 * Phones, dense boards (mobile-6-zoom): the zoomed view. Pure (no DOM, no GPU), unit-tested.
 *
 * At the fitted view a phone shows the whole altar; when that makes a socket smaller than
 * `ZOOM_BELOW_CSS` CSS px, a tap on the board zooms in around the tap so sockets are
 * `ZOOM_PITCH_CSS` across, and a drag pans. One camera maps the fitted layout ("world", design
 * px) to the screen: `screen = o + z · world` on each axis. The renderer's camera, the DOM
 * labels and touch aiming all read it (`transformLayout` gives the screen layout).
 *
 * The board scrolls inside its viewport: the canvas left of the right-hand column, within the
 * visible band. Panning stops once the board's block (slab and gauges) reaches the viewport's
 * edge, so the board never slides away from view.
 */
import type { AltarLayout, PropSpot } from './layout';

/** Zoom applies on phones when the fitted socket pitch is under this, CSS px: the brief's 40
 * px "dense" line, raised to the 44 px touch target so every placement happens at ≥ 44 px. */
export const ZOOM_BELOW_CSS = 44;
/** Socket pitch when zoomed in, CSS px (above the 44 px touch target). */
export const ZOOM_PITCH_CSS = 52;
/** Zoom in or out, seconds (instant with reduced motion). */
export const ZOOM_SECS = 0.22;
/** A press that moves this far, CSS px, is a pan, not a tap. */
export const PAN_CSS = 10;

/** A rectangle, design px. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The camera: `screen = o + z · world`. */
export interface Cam {
  z: number;
  ox: number;
  oy: number;
}

export const FIT: Readonly<Cam> = { z: 1, ox: 0, oy: 0 };

/** Fitted socket pitch in CSS px (phones), or Infinity off phones. */
export function fitPitchCss(L: AltarLayout): number {
  return L.phone ? L.pitch / L.phone.cssPx : Number.POSITIVE_INFINITY;
}

/** Whether this layout gets the zoomed view: a phone whose sockets are under ZOOM_BELOW_CSS. */
export function needsZoom(L: AltarLayout): boolean {
  return fitPitchCss(L) < ZOOM_BELOW_CSS;
}

/** The zoom factor that makes sockets `ZOOM_PITCH_CSS` across (1 when no zoom is needed). */
export function zoomLevel(L: AltarLayout): number {
  if (!needsZoom(L) || !L.phone) return 1;
  return (ZOOM_PITCH_CSS * L.phone.cssPx) / L.pitch;
}

/** Where the board shows on screen: left of the column, within the visible band. */
export function viewRect(L: AltarLayout): Rect {
  const b = L.phone;
  if (!b) return { x0: 0, y0: 0, x1: 1920, y1: 1080 };
  return { x0: b.padL, y0: b.visT, x1: b.colL, y1: b.visB };
}

function propBox(sp: PropSpot, r: Rect): void {
  const h = sp.size / 2;
  r.x0 = Math.min(r.x0, sp.x - h);
  r.x1 = Math.max(r.x1, sp.x + h);
  r.y0 = Math.min(r.y0, sp.y - h);
  r.y1 = Math.max(r.y1, sp.y + h);
}

/** The board's block in world px: the slab, its front face and every gauge. */
export function blockRect(L: AltarLayout): Rect {
  const r = { x0: L.left, y0: L.top, x1: L.right, y1: L.frontBottom };
  propBox(L.storm, r);
  for (const m of L.machines) propBox(m, r);
  return r;
}

/** One axis of `clamp`: the block's span [b0, b1] scaled by z against the view's [v0, v1]. */
function clampAxis(o: number, z: number, b0: number, b1: number, v0: number, v1: number): number {
  const lo = v1 - z * b1;
  const hi = v0 - z * b0;
  // Smaller than the view on this axis: centred in it.
  if (lo >= hi) return (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, o));
}

/** Keep a zoomed camera's board block covering the view (or centred where it is smaller). */
export function clampCam(L: AltarLayout, c: Cam): Cam {
  if (c.z <= 1) return { ...FIT };
  const v = viewRect(L);
  const b = blockRect(L);
  return {
    z: c.z,
    ox: clampAxis(c.ox, c.z, b.x0, b.x1, v.x0, v.x1),
    oy: clampAxis(c.oy, c.z, b.y0, b.y1, v.y0, v.y1),
  };
}

/** The zoomed camera around a screen point at the fitted view: that point stays put. */
export function zoomAt(L: AltarLayout, x: number, y: number): Cam {
  const z = zoomLevel(L);
  return clampCam(L, { z, ox: x - z * x, oy: y - z * y });
}

/** The camera moved by a finger's drag (dx, dy screen px). */
export function panBy(L: AltarLayout, c: Cam, dx: number, dy: number): Cam {
  return clampCam(L, { z: c.z, ox: c.ox + dx, oy: c.oy + dy });
}

export function toScreen(c: Cam, x: number, y: number, out: { x: number; y: number }): void {
  out.x = c.ox + c.z * x;
  out.y = c.oy + c.z * y;
}

export function toWorld(c: Cam, x: number, y: number, out: { x: number; y: number }): void {
  out.x = (x - c.ox) / c.z;
  out.y = (y - c.oy) / c.z;
}

export function sameCam(a: Cam, b: Cam): boolean {
  return a.z === b.z && a.ox === b.ox && a.oy === b.oy;
}

function spot(c: Cam, s: PropSpot): PropSpot {
  return {
    ...s,
    x: c.ox + c.z * s.x,
    y: c.oy + c.z * s.y,
    size: s.size * c.z,
    port: { x: c.ox + c.z * s.port.x, y: c.oy + c.z * s.port.y },
    label: {
      ...s.label,
      x: c.ox + c.z * s.label.x,
      y: c.oy + c.z * s.label.y,
      ...(s.label.alt !== undefined ? { alt: c.ox + c.z * s.label.alt } : {}),
    },
  };
}

/**
 * The layout as it shows on screen under the camera: the board, slab and gauges moved and
 * scaled; the column (tray, title, lane, FUSE) stays where it is. At FIT it is `fit` itself.
 */
export function transformLayout(fit: AltarLayout, c: Cam): AltarLayout {
  if (c.z === 1 && c.ox === 0 && c.oy === 0) return fit;
  const X = (x: number) => c.ox + c.z * x;
  const Y = (y: number) => c.oy + c.z * y;
  return {
    ...fit,
    pitch: fit.pitch * c.z,
    margin: fit.margin * c.z,
    gemSize: fit.gemSize * c.z,
    cx: X(fit.cx),
    cy: Y(fit.cy),
    left: X(fit.left),
    right: X(fit.right),
    top: Y(fit.top),
    bottom: Y(fit.bottom),
    frontBottom: Y(fit.frontBottom),
    storm: spot(c, fit.storm),
    machines: fit.machines.map((m) => spot(c, m)),
  };
}

/** Which way the board runs on past the view: north, east, south, west. */
export function offEdges(L: AltarLayout, c: Cam): [boolean, boolean, boolean, boolean] {
  if (c.z <= 1) return [false, false, false, false];
  const v = viewRect(L);
  const b = blockRect(L);
  const e = 1;
  return [
    c.oy + c.z * b.y0 < v.y0 - e,
    c.ox + c.z * b.x1 > v.x1 + e,
    c.oy + c.z * b.y1 > v.y1 + e,
    c.ox + c.z * b.x0 < v.x0 - e,
  ];
}

function ease(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/**
 * The live camera: eases between views over `ZOOM_SECS` (instant with reduced motion).
 * Linear in z and o together, so the point a zoom is centred on stays under the finger.
 */
export class ZoomCamera {
  cur: Cam = { ...FIT };
  private from: Cam = { ...FIT };
  private to: Cam = { ...FIT };
  private t = 1;

  /** The view it is going to (or at). */
  get target(): Readonly<Cam> {
    return this.to;
  }

  get moving(): boolean {
    return this.t < 1;
  }

  /** Zoomed in (or on the way in). */
  get zoomed(): boolean {
    return this.to.z > 1;
  }

  go(c: Cam, instant: boolean): void {
    this.from = { ...this.cur };
    this.to = { ...c };
    this.t = instant || sameCam(this.from, this.to) ? 1 : 0;
    if (this.t >= 1) this.cur = { ...c };
  }

  /** Jump (a pan follows the finger exactly). */
  set(c: Cam): void {
    this.go(c, true);
  }

  /** Advance; true while the view changed this step. */
  update(dt: number): boolean {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / ZOOM_SECS);
    const k = ease(this.t);
    const a = this.from;
    const b = this.to;
    this.cur =
      this.t >= 1
        ? { ...b }
        : { z: a.z + (b.z - a.z) * k, ox: a.ox + (b.ox - a.ox) * k, oy: a.oy + (b.oy - a.oy) * k };
    return true;
  }
}

/** The renderer camera (zoom about the view's centre) that draws world px through `c`. */
export function rendererCam(
  c: Cam,
  w: number,
  h: number,
  out: { x: number; y: number; zoom: number },
): void {
  out.zoom = c.z;
  out.x = (w / 2 - c.ox) / c.z - w / 2;
  out.y = (h / 2 - c.oy) / c.z - h / 2;
}
