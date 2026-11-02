/**
 * The game's input bindings (engine/input has none of its own).
 * Esc while a panel is open is consumed by engine/ui's panel stack and never reaches `cancel`.
 */
import type { Bindings } from '@engine/input';

export type Action =
  | 'select' // primary pointer button / tap
  | 'confirm' // keyboard/pad activate the focused thing
  | 'cancel' // back out (puzzle → hall, hall → settings)
  | 'next' // cycle keyboard focus (hall alcoves, codex pages)
  | 'prev'
  | 'codex' // global: open the codex (pitch: "reachable from every puzzle, always")
  | 'settings'
  | 'journal'; // the journal desk (from the hall)

export const BINDINGS: Bindings<Action> = {
  select: [{ mouse: 0 }],
  confirm: [{ key: 'Enter' }, { key: 'Space' }, { padButton: 0 }],
  cancel: [{ key: 'Escape' }, { key: 'Backspace' }, { padButton: 1 }],
  next: [
    { key: 'ArrowRight' },
    { key: 'ArrowDown' },
    { key: 'KeyD' },
    { padButton: 15 },
    { padButton: 13 },
  ],
  prev: [
    { key: 'ArrowLeft' },
    { key: 'ArrowUp' },
    { key: 'KeyA' },
    { padButton: 14 },
    { padButton: 12 },
  ],
  codex: [{ key: 'KeyC' }, { padButton: 3 }],
  settings: [{ key: 'KeyO' }, { padButton: 9 }],
  journal: [{ key: 'KeyJ' }],
};
