/**
 * Pure hall model: what every alcove shows for a given progress state. No DOM,
 * no GPU. The hall scene derives this once per progress change and hands it
 * to a `HallView` (placeholder now, real art later).
 *
 * Pitch screen 2: restored alcoves hold a lit gem; unlocked ones glow gold with
 * an empty socket in the colour they will grant; locked ones show dark dotted
 * sockets in the colours they need, plus a padlock. Cyan conduits run between
 * what you've woken.
 */

import { type FuseLine, lockedLineFor, machineLine, socketLine } from '../../content/lines';
import { MACHINES } from '../../content/machines';
import {
  type CapabilityKey,
  capabilityKey,
  capabilityLabel,
  conduits,
  isSolved,
  isUnlocked,
  type MachineDef,
  type MachineGraph,
  missingFor,
  missingMachinesFor,
  type ProgressState,
  type SocketColour,
  socketColour,
} from '../../rules/progression';
import type { MachineId } from '../../rules/types';

export type AlcoveStatus = 'solved' | 'unlocked' | 'locked';

export interface SocketModel {
  readonly capability: CapabilityKey;
  readonly colour: SocketColour;
  /** Words for the socket ("Bend", "Storm ×2"), so the door isn't read by colour alone. */
  readonly label: string;
  /** Storm sockets show `rings` concentric rings (strength); otherwise 1. */
  readonly rings: number;
}

export interface AlcoveModel {
  readonly id: MachineId;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly status: AlcoveStatus;
  /** Colour of the gem it holds (solved) or will grant (unlocked). Null for no-grant machines. */
  readonly grantColour: SocketColour | null;
  /** Empty sockets on a locked door, in requirement order. Empty unless locked. */
  readonly missing: readonly SocketModel[];
  /** Machines still to restore (control booth's lamp row). 0 unless locked by machines. */
  readonly missingMachines: number;
  /** The finale disc in the middle of the floor rather than a wall alcove. */
  readonly floor: boolean;
}

export interface ConduitModel {
  readonly from: MachineId;
  readonly to: MachineId;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly colour: SocketColour;
  /** The granting machine is restored. */
  readonly lit: boolean;
}

export interface HallModel {
  readonly alcoves: readonly AlcoveModel[];
  readonly conduits: readonly ConduitModel[];
}

/** Hit box around an alcove centre, design px. Views should draw within it. */
export const ALCOVE_HIT = { w: 200, h: 170 } as const;

export function alcoveStatus(
  m: MachineDef,
  state: ProgressState,
  graph: MachineGraph,
): AlcoveStatus {
  if (isSolved(m.id, state)) return 'solved';
  return isUnlocked(m, state, graph) ? 'unlocked' : 'locked';
}

export function deriveHall(state: ProgressState, graph: MachineGraph = MACHINES): HallModel {
  const alcoves: AlcoveModel[] = graph.map((m) => {
    const status = alcoveStatus(m, state, graph);
    const missing =
      status === 'locked'
        ? missingFor(m, state, graph).map((c) => ({
            capability: capabilityKey(c),
            colour: socketColour(c),
            label: capabilityLabel(c),
            rings: c.type === 'storm' ? c.strength : 1,
          }))
        : [];
    return {
      id: m.id,
      name: m.name,
      x: m.alcove.x,
      y: m.alcove.y,
      status,
      grantColour: m.grants ? socketColour(m.grants) : null,
      missing,
      missingMachines: status === 'locked' ? missingMachinesFor(m, state, graph).length : 0,
      floor: m.id === 'the-last-rune',
    };
  });
  const byId = new Map(graph.map((m) => [m.id, m]));
  const wires: ConduitModel[] = conduits(graph).map((c) => {
    const a = byId.get(c.from)!;
    const b = byId.get(c.to)!;
    const grant = a.grants!;
    return {
      from: c.from,
      to: c.to,
      x0: a.alcove.x,
      y0: a.alcove.y,
      x1: b.alcove.x,
      y1: b.alcove.y,
      colour: socketColour(grant),
      lit: isSolved(c.from, state),
    };
  });
  return { alcoves, conduits: wires };
}

/** Alcove under a design-space point, or null. Floor disc is round. */
export function alcoveAt(model: HallModel, x: number, y: number): AlcoveModel | null {
  for (const a of model.alcoves) {
    if (a.floor) {
      if (Math.hypot(x - a.x, y - a.y) <= ALCOVE_HIT.h * 0.6) return a;
    } else if (Math.abs(x - a.x) <= ALCOVE_HIT.w / 2 && Math.abs(y - a.y) <= ALCOVE_HIT.h / 2) {
      return a;
    }
  }
  return null;
}

/** Machines that became unlocked between two states (for the "door opens" moment). */
export function newlyUnlocked(
  before: ProgressState,
  after: ProgressState,
  graph: MachineGraph = MACHINES,
): MachineId[] {
  return graph
    .filter(
      (m) => !isSolved(m.id, after) && isUnlocked(m, after, graph) && !isUnlocked(m, before, graph),
    )
    .map((m) => m.id);
}

/**
 * What FUSE says when an alcove is hovered or clicked:
 * - unlocked: the arrive line;
 * - solved: the solve line (a reminder of what he said);
 * - locked: the door's own locked line if its condition holds, else the socket
 *   line for the first empty socket. The Last Rune's empty-socket fallback is
 *   silence until it is open (pitch: "No line on arrival").
 */
export function lineForAlcove(a: AlcoveModel): FuseLine | undefined {
  if (a.status === 'unlocked') return machineLine(a.id, 'arrive');
  if (a.status === 'solved') return machineLine(a.id, 'solve');
  const own = lockedLineFor(
    a.id,
    a.missing.map((m) => m.capability),
    a.missingMachines,
  );
  if (own) return own;
  const first = a.missing[0];
  return first ? socketLine(first.capability) : undefined;
}

/**
 * The name plate's status line. A locked door names what it is waiting for in words, so
 * the coloured sockets aren't the only cue.
 */
export function alcoveNote(a: AlcoveModel): string {
  if (a.status === 'solved') return 'Restored';
  if (a.status === 'unlocked') return 'Open · click or Enter to restore';
  const needs = a.missing.map((m) => m.label);
  if (a.missingMachines > 0) {
    needs.push(`${a.missingMachines} more machine${a.missingMachines === 1 ? '' : 's'}`);
  }
  return needs.length ? `Locked · needs ${needs.join(', ')}` : 'Locked';
}

/** Keyboard focus order: front of the hall to the back, then left to right. */
export function focusOrder(model: HallModel): MachineId[] {
  return [...model.alcoves].sort((a, b) => b.y - a.y || a.x - b.x).map((a) => a.id);
}
