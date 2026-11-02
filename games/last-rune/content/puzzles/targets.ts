/**
 * The target difficulty curve (docs/design/difficulty-curve.md). The score is calibrated so that
 * it reads as estimated minutes for a first-time player; `score` is the band the measured score
 * (rules/difficulty.ts) must fall in, `minutes` the design target.
 */
import type { MachineId } from '../../rules/types';

export interface CurveTarget {
  tier: 1 | 2 | 3 | 4;
  minutes: number;
  score: [number, number];
}

const t = (tier: CurveTarget['tier'], minutes: number, lo: number, hi: number): CurveTarget => ({
  tier,
  minutes,
  score: [lo, hi],
});

export const TARGETS: Record<MachineId, CurveTarget> = {
  'intake-desk': t(1, 1, 0, 1.5),
  furnace: t(1, 2, 1.2, 2.8),
  'splitter-mill': t(1, 2, 1.2, 2.8),
  'relay-tower': t(1, 2.5, 1.5, 3.2),
  'conveyor-a': t(1, 3, 2, 3.8),
  'press-unit-4': t(2, 4, 3.2, 4.8),
  'storm-cell-2': t(2, 3.5, 3, 4.5),
  crane: t(2, 4, 3.2, 4.8),
  'boiler-room': t(2, 4, 3.2, 4.8),
  archive: t(2, 4.5, 3.6, 5.4),
  foundry: t(2, 4.5, 3.6, 5.4),
  'capacitor-bay': t(3, 5, 4.2, 6),
  'lift-shaft': t(3, 6, 5.2, 7),
  'roof-array': t(3, 6.5, 5.6, 7.4),
  'control-booth': t(3, 7.5, 6.6, 8.5),
  'the-last-rune': t(4, 10, 8.8, 12),
};
