/**
 * Journal desk model (pure: no DOM, no GPU). What the desk shows for a save's
 * journal state: sixteen slots in page order, found or blank, and which are new.
 *
 * Pages are read in the Builder's page order, not the order they were found
 * (content/journal.ts). Unfound pages stay blank slots that only hint at their
 * tier. "New" means found but not yet opened on the desk; the highlight stays
 * up for the whole visit even after the page is opened (the scene snapshots
 * the model on enter).
 */
import { JOURNAL, type JournalPage } from '../../content/journal';
import type { Tier } from '../../rules/types';

export interface JournalSlot {
  readonly page: number;
  readonly tier: Tier;
  readonly found: boolean;
  /** Found and never opened on the desk. */
  readonly fresh: boolean;
  /** The page itself, only when found (unfound slots never carry text). */
  readonly entry: JournalPage | null;
}

export interface JournalModel {
  /** All sixteen slots, in page order. */
  readonly slots: readonly JournalSlot[];
  /** Page numbers that can be opened, in page order. */
  readonly readable: readonly number[];
  readonly foundCount: number;
  readonly total: number;
  readonly freshCount: number;
}

export function journalModel(found: readonly number[], read: readonly number[]): JournalModel {
  const pages = [...JOURNAL].sort((a, b) => a.page - b.page);
  const slots: JournalSlot[] = pages.map((p) => {
    const isFound = found.includes(p.page);
    return {
      page: p.page,
      tier: p.tier,
      found: isFound,
      fresh: isFound && !read.includes(p.page),
      entry: isFound ? p : null,
    };
  });
  const readable = slots.filter((s) => s.found).map((s) => s.page);
  return {
    slots,
    readable,
    foundCount: readable.length,
    total: slots.length,
    freshCount: slots.filter((s) => s.fresh).length,
  };
}

/** The page the desk opens on: the first new page, else the first found page, else null. */
export function initialPage(model: JournalModel): number | null {
  const fresh = model.slots.find((s) => s.fresh);
  if (fresh) return fresh.page;
  return model.readable[0] ?? null;
}

/** Step through the readable pages (wraps). Returns `current` when nothing else is readable. */
export function stepPage(model: JournalModel, current: number | null, dir: 1 | -1): number | null {
  const r = model.readable;
  if (r.length === 0) return null;
  const i = current === null ? -1 : r.indexOf(current);
  if (i < 0) return dir > 0 ? r[0]! : r[r.length - 1]!;
  return r[(i + dir + r.length) % r.length]!;
}

/** Roman tier numeral for the blank-slot hint. */
export function tierNumeral(tier: Tier): string {
  return ['I', 'II', 'III', 'IV'][tier - 1] ?? String(tier);
}
