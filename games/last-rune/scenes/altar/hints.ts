/**
 * Hint mechanism for the altar. Mechanism only: what to hint, and when, is decided elsewhere
 * (difficulty-fun phase 2). Local only; no network, nothing stored beyond the placements the
 * altar already saves.
 *
 *   altarHints.highlight({ x: 2, y: 1 });          // pulse a socket until cleared
 *   altarHints.highlight(null);                     // clear it
 *   altarHints.lock({ gem: 'bend', cell: { x: 2, y: 0 }, rot: 2 });   // place + lock a gem
 *
 * Calls go to whichever altar is open; with none open they return false. A locked gem cannot
 * be moved, turned, removed, cleared or undone by the player (see `BoardState.lock`); it takes
 * a gem from the tray, or from the board if the tray is out. Each call emits a `hint` puzzle
 * event (dev builds).
 */
import type { Placement } from '../../rules';
import type { Cell, MachineId } from '../../rules/types';

export interface HintTarget {
  readonly machine: MachineId;
  highlight(cell: Cell | null): boolean;
  lock(p: Placement): boolean;
}

let target: HintTarget | null = null;

export const altarHints = {
  /** The machine whose altar is open, or null. */
  get machine(): MachineId | null {
    return target?.machine ?? null;
  },
  /** Pulse one socket (null clears). False if no altar is open or the cell is off the board. */
  highlight(cell: Cell | null): boolean {
    return target ? target.highlight(cell) : false;
  },
  /** Place `p` and lock it. False if no altar is open or the placement is illegal. */
  lock(p: Placement): boolean {
    return target ? target.lock(p) : false;
  },
};

/** The altar scene registers itself on enter and unregisters on exit. */
export function setHintTarget(t: HintTarget | null): void {
  target = t;
}
