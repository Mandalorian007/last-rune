/**
 * First-appearance teaching (altar-clarity). Pure TS, unit-tested.
 *
 * A gem kind is **new** on an altar when it is on this altar (fixed or in the tray) and on no
 * altar the player has already solved. Its first appearance gets intake-desk's treatment: the
 * socket (fixed gem) or tray slot (tray gem) pulses until the player has struck once or picked
 * it up, the gem's rule shows beside it, and FUSE says the gem's nudge line
 * (`gemNudge(gem)` in content/lines.ts, id `nudge.<gem>`; Channel has none).
 */
import { gemNudge } from '../../content/lines';
import type { PuzzleDef } from '../../rules';
import type { Cell, GemKind } from '../../rules/types';

export interface NewGems {
  /** New kinds that sit fixed on this altar, with the first such socket. */
  fixed: { gem: GemKind; cell: Cell }[];
  /** New kinds in the tray (not already introduced as a fixed gem here). */
  tray: GemKind[];
}

function kindsOf(p: PuzzleDef): Set<GemKind> {
  const s = new Set<GemKind>();
  for (const f of p.fixed) s.add(f.gem);
  for (const [k, n] of Object.entries(p.tray)) if ((n ?? 0) > 0) s.add(k as GemKind);
  return s;
}

/**
 * Gems this altar introduces, given the puzzles already solved. Fixed gems are listed in the
 * order they appear; the tray kinds in tray order.
 */
export function newGems(p: PuzzleDef, solved: readonly PuzzleDef[]): NewGems {
  const seen = new Set<GemKind>();
  for (const q of solved) if (q.id !== p.id) for (const k of kindsOf(q)) seen.add(k);
  const fixed: NewGems['fixed'] = [];
  const done = new Set<GemKind>();
  for (const f of p.fixed) {
    if (seen.has(f.gem) || done.has(f.gem)) continue;
    done.add(f.gem);
    fixed.push({ gem: f.gem, cell: { x: f.cell.x, y: f.cell.y } });
  }
  const tray: GemKind[] = [];
  for (const [k, n] of Object.entries(p.tray)) {
    const g = k as GemKind;
    if ((n ?? 0) > 0 && !seen.has(g) && !done.has(g)) tray.push(g);
  }
  return { fixed, tray };
}

/** New gems FUSE has a nudge line for, fixed first, in the order he should say them. */
export function nudgeGems(news: NewGems): GemKind[] {
  return [...news.fixed.map((f) => f.gem), ...news.tray].filter((g) => !!gemNudge(g));
}
