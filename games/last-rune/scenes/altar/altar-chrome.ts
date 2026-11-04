/**
 * The phone altar on layout regions (D-041 Phase 2, ws/port-altar-2).
 *
 * In landscape on a phone the altar sets its own tracks on `ctx.chrome` (`layout.setForms`):
 * a left rail (Back at the top, Undo and Clear a third of the way down, Turn at the foot), the
 * open `fill` the board is fitted to, and a right rail (the HUD's ☰ at the top, Strike at the
 * foot). The rail buttons are widgets in CSS px; the board's frame (`PhoneFrame`) is read off
 * the same resolved regions, so the board can never run under a rail and the socket pitch is
 * what the rails leave (part 1's 50 / 58 CSS px columns, so the pitch is unchanged).
 *
 * The tray, the gem card and the hint lane stay on the scaled overlay beside the board: the
 * tray's gems are drawn and hit-tested on the canvas in design px, and the lane hangs under
 * them, so they move with the board's fit rather than with a region.
 */
import {
  type CssChrome,
  defaultForms,
  type FormSpec,
  type LayoutState,
  type Rect,
  resolveLayout,
} from '@thunderclap/engine/ui';
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

/** The altar's regions at a chrome size (the engine's own resolver, so they match the DOM). */
export function altarRegions(width: number, height: number, safeArea?: LayoutState['safeArea']) {
  return resolveLayout('phone-landscape', ALTAR_FORM, width, height, safeArea).regions;
}

/**
 * The board's frame for this device: from the altar's regions at the chrome's size (the altar
 * and its solve moment fit the board the same way). Null off phones.
 */
export function altarFrame(d: FrameDevice, chrome: CssChrome | null): PhoneFrame | null {
  if (!d.phone) return null;
  const st = chrome?.layout.state;
  // No chrome (unit tests): the rails at their set widths.
  if (!st || st.width === 0) return frameFromRegions(d, altarRegions(1000, 400), 1000);
  return frameFromRegions(d, altarRegions(st.width, st.height, st.safeArea), st.width);
}

/**
 * Puts the altar's tracks on the chrome and its rail buttons in their regions while the CSS-px
 * chrome is live (`placeWidgets`); off phones they stay in the scaled overlay's button row.
 * Returns the undo for the scene's exit and relayouts.
 */
export function placeAltarRails(
  chrome: CssChrome | null,
  rails: {
    back: HTMLElement;
    undo: HTMLElement;
    clear: HTMLElement;
    turn: HTMLElement;
    strike: HTMLElement;
  },
): () => void {
  if (!chrome) return () => {};
  chrome.layout.setForms({ 'phone-landscape': ALTAR_FORM });
  const left = (el: HTMLElement, order: number, id: string): RegionWidget => ({
    el,
    place: { 'phone-landscape': 'left', default: 'hidden' },
    order,
    id,
  });
  const off = placeWidgets(chrome, [
    left(rails.back, 0, 'lr-altar-back'),
    left(rails.undo, 1, 'lr-altar-undo'),
    left(rails.clear, 2, 'lr-altar-clear'),
    left(rails.turn, 3, 'lr-altar-turn'),
    {
      el: rails.strike,
      place: { 'phone-landscape': 'right', default: 'hidden' },
      order: 9,
      id: 'lr-altar-strike',
    },
  ]);
  return () => {
    off();
    chrome.layout.setForms(null);
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
  font-family: var(--tc-font-ui); font-size: 11px; line-height: 1.1; letter-spacing: 0;
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
${STRIKE} :is(.lr-strike-n, .lr-strike-pips) { display: none; }
/* A verdict too tall for the column owns the corner until it clears (altar-scene arrangeColumn). */
${STRIKE}[data-yield] { visibility: hidden; }
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
/* Disabled: a 3:1 outline on the dark rail, the label dimmed (not faded away). */
${ALL}:disabled {
  opacity: 1; filter: none; cursor: default; background: rgba(22,20,18,0.92);
  border: 1px solid #8f826b; color: #8f826b; box-shadow: none;
}
${ALL}:disabled :is(.lr-ph-ico, b) { color: #8f826b; }
`;
