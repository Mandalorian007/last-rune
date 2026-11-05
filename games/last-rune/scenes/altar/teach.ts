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
import { GATE_RULE, GATE_RULE_ONE } from '../../content/codex';
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
  /**
   * teach-8 (D-040 add. 11, C): kinds already taught but never yet in the player's hand on a
   * solved altar (Splitter Mill's Split after Conveyor A's, the first Amplify in the tray, a
   * later Capacitor). Their rule shows again, before FUSE's line, with the first fixed socket
   * where the gem is built in here.
   */
  remind: { gem: GemKind; cell?: Cell }[];
}

function kindsOf(p: PuzzleDef): Set<GemKind> {
  const s = new Set<GemKind>();
  for (const f of p.fixed) s.add(f.gem);
  for (const [k, n] of Object.entries(p.tray)) if ((n ?? 0) > 0) s.add(k as GemKind);
  return s;
}

/**
 * Gems this altar introduces, given the puzzles already solved and the gems already taught
 * (`taught`: gem → the altar whose card showed it, from the save's `codex.taught`). A gem is
 * taught once, wherever it is first met, in whatever order the hall is played (teach-8); the
 * altar that taught it keeps teaching it until it is solved. Fixed gems are listed in the order
 * they appear; the tray kinds in tray order.
 */
export function newGems(
  p: PuzzleDef,
  solved: readonly PuzzleDef[],
  taught: Readonly<Record<string, string>> = {},
): NewGems {
  const seen = new Set<GemKind>();
  for (const q of solved) if (q.id !== p.id) for (const k of kindsOf(q)) seen.add(k);
  for (const [g, at] of Object.entries(taught)) if (at !== p.id) seen.add(g as GemKind);
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
  const told = new Set<GemKind>([...done, ...tray, ...turns]);
  const remind: NewGems['remind'] = [];
  for (const g of kindsOf(p)) {
    // A Capacitor where there is only one strike never lets out: say so, even to a player who
    // has held one (Control Booth's red herring).
    const oneStrikeCap = g === 'capacitor' && p.pulses <= 1;
    if (told.has(g) || (inHand.has(g) && !oneStrikeCap)) continue;
    const f = p.fixed.find((x) => x.gem === g);
    remind.push(f ? { gem: g, cell: { x: f.cell.x, y: f.cell.y } } : { gem: g });
  }
  return { fixed, tray, turns, remind };
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
  | { kind: 'gem'; gem: GemKind; how: 'fixed' | 'tray' | 'turns'; again?: boolean }
  | { kind: 'goal' }
  | { kind: 'strikes' }
  | { kind: 'either' }
  | { kind: 'ring' };

/** One row of the arrival card: a gem, how it is met here, and whether it is a reminder. */
export interface TeachRow {
  gem: GemKind;
  how: 'fixed' | 'tray' | 'turns';
  /** teach-8: taught before, never yet in the player's hand (`NewGems.remind`). */
  again?: boolean;
}

/** The arrival card's gem rows: new fixed gems, new tray gems, new to turn, then reminders. */
export function teachRows(news: NewGems): TeachRow[] {
  return [
    ...news.fixed.map((f) => ({ gem: f.gem, how: 'fixed' as const })),
    ...news.tray.map((gem) => ({ gem, how: 'tray' as const })),
    ...news.turns.map((gem) => ({ gem, how: 'turns' as const })),
    ...news.remind.map((r) => ({
      gem: r.gem,
      how: r.cell ? ('fixed' as const) : ('tray' as const),
      again: true,
    })),
  ];
}

/** The phone arrival card's pages, in order: the goal, the strikes, each new piece, the ring. */
export function teachPages(
  rows: readonly TeachRow[],
  at: { first: boolean; firstMulti: boolean },
): TeachPage[] {
  return [
    ...(at.first ? [{ kind: 'goal' } as const] : []),
    // teach-6: what the gauges' "on one strike" means gets a page of its own (teach-8 wording).
    ...(at.firstMulti ? [{ kind: 'strikes' } as const, { kind: 'either' } as const] : []),
    ...rows.map((r) => ({
      kind: 'gem' as const,
      gem: r.gem,
      how: r.how,
      ...(r.again ? { again: true } : {}),
    })),
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
 * the board. teach-5: Amplify too (4 in → 8 out, then "A second Amplify doesn't double again.").
 * teach-8 (D-040 add. 11, C): wherever the gem is first seen, fixed or in the tray, and on a
 * reminder (blind review 10 met Splitter Mill's Split with words alone). A "turns" page is a
 * gem seen before with its picture (Relay Tower always opens before Foundry); it stays short.
 */
export const PICTURED: ReadonlySet<GemKind> = new Set<GemKind>([
  'gate',
  'split',
  'amplify',
  'capacitor',
]);

const TURN: readonly Dir[] = ['N', 'E', 'S', 'W'];

/**
 * A fixed Gate's card: the codex's one-sentence `GATE_RULE` (teach-7), then where its ports are
 * as its (turned) picture shows them (rules.md: rot 0 takes charge from the west and east and
 * sends the sum north). The arrow is in the picture and the sentence; naming its side too made
 * the SE's card clip. Turned once: "... Ports: above and below."
 * teach-8 (D-040 add. 11, E): on an altar that strikes once, "same strike" reads as a second
 * condition with nothing to compare; it says "Feed both round ports, left and right; their sum
 * leaves by the arrow. One port alone: lost." Multi-strike altars keep `GATE_RULE`.
 */
export function gateSides(rot: number, pulses = 2): string {
  const side = (d: Dir) => TURN[(((TURN.indexOf(d) + rot) % 4) + 4) % 4]!;
  const out = side('N');
  const ins = out === 'N' || out === 'S' ? 'left and right' : 'above and below';
  if (pulses <= 1) return GATE_RULE_ONE.replace('round ports;', `round ports, ${ins};`);
  return `${GATE_RULE} Ports: ${ins}.`;
}

export function hasPicture(page: TeachPage): boolean {
  return page.kind === 'gem' && page.how !== 'turns' && PICTURED.has(page.gem);
}
