/**
 * First-appearance teaching (altar-clarity). Pure TS, unit-tested.
 *
 * A gem kind is **new** on an altar when it is on this altar (fixed or in the tray) and on no
 * altar the player has already solved. Its first appearance gets intake-desk's treatment: the
 * socket (fixed gem) or tray slot (tray gem) pulses until the player has struck once or picked
 * it up, its rule card shows for a few seconds (off the board), and FUSE says the gem's nudge
 * line (`gemNudge(gem)` in content/lines.ts, id `nudge.<gem>`) unless it is already in use.
 *
 * A turning gem (Bend, Gate, Split) first met fixed in place is **new to the hand** on the first
 * altar that puts one in the tray: the player can now turn it, so that altar says so.
 */
import { gemNudge } from '../../content/lines';
import { isRotational, type PuzzleDef } from '../../rules';
import type { Cell, Dir, GemKind } from '../../rules/types';

export interface NewGems {
  /** New kinds that sit fixed on this altar, with the first such socket. */
  fixed: { gem: GemKind; cell: Cell }[];
  /** New kinds in the tray (not already introduced as a fixed gem here). */
  tray: GemKind[];
  /** Turning kinds in the tray for the first time, met before only fixed in place. */
  turns: GemKind[];
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
  const inHand = new Set<GemKind>();
  for (const q of solved)
    if (q.id !== p.id)
      for (const [k, n] of Object.entries(q.tray)) if ((n ?? 0) > 0) inHand.add(k as GemKind);
  const tray: GemKind[] = [];
  const turns: GemKind[] = [];
  for (const [k, n] of Object.entries(p.tray)) {
    const g = k as GemKind;
    if ((n ?? 0) <= 0) continue;
    if (!seen.has(g) && !done.has(g)) tray.push(g);
    else if (isRotational(g) && !inHand.has(g)) turns.push(g);
  }
  return { fixed, tray, turns };
}

/**
 * Turnable kinds this altar teaches to turn: a new tray gem that turns, or one first put in
 * the player's hand here (seen fixed before). The turn badge, ↻ mark and Turn line show for
 * these until the player turns one (altar-truth).
 */
export function turnTeaches(news: NewGems): Set<GemKind> {
  return new Set([...news.turns, ...news.tray.filter(isRotational)]);
}

/** New gems FUSE has a nudge line for, fixed first, in the order he should say them. */
export function nudgeGems(news: NewGems): GemKind[] {
  return [...news.fixed.map((f) => f.gem), ...news.tray].filter((g) => !!gemNudge(g));
}

/**
 * The nudges to queue on arrival. On the teaching altar the lit socket, the gem info card and
 * the arrive line already carry the lesson, so FUSE stays quiet there (one card, not four).
 */
export function arrivalNudges(news: NewGems, teaching: boolean): GemKind[] {
  return teaching ? [] : nudgeGems(news);
}

/** The first sentence of a codex rule: the one-line hint pinned beside a new gem. */
export function firstSentence(rule: string): string {
  const m = /^.*?[.!?](?=\s|$)/.exec(rule.trim());
  return m ? m[0] : rule.trim();
}

/**
 * teach-4: one page of a phone's arrival card. A gem page teaches a new piece; the first altar
 * opens with the goal (and what Strike does) and closes with the gold ring; the first altar
 * that strikes more than once says so, and what "in one strike" means, before its pieces.
 */
export type TeachPage =
  | { kind: 'gem'; gem: GemKind; how: 'fixed' | 'tray' | 'turns' }
  | { kind: 'goal' }
  | { kind: 'strikes' }
  | { kind: 'either' }
  | { kind: 'ring' };

/** The phone arrival card's pages, in order: the goal, the strikes, each new piece, the ring. */
export function teachPages(
  rows: readonly { gem: GemKind; how: 'fixed' | 'tray' | 'turns' }[],
  at: { first: boolean; firstMulti: boolean },
): TeachPage[] {
  return [
    ...(at.first ? [{ kind: 'goal' } as const] : []),
    // teach-6: what "in either strike" on the gauges means gets a page of its own.
    ...(at.firstMulti ? [{ kind: 'strikes' } as const, { kind: 'either' } as const] : []),
    ...rows.map((r) => ({ kind: 'gem' as const, gem: r.gem, how: r.how })),
    ...(at.first ? [{ kind: 'ring' } as const] : []),
  ];
}

/** This is the first altar the player meets that strikes more than once. */
export function firstMultiStrike(p: PuzzleDef, solved: readonly PuzzleDef[]): boolean {
  return p.pulses > 1 && !solved.some((q) => q.id !== p.id && q.pulses > 1);
}

/**
 * Gems whose first card carries a picture of the charge going in and out (teach-4): the ones a
 * sentence alone did not teach (blind review 6), on the page where each is first met, fixed on
 * the board. Later pages (it turns, it is in the tray) are short lanes with no room and no need.
 * teach-5: Amplify too (4 in → 8 out, then "A second Amplify doesn't double again.").
 */
export const PICTURED: ReadonlySet<GemKind> = new Set<GemKind>([
  'gate',
  'split',
  'amplify',
  'capacitor',
]);

const TURN: readonly Dir[] = ['N', 'E', 'S', 'W'];
const FROM: Record<Dir, string> = { N: 'above', E: 'the right', S: 'below', W: 'the left' };
const OUT: Record<Dir, string> = {
  N: 'at the top',
  E: 'to the right',
  S: 'at the bottom',
  W: 'to the left',
};

/**
 * teach-6: a fixed Gate's rule with its sides named as its picture shows them (rules.md: rot 0
 * takes charge from the west and east and sends the sum north; charge from the south is lost).
 * Turned once: "Feed it from above and below in the same strike; the sum leaves to the right.
 * From the left: lost."
 */
export function gateSides(rot: number): string {
  const side = (d: Dir) => TURN[(((TURN.indexOf(d) + rot) % 4) + 4) % 4]!;
  const out = side('N');
  const ins = out === 'N' || out === 'S' ? 'left and right' : 'above and below';
  const back = FROM[side('S')];
  return `Feed it from ${ins} in the same strike; the sum leaves ${OUT[out]}. From ${back}: lost.`;
}

export function hasPicture(page: TeachPage): boolean {
  return page.kind === 'gem' && page.how === 'fixed' && PICTURED.has(page.gem);
}
