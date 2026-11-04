/**
 * What the board shows about the circuit, outside the strike itself. Pure TS, unit-tested.
 *
 * - `previewPath`: while the player edits, the route the first strike would take through the
 *   gems already set (no charge shown), and the open ends: empty sockets the bolt would reach
 *   next. The board reads as a wire being laid, not a grid of holes.
 * - `liveSockets`: sockets near the circuit (the storm's entry, each machine's exit, every gem
 *   and its neighbours, the open ends). Other empty sockets recede into the stone.
 * - `chargeChips`: the hops where the bolt's charge changes (the storm's first hop, after an
 *   Amplify, Split, Gate or Capacitor), so a wrong reading can be traced on the board.
 */
import type { Placement, PuzzleDef, SimResult, TraceSegment } from '../../rules';
import { altarDims } from '../../rules';
import type { Cell } from '../../rules/types';

export interface PathHop {
  from: Cell;
  to: Cell;
}

export interface CircuitPreview {
  /** Hops of strike 1 that land on a gem or a machine, in trace order. */
  hops: PathHop[];
  /** Empty sockets where a strike-1 bolt would fizzle: where the wire goes next. */
  openEnds: Cell[];
}

const key = (c: Cell) => `${c.x},${c.y}`;

function inGrid(c: Cell, w: number, h: number): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < w && c.y < h;
}

/** Route preview for the current board from a simulation of it. */
export function previewPath(
  p: PuzzleDef,
  placements: readonly Placement[],
  result: SimResult,
): CircuitPreview {
  const { w, h } = altarDims(p.altar);
  const occupied = new Set<string>();
  for (const f of p.fixed) occupied.add(key(f.cell));
  for (const q of placements) occupied.add(key(q.cell));
  for (const b of p.blocked) occupied.add(key(b));
  const hops: PathHop[] = [];
  const ends = new Map<string, Cell>();
  for (const s of result.trace) {
    if (s.pulse !== 0) continue;
    if (s.end === 'gem' || s.end === 'store' || s.end === 'wait' || s.end === 'machine') {
      hops.push({ from: s.from, to: s.to });
    } else if (s.end === 'fizzle' && inGrid(s.to, w, h) && !occupied.has(key(s.to))) {
      ends.set(key(s.to), { x: s.to.x, y: s.to.y });
    }
  }
  return { hops, openEnds: [...ends.values()] };
}

/** The socket next to an outside cell (the storm's entry or a machine's exit). */
export function innerCell(c: Cell, w: number, h: number): Cell {
  return { x: Math.max(0, Math.min(w - 1, c.x)), y: Math.max(0, Math.min(h - 1, c.y)) };
}

/**
 * Sockets in play: the storm's entry, each machine's exit, every gem and its four neighbours,
 * and the open ends. Returned as a `cols × rows` mask (row-major).
 */
export function liveSockets(
  p: PuzzleDef,
  placements: readonly Placement[],
  openEnds: readonly Cell[],
  out?: Uint8Array,
): Uint8Array {
  const { w, h } = altarDims(p.altar);
  const mask = out && out.length === w * h ? out : new Uint8Array(w * h);
  mask.fill(0);
  const set = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = 1;
  };
  const around = (c: Cell) => {
    set(c.x, c.y);
    set(c.x + 1, c.y);
    set(c.x - 1, c.y);
    set(c.x, c.y + 1);
    set(c.x, c.y - 1);
  };
  const s = innerCell(p.storm.at, w, h);
  set(s.x, s.y);
  for (const m of p.machines) {
    const c = innerCell(m.at, w, h);
    set(c.x, c.y);
  }
  for (const f of p.fixed) around(f.cell);
  for (const q of placements) around(q.cell);
  for (const c of openEnds) set(c.x, c.y);
  return mask;
}

export interface ChargeChip {
  /** Index into `result.trace`. */
  seg: number;
  pulse: number;
  from: Cell;
  to: Cell;
  charge: number;
}

/**
 * Hops whose charge differs from what arrived at their start cell in the same strike, plus
 * the storm's first hop of each strike. Channels and Bends pass charge on unchanged, so they
 * get no chip; an Amplify that doubles, a Split that halves, a Gate that adds and a Capacitor
 * that releases do.
 */
export function chargeChips(result: SimResult): ChargeChip[] {
  const out: ChargeChip[] = [];
  const trace = result.trace;
  const arrivedAt = (s: TraceSegment): number[] =>
    trace
      .filter(
        (o) =>
          o.pulse === s.pulse &&
          o.to.x === s.from.x &&
          o.to.y === s.from.y &&
          o.tick < s.tick &&
          (o.end === 'gem' || o.end === 'store' || o.end === 'wait'),
      )
      .map((o) => o.charge);
  trace.forEach((s, i) => {
    const incoming = arrivedAt(s);
    if (incoming.length === 0 && s.tick === 0) {
      out.push({ seg: i, pulse: s.pulse, from: s.from, to: s.to, charge: s.charge });
      return;
    }
    if (incoming.length > 0 && !incoming.includes(s.charge)) {
      out.push({ seg: i, pulse: s.pulse, from: s.from, to: s.to, charge: s.charge });
    }
  });
  return out;
}

const SIDE_DX = [0, 1, 0, -1] as const;
const SIDE_DY = [-1, 0, 1, 0] as const;

/**
 * Guide stubs for fixed gems met for the first time: a hop from each side the gem joins (rules
 * section 4). Bend rot r joins sides r and r+1 (N=0, E, S, W); Gate rot r takes the two sides
 * perpendicular to r and outputs r; Split rot r takes side r+2 and outputs both sides
 * perpendicular to r. Hops point into the gem from inputs and out to the outputs; a Bend is
 * two-way, so its hops simply touch both joined sides. Other gems get none.
 */
export function guideHops(p: PuzzleDef, cells: readonly Cell[]): PathHop[] {
  const out: PathHop[] = [];
  for (const c of cells) {
    const f = p.fixed.find((q) => q.cell.x === c.x && q.cell.y === c.y);
    if (!f) continue;
    const at = { x: c.x, y: c.y };
    const side = (s: number) => {
      const i = ((s % 4) + 4) % 4;
      return { x: c.x + SIDE_DX[i]!, y: c.y + SIDE_DY[i]! };
    };
    if (f.gem === 'bend') {
      out.push({ from: side(f.rot), to: at }, { from: at, to: side(f.rot + 1) });
    } else if (f.gem === 'gate') {
      out.push(
        { from: side(f.rot + 1), to: at },
        { from: side(f.rot + 3), to: at },
        { from: at, to: side(f.rot) },
      );
    } else if (f.gem === 'split') {
      out.push(
        { from: side(f.rot + 2), to: at },
        { from: at, to: side(f.rot + 3) },
        { from: at, to: side(f.rot + 1) },
      );
    }
  }
  return out;
}

/** What a Capacitor did on one strike (rules §4): kept the bolt, or let out stored + incoming. */
export interface CapBeat {
  cell: Cell;
  pulse: number;
  kind: 'keep' | 'release';
  /** Charge it held before this bolt (keep: what it keeps now). */
  stored: number;
  /** The bolt that arrived. */
  incoming: number;
  /** Charge that left (release only; 0 on keep). */
  out: number;
  /** Index into `result.trace` of the hop into the Capacitor. */
  seg: number;
}

/**
 * Every Capacitor's keeps and releases, in trace order, read off the simulation: a hop ending
 * `store` on a Capacitor kept its bolt; a hop it handled (`gem`) released stored + incoming. A
 * bolt that fizzles there (already used this strike) is not a beat.
 */
export function capacitorBeats(
  p: PuzzleDef,
  placements: readonly Placement[],
  result: SimResult,
): CapBeat[] {
  const caps = new Set<string>();
  for (const f of p.fixed) if (f.gem === 'capacitor') caps.add(key(f.cell));
  for (const q of placements) if (q.gem === 'capacitor') caps.add(key(q.cell));
  const held = new Map<string, number>();
  const out: CapBeat[] = [];
  result.trace.forEach((s, i) => {
    const k = key(s.to);
    if (!caps.has(k)) return;
    const cell = { x: s.to.x, y: s.to.y };
    if (s.end === 'store') {
      held.set(k, s.charge);
      out.push({
        cell,
        pulse: s.pulse,
        kind: 'keep',
        stored: s.charge,
        incoming: s.charge,
        out: 0,
        seg: i,
      });
    } else if (s.end === 'gem') {
      const stored = held.get(k) ?? 0;
      held.delete(k);
      out.push({
        cell,
        pulse: s.pulse,
        kind: 'release',
        stored,
        incoming: s.charge,
        out: stored + s.charge,
        seg: i,
      });
    }
  });
  return out;
}

/**
 * One line of a Capacitor's read-out: "Strike 1: keeps 8", "Strike 2: 8 + 8 → 16". A bolt
 * kept on the altar's last strike never comes out, and the line says so. teach-5: a release over
 * the gauge's need says so in one short line, "Strike 2 sends 16; needs 8."
 */
export function capBeatText(b: CapBeat, pulses: number, over?: number): string {
  const n = `Strike ${b.pulse + 1}: `;
  if (b.kind === 'release' && over !== undefined)
    return `Strike ${b.pulse + 1} sends ${b.out}; needs ${over}.`;
  if (b.kind === 'release') return `${n}${b.stored} + ${b.incoming} → ${b.out}`;
  return `${n}keeps ${b.stored}${b.pulse >= pulses - 1 ? ', never let out' : ''}`;
}

/**
 * The plan's over-charge (altar-truth): where a Capacitor's preview already shows a number,
 * a release bigger than a machine takes must read as a warning, and so must that gauge. For
 * each release beat (by index) that over-fills a machine on its strike, the need it passes;
 * and the machines it over-fills. Machines with no number on show are left alone (D-040
 * addendum 5: gauges show no amount before Strike).
 */
export function planOver(
  beats: readonly CapBeat[],
  sim: SimResult,
): { beats: Map<number, number>; machines: Set<number> } {
  const out = { beats: new Map<number, number>(), machines: new Set<number>() };
  beats.forEach((b, i) => {
    if (b.kind !== 'release') return;
    sim.machines.forEach((m, j) => {
      const got = m.readings[b.pulse] ?? 0;
      if (got > m.need && b.out > m.need) {
        if (!out.beats.has(i)) out.beats.set(i, m.need);
        out.machines.add(j);
      }
    });
  });
  return out;
}
