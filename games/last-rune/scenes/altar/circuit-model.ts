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
