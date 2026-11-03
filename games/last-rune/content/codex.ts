/**
 * Codex copy: one card per gem. The single source of the rule text the codex
 * panel shows (`ui/codex-data.ts` reads it). FUSE's margin notes live in
 * `lines.ts` (`codexNote`), not here.
 *
 * Consistent with `docs/design/rules.md`, written as the player sees it. "Charge" is the one
 * noun for what flows (mobile-6-moments): no bolts, fizzles, stems or arms. Each rule names
 * what the gem's glyph shows (the Bend's bent line, the Split's plain end and arrows, the
 * Gate's side lines and arrow). A 1× storm gives 4 (2× = 8, 4× = 16), and the gauge wants an
 * exact fill. Card limits: `rule` ≤ CODEX_RULE_MAX_WORDS
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
   * wraps to at most three lines in a third of a phone screen). Says what `rule` says, lost
   * charge included; a long-press shows `rule` in full.
   */
  readonly chip: string;
  /** The charge maths, one line, in sparks. */
  readonly maths: string;
}

export const CODEX_RULE_MAX_WORDS = 24;
export const CODEX_MATHS_MAX_CHARS = 44;
export const CODEX_CHIP_MAX_CHARS = 68;

/** Shown on every card's footer: how charge is counted. */
export const CODEX_SPARKS = 'The numbers are charge. A storm gives 4 a strike; 2× gives 8, 4× 16.';

export const CODEX: Readonly<Record<GemKind, CodexEntry>> = {
  channel: {
    gem: 'channel',
    name: 'Channel',
    rule: 'Carries the charge straight through, whichever way it enters. The charge is unchanged.',
    chip: 'Carries the charge straight through, unchanged.',
    maths: 'out = in',
  },
  bend: {
    gem: 'bend',
    name: 'Bend',
    rule: 'Turns the charge round the corner along its bent line, either way. Charge entering any other side is lost.',
    chip: 'Turns the charge along its bent line. Other sides lose it.',
    maths: 'out = in, round the corner',
  },
  split: {
    gem: 'split',
    name: 'Split',
    rule: 'Charge enters at the plain end and leaves by both arrows, half each. Odd charge, or charge from any other side, is lost.',
    chip: 'In at the plain end, half out each arrow. Odd or wrong side: lost.',
    maths: '4 → 2 + 2 · odd → lost',
  },
  amplify: {
    gem: 'amplify',
    name: 'Amplify',
    rule: 'Doubles the charge, once per path. Charge that has already passed an Amplify, even split since, goes through unchanged.',
    chip: 'Doubles the charge, once per path. Already doubled: unchanged.',
    maths: '4 → 8 · 8 → 8 (already doubled)',
  },
  gate: {
    gem: 'gate',
    name: 'Gate',
    rule: 'Takes charge in on both side lines. If both arrive in the same strike, their sum leaves by the arrow. Otherwise it is lost.',
    chip: 'Both side lines in one strike: their sum leaves by the arrow.',
    maths: 'out = a + b, only if both arrive',
  },
  capacitor: {
    gem: 'capacitor',
    name: 'Capacitor',
    rule: 'Keeps the first charge it gets; nothing comes out. Next strike, the new charge pushes both out together, straight on.',
    chip: 'Keeps its first charge. Next strike, lets out both together.',
    maths: 'strike 1: 0 · strike 2: stored + in',
  },
};

export function codexEntry(gem: GemKind): CodexEntry {
  return CODEX[gem];
}
