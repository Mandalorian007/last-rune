/**
 * The outline of each gem's cut, as `g_cut` in `shaders/gem-wgsl.ts` draws it (keep the two in
 * step; gem-cut.test.ts checks the numbers against the shader). Used to size things that hug a
 * gem's corners: the held tray gem's ring follows the gem's own shape (held-gem).
 */
import type { GemKind } from '../rules/types';

interface Cut {
  sides: number;
  /** Angle of the first vertex (radians, y down). */
  phase: number;
  scale: readonly [number, number];
  offset: readonly [number, number];
}

const TAU = Math.PI * 2;

export const GEM_CUT: Readonly<Record<GemKind, Cut>> = {
  channel: { sides: 6, phase: -TAU / 4, scale: [0.66, 1], offset: [0, 0] },
  bend: { sides: 4, phase: TAU / 8, scale: [1.08, 1.08], offset: [0, 0] },
  split: { sides: 8, phase: 0, scale: [1.02, 1.02], offset: [0, 0] },
  amplify: { sides: 12, phase: 0, scale: [0.97, 0.97], offset: [0, 0] },
  gate: { sides: 5, phase: -TAU / 4, scale: [1, 1], offset: [0, 0.06] },
  capacitor: { sides: 6, phase: 0, scale: [1, 0.9], offset: [0, 0] },
};

/**
 * The cut's corners in gem space (-1..1, y down, the gem's diameter spans 2), unturned. Each
 * point is pushed out from the centre by `grow` (gem-space units), so a ring can sit just
 * outside the gem.
 */
export function gemCutPoints(kind: GemKind, grow = 0): [number, number][] {
  const c = GEM_CUT[kind];
  const out: [number, number][] = [];
  for (let i = 0; i < c.sides; i++) {
    const a = c.phase + (i * TAU) / c.sides;
    const x = Math.cos(a) * c.scale[0] - c.offset[0];
    const y = Math.sin(a) * c.scale[1] - c.offset[1];
    const r = Math.hypot(x, y);
    const k = r > 0 ? (r + grow) / r : 1;
    out.push([x * k, y * k]);
  }
  return out;
}
