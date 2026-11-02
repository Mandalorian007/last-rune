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
  /** The charge maths, one line, in sparks. */
  readonly maths: string;
}

export const CODEX_RULE_MAX_WORDS = 24;
export const CODEX_MATHS_MAX_CHARS = 44;

/** Shown on every card's footer: how a bolt is counted. */
export const CODEX_SPARKS = '1 bolt = 4 sparks. A 2× storm fires 8, a 4× storm 16.';

export const CODEX: Readonly<Record<GemKind, CodexEntry>> = {
  channel: {
    gem: 'channel',
    name: 'Channel',
    rule: 'Carries the bolt straight on, whichever way it enters. Charge unchanged.',
    maths: 'out = in',
  },
  bend: {
    gem: 'bend',
    name: 'Bend',
    rule: 'Turns the bolt 90° between its two joined sides. Hit it from any other side and the bolt fizzles.',
    maths: 'out = in, turned 90°',
  },
  split: {
    gem: 'split',
    name: 'Split',
    rule: 'Sends the bolt out both sides, left and right, at half charge each. An odd charge fizzles.',
    maths: '4 → 2 + 2 · odd → fizzle',
  },
  amplify: {
    gem: 'amplify',
    name: 'Amplify',
    rule: 'Doubles the charge, once per path. A bolt that already passed an amber goes through unchanged.',
    maths: '4 → 8 · 8 → 8 (already amber)',
  },
  gate: {
    gem: 'gate',
    name: 'Gate',
    rule: 'Two side inputs, one output. Fires only when both inputs arrive in the same strike, and sends their sum.',
    maths: 'out = a + b, only if both live',
  },
  capacitor: {
    gem: 'capacitor',
    name: 'Capacitor',
    rule: 'Stores the first bolt it gets. The next strike, it releases the stored charge plus the new one.',
    maths: 'strike 1: 0 · strike 2: stored + in',
  },
};

export function codexEntry(gem: GemKind): CodexEntry {
  return CODEX[gem];
}
