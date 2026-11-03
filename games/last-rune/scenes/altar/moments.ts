/**
 * Phone altar moments (mobile-5-moments, D-040 addendum 3): what the how-to line says, and when
 * it retires. Pure TS, unit-tested. The altar scene asks; the CSS in ui/phone-styles.ts puts the
 * line in its own slot under the tray, apart from FUSE's bubble.
 *
 * - The line teaches the tap: "Tap a gem, then a socket", then "Now tap a socket" while a gem
 *   is in hand (with "↻ Turn spins it" when the held gem turns).
 * - It retires once the player has restored `HINT_RETIRE` machines: by then the tap is known and
 *   the line is noise. The strike's "Tap to skip" stays (it says something new each time).
 */

/** Machines restored before the phone how-to line retires. */
export const HINT_RETIRE = 3;

/** The how-to line on a phone at rest (not striking). */
export type PhoneHint = 'touch' | 'touchHeld' | 'off';

/** Whether the phone how-to line has retired for a player who has restored `solved`. */
export function hintRetired(solved: readonly string[]): boolean {
  return solved.length >= HINT_RETIRE;
}

/** The phone how-to line for this moment. */
export function phoneHint(retired: boolean, holding: boolean): PhoneHint {
  if (retired) return 'off';
  return holding ? 'touchHeld' : 'touch';
}
