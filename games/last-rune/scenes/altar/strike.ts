/**
 * Strike timeline: turns a `SimResult` into seconds-based playback for the altar, plus the
 * teaching feedback (why each bolt fizzled). Pure TS, unit-tested.
 *
 * Time model: one sim tick = `tickSeconds`. Strikes play one after another with `pulseGap`
 * seconds between them (the gauges read out, capacitors glow). The verdict lands
 * `verdictDelay` after the last bolt arrives.
 */
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

/** Why a bolt fizzled (or grounded). Drives the on-board hint. */
export type FizzleCause =
  | 'empty' // no gem in the socket
  | 'blocked' // carved stone
  | 'ground' // ran off the altar where no machine stands
  | 'facing' // a Bend/Gate/Split that does not accept that side
  | 'odd-split' // odd charge into a Split
  | 'gate-alone' // a Gate input with no partner
  | 'spent'; // the gem was already used this strike (or two bolts met in it)

export interface Fizzle {
  cell: Cell;
  pulse: number;
  cause: FizzleCause;
  /** Seconds (when the timeline is given), for staging the marker. */
  t: number;
}

const CAUSE_TEXT: Record<FizzleCause, string> = {
  empty: 'Empty socket: the bolt fizzled',
  blocked: 'Carved stone: the bolt fizzled',
  ground: 'Ran off the altar',
  facing: 'Faces the wrong way',
  'odd-split': 'Odd charge cannot split',
  'gate-alone': 'Gate needs both inputs',
  spent: 'Gem already spent this strike',
};

/** Short UI label for a fizzle cause. */
export function causeText(c: FizzleCause): string {
  return CAUSE_TEXT[c];
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
    if (s.end === 'ground' || c.x < 0 || c.y < 0 || c.x >= w || c.y >= h) cause = 'ground';
    else if (p.blocked.some((b) => b.x === c.x && b.y === c.y)) cause = 'blocked';
    else {
      const g = gemOn(p, placements, c);
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
    out.push({ cell: { x: c.x, y: c.y }, pulse: s.pulse, cause, t });
  });
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Gem kinds the bolt actually passed through (for FUSE's gem-specific reactions). */
export function gemsUsed(result: SimResult): GemKind[] {
  const set = new Set<GemKind>();
  for (const s of result.trace) if (s.tick > 0) set.add(s.colour);
  return [...set];
}

/**
 * The verdict's headline for a failed attempt, naming the strike on a multi-strike altar:
 * "Breaker tripped on strike 2: needs 8, got 16", "Not enough: needs 12, got 8 each strike".
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
  if (outcome === 'over') return `Breaker tripped${when}: needs ${m.need}, got ${got}`;
  // Nothing at all arrived (another machine on the altar was fed): a broken path, not a small
  // charge, so don't say "not enough".
  if (got === 0) return `No charge reached this machine: needs ${m.need}, got 0`;
  return `Not enough: needs ${m.need}, got ${got}${when}`;
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
  ground: 'Try: steer the bolt to the machine before it runs off the altar.',
  blocked: 'Try: route around the carved stone.',
  'odd-split': 'Try: feed the Split an even charge.',
  'gate-alone': "Try: bring a second bolt into the Gate's other side.",
  spent: 'Try: give each bolt its own gems. A gem carries one bolt per strike.',
};

/**
 * One short, visible next step under a failed verdict, so a first-timer is never left with
 * only "needs 4, got 0". Fizzles name a concrete fix; otherwise the outcome does. Too much
 * charge is about the amount, so it wins over a stray fizzle.
 */
export function nextStep(outcome: SimResult['outcome'], causes: readonly FizzleCause[]): string {
  if (outcome === 'exact') return '';
  if (outcome === 'over') return 'Try: less charge. Skip an Amplify, or halve it with a Split.';
  const first = CAUSE_ORDER.find((c) => causes.includes(c));
  if (first) return CAUSE_HINT[first];
  if (outcome === 'under') return 'Try: more charge. An Amplify doubles it.';
  return 'Try: lay gems from the storm to the machine.';
}

/**
 * On a multi-strike altar that failed, what happened on each strike in plain words, under the
 * verdict: what each Capacitor kept and let out ("Strike 1: the Capacitor kept 8. Strike 2: the
 * Capacitor let out 8 + 8 = 16."), or, with none in play, that strikes never add up.
 */
export function strikeStory(pulses: number, result: SimResult, beats: readonly CapBeat[]): string {
  if (pulses < 2 || result.outcome === 'exact' || result.outcome === 'dead') return '';
  if (beats.length === 0)
    return result.pulsesRun > 1 ? 'Each strike is read on its own: strikes never add up.' : '';
  const parts: string[] = [];
  for (let i = 0; i < result.pulsesRun; i++) {
    const said = beats
      .filter((b) => b.pulse === i)
      .map((b) =>
        b.kind === 'keep' ? `kept ${b.stored}` : `let out ${b.stored} + ${b.incoming} = ${b.out}`,
      );
    if (said.length > 0) parts.push(`Strike ${i + 1}: the Capacitor ${said.join(' and ')}.`);
  }
  return parts.join(' ');
}
