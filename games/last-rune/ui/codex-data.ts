/**
 * Codex page model (pure). Rule copy comes from `content/codex.ts`; FUSE's
 * margin notes from `content/lines.ts`.
 */
import { CODEX } from '../content/codex';
import { codexNote } from '../content/lines';
import { granterOf, hasCapability, type ProgressState, socketColour } from '../rules/progression';
import { GEM_KINDS, type GemKind, type MachineId } from '../rules/types';
import { CSS_PALETTE } from './styles';

/**
 * Where the player stands with a gem:
 * - `unknown`: never met; the page is chained shut.
 * - `seen`: met at an altar (fixed on a board or in a tray) but not earned yet. Page open.
 * - `yours`: earned (Channel always is). Page open.
 */
export type CodexStatus = 'unknown' | 'seen' | 'yours';

export interface CodexPage {
  readonly gem: GemKind;
  readonly name: string;
  /** CSS colour of the gem's glow. */
  readonly colour: string;
  readonly status: CodexStatus;
  /** The page is readable: the gem has been seen or is yours. */
  readonly unlocked: boolean;
  /** Readable but not opened yet. */
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

/**
 * One page per gem. `opened` = pages already viewed (clears "new"); `met` = gems met at an
 * altar (opens their page before they are earned).
 */
export function codexPages(
  state: ProgressState,
  opened: readonly GemKind[],
  met: readonly GemKind[] = [],
): CodexPage[] {
  return GEM_KINDS.map((gem) => {
    const cap = gem === 'channel' ? null : ({ type: 'gem', gem } as const);
    const owned = cap === null || hasCapability(state, cap);
    const status: CodexStatus = owned ? 'yours' : met.includes(gem) ? 'seen' : 'unknown';
    const unlocked = status !== 'unknown';
    const teacher = cap ? granterOf(cap) : undefined;
    const colour = cap
      ? CSS_PALETTE[socketColour(cap) as keyof typeof CSS_PALETTE]
      : CSS_PALETTE.cyan;
    return {
      gem,
      name: gemName(gem),
      colour,
      status,
      unlocked,
      fresh: unlocked && gem !== 'channel' && !opened.includes(gem),
      rule: CODEX[gem].rule,
      maths: CODEX[gem].maths,
      taughtBy: teacher ? { id: teacher.id, name: teacher.name } : null,
      note: codexNote(gem)?.text ?? null,
    };
  });
}
