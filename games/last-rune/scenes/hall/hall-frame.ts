/**
 * The hall's phone framing (mobile-5-chrome). Pure: no DOM, no GPU.
 *
 * A landscape phone is far wider than 16:9, and the hall needs its whole doorway band on screen
 * (the top row's arches down to the Intake Desk's sill). The canvas fills the width (D-040), so
 * only a band of the design height shows. To fit the doorways in that band without side bars,
 * the hall camera zooms out about the band, and the wall's wings widen into the room that opens
 * at the sides: every door column (and the props between them) moves out from the centre line by
 * `spread`; the seal, windows and Intake Desk sit on it and stay. Desktop and tablets see the
 * whole design: `IDENTITY_FRAME`.
 *
 * Coordinates: "world" is where the hall is laid out and drawn; "screen" is the 1920×1080 design
 * space the overlay and the pointer use. The renderer's camera maps one to the other.
 */
import type { ConduitModel, HallModel } from './hall-state';

const W = 1920;
const H = 1080;

export interface HallFrame {
  /** Camera zoom about the view centre (1 = the design as laid out). */
  readonly zoom: number;
  /** Camera offset, world px (renderer.camera.x/y). */
  readonly camX: number;
  readonly camY: number;
  /** How far each door column moves out from the centre line (1 = as designed). */
  readonly spread: number;
}

export const IDENTITY_FRAME: HallFrame = { zoom: 1, camX: 0, camY: 0, spread: 1 };

/** World band that must stay on screen: the top row's arches to the Intake Desk's sill. */
export const HALL_BAND = { top: 37, bottom: 1037 } as const;
/** The widest the camera zooms out (the phone hall's wall and floor are baked this wide). */
export const HALL_MIN_ZOOM = 2 / 3;
/** The baked width of the phone hall's wall and floor, world px. */
export const HALL_WIDE = Math.ceil(W / HALL_MIN_ZOOM);
/** The outermost door columns' distance from the centre line, as designed (x 200 and 1720). */
const OUTER = 760;
/** Half a door's drawn width, plus a little stone beyond it. */
const DOOR_HALF = 124;
const MAX_SPREAD = 1.6;

/**
 * The frame for a visible band of the design (`top`, `height`, screen px), keeping `reserve`
 * screen px free at each side edge (the phone's ☰ column). The whole design visible → identity.
 */
export function hallFrame(view: { top: number; height: number }, reserve = 0): HallFrame {
  if (view.height >= H - 0.5) return IDENTITY_FRAME;
  const band = HALL_BAND.bottom - HALL_BAND.top;
  const zoom = Math.min(1, Math.max(HALL_MIN_ZOOM, view.height / band));
  const centre = (HALL_BAND.top + HALL_BAND.bottom) / 2;
  const camY = centre - H / 2 - (view.top + view.height / 2 - H / 2) / zoom;
  const half = (W / 2 - reserve) / zoom;
  const spread = Math.min(MAX_SPREAD, Math.max(1, (half - DOOR_HALF) / OUTER));
  return { zoom, camX: 0, camY, spread };
}

/** A world x moved out from the centre line by the frame's spread. */
export function spreadX(f: HallFrame, x: number): number {
  return f.spread === 1 ? x : W / 2 + (x - W / 2) * f.spread;
}

/** World → screen (design px). */
export function toScreen(f: HallFrame, x: number, y: number): { x: number; y: number } {
  return {
    x: W / 2 + (x - W / 2 - f.camX) * f.zoom,
    y: H / 2 + (y - H / 2 - f.camY) * f.zoom,
  };
}

/** Screen (design px) → world. */
export function toWorld(f: HallFrame, x: number, y: number): { x: number; y: number } {
  return {
    x: W / 2 + f.camX + (x - W / 2) / f.zoom,
    y: H / 2 + f.camY + (y - H / 2) / f.zoom,
  };
}

/** Half the visible world width at this frame (the wall's wings reach this far from the centre). */
export function halfWorldWidth(f: HallFrame): number {
  return W / 2 / f.zoom;
}

/** The hall model with its doors (and the conduits between them) moved out by the spread. */
export function spreadModel(model: HallModel, f: HallFrame): HallModel {
  if (f.spread === 1) return model;
  return {
    alcoves: model.alcoves.map((a) => ({ ...a, x: spreadX(f, a.x) })),
    conduits: model.conduits.map(
      (c): ConduitModel => ({ ...c, x0: spreadX(f, c.x0), x1: spreadX(f, c.x1) }),
    ),
  };
}

/** Two frames that draw the same (a resize that changes nothing keeps the model). */
export function sameFrame(a: HallFrame, b: HallFrame): boolean {
  return (
    Math.abs(a.zoom - b.zoom) < 1e-4 &&
    Math.abs(a.camX - b.camX) < 0.05 &&
    Math.abs(a.camY - b.camY) < 0.05 &&
    Math.abs(a.spread - b.spread) < 1e-4
  );
}
