/**
 * Phone altar moments (mobile-5-moments, mobile-6-moments; D-040 addenda 3 and 4): what the
 * how-to line says and when it retires, the arrival card's pages, and who owns the phone's right
 * column at any moment. Pure TS, unit-tested. The altar scene measures and asks; the CSS in
 * ui/phone-styles.ts lays the column out.
 *
 * - The line teaches the tap: "Tap a gem, then a socket", then "Now tap a socket" while a gem
 *   is in hand (with "↻ Turn spins it" when the held gem turns). Other workstreams may put their
 *   own line in that slot (`HINT_SLOTS`: "Holding: X", "Tap the board to zoom").
 * - It retires once the player has restored `HINT_RETIRE` machines: by then the tap is known and
 *   the line is noise. The strike's "Tap to skip" stays (it says something new each time).
 * - Phones show an altar's arrival card one new piece at a time, and the player pages it with
 *   "Next ›" / "Got it" (`introButton`); it never turns a page by itself.
 * - One owner of the column (`arbitrate`): the verdict, then the teach card, then a gem's tip,
 *   then the how-to line, then FUSE's bubble. A lower voice that does not fit shrinks to one
 *   line if it can, else waits (FUSE's caption is frozen, not dropped), so nothing ever overlaps.
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

/**
 * Lines that may stand in the how-to slot, highest first. `holding` is mobile-6-board's
 * "Holding: X", `zoom` is mobile-6-zoom's "Tap the board to zoom"; `howto` is this file's
 * `phoneHint`. Set one with `AltarScene.setHintLine(slot, text)`; `null` clears it.
 */
export const HINT_SLOTS = ['holding', 'zoom', 'howto'] as const;
export type HintSlot = (typeof HINT_SLOTS)[number];

/** The slot whose line shows: the first in `HINT_SLOTS` order with any text. */
export function pickHint(lines: Partial<Record<HintSlot, string | null>>): HintSlot | null {
  return HINT_SLOTS.find((s) => !!lines[s]) ?? null;
}

/** The arrival card's button on page `page` (0-based) of `pages`: next page, or close it. */
export function introButton(page: number, pages: number): 'Next ›' | 'Got it' {
  return page < pages - 1 ? 'Next ›' : 'Got it';
}

/** Who may speak in the phone's right column, most important first. */
export const VOICES = ['verdict', 'teach', 'tip', 'hint', 'fuse'] as const;
export type Voice = (typeof VOICES)[number];

/** One thing that wants room in the column. Heights in any one unit (the scene uses CSS px). */
export interface VoiceAsk {
  readonly id: string;
  readonly voice: Voice;
  /** Height shown whole. */
  readonly full: number;
  /** Height shrunk to one line, if it can shrink. */
  readonly line?: number;
}

export type Grant = 'full' | 'line' | 'wait';

/**
 * Share the column's `room` among `asks`, highest voice first (input order within a voice),
 * with `gap` between neighbours. Each gets its whole height if that fits in what is left, else
 * one line if it has one and that fits, else it waits. The verdict is the moment's answer: it is
 * never shrunk or held back, even when it alone overfills the room.
 */
export function arbitrate(
  asks: readonly VoiceAsk[],
  room: number,
  gap: number,
): Map<string, Grant> {
  const order = asks
    .map((a, i) => ({ a, i }))
    .sort((p, q) => VOICES.indexOf(p.a.voice) - VOICES.indexOf(q.a.voice) || p.i - q.i);
  const out = new Map<string, Grant>();
  let used = 0;
  for (const { a } of order) {
    const need = (h: number) => used + (used > 0 ? gap : 0) + h;
    if (a.voice === 'verdict' || need(a.full) <= room) {
      used = need(a.full);
      out.set(a.id, 'full');
    } else if (a.line !== undefined && need(a.line) <= room) {
      used = need(a.line);
      out.set(a.id, 'line');
    } else out.set(a.id, 'wait');
  }
  return out;
}
