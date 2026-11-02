/**
 * The Last Rune palette: the single source of colour truth for every scene and material.
 * Documented with linear values and usage rules in `docs/design/art-direction.md`.
 *
 * Hex values are sRGB. Shaders work in linear space, so convert with `hex()` from
 * `@engine/render` (or use the pre-converted `LINEAR` table below).
 */
import { hex, type RGBA } from '@engine/render';
import type { GemKind } from '../../rules/types';

/** sRGB hex for every named colour. */
export const PALETTE_HEX = {
  // Gems: colour is the rune's identity.
  channel: '#3fe0ff', // cyan
  bend: '#9b5cff', // amethyst
  split: '#ff3fb4', // magenta
  amplify: '#ffb03f', // amber
  gate: '#2fe58a', // emerald
  capacitor: '#cfeaff', // ice (pale, near-white blue; read apart from cyan by value + cut)

  // Stone.
  stoneDark: '#1b1f28',
  stone: '#3a4150', // slate
  stoneLight: '#646d7e',
  moss: '#3f5a2c',
  ink: '#0a0c13', // shadow

  // Warm light.
  candle: '#ffb35c',
  flameCore: '#fff1c9',
  flameBase: '#4a7dff',

  // Gold emboss.
  gold: '#e8b64a',
  goldLight: '#fff0b8',
  goldDeep: '#7a4c10',
  amethystShadow: '#3b1f66',

  // Paper, wood, metal.
  parchment: '#e9d9b4',
  parchmentDark: '#b89d68',
  wood: '#5a3820',
  brass: '#c8963e',
  iron: '#4a4d55',

  // Atmosphere.
  mist: '#8fa3c7',
} as const;

export type PaletteName = keyof typeof PALETTE_HEX;

/** Linear RGBA (alpha 1) for every palette entry. Read-only; copy before mutating. */
export const LINEAR: Readonly<Record<PaletteName, Readonly<RGBA>>> = Object.fromEntries(
  Object.entries(PALETTE_HEX).map(([k, v]) => [k, hex(v)]),
) as Record<PaletteName, RGBA>;

/** Gem kind → linear colour. */
export function gemColor(kind: GemKind): Readonly<RGBA> {
  return LINEAR[kind];
}

/** Stable numeric index per gem kind (used to pick the glyph and cut in WGSL). */
export const GEM_INDEX: Readonly<Record<GemKind, number>> = {
  channel: 0,
  bend: 1,
  split: 2,
  amplify: 3,
  gate: 4,
  capacitor: 5,
};
