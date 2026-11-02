/**
 * Playtest hook: everything the player does at the altar, as a stream of events, for
 * difficulty tuning and (later) hints that react to play.
 *
 * Dev/local only. Nothing is sent anywhere and nothing is stored; listeners run in the page.
 * In production builds `emitPuzzleEvent` is a no-op (the `import.meta.env.DEV` branch is
 * stripped), so listeners never fire there. In dev the hook is also on `window.__altar`:
 *
 *   __altar.onPuzzleEvent((e) => console.log(e.type, e));
 *
 * Every event carries the machine and `t`, seconds since the altar opened. `placements` is a
 * copy of the player's board at that moment (locked hint gems included, fixed gems not).
 */
import type { BoltOutcome } from '../../game/flow';
import type { Placement, Rot } from '../../rules';
import type { Cell, GemKind, MachineId } from '../../rules/types';
import { altarHints } from './hints';

interface Base {
  machine: MachineId;
  t: number;
}

/** One machine's result for a fire: its need and the charge it read on each strike. */
export interface FireMachine {
  at: Cell;
  need: number;
  outcome: BoltOutcome;
  /** Charge arriving at this machine per strike (index = strike, 0-based). */
  readings: number[];
}

export type PuzzleEvent =
  | (Base & { type: 'open'; placements: Placement[]; attempts: number })
  /** A gem placed from the tray (`from` null) or moved from another socket. */
  | (Base & { type: 'place'; gem: GemKind; cell: Cell; rot: Rot; from: Cell | null })
  /** A gem taken off the board back to the tray (or into the hand). */
  | (Base & { type: 'remove'; gem: GemKind; cell: Cell })
  | (Base & { type: 'rotate'; gem: GemKind; cell: Cell; rot: Rot })
  | (Base & { type: 'reset'; kind: 'clear' | 'undo'; placements: Placement[] })
  | (Base & {
      type: 'fire';
      /** 1-based attempt number at this altar (all visits). */
      attempt: number;
      placements: Placement[];
      outcome: BoltOutcome;
      machines: FireMachine[];
      strikes: number;
    })
  /** The hint mechanism acted (see hints.ts). */
  | (Base & {
      type: 'hint';
      kind: 'highlight' | 'lock';
      cell: Cell | null;
      gem: GemKind | null;
    })
  | (Base & {
      type: 'close';
      solved: boolean;
      /** Seconds spent at the altar this visit. */
      seconds: number;
      /** Fires this visit. */
      attempts: number;
      /** Undo + clear presses this visit. */
      resets: number;
      outcomes: Record<BoltOutcome, number>;
      placements: Placement[];
    });

export type PuzzleEventType = PuzzleEvent['type'];

type Listener = (e: PuzzleEvent) => void;
const listeners = new Set<Listener>();

/** Subscribe (fires in dev builds only). Returns an unsubscribe function. */
export function onPuzzleEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** True when anyone is listening (lets the scene skip building event payloads). */
export function puzzleEventsWanted(): boolean {
  return import.meta.env.DEV && listeners.size > 0;
}

export function emitPuzzleEvent(e: PuzzleEvent): void {
  if (!import.meta.env.DEV) return;
  for (const fn of listeners) fn(e);
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __altar: unknown }).__altar = { onPuzzleEvent, hints: altarHints };
}
