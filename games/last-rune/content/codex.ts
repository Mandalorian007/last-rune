/**
 * Codex copy: one card per gem. The single source of the rule text the codex
 * panel shows (`ui/codex-data.ts` reads it). FUSE's margin notes live in
 * `lines.ts` (`codexNote`), not here.
 *
 * Consistent with `docs/design/rules.md`, written as the player sees it. "Charge" is the one
 * noun for what flows (mobile-6-moments): no bolts, fizzles, stems or arms. Each rule names
 * what the gem's glyph shows (the Bend's bent line, the Split's round port and arrows, the
 * Gate's ports and arrow). A 1× storm gives 4 (2× = 8, 4× = 16), and the gauge wants an
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
  /**
   * A worked example: one line with real numbers, in the Capacitor read-out's style ("Strike 1:
   * stores 4. Strike 2: 4 + 4 → 8."). The codex card, the phone's gem chip and the arrival card
   * all show it (mobile-7-teach).
   */
  readonly maths: string;
}

export const CODEX_RULE_MAX_WORDS = 24;
export const CODEX_MATHS_MAX_CHARS = 44;
export const CODEX_CHIP_MAX_CHARS = 68;

/** Shown on every card's footer: how charge is counted. */
/**
 * teach-7 (D-040 add. 10, D): the Gate in one sentence, the same on the teach card, the gem
 * chip and the codex (blind review 9 met it worded two ways: "from above and below" on Relay
 * Tower's card, "both sides beside the arrow" on Foundry's chip). It names what the glyph draws
 * (ws/held-gem): an inward port on each input side, one arrow out.
 */
export const GATE_RULE = 'Both ports, same strike: the sum leaves by the arrow.';

export const CODEX_SPARKS = 'The numbers are charge. A storm gives 4 a strike; 2× gives 8, 4× 16.';

export const CODEX: Readonly<Record<GemKind, CodexEntry>> = {
  channel: {
    gem: 'channel',
    name: 'Channel',
    rule: 'Carries the charge straight through, whichever way it enters. The charge is unchanged.',
    chip: 'Carries the charge straight through, unchanged.',
    maths: 'In 4 → out 4, straight on.',
  },
  bend: {
    gem: 'bend',
    name: 'Bend',
    rule: 'Turns the charge round the corner along its bent line, either way. Charge entering any other side is lost.',
    chip: 'Turns the charge along its bent line. Other sides lose it.',
    maths: 'In 4 → out 4, round the corner.',
  },
  split: {
    gem: 'split',
    name: 'Split',
    rule: 'Charge goes in at the round port; half comes out of each arrow. Odd charge, or charge from another side, is lost.',
    chip: 'In at the round port, half out of each arrow; odd charge lost.',
    maths: 'In 4 → out 2 and 2. Odd charge is lost.',
  },
  amplify: {
    gem: 'amplify',
    name: 'Amplify',
    rule: 'Doubles the charge, once per path. Charge that has already passed an Amplify, even split since, goes through unchanged.',
    chip: 'Doubles the charge, once per path. Already doubled: unchanged.',
    maths: 'In 4 → out 8. Doubled already: 8 stays 8.',
  },
  gate: {
    gem: 'gate',
    name: 'Gate',
    // teach-4: "both sides" alone read as the board's left and right; teach-6: "both sides of
    // the arrow" read as its head and tail. teach-7: the inputs are ports, the output the arrow.
    rule: `${GATE_RULE} One port alone, or charge at the back, is lost.`,
    chip: GATE_RULE,
    maths: 'In 4 and 4 → out 8. Only one in: lost.',
  },
  capacitor: {
    gem: 'capacitor',
    name: 'Capacitor',
    // teach-7: "stores" everywhere (blind review 9: "keeps" was jargon).
    rule: 'Stores the first charge it gets; nothing comes out. Next strike, the new charge pushes both out together, straight on.',
    chip: 'Stores its first charge; next strike, lets out both.',
    maths: 'Strike 1: stores 4. Strike 2: 4 + 4 → 8.',
  },
};

/**
 * What a gem the player didn't place is, in plain words (altar-truth): the short form opens a
 * fixed gem's line on the arrival card (it must fit an SE), the full form its card on a tap.
 */
export const FIXED_NOTE = 'Built in.';
export const FIXED_NOTE_FULL = "Built in: you can't move or turn it.";
/** A tray gem on the arrival card, where the same card also teaches a fixed gem. */
export const YOURS_NOTE = 'Yours to place.';

export function codexEntry(gem: GemKind): CodexEntry {
  return CODEX[gem];
}
