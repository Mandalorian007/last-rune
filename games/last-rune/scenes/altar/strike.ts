/**
 * Strike timeline: turns a `SimResult` into seconds-based playback for the altar, plus the
 * teaching feedback (why each bolt fizzled). Pure TS, unit-tested.
 *
 * Time model: one sim tick = `tickSeconds`. Strikes play one after another with `pulseGap`
 * seconds between them (the gauges read out, capacitors glow). The verdict lands
 * `verdictDelay` after the last bolt arrives.
 */

import type { FizzleCause, RootFizzle } from '../../content/lines';
import type { MachineResult, Placement, PuzzleDef, SimResult, TraceSegment } from '../../rules';
import { altarDims } from '../../rules';
import type { Cell, GemKind } from '../../rules/types';
import type { CapBeat } from './circuit-model';

export interface TimelineOptions {
  /** Seconds per sim tick. */
  tickSeconds?: number;
  /** Pause between strikes. */
  pulseGap?: number;
  /** Pause after the last bolt before the verdict. */
  verdictDelay?: number;
}

export interface TimedSegment {
  seg: TraceSegment;
  /** Seconds from the start of the strike sequence. */
  t0: number;
  t1: number;
}

export interface PulseSpan {
  start: number;
  /** Last bolt arrives. */
  end: number;
}

/** Something arriving somewhere: energise a gem, light a fizzle, move a gauge. */
export interface Arrival {
  t: number;
  pulse: number;
  cell: Cell;
  end: TraceSegment['end'];
  charge: number;
  colour: GemKind;
  /** Machine index for `end === 'machine'`, else -1. */
  machine: number;
  /** Index into `segments`. */
  seg: number;
}

export interface StrikeTimeline {
  segments: TimedSegment[];
  pulses: PulseSpan[];
  /** Sorted by time. */
  arrivals: Arrival[];
  /** When the verdict shows. */
  verdictAt: number;
}

export const DEFAULT_TICK = 0.15;

export function buildTimeline(result: SimResult, opts: TimelineOptions = {}): StrikeTimeline {
  const tick = opts.tickSeconds ?? DEFAULT_TICK;
  const gap = opts.pulseGap ?? 0.9;
  const verdictDelay = opts.verdictDelay ?? 0.45;
  const n = Math.max(result.pulsesRun, 1);
  const ticks = new Array<number>(n).fill(0);
  for (const s of result.trace) ticks[s.pulse] = Math.max(ticks[s.pulse] ?? 0, s.tick + 1);
  const pulses: PulseSpan[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const start = t;
    const end = start + ticks[i]! * tick;
    pulses.push({ start, end });
    t = end + gap;
  }
  const segments: TimedSegment[] = result.trace.map((seg) => {
    const p = pulses[seg.pulse]!;
    return { seg, t0: p.start + seg.tick * tick, t1: p.start + (seg.tick + 1) * tick };
  });
  const arrivals: Arrival[] = segments.map((s, i) => ({
    t: s.t1,
    pulse: s.seg.pulse,
    cell: s.seg.to,
    end: s.seg.end,
    charge: s.seg.charge,
    colour: s.seg.colour,
    machine:
      s.seg.end === 'machine'
        ? result.machines.findIndex((m) => m.at.x === s.seg.to.x && m.at.y === s.seg.to.y)
        : -1,
    seg: i,
  }));
  arrivals.sort((a, b) => a.t - b.t || a.seg - b.seg);
  const last = pulses[pulses.length - 1]!;
  return { segments, pulses, arrivals, verdictAt: last.end + verdictDelay };
}

/** Why charge was lost (or ran off). Drives the on-board hint (defined with FUSE's quips). */
export type { FizzleCause };

export interface Fizzle {
  cell: Cell;
  pulse: number;
  cause: FizzleCause;
  /** The gem in that socket, if any. */
  gem?: GemKind;
  /** Seconds (when the timeline is given), for staging the marker. */
  t: number;
}

const CAUSE_TEXT: Record<FizzleCause, string> = {
  empty: 'Empty socket: charge lost',
  blocked: 'Carved stone: charge lost',
  ground: 'Charge ran off the altar',
  facing: 'Turned the wrong way: charge lost',
  'odd-split': "Odd charge can't split: lost",
  'gate-alone': 'Gate needs both ports fed on the same strike',
  spent: 'Gem already used this strike',
};

/**
 * teach-8: "on the same strike" only where there is more than one strike (blind review 10:
 * it confused players in one-strike rooms like Relay Tower and Foundry).
 */
function oneStrike(text: string, pulses: number): string {
  return pulses > 1 ? text : text.replace(' on the same strike', '');
}

/** Short UI label for a fizzle cause. */
export function causeText(c: FizzleCause, pulses = 2): string {
  return oneStrike(CAUSE_TEXT[c], pulses);
}

function gemOn(p: PuzzleDef, placements: readonly Placement[], c: Cell): Placement | undefined {
  return (
    p.fixed.find((f) => f.cell.x === c.x && f.cell.y === c.y) ??
    placements.find((f) => f.cell.x === c.x && f.cell.y === c.y)
  );
}

/** Side (N=0,E=1,S=2,W=3) of `to` that a bolt from `from` enters through. */
function entrySide(from: Cell, to: Cell): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Travelling east enters through the west side, etc.
  if (dx > 0) return 3;
  if (dx < 0) return 1;
  if (dy > 0) return 0;
  return 2;
}

/** Every place a bolt died, with the reason, in time order. */
export function fizzles(
  p: PuzzleDef,
  placements: readonly Placement[],
  result: SimResult,
  timeline?: StrikeTimeline,
): Fizzle[] {
  const { w, h } = altarDims(p.altar);
  const out: Fizzle[] = [];
  result.trace.forEach((s, i) => {
    if (s.end !== 'fizzle' && s.end !== 'ground') return;
    const c = s.to;
    const t = timeline?.segments[i]?.t1 ?? 0;
    let cause: FizzleCause;
    let gem: GemKind | undefined;
    if (s.end === 'ground' || c.x < 0 || c.y < 0 || c.x >= w || c.y >= h) cause = 'ground';
    else if (p.blocked.some((b) => b.x === c.x && b.y === c.y)) cause = 'blocked';
    else {
      const g = gemOn(p, placements, c);
      gem = g?.gem;
      const side = entrySide(s.from, c);
      if (!g) cause = 'empty';
      else if (g.gem === 'bend') {
        const accepts = side === g.rot || side === ((g.rot + 1) & 3);
        cause = accepts ? 'spent' : 'facing';
      } else if (g.gem === 'gate') {
        const accepts = side === ((g.rot + 1) & 3) || side === ((g.rot + 3) & 3);
        if (!accepts) cause = 'facing';
        else {
          // A lone input: no other bolt reached the gate's other side this strike.
          const partner = result.trace.some(
            (o) =>
              o !== s &&
              o.pulse === s.pulse &&
              o.to.x === c.x &&
              o.to.y === c.y &&
              entrySide(o.from, c) !== side,
          );
          cause = partner ? 'spent' : 'gate-alone';
        }
      } else if (g.gem === 'split') {
        // One input side, opposite the way it points: rot 0 takes a bolt from the S.
        if (side !== ((g.rot + 2) & 3)) cause = 'facing';
        else cause = s.charge % 2 !== 0 ? 'odd-split' : 'spent';
      } else cause = 'spent';
    }
    out.push({ cell: { x: c.x, y: c.y }, pulse: s.pulse, cause, ...(gem ? { gem } : {}), t });
  });
  out.sort((a, b) => a.t - b.t);
  return out;
}

/**
 * The verdict's headline for a failed attempt, naming the strike on a multi-strike altar. It
 * leads with what happened, as information (D-043: a strike is a free test): "Got 16 on strike
 * 2, needs 8: breaker tripped", "Got 8 each strike, needs 12: 4 short".
 */
export function failText(m: MachineResult, outcome: 'over' | 'under', pulses: number): string {
  const rs = m.readings;
  let k = -1;
  if (outcome === 'over') k = rs.findIndex((r) => r > m.need);
  else for (let i = rs.length - 1; i >= 0 && k < 0; i--) if ((rs[i] ?? 0) > 0) k = i;
  const got = k >= 0 ? rs[k]! : 0;
  const lit = rs.filter((r) => r > 0);
  const when =
    pulses < 2 || k < 0
      ? ''
      : outcome === 'under' && lit.length > 1 && lit.every((r) => r === got)
        ? ' each strike'
        : ` on strike ${k + 1}`;
  if (outcome === 'over') return `Got ${got}${when}, needs ${m.need}: breaker tripped`;
  // Nothing at all arrived (another machine on the altar was fed): a broken path, not a small
  // charge, so don't say "short".
  if (got === 0) return `Got 0, needs ${m.need}: no charge reached this machine`;
  return `Got ${got}${when}, needs ${m.need}: ${m.need - got} short`;
}

/** Which fizzle to explain first: the root cause before its knock-on effects. */
const CAUSE_ORDER: readonly FizzleCause[] = [
  'facing',
  'empty',
  'ground',
  'blocked',
  'odd-split',
  'gate-alone',
  'spent',
];

const CAUSE_HINT: Record<FizzleCause, string> = {
  facing: 'Try: turn the gem at the red mark (R or scroll).',
  empty: 'Try: put a gem in the socket at the red mark.',
  ground: 'Try: lead the charge to the machine before it runs off the altar.',
  blocked: 'Try: route around the carved stone.',
  'odd-split': 'Try: feed the Split an even charge.',
  // One-strike altars drop "on the same strike" (`oneStrike`, teach-8).
  'gate-alone': "Try: feed the Gate's other port on the same strike.",
  spent: 'Try: give each path its own gems. A gem carries charge once per strike.',
};

/** The root cause among an attempt's fizzles (see `CAUSE_ORDER`), if any. */
export function rootCause(causes: readonly FizzleCause[]): FizzleCause | undefined {
  return CAUSE_ORDER.find((c) => causes.includes(c));
}

/**
 * The root fizzle of a failed attempt, for FUSE's quip: the same cause `nextStep` names
 * (undefined when too much charge is the story), with the gem where it first happened.
 */
export function rootFizzle(
  outcome: SimResult['outcome'],
  list: readonly Fizzle[],
): RootFizzle | undefined {
  if (outcome === 'exact' || outcome === 'over') return undefined;
  const cause = rootCause(list.map((f) => f.cause));
  if (!cause) return undefined;
  const f = list.find((x) => x.cause === cause)!;
  return f.gem ? { cause, gem: f.gem } : { cause };
}

/**
 * The red mark the Try line points at: the cell of the root cause's first fizzle. The verdict
 * must never cover it.
 */
export function rootCell(list: readonly Fizzle[]): Cell | undefined {
  const cause = rootCause(list.map((f) => f.cause));
  return cause ? list.find((x) => x.cause === cause)!.cell : undefined;
}

/**
 * What a hint may name (altar-truth, D-027): the gems this altar has, the gems the charge went
 * through, what each Capacitor kept and let out, and the machine the verdict is about. A hint
 * built from this never names a gem the room doesn't have.
 */
export interface HintRoom {
  /** Gem kinds on this altar: fixed in place, or in the tray at the start. */
  readonly gems: ReadonlySet<GemKind>;
  /** Gem kinds the charge went into on this attempt. */
  readonly path: ReadonlySet<GemKind>;
  /** What each Capacitor kept and let out on this attempt. */
  readonly beats: readonly CapBeat[];
  /** The machine the verdict is about, if any. */
  readonly machine?: MachineResult;
  /** Strikes per Strike on this altar (teach-8: the Gate's Try line says "same strike" only past 1). */
  readonly pulses?: number;
}

/** Gem kinds on this altar: fixed in place, or in the tray at the start. */
export function roomGems(p: PuzzleDef): Set<GemKind> {
  const s = new Set<GemKind>();
  for (const f of p.fixed) s.add(f.gem);
  for (const [k, n] of Object.entries(p.tray)) if ((n ?? 0) > 0) s.add(k as GemKind);
  return s;
}

/** Gem kinds the charge went into and was carried on by (passed, kept or held), this attempt. */
export function pathGems(
  p: PuzzleDef,
  placements: readonly Placement[],
  result: SimResult,
): Set<GemKind> {
  const s = new Set<GemKind>();
  for (const seg of result.trace) {
    if (seg.end !== 'gem' && seg.end !== 'store' && seg.end !== 'wait') continue;
    const g = gemOn(p, placements, seg.to);
    if (g) s.add(g.gem);
  }
  return s;
}

/** The `HintRoom` for an attempt. */
export function hintRoom(
  p: PuzzleDef,
  placements: readonly Placement[],
  result: SimResult,
  beats: readonly CapBeat[],
  machine?: MachineResult,
): HintRoom {
  return {
    gems: roomGems(p),
    path: pathGems(p, placements, result),
    beats,
    pulses: p.pulses,
    ...(machine ? { machine } : {}),
  };
}

/** Too much charge: name the real cause where the rules know it, and only gems in the room. */
function overStep(room: HintRoom | undefined): string {
  if (!room) return 'Try: less charge.';
  const halve = room.gems.has('split') ? ' A Split halves it.' : '';
  // A Capacitor let out more than the machine takes: what it stored plus the new charge.
  const m = room.machine;
  const k = m ? m.readings.findIndex((r) => r > m.need) : -1;
  const out = room.beats
    .filter((b) => b.kind === 'release' && (k < 0 || b.pulse === k) && (!m || b.out > m.need))
    .sort((a, b) => b.out - a.out)[0];
  if (out)
    return `Try: feed the Capacitor less. It let out ${out.stored} + ${out.incoming} = ${out.out}.${halve}`;
  if (room.path.has('amplify'))
    return room.gems.has('split')
      ? 'Try: less charge. Skip an Amplify, or halve the charge with a Split.'
      : 'Try: less charge. Skip an Amplify.';
  if (room.path.has('gate')) return `Try: less charge. A Gate adds its two ports together.${halve}`;
  return `Try: less charge.${halve}`;
}

/** Not enough charge: what in this room makes more, or what took it away. */
function underStep(room: HintRoom | undefined): string {
  if (!room) return 'Try: more charge.';
  const m = room.machine;
  // Nothing reached this machine (another one was fed): the path, not the amount.
  if (m?.readings.every((r) => r === 0)) return 'Try: lead a path of gems to this machine too.';
  const amp = room.gems.has('amplify');
  if (room.path.has('split'))
    return amp
      ? 'Try: more charge. A Split halves it; an Amplify doubles it.'
      : 'Try: more charge. A Split halves it.';
  if (amp) return 'Try: more charge. An Amplify doubles it.';
  if (room.gems.has('gate')) return 'Try: more charge. A Gate adds its two ports together.';
  if (room.gems.has('capacitor'))
    return 'Try: more charge. A Capacitor adds what it stored to the next strike.';
  return 'Try: more charge.';
}

/**
 * One short, visible next step under a failed verdict, so a first-timer is never left with
 * only "needs 4, got 0". Fizzles name a concrete fix; otherwise the outcome does. Too much
 * charge is about the amount, so it wins over a stray fizzle. Built from `room` (the gems this
 * altar has and what the charge did), so it never names a gem the room lacks; without a room
 * it names no gem at all.
 */
export function nextStep(
  outcome: SimResult['outcome'],
  causes: readonly FizzleCause[],
  touch = false,
  room?: HintRoom,
): string {
  if (outcome === 'exact') return '';
  if (outcome === 'over') return overStep(room);
  const first = rootCause(causes);
  // A finger has no R key or wheel: name the on-screen Turn control instead.
  if (first === 'facing' && touch) return 'Try: turn the gem at the red mark (↻ Turn).';
  if (first) return oneStrike(CAUSE_HINT[first], room?.pulses ?? 2);
  if (outcome === 'under') return underStep(room);
  return 'Try: lay gems from the storm to the machine.';
}

/**
 * On a multi-strike altar that failed, what happened on each strike in plain words, under the
 * verdict: what each Capacitor stored and let out ("Strike 1: the Capacitor stored 8. Strike 2: the
 * Capacitor let out 8 + 8 = 16."), or, with none in play, that strikes never add up.
 */
export function strikeStory(pulses: number, result: SimResult, beats: readonly CapBeat[]): string {
  if (pulses < 2 || result.outcome === 'exact' || result.outcome === 'dead') return '';
  if (beats.length === 0)
    return result.pulsesRun > 1 ? 'Each strike is checked on its own: strikes never add up.' : '';
  const parts: string[] = [];
  for (let i = 0; i < result.pulsesRun; i++) {
    const said = beats
      .filter((b) => b.pulse === i)
      .map((b) =>
        b.kind === 'keep' ? `stored ${b.stored}` : `let out ${b.stored} + ${b.incoming} = ${b.out}`,
      );
    if (said.length > 0) parts.push(`Strike ${i + 1}: the Capacitor ${said.join(' and ')}.`);
  }
  return parts.join(' ');
}

// ── mobile-7-strike: the verdict and Strike read at a glance (D-040 addendum 5) ──────────────

/**
 * Phones: the verdict's headline for a fizzle, in plain words: what the charge did. The Try
 * line under it (`nextStep`) gives the fix, so cause and fix read together. The short
 * `causeText` stays for the tags over the board on big screens.
 */
const CAUSE_HEAD: Record<FizzleCause, string> = {
  empty: 'The charge hit an empty socket.',
  blocked: 'The charge hit carved stone.',
  ground: 'The charge ran off the altar.',
  facing: 'The charge hit a gem turned the wrong way.',
  'odd-split': "A Split can't halve an odd charge.",
  'gate-alone': 'The Gate got charge in one port only.',
  spent: 'The charge met a gem already used this strike.',
};

export function causeHeadline(c: FizzleCause): string {
  return CAUSE_HEAD[c];
}

/**
 * Phones, multi-strike altars: the verdict's headline in plain words, with the numbers left to
 * the strike line under it (`strikesLine`): "Breaker tripped", "Not enough charge".
 */
export function failHead(m: MachineResult, outcome: 'over' | 'under'): string {
  if (outcome === 'over') return 'Breaker tripped';
  return m.readings.some((r) => r > 0) ? 'Not enough charge' : 'No charge reached this machine';
}

/**
 * A multi-strike gauge's second line, and the verdict's. Three phrases failed blind review
 * ("in one strike", "in either strike", "on strike 1 or 2": read as "on both" or "on either",
 * and nobody could tell whether the other strike may be anything). teach-8 (D-040 add. 11):
 * "on one strike", for any count of strikes, with the rule said once in plain words where
 * Strike ×2 is taught (`ONE_STRIKE_RULE`). The sim's rule (rules/sim.ts): each strike, a gauge
 * that hasn't woken reads that strike alone; exactly its number wakes it (later strikes don't
 * count), more trips it, less does nothing.
 */
export function needNote(_pulses: number): string {
  return 'on one strike';
}

/** teach-8: "strike 1: 0, strike 2: 16": what each strike brought, each one named. */
export function readingsText(rs: readonly number[]): string {
  if (rs.length <= 1) return `${rs[0] ?? 0}`;
  return rs.map((r, i) => `strike ${i + 1}: ${r}`).join(', ');
}

/**
 * Phones, multi-strike altars: what each strike gave the machine the verdict is about, and
 * what it needs: "Strike 1: 0 · 2: 4. Needs 8 on one strike." (as the gauge's card reads it, short
 * enough to leave the Try line room on an SE). teach-8: each number
 * names its strike (blind review 10: "got 0, then 16" didn't say which strike failed). Empty
 * on a one-strike altar (the gauge's "got" says it all).
 */
export function strikesLine(m: MachineResult, pulses: number): string {
  if (pulses < 2 || m.readings.length === 0) return '';
  // A trip names the strike that tripped it, "Strike 2: 16. Needs 8 on one strike." (the card
  // shows every strike; an SE's verdict keeps room for its Try line).
  const trip = m.outcome === 'over' ? m.readings.findIndex((r) => r > m.need) : -1;
  if (trip >= 0)
    return `Strike ${trip + 1}: ${m.readings[trip]}. Needs ${m.need} ${needNote(pulses)}.`;
  const each = m.readings.map((r, i) => (i === 0 ? `Strike 1: ${r}` : `${i + 1}: ${r}`));
  return `${each.join(' \u00b7 ')}. Needs ${m.need} ${needNote(pulses)}.`;
}

/**
 * teach-7 (D-040 add. 10): the verdict names every gauge that missed, not just the one it is
 * about (blind review 9: Capacitor Bay's top gauge, "Needs 2 got 0", went unmentioned). The
 * numbers name each gauge, as its card does: "Also missed: Needs 2, got nothing." Several:
 * "Also missed: Needs 2, got nothing; Needs 6 (strike 1: 4, strike 2: 0)." Empty when only
 * `main` missed.
 */
export function alsoMissed(ms: readonly MachineResult[], main: number): string {
  const rest = ms.filter((m, i) => i !== main && m.outcome !== 'exact');
  if (rest.length === 0) return '';
  const one = (m: MachineResult) =>
    m.readings.every((r) => r === 0)
      ? `Needs ${m.need}, got nothing`
      : m.readings.length > 1
        ? `Needs ${m.need} (${readingsText(m.readings)})`
        : `Needs ${m.need}, got ${readingsText(m.readings)}`;
  return `Also missed: ${rest.map(one).join('; ')}.`;
}

/**
 * A verdict is a title line plus a body (altar-truth): split a one-piece line at its first
 * sentence, "Exactly right." / "Look at it go. Paperwork can wait."
 */
export function verdictParts(text: string): [string, string] {
  const m = /^(.+?[.!?])\s+(.+)$/s.exec(text);
  return m ? [m[1]!, m[2]!] : [text, ''];
}

/**
 * What Strike says it will do (phones): "Strike", or on a multi-strike altar "Strike ×2"
 * (teach-5: one tap sends two strikes; the button's pips light one per strike as they fire, so
 * nothing on the label counts down). teach-7: after a miss it still says "Strike" (it said "Try
 * again", which read as if it wiped the board): a strike is a free test (D-043) and the gems
 * stay where they are. Always one short line.
 */
export function strikeLabel(pulses: number): string {
  if (pulses < 2) return 'Strike';
  return `Strike ×${pulses}`;
}
