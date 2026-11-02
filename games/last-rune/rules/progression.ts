/**
 * Progression: the capability graph (contract C3).
 *
 * Pure TS. No DOM, no engine imports. The machine data lives in
 * `content/machines.ts`; every function here also accepts an explicit graph so
 * tests (and tools) can reason about alternative graphs.
 *
 * Design and justification: docs/design/progression.md.
 */
import { MACHINES } from '../content/machines';
import type { AltarSize, Capability, GemKind, MachineId, StormStrength, Tier } from './types';
import { MACHINE_IDS } from './types';

// ─── Capabilities ────────────────────────────────────────────────────────────

/** A stable string key for a capability, e.g. `gem:split`, `storm:2`, `altar:8x6`. */
export type CapabilityKey =
  | `gem:${Exclude<GemKind, 'channel'>}`
  | `storm:${Exclude<StormStrength, 1>}`
  | `altar:${Exclude<AltarSize, '6x4'>}`;

/** Every capability in the game, in canonical (display) order. */
export const ALL_CAPABILITIES: readonly Capability[] = [
  { type: 'gem', gem: 'bend' },
  { type: 'gem', gem: 'split' },
  { type: 'gem', gem: 'amplify' },
  { type: 'gem', gem: 'gate' },
  { type: 'gem', gem: 'capacitor' },
  { type: 'storm', strength: 2 },
  { type: 'storm', strength: 4 },
  { type: 'altar', size: '8x6' },
  { type: 'altar', size: '10x8' },
];

export function capabilityKey(c: Capability): CapabilityKey {
  switch (c.type) {
    case 'gem':
      return `gem:${c.gem}`;
    case 'storm':
      return `storm:${c.strength}`;
    case 'altar':
      return `altar:${c.size}`;
  }
}

export function capabilityFromKey(key: CapabilityKey): Capability {
  const found = ALL_CAPABILITIES.find((c) => capabilityKey(c) === key);
  if (!found) throw new Error(`Unknown capability key: ${key}`);
  return found;
}

export function sameCapability(a: Capability, b: Capability): boolean {
  return capabilityKey(a) === capabilityKey(b);
}

/** Human label for UI and docs: "Bend", "Storm ×2", "Altar 8×6". */
export function capabilityLabel(c: Capability): string {
  switch (c.type) {
    case 'gem':
      return c.gem[0]!.toUpperCase() + c.gem.slice(1);
    case 'storm':
      return `Storm ×${c.strength}`;
    case 'altar':
      return `Altar ${c.size.replace('x', '×')}`;
  }
}

/**
 * Palette name for a locked door's empty socket (pitch: "empty gem sockets in
 * the colour it needs"). Gems use their gem colour; storm sockets are cyan
 * rings (ring count = strength); altar sockets are uncut slate.
 */
export type SocketColour = 'amethyst' | 'magenta' | 'amber' | 'emerald' | 'ice' | 'cyan' | 'slate';

export function socketColour(c: Capability): SocketColour {
  if (c.type === 'storm') return 'cyan';
  if (c.type === 'altar') return 'slate';
  const byGem = {
    bend: 'amethyst',
    split: 'magenta',
    amplify: 'amber',
    gate: 'emerald',
    capacitor: 'ice',
  } as const satisfies Record<Exclude<GemKind, 'channel'>, SocketColour>;
  return byGem[c.gem];
}

// ─── Machines ────────────────────────────────────────────────────────────────

/** The three wings of the hall plus the central convergence line. */
export type Branch = 'heat' | 'storm' | 'signal' | 'convergence';

export interface MachineDef {
  readonly id: MachineId;
  /** Display name. */
  readonly name: string;
  readonly tier: Tier;
  readonly branch: Branch;
  /** Capabilities that must all be held. Shown as empty sockets on the locked door. */
  readonly requires: readonly Capability[];
  /**
   * Machines that must all be restored first. Used only by the control booth
   * ("needs everything but the Last Rune"); shown as a row of alcove lamps.
   */
  readonly requiresSolved?: readonly MachineId[];
  /** What restoring it hands the player, or null (it still counts toward the booth). */
  readonly grants: Capability | null;
  /** Puzzle file id in content/puzzles (owned by rules-puzzles). Always equals `id`. */
  readonly puzzleId: MachineId;
  /** Alcove centre in the 1920×1080 hall design space. */
  readonly alcove: { readonly x: number; readonly y: number };
}

export type MachineGraph = readonly MachineDef[];

/** The two machines that form the finale. Everything else is a "regular" machine. */
export const FINALE: readonly MachineId[] = ['control-booth', 'the-last-rune'];

export function isRegular(id: MachineId): boolean {
  return !FINALE.includes(id);
}

export function getMachine(id: MachineId, graph: MachineGraph = MACHINES): MachineDef {
  const m = graph.find((d) => d.id === id);
  if (!m) throw new Error(`Unknown machine: ${id}`);
  return m;
}

/** The machine that grants a capability (each is granted exactly once), or undefined. */
export function granterOf(c: Capability, graph: MachineGraph = MACHINES): MachineDef | undefined {
  return graph.find((m) => m.grants !== null && sameCapability(m.grants, c));
}

// ─── Progress state ──────────────────────────────────────────────────────────

/** Serialisable progress. Goes into the save as-is. Order of `solved` = order restored. */
export interface ProgressState {
  readonly solved: readonly MachineId[];
}

export function initialState(): ProgressState {
  return { solved: [] };
}

export function isSolved(id: MachineId, state: ProgressState): boolean {
  return state.solved.includes(id);
}

/** All capabilities held, in canonical order. Channel is always held and not listed. */
export function capabilitiesOf(state: ProgressState, graph: MachineGraph = MACHINES): Capability[] {
  const held = new Set<CapabilityKey>();
  for (const id of state.solved) {
    const g = graph.find((m) => m.id === id)?.grants;
    if (g) held.add(capabilityKey(g));
  }
  return ALL_CAPABILITIES.filter((c) => held.has(capabilityKey(c)));
}

export function hasCapability(
  state: ProgressState,
  c: Capability,
  graph: MachineGraph = MACHINES,
): boolean {
  return capabilitiesOf(state, graph).some((h) => sameCapability(h, c));
}

function resolve(machine: MachineDef | MachineId, graph: MachineGraph): MachineDef {
  return typeof machine === 'string' ? getMachine(machine, graph) : machine;
}

/** Capabilities the machine still needs. Drives the empty sockets on a locked door. */
export function missingFor(
  machine: MachineDef | MachineId,
  state: ProgressState,
  graph: MachineGraph = MACHINES,
): Capability[] {
  const m = resolve(machine, graph);
  const held = capabilitiesOf(state, graph).map(capabilityKey);
  return m.requires.filter((c) => !held.includes(capabilityKey(c)));
}

/** Machines still to restore before this one opens (control booth only). */
export function missingMachinesFor(
  machine: MachineDef | MachineId,
  state: ProgressState,
  graph: MachineGraph = MACHINES,
): MachineId[] {
  const m = resolve(machine, graph);
  return (m.requiresSolved ?? []).filter((id) => !state.solved.includes(id));
}

export function isUnlocked(
  machine: MachineDef | MachineId,
  state: ProgressState,
  graph: MachineGraph = MACHINES,
): boolean {
  return (
    missingFor(machine, state, graph).length === 0 &&
    missingMachinesFor(machine, state, graph).length === 0
  );
}

/** Unlocked and not yet restored: the doors the player can walk through now. */
export function availableMachines(
  state: ProgressState,
  graph: MachineGraph = MACHINES,
): MachineDef[] {
  return graph.filter((m) => !isSolved(m.id, state) && isUnlocked(m, state, graph));
}

/** Returns the state after restoring `id`. Throws if it is locked; no-op if already solved. */
export function solveMachine(
  state: ProgressState,
  id: MachineId,
  graph: MachineGraph = MACHINES,
): ProgressState {
  if (isSolved(id, state)) return state;
  if (!isUnlocked(id, state, graph)) throw new Error(`Machine is locked: ${id}`);
  return { solved: [...state.solved, id] };
}

export function isComplete(state: ProgressState, graph: MachineGraph = MACHINES): boolean {
  return graph.every((m) => isSolved(m.id, state));
}

/**
 * The story register FUSE speaks in (drives reaction and hall lines):
 * 4 once the booth is restored, 3 once any Tier 3 machine is, 2 once any Tier 2 is, else 1.
 */
export function storyTier(state: ProgressState, graph: MachineGraph = MACHINES): Tier {
  let t: Tier = 1;
  for (const id of state.solved) {
    const m = graph.find((d) => d.id === id);
    if (!m) continue;
    if (m.id === 'control-booth') return 4;
    if (m.tier > t && m.tier <= 3) t = m.tier;
  }
  return t;
}

/**
 * Repairs untrusted save data into a valid, reachable state: drops unknown and
 * duplicate ids, then keeps only machines whose locks were open in saved order
 * (repeating until stable, so a reordered save still loads).
 */
export function parseProgressState(raw: unknown, graph: MachineGraph = MACHINES): ProgressState {
  const ids: MachineId[] = [];
  const list =
    raw && typeof raw === 'object' && Array.isArray((raw as { solved?: unknown }).solved)
      ? ((raw as { solved: unknown[] }).solved as unknown[])
      : [];
  for (const v of list) {
    if (typeof v === 'string' && (MACHINE_IDS as readonly string[]).includes(v)) {
      const id = v as MachineId;
      if (graph.some((m) => m.id === id) && !ids.includes(id)) ids.push(id);
    }
  }
  let state = initialState();
  let pending = ids;
  let progressed = true;
  while (progressed) {
    progressed = false;
    const next: MachineId[] = [];
    for (const id of pending) {
      if (isUnlocked(id, state, graph)) {
        state = { solved: [...state.solved, id] };
        progressed = true;
      } else next.push(id);
    }
    pending = next;
  }
  return state;
}

// ─── Hall conduits ───────────────────────────────────────────────────────────

export interface Conduit {
  readonly from: MachineId;
  readonly to: MachineId;
  readonly capability: CapabilityKey;
}

/**
 * Floor conduits for the hall (pitch screen 2): one per requirement, from the
 * machine that grants a capability to each machine that needs it. Light the
 * conduit once `from` is restored.
 */
export function conduits(graph: MachineGraph = MACHINES): Conduit[] {
  const out: Conduit[] = [];
  for (const m of graph) {
    for (const c of m.requires) {
      const g = granterOf(c, graph);
      if (g) out.push({ from: g.id, to: m.id, capability: capabilityKey(c) });
    }
  }
  return out;
}

// ─── Reachability analysis ───────────────────────────────────────────────────

/**
 * Machines that cannot be restored without `id` (transitively), excluding the
 * finale. Restoring `id` is a precondition for all of them.
 */
export function dependentsOf(id: MachineId, graph: MachineGraph = MACHINES): MachineId[] {
  const out = new Set<MachineId>();
  const frontier: MachineId[] = [id];
  while (frontier.length > 0) {
    const cur = getMachine(frontier.pop()!, graph);
    for (const m of graph) {
      if (!isRegular(m.id) || out.has(m.id) || m.id === id) continue;
      const needsGrant =
        cur.grants !== null && m.requires.some((c) => sameCapability(c, cur.grants!));
      const needsSolved = m.requiresSolved?.includes(cur.id) ?? false;
      if (needsGrant || needsSolved) {
        out.add(m.id);
        frontier.push(m.id);
      }
    }
  }
  return graph.map((m) => m.id).filter((x) => out.has(x));
}

export interface ReachableState {
  readonly solved: readonly MachineId[];
  readonly available: readonly MachineId[];
}

/**
 * Every state reachable from the start by restoring available machines in any
 * order (as sets: order of `solved` is canonical graph order). Exhaustive BFS
 * over bitmasks; the real graph has a few thousand states.
 */
export function enumerateReachableStates(graph: MachineGraph = MACHINES): ReachableState[] {
  const ids = graph.map((m) => m.id);
  if (ids.length > 30) throw new Error('graph too large for bitmask search');
  const toState = (mask: number): ProgressState => ({
    solved: ids.filter((_, i) => (mask >>> i) & 1),
  });
  const seen = new Map<number, ReachableState>();
  const queue = [0];
  seen.set(0, { solved: [], available: availableMachines(toState(0), graph).map((m) => m.id) });
  while (queue.length > 0) {
    const mask = queue.shift()!;
    for (const id of seen.get(mask)!.available) {
      const next = mask | (1 << ids.indexOf(id));
      if (seen.has(next)) continue;
      const st = toState(next);
      seen.set(next, {
        solved: st.solved,
        available: availableMachines(st, graph).map((m) => m.id),
      });
      queue.push(next);
    }
  }
  return [...seen.values()];
}

export type SingleDoorReason = 'start' | 'gate' | 'last-regular' | 'finale';

export interface ChoiceReport {
  /** Number of reachable states (including start and complete). */
  readonly stateCount: number;
  /** Reachable states that are not complete. */
  readonly openStates: number;
  /** Open states with two or more doors available. */
  readonly multiDoorStates: number;
  /** Every open state with exactly one door, and why. */
  readonly singleDoorStates: readonly {
    readonly solved: readonly MachineId[];
    readonly door: MachineId;
    readonly reason: SingleDoorReason | 'unexplained';
  }[];
  /** Open states with zero doors (softlocks). Must be empty. */
  readonly softlocks: readonly (readonly MachineId[])[];
  /** Fewest regular machines restored in any 'gate' single-door state. */
  readonly earliestGatePinch: number;
}

/**
 * Classifies every reachable state against the "always a choice" rule.
 *
 * A single-door state is explained if it is:
 * - 'start': nothing restored; the intake desk is the front door.
 * - 'gate': the unrestored regular machines are exactly the door plus
 *   everything that depends on it, i.e. the player has already restored every
 *   machine that doesn't need that door. (Unavoidable with AND-locks; see
 *   docs/design/progression.md §3.)
 * - 'last-regular': only one regular machine is left.
 * - 'finale': every regular machine is restored (booth, then the Last Rune).
 */
export function analyseChoices(graph: MachineGraph = MACHINES): ChoiceReport {
  const states = enumerateReachableStates(graph);
  const regular = graph.map((m) => m.id).filter(isRegular);
  const single: {
    solved: readonly MachineId[];
    door: MachineId;
    reason: SingleDoorReason | 'unexplained';
  }[] = [];
  const softlocks: (readonly MachineId[])[] = [];
  let open = 0;
  let multi = 0;
  let earliest = Number.POSITIVE_INFINITY;
  for (const s of states) {
    if (s.solved.length === graph.length) continue;
    open++;
    if (s.available.length === 0) {
      softlocks.push(s.solved);
      continue;
    }
    if (s.available.length >= 2) {
      multi++;
      continue;
    }
    const door = s.available[0]!;
    const unsolvedRegular = regular.filter((id) => !s.solved.includes(id));
    let reason: SingleDoorReason | 'unexplained' = 'unexplained';
    if (s.solved.length === 0) reason = 'start';
    else if (unsolvedRegular.length === 0) reason = 'finale';
    else if (unsolvedRegular.length === 1) reason = 'last-regular';
    else {
      const closure = new Set([door, ...dependentsOf(door, graph)]);
      if (unsolvedRegular.length === closure.size && unsolvedRegular.every((x) => closure.has(x))) {
        reason = 'gate';
        earliest = Math.min(earliest, regular.length - unsolvedRegular.length);
      }
    }
    single.push({ solved: s.solved, door, reason });
  }
  return {
    stateCount: states.length,
    openStates: open,
    multiDoorStates: multi,
    singleDoorStates: single,
    softlocks,
    earliestGatePinch: earliest,
  };
}
