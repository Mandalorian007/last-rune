/**
 * polish-9 (D-040 add. 10): where a gauge's needle settles for what arrived, as a fraction of
 * its dial (0 .. MACHINE_GAUGE_MAX, 1 = the gold Needs mark). Before Strike every needle rests
 * at 0 and never moves (D-043); only the run moves it.
 *
 * - exact sits on the mark;
 * - under stays visibly short of it (never in the band the dial draws as exact);
 * - over goes into the red, at least far enough that it never reads as exact, pinned at the
 *   red stop past 125 %.
 */
import { MACHINE_GAUGE_MAX } from '../../shaders/machine-shaders';

/** An under reading never comes nearer the mark than this (the dial's exact band is ±0.05). */
export const NEEDLE_UNDER_MAX = 0.9;
/** An over reading never comes nearer the mark than this: well inside the red zone. */
export const NEEDLE_OVER_MIN = 1.1;

export function needleFor(got: number, need: number): number {
  if (got <= 0 || need <= 0) return 0;
  if (got === need) return 1;
  const f = got / need;
  if (got < need) return Math.min(f, NEEDLE_UNDER_MAX);
  return Math.min(MACHINE_GAUGE_MAX, Math.max(f, NEEDLE_OVER_MIN));
}
