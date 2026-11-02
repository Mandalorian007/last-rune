/**
 * Exhaustive solver, used for tests, hints and as a design tool.
 *
 * Bolt-driven search: the simulation runs on a board whose sockets start "unknown"; when a
 * bolt reaches an unknown socket the search branches over everything that socket could be
 * (each gem kind and useful rotation still in the tray, or "nothing"). Sockets no bolt ever
 * reaches stay empty, so every solution found lights every gem it places.
 *
 * "Nothing" is modelled as *deferred*: bolts bounce off it, and if a later bolt arrives from a
 * different side the socket may still turn out to be a Bend or Gate that was facing away. That
 * keeps the search complete without branching over every useless rotation.
 */
import { altarDims, type Placement, type PuzzleDef, type Rot } from './model';
import {
  acceptMask,
  ancHas,
  C_BEND,
  C_CAPACITOR,
  C_GATE,
  C_SPLIT,
  CODE_GEM,
  emptyBoard,
  runCore,
  S_BLOCKED,
  S_DEFERRED,
  S_EMPTY,
  S_UNKNOWN,
} from './sim';
import { GEM_KINDS, type GemKind } from './types';

export interface SolveOptions {
  /** Stop after this many solutions (default 5000). */
  maxSolutions?: number;
  /** How many solutions to return (default 25). The first found are kept. */
  keep?: number;
  /**
   * Count only solutions in which every placed gem carries charge to a machine on the strike
   * it wakes (default true). Use false for "is there any solution at all".
   */
  canonical?: boolean;
  /** Safety cap on simulation runs (default 3,000,000). */
  maxNodes?: number;
  /** Override the puzzle's tray. */
  tray?: Partial<Record<GemKind, number>>;
}

export interface SolveResult {
  solvable: boolean;
  /** Up to `keep` solutions, fewest gems first. */
  solutions: Placement[][];
  count: number;
  /** True if the search stopped early (solution or node cap), so `count` is a lower bound. */
  capped: boolean;
  /** Simulation runs. */
  nodes: number;
  /** Branch points visited. */
  decisions: number;
  /** Mean number of options per branch point. */
  branching: number;
  /** Fewest player gems in any solution found (-1 if none). */
  minGems: number;
  /** Number of solutions found that use each gem kind. */
  gemUse: Record<GemKind, number>;
  /** log2(branch points per solution): a rough "how hard is it to stumble on" score. */
  searchBits: number;
  /**
   * Outcomes of the finished boards the search tried and rejected (leaves), plus branches cut
   * because a machine was already over. `under`/`over` are informative failures; `dead` means no
   * machine saw any charge.
   */
  leaves: { dead: number; under: number; over: number };
}

const CODES = [0, 1, 2, 3, 4, 5];

export function solve(p: PuzzleDef, opts: SolveOptions = {}): SolveResult {
  const maxSolutions = opts.maxSolutions ?? 5000;
  const keep = opts.keep ?? 25;
  const canonical = opts.canonical ?? true;
  const maxNodes = opts.maxNodes ?? 3_000_000;
  const tray = opts.tray ?? p.tray;
  const firstOnly = maxSolutions === 1;

  const board = emptyBoard(p, S_UNKNOWN);
  const { w, h } = altarDims(p.altar);
  const n = w * h;
  const fixedMask = new Uint8Array(n);
  for (const f of p.fixed) fixedMask[f.cell.y * w + f.cell.x] = 1;
  const remaining = CODES.map((c) => tray[CODE_GEM[c]!] ?? 0);
  let totalRemaining = remaining.reduce((a, b) => a + b, 0);
  const capPossible = (tray.capacitor ?? 0) > 0 || p.fixed.some((f) => f.gem === 'capacitor');

  const machineEntry = p.machines.map((mc) => {
    const x = Math.min(Math.max(mc.at.x, 0), w - 1);
    const y = Math.min(Math.max(mc.at.y, 0), h - 1);
    return y * w + x;
  });
  const stormEntry = (() => {
    const x = Math.min(Math.max(p.storm.at.x, 0), w - 1);
    const y = Math.min(Math.max(p.storm.at.y, 0), h - 1);
    return y * w + x;
  })();

  const solutions: Placement[][] = [];
  const gemUse = Object.fromEntries(GEM_KINDS.map((g) => [g, 0])) as Record<GemKind, number>;
  let count = 0;
  let nodes = 0;
  let decisions = 0;
  let branchSum = 0;
  let minGems = -1;
  let stopped = false;
  const leaves = { dead: 0, under: 0, over: 0 };

  // 0-1 BFS: fewest undecided sockets on any path from the storm to each socket.
  const dist = new Int32Array(n);
  const dq = new Int32Array(n * 4);
  const lowerBound = (awake: boolean[]): number => {
    dist.fill(0x3fffffff);
    const cost = (i: number) => {
      const k = board.kind[i]!;
      if (k === S_BLOCKED || k === S_EMPTY) return -1;
      return k >= 0 ? 0 : 1;
    };
    const c0 = cost(stormEntry);
    if (c0 < 0) return Infinity;
    let head = n * 2;
    let tail = head;
    dist[stormEntry] = c0;
    dq[tail++] = stormEntry;
    while (head < tail) {
      const i = dq[head++]!;
      const x = i % w;
      const y = (i - x) / w;
      const di = dist[i]!;
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 1 ? 1 : d === 3 ? -1 : 0);
        const ny = y + (d === 2 ? 1 : d === 0 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        const c = cost(j);
        if (c < 0) continue;
        if (di + c < dist[j]!) {
          dist[j] = di + c;
          if (c === 0) dq[--head] = j;
          else dq[tail++] = j;
        }
      }
    }
    let worst = 0;
    for (let m = 0; m < machineEntry.length; m++) {
      if (awake[m]) continue;
      const v = dist[machineEntry[m]!]!;
      if (v > worst) worst = v;
    }
    return worst >= 0x3fffffff ? Infinity : worst;
  };

  const place = (i: number, code: number, rot: number) => {
    board.kind[i] = code;
    board.rot[i] = rot;
    remaining[code]!--;
    totalRemaining--;
  };
  const unplace = (i: number, code: number, prevKind: number) => {
    board.kind[i] = prevKind;
    board.rot[i] = 0;
    remaining[code]!++;
    totalRemaining++;
  };

  const record = () => {
    const pls: Placement[] = [];
    for (let i = 0; i < n; i++) {
      const k = board.kind[i]!;
      if (k < 0 || fixedMask[i]) continue;
      const gem = CODE_GEM[k]!;
      pls.push({
        gem,
        cell: { x: i % w, y: Math.floor(i / w) },
        rot: (gem === 'bend' || gem === 'gate' ? board.rot[i]! : 0) as Rot,
      });
    }
    count++;
    const used = new Set(pls.map((q) => q.gem));
    for (const g of used) gemUse[g]++;
    if (minGems < 0 || pls.length < minGems) minGems = pls.length;
    solutions.push(pls);
    if (solutions.length > keep * 4) {
      solutions.sort((a, b) => a.length - b.length);
      solutions.length = keep;
    }
    if (count >= maxSolutions) stopped = true;
  };

  const dfs = (): void => {
    if (stopped) return;
    if (++nodes > maxNodes) {
      stopped = true;
      return;
    }
    const r = runCore(p, board, false);
    if (r.status === 'done') {
      if (r.outcome !== 'exact') {
        leaves[r.outcome]++;
        return;
      }
      if (canonical) {
        for (let i = 0; i < n; i++)
          if (board.kind[i]! >= 0 && !fixedMask[i] && !ancHas(r.useful, i)) return;
      }
      record();
      return;
    }
    if (r.overSoFar) {
      leaves.over++;
      return;
    }
    if (canonical) {
      // A placed gem whose every bolt this strike has already died can never be useful.
      for (let i = 0; i < n; i++)
        if (r.lit[i] && board.kind[i]! >= 0 && !fixedMask[i] && !ancHas(r.live, i)) return;
    }
    if (lowerBound(r.awake) > totalRemaining) return;

    const i = r.cell;
    const prevKind = board.kind[i]!;
    const prevExcl = board.excl[i]!;
    decisions++;
    let branches = 0;

    // Option A: nothing here (or a Bend/Gate facing away, decided later).
    const tryNothing = () => {
      board.kind[i] = S_DEFERRED;
      board.excl[i] = prevExcl | r.sides;
      branches++;
      dfs();
      board.excl[i] = prevExcl;
      board.kind[i] = prevKind;
    };
    // Looking for one solution, gems first finds it sooner; counting, the order is moot.
    if (!firstOnly) tryNothing();

    // Option B: a gem that accepts at least one of the arriving bolts.
    const allOdd = r.charges.every((c) => c % 2 !== 0);
    for (const code of CODES) {
      if (stopped) break;
      if (remaining[code]! <= 0) continue;
      const rotational = code === C_BEND || code === C_GATE;
      if (prevKind === S_DEFERRED && !rotational) continue;
      if (code === C_SPLIT && allOdd && !capPossible) continue;
      if (code === C_CAPACITOR && p.pulses < 2) continue;
      for (let rot = 0; rot < (rotational ? 4 : 1); rot++) {
        const m = acceptMask(code, rot);
        if (!(m & r.sides)) continue;
        if (prevKind === S_DEFERRED && m & prevExcl) continue;
        place(i, code, rot);
        branches++;
        dfs();
        unplace(i, code, prevKind);
        if (stopped) break;
      }
    }
    if (firstOnly && !stopped) tryNothing();
    board.kind[i] = prevKind;
    board.excl[i] = prevExcl;
    branchSum += branches;
  };

  dfs();
  solutions.sort((a, b) => a.length - b.length);
  if (solutions.length > keep) solutions.length = keep;
  return {
    solvable: count > 0,
    solutions,
    count,
    capped: stopped,
    nodes,
    decisions,
    branching: decisions ? branchSum / decisions : 0,
    minGems,
    gemUse,
    searchBits: Math.log2(Math.max(1, decisions) / Math.max(1, count)),
    leaves,
  };
}

/**
 * Is there a solution with this tray? Stops at the first. Searches canonical solutions (every
 * gem carries charge to a machine), which is much faster; any solution reduces to one by
 * lifting its idle gems, unless an idle bolt's collision was holding the circuit together.
 */
export function isSolvable(p: PuzzleDef, tray: Partial<Record<GemKind, number>> = p.tray): boolean {
  return solve(p, { tray, maxSolutions: 1, keep: 1 }).count > 0;
}

/** Gem kinds in the tray without which the puzzle cannot be solved. */
export function essentialGems(p: PuzzleDef): GemKind[] {
  const out: GemKind[] = [];
  for (const g of GEM_KINDS) {
    if (!(p.tray[g] ?? 0)) continue;
    if (!isSolvable(p, { ...p.tray, [g]: 0 })) out.push(g);
  }
  return out;
}

/** Is `gem` in the board as a fixed gem essential? (Solvable once the fixed ones are removed?) */
export function fixedEssential(p: PuzzleDef, gem: GemKind): boolean {
  const q: PuzzleDef = { ...p, fixed: p.fixed.filter((f) => f.gem !== gem) };
  return !isSolvable(q);
}
