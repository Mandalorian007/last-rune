/**
 * Codex copy: one card per gem. The single source of the rule text the codex
 * panel shows (`ui/codex-data.ts` reads it). FUSE's margin notes live in
 * `lines.ts` (`codexNote`), not here.
 *
 * Consistent with `docs/design/rules.md`, written as the player sees it:
 * charge is counted in sparks, a 1× bolt is 4 sparks (2× = 8, 4× = 16), and
 * the gauge wants an exact fill. Card limits: `rule` ≤ CODEX_RULE_MAX_WORDS
 * words, `maths` ≤ CODEX_MATHS_MAX_CHARS characters on one line.
 */
import type { GemKind } from '../rules/types';

export interface CodexEntry {
  readonly gem: GemKind;
  /** Display name on the card. */
  readonly name: string;
  /** What the gem does, in plain words. */
  readonly rule: string;
  /**
   * The whole rule in one short line, for the phone's gem chip (≤ CODEX_CHIP_MAX_CHARS, so it
   * wraps to at most three lines in a third of a phone screen). Says what `rule` says, fizzles
   * included; a long-press shows `rule` in full.
   */
  readonly chip: string;
  /** The charge maths, one line, in sparks. */
  readonly maths: string;
}

export const CODEX_RULE_MAX_WORDS = 24;
export const CODEX_MATHS_MAX_CHARS = 44;
export const CODEX_CHIP_MAX_CHARS = 68;

/** Shown on every card's footer: how a bolt is counted. */
export const CODEX_SPARKS = '1 bolt = 4 sparks. A 2× storm fires 8, a 4× storm 16.';

export const CODEX: Readonly<Record<GemKind, CodexEntry>> = {
  channel: {
    gem: 'channel',
    name: 'Channel',
    rule: 'Carries the bolt straight on, whichever way it enters. Charge unchanged.',
    chip: 'Carries the bolt straight on. Charge unchanged.',
    maths: 'out = in',
  },
  bend: {
    gem: 'bend',
    name: 'Bend',
    rule: 'Turns the bolt 90° between its two joined sides. Hit it from any other side and the bolt fizzles.',
    chip: 'Turns the bolt 90° between its two joined sides. Other sides fizzle.',
    maths: 'out = in, turned 90°',
  },
  split: {
    gem: 'split',
    name: 'Split',
    rule: 'Takes the bolt in at its stem and sends it out both arms, half charge each. Any other side, or an odd charge, fizzles.',
    chip: 'Stem in, both arms out, half each. Odd charge or other side fizzles.',
    maths: '4 → 2 + 2 · odd → fizzle',
  },
  amplify: {
    gem: 'amplify',
    name: 'Amplify',
    rule: 'Doubles the charge, once per path. A bolt that already passed an amber goes through unchanged.',
    chip: 'Doubles the charge, once per path.',
    maths: '4 → 8 · 8 → 8 (already amber)',
  },
  gate: {
    gem: 'gate',
    name: 'Gate',
    rule: 'Two side inputs, one output. Fires only when both inputs arrive in the same strike, and sends their sum.',
    chip: 'Fires their sum, only if both side inputs arrive in one strike.',
    maths: 'out = a + b, only if both live',
  },
  capacitor: {
    gem: 'capacitor',
    name: 'Capacitor',
    rule: 'Stores the first bolt it gets. The next strike, it releases the stored charge plus the new one.',
    chip: 'Stores its first bolt; next strike, sends it plus the new one.',
    maths: 'strike 1: 0 · strike 2: stored + in',
  },
};

export function codexEntry(gem: GemKind): CodexEntry {
  return CODEX[gem];
}
