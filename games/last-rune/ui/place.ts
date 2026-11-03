/**
 * Placing a small card or tag among things it must not cover (mobile-7-hall). Pure: no DOM.
 *
 * The caller lists candidate boxes in order of preference and the boxes to keep clear, each
 * with a weight (a door's name plate counts more than its art). Every candidate is first slid
 * inside the bounds; the one that covers least wins, the earlier one on a tie.
 */
import type { Rect } from '@engine/ui';

export interface Obstacle {
  readonly rect: Rect;
  /** How much covering one px² of it costs (default 1). */
  readonly weight?: number;
}

export interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Overlap area of two boxes (0 when apart or only touching). */
export function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** True if the boxes overlap by more than `slack` px each way. */
export function intersects(a: Rect, b: Rect, slack = 0): boolean {
  return (
    a.x < b.x + b.width - slack &&
    b.x < a.x + a.width - slack &&
    a.y < b.y + b.height - slack &&
    b.y < a.y + a.height - slack
  );
}

/** The box slid (not resized) to lie inside the bounds; a box larger than them keeps its top-left inside. */
export function clampInto(r: Rect, b: Bounds): Rect {
  const x = Math.max(b.left, Math.min(r.x, b.right - r.width));
  const y = Math.max(b.top, Math.min(r.y, b.bottom - r.height));
  return { x, y, width: r.width, height: r.height };
}

/** What a box costs where it is: the weighted area of every obstacle it covers. */
export function cost(r: Rect, obstacles: readonly Obstacle[]): number {
  let c = 0;
  for (const o of obstacles) c += overlap(r, o.rect) * (o.weight ?? 1);
  return c;
}

/** The best of the candidates once slid into bounds: its index and box. */
export function pickSpot(
  candidates: readonly Rect[],
  obstacles: readonly Obstacle[],
  bounds: Bounds,
): { index: number; rect: Rect; cost: number } | null {
  let best: { index: number; rect: Rect; cost: number } | null = null;
  candidates.forEach((cand, index) => {
    const rect = clampInto(cand, bounds);
    const c = cost(rect, obstacles);
    if (!best || c < best.cost - 1e-6) best = { index, rect, cost: c };
  });
  return best;
}
