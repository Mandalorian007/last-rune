/**
 * The game's input bindings (engine/input has none of its own).
 * Esc while a panel is open is consumed by engine/ui's panel stack and never reaches `cancel`.
 */
import type { Bindings } from '@thunderclap/engine/input';

export type Action =
  | 'select' // primary pointer button / tap
  | 'confirm' // keyboard/pad activate the focused thing
  | 'cancel' // back out (puzzle → hall, hall → settings)
  | 'next' // cycle keyboard focus (hall alcoves, codex pages)
  | 'prev'
  | 'codex' // global: open the codex (pitch: "reachable from every puzzle, always")
  | 'settings'
  // Altar (puzzle scene). Several share keys with the hall's next/prev; scenes read only theirs.
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'alt' // secondary pointer button: take a gem back off the altar
  | 'rotate'
  | 'rotateBack'
  | 'undo'
  | 'remove'
  | 'strike'
  | 'clear'
  | 'trayNext'
  | 'jump' // keyboard cursor to the wire's open end (the next empty socket the bolt reaches)
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4'
  | 'slot5'
  | 'slot6'
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
  up: [{ key: 'ArrowUp' }, { key: 'KeyW' }, { padButton: 12 }, { padAxis: 1, dir: -1 }],
  down: [{ key: 'ArrowDown' }, { key: 'KeyS' }, { padButton: 13 }, { padAxis: 1, dir: 1 }],
  left: [{ key: 'ArrowLeft' }, { key: 'KeyA' }, { padButton: 14 }, { padAxis: 0, dir: -1 }],
  right: [{ key: 'ArrowRight' }, { key: 'KeyD' }, { padButton: 15 }, { padAxis: 0, dir: 1 }],
  alt: [{ mouse: 2 }],
  rotate: [{ key: 'KeyR' }, { key: 'KeyE' }, { wheel: 1 }, { padButton: 5 }],
  rotateBack: [{ key: 'KeyQ' }, { wheel: -1 }],
  undo: [{ key: 'KeyZ' }, { padButton: 6 }],
  remove: [{ key: 'KeyX' }, { padButton: 2 }],
  strike: [{ key: 'KeyF' }, { padButton: 7 }],
  clear: [{ key: 'Delete' }, { padButton: 8 }],
  trayNext: [{ key: 'KeyT' }, { padButton: 4 }],
  jump: [{ key: 'KeyG' }, { padButton: 11 }],
  slot1: [{ key: 'Digit1' }],
  slot2: [{ key: 'Digit2' }],
  slot3: [{ key: 'Digit3' }],
  slot4: [{ key: 'Digit4' }],
  slot5: [{ key: 'Digit5' }],
  slot6: [{ key: 'Digit6' }],
  journal: [{ key: 'KeyJ' }],
};
