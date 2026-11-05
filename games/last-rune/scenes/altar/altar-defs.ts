/** The altar scene's shared types, constants and small helpers (altar-scene.ts and its method modules). */
import type { RGBA } from '@thunderclap/engine/render';
import { h } from '@thunderclap/engine/ui';
import { GEM_COLOUR, pitch } from '../../art/props/palette';
import type { Cell, GemKind, MachineId } from '../../rules/types';
import { dpxOf, frameScale } from '../../ui/frame-units';

export type Mode = 'edit' | 'strike' | 'result';

export interface Hand {
  kind: GemKind;
  rot: number;
  /** Dragging a placed gem: where it came from (it stays on the board until dropped). */
  from: Cell | null;
}

export interface Press {
  /** `aim`: a finger down on the board with a gem in hand; it lands where the finger lifts. */
  origin: 'tray' | 'board' | 'aim';
  cell: Cell | null;
  x: number;
  y: number;
  dragging: boolean;
  /** Scene time at the press (a long touch shows the info card instead of picking up). */
  t: number;
  /** A tap on the tray gem already in hand: lifting the finger puts it back (mobile-6-board). */
  again?: boolean;
}

/** A touch held this long on a placed gem shows its card and selects it for ↻ (no pick-up). */
export const HOLD_SECS = 0.45;
/** Touch: how long the held gem's card stays up after the pick (no hover to keep it). */
export const TOUCH_CARD_SECS = 2.5;
export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Where a gem on the info card is: hovered in the tray, on the board, fixed, or newly turnable. */
export type InfoHow = 'tray' | 'turnsTray' | 'board' | 'boardTurns' | 'fixed' | 'turns';
export const INFO_TAG: Record<InfoHow, string> = {
  tray: '',
  turnsTray: 'R or scroll to turn',
  board: '',
  boardTurns: 'R or scroll to turn · Click to pick up',
  fixed: 'Fixed in place',
  turns: 'R or scroll to turn',
};

/**
 * Why a gem will not turn, shown at that gem (R, Q, scroll or RB over it). Straight-through
 * gems need no turning; a fixed Bend, Gate or Split is part of the machine.
 */
export const NO_TURN: Record<GemKind, string> = {
  channel: "Can't turn: charge goes straight through",
  amplify: "Can't turn: charge goes straight through",
  capacitor: "Can't turn: charge goes straight through",
  split: "Can't turn: fixed in place",
  bend: "Can't turn: fixed in place",
  gate: "Can't turn: fixed in place",
};

export const SIDE_NAME = ['north', 'east', 'south', 'west'] as const;

/** Which sides a Bend, Gate or Split at `rot` uses, for the announcer (rules.md section 4). */
export function sidesText(gem: GemKind, rot: number): string {
  const s = (k: number) => SIDE_NAME[(((rot + k) % 4) + 4) % 4]!;
  if (gem === 'bend') return `joins ${s(0)} and ${s(1)}`;
  if (gem === 'gate') return `in from ${s(3)} and ${s(1)}, out ${s(0)}`;
  if (gem === 'split') return `in from ${s(2)}, out ${s(3)} and ${s(1)}`;
  return '';
}

export const GEM_NAME: Record<GemKind, string> = {
  channel: 'Channel',
  bend: 'Bend',
  split: 'Split',
  amplify: 'Amplify',
  gate: 'Gate',
  capacitor: 'Capacitor',
};

export const DENY_REASON: Record<string, string> = {
  blocked: 'Solid stone: nothing goes here',
  fixed: "Fixed: can't be moved or replaced",
  'tray-empty': 'None left in the tray',
  'out-of-bounds': 'Off the altar',
  occupied: 'Socket taken',
};

/**
 * Edit-time route preview: while editing, the route strike 1 would take through the gems
 * already set lies faintly in grooves, and the empty socket it would reach next glows softly.
 * It shows direction only, never charge. Off = the board shows only the storm and machine
 * conduits. PM decision (difficulty): see docs/workstreams/altar-clarity.md.
 */
export const OUTCOME_WORD: Record<string, string> = {
  exact: 'exact',
  under: 'not enough',
  over: 'too much, breaker tripped',
  dead: 'no charge',
};

/** "a", "a and b", "a, b and c". */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export const PREVIEW_PATH = true;
/** Seconds without a board change before the first altar nudges. */
export const TEACH_IDLE = 9;
/** Seconds a new gem's card shows on arrival (less if the player places a gem first). */
export const INTRO_SECS = 7;
/** The card fades over its last this-many seconds. */
export const INTRO_FADE = 0.5;
export const TEACH_MACHINE: MachineId = 'intake-desk';
/**
 * The first altar's arrival card also says what the gold socket rings mean: the teach socket,
 * the machine's exit and, once building, the open ends of the route all ring gold.
 */
export const RING_NAME = 'Gold ring';
export const RING_RULE = 'A socket the charge must reach. Set a gem there.';
/**
 * teach-4: the first altar's arrival card opens with the goal and what Strike does, before the
 * pieces (blind review 6: nobody said what Strike was for). D-043: Strike is a free test, so the
 * card says a miss costs nothing.
 */
export const GOAL_NAME = 'Goal';
export const GOAL_RULE =
  "Bring the storm's charge to the gauge: exactly what it Needs. Strike any time to see what it gets; a miss costs nothing.";
/** D-043: said once, under the verdict of the player's first miss ever. */
export const FIRST_MISS_LINE = 'A miss costs nothing. Strike as often as you like.';
/**
 * teach-4: the first altar that strikes more than once explains Strike's count and "in one
 * strike" before its pieces (blind review 6: players learned multi-strike by failing).
 * teach-5: under "Strike ×2", in plain words: one tap, both strikes, one after the other; a
 * miss resets for free. teach-6: it names the marks beside "Strike ×2" (blind review 8 read
 * them as "00"); the card's title shows the same marks. teach-8: "each lighting a mark" didn't
 * say what a mark was (blind review 10); it says the marks are the strikes.
 * polish-11 (D-040 add. 12, C): "Strike ×2 ○○ ○○ = your two strikes" read as four strikes, so
 * the marks show once, in the title, and the rule follows it after a colon: "Strike ×2 ○○: your
 * two strikes, one tap sends both."
 */
export function strikesRule(pulses: number): string {
  const n = pulses === 2 ? 'two' : String(pulses);
  return `your ${n} strikes, one tap sends ${pulses === 2 ? 'both' : 'them all'}. A miss resets for free.`;
}
/**
 * teach-8 (D-040 add. 11, A): the multi-strike rule, said once in plain words, on its own page
 * after the strikes page. Three gauge phrases failed blind review ("in one strike", "in either
 * strike", "on strike 1 or 2"); the gauge now says "on one strike" and this page says what that
 * means. Its words are `ONE_STRIKE_RULE`, the same in the codex and the a11y briefing. As the
 * sim reads it (rules/sim.ts): each strike, a gauge that hasn't woken reads that strike alone;
 * exactly its number wakes it, more trips it, less does nothing. No amount, ever (D-043).
 */
export function eitherName(_pulses: number): string {
  return 'On one strike';
}
export const ONE_STRIKE_RULE =
  "Each strike is checked on its own. Exactly the gauge's number on one strike wakes it. Less does nothing; more trips it.";
/**
 * polish-11 (D-040 add. 12, A): the card's own form, under its title "On one strike". The title
 * says "each strike on its own", so the card drops that sentence: with it the page ran a line
 * past an SE's lane (Capacitor Bay). The codex and the a11y briefing keep `ONE_STRIKE_RULE`.
 */
export const ONE_STRIKE_CARD =
  "Exactly the gauge's number wakes it. Less does nothing; more trips it.";
export function eitherRule(_pulses: number): string {
  return ONE_STRIKE_CARD;
}
/**
 * teach-5: the first Amplify card. Its picture shows 4 in, 8 out; the line under it says the
 * rest. teach-6: in words ("8 → 8" read as a typo). teach-8: "once per path" never said what a
 * path was (blind review 10; Furnace has two built-in Amplifies), so it says "once" and the
 * line under it says a second one doesn't double again.
 * polish-11 (D-040 add. 12, C): "A second Amplify" left "second where?" and "does it pass the
 * charge?" open; the card uses the rule's own words (codex `amplify.rule`, less "even split
 * since", which the long-press card and the codex keep).
 */
export const AMPLIFY_ONCE = 'Doubles the charge once.';
export const AMPLIFY_AGAIN = 'Charge already doubled passes through unchanged.';
/**
 * teach-4: the Capacitor's two strikes (before FUSE's joke).
 * teach-6: each line says the whole strike (blind review 8: "Strike 1: stores 8 →" dangled).
 * teach-7: "stores", not "keeps" (blind review 9: jargon), the word the board's tag uses.
 * polish-11 (D-040 add. 12, C): no numbers. "stores 8 … 8 + 8 = 16" read as if a Capacitor
 * always sends 16 (Roof Array, The Last Rune); the lines say what it does with any charge, and
 * no line forecasts this board before Strike (D-043).
 */
export const CAPACITOR_STRIP: readonly [string, string] = [
  'Strike 1: stores, sends nothing.',
  'Strike 2: sends stored + new.',
];

export const SLOT_ACTIONS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
export const CYAN: RGBA = [0.25, 1.3, 1.8, 1];
/** Fixed gems wear cold iron, not gold: gold marks where the player acts. */
export const WHITE_HOT: RGBA = [2, 2, 2, 1];
export const OPEN_END: RGBA = [1.5, 1.05, 0.5, 1];
/** The ring round every socket the held gem may go in: a warm gold line (calmer, glyph-truth). */
export const LEGAL_RING: RGBA = [1.05, 0.74, 0.3, 1];
/** Conduit colours by outcome (match the need label's CSS colours). */
export const OUT_GLOW: Record<'exact' | 'under' | 'over' | 'flow', RGBA> = {
  exact: [0.35, 1.6, 2.2, 1],
  under: [2.0, 1.0, 0.25, 1],
  over: [2.4, 0.4, 0.25, 1],
  flow: [0.9, 1.2, 1.8, 1],
};
/** Socket hum colour per gem (the socket glows in the held gem's colour when it fits). */
export const HUM = Object.fromEntries(
  (Object.keys(GEM_COLOUR) as GemKind[]).map((k) => [k, pitch(GEM_COLOUR[k], 1.3)]),
) as Record<GemKind, RGBA>;
export const DRAG_PX = 10;
/** Seconds per sim tick at normal speed. */
export const TICK = 0.15;
export const SKIP_RATE = 10;
export const FF_RATE = 3;

export type HintMode = 'mouse' | 'keys' | 'strike' | 'touch' | 'touchHeld' | 'touchStrike' | 'off';

/** The key-hint line for each mode. Short enough to sit under the tray at 150% text. */
export function hintLine(mode: HintMode, turns = true): (Node | string)[] {
  const b = (t: string) => h('b', null, t);
  switch (mode) {
    case 'mouse':
      return [
        b('Click'),
        ' a gem below, then a socket · ',
        b('R'),
        ' or ',
        b('scroll'),
        ' turns the gem you point at · ',
        b('Right-click'),
        ' removes',
      ];
    case 'keys':
      return [
        b('1–6'),
        ' pick a gem · ',
        b('Arrows'),
        ' move · ',
        b('Enter'),
        ' place / pick up · ',
        b('R'),
        ' turns · ',
        b('G'),
        ' end of the route',
      ];
    case 'strike':
      return ['Hold ', b('F'), ' to speed up · ', b('Click'), ' or ', b('Enter'), ' to skip'];
    case 'touch':
      return turns
        ? [
            b('Tap'),
            ' a gem, then a socket · ',
            h('span', { class: 'lr-nowrap' }, b('\u21bb'), ' turns it'),
          ]
        : [b('Tap'), ' a gem, then a socket'];
    case 'touchHeld':
      return turns
        ? [
            'Now ',
            b('tap'),
            ' a socket · ',
            h('span', { class: 'lr-nowrap' }, b('\u21bb Turn'), ' spins it'),
          ]
        : ['Now ', b('tap'), ' a socket'];
    case 'off':
      return [];
    case 'touchStrike':
      return [b('Tap'), ' to skip'];
  }
}

/**
 * An element's box in design pixels from its inline left/top and its size, so the answer holds
 * while the pop-in animations are still moving it. Verdicts hang from their top centre; tags sit
 * above their anchor (arrow down, 7px) or, with data-below, under it (arrow up).
 */
export function designBox(el: HTMLElement): { l: number; r: number; t: number; b: number } {
  const k = frameScale(el);
  const x = dpxOf(el.style.left);
  const y = dpxOf(el.style.top);
  const w = el.offsetWidth / k;
  const h = el.offsetHeight / k;
  const tag = el.classList.contains('lr-altar-tag');
  const t = !tag ? y : el.hasAttribute('data-below') ? y : y - h - 7;
  return { l: x - w / 2, r: x + w / 2, t, b: t + h + (tag ? 7 : 0) };
}

/** Whether two boxes overlap, with `pad` design pixels of breathing room. */
export function boxesTouch(a: HTMLElement, b: HTMLElement, pad: number): boolean {
  const r = designBox(a);
  const q = designBox(b);
  return r.l < q.r + pad && r.r > q.l - pad && r.t < q.b + pad && r.b > q.t - pad;
}

/** "twice", "3 times": how many strikes one tap of Strike fires (mobile-5-board). */
export function timesWord(n: number): string {
  return n === 2 ? 'twice' : `${n} times`;
}
