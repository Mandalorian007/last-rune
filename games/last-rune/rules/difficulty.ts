/**
 * Difficulty model: metrics that try to predict how hard a puzzle is for a person, a heuristic
 * "novice" player, and one combined score. Pure TS (no DOM/GPU), used by the puzzle suite, the
 * dev viewer (`pnpm puzzle <id>`) and docs/design/difficulty-curve.md.
 *
 * The score (0 to about 10) is documented in difficulty-curve.md §2 and in `scoreOf` below.
 */
import { altarDims, type Placement, type PuzzleDef, type Rot } from './model';
import {
  acceptMask,
  C_BEND,
  C_CAPACITOR,
  C_GATE,
  C_SPLIT,
  CODE_GEM,
  emptyBoard,
  runCore,
  S_EMPTY,
  S_UNKNOWN,
  simulate,
  type TraceSegment,
} from './sim';
import { type SolveResult, solve } from './solver';
import type { GemKind } from './types';

// ---------------------------------------------------------------------------
// Flow analysis of one solution

/**
 * Things a solution does that a player has to *see* to find it. A marker is "required" when
 * every canonical solution has it.
 */
export const MARKERS = [
  /** Amplify feeds a Split: "amber before magenta". */
  'amp-then-split',
  /** An Amplify doubles a bolt that was already split (asymmetric halves). */
  'split-then-amp',
  /** A bolt passes a second Amplify, which does nothing. */
  'amp-noop',
  /** A Gate fires. */
  'gate',
  /** A Gate adds two different charges. */
  'gate-unequal',
  /** A Capacitor banks a bolt and releases it on a later strike. */
  'bank',
  /** A machine wakes on a strike after the first. */
  'late-wake',
  /** Charge is deliberately thrown away (a bolt grounds or fizzles). */
  'waste',
  /** A pre-set gem is left out of the circuit: the player routes around it. */
  'avoid-fixed',
  /** The path is much longer than the straight-line distance (a non-local route). */
  'detour',
] as const;
export type Marker = (typeof MARKERS)[number];

/** How much each required marker adds to the "concepts" component of the score. */
export const MARKER_WEIGHT: Record<Marker, number> = {
  'amp-then-split': 1,
  'split-then-amp': 1,
  'amp-noop': 0.5,
  gate: 0.5,
  'gate-unequal': 1,
  bank: 1,
  'late-wake': 1,
  waste: 1,
  'avoid-fixed': 0.75,
  detour: 0.75,
};

export interface FlowSummary {
  markers: Marker[];
  /** Distinct sockets that handled a bolt (path length). */
  pathCells: number;
}

/** Analyse a full solution: which markers it shows, and how long its circuit is. */
export function analyseSolution(p: PuzzleDef, placements: readonly Placement[]): FlowSummary {
  const r = simulate(p, placements);
  const { w } = altarDims(p.altar);
  const gemAt = new Map<number, GemKind>();
  for (const f of p.fixed) gemAt.set(f.cell.y * w + f.cell.x, f.gem);
  for (const pl of placements) gemAt.set(pl.cell.y * w + pl.cell.x, pl.gem);
  const key = (c: { x: number; y: number }) => c.y * w + c.x;
  const inside = (c: { x: number; y: number }) =>
    c.x >= 0 && c.y >= 0 && c.x < w && c.y < altarDims(p.altar).h;

  // Upstream gem kinds of every segment. Segments are recorded in causal order, so one pass is
  // enough: a gem's output on strike `pulse` at tick t+1 comes from its input that ended at t.
  const up: Set<GemKind>[] = [];
  const handled = new Map<string, number[]>(); // `${pulse}:${cell}` -> input segment indices
  const stored = new Map<number, number>(); // capacitor cell -> stored segment index
  const markers = new Set<Marker>();
  const cells = new Set<number>();
  r.trace.forEach((s: TraceSegment, i) => {
    const ups = new Set<GemKind>();
    if (inside(s.from)) {
      const k = key(s.from);
      const g = gemAt.get(k);
      for (const j of handled.get(`${s.pulse}:${k}`) ?? []) for (const u of up[j]!) ups.add(u);
      if (g === 'capacitor' && stored.has(k)) {
        for (const u of up[stored.get(k)!]!) ups.add(u);
        stored.delete(k);
        markers.add('bank');
      }
      if (g) ups.add(g);
    }
    up.push(ups);
    if (inside(s.to) && (s.end === 'gem' || s.end === 'wait' || s.end === 'store')) {
      const k = key(s.to);
      cells.add(k);
      const id = `${s.pulse}:${k}`;
      const list = handled.get(id) ?? [];
      list.push(i);
      handled.set(id, list);
      if (s.end === 'store') stored.set(k, i);
      const g = gemAt.get(k);
      if (g === 'split' && ups.has('amplify')) markers.add('amp-then-split');
      if (g === 'amplify' && ups.has('amplify')) markers.add('amp-noop');
      if (g === 'amplify' && !ups.has('amplify') && ups.has('split')) markers.add('split-then-amp');
    }
    if (s.end === 'fizzle' || s.end === 'ground') markers.add('waste');
  });
  // Gates: two waiting inputs on the same strike that fired.
  for (const [id, list] of handled) {
    const cell = Number(id.split(':')[1]);
    if (gemAt.get(cell) !== 'gate') continue;
    const ins = list.filter((j) => r.trace[j]!.end === 'wait');
    if (ins.length === 2) {
      markers.add('gate');
      if (r.trace[ins[0]!]!.charge !== r.trace[ins[1]!]!.charge) markers.add('gate-unequal');
    }
  }
  if (stored.size > 0) markers.add('waste');
  if (r.machines.some((m) => m.wokeOn > 0)) markers.add('late-wake');
  for (const f of p.fixed) if (!cells.has(key(f.cell))) markers.add('avoid-fixed');
  // Detour: the circuit is at least twice as long as the storm-to-farthest-machine distance.
  const far = Math.max(
    ...p.machines.map((m) => Math.abs(m.at.x - p.storm.at.x) + Math.abs(m.at.y - p.storm.at.y) - 1),
  );
  if (cells.size >= 2 * far + 2) markers.add('detour');
  return { markers: MARKERS.filter((m) => markers.has(m)), pathCells: cells.size };
}

// ---------------------------------------------------------------------------
// Novice bot

export interface BotOptions {
  /** Independent play sessions, each with its own memory (default 12). */
  sessions?: number;
  /** Attempts per session before the bot gives up (default 150). */
  maxTries?: number;
  seed?: number;
  /** Softmax temperature over option scores (default 0.7). Higher = sloppier. */
  temperature?: number;
  /** Called with every finished attempt (for the viewer and debugging). */
  onAttempt?: (placements: Placement[], outcome: string, session: number) => void;
}

export interface BotResult {
  sessions: number;
  /** Sessions that ended in a solve. */
  solved: number;
  /** Median attempts to the first solve (a give-up counts as 2 × maxTries). */
  expected: number;
  /** Outcomes of all failed attempts. */
  fails: { dead: number; under: number; over: number };
}

function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/**
 * A heuristic first-time player. It builds the circuit the way people do: follow the bolt,
 * and at each empty socket the bolt reaches pick a gem that heads toward the nearest machine
 * and nudges the charge toward that machine's need (Split if too much, Amplify if too little).
 * It looks one socket ahead (a distance map) and chooses with some noise. Each attempt is
 * built from scratch and fired once; it never reasons about Gates or Capacitors beyond "a Gate
 * is for joining bolts" and "a Capacitor is for later strikes".
 *
 * `expected` (attempts per success) is the signal: a Tier-1 puzzle should fall in a few
 * attempts; a puzzle the bot solves in one or two attempts is too easy past Tier 1.
 */
export function noviceBot(p: PuzzleDef, opts: BotOptions = {}): BotResult {
  const sessions = opts.sessions ?? 12;
  const maxTries = opts.maxTries ?? 150;
  const temp = opts.temperature ?? 0.7;
  const rand = rng(opts.seed ?? 1);
  const { w, h } = altarDims(p.altar);
  const n = w * h;
  const base = emptyBoard(p, S_UNKNOWN);
  const blocked = (i: number) => base.kind[i] === -2;

  // Distance from each socket to the edge socket in front of each machine (BFS, 4-connected).
  const distTo = p.machines.map((m) => {
    const ex = Math.min(Math.max(m.at.x, 0), w - 1);
    const ey = Math.min(Math.max(m.at.y, 0), h - 1);
    const d = new Int32Array(n).fill(999);
    const start = ey * w + ex;
    if (blocked(start)) return d;
    d[start] = 0;
    const q = [start];
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi]!;
      const x = i % w;
      const y = (i - x) / w;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k]!;
        const ny = y + DY[k]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (blocked(j) || d[j]! <= d[i]! + 1) continue;
        d[j] = d[i]! + 1;
        q.push(j);
      }
    }
    return d;
  });
  const machineAt = new Map<string, number>();
  p.machines.forEach((m, i) => {
    machineAt.set(`${m.at.x},${m.at.y}`, i);
  });

  /**
   * Distance to the nearest goal: a machine still asleep, or a gem on the board that has not
   * been lit this strike (people read pre-set gems as signposts), or any Gate (it wants a
   * second input). Gems are reached through the sides they accept.
   */
  const field = new Int32Array(n);
  const queue = new Int32Array(n * 4);
  const goalField = (board: typeof base, lit: Uint8Array, awake: boolean[]) => {
    field.fill(999);
    let qt = 0;
    const open = (j: number) => !blocked(j) && board.kind[j]! < 0;
    const seed = (j: number, v: number) => {
      if (field[j]! <= v) return;
      field[j] = v;
      if (open(j)) queue[qt++] = j;
    };
    p.machines.forEach((m, mi) => {
      if (awake[mi]) return;
      const j = Math.min(Math.max(m.at.y, 0), h - 1) * w + Math.min(Math.max(m.at.x, 0), w - 1);
      if (!blocked(j)) seed(j, 0);
    });
    for (let i = 0; i < n; i++) {
      const k = board.kind[i]!;
      if (k < 0 || (lit[i] && k !== C_GATE)) continue;
      field[i] = 0;
      const mask = acceptMask(k, board.rot[i]!);
      const x = i % w;
      const y = (i - x) / w;
      for (let sd = 0; sd < 4; sd++) {
        if (!(mask & (1 << sd))) continue;
        const nx = x + DX[sd]!;
        const ny = y + DY[sd]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (open(j)) seed(j, 1);
      }
    }
    // Unit-weight BFS over open sockets (seeds are 0 or 1, close enough for a heuristic).
    for (let qi = 0; qi < qt; qi++) {
      const i = queue[qi]!;
      const x = i % w;
      const y = (i - x) / w;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k]!;
        const ny = y + DY[k]!;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!open(j) || field[j]! <= field[i]! + 1) continue;
        field[j] = field[i]! + 1;
        if (qt < queue.length) queue[qt++] = j;
      }
    }
  };

  /** How far a bolt leaving socket (x,y) in direction d is from a goal, and the nearest machine. */
  const outCost = (x: number, y: number, d: number, awake: boolean[]): [number, number] => {
    const nx = x + DX[d]!;
    const ny = y + DY[d]!;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
      const mi = machineAt.get(`${nx},${ny}`);
      if (mi !== undefined && !awake[mi]) return [0, mi];
      return [8, -1];
    }
    const j = ny * w + nx;
    let bm = 999;
    let bi = -1;
    distTo.forEach((dist, mi) => {
      if (!awake[mi] && dist[j]! < bm) {
        bm = dist[j]!;
        bi = mi;
      }
    });
    let best = Math.min(30, field[j]! + 1);
    if (blocked(j)) best += 6;
    return [best, bi];
  };

  /** Options at a decision, scored. `key` identifies the option (cell-independent). */
  type Option = { key: number; code: number; rot: number; score: number };
  const optionsAt = (
    board: typeof base,
    left: number[],
    r: { cell: number; sides: number; charges: number[]; lit: Uint8Array; awake: boolean[] },
  ): Option[] => {
    const i = r.cell;
    const x = i % w;
    const y = (i - x) / w;
    let side = 0;
    while (!(r.sides & (1 << side))) side++;
    const d = (side + 2) & 3;
    const charge = r.charges[0] ?? 0;
    goalField(board, r.lit, r.awake);
    // Distance from here, so scores read as progress (0 = one step closer).
    const here = Math.min(30, field[i]!);
    const out: Option[] = [{ key: 63, code: -1, rot: 0, score: -4 }];
    for (let code = 0; code < 6; code++) {
      if (left[code]! <= 0) continue;
      const rotational = code === C_BEND || code === C_GATE || code === C_SPLIT;
      for (let rot = 0; rot < (rotational ? 4 : 1); rot++) {
        if (!(acceptMask(code, rot) & (1 << side))) continue;
        let outs: number[];
        if (code === C_BEND) outs = [side === rot ? (rot + 1) & 3 : rot];
        else if (code === C_SPLIT) outs = [(d + 3) & 3, (d + 1) & 3];
        else if (code === C_GATE) outs = [rot];
        else outs = [d];
        const costs = outs.map((o) => outCost(x, y, o, r.awake));
        const dist = costs.reduce((acc, c) => acc + c[0], 0) / costs.length;
        const target = costs.map((c) => c[1]).find((mi) => mi >= 0);
        let score = here - dist;
        // Charge sense: does the gem move the charge toward the nearest machine's need?
        if (target !== undefined && charge > 0) {
          const need = p.machines[target]!.need;
          const after = code === 3 ? charge * 2 : code === 2 ? charge / 2 : charge;
          score -= 1.2 * Math.abs(Math.log2(after / need));
        }
        if (code === C_GATE) score -= 1;
        if (code === C_CAPACITOR) score -= p.pulses > 1 ? 0.5 : 1.5;
        out.push({ key: code * 4 + rot, code, rot, score });
      }
    }
    return out;
  };

  const pickSoft = (o: Option[]): Option => {
    const mx = Math.max(...o.map((q) => q.score));
    const wts = o.map((q) => Math.exp((q.score - mx) / temp));
    let pick = rand() * wts.reduce((acc, v) => acc + v, 0);
    let k = 0;
    while (k < wts.length - 1 && pick > wts[k]!) {
      pick -= wts[k]!;
      k++;
    }
    return o[k]!;
  };

  /** What the player reads off the gauges: 0 is solved, more negative is further off. */
  const fitness = (machines: { need: number; readings: number[]; outcome: string }[]) => {
    let f = 0;
    for (const m of machines) {
      if (m.outcome === 'exact') continue;
      const seen = m.readings.filter((v) => v > 0);
      if (seen.length === 0) f -= 4;
      else f -= 0.5 + Math.min(...seen.map((v) => Math.min(3, Math.abs(Math.log2(v / m.need)))));
    }
    return f;
  };

  interface Attempt {
    /** Decision sequence: [cell, option key]. */
    steps: [number, number][];
    outcome: string;
    fit: number;
  }

  /**
   * Build a board by following the bolt. Steps before `edit` replay `prev` exactly; at `edit`
   * a different option is drawn; afterwards a socket the previous board decided keeps its
   * gem most of the time (people edit, they don't rebuild).
   */
  const build = (sess: number, prev: Attempt | null, edit: number): Attempt => {
    const board = emptyBoard(p, S_UNKNOWN);
    const left = [0, 1, 2, 3, 4, 5].map((c) => p.tray[CODE_GEM[c]!] ?? 0);
    const keep = new Map<number, number>();
    if (prev) for (const [c, k] of prev.steps) keep.set(c, k);
    const steps: [number, number][] = [];
    for (let guard = 0; guard < n * 3; guard++) {
      const r = runCore(p, board, false);
      if (r.status === 'done') {
        if (opts.onAttempt) {
          const pls: Placement[] = [];
          for (let j = 0; j < n; j++) {
            const k = board.kind[j]!;
            if (k >= 0 && base.kind[j]! < 0)
              pls.push({
                gem: CODE_GEM[k]!,
                cell: { x: j % w, y: Math.floor(j / w) },
                rot: board.rot[j]! as Rot,
              });
          }
          opts.onAttempt(pls, r.outcome, sess);
        }
        return { steps, outcome: r.outcome, fit: fitness(r.machines) };
      }
      const o = optionsAt(board, left, r);
      const s = steps.length;
      let choice: Option | undefined;
      if (prev && s < edit) choice = o.find((q) => q.key === prev.steps[s]![1]);
      else if (prev && s === edit) {
        const rest = o.filter((q) => q.key !== prev.steps[s]![1]);
        choice = rest.length ? pickSoft(rest) : undefined;
      } else if (prev && keep.has(r.cell) && rand() < 0.85)
        choice = o.find((q) => q.key === keep.get(r.cell));
      choice ??= pickSoft(o);
      steps.push([r.cell, choice.key]);
      if (choice.code < 0) board.kind[r.cell] = S_EMPTY;
      else {
        board.kind[r.cell] = choice.code;
        board.rot[r.cell] = choice.rot;
        left[choice.code]!--;
      }
    }
    return { steps, outcome: 'dead', fit: -99 };
  };

  const fails = { dead: 0, under: 0, over: 0 };
  const tries: number[] = [];
  for (let sess = 0; sess < sessions; sess++) {
    let cur: Attempt | null = null;
    let solvedAt = -1;
    for (let a = 0; a < maxTries; a++) {
      // A fresh idea now and then; otherwise change one decision of the best board so far.
      const prev: Attempt | null = cur;
      const next: Attempt =
        prev === null || rand() < 0.12
          ? build(sess, null, 0)
          : build(sess, prev, Math.floor(rand() * prev.steps.length));
      if (next.outcome === 'exact') {
        solvedAt = a + 1;
        break;
      }
      fails[next.outcome as 'dead' | 'under' | 'over']++;
      if (cur === null || next.fit >= cur.fit || rand() < 0.1) cur = next;
    }
    tries.push(solvedAt < 0 ? maxTries * 2 : solvedAt);
  }
  tries.sort((x, y) => x - y);
  const mid = tries.length >> 1;
  const expected = tries.length % 2 ? tries[mid]! : (tries[mid - 1]! + tries[mid]!) / 2;
  return {
    sessions,
    solved: tries.filter((t) => t <= maxTries).length,
    expected,
    fails,
  };
}

// ---------------------------------------------------------------------------
// Metrics and score

export interface DifficultyMetrics {
  id: string;
  altar: string;
  /** Sockets that are neither blocked nor pre-set. */
  openSockets: number;
  machines: number;
  pulses: number;
  trayTotal: number;
  /** Fewest gems in any solution. */
  minGems: number;
  /** Tray gems beyond the smallest solution: room for wrong ideas. */
  slack: number;
  /** Tray kinds that no solution uses (pure decoys). */
  decoyKinds: GemKind[];
  solutions: number;
  /** True if the solver hit a cap, so `solutions` is a lower bound. */
  capped: boolean;
  nodes: number;
  /** log2(branch points per solution). */
  searchBits: number;
  /** Share of rejected finished boards that gave under/over feedback rather than nothing. */
  informative: number;
  /** Markers every solution shows. */
  required: Marker[];
  /** Markers the intended solution shows. */
  intendedMarkers: Marker[];
  pathCells: number;
  bot: BotResult;
  /** Weighted sum of required markers (+ machines/pulses). */
  concepts: number;
  score: number;
  /** Estimated minutes for a first-time player. */
  minutes: number;
}

export interface MeasureOptions {
  /** Pass a precomputed exhaustive solve (with `keep` large enough) to skip the search. */
  solved?: SolveResult;
  botSessions?: number;
  maxNodes?: number;
}

/**
 * The difficulty score, calibrated so that it reads as minutes for a first-time player
 * (1 = the tutorial, 10 = the finale). Weights were fitted (ridge least squares, then rounded)
 * to a by-hand minutes estimate of the 16 pre-Phase-1 puzzles; see difficulty-curve.md §2.
 *
 *   score = 0.4
 *         + 0.15 · log2(bot attempts to solve)   (how often sensible-but-naive tries work)
 *         + 0.10 · searchBits                    (how rare solutions are in the search tree)
 *         + 0.35 · concepts                      (ideas every solution needs, weighted)
 *         + 0.04 · minGems                       (sheer construction: sockets to fill)
 *         − 0.10 · log2(solutions)               (a loose space forgives)
 *
 * `concepts` = Σ MARKER_WEIGHT over required markers + 0.5 per machine beyond the first
 *              + 0.5 if there is more than one strike.
 * Bot attempts are capped at 2 × maxTries (a give-up), so the bot term tops out near 1.3.
 */
export function scoreOf(m: {
  bot: { expected: number };
  searchBits: number;
  concepts: number;
  minGems: number;
  solutions: number;
}): number {
  const s =
    0.4 +
    0.15 * Math.log2(Math.max(1, m.bot.expected)) +
    0.1 * m.searchBits +
    0.35 * m.concepts +
    0.04 * Math.max(0, m.minGems) -
    0.1 * Math.log2(Math.max(1, m.solutions));
  return Math.max(0, Math.round(s * 10) / 10);
}

/** Estimated minutes: the score, to the half minute, at least one. */
export function minutesFor(score: number): number {
  return Math.max(1, Math.round(score * 2) / 2);
}

/** Measure a puzzle. Runs the exhaustive solver, so it can take seconds on the finale. */
export function measure(p: PuzzleDef, opts: MeasureOptions = {}): DifficultyMetrics {
  const s = opts.solved ?? solve(p, { keep: 1000, maxNodes: opts.maxNodes ?? 20_000_000 });
  const { w, h } = altarDims(p.altar);
  const openSockets = w * h - p.blocked.length - p.fixed.length;
  const trayTotal = Object.values(p.tray).reduce((a, b) => a + (b ?? 0), 0);
  const decoyKinds = (Object.keys(p.tray) as GemKind[]).filter(
    (g) => (p.tray[g] ?? 0) > 0 && s.gemUse[g] === 0,
  );
  const flows = s.solutions.map((sol) => analyseSolution(p, sol));
  const required = flows.length
    ? MARKERS.filter((m) => flows.every((f) => f.markers.includes(m)))
    : [];
  const intended = analyseSolution(p, p.design.intended);
  const concepts =
    required.reduce((a, m) => a + MARKER_WEIGHT[m], 0) +
    0.5 * (p.machines.length - 1) +
    (p.pulses > 1 ? 0.5 : 0);
  const fails = s.leaves.dead + s.leaves.under + s.leaves.over;
  const bot = noviceBot(p, { sessions: opts.botSessions ?? 12 });
  const base = {
    id: p.id,
    altar: p.altar,
    openSockets,
    machines: p.machines.length,
    pulses: p.pulses,
    trayTotal,
    minGems: s.minGems,
    slack: trayTotal - Math.max(0, s.minGems),
    decoyKinds,
    solutions: s.count,
    capped: s.capped,
    nodes: s.nodes,
    searchBits: Math.round(s.searchBits * 10) / 10,
    informative: fails ? Math.round(((s.leaves.under + s.leaves.over) / fails) * 100) / 100 : 0,
    required,
    intendedMarkers: intended.markers,
    pathCells: intended.pathCells,
    bot,
    concepts,
  };
  const score = scoreOf(base);
  return { ...base, score, minutes: minutesFor(score) };
}
