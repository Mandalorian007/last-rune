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
 *
 * Zoomed, the view keeps its context (mobile-7-zoom, D-040 addendum 5): a gutter `GUTTER_CSS`
 * wide round the view frames the cells, and holds the edge arrows and the chips of gauges out
 * of view, so neither ever sits on a cell. A camera at rest (`settleCam`) never half-crops the
 * source or a gauge: each is wholly in the cell area or wholly out of it (then shown as a chip).
 */
import type { AltarLayout, PropSpot } from './layout';

/** Zoom applies on phones when the fitted socket pitch is under this, CSS px: the brief's 40
 * px "dense" line, raised to the 44 px touch target so every placement happens at ≥ 44 px. */
export const ZOOM_BELOW_CSS = 44;
/** Socket pitch when zoomed in, CSS px (above the 44 px touch target). */
export const ZOOM_PITCH_CSS = 48;
/** The frame round the zoomed cells, CSS px: room for a 32 px edge arrow and a one-line chip. */
export const GUTTER_CSS = 34;
/** An edge arrow pans this share of the cell area. */
export const STEP_SHARE = 0.6;
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

/** Zoomed: the cells show here, inside the gutter (the whole view at the fitted one). */
export function cellRect(L: AltarLayout): Rect {
  const v = viewRect(L);
  if (!L.phone) return v;
  const g = GUTTER_CSS * L.phone.cssPx;
  return { x0: v.x0 + g, y0: v.y0 + g, x1: v.x1 - g, y1: v.y1 - g };
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

/** Keep a zoomed camera's board block covering the cell area (or centred where smaller). */
export function clampCam(L: AltarLayout, c: Cam): Cam {
  if (c.z <= 1) return { ...FIT };
  const v = cellRect(L);
  const b = blockRect(L);
  return {
    z: c.z,
    ox: clampAxis(c.ox, c.z, b.x0, b.x1, v.x0, v.x1),
    oy: clampAxis(c.oy, c.z, b.y0, b.y1, v.y0, v.y1),
  };
}

/**
 * The zoomed camera around a screen point at the fitted view: that point stays put (give or
 * take the settle that keeps the source and gauges whole).
 */
export function zoomAt(L: AltarLayout, x: number, y: number): Cam {
  const z = zoomLevel(L);
  return settleCam(L, { z, ox: x - z * x, oy: y - z * y });
}

/** The zoomed camera with the world point (x, y) in the middle of the cell area, settled. */
export function centreOn(L: AltarLayout, x: number, y: number): Cam {
  const z = zoomLevel(L);
  const r = cellRect(L);
  return settleCam(L, { z, ox: (r.x0 + r.x1) / 2 - z * x, oy: (r.y0 + r.y1) / 2 - z * y });
}

/** An edge arrow's step: `STEP_SHARE` of the cell area that way (0 n, 1 e, 2 s, 3 w), settled. */
export function stepCam(L: AltarLayout, c: Cam, side: 0 | 1 | 2 | 3): Cam {
  const r = cellRect(L);
  const dx = STEP_SHARE * (r.x1 - r.x0);
  const dy = STEP_SHARE * (r.y1 - r.y0);
  const [mx, my] = [
    [0, dy],
    [-dx, 0],
    [0, -dy],
    [dx, 0],
  ][side]!;
  const to = settleCam(L, { z: c.z, ox: c.ox + mx, oy: c.oy + my });
  // The settle may undo a short step: go on to the next resting spot that way.
  if (Math.abs(to.ox - c.ox) + Math.abs(to.oy - c.oy) > 1) return to;
  return settleCam(L, { z: c.z, ox: c.ox + 2 * mx, oy: c.oy + 2 * my });
}

/** The source's and each gauge's drawn box, world px (what must never show half-cropped). */
export function propRects(L: AltarLayout): Rect[] {
  const box = (sp: PropSpot, k: number): Rect => ({
    x0: sp.x - k * sp.size,
    x1: sp.x + k * sp.size,
    y0: sp.y - k * sp.size,
    y1: sp.y + k * sp.size,
  });
  return [box(L.storm, 0.3), ...L.machines.map((m) => box(m, 0.46))];
}

/** Whether a screen box is wholly inside `r` or wholly outside it (never cut by its edge). */
export function whole(b: Rect, r: Rect, eps = 0.5): boolean {
  const inside =
    b.x0 >= r.x0 - eps && b.x1 <= r.x1 + eps && b.y0 >= r.y0 - eps && b.y1 <= r.y1 + eps;
  const outside =
    b.x1 <= r.x0 + eps || b.x0 >= r.x1 - eps || b.y1 <= r.y0 + eps || b.y0 >= r.y1 - eps;
  return inside || outside;
}

/** Which props a camera cuts at the cell area's edge (indices into `propRects`). */
export function croppedProps(L: AltarLayout, c: Cam): number[] {
  if (c.z <= 1) return [];
  const r = cellRect(L);
  const out: number[] = [];
  propRects(L).forEach((p, i) => {
    const b = {
      x0: c.ox + c.z * p.x0,
      x1: c.ox + c.z * p.x1,
      y0: c.oy + c.z * p.y0,
      y1: c.oy + c.z * p.y1,
    };
    if (!whole(b, r)) out.push(i);
  });
  return out;
}

/**
 * A camera at rest: clamped, then moved the least it takes for the source and every gauge to
 * be wholly in the cell area or wholly out of it. (A finger pan follows the finger exactly; the
 * view settles once it lets go.)
 */
export function settleCam(L: AltarLayout, c0: Cam): Cam {
  const c = clampCam(L, c0);
  if (c.z <= 1) return c;
  const r = cellRect(L);
  const b = blockRect(L);
  const props = propRects(L);
  const z = c.z;
  const range = (b0: number, b1: number, v0: number, v1: number): [number, number] => {
    const lo = v1 - z * b1;
    const hi = v0 - z * b0;
    return lo >= hi ? [(lo + hi) / 2, (lo + hi) / 2] : [lo, hi];
  };
  const [xlo, xhi] = range(b.x0, b.x1, r.x0, r.x1);
  const [ylo, yhi] = range(b.y0, b.y1, r.y0, r.y1);
  const xs = new Set([c.ox, xlo, xhi]);
  const ys = new Set([c.oy, ylo, yhi]);
  for (const p of props) {
    for (const v of [r.x0 - z * p.x0, r.x1 - z * p.x1, r.x0 - z * p.x1, r.x1 - z * p.x0])
      if (v >= xlo - 1e-6 && v <= xhi + 1e-6) xs.add(v);
    for (const v of [r.y0 - z * p.y0, r.y1 - z * p.y1, r.y0 - z * p.y1, r.y1 - z * p.y0])
      if (v >= ylo - 1e-6 && v <= yhi + 1e-6) ys.add(v);
  }
  let best: Cam | null = null;
  let cost = Number.POSITIVE_INFINITY;
  for (const ox of xs)
    for (const oy of ys) {
      const d = (ox - c.ox) ** 2 + (oy - c.oy) ** 2;
      if (d >= cost) continue;
      const ok = props.every((p) =>
        whole({ x0: ox + z * p.x0, x1: ox + z * p.x1, y0: oy + z * p.y0, y1: oy + z * p.y1 }, r),
      );
      if (!ok) continue;
      best = { z, ox, oy };
      cost = d;
    }
  return best ?? c;
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
  const v = cellRect(L);
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

// ── Cards on the zoomed board (mobile-6-integrate) ──────────────────────────────────────────
// Zoomed, the Gives/Needs cards ride over a board that fills the view, so a card left where
// its gauge puts it (or pinned at the view's edge) sits on sockets. Each card instead takes
// the nearest spot clear of every socket's tap circle and every gauge.

/** A socket's tap circle, in pitches: the drawn hole (0.36), its rim and the legal ring. */
export const SOCKET_CLEAR = 0.42;

/** Whether a rectangle and a circle overlap. */
export function rectHitsCircle(r: Rect, x: number, y: number, rad: number): boolean {
  const dx = x - Math.max(r.x0, Math.min(x, r.x1));
  const dy = y - Math.max(r.y0, Math.min(y, r.y1));
  return dx * dx + dy * dy < rad * rad;
}

/**
 * A test for "this rectangle covers a socket's tap circle" on the screen layout `S`.
 * `open(x, y)` says which cells are sockets (carved stone is not). Looks only at the cells
 * the rectangle can reach, so it is cheap enough to call thousands of times a frame.
 */
export function socketHits(
  S: AltarLayout,
  open: (x: number, y: number) => boolean,
): (r: Rect) => boolean {
  const p = S.pitch;
  const rad = p * SOCKET_CLEAR;
  const x0 = S.left + S.margin;
  const y0 = S.top + S.margin;
  return (r) => {
    const i0 = Math.max(0, Math.floor((r.x0 - rad - x0) / p));
    const i1 = Math.min(S.cols - 1, Math.floor((r.x1 + rad - x0) / p));
    const j0 = Math.max(0, Math.floor((r.y0 - rad - y0) / p));
    const j1 = Math.min(S.rows - 1, Math.floor((r.y1 + rad - y0) / p));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++)
        if (open(i, j) && rectHitsCircle(r, x0 + p * (i + 0.5), y0 + p * (j + 0.5), rad))
          return true;
    return false;
  };
}

/**
 * The nearest shift of `box` that keeps it inside `bounds` and clear of `hits`, searched on a
 * `step` grid out to `reach` px; the cost weighs x and y moves by `wx`, `wy` (a card pinned at
 * a side keeps to that side). Starts from `box` clamped into `bounds`. Null when nothing within
 * reach is clear (or the box is bigger than the bounds).
 */
export function clearSpot(
  box: Rect,
  bounds: Rect,
  hits: (r: Rect) => boolean,
  step: number,
  reach: number,
  wx = 1,
  wy = 1,
): { dx: number; dy: number } | null {
  const lox = bounds.x0 - box.x0;
  const hix = bounds.x1 - box.x1;
  const loy = bounds.y0 - box.y0;
  const hiy = bounds.y1 - box.y1;
  if (lox > hix || loy > hiy) return null;
  const bx = Math.min(hix, Math.max(lox, 0));
  const by = Math.min(hiy, Math.max(loy, 0));
  const r: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let best: { dx: number; dy: number } | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  const wmin = Math.min(wx, wy);
  const kmax = Math.ceil(reach / step);
  const tryAt = (dx: number, dy: number) => {
    if (dx < lox || dx > hix || dy < loy || dy > hiy) return;
    const cost = wx * (dx - bx) ** 2 + wy * (dy - by) ** 2;
    if (cost >= bestCost) return;
    r.x0 = box.x0 + dx;
    r.x1 = box.x1 + dx;
    r.y0 = box.y0 + dy;
    r.y1 = box.y1 + dy;
    if (hits(r)) return;
    best = { dx, dy };
    bestCost = cost;
  };
  for (let k = 0; k <= kmax; k++) {
    // Every spot on ring k costs at least this much: stop once the best found beats it.
    if (wmin * (k * step) ** 2 >= bestCost) break;
    if (k === 0) {
      tryAt(bx, by);
      continue;
    }
    const s = k * step;
    for (let t = -k; t <= k; t++) {
      const u = t * step;
      tryAt(bx + u, by - s);
      tryAt(bx + u, by + s);
      if (t > -k && t < k) {
        tryAt(bx - s, by + u);
        tryAt(bx + s, by + u);
      }
    }
  }
  return best;
}
