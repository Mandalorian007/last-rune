/**
 * Codex page model (pure). Rule text is PROVISIONAL: lifted from the pitch's gem
 * list because content/ has no codex rule copy yet. Owner needed (progression-
 * content); move to content/codex.ts and delete RULES here when it lands.
 */
import { codexNote } from '../content/lines';
import { granterOf, hasCapability, type ProgressState, socketColour } from '../rules/progression';
import { GEM_KINDS, type GemKind, type MachineId } from '../rules/types';
import { CSS_PALETTE } from './styles';

const RULES: Record<GemKind, { rule: string; maths: string }> = {
  channel: { rule: 'Carries charge straight through.', maths: 'out = in' },
  bend: { rule: 'Turns the bolt 90°.', maths: 'out = in, direction ± 90°' },
  split: { rule: 'Two outputs at half charge.', maths: 'out₁ = out₂ = in ÷ 2' },
  amplify: { rule: 'Doubles the charge, once per path.', maths: 'out = in × 2  (once per path)' },
  gate: {
    rule: 'Fires only when both inputs are live.',
    maths: 'out = a + b  if a > 0 and b > 0, else 0',
  },
  capacitor: {
    rule: 'Stores a bolt; releases it with the next.',
    maths: 'bolt n: out = 0 · bolt n+1: out = stored + in',
  },
};

export interface CodexPage {
  readonly gem: GemKind;
  readonly name: string;
  /** CSS colour of the gem's glow. */
  readonly colour: string;
  readonly unlocked: boolean;
  /** Not yet opened since it was earned. */
  readonly fresh: boolean;
  readonly rule: string;
  readonly maths: string;
  /** Machine that grants the gem (null for Channel, which you start with). */
  readonly taughtBy: { id: MachineId; name: string } | null;
  readonly note: string | null;
}

export function gemName(g: GemKind): string {
  return g[0]!.toUpperCase() + g.slice(1);
}

export function codexPages(state: ProgressState, seen: readonly GemKind[]): CodexPage[] {
  return GEM_KINDS.map((gem) => {
    const cap = gem === 'channel' ? null : ({ type: 'gem', gem } as const);
    const unlocked = cap === null || hasCapability(state, cap);
    const teacher = cap ? granterOf(cap) : undefined;
    const colour = cap
      ? CSS_PALETTE[socketColour(cap) as keyof typeof CSS_PALETTE]
      : CSS_PALETTE.cyan;
    return {
      gem,
      name: gemName(gem),
      colour,
      unlocked,
      fresh: unlocked && gem !== 'channel' && !seen.includes(gem),
      rule: RULES[gem].rule,
      maths: RULES[gem].maths,
      taughtBy: teacher ? { id: teacher.id, name: teacher.name } : null,
      note: codexNote(gem)?.text ?? null,
    };
  });
}
