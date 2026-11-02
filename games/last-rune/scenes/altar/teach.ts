/**
 * First-appearance teaching (altar-clarity). Pure TS, unit-tested.
 *
 * A gem kind is **new** on an altar when it is on this altar (fixed or in the tray) and on no
 * altar the player has already solved. Its first appearance gets intake-desk's treatment: the
 * socket (fixed gem) or tray slot (tray gem) pulses until the player has touched it or struck
 * once, the gem's rule shows beside it, and FUSE says a one-line hint.
 *
 * Hint text is a named placeholder hook: `content/lines.ts` belongs to story-scenes. When a line
 * with the hook's id lands there it replaces the provisional text here.
 */
import { LINES } from '../../content/lines';
import type { PuzzleDef } from '../../rules';
import type { Cell, GemKind, MachineId } from '../../rules/types';

export interface TeachHook {
  /** Line id story-scenes should add to content/lines.ts. */
  id: string;
  /** Provisional instruction copy (not story text). */
  text: string;
}

/** Placeholder hooks, by id. PROVISIONAL copy: replace via content/lines.ts. */
export const TEACH_HOOKS = {
  'altar.teach.place': 'Take a gem from the tray. Put it in the glowing socket.',
  'altar.teach.fixed.bend': 'That Bend is part of the machine. It turns the bolt.',
  'altar.teach.fixed.amplify': 'Amplify. It doubles whatever runs through it.',
  'altar.teach.fixed.split': 'A Split. Two ways out, half the charge each.',
  'altar.teach.fixed.gate': 'A Gate needs both inputs live, or nothing comes out.',
  'altar.teach.fixed.capacitor': 'A Capacitor. It holds a strike and lets it go with the next.',
  'altar.teach.fixed.channel': 'A Channel. It carries charge straight through.',
  'altar.teach.tray.channel': 'Channels carry charge in a straight line.',
  'altar.teach.tray.bend': 'Bends turn the bolt. Press R or scroll to turn one.',
  'altar.teach.tray.amplify': 'Amplify doubles the charge. Once per path.',
  'altar.teach.tray.split': 'Split sends half each way.',
  'altar.teach.tray.gate': 'Gate: both inputs live, or nothing. Press R to turn it.',
  'altar.teach.tray.capacitor': 'Capacitor: it stores one strike for the next.',
} as const satisfies Record<string, string>;

export type TeachHookId = keyof typeof TEACH_HOOKS;

/** Resolve a hook: the real FUSE line if story-scenes has added it, else the placeholder. */
export function teachLine(id: TeachHookId): string {
  return LINES.find((l) => l.id === id)?.text ?? TEACH_HOOKS[id];
}

export interface NewGems {
  /** New kinds that sit fixed on this altar, with the first such socket. */
  fixed: { gem: GemKind; cell: Cell }[];
  /** New kinds in the tray (not already introduced as a fixed gem here). */
  tray: GemKind[];
}

function kindsOf(p: PuzzleDef): Set<GemKind> {
  const s = new Set<GemKind>();
  for (const f of p.fixed) s.add(f.gem);
  for (const [k, n] of Object.entries(p.tray)) if ((n ?? 0) > 0) s.add(k as GemKind);
  return s;
}

/**
 * Gems this altar introduces, given the puzzles already solved. Fixed gems are listed in the
 * order they appear; the tray kinds in tray order.
 */
export function newGems(p: PuzzleDef, solved: readonly PuzzleDef[]): NewGems {
  const seen = new Set<GemKind>();
  for (const q of solved) if (q.id !== p.id) for (const k of kindsOf(q)) seen.add(k);
  const fixed: NewGems['fixed'] = [];
  const done = new Set<GemKind>();
  for (const f of p.fixed) {
    if (seen.has(f.gem) || done.has(f.gem)) continue;
    done.add(f.gem);
    fixed.push({ gem: f.gem, cell: { x: f.cell.x, y: f.cell.y } });
  }
  const tray: GemKind[] = [];
  for (const [k, n] of Object.entries(p.tray)) {
    const g = k as GemKind;
    if ((n ?? 0) > 0 && !seen.has(g) && !done.has(g)) tray.push(g);
  }
  return { fixed, tray };
}

/**
 * The FUSE hint hooks for an altar's new gems, in the order FUSE should say them. The first
 * altar's tray Channel is taught by the place nudge, so it gets no hook of its own there.
 */
export function teachHooks(news: NewGems, machine: MachineId): TeachHookId[] {
  const out: TeachHookId[] = [];
  for (const f of news.fixed) out.push(`altar.teach.fixed.${f.gem}` as TeachHookId);
  for (const g of news.tray) {
    if (machine === 'intake-desk' && g === 'channel') continue;
    out.push(`altar.teach.tray.${g}` as TeachHookId);
  }
  return out;
}
