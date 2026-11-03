/**
 * Phone and touch modes (D-039). Two flags on the overlay root, both recomputed live:
 *
 * - `data-phone`: the 1920×1080 design is shown so small (under PHONE_SCALE CSS px per design
 *   px, i.e. a phone in landscape) that design-sized text and buttons would be unreadable and
 *   untappable. The phone gets its own layout (mobile-2: board first, chrome in the side bars,
 *   ui/phone-styles.ts). Sets `--lr-text-min` (12 CSS px in design px; every scaled font size
 *   floors at it, see text-scale.ts), `--lr-tap` (44 CSS px in design px: hit areas only, never
 *   drawn boxes), `--lr-css-px` (one CSS px in design px) and `--lr-bar` (the letterbox bar
 *   beside the 16:9 canvas, design px, where the phone layout puts its buttons) and `--lr-third`
 *   (a third of the screen width, design px: the widest a transient card grows). Desktop and
 *   tablets never get it.
 * - `data-touch`: the player's last input was a finger. Key caps hide and hints switch to
 *   touch words. A mouse press or a key switches it off again.
 */
import { isTouchOnly, type PointerKind, watchPointerKind } from '@thunderclap/engine/platform';

/** Below this overlay scale the game is on a phone-sized screen. Phones are 0.33–0.40, tablets 0.53+. */
export const PHONE_SCALE = 0.45;
/** Smallest text on a phone, CSS px (body text; games run 11–13 on phones). */
export const PHONE_TEXT_MIN = 12;
/** Smallest hit area on a phone, CSS px. */
export const PHONE_TAP = 44;

export interface DeviceMode {
  /** A phone-sized screen (see PHONE_SCALE). */
  readonly phone: boolean;
  /** The last input was touch. */
  readonly touch: boolean;
  /** Design px per CSS px (1 / overlay scale). */
  readonly cssPx: number;
  /** Width of each letterbox bar beside the canvas, design px (0 when it fills the width). */
  readonly bar: number;
  /**
   * Design px cut off the top and bottom of the canvas when a phone scene fills the width
   * (D-040; 0 otherwise): the visible band is `[cropT, 1080 - cropB]`.
   */
  readonly cropT: number;
  readonly cropB: number;
  onChange(fn: () => void): () => void;
}

export interface DeviceModeController extends DeviceMode {
  /**
   * `barCss`: the letterbox bar each side of the canvas, CSS px. `crop` (title and hall on
   * phones, where the art fills the width): the contain fit's scale, which decides phone-ness so
   * filling never flips the mode, and the CSS px cut off the top and bottom of the canvas.
   */
  setScale(scale: number, barCss?: number, crop?: CropInfo): void;
  destroy(): void;
}

/** See `DeviceModeController.setScale`. */
export interface CropInfo {
  readonly fitScale: number;
  readonly top: number;
  readonly bottom: number;
}

export function createDeviceMode(root: HTMLElement): DeviceModeController {
  let phone = false;
  let touch = isTouchOnly();
  let cssPx = 1;
  let bar = 0;
  let cropT = 0;
  let cropB = 0;
  const subs = new Set<() => void>();
  const emit = () => {
    for (const f of subs) f();
  };
  const applyTouch = () => root.toggleAttribute('data-touch', touch);
  applyTouch();
  const unwatch = watchPointerKind((k: PointerKind) => {
    const t = k === 'touch';
    if (t === touch) return;
    touch = t;
    applyTouch();
    emit();
  }, root.ownerDocument);

  return {
    get phone() {
      return phone;
    },
    get touch() {
      return touch;
    },
    get cssPx() {
      return cssPx;
    },
    get bar() {
      return bar;
    },
    get cropT() {
      return cropT;
    },
    get cropB() {
      return cropB;
    },
    onChange(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    setScale(scale, barCss = 0, crop) {
      const s = scale > 0 ? scale : 1;
      const p = (crop && crop.fitScale > 0 ? crop.fitScale : s) < PHONE_SCALE;
      const ct = p && crop ? Math.max(0, Math.round(crop.top / s)) : 0;
      const cb = p && crop ? Math.max(0, Math.round(crop.bottom / s)) : 0;
      // Design px hidden above and below the screen: top- and bottom-anchored chrome moves in by it.
      root.style.setProperty('--lr-crop-t', `${ct}px`);
      root.style.setProperty('--lr-crop-b', `${cb}px`);
      root.toggleAttribute('data-fill', ct + cb > 0);
      const b = Math.max(0, Math.round(barCss / s));
      const resized = Math.abs(cssPx - 1 / s) > 1e-3 || b !== bar || ct !== cropT || cb !== cropB;
      cssPx = 1 / s;
      bar = b;
      cropT = ct;
      cropB = cb;
      if (p) {
        root.style.setProperty('--lr-text-min', `${(PHONE_TEXT_MIN / s).toFixed(1)}px`);
        root.style.setProperty('--lr-tap', `${(PHONE_TAP / s).toFixed(1)}px`);
        root.style.setProperty('--lr-css-px', `${(1 / s).toFixed(3)}px`);
        root.style.setProperty('--lr-bar', `${b}px`);
        // A third of the screen, less a margin: the widest any transient card may grow.
        const vw = root.ownerDocument.defaultView?.innerWidth ?? 0;
        root.style.setProperty('--lr-third', `${Math.round((vw / 3 - 6) / s)}px`);
      } else {
        root.style.removeProperty('--lr-text-min');
        root.style.removeProperty('--lr-tap');
        root.style.removeProperty('--lr-css-px');
        root.style.removeProperty('--lr-bar');
        root.style.removeProperty('--lr-third');
      }
      if (p === phone && !(p && resized)) return;
      phone = p;
      root.toggleAttribute('data-phone', p);
      emit();
    },
    destroy() {
      unwatch();
      subs.clear();
    },
  };
}
