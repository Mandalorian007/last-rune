/**
 * Prop palette (art-props). Names follow the pitch's palette list; prop-only materials
 * (brass, iron, ...) are grouped below. Values are sRGB hex; convert with `hex()` from
 * `@engine/render` (linear, HDR multiplier optional).
 *
 * PM reconciles these against `docs/design/art-direction.md` (art-materials). If a value
 * changes there, change it here: every prop shader reads colours through this file.
 */
import { hex, type RGBA } from '@engine/render';

/** The pitch palette (Art direction → Palette). */
export const PITCH = {
  /** Channel. */
  cyan: '#3fe0ff',
  /** Bend. */
  amethyst: '#9b5cff',
  /** Split. */
  magenta: '#ff3fb4',
  /** Amplify. */
  amber: '#ffb03f',
  /** Gate. */
  emerald: '#3fff9a',
  /** Capacitor. */
  ice: '#bfe6ff',
  /** Stone. */
  slate: '#3a4152',
  /** Shadow. */
  ink: '#0b0d14',
  /** Candle. */
  warm: '#ffb35c',
  /** Emboss. */
  gold: '#e8b54a',
  parchment: '#e9d9b0',
  mist: '#9fb4d8',
} as const;

/** Materials that only props use. */
export const PROP = {
  brass: '#c99a3e',
  brassDark: '#6b4a1a',
  brassHi: '#ffe0a0',
  verdigris: '#3f8f7a',
  iron: '#5b5f6b',
  ironDark: '#23252c',
  rust: '#7a3a1c',
  /** FUSE's live eye: deeper and warmer than candle so it reads as "his". */
  eye: '#ffa22e',
  /** Clipboard hardboard. */
  board: '#6b4526',
  /** Gauge dial face. */
  dial: '#efe2bf',
  danger: '#ff3a2a',
} as const;

export type PitchColour = keyof typeof PITCH;

/** Gem colour order used by props that take a gem index (alcove sockets, bolt helpers). */
export const GEM_ORDER = ['cyan', 'amethyst', 'magenta', 'amber', 'emerald', 'ice'] as const;
export type GemColourName = (typeof GEM_ORDER)[number];

export function pitch(name: PitchColour, intensity = 1): RGBA {
  return hex(PITCH[name], intensity);
}

export function prop(name: keyof typeof PROP, intensity = 1): RGBA {
  return hex(PROP[name], intensity);
}

/** Write linear rgb of a hex colour into `out` at `o` (4 floats; w = `w`). */
export function writeHex(out: Float32Array, o: number, value: string, intensity = 1, w = 1): void {
  const c = hex(value, intensity);
  out[o] = c[0];
  out[o + 1] = c[1];
  out[o + 2] = c[2];
  out[o + 3] = w;
}
