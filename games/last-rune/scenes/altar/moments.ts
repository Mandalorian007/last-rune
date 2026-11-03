/**
 * Phone altar moments (mobile-5-moments, D-040 addendum 3): what the how-to line says, and when
 * it retires. Pure TS, unit-tested. The altar scene asks; the CSS in ui/phone-styles.ts puts the
 * line in its own slot under the tray, apart from FUSE's bubble.
 *
 * - The line teaches the tap: "Tap a gem, then a socket", then "Now tap a socket" while a gem
 *   is in hand (with "↻ Turn spins it" when the held gem turns).
 * - Phones page an altar's arrival card: one new piece at a time, `INTRO_PAGE_SECS` each, so
 *   the card stays one short chip in the column above Strike (three rows did not fit).
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

/** Seconds each page of a phone's arrival card shows. */
export const INTRO_PAGE_SECS = 4;

/** Which page (0-based) of an arrival card with `pages` pages shows `t` seconds in; it loops. */
export function introPage(pages: number, t: number): number {
  if (pages <= 1) return 0;
  return Math.floor(Math.max(0, t) / INTRO_PAGE_SECS) % pages;
}

/** How long a phone's arrival card stays (unless it waits for the first placement). */
export function introSecs(pages: number, base: number): number {
  return Math.max(base, pages * INTRO_PAGE_SECS);
}
