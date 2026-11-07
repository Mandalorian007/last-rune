/**
 * The phone altar on layout regions (D-041 Phase 2, ws/port-altar-2).
 *
 * In landscape on a phone the altar sets its own tracks on `ctx.ui.layout` (`setForms`):
 * a left rail (Back at the top, Undo and Clear a third of the way down, Turn at the foot), the
 * open `fill` the board is fitted to, and a right rail (the HUD's ☰ at the top, Strike at the
 * foot). The rail buttons are widgets in CSS px; the board's frame (`PhoneFrame`) is read off
 * the same resolved regions, so the board can never run under a rail and the socket pitch is
 * what the rails leave (part 1's 50 / 58 CSS px columns, so the pitch is unchanged).
 *
 * The tray, the gem card and the hint lane stay on the frame beside the board: the
 * tray's gems are drawn and hit-tested on the canvas in design px, and the lane hangs under
 * them, so they move with the board's fit rather than with a region.
 */
import {
  defaultForms,
  type FormSpec,
  type LayoutState,
  type Overlay,
  type Rect,
  type RegionName,
  resolveLayout,
} from '@thunderclap-engine/engine/ui';
import { placeWidgets, type RegionWidget } from '../../ui/chrome';
import { CL } from '../../ui/chrome-styles';
import { DESIGN_H, type PhoneFrame } from './layout';

/** The left rail: a 44 px target and 3 px of air each side (CSS px). */
export const RAIL_LEFT = 50;
/** The right rail: the ☰ over Strike, which stands 12 px in from the screen's edge. */
export const RAIL_RIGHT = 58;

/** The altar's landscape tracks: rail, the board's open area, rail. */
export const ALTAR_FORM: FormSpec = {
  ...defaultForms['phone-landscape'],
  columns: [RAIL_LEFT, 'fill', RAIL_RIGHT],
  rows: ['fill'],
  areas: ['left fill right'],
  pad: 3,
};

/** What the frame reads off the device (engine platform/device-mode.ts). */
export interface FrameDevice {
  readonly phone: boolean;
  readonly cssPx: number;
  readonly bar: number;
  readonly cropT?: number;
  readonly cropB?: number;
}

/**
 * The board's frame from the rails' regions (CSS px from the chrome's left): the canvas gives
 * up what each rail takes past its letterbox bar (`bar`, design px). Null off phones.
 */
export function frameFromRegions(
  d: FrameDevice,
  regions: { left: Rect | null; right: Rect | null },
  width: number,
): PhoneFrame | null {
  if (!d.phone) return null;
  const pad = (css: number) => Math.max(0, Math.round(css * d.cssPx - d.bar));
  const l = regions.left ? regions.left.x + regions.left.width : 0;
  const r = regions.right ? width - regions.right.x : 0;
  return {
    padL: pad(l),
    padR: pad(r),
    cssPx: d.cssPx,
    top: d.cropT ?? 0,
    bottom: DESIGN_H - (d.cropB ?? 0),
  };
}

/** The altar's regions at an overlay size (the engine's own resolver, so they match the DOM). */
export function altarRegions(width: number, height: number, safeArea?: LayoutState['safeArea']) {
  return resolveLayout('phone-landscape', ALTAR_FORM, width, height, safeArea).regions;
}

/**
 * The board's frame for this device: from the altar's regions at the chrome's size (the altar
 * and its solve moment fit the board the same way). Null off phones.
 */
export function altarFrame(d: FrameDevice, ui: Pick<Overlay, 'layout'> | null): PhoneFrame | null {
  if (!d.phone) return null;
  const st = ui?.layout.state;
  // No overlay (unit tests): the rails at their set widths.
  if (!st || st.width === 0) return frameFromRegions(d, altarRegions(1000, 400), 1000);
  return frameFromRegions(d, altarRegions(st.width, st.height, st.safeArea), st.width);
}

/** The foot row under the cards: Strike (58 px) 6 px off the screen's foot, FUSE beside it. */
export const ALTAR_FOOT = 64;

/**
 * port-altar-3: the altar's tracks with the column. The board is fitted first (layout.ts
 * phoneLayout, against the rails alone); the column then takes what the board leaves, as a
 * track of its own between `fill` and the right rail:
 *
 *   left | fill | top (title, tray)  | right (the ☰)
 *   left | fill | cardLane (gem, teach and verdict cards; FUSE's line)
 *   left | fill | bottom (FUSE, Strike)
 *
 * `w` is the column's width and `head` the title-and-tray row's height, CSS px.
 */
export function altarForm(col: { w: number; head: number } | null): FormSpec {
  if (!col) return ALTAR_FORM;
  return {
    ...ALTAR_FORM,
    columns: [RAIL_LEFT, 'fill', col.w, RAIL_RIGHT],
    rows: [col.head, 'fill', ALTAR_FOOT],
    areas: ['left fill top right', 'left fill cardLane cardLane', 'left fill bottom bottom'],
  };
}

/** The column's DOM and where the board's fit put it (design px). */
export interface AltarColumn {
  /** Title, "Holding" pill and the tray's counts: the `top` region. */
  head: HTMLElement;
  /** The cards (how-to line, gem and teach card, verdict, read-outs): `cardLane`. */
  cards: HTMLElement;
  /** FUSE's caption, docked under the cards in `cardLane`. */
  caption: { element: HTMLElement; dock(host: HTMLElement | null): void };
  /** The column's left edge and the tray's foot, design px (layout.ts PhoneBand). */
  colL: number;
  headB: number;
}

/** The column's tracks for this chrome (CSS px), or null without a column or a live chrome. */
export function columnTracks(
  st: LayoutState,
  d: FrameDevice,
  col: { colL: number; headB: number },
): { w: number; head: number } | null {
  if (st.width <= 0) return null;
  // The column starts where the board's fit put it, and runs to the right rail.
  const colL = (col.colL + d.bar) / d.cssPx;
  const railX = st.width - st.safeArea.right - RAIL_RIGHT;
  return {
    w: Math.max(0, Math.round(railX - colL)),
    head: Math.max(52, Math.round((col.headB - (d.cropT ?? 0)) / d.cssPx)),
  };
}

/**
 * Puts the altar's tracks on the layout and its rail buttons, column and cards in their regions
 * on a phone (`placeWidgets`); off phones they stay on the frame.
 * Returns the undo for the scene's exit and relayouts.
 */
export function placeAltarChrome(
  ui: Pick<Overlay, 'layout'> | null,
  d: FrameDevice,
  rails: {
    back: HTMLElement;
    undo: HTMLElement;
    clear: HTMLElement;
    turn: HTMLElement;
    strike: HTMLElement;
  },
  col: AltarColumn | null,
): () => void {
  if (!ui) return () => {};
  const tracks = col ? columnTracks(ui.layout.state, d, col) : null;
  ui.layout.setForms({ 'phone-landscape': altarForm(tracks) });
  const at = (el: HTMLElement, region: RegionName, order: number, id: string): RegionWidget => ({
    el,
    place: { 'phone-landscape': region, default: 'hidden' },
    order,
    id,
  });
  const widgets: RegionWidget[] = [
    at(rails.back, 'left', 0, 'lr-altar-back'),
    at(rails.undo, 'left', 1, 'lr-altar-undo'),
    at(rails.clear, 'left', 2, 'lr-altar-clear'),
    at(rails.turn, 'left', 3, 'lr-altar-turn'),
    at(rails.strike, tracks ? 'bottom' : 'right', 9, 'lr-altar-strike'),
  ];
  if (col && tracks) {
    widgets.push(at(col.head, 'top', 0, 'lr-altar-head'));
    widgets.push(at(col.cards, 'cardLane', -1, 'lr-altar-cards'));
  }
  const off = placeWidgets(ui, widgets);
  // FUSE's line docks under the cards; off phones it goes back to its corner.
  const cap =
    col && tracks
      ? ui.layout.dockCaption(col.caption, { 'phone-landscape': 'cardLane', default: 'hidden' })
      : null;
  return () => {
    cap?.remove();
    off();
    ui.layout.setForms(null);
  };
}

/** The rail buttons on the chrome, CSS px (part 1's phone rail, mobile-5/6-board, mobile-7-strike). */
const RAIL = `${CL} .tc-region > :is([data-action="back"], [data-action="undo"], [data-action="clear"])`;
const TURN = `${CL} .tc-region > .lr-altar-turnbtn`;
const STRIKE = `${CL} .tc-region > [data-action="strike"]`;
const ALL = `:is(${RAIL}, ${TURN}, ${STRIKE})`;

export const ALTAR_CHROME_CSS = /* css */ `
/* ── The altar's rails (altar-chrome.ts) ──────────────────────────────────
   Left: Back at the top, Undo and Clear a third of the way down, Turn at the foot (dim until
   there is a gem to turn). Right: the ☰ at the top, Strike at the foot, 12 px in from the edge. */
${RAIL}, ${TURN} {
  position: absolute; left: 3px; width: 44px; height: 44px; min-width: 0; min-height: 0; padding: 0;
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  font-family: var(--tc-font-display, serif); font-size: 11px; line-height: 1.1; letter-spacing: 0;
}
${CL} .tc-region > :is([data-action="back"], [data-action="undo"], [data-action="clear"], .lr-altar-turnbtn) > span {
  display: flex; flex-direction: column; align-items: center; gap: 0;
}
${CL} .tc-region .lr-ph-ico { font-style: normal; font-size: 17px; line-height: 1; color: var(--lr-gold); }
${CL} .tc-region > [data-action="back"] { top: 4px; }
${CL} .tc-region > [data-action="undo"] { top: 34%; }
${CL} .tc-region > [data-action="clear"] { top: calc(34% + 52px); }
${TURN} {
  top: auto; bottom: 6px; height: 52px; border-radius: 10px; cursor: pointer; white-space: nowrap;
  color: #f4e6c4; background: rgba(20,16,12,0.92); border: 1px solid rgba(232,192,106,0.85);
  box-shadow: 0 3px 12px rgba(0,0,0,0.7);
}
${TURN} b { color: var(--lr-gold); font-size: 20px; line-height: 1; }
${TURN}:active { background: rgba(70,56,30,0.95); }
${TURN}[hidden] { display: none; }
${TURN}[data-active] {
  color: #fff6dd; background: rgba(66,50,22,0.96); border-color: var(--lr-gold);
  box-shadow: 0 0 0 1px rgba(232,192,106,0.6), 0 0 12px rgba(232,192,106,0.55);
}
${STRIKE} {
  position: absolute; right: 12px; bottom: 6px; width: auto; min-width: 64px; height: 58px; min-height: 0;
  padding: 0 14px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  font-family: var(--tc-font-display); font-size: 15px; line-height: 1.1; letter-spacing: 0.3px; white-space: nowrap;
}
${STRIKE} > span { display: flex; flex-direction: row; align-items: center; }
${STRIKE} .lr-strike-word { white-space: nowrap; line-height: 1; }
${STRIKE} .lr-strike-n { display: none; }
/* teach-5: "Strike ×2" and its pips, one per strike, lit as each fires (teach-7: unlit again after a miss). */
${STRIKE} .lr-strike-pips { display: inline-flex; gap: 4px; margin-left: 8px; vertical-align: 0; }
${STRIKE} .lr-strike-pips i {
  width: 9px; height: 9px; box-sizing: border-box; border: 2px solid rgba(60,36,8,0.85); background: rgba(60,36,8,0.12); box-shadow: none;
}
${STRIKE} .lr-strike-pips i[data-lit] { background: #3a2406; }
${STRIKE}:not([data-ready]):not(:disabled) { filter: none; }
/* Ready: every gauge's lamp is lit. A bright rim and a slow glow (steady under reduced motion). */
${STRIKE}[data-ready] { animation: lr-strike-ready-rail 1.8s ease-in-out infinite; }
@keyframes lr-strike-ready-rail {
  0%, 100% { box-shadow: 0 0 0 2px rgba(255,236,170,0.85), 0 0 8px 1px rgba(255,214,120,0.45); }
  50% { box-shadow: 0 0 0 3px #fff3c8, 0 0 20px 5px rgba(255,214,120,0.9); }
}
[data-reduced-motion] ${STRIKE}[data-ready] {
  animation: none; box-shadow: 0 0 0 3px #fff3c8, 0 0 16px 4px rgba(255,214,120,0.8);
}
/* Disabled (glyph-truth-2: gate 7 could not tell a dim Undo from a live one): no fill, a dashed
   outline and a muted label, so "nothing to do here" reads at a glance next to a live button's
   solid plate; the label stays legible. */
${ALL}:disabled {
  opacity: 1; filter: none; cursor: default; background: rgba(12,10,9,0.35);
  border: 1px dashed rgba(143,130,107,0.75); color: #7f7462; box-shadow: none;
}
${ALL}:disabled :is(.lr-ph-ico, b) { color: #7f7462; }
${TURN} .lr-turn-what {
  display: block; font-size: 11px; line-height: 1.05;
  color: var(--lr-gold); max-width: 42px; overflow: hidden; text-overflow: clip;
}
${TURN} .lr-turn-what:empty { display: none; }
/* Short phones (an iPhone SE, 320 px under the browser bars): the held header pushes the tray
   and lane lower (ws/port-altar-2 review), so the foot buttons sit 2 px lower and Strike stands
   56 px tall (D-040's floor). A teach card under a two-row tray then clears Strike by 8 px. */
@media (max-height: 330px) {
  ${TURN}, ${STRIKE} { bottom: 4px; }
  ${STRIKE} { height: 56px; }
}
`;
