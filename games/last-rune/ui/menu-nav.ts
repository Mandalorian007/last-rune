/**
 * Up/down and gamepad A for a non-modal menu (the title, the end card), so every control on
 * it (the Ko-fi link included, D-034) is reachable without a mouse. Modal panels use the
 * engine's PadNav instead.
 *
 * Arrow keys reach this while a button or link has focus (they are Input `buttonKeys`), but
 * Enter and Space do not: the focused control handles those natively. So `confirm` is only
 * taken here when it came from a gamepad.
 *
 * A pad press is not a user gesture, so a new-tab link is opened with `window.open` and checked:
 * if the browser blocks it, the link's copy field appears instead (engine `activateLink`).
 */
import type { Input } from '@engine/input';
import { activateLink, focusableWithin } from '@engine/ui';
import type { Action } from '../game/actions';

/** What a tick of menu input did: moved focus, clicked the focused control, or nothing. */
export type MenuNavResult = 'moved' | 'clicked' | null;

export function menuNav(input: Input<Action>, root: HTMLElement): MenuNavResult {
  const step = input.pressed('down') ? 1 : input.pressed('up') ? -1 : 0;
  const active = root.ownerDocument.activeElement as HTMLElement | null;
  const inside = !!active && active !== root && root.contains(active);
  if (step) {
    const items = focusableWithin(root);
    if (!items.length) return null;
    const at = inside ? items.indexOf(active) : -1;
    const next =
      at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
    items[next]?.focus({ preventScroll: true });
    return 'moved';
  }
  if (inside && input.lastDevice === 'gamepad' && input.pressed('confirm')) {
    activateLink(active, 'gamepad');
    return 'clicked';
  }
  return null;
}
