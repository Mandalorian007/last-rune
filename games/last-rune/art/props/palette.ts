/**
 * Prop palette (art-props). Names follow the pitch's palette list. Every shared colour is
 * read from `art/materials/palette.ts` (`PALETTE_HEX`, the single source of colour truth);
 * only prop-only materials (verdigris, rust, FUSE's eye, ...) are defined here.
 * Values are sRGB hex; convert with `hex()` from `@engine/render`.
 */
import { hex, type RGBA } from '@engine/render';
import { PALETTE_HEX } from '../materials/palette';

/** The pitch palette (Art direction -> Palette), named by colour. Derived from PALETTE_HEX. */
export const PITCH = {
  /** Channel. */
  cyan: PALETTE_HEX.channel,
  /** Bend. */
  amethyst: PALETTE_HEX.bend,
  /** Split. */
  magenta: PALETTE_HEX.split,
  /** Amplify. */
  amber: PALETTE_HEX.amplify,
  /** Gate. */
  emerald: PALETTE_HEX.gate,
  /** Capacitor. */
  ice: PALETTE_HEX.capacitor,
  /** Stone. */
  slate: PALETTE_HEX.stone,
  /** Shadow. */
  ink: PALETTE_HEX.ink,
  /** Candle. */
  warm: PALETTE_HEX.candle,
  /** Emboss. */
  gold: PALETTE_HEX.gold,
  parchment: PALETTE_HEX.parchment,
  mist: PALETTE_HEX.mist,
} as const;

/** Materials that only props use (brass and iron come from PALETTE_HEX). */
export const PROP = {
  brass: PALETTE_HEX.brass,
  brassDark: '#6b4a1a',
  brassHi: '#ffe0a0',
  verdigris: '#3f8f7a',
  iron: PALETTE_HEX.iron,
  ironDark: '#23252c',
  rust: '#7a3a1c',
  /** FUSE's live eye: deeper and warmer than candle so it reads as "his". */
  eye: '#ff8a1c',
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

/** Gem kind (rules/types `GemKind`) → pitch colour: Channel cyan, Bend amethyst, ... */
export const GEM_COLOUR = {
  channel: 'cyan',
  bend: 'amethyst',
  split: 'magenta',
  amplify: 'amber',
  gate: 'emerald',
  capacitor: 'ice',
} as const satisfies Record<string, GemColourName>;

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
