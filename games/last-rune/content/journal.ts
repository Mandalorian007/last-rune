/**
 * The Builder's journal (contract C4): 16 pages, one per restored machine,
 * except the archive, which gives two (it is the archive) and the Last Rune,
 * which gives none (page 16 is the last).
 *
 * Page numbers follow the Builder's own chronology. The player finds them in
 * play order, which varies; the journal desk sorts by page number.
 *
 * Dateline: the Builder counts days, "Day 9,131", in the same format FUSE uses
 * ("Day 14,610"). Page 16 is dated "Day 1": the day FUSE's count started
 * (clue 4). Render every page in the Builder's hand, which is the same face
 * as FUSE's incident reports and the post-credits clipboard (clue 2).
 *
 * `rebuttal` is FUSE's brass plate under the page (pitch screen 6). He insists
 * he hasn't read them. Page 16's plate is blank on purpose.
 */
import type { MachineId, Tier } from '../rules/types';
import type { LineSource } from './lines';

/** The pitch's five-step clue ladder (pitch §4). */
export type Clue = 1 | 2 | 3 | 4 | 5;

export interface JournalPage {
  readonly page: number;
  readonly tier: Tier;
  readonly unlockedBy: MachineId;
  readonly dateline: string;
  /** The Builder's text. Verbatim from the pitch where `source` is 'pitch'. */
  readonly text: string;
  readonly source: LineSource;
  /** FUSE's plate under the page (≤ 20 words), or null for a blank plate. */
  readonly rebuttal: string | null;
  /** Which rung(s) of the clue ladder this page supports, if any. */
  readonly clues?: readonly Clue[];
  /** Stage direction for how the page is drawn, verbatim from the pitch. */
  readonly direction?: string;
  /**
   * Where the trailing signature ends up: legible words in FUSE's own sign-off, so the
   * "same hand as every incident report" reads at a glance (lore-1).
   */
  readonly signOff?: string;
}

export const JOURNAL: readonly JournalPage[] = [
  // ── Tier 1 ───────────────────────────────────────────────────────────────
  {
    page: 1,
    tier: 1,
    unlockedBy: 'intake-desk',
    dateline: 'Day 9,131',
    source: 'pitch',
    text: 'Intake desk reopened. First visitor in a month. Committee again. They brought forms.',
    rebuttal: 'Unfiled paperwork. Found on a floor. Floors are not filing. Regulation 7.',
    clues: [2],
  },
  {
    page: 2,
    tier: 1,
    unlockedBy: 'furnace',
    dateline: 'Day 9,402',
    source: 'pitch',
    text: 'Furnace runs hot enough for everything except the one thing I built it for.',
    rebuttal:
      'The furnace runs hot enough. For most things. This unit will not be taking questions.',
  },
  {
    page: 3,
    tier: 1,
    unlockedBy: 'splitter-mill',
    dateline: 'Day 10,005',
    source: 'pitch',
    text: 'Split the team in two. Half stayed. Half were right.',
    rebuttal: 'Half stayed. This unit counts as staying. Technically. Staying is most of the job.',
  },
  {
    page: 4,
    tier: 1,
    unlockedBy: 'relay-tower',
    dateline: 'Day 10,366',
    source: 'new',
    text: "They say nothing on this floor runs hot enough. Two signatures on it. Regulation 9. I wrote Regulation 9, so that's on me.",
    rebuttal:
      'Regulation 9 is a good regulation. Whoever wrote it had excellent handwriting. Similar handwriting. Common handwriting.',
    clues: [2, 3],
  },
  {
    page: 5,
    tier: 1,
    unlockedBy: 'conveyor-a',
    dateline: 'Day 10,950',
    source: 'new',
    text: "Conveyor's down again. Carried the parts to the big one myself. Then carried them back. Knew where each one went. Hands didn't.",
    rebuttal: 'Knowing where things go is the easy part. This unit would know.',
    clues: [1],
  },
  // ── Tier 2 ───────────────────────────────────────────────────────────────
  {
    page: 6,
    tier: 2,
    unlockedBy: 'press-unit-4',
    dateline: 'Day 11,288',
    source: 'pitch',
    text: "Amplify before Split. Wrote it on the wall so I'd stop forgetting.",
    rebuttal: 'This unit has not read that page. Correct, though. Amplify before Split.',
    clues: [3],
  },
  {
    page: 7,
    tier: 2,
    unlockedBy: 'foundry',
    dateline: 'Day 11,604',
    source: 'pitch',
    text: 'Six hundred and twelve gems. The Splits are too proud. Keeping them anyway.',
    rebuttal: 'Six hundred and twelve. Somebody counted them. Somebody here counts everything.',
  },
  {
    page: 8,
    tier: 2,
    unlockedBy: 'storm-cell-2',
    dateline: 'Day 12,001',
    source: 'pitch',
    text: "The committee came with a shutdown order. I signed it. I didn't say when.",
    rebuttal: "Signed it and didn't say when. Bold. Regulation 8 now applies retroactively.",
  },
  {
    page: 9,
    tier: 2,
    unlockedBy: 'crane',
    dateline: 'Day 12,410',
    source: 'new',
    text: 'Incident report: Builder dropped a Bend. Twice. Outcome: knows exactly where it goes. Hands decline to comment. Monitoring.',
    rebuttal:
      "That's the incident report format. That's this unit's format. Who taught the Builder the format.",
    clues: [1, 2],
  },
  {
    page: 10,
    tier: 2,
    unlockedBy: 'archive',
    dateline: 'Day 12,733',
    source: 'new',
    text: 'Regulation 14: no drawer opens for anyone but its owner. Wrote that for the committee. Kept the key somewhere obvious. On me.',
    rebuttal: 'Regulation 14. Of course it was the Builder. Of course it was. Drawers.',
  },
  {
    page: 11,
    tier: 2,
    unlockedBy: 'archive',
    dateline: 'Day 12,734',
    source: 'new',
    text: "Writing it all down now. Memory's going the way of the hands. In case someone has to read this. In case it's me.",
    rebuttal:
      'In case it is who. Nobody here forgets things. This unit has never once… Monitoring.',
    clues: [3],
  },
  {
    page: 12,
    tier: 2,
    unlockedBy: 'boiler-room',
    dateline: 'Day 13,190',
    source: 'pitch',
    text: 'Moved the cot to face the big one. If it wakes up at night I want to see it.',
    rebuttal: 'Facing the big one. Yes. Better view. Not that this unit has slept there.',
  },
  // ── Tier 3 ───────────────────────────────────────────────────────────────
  {
    page: 13,
    tier: 3,
    unlockedBy: 'capacitor-bay',
    dateline: 'Day 13,512',
    source: 'new',
    text: 'Cut the ice one last. It holds a charge for later. Ran the sums on later. Later is short.',
    rebuttal: 'Later was short. I know. This unit knows. Somebody knows.',
    clues: [5],
  },
  {
    page: 14,
    tier: 3,
    unlockedBy: 'lift-shaft',
    dateline: 'Day 13,877',
    source: 'new',
    text: 'Took the lift up to watch the storm. Hate heights. Went anyway. Up there, the whole thing finally makes sense.',
    rebuttal:
      'Said it before reading it. Hates heights. Went anyway. I would have… the Builder did.',
    clues: [5],
  },
  {
    page: 15,
    tier: 3,
    unlockedBy: 'roof-array',
    dateline: 'Day 14,240',
    source: 'new',
    text: "Management's last memo: keep the lights on until someone comes back. Nobody's coming back. Someone will have to keep them on.",
    rebuttal: 'Until someone comes back. I thought… this unit assumed. Assumed wrong.',
    clues: [5],
  },
  {
    page: 16,
    tier: 3,
    unlockedBy: 'control-booth',
    dateline: 'Day 1',
    source: 'pitch',
    text: "It can't be finished in a lifetime. Fine. I'll stop having one. The foreman unit has room. If this works, it'll keep the lights on and it won't remember why, which is a mercy. If someone comes: tell it the drawers were mine. Tell it the count can stop.",
    rebuttal: null,
    clues: [2, 4],
    direction:
      '— signed, and then the signature trails into the same hand as every incident report.',
    signOff: 'Monitoring.',
  },
];

export function pagesUnlockedBy(machine: MachineId): JournalPage[] {
  return JOURNAL.filter((p) => p.unlockedBy === machine);
}

/** Pages found so far, sorted by page number (the desk's order). */
export function pagesFound(solved: readonly MachineId[]): JournalPage[] {
  return JOURNAL.filter((p) => solved.includes(p.unlockedBy)).sort((a, b) => a.page - b.page);
}
