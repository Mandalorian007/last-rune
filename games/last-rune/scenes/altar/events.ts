/**
 * Dev-only playtest hook: what happened at the altar, for difficulty tuning.
 *
 * Local only. Nothing is sent anywhere and nothing is stored; listeners run in the page.
 * In production builds `emitPuzzleEvent` is a no-op (the `import.meta.env.DEV` branch is
 * stripped), so `onPuzzleEvent` listeners never fire there.
 *
 *   onPuzzleEvent((e) => console.table(e));       // in the dev console via window.__game
 */
import type { BoltOutcome } from '../../game/flow';
import type { MachineId } from '../../rules/types';

export type PuzzleEvent =
  | { type: 'open'; machine: MachineId; t: number }
  | {
      type: 'strike';
      machine: MachineId;
      t: number;
      outcome: BoltOutcome;
      attempt: number;
      gems: number;
    }
  | { type: 'reset'; machine: MachineId; t: number; kind: 'clear' | 'undo' }
  | {
      type: 'close';
      machine: MachineId;
      t: number;
      solved: boolean;
      /** Seconds spent at the altar this visit. */
      seconds: number;
      attempts: number;
      resets: number;
      outcomes: Record<BoltOutcome, number>;
    };

type Listener = (e: PuzzleEvent) => void;
const listeners = new Set<Listener>();

/** Subscribe (dev builds only). Returns an unsubscribe function. */
export function onPuzzleEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitPuzzleEvent(e: PuzzleEvent): void {
  if (!import.meta.env.DEV) return;
  for (const fn of listeners) fn(e);
}
