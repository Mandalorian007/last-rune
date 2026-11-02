/**
 * Codex page model (pure). Rule copy comes from `content/codex.ts`; FUSE's
 * margin notes from `content/lines.ts`.
 */
import { CODEX } from '../content/codex';
import { codexNote } from '../content/lines';
import { granterOf, hasCapability, type ProgressState, socketColour } from '../rules/progression';
import { GEM_KINDS, type GemKind, type MachineId } from '../rules/types';
import { CSS_PALETTE } from './styles';

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
  return CODEX[g].name;
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
      rule: CODEX[gem].rule,
      maths: CODEX[gem].maths,
      taughtBy: teacher ? { id: teacher.id, name: teacher.name } : null,
      note: codexNote(gem)?.text ?? null,
    };
  });
}
