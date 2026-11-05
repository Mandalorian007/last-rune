/**
 * Phone altar moments (mobile-5-moments, mobile-6-moments; D-040 addenda 3 and 4): what the
 * how-to line says and when it retires, the arrival card's pages, and who owns the phone's right
 * column at any moment. Pure TS, unit-tested. The altar scene measures and asks; the CSS in
 * altar-column-styles.ts lays the column out.
 *
 * - The line teaches the tap: "Tap a gem, then a socket", then "Now tap a socket" while a gem
 *   is in hand (with "↻ Turn spins it" when the held gem turns). Other workstreams may put their
 *   own line in that slot (`HINT_SLOTS`: "Holding: X").
 * - It retires once the player has restored `HINT_RETIRE` machines: by then the tap is known and
 *   the line is noise. The strike's "Tap to skip" stays (it says something new each time).
 * - Phones show an altar's arrival card one new piece at a time, and the player pages it with
 *   "Next ›" / "Got it" (`introButton`); it never turns a page by itself.
 * - One owner of the column (`arbitrate`): the verdict, then the teach card, then a gem's tip,
 *   then the how-to line, then FUSE's bubble. A lower voice that does not fit shrinks to one
 *   line if it can, else waits (FUSE's caption is frozen, not dropped), so nothing ever overlaps.
 */

import { CODEX } from '../../content/codex';
import type { GemKind } from '../../rules/types';

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
 * "Holding: X"; `howto` is this file's `phoneHint`. Set one with `AltarScene.setHintLine(slot, text)`; `null` clears it.
 */
export const HINT_SLOTS = ['holding', 'lamp', 'howto'] as const;
export type HintSlot = (typeof HINT_SLOTS)[number];

/** The slot whose line shows: the first in `HINT_SLOTS` order with any text. */
export function pickHint(lines: Partial<Record<HintSlot, string | null>>): HintSlot | null {
  return HINT_SLOTS.find((s) => !!lines[s]) ?? null;
}

/**
 * altar-truth: the line that teaches Turn, in the `holding` slot. On an altar that teaches a
 * turnable gem, while that gem is Turn's target (in hand, or just placed) and until the player
 * has turned one here: "↻ Turn rotates the Bend." `null` otherwise. card-fit: it no longer adds "in
 * your hand" (the "Holding" pill says so), so it stays one line under a gem's card on an SE.
 */
export function turnTeachLine(
  kind: GemKind | undefined,
  where: 'hand' | 'placed',
  teaches: ReadonlySet<GemKind>,
  turned: boolean,
): string | null {
  if (!kind || turned || !teaches.has(kind)) return null;
  const name = CODEX[kind].name;
  return where === 'hand'
    ? `↻ Turn rotates the ${name}.`
    : `↻ Turn rotates the ${name} you just placed.`;
}

/**
 * teach-4: Turn stays dim while a gem that never turns is in hand. Where Turn has just been
 * taught, a line says why, so a dim Turn does not read as broken (teach-5, in plain words): "A Channel
 * works whichever way the charge comes in: no need to turn it." `null` for a gem that turns.
 */
export function straightLine(kind: GemKind | undefined | null): string | null {
  if (!kind || kind === 'bend' || kind === 'gate' || kind === 'split') return null;
  const name = CODEX[kind].name;
  const a = /^[AEIOU]/.test(name) ? 'An' : 'A';
  return `${a} ${name} works whichever way the charge comes in: no need to turn it.`;
}

/**
 * teach-4: what the dot on a "Needs" pill means, said once where it first changes. The dot
 * (altar-readout.ts `setNeed`) shows once the route as built reaches that gauge (reach.ts), lit
 * cyan; it never says how much, and it never turns red: teach-8 cut the pre-Strike trip
 * warning (D-043, no forecasts before Strike). teach-6: before the route
 * reaches a gauge it shows no mark at all (blind review 8 read the hollow ring as "0").
 */
export type LampLine = 'reach';
/**
 * teach-5: `reach` is the dot's legend, shown once per game the first time a dot lights
 * (`DOT_LEGEND` draws it, a real dot on each row). teach-6: the legend comes up even with a gem
 * in hand (it takes the gem card's place) and has its own "Got it" (altar-column.ts).
 */
export const LAMP_LINE: Record<LampLine, string> = {
  reach: 'The dot on a gauge: no dot, no charge yet; lit, charge reaches it.',
};
/**
 * The legend's rows, each led by the dot as the gauge draws it ('off' has none, as on the
 * gauge). Never an amount and never "enough" (D-043): a lit dot means reach, not a promise.
 */
export const DOT_LEGEND_HEAD = 'The dot on a gauge:';
export const DOT_LEGEND: readonly { readonly look: 'off' | 'on'; readonly text: string }[] = [
  { look: 'off', text: 'No dot: no charge yet' },
  { look: 'on', text: 'Lit: charge reaches it' },
];

/**
 * Which dot line to show, if any: red outranks lit. `teachReach`: this player has not seen the
 * legend yet (once per game, until the strike after it shows); `teachOver`: the first Capacitor
 * altar.
 */
export function lampLine(a: { reached: boolean; teachReach: boolean }): LampLine | null {
  if (a.reached && a.teachReach) return 'reach';
  return null;
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
 * one line if it has one and that fits, else it waits. The first to ask is the owner and always
 * shows whole (it has the room to itself). The verdict is the moment's answer: it is
 * never shrunk or held back, even when it alone overfills the room.
 *
 * While a teach card is up it is the one panel beside the verdict (mobile-7-teach, D-040
 * addendum 5): the how-to line and FUSE's bubble wait, however much room is left, so the
 * newcomer reads one thing and its button.
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
  const teaching = asks.some((a) => a.voice === 'teach');
  for (const { a } of order) {
    if (teaching && (a.voice === 'hint' || a.voice === 'fuse')) {
      out.set(a.id, 'wait');
      continue;
    }
    const need = (h: number) => used + (used > 0 ? gap : 0) + h;
    if (a.voice === 'verdict' || used === 0 || need(a.full) <= room) {
      used = need(a.full);
      out.set(a.id, 'full');
    } else if (a.line !== undefined && need(a.line) <= room) {
      used = need(a.line);
      out.set(a.id, 'line');
    } else out.set(a.id, 'wait');
  }
  return out;
}

/**
 * What the gem info card (the tip slot) shows, first match wins (mobile-7-teach, D-040
 * addendum 5). The rule that matters: with a gem in hand, the card describes that gem or no gem
 * at all. It never names another one beside "Holding X".
 *
 * - `pin`: the player long-pressed a gem for its full card (they asked for that one).
 * - `teach`: the arrival card. On a phone it outranks a gem's tip. While a gem is in hand it
 *   shows only if every gem on it is the held one (a page about the gold ring names no gem).
 * - `tray`: a tray gem's tip, hovered or just picked. With a gem in hand, only the held gem's.
 * - `board`: the board gem under the pointer or cursor.
 * - `none`: nothing.
 */
export type InfoSource = 'pin' | 'teach' | 'tray' | 'board' | 'none';

export interface InfoAsk {
  readonly pin: boolean;
  readonly phone: boolean;
  /** The arrival card is up. */
  readonly teachUp: boolean;
  /** The gems the arrival card names right now (a phone shows one page; [] for the ring). */
  readonly teachGems: readonly GemKind[];
  /** The gem in hand, if any. */
  readonly held: GemKind | null;
  /** The tray slot asking for its tip (hovered, or the held gem's for a moment after a pick). */
  readonly slot: GemKind | null;
  /**
   * The board gem under the pointer or cursor that may speak. With a gem in hand on a desktop,
   * that is the placed gem the hand is over (its card says R turns it); a phone, whose column
   * shows "Holding X", lets only the held kind speak.
   */
  readonly board: GemKind | null;
}

export function pickInfo(a: InfoAsk): InfoSource {
  if (a.pin) return 'pin';
  const teachOk = a.teachUp && (!a.held || a.teachGems.every((g) => g === a.held));
  if (a.phone && teachOk) return 'teach';
  if (a.slot && (!a.held || a.slot === a.held)) return 'tray';
  if (a.board && (!a.held || !a.phone || a.board === a.held)) return 'board';
  if (teachOk) return 'teach';
  return 'none';
}
