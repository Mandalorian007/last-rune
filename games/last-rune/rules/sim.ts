/**
 * Charge simulation. Pure and deterministic. Spec: docs/design/rules.md.
 *
 * The same core (`runCore`) drives `simulate()` and the solver: the solver runs it on a
 * partially-decided board and the core stops at the first socket it needs a decision for.
 */
import {
  altarDims,
  DIRS,
  DX,
  DY,
  dirIndex,
  type Placement,
  type PuzzleDef,
  stormCharge,
} from './model';
import type { Cell, GemKind } from './types';

export type Outcome = 'dead' | 'under' | 'exact' | 'over';

/** What happened to a bolt at the end of a hop. */
export type SegmentEnd = 'gem' | 'store' | 'wait' | 'fizzle' | 'machine' | 'ground';

/** One hop of a bolt, for the renderer. */
export interface TraceSegment {
  from: Cell;
  to: Cell;
  charge: number;
  /** Colour of the ribbon: the gem kind the bolt last passed (`channel` straight out of the storm). */
  colour: GemKind;
  /** Strike index, from 0. */
  pulse: number;
  /** Start tick within the strike. */
  tick: number;
  /** Normalised start/end time over the whole attempt, in [0, 1]. */
  t0: number;
  t1: number;
  end: SegmentEnd;
}

export interface MachineResult {
  at: Cell;
  need: number;
  outcome: Outcome;
  /** Reading per strike that actually ran. */
  readings: number[];
  /** Strike on which it woke, or -1. */
  wokeOn: number;
}

export interface SimResult {
  outcome: Outcome;
  machines: MachineResult[];
  trace: TraceSegment[];
  /** Strikes that actually ran (the storm stops early on success or a tripped breaker). */
  pulsesRun: number;
  /** Total ticks, strikes laid end to end with one tick of rest between them. */
  duration: number;
}

// ---------------------------------------------------------------------------
// Board encoding (shared with the solver)

export const GEM_CODE: Record<GemKind, number> = {
  channel: 0,
  bend: 1,
  split: 2,
  amplify: 3,
  gate: 4,
  capacitor: 5,
};
export const CODE_GEM: readonly GemKind[] = [
  'channel',
  'bend',
  'split',
  'amplify',
  'gate',
  'capacitor',
];
export const C_CHANNEL = 0;
export const C_BEND = 1;
export const C_SPLIT = 2;
export const C_AMPLIFY = 3;
export const C_GATE = 4;
export const C_CAPACITOR = 5;
/** Socket states below 0. */
export const S_EMPTY = -1;
export const S_BLOCKED = -2;
/** Solver only: not decided yet. */
export const S_UNKNOWN = -3;
/** Solver only: bolts have bounced off it so far; it is empty or a Bend/Gate facing away. */
export const S_DEFERRED = -4;

export interface Board {
  w: number;
  h: number;
  /** Gem code (>= 0) or socket state (< 0). */
  kind: Int8Array;
  rot: Int8Array;
  /** S_DEFERRED only: bitmask of sides bolts have bounced off. */
  excl: Uint8Array;
}

/** Sides (bitmask over N=1,E=2,S=4,W=8) through which a gem accepts a bolt. */
export function acceptMask(code: number, rot: number): number {
  if (code === C_BEND) return (1 << rot) | (1 << ((rot + 1) & 3));
  if (code === C_GATE) return (1 << ((rot + 1) & 3)) | (1 << ((rot + 3) & 3));
  return 15;
}

export function emptyBoard(p: PuzzleDef, fill: number): Board {
  const { w, h } = altarDims(p.altar);
  const kind = new Int8Array(w * h).fill(fill);
  const rot = new Int8Array(w * h);
  for (const b of p.blocked) kind[b.y * w + b.x] = S_BLOCKED;
  for (const f of p.fixed) {
    const i = f.cell.y * w + f.cell.x;
    kind[i] = GEM_CODE[f.gem];
    rot[i] = f.gem === 'bend' || f.gem === 'gate' ? f.rot : 0;
  }
  return { w, h, kind, rot, excl: new Uint8Array(w * h) };
}

// ---------------------------------------------------------------------------
// Core

/** Ancestry: which sockets a bolt's charge passed through (bitset, up to 96 sockets). */
type Anc = readonly [number, number, number];
const NO_ANC: Anc = [0, 0, 0];
function ancWith(a: Anc, i: number): Anc {
  const r: [number, number, number] = [a[0], a[1], a[2]];
  r[i >> 5] = (r[i >> 5]! | (1 << (i & 31))) >>> 0;
  return r;
}
function ancOr(a: Anc, b: Anc): Anc {
  return [(a[0] | b[0]) >>> 0, (a[1] | b[1]) >>> 0, (a[2] | b[2]) >>> 0];
}
export function ancHas(a: Anc, i: number): boolean {
  return ((a[i >> 5]! >>> (i & 31)) & 1) === 1;
}

interface Bolt {
  x: number;
  y: number;
  /** Travel direction index. */
  d: number;
  charge: number;
  amber: boolean;
  anc: Anc;
  /** Index into the raw trace, or -1. */
  seg: number;
}

interface RawSeg {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  charge: number;
  colour: GemKind;
  pulse: number;
  tick: number;
  end: SegmentEnd;
}

export interface CoreDecision {
  status: 'decide';
  cell: number;
  /** Sides (bitmask) of the bolts asking. */
  sides: number;
  /** Charges of the asking bolts (for pruning, e.g. odd charge into a Split). */
  charges: number[];
  /** Some machine already got more than it needs this strike. */
  overSoFar: boolean;
  /** Machines awake after completed strikes. */
  awake: boolean[];
}

export interface CoreDone {
  status: 'done';
  outcome: Outcome;
  machines: MachineResult[];
  raw: RawSeg[];
  pulseTicks: number[];
  /** Sockets whose charge reached a machine on the strike it woke. */
  useful: Anc;
}

export type CoreResult = CoreDecision | CoreDone;

interface GateState {
  a: Bolt | null;
  b: Bolt | null;
  fired: boolean;
}

export function runCore(p: PuzzleDef, board: Board, wantTrace: boolean): CoreResult {
  const { w, h, kind, rot } = board;
  const n = w * h;
  const machines = p.machines;
  const m = machines.length;
  const awake = new Array<boolean>(m).fill(false);
  const tripped = new Array<boolean>(m).fill(false);
  const ever = new Array<boolean>(m).fill(false);
  const readings: number[][] = machines.map(() => []);
  const wokeOn = new Array<number>(m).fill(-1);
  let useful: Anc = NO_ANC;
  const raw: RawSeg[] = [];
  const pulseTicks: number[] = [];

  // Machine lookup by outside position.
  const machineAt = new Map<number, number>();
  const outKey = (x: number, y: number) => (y + 1) * (w + 2) + (x + 1);
  for (let i = 0; i < m; i++) machineAt.set(outKey(machines[i]!.at.x, machines[i]!.at.y), i);

  // Capacitor charge persists across strikes.
  const capFull = new Uint8Array(n);
  const capCharge = new Int32Array(n);
  const capAmber = new Uint8Array(n);
  const capAnc: Anc[] = [];

  const used = new Uint8Array(n);
  const sd = dirIndex(p.storm.dir);
  const boltCharge = stormCharge(p.storm.strength);
  let outcomeDone = false;

  for (let pulse = 0; pulse < p.pulses && !outcomeDone; pulse++) {
    used.fill(0);
    const gates = new Map<number, GateState>();
    const reading = new Array<number>(m).fill(0);
    const readingAnc: Anc[] = new Array<Anc>(m).fill(NO_ANC);
    let next: Bolt[] = [];
    let maxTick = 0;

    const emit = (
      fx: number,
      fy: number,
      d: number,
      charge: number,
      amber: boolean,
      anc: Anc,
      colour: GemKind,
      tick: number,
    ) => {
      const tx = fx + DX[d]!;
      const ty = fy + DY[d]!;
      if (tick + 1 > maxTick) maxTick = tick + 1;
      let seg = -1;
      if (wantTrace) {
        seg = raw.length;
        raw.push({ fx, fy, tx, ty, charge, colour, pulse, tick, end: 'gem' });
      }
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) {
        const mi = machineAt.get(outKey(tx, ty));
        if (mi !== undefined) {
          reading[mi]! += charge;
          readingAnc[mi] = ancOr(readingAnc[mi]!, anc);
          if (seg >= 0) raw[seg]!.end = 'machine';
        } else if (seg >= 0) raw[seg]!.end = 'ground';
        return;
      }
      next.push({ x: tx, y: ty, d, charge, amber, anc, seg });
    };
    const endSeg = (b: Bolt, e: SegmentEnd) => {
      if (b.seg >= 0) raw[b.seg]!.end = e;
    };

    emit(p.storm.at.x, p.storm.at.y, sd, boltCharge, false, NO_ANC, 'channel', 0);

    for (let tick = 1; next.length > 0; tick++) {
      const cur = next;
      next = [];
      // Group arrivals by socket, in arrival order.
      const groups = new Map<number, Bolt[]>();
      for (const b of cur) {
        const i = b.y * w + b.x;
        const g = groups.get(i);
        if (g) g.push(b);
        else groups.set(i, [b]);
      }
      for (const [i, group] of groups) {
        const k = kind[i]!;
        if (k === S_EMPTY || k === S_BLOCKED) {
          for (const b of group) endSeg(b, 'fizzle');
          continue;
        }
        if (k === S_UNKNOWN || k === S_DEFERRED) {
          let sides = 0;
          for (const b of group) sides |= 1 << ((b.d + 2) & 3);
          if (k === S_DEFERRED) sides &= ~board.excl[i]!;
          if (sides === 0) {
            for (const b of group) endSeg(b, 'fizzle');
            continue;
          }
          let overSoFar = false;
          for (let j = 0; j < m; j++)
            if (!awake[j] && reading[j]! > machines[j]!.need) overSoFar = true;
          return {
            status: 'decide',
            cell: i,
            sides,
            charges: group.map((b) => b.charge),
            overSoFar,
            awake: awake.slice(),
          };
        }
        const r = rot[i]!;
        const mask = acceptMask(k, r);
        const colour = CODE_GEM[k]!;
        const x = i % w;
        const y = (i - x) / w;
        if (k === C_GATE) {
          let gs = gates.get(i);
          if (!gs) {
            gs = { a: null, b: null, fired: false };
            gates.set(i, gs);
          }
          for (const b of group) {
            const side = (b.d + 2) & 3;
            if (!(mask & (1 << side)) || gs.fired) {
              endSeg(b, 'fizzle');
              continue;
            }
            const isA = side === ((r + 1) & 3);
            if (isA ? gs.a : gs.b) {
              endSeg(b, 'fizzle');
              continue;
            }
            if (isA) gs.a = b;
            else gs.b = b;
            endSeg(b, 'wait');
          }
          if (gs.a && gs.b && !gs.fired) {
            gs.fired = true;
            const a = gs.a;
            const b = gs.b;
            emit(
              x,
              y,
              r,
              a.charge + b.charge,
              a.amber || b.amber,
              ancWith(ancOr(a.anc, b.anc), i),
              colour,
              tick,
            );
          }
          continue;
        }
        // Single-use gems. Bolts on a side the gem does not accept bounce off.
        const valid: Bolt[] = [];
        for (const b of group) {
          if (mask & (1 << ((b.d + 2) & 3))) valid.push(b);
          else endSeg(b, 'fizzle');
        }
        if (valid.length === 0) continue;
        if (used[i] || valid.length > 1) {
          used[i] = 1;
          for (const b of valid) endSeg(b, 'fizzle');
          continue;
        }
        used[i] = 1;
        const b = valid[0]!;
        const anc = ancWith(b.anc, i);
        switch (k) {
          case C_CHANNEL:
            emit(x, y, b.d, b.charge, b.amber, anc, colour, tick);
            break;
          case C_BEND: {
            const side = (b.d + 2) & 3;
            const out = side === r ? (r + 1) & 3 : r;
            emit(x, y, out, b.charge, b.amber, anc, colour, tick);
            break;
          }
          case C_SPLIT:
            if (b.charge % 2 !== 0) {
              endSeg(b, 'fizzle');
              break;
            }
            emit(x, y, (b.d + 3) & 3, b.charge / 2, b.amber, anc, colour, tick);
            emit(x, y, (b.d + 1) & 3, b.charge / 2, b.amber, anc, colour, tick);
            break;
          case C_AMPLIFY:
            emit(x, y, b.d, b.amber ? b.charge : b.charge * 2, true, anc, colour, tick);
            break;
          case C_CAPACITOR:
            if (!capFull[i]) {
              capFull[i] = 1;
              capCharge[i] = b.charge;
              capAmber[i] = b.amber ? 1 : 0;
              capAnc[i] = anc;
              endSeg(b, 'store');
            } else {
              capFull[i] = 0;
              emit(
                x,
                y,
                b.d,
                capCharge[i]! + b.charge,
                b.amber || capAmber[i] === 1,
                ancOr(anc, capAnc[i] ?? NO_ANC),
                colour,
                tick,
              );
            }
            break;
        }
      }
    }
    // Lone gate inputs fizzle at the end of the strike.
    if (wantTrace)
      for (const gs of gates.values())
        if (!gs.fired) {
          if (gs.a) endSeg(gs.a, 'fizzle');
          if (gs.b) endSeg(gs.b, 'fizzle');
        }
    pulseTicks.push(maxTick);

    // Read the gauges.
    let allAwake = true;
    for (let j = 0; j < m; j++) {
      if (awake[j]) continue;
      const v = reading[j]!;
      readings[j]!.push(v);
      if (v > 0) ever[j] = true;
      const need = machines[j]!.need;
      if (v > need) {
        tripped[j] = true;
        outcomeDone = true;
      } else if (v === need) {
        awake[j] = true;
        wokeOn[j] = pulse;
        useful = ancOr(useful, readingAnc[j]!);
      }
      if (!awake[j]) allAwake = false;
    }
    if (allAwake) outcomeDone = true;
  }

  const results: MachineResult[] = machines.map((mc, j) => ({
    at: { x: mc.at.x, y: mc.at.y },
    need: mc.need,
    outcome: tripped[j] ? 'over' : awake[j] ? 'exact' : ever[j] ? 'under' : 'dead',
    readings: readings[j]!,
    wokeOn: wokeOn[j]!,
  }));
  let outcome: Outcome;
  if (tripped.some(Boolean)) outcome = 'over';
  else if (awake.every(Boolean)) outcome = 'exact';
  else if (!ever.some(Boolean)) outcome = 'dead';
  else outcome = 'under';
  return { status: 'done', outcome, machines: results, raw, pulseTicks, useful };
}

// ---------------------------------------------------------------------------
// Public API

/** Build the board for a full set of player placements (unlisted sockets are empty). */
export function boardFor(p: PuzzleDef, placements: readonly Placement[]): Board {
  const board = emptyBoard(p, S_EMPTY);
  for (const pl of placements) {
    const i = pl.cell.y * board.w + pl.cell.x;
    if (pl.cell.x < 0 || pl.cell.y < 0 || pl.cell.x >= board.w || pl.cell.y >= board.h) continue;
    if (board.kind[i] !== S_EMPTY) continue; // blocked or fixed: ignore
    board.kind[i] = GEM_CODE[pl.gem];
    board.rot[i] = pl.gem === 'bend' || pl.gem === 'gate' ? pl.rot : 0;
  }
  return board;
}

/**
 * Run the storm against a set of placements. Placements on blocked or fixed sockets, or
 * outside the altar, are ignored (use `validatePlacement` to stop the UI making them).
 */
export function simulate(p: PuzzleDef, placements: readonly Placement[]): SimResult {
  const core = runCore(p, boardFor(p, placements), true);
  if (core.status !== 'done') throw new Error('simulate: board has undecided sockets');
  return finishTrace(core);
}

function finishTrace(core: CoreDone): SimResult {
  const offsets: number[] = [];
  let total = 0;
  core.pulseTicks.forEach((t, i) => {
    offsets.push(total);
    total += t + (i < core.pulseTicks.length - 1 ? 1 : 0);
  });
  const duration = Math.max(total, 1);
  const trace = core.raw.map((s) => ({
    from: { x: s.fx, y: s.fy },
    to: { x: s.tx, y: s.ty },
    charge: s.charge,
    colour: s.colour,
    pulse: s.pulse,
    tick: s.tick,
    t0: (offsets[s.pulse]! + s.tick) / duration,
    t1: (offsets[s.pulse]! + s.tick + 1) / duration,
    end: s.end,
  }));
  return {
    outcome: core.outcome,
    machines: core.machines,
    trace,
    pulsesRun: core.pulseTicks.length,
    duration,
  };
}

/** Direction helpers re-exported for scenes. */
export function dirOf(i: number): (typeof DIRS)[number] {
  return DIRS[i & 3]!;
}
