/**
 * Phones fill the width (D-040), on the published engine (D-052).
 *
 * Until v1 the engine did this: `createGame({ fillBands })`, `ctx.setFill(key)` and
 * `surface.setFill` grew the canvas past the letterbox on a phone and cropped the top and bottom
 * to a band of the design (an upright phone's title crops the sides instead), and `ctx.device`
 * put `data-phone`, `data-touch` and the crop tokens on the overlay root. Engine v1 removed all
 * of it: its surface always letterboxes (`Surface.setFrame` clamps the frame to the container),
 * and `camera.fitRect` can only reframe inside that canvas, which cannot remove the side bars.
 * So the game does it here, through the surface's public `rect`, `backbuffer` and `canvas`,
 * after each of the surface's own layouts. Upstream ask: a fill (cover) mode on `Surface`
 * (docs/workstreams/engine-npm.md, "Upstream asks").
 *
 * Desktop and tablets never fill (the contain fit's scale is at least `PHONE_SCALE`), so there
 * the surface is left exactly as the engine lays it out.
 */
import {
  computeBackbuffer,
  computeLetterbox,
  createDeviceMode,
  type DeviceMode,
  type Letterbox,
  PHONE_SCALE,
  type Surface,
} from '@thunderclap-engine/engine/platform';
import type { Overlay } from '@thunderclap-engine/engine/ui';

/** A fill band (D-040): what of the design must stay on screen when a phone fills its width. */
export interface FillBand {
  /**
   * The least design height that must stay on screen. The canvas grows to fill the width only
   * as far as this allows; past it the bars come back (narrower than the contain fit's).
   */
  minVisible: number;
  /** Design y the visible band is centred on (clamped inside the design). Default: the middle. */
  focusY?: number;
  /**
   * For a frame taller than the design's aspect (an upright phone): the least design width that
   * must stay on screen. Set, the canvas fills the height and the sides are cropped instead.
   * Absent: a tall frame keeps the contain fit.
   */
  minVisibleWidth?: number;
  /** Design x the visible width is centred on (clamped inside the design). Default: the middle. */
  focusX?: number;
}

type Frame = { x: number; y: number; width: number; height: number };

/**
 * Like `computeLetterbox`, but in a frame wider than the design's aspect the canvas grows to fill
 * the width and the top and bottom are cropped (`y` goes negative, the height overflows). With
 * `minVisibleWidth`, a taller frame fills its height and crops the sides. Never smaller than the
 * contain fit.
 */
export function computeFill(
  frameW: number,
  frameH: number,
  designW: number,
  designH: number,
  band: FillBand,
): Letterbox {
  const fit = computeLetterbox(frameW, frameH, designW, designH);
  if (fit.scale === 0) return fit;
  if (frameW * designH < frameH * designW) {
    if (band.minVisibleWidth === undefined) return fit;
    const keep = Math.min(designW, Math.max(1, band.minVisibleWidth));
    const want = Math.min(frameH / designH, frameW / keep);
    if (want <= fit.scale) return fit;
    const height = Math.min(frameH, Math.round(designH * want));
    const scale = height / designH;
    const width = Math.round(designW * scale);
    const visible = frameW / scale;
    const focus = band.focusX ?? designW / 2;
    const left = Math.min(Math.max(0, focus - visible / 2), Math.max(0, designW - visible));
    return {
      x: -Math.round(left * scale) || 0,
      y: Math.floor((frameH - height) / 2),
      width,
      height,
      scale,
    };
  }
  const keep = Math.min(designH, Math.max(1, band.minVisible));
  const want = Math.min(frameW / designW, frameH / keep);
  if (want <= fit.scale) return fit;
  const width = Math.min(frameW, Math.round(designW * want));
  const scale = width / designW;
  const height = Math.round(designH * scale);
  const visible = frameH / scale;
  const focus = band.focusY ?? designH / 2;
  const top = Math.min(Math.max(0, focus - visible / 2), Math.max(0, designH - visible));
  return {
    x: Math.floor((frameW - width) / 2),
    y: -Math.round(top * scale) || 0,
    width,
    height,
    scale,
  };
}

/** What the game uses instead of the old `ctx.device` / `ctx.setFill` / `surface.setFrame`. */
export interface ScreenFit {
  /** Phone and touch modes, `data-phone` / `data-touch` / `--tc-crop-*` on the overlay root. */
  readonly device: DeviceMode;
  /** Selects the fill band by key (a flow state); a key with no band letterboxes. */
  setFill(key: string): void;
  /** `surface.setFrame`, remembered so a fill is computed inside the same frame. */
  setFrame(frame: Frame | null): void;
  readonly root: HTMLElement;
}

/** Same defaults as the engine's surface (`SurfaceOptions.maxDpr` / `maxPixels`). */
const MAX_DPR = 2;
const MAX_PIXELS = 2560 * 1440;

export function createScreenFit(
  engine: {
    surface: Surface;
    renderer: { resize(width: number, height: number): void };
    ui: Overlay;
  },
  bands: Readonly<Record<string, FillBand>>,
): ScreenFit {
  const { surface, renderer, ui } = engine;
  const device = createDeviceMode(ui.root);
  let key = 'boot';
  let frame: Frame | null = null;

  const fill = (): Letterbox | null => {
    const band = bands[key];
    if (!band || surface.fitRect.scale >= PHONE_SCALE) return null;
    const cw = surface.root.clientWidth;
    const ch = surface.root.clientHeight;
    const w = frame ? Math.max(1, Math.min(frame.width, cw)) : cw;
    const h = frame ? Math.max(1, Math.min(frame.height, ch)) : ch;
    const r = computeFill(w, h, surface.logicalWidth, surface.logicalHeight, band);
    return frame ? { ...r, x: r.x + frame.x, y: r.y + frame.y } : r;
  };

  const place = (rect: Letterbox) => {
    const bb = computeBackbuffer(
      rect.width,
      rect.height,
      window.devicePixelRatio,
      MAX_DPR,
      MAX_PIXELS,
    );
    const cur = surface.rect;
    if (
      rect.x === cur.x &&
      rect.y === cur.y &&
      rect.width === cur.width &&
      rect.height === cur.height &&
      bb.width === surface.backbuffer.width &&
      bb.height === surface.backbuffer.height
    )
      return;
    surface.rect = rect;
    surface.backbuffer = bb;
    const s = surface.canvas.style;
    s.left = `${rect.x}px`;
    s.top = `${rect.y}px`;
    s.width = `${rect.width}px`;
    s.height = `${rect.height}px`;
    surface.canvas.width = bb.width;
    surface.canvas.height = bb.height;
    renderer.resize(bb.width, bb.height);
    ui.setFrame(rect);
  };

  const scale = () => {
    const r = surface.rect;
    const ch = surface.root.clientHeight;
    device.setScale(ui.scale, r.x, {
      fitScale: surface.fitRect.scale,
      top: Math.max(0, -r.y),
      bottom: Math.max(0, r.y + r.height - ch),
    });
    // A filled scene that still leaves slim bars (very wide phones) fades its side edges into
    // them, so the art ends softly instead of at a hard letterbox line.
    const soft = r.height > ch + 1 && r.x > 0;
    surface.canvas.style.maskImage = soft
      ? 'linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)'
      : '';
  };

  // The surface lays out (container resize, DPR, a new frame) back to its letterbox and calls
  // its listeners, the engine's first (renderer and overlay frame); this one then fills again.
  const apply = () => {
    const r = fill();
    if (r) place(r);
    scale();
  };
  surface.onResize(apply);

  return {
    device,
    root: surface.root,
    setFill(k) {
      if (k === key) return;
      const was = fill();
      key = k;
      if (!was) return apply();
      // Leaving a band: back to the surface's own letterbox (a fresh layout with no fill).
      if (!fill()) {
        surface.rect = { x: Number.NaN, y: 0, width: 0, height: 0, scale: 0 };
        surface.layout();
        return;
      }
      apply();
    },
    setFrame(f) {
      frame = f ? { x: f.x, y: f.y, width: f.width, height: f.height } : null;
      surface.setFrame(frame);
      // The surface lays out only when its frame changed; a fill may still need re-applying.
      apply();
    },
  };
}
