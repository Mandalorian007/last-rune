/**
 * Where everything sits on the 1920×1080 design canvas, for any puzzle. Pure TS.
 *
 * Nothing here is per puzzle: board size, storm side and machine sides all come from the
 * `PuzzleDef`, so difficulty-fun can retune boards and trays freely. Geometry mirrors
 * `AltarSlab` (margin = 0.8 × pitch, front face = 0.42 × pitch).
 */
import { snapToGrid } from '@thunderclap/engine/input';
import { altarDims, type PuzzleDef } from '../../rules';
import type { Cell, GemKind } from '../../rules/types';
import { GEM_KINDS } from '../../rules/types';

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

/** Top band kept clear for the HUD. */
const TOP = 76;
/**
 * Bottom band for the tray. Taller than the tray needs: FUSE's caption card sits in the
 * bottom-right corner (720 px wide), so nothing on the board may reach below ~y 830.
 */
const TRAY_BAND = 250;
/**
 * FUSE's caption card owns the bottom-right corner (720 px wide, 40 px from the edges, and
 * up to ~220 px tall). Nothing the puzzle needs (tray slots, counts, labels, tooltips) may
 * enter this lane.
 */
export const CAPTION_LANE = { x: 1130, y: 820 } as const;
/** FUSE's sprite stands bottom-left (x ≤ ~390 from y ~820 down); keep the tray clear of it. */
export const FUSE_LANE = { x: 410, y: 820 } as const;
/** Tray slot centres stay between these, so six slots fit between FUSE and the caption. */
const TRAY_MIN_X = 470;
const TRAY_MAX_X = 1070;
/** Tray row centre. */
const TRAY_X = (TRAY_MIN_X + TRAY_MAX_X) / 2;
/** Tray row centre, where the gem info card sits when it points at no slot. */
export const TRAY_CENTER_X = TRAY_X;
const TRAY_SPACING = 140;
const MAX_PITCH = 118;
/** Machines never shrink below this (design px), so the gauge stays readable on big boards. */
const MACHINE_MIN = 180;
const MACHINE_MAX = 230;
/** How far a prop on N/S sticks out past the slab, in pitches. */
const PROP_OUT_V = 0.95;
/** How far a prop on E/W sticks out past the slab, in pitches. */
const PROP_OUT_H = 1.9;

export type Side = 0 | 1 | 2 | 3; // N E S W
export type LabelAlign = 'below' | 'right' | 'up' | 'down';

export interface PropSpot {
  /** Prop centre. */
  x: number;
  y: number;
  /** Prop quad size (width). */
  size: number;
  /** Which side of the altar it stands on. */
  side: Side;
  /** Where a bolt enters / leaves the prop. */
  port: { x: number; y: number };
  /** The outside cell it occupies. */
  cell: Cell;
  /** The socket it is wired to: where the storm's bolt enters, or where charge exits. */
  inner: Cell;
  /**
   * Where its "Needs N" label goes: `x, y` is the anchor, `align` the side. Phones also use
   * `up` / `down` (beside a north / south gauge, clear of the board) with `alt`, the anchor x
   * for the same card on the gauge's other side.
   */
  label: { x: number; y: number; align: LabelAlign; alt?: number };
}

export interface TraySlot {
  gem: GemKind;
  x: number;
  y: number;
  size: number;
}

/**
 * A phone in landscape (mobile-2, mobile-3-board): the buttons live in the chrome's rails, so
 * the board gets nearly the whole canvas. `padL`/`padR` are what the rails take inside the
 * canvas past its letterbox bars (design px), read off their regions (altar-chrome.ts).
 * `cssPx` is design px per CSS px: phone sizes are budgeted in CSS px (D-040).
 */
export interface PhoneFrame {
  padL: number;
  padR: number;
  cssPx: number;
  /** The visible band, design y (the canvas is cropped top and bottom when it fills the width). */
  top?: number;
  bottom?: number;
}

/**
 * The phone layout (mobile-3-board): the board and its gauges fill the canvas height on the
 * left; a column on the right holds, top to bottom, the title, the tray, the lane (gem chip,
 * verdict, Capacitor read-outs), FUSE's bubble or the hint, and FUSE. All design px.
 */
export interface PhoneBand {
  /** The right-hand column. */
  /** Left edge of the open canvas (past the left bar), design px. */
  padL: number;
  colL: number;
  colR: number;
  /** Top of the lane under the tray. */
  laneTop: number;
  /** FUSE's bubble and the hint: left edge and bottom (y). They reach on into the right bar. */
  bubbleL: number;
  bubbleB: number;
  /** FUSE: his feet, and his size. */
  fuseX: number;
  fuseY: number;
  fuseScale: number;
  /** Design px per CSS px, the canvas edge inset, and a label's clearance from the board. */
  cssPx: number;
  edge: number;
  clear: number;
  /** Half the hit box of a tray slot. */
  trayHitX: number;
  trayHitY: number;
  /** The ↻ badge on a held gem, design px across (mobile-4-board). */
  badge: number;
  /** Slab margin and front face (thinner than the desktop slab's). */
  front: number;
  /** The visible band, design y (mobile-5-board: the altar fills a wide phone's width). */
  visT: number;
  visB: number;
}

export interface AltarLayout {
  /** Set on the phone layout only. */
  phone?: PhoneBand;
  cols: number;
  rows: number;
  pitch: number;
  margin: number;
  /** Centre of the slab's top face. */
  cx: number;
  cy: number;
  /** Slab top face bounds. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Bottom of the front face. */
  frontBottom: number;
  gemSize: number;
  storm: PropSpot;
  machines: PropSpot[];
  tray: TraySlot[];
  trayY: number;
  /** Centre x of the title block and verdict, and the widest the verdict may grow. */
  titleX: number;
  titleMax: number;
}

/** Side of the altar an outside cell is on. */
export function sideOf(c: Cell, cols: number, rows: number): Side {
  if (c.y < 0) return 0;
  if (c.x >= cols) return 1;
  if (c.y >= rows) return 2;
  return 3; // c.x < 0
}

export function computeLayout(p: PuzzleDef, phone: PhoneFrame | null = null): AltarLayout {
  if (phone) return phoneLayout(p, phone);
  const { w: cols, h: rows } = altarDims(p.altar);
  const outside = [p.storm.at, ...p.machines.map((m) => m.at)];
  const has = [false, false, false, false];
  const hasMachine = [false, false, false, false];
  for (const c of outside) has[sideOf(c, cols, rows)] = true;
  for (const m of p.machines) hasMachine[sideOf(m.at, cols, rows)] = true;
  const stormSide = sideOf(p.storm.at, cols, rows);
  // A machine on the storm's side (E/W) steps further out, so the storm's stand never
  // overlaps its roof (splitter-mill).
  const shareOffset = (pitch: number) => Math.round(pitch * 2.1 * 0.3);
  const machineFactor = p.machines.length > 2 ? 1.6 : 1.85;
  const machineSizeAt = (pitch: number) =>
    Math.round(Math.min(MACHINE_MAX, Math.max(MACHINE_MIN, pitch * machineFactor)));

  // How far the props on each side reach past the slab, in px, for a given pitch. Machines
  // keep a minimum size (MACHINE_MIN) however small the sockets get, so their reach is in px.
  const reach = (pitch: number): [number, number, number, number] => {
    const m = machineSizeAt(pitch);
    const out: [number, number, number, number] = [0, 0, 0, 0];
    for (const s of [0, 1, 2, 3] as Side[]) {
      const vertical = s === 0 || s === 2;
      let r = (vertical ? 0.1 : 0.3) * pitch;
      if (has[s]) r = Math.max(r, (vertical ? PROP_OUT_V : PROP_OUT_H) * pitch);
      if (hasMachine[s]) r = Math.max(r, vertical ? 0.6 * m : 0.1 * pitch + 0.95 * m + 8);
      if (s === stormSide && hasMachine[s] && !vertical) r += shareOffset(pitch);
      out[s] = r;
    }
    return out;
  };
  const top0 = TOP;
  const availW = DESIGN_W - 120;
  const availH = DESIGN_H - top0 - TRAY_BAND;
  const fits = (pitch: number) => {
    const r = reach(pitch);
    return (
      (cols + 1.6) * pitch + r[1] + r[3] <= availW &&
      (rows + 1.6 + 0.42) * pitch + r[0] + r[2] <= availH
    );
  };
  let pitch = MAX_PITCH;
  while (pitch > 24 && !fits(pitch)) pitch--;
  const margin = Math.round(pitch * 0.8);
  const width = cols * pitch + margin * 2;
  const topH = rows * pitch + margin * 2;
  const front = Math.round(pitch * 0.42);
  const ext = reach(pitch);

  // Centre vertically in the band; keep room for N/S props.
  const above = ext[0];
  const below = ext[2];
  const blockH = above + topH + front + below;
  const blockTop = top0 + (availH - blockH) / 2;
  const top = Math.round(blockTop + above);
  const cy = top + topH / 2;
  // Centre horizontally, nudged away from the heavier side.
  const mid = DESIGN_W / 2;
  const cx = Math.round(mid + (ext[3] - ext[1]) / 2);
  const left = cx - width / 2;
  const right = cx + width / 2;
  const bottom = top + topH;

  const cellX = (x: number) => left + margin + pitch * (x + 0.5);
  const cellY = (y: number) => top + margin + pitch * (y + 0.5);

  const spot = (c: Cell, size: number, kind: 'storm' | 'machine'): PropSpot => {
    const side = sideOf(c, cols, rows);
    const gap = pitch * 0.1;
    let x = 0;
    let y = 0;
    let port = { x: 0, y: 0 };
    // Machine quads are square; the cabinet fills ~90% width, ~70% height. Storm: sphere
    // r = 0.24 size, centred 0.048 size above the quad centre.
    if (kind === 'storm') {
      const r = 0.24 * size;
      const sy = -0.048 * size;
      if (side === 3) {
        x = left - r * 0.55;
        y = cellY(c.y) - sy;
      } else if (side === 1) {
        x = right + r * 0.55;
        y = cellY(c.y) - sy;
      } else if (side === 0) {
        x = cellX(c.x);
        y = top - r * 0.35 - sy;
      } else {
        x = cellX(c.x);
        y = bottom + front + r * 0.35 - sy;
      }
      port = { x, y: y + sy };
    } else {
      const k = size / 2;
      const out = side === stormSide && (side === 1 || side === 3) ? shareOffset(pitch) : 0;
      if (side === 1) {
        // Terminal (left side of the cabinet) lines up with the row.
        x = right + gap + 0.9 * k + out;
        y = cellY(c.y) + 0.18 * k;
        port = { x: x - 0.96 * k, y: y - 0.18 * k };
      } else if (side === 3) {
        x = left - gap - 0.9 * k - out;
        y = cellY(c.y) + 0.18 * k;
        port = { x: x + 0.86 * k, y: cellY(c.y) };
      } else if (side === 0) {
        x = cellX(c.x);
        y = top - 0.45 * k;
        port = { x, y: y + 0.55 * k };
      } else {
        x = cellX(c.x);
        y = bottom + front + 0.5 * k;
        port = { x, y: y - 0.6 * k };
      }
    }
    const inner = {
      x: Math.max(0, Math.min(cols - 1, c.x)),
      y: Math.max(0, Math.min(rows - 1, c.y)),
    };
    // Label: under the cabinet on E/W; beside it on N/S, where below would hit the board or
    // the tray. A south label sits level with the cabinet's top half, clear of the caption.
    const label =
      side === 0 || side === 2
        ? {
            x: Math.round(x + 0.46 * size),
            y: Math.round(y + (side === 0 ? 0.04 : -0.18) * size),
            align: 'right' as const,
          }
        : { x: Math.round(x), y: Math.round(y + 0.33 * size), align: 'below' as const };
    return { x, y, size, side, port, cell: { x: c.x, y: c.y }, inner, label };
  };

  const storm = spot(p.storm.at, Math.round(pitch * 2.1), 'storm');
  const machineSize = machineSizeAt(pitch);
  const machines = p.machines.map((m) => spot(m.at, machineSize, 'machine'));

  // Tray: canonical gem order, only what this puzzle offers.
  const kinds = GEM_KINDS.filter((k) => (p.tray[k] ?? 0) > 0);
  const trayY = DESIGN_H - 108;
  const spacing =
    kinds.length > 1
      ? Math.min(TRAY_SPACING, (TRAY_MAX_X - TRAY_MIN_X) / (kinds.length - 1))
      : TRAY_SPACING;
  const tray = kinds.map((gem, i) => ({
    gem,
    x: TRAY_X + (i - (kinds.length - 1) / 2) * spacing,
    y: trayY,
    size: 92,
  }));

  const { titleX, titleMax } = placeTitle([storm, ...machines]);

  return {
    cols,
    rows,
    pitch,
    margin,
    cx,
    cy,
    left,
    right,
    top,
    bottom,
    frontBottom: bottom + front,
    gemSize: Math.round(pitch * 0.74),
    storm,
    machines,
    tray,
    trayY,
    titleX,
    titleMax,
  };
}

/**
 * Phone budgets, CSS px (mobile-3-board, D-040). The socket pitch is what is left once the
 * gauges' gutters and the right-hand column are paid for.
 */
const PH = {
  /** Canvas edge inset: every gauge and card stands ≥4 px inside the play area (mobile-4-board). */
  edge: 5,
  /** A label's clearance from the board. */
  clear: 8,
  /** A west/east side with a gauge: the gauge and its card (card ≤ gutter − clear − edge). */
  gutter: 66,
  /** The right-hand column: narrowest, widest; and its gap from the board block. */
  colMin: 140,
  /** mobile-5-board: a tray of up to four types stands two to a row in a narrower column. */
  colMin2: 116,
  /** A phone narrower than `wideCss` (an SE) keeps the column ≥ `laneMin` CSS px, so a gem
   *  chip or a verdict stays four or five lines (at 116 px they ran to six). */
  laneMin: 140,
  wideCss: 720,
  colMax: 216,
  colGap: 4,
  /**
   * Biggest socket pitch (6×4 boards stop here; the column takes what is left). mobile-5-board:
   * raised from 52 now that the altar fills a wide phone's width, so the board fills its height.
   */
  maxPitch: 84,
  /**
   * Tray (mobile-4-board): gems as big as three to a row allow, between these; the gap between
   * gems and the count line under each; the header above. A held gem (lifted, ↻ badge at
   * its corner) stays under the header, which then stacks the puzzle's name over the "Holding
   * X" pill (two 12 px lines, 3 px in from the top), so the first row sits low enough for both.
   */
  slotMin: 38,
  slotMax: 46,
  /** port-altar-3: a short band (an SE, ≤ `shortCss` tall) takes smaller gems, so a card fits under. */
  slotShort: 40,
  shortCss: 345,
  slotGap: 8,
  /** port-altar-3: the count is a badge on the gem's corner, so rows stand this far apart. */
  rowGap: 8,
  titleH: 26,
  badge: 26,
  /** FUSE's bubble / the hint sit this far above the canvas bottom (clear of Strike, 64 px). */
  bubbleUp: 68,
  /**
   * Height of a card beside a north/south gauge: one line, or two on multi-strike altars
   * (mobile-5-board: the number 15 px, the note 13 px).
   */
  label1: 22,
  label2: 35,
} as const;

/** A lifted gem rises this far (design px; gems.ts GEM_LIFT_PX) and grows 7%. */
const LIFT = 16;

/** The widest a west/east gauge's card may be on a phone, CSS px (it wraps to fit). */
export const PHONE_GUTTER_CARD = PH.gutter - PH.clear - PH.edge;

/**
 * Slab border and front face on a phone, in pitches (the desktop slab: 0.8 and 0.42): the
 * fuller slab where the board fits at that pitch, else the thin one (mobile-4-board).
 */
const PHONE_SLAB = [
  [0.22, 0.16],
  [0.14, 0.1],
] as const;

function phoneLayout(p: PuzzleDef, f: PhoneFrame): AltarLayout {
  const c = f.cssPx;
  const { w: cols, h: rows } = altarDims(p.altar);
  const has = [false, false, false, false];
  for (const x of [p.storm.at, ...p.machines.map((m) => m.at)]) has[sideOf(x, cols, rows)] = true;
  const edge = PH.edge * c;
  const clear = PH.clear * c;
  const labelH = (p.pulses > 1 ? PH.label2 : PH.label1) * c;
  const machineSizeAt = (pitch: number) =>
    Math.round(Math.min(52 * c, Math.max(40 * c, pitch * 1.2)));
  const stormSizeAt = (pitch: number) => Math.round(Math.min(pitch * 1.9, 92 * c));
  // How far each side's gauge and card reach past the slab (front face included at S).
  const reach = (pitch: number): [number, number, number, number] => {
    const m = machineSizeAt(pitch);
    const r = 0.29 * stormSizeAt(pitch); // the orb as drawn, glass and halo
    const v = Math.max(0.62 * m, 1.4 * r, clear + labelH) + edge;
    return [
      has[0] ? v : edge,
      has[1] ? PH.gutter * c : edge,
      has[2] ? v : edge,
      has[3] ? PH.gutter * c : edge,
    ];
  };
  // The visible band (mobile-5-board: the canvas crops top and bottom when it fills the width).
  const T = f.top ?? 0;
  const B = f.bottom ?? DESIGN_H;
  const x0 = f.padL;
  const x1 = DESIGN_W - f.padR - edge;
  // Tray rows (mobile-5-board): up to four types two to a row, so the column can be narrower
  // and the board wider; five or six, three to a row.
  const kinds = GEM_KINDS.filter((k) => (p.tray[k] ?? 0) > 0);
  const per = kinds.length <= 4 ? Math.min(2, Math.max(1, kinds.length)) : 3;
  const nRows = Math.max(1, Math.ceil(kinds.length / per));
  // Wide phones take the width from the column; a narrow one (an SE) keeps its lane readable.
  const narrow = DESIGN_W / c < PH.wideCss;
  const colMin = Math.max(per <= 2 ? PH.colMin2 : PH.colMin, narrow ? PH.laneMin : 0) * c;
  const boardRoom = x1 - x0 - colMin - PH.colGap * c;
  const dims = (pitch: number, slab = 0) => {
    const m = Math.round(pitch * PHONE_SLAB[slab]![0]);
    const front = Math.round(pitch * PHONE_SLAB[slab]![1]);
    const r = reach(pitch);
    return {
      m,
      front,
      r,
      w: r[3] + cols * pitch + 2 * m + r[1],
      h: r[0] + rows * pitch + 2 * m + front + r[2],
    };
  };
  let pitch = Math.round(PH.maxPitch * c);
  let slab = 0;
  const fits = (d: ReturnType<typeof dims>) => d.w <= boardRoom && d.h <= B - T;
  for (; pitch > 24; pitch--) {
    if (fits(dims(pitch, 0))) break;
    if (fits(dims(pitch, 1))) {
      slab = 1;
      break;
    }
  }
  const d = dims(pitch, slab);
  const margin = d.m;
  const front = d.front;
  const ext = d.r;
  const colW = Math.min(PH.colMax * c, x1 - x0 - d.w - PH.colGap * c);
  const colR = x1;
  const colL = Math.round(colR - colW);
  // The board block: centred in what the column leaves, and in the height.
  const blockL = x0 + (colL - PH.colGap * c - x0 - d.w) / 2;
  const left = Math.round(blockL + ext[3]);
  const top = Math.round(T + (B - T - d.h) / 2 + ext[0]);
  const width = cols * pitch + margin * 2;
  const topH = rows * pitch + margin * 2;
  const right = left + width;
  const bottom = top + topH;
  const cx = left + width / 2;
  const cy = top + topH / 2;
  const cellX = (x: number) => left + margin + pitch * (x + 0.5);
  const cellY = (y: number) => top + margin + pitch * (y + 0.5);
  // West / east gauges stand in the middle of the room their card has in the gutter.
  const gutterMid = (PH.gutter + PH.clear - PH.edge) * c * 0.5;

  const spot = (at: Cell, size: number, kind: 'storm' | 'machine'): PropSpot => {
    const side = sideOf(at, cols, rows);
    const sx = side === 3 ? left - gutterMid : right + gutterMid;
    let x = 0;
    let y = 0;
    let port = { x: 0, y: 0 };
    let half = 0; // half the gauge's drawn width, for a card beside it
    let under = 0; // the drawn gauge's bottom, below y
    if (kind === 'storm') {
      const r = 0.24 * size;
      const sy = -0.048 * size;
      half = r;
      under = r - sy;
      if (side === 3 || side === 1) {
        x = sx;
        y = cellY(at.y) - sy;
      } else if (side === 0) {
        x = cellX(at.x);
        y = top - r * 0.35 - sy;
      } else {
        x = cellX(at.x);
        y = bottom + front + r * 0.35 - sy;
      }
      port = { x, y: y + sy };
    } else {
      const k = size / 2;
      half = 0.9 * k;
      under = 0.7 * k;
      if (side === 1) {
        x = sx;
        y = cellY(at.y) + 0.18 * k;
        port = { x: x - 0.96 * k, y: y - 0.18 * k };
      } else if (side === 3) {
        x = sx;
        y = cellY(at.y) + 0.18 * k;
        port = { x: x + 0.86 * k, y: cellY(at.y) };
      } else if (side === 0) {
        x = cellX(at.x);
        y = top - 0.45 * k;
        port = { x, y: y + 0.55 * k };
      } else {
        x = cellX(at.x);
        y = bottom + front + 0.5 * k;
        port = { x, y: y - 0.6 * k };
      }
    }
    const inner = {
      x: Math.max(0, Math.min(cols - 1, at.x)),
      y: Math.max(0, Math.min(rows - 1, at.y)),
    };
    const gap = 4 * c;
    const label: PropSpot['label'] =
      side === 0 || side === 2
        ? {
            x: Math.round(x + half + gap),
            alt: Math.round(x - half - gap),
            y: Math.round(side === 0 ? top - clear : bottom + front + clear),
            align: side === 0 ? 'up' : 'down',
          }
        : { x: Math.round(x), y: Math.round(y + under), align: 'below' };
    return { x, y, size, side, port, cell: { x: at.x, y: at.y }, inner, label };
  };
  const storm = spot(p.storm.at, stormSizeAt(pitch), 'storm');
  const machineSize = machineSizeAt(pitch);
  const machines = p.machines.map((m) => spot(m.at, machineSize, 'machine'));

  // Tray: rows of up to three under the title, centred in the column, the gems as big as
  // the column allows (types the puzzle starts without are left out).
  const colX = (colL + colR) / 2;
  const slotMax = (B - T) / c <= PH.shortCss ? PH.slotShort : PH.slotMax;
  const slot = Math.max(
    PH.slotMin,
    Math.min(slotMax, Math.floor((colR - colL) / c / Math.max(per, 2) - PH.slotGap)),
  );
  const slotDX = slot + PH.slotGap;
  const slotDY = Math.max(44, slot + PH.rowGap);
  const lift = LIFT / c;
  // First row: a held gem, lifted, and its ↻ badge clear of the title line.
  const row0 =
    PH.titleH + 2 + Math.ceil(Math.max(lift + 0.535 * slot, lift + 0.42 * slot + PH.badge / 2));
  const tray: TraySlot[] = kinds.map((gem, i) => {
    const row = Math.floor(i / per);
    const inRow = Math.min(per, kinds.length - row * per);
    const j = i - row * per;
    return {
      gem,
      x: Math.round(colX + (j - (inRow - 1) / 2) * slotDX * c),
      y: Math.round(T + (row0 + row * slotDY) * c),
      size: Math.round(slot * c),
    };
  });
  const lastRow = row0 + (nRows - 1) * slotDY;
  return {
    phone: {
      padL: f.padL,
      colL,
      colR,
      // The count badge hangs 3 px under the gem's corner; the cards start 6 px under that.
      laneTop: Math.round(T + (lastRow + slot / 2 + 9) * c),
      bubbleL: colL,
      bubbleB: Math.round(B - PH.bubbleUp * c),
      fuseX: Math.round(colL + 22 * c),
      fuseY: Math.round(B - 2 * c),
      fuseScale: Math.round(25 * c),
      cssPx: c,
      edge,
      clear,
      trayHitX: Math.round((slotDX / 2) * c),
      trayHitY: Math.round((slotDY / 2) * c),
      badge: Math.round(PH.badge * c),
      front,
      visT: T,
      visB: B,
    },
    cols,
    rows,
    pitch,
    margin,
    cx,
    cy,
    left,
    right,
    top,
    bottom,
    frontBottom: bottom + front,
    gemSize: Math.round(pitch * 0.74),
    storm,
    machines,
    tray,
    trayY: tray[0]?.y ?? T + row0 * c,
    titleX: Math.round(colX),
    titleMax: Math.round(colR - colL),
  };
}

/** Clear band for the title between the Codex/Settings buttons and the action buttons. */
const TITLE_BAND = [220, 1180] as const;
const TITLE_HALF = 210;
/** Widest a need label gets ("Needs 20 · got 20"). */
const LABEL_W = 300;
/** Lowest y the title block and verdict reach. */
const TITLE_BOTTOM = 160;

/**
 * Centre the title unless a north prop (gauge plus its need label) would sit under it; then
 * use the widest clear gap in the band so the title and verdict never cover a gauge.
 */
function placeTitle(props: PropSpot[]): { titleX: number; titleMax: number } {
  const mid = DESIGN_W / 2;
  const blocks: [number, number][] = [];
  for (const s of props) {
    if (s.side !== 0 || s.y - s.size * 0.5 > TITLE_BOTTOM) continue;
    const k = s.size / 2;
    blocks.push([s.x - 0.6 * k, s.label.x + LABEL_W]);
  }
  if (!blocks.some(([a, b]) => a < mid + TITLE_HALF && b > mid - TITLE_HALF)) {
    return { titleX: mid, titleMax: 900 };
  }
  blocks.sort((a, b) => a[0] - b[0]);
  let best: [number, number] = [mid, mid];
  let from: number = TITLE_BAND[0];
  for (const [a, b] of [...blocks, [TITLE_BAND[1], TITLE_BAND[1]] as [number, number]]) {
    const to = Math.min(a, TITLE_BAND[1]);
    if (to - from > best[1] - best[0]) best = [from, to];
    from = Math.max(from, b);
  }
  return {
    titleX: Math.round((best[0] + best[1]) / 2),
    titleMax: Math.round(best[1] - best[0] - 20),
  };
}

/** Socket centre for an on-altar cell. */
export function cellCenter(L: AltarLayout, c: Cell, out: { x: number; y: number }): void {
  out.x = L.left + L.margin + L.pitch * (c.x + 0.5);
  out.y = L.top + L.margin + L.pitch * (c.y + 0.5);
}

/**
 * Bolt anchor for any trace cell: sockets map to their centre, the storm cell to the storm's
 * sphere, machine cells to their port; other outside cells (grounded bolts) to the slab rim.
 */
export function anchorOf(L: AltarLayout, c: Cell, out: { x: number; y: number }): void {
  if (c.x >= 0 && c.y >= 0 && c.x < L.cols && c.y < L.rows) {
    cellCenter(L, c, out);
    return;
  }
  if (L.storm.cell.x === c.x && L.storm.cell.y === c.y) {
    out.x = L.storm.port.x;
    out.y = L.storm.port.y;
    return;
  }
  for (const m of L.machines) {
    if (m.cell.x === c.x && m.cell.y === c.y) {
      out.x = m.port.x;
      out.y = m.port.y;
      return;
    }
  }
  // Grounded: the outside cell's centre already lies on the slab's carved rim.
  cellCenter(L, c, out);
}

/** Socket under a logical point, or null. Generous: anywhere in the cell square. */
export function cellAt(L: AltarLayout, x: number, y: number): Cell | null {
  const fx = (x - L.left - L.margin) / L.pitch;
  const fy = (y - L.top - L.margin) / L.pitch;
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);
  if (cx < 0 || cy < 0 || cx >= L.cols || cy >= L.rows) return null;
  return { x: cx, y: cy };
}

/**
 * Touch aiming (engine `snapToGrid`): the socket a finger means. The socket under the point if `ok` accepts it;
 * otherwise the nearest accepted socket whose edge is within half a pitch of the point (so a
 * slightly-off aim at carved stone or a fixed gem lands next door instead of nowhere). Null
 * when nothing accepted is that close.
 */
export function snapCell(
  L: AltarLayout,
  x: number,
  y: number,
  ok: (c: Cell) => boolean,
): Cell | null {
  const grid = {
    left: L.left + L.margin,
    top: L.top + L.margin,
    pitch: L.pitch,
    cols: L.cols,
    rows: L.rows,
  };
  return snapToGrid(grid, x, y, (i, j) => ok({ x: i, y: j }));
}

/** Tray slot under a logical point, or -1. */
export function traySlotAt(L: AltarLayout, x: number, y: number): number {
  if (L.phone) {
    const { trayHitX: hx, trayHitY: hy } = L.phone;
    for (let i = 0; i < L.tray.length; i++) {
      const s = L.tray[i]!;
      if (Math.abs(x - s.x) < hx && Math.abs(y - s.y) < hy) return i;
    }
    return -1;
  }
  const half = L.tray.length > 1 ? Math.min(68, (L.tray[1]!.x - L.tray[0]!.x) / 2) : 68;
  for (let i = 0; i < L.tray.length; i++) {
    const s = L.tray[i]!;
    if (Math.abs(x - s.x) < half && Math.abs(y - s.y) < 72) return i;
  }
  return -1;
}

/** Centre x for a box `w` wide over the tray: as near `x` as fits between FUSE and the caption. */
export function trayTipX(x: number, w: number, right: number = CAPTION_LANE.x): number {
  const lo = FUSE_LANE.x + w / 2;
  const hi = right - w / 2;
  return lo > hi ? (FUSE_LANE.x + CAPTION_LANE.x) / 2 : Math.max(lo, Math.min(hi, x));
}
