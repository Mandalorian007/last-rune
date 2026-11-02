/**
 * The target difficulty curve (docs/design/difficulty-curve.md). The score is calibrated to a
 * by-hand estimate of first-time minutes; `score` is the band the measured score
 * (rules/difficulty.ts) must fall in. Each puzzle's own `minutes` is the design estimate on the
 * pitch's scale (about 1.25 × score) until Phase 2 playtests rescale it; the shape of the
 * curve is the contract.
 */
import type { MachineId } from '../../rules/types';

export interface CurveTarget {
  tier: 1 | 2 | 3 | 4;
  /** Band the measured score must fall in. */
  score: [number, number];
}

const t = (tier: CurveTarget['tier'], lo: number, hi: number): CurveTarget => ({
  tier,
  score: [lo, hi],
});

export const TARGETS: Record<MachineId, CurveTarget> = {
  'intake-desk': t(1, 0.5, 1.5),
  furnace: t(1, 1, 2.2),
  'splitter-mill': t(1, 1.5, 2.8),
  'relay-tower': t(1, 1.5, 2.8),
  'conveyor-a': t(1, 1.8, 3.1),
  'press-unit-4': t(2, 2.4, 3.6),
  'storm-cell-2': t(2, 2.4, 3.6),
  crane: t(2, 3, 4.2),
  'boiler-room': t(2, 3, 4.2),
  archive: t(2, 3.4, 4.6),
  foundry: t(2, 3, 4.2),
  'capacitor-bay': t(3, 3.5, 4.8),
  'lift-shaft': t(3, 4.1, 5.3),
  'roof-array': t(3, 4.5, 5.7),
  'control-booth': t(3, 4.8, 6.1),
  'the-last-rune': t(4, 5.9, 7.5),
};
