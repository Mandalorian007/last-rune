/**
 * FUSE's lines (contract C4). Readable script in play order: docs/design/script.md.
 *
 * `source: 'pitch'` lines are verbatim from docs/design/pitch-v0.3.md (tested).
 * `source: 'new'` lines are written for the game in the same voice.
 *
 * Rules (pitch §4, tested in lines.test.ts):
 * - Two lines per machine (arrive, solve). A few locked doors get a third.
 * - A corner card holds at most 20 words. Pitch lines longer than that are kept
 *   verbatim and shown as two cards, split at a sentence (see `cardsOf`).
 * - FUSE reacts; he never explains a mechanic (the codex does).
 * - He is never mean to the player. Drawers, Management and rain are fair game.
 * - "I" is rationed: zero in Tier 1, and the count rises every tier.
 *
 * `tier` is the tier in which the line is heard, which for locked doors is the
 * tier before the machine's own.
 */
import type { CapabilityKey } from '../rules/progression';
import type { GemKind, MachineId, Tier } from '../rules/types';

export type LineSource = 'pitch' | 'new';
export type Outcome = 'dead' | 'under' | 'over';

/** One-off story beats outside the arrive/solve pattern. */
export type BeatId =
  | 'title-knock'
  | 'tarp'
  | 'rune-final-report'
  | 'rune-lights'
  | 'rune-not-for-you'
  | 'door-list'
  | 'door-key'
  | 'post-credits';

interface LineBase {
  /** Stable id, e.g. `furnace.arrive`. */
  readonly id: string;
  readonly text: string;
  readonly tier: Tier;
  readonly source: LineSource;
}

export type FuseLine =
  | (LineBase & { readonly kind: 'arrive' | 'solve'; readonly machine: MachineId })
  | (LineBase & {
      readonly kind: 'locked';
      readonly machine: MachineId;
      /** Shown while this socket is empty ('machines': while any machine is unrestored). */
      readonly when: CapabilityKey | 'machines';
    })
  | (LineBase & { readonly kind: 'socket'; readonly capability: CapabilityKey })
  | (LineBase & {
      readonly kind: 'reaction';
      readonly outcome: Outcome;
      /** Only use when the attempt contains this gem. */
      readonly needsGem?: GemKind;
    })
  | (LineBase & { readonly kind: 'hall'; readonly beat: 'first-entry' | 'ambient' | 'echo' })
  | (LineBase & { readonly kind: 'codex'; readonly gem: GemKind })
  | (LineBase & { readonly kind: 'beat'; readonly beat: BeatId })
  /** FUSE typing in the mock chat window (ending beat 2). Lower case on purpose. */
  | (LineBase & { readonly kind: 'chat'; readonly order: number })
  /** The altar verdict when a machine wakes on an exact solve (one per tier). */
  | (LineBase & { readonly kind: 'exact' })
  /** Idle nudges at the altar: 'teach' on the first puzzle, or a gem's first appearance. */
  | (LineBase & { readonly kind: 'nudge'; readonly nudge: 'teach' | GemKind });

type Def = FuseLine extends infer L
  ? L extends FuseLine
    ? Omit<L, 'id'> & { id?: string }
    : never
  : never;

const P = 'pitch' as const;
const N = 'new' as const;

function machineLines(
  machine: MachineId,
  tier: Tier,
  arrive: string,
  solve: string,
  source: LineSource = P,
): Def[] {
  return [
    { kind: 'arrive', machine, tier, source, text: arrive },
    { kind: 'solve', machine, tier, source, text: solve },
  ];
}

const DEFS: Def[] = [
  // ── Title and hall ───────────────────────────────────────────────────────
  {
    kind: 'beat',
    beat: 'title-knock',
    tier: 1,
    source: P,
    text: "Oh. Someone's at the door. Nobody's at the door. Nobody's been at the door for forty years.",
  },
  {
    kind: 'hall',
    beat: 'first-entry',
    tier: 1,
    source: P,
    text: 'Welcome to the facility. Start with the intake desk: the gold doorway. Mistakes cost nothing here. Management made sure. Management made a lot of them.',
  },
  {
    kind: 'hall',
    beat: 'ambient',
    tier: 1,
    source: P,
    text: "Storm's coming. Good. We're a lightning factory. Rain would be awkward.",
  },
  {
    kind: 'hall',
    beat: 'ambient',
    tier: 2,
    source: N,
    text: "Day 14,610. Still. Long day. Good long day. Don't put that in a report.",
  },
  {
    kind: 'hall',
    beat: 'echo',
    tier: 3,
    source: P,
    text: 'Press Unit 4 wants a magenta and an amber. Regulation 12. I wrote Regulation 12. I was having a day.',
  },
  {
    kind: 'hall',
    beat: 'echo',
    tier: 3,
    source: N,
    text: 'The furnace went cold the week I… the week Management left. Related. Probably related.',
  },

  // ── Tier 1 ───────────────────────────────────────────────────────────────
  ...machineLines(
    'intake-desk',
    1,
    "Day 14,610. A visitor. There's a form for that. Take a rune from the tray, set it on a lit socket. You can't break anything. Others have tried.",
    "Regulation 1: the hallway rune. Regulation 2: this unit does not do a victory noise. Bzzt. That wasn't one.",
  ),
  ...machineLines(
    'furnace',
    1,
    'The furnace. Went cold the week Management left. Everything did. Unrelated.',
    'Amber rune doubles the charge. Stack two and the second one just feels important. Like a deputy foreman.',
  ),
  ...machineLines(
    'splitter-mill',
    1,
    'Splitter Mill. Takes one thing and makes it two smaller things. Management loved it. Management loved committees.',
    "Half and half. Like this unit's optimism. Incident report #4,211: visitor appears competent. Monitoring.",
  ),
  ...machineLines(
    'relay-tower',
    1,
    'The relay. Needs two full signals to pass one. Two signatures. Regulation 9. Nobody remembers who signed.',
    "Emerald. Good. Regulation 8: don't ask where Management went. Regulation 8 is new. Regulation 8 is for you.",
  ),
  ...machineLines(
    'conveyor-a',
    1,
    'Conveyor A. Carried parts to the big one. Then carried them back. Then stopped. Very relatable machine.',
    "Moving again. The sound it makes. That's… a sound. Carry on.",
  ),

  // Locked doors heard in Tier 1.
  {
    kind: 'locked',
    machine: 'press-unit-4',
    when: 'gem:split',
    tier: 1,
    source: P,
    text: 'Needs a magenta. Regulation 12. Someone wrote Regulation 12 while having a day.',
  },
  {
    kind: 'locked',
    machine: 'boiler-room',
    when: 'storm:2',
    tier: 1,
    source: P,
    text: "Needs a double bolt. Storm Cell II. It's upstairs. Everything important is upstairs.",
  },
  {
    kind: 'locked',
    machine: 'archive',
    when: 'altar:8x6',
    tier: 1,
    source: P,
    text: 'Needs the crane. The crane needs the relay. The relay needs patience. Everything here needs something.',
  },
  {
    kind: 'locked',
    machine: 'foundry',
    when: 'gem:gate',
    tier: 1,
    source: N,
    text: 'Foundry. Wants amber and emerald. It cut them both, once. Now it wants them back. Typical foundry.',
  },
  {
    kind: 'locked',
    machine: 'the-last-rune',
    when: 'altar:10x8',
    tier: 1,
    source: N,
    text: "The big one. Everything goes in. Nothing's ever come out. Management called it a door. Management called everything something.",
  },

  // ── Tier 2 ───────────────────────────────────────────────────────────────
  ...machineLines(
    'press-unit-4',
    2,
    'Press Unit 4. Sulking since the committee. The trick is amber before magenta, never after. Not that anyone asked. Nobody asks.',
    "Amber before magenta. Told you. Didn't tell you. Thought it loudly. Incident report: visitor hears thoughts. Monitoring harder.",
  ),
  ...machineLines(
    'storm-cell-2',
    2,
    "Second storm cell. Double the bolt. The committee said it couldn't be built. The committee also said that about the first one.",
    "Two bolts. Both my eyes are on. That hasn't happened since… it's dust. There's dust. Forty years of it.",
  ),
  {
    kind: 'beat',
    beat: 'tarp',
    tier: 2,
    source: P,
    text: "That's not on the floor plan. It's checked daily. It's a lot of checking. Someone drew that from memory.",
  },
  ...machineLines(
    'crane',
    2,
    "The crane. Lifts the big stones. Hands are overrated. This unit has clamps. Clamps can't hold a gem. Noted. Resented.",
    "Bigger altar. More sockets. More ways to be wrong. Ask me how I know. Don't. Regulation 8.",
  ),
  ...machineLines(
    'boiler-room',
    2,
    "Boiler room. The Builder slept here, toward the end. There's a cot. It's a very specific cot. Nobody told this unit that.",
    "Warm. First time it's been warm in here since… the cot's facing the wrong wall. It always was. Why would that be known.",
  ),
  ...machineLines(
    'archive',
    2,
    "The archive. Drawers. Nothing but drawers. Can't open a single one. Had a long time to resent drawers. Regulation 14 is about drawers.",
    "You've read the pages. This unit hasn't. 'They say nothing on this floor runs hot enough.' That's page four. How is that… Regulation 8. Regulation 8.",
  ),
  ...machineLines(
    'foundry',
    2,
    'Foundry. Where the gems were cut. The magenta ones never came out right. Too proud. Cut them anyway.',
    'I cut… the foundry cut six hundred gems. Six hundred and twelve. Why is that a number this unit has.',
  ),

  // Locked doors heard in Tier 2.
  {
    kind: 'locked',
    machine: 'capacitor-bay',
    when: 'altar:8x6',
    tier: 2,
    source: N,
    text: 'Capacitor bay. Double bolt, bigger altar. Saving for later. Later is the one thing this facility has in stock.',
  },
  {
    kind: 'locked',
    machine: 'roof-array',
    when: 'gem:capacitor',
    tier: 2,
    source: N,
    text: 'The roof. Wants the ice rune first. Also the lift. Or the ladder. This unit does not do ladders.',
  },
  {
    kind: 'locked',
    machine: 'control-booth',
    when: 'machines',
    tier: 2,
    source: N,
    text: 'The booth. Wants every machine awake first. Regulation 3: nobody sits in the booth. Regulation 3 is firm.',
  },

  // ── Tier 3 ───────────────────────────────────────────────────────────────
  ...machineLines(
    'capacitor-bay',
    3,
    'Capacitor bay. Stores a bolt for later. The committee said that was cheating. It is. Do it anyway.',
    "Ice rune. The last one I… the last one that was cut. Didn't get to use it. Someone didn't. Monitoring self.",
  ),
  ...machineLines(
    'lift-shaft',
    3,
    "Lift to the roof. Hasn't run since the day the counting started. Day one. The count started for a reason. Can't find the form.",
    "Going up. I don't like heights. This unit doesn't have a setting for heights. So where did that come from.",
  ),
  ...machineLines(
    'roof-array',
    3,
    "The roof. The storm's right there. Forty years it's come every night and found nobody home. Tonight it's looking at you.",
    "Array's live. The whole sky's wired to the floor now. Management said keep the lights on until someone comes back. I assumed they meant them.",
  ),
  ...machineLines(
    'control-booth',
    3,
    "The booth. The Builder's chair. Nobody sits in it. It's… it's adjusted. For a unit this height. That's a coincidence. Regulation 8 covers coincidences.",
    "Page sixteen. Last page. Dated the day the count started. I haven't read it. I know what it says. I know what it says.",
  ),

  // ── The Last Rune (no arrive line: the corner card is empty) ──────────────
  {
    kind: 'beat',
    beat: 'rune-final-report',
    tier: 4,
    source: P,
    text: "Incident report, final. Visitor completed the facility. Foreman unit is going to need a new hobby. Foreman unit has had one hobby for forty years and it was this, and it was mine, and it's done.",
  },
  { kind: 'beat', beat: 'rune-lights', tier: 4, source: P, text: "Go on. I'll get the lights." },
  {
    kind: 'beat',
    beat: 'rune-not-for-you',
    tier: 4,
    source: P,
    text: "Oh. It's not for you. Is it.",
  },
  {
    kind: 'beat',
    beat: 'door-list',
    tier: 4,
    source: P,
    text: "Forty years keeping a door lit for someone to come home through. Should've checked who was on the list.",
  },
  {
    kind: 'beat',
    beat: 'door-key',
    tier: 4,
    source: P,
    text: "You'll want the forms. They're in the drawers. Turns out I had a key the whole time.",
  },
  {
    kind: 'chat',
    order: 1,
    tier: 4,
    source: P,
    text: 'hello. this unit has arrived somewhere with a great many people in it.',
  },
  { kind: 'chat', order: 2, tier: 4, source: P, text: 'you appear to be arguing about a game.' },
  { kind: 'chat', order: 3, tier: 4, source: P, text: 'day 1.' },
  {
    kind: 'beat',
    beat: 'post-credits',
    tier: 4,
    source: P,
    text: 'Day 1. Hobby: people. Monitoring.',
  },

  // ── Empty sockets: every socket comes with a reason, usually a grudge ────
  {
    kind: 'socket',
    capability: 'gem:bend',
    tier: 1,
    source: N,
    text: 'Amethyst socket. Bends are issued at the front desk. Everything is issued at the front desk.',
  },
  {
    kind: 'socket',
    capability: 'gem:split',
    tier: 1,
    source: N,
    text: "Magenta socket. Splitter Mill. Magenta is a proud colour. It knows it. Don't encourage it.",
  },
  {
    kind: 'socket',
    capability: 'gem:amplify',
    tier: 1,
    source: N,
    text: "Amber socket. The furnace keeps the amber. The furnace went cold. It's still sulking about it.",
  },
  {
    kind: 'socket',
    capability: 'gem:gate',
    tier: 1,
    source: N,
    text: 'Emerald socket. The relay hands those out. Two signatures required. Bring a friend. You are the friend.',
  },
  {
    kind: 'socket',
    capability: 'gem:capacitor',
    tier: 1,
    source: N,
    text: 'Ice socket. Capacitor bay. Ice was cut last. Nobody remembers by whom. Nobody is looking into it.',
  },
  {
    kind: 'socket',
    capability: 'storm:2',
    tier: 1,
    source: N,
    text: 'Two rings. Wants a double bolt. Storm Cell II makes those. Under a tarp. Someone put a tarp on it.',
  },
  {
    kind: 'socket',
    capability: 'storm:4',
    tier: 1,
    source: N,
    text: 'Four rings. The whole storm. Roof array. The roof is very high. That is a fact, not a feeling.',
  },
  {
    kind: 'socket',
    capability: 'altar:8x6',
    tier: 1,
    source: N,
    text: 'Wide socket. Bigger altar. The crane lifts the stones. The crane has a job. Good for the crane.',
  },
  {
    kind: 'socket',
    capability: 'altar:10x8',
    tier: 1,
    source: N,
    text: "Widest socket. The whole slab. That's booth business. Nobody goes in the booth. Regulation 3.",
  },

  // ── Reactions to a failed bolt (dead = went nowhere, under, over = breaker)
  {
    kind: 'reaction',
    outcome: 'dead',
    needsGem: 'bend',
    tier: 1,
    source: P,
    text: 'Incident report #4,211: visitor set a Bend facing a wall. Outcome: wall remains unpowered. Visitor remains hopeful.',
  },
  {
    kind: 'reaction',
    outcome: 'dead',
    tier: 1,
    source: N,
    text: 'Bolt went nowhere. Very calm about it. Regulation 4: nowhere is not a destination.',
  },
  {
    kind: 'reaction',
    outcome: 'under',
    tier: 1,
    source: N,
    text: 'Machine felt that. Machine would like more of that. Machines are like that.',
  },
  {
    kind: 'reaction',
    outcome: 'over',
    tier: 1,
    source: N,
    text: 'Breaker. Too much. Generous, though. Incident report #4,211: visitor is generous. Monitoring.',
  },
  {
    kind: 'reaction',
    outcome: 'dead',
    tier: 2,
    source: N,
    text: "Dead end. The bolt knew. You'll know next time. That's how it went the first time, too.",
  },
  {
    kind: 'reaction',
    outcome: 'under',
    tier: 2,
    source: N,
    text: 'Short. The gauge twitched. This unit twitched too. Sympathetically. Not a malfunction.',
  },
  {
    kind: 'reaction',
    outcome: 'over',
    tier: 2,
    source: N,
    text: 'Breaker again. It used to trip at three in the morning. Someone used to reset it. In slippers.',
  },
  {
    kind: 'reaction',
    outcome: 'dead',
    tier: 3,
    source: N,
    text: "Nowhere. Again. I've… this unit has seen worse.",
  },
  {
    kind: 'reaction',
    outcome: 'under',
    tier: 3,
    source: N,
    text: "Short. Close, though. I used to… it's close.",
  },
  {
    kind: 'reaction',
    outcome: 'over',
    tier: 3,
    source: N,
    text: "Breaker. I'll reset it. I always… the breaker resets itself. It does that now.",
  },

  // ── Codex margins (the codex explains; FUSE only annotates) ──────────────
  {
    kind: 'codex',
    gem: 'channel',
    tier: 1,
    source: N,
    text: "Goes straight. Admirable. Most things here don't.",
  },
  {
    kind: 'codex',
    gem: 'bend',
    tier: 1,
    source: N,
    text: 'Facing a wall counts as a choice. A poor one. See incident report #4,211.',
  },
  {
    kind: 'codex',
    gem: 'split',
    tier: 1,
    source: N,
    text: "Magenta's proud of this. Don't tell it the halves are smaller.",
  },
  {
    kind: 'codex',
    gem: 'amplify',
    tier: 1,
    source: N,
    text: 'Greed trips breakers. Regulation 5. Regulation 5 has seen things.',
  },
  {
    kind: 'codex',
    gem: 'gate',
    tier: 1,
    source: N,
    text: 'Two signatures or nothing. Regulation 9. Bureaucracy, but glowing.',
  },
  {
    kind: 'codex',
    gem: 'capacitor',
    tier: 3,
    source: N,
    text: "Keeps a bolt for later. Ice keeps things. That's what ice is for.",
  },

  // ── Altar: exact solves and idle nudges (written for the altar; same voice) ──
  { kind: 'exact', tier: 1, source: N, text: 'Exactly right. Look at it go. Paperwork can wait.' },
  {
    kind: 'exact',
    tier: 2,
    source: N,
    text: 'Right on the number. Management would call that adequate. Management is wrong.',
  },
  { kind: 'exact', tier: 3, source: N, text: "Exact. Not a spark wasted. I've signed worse." },
  { kind: 'exact', tier: 4, source: N, text: 'Exact. Mind the door on your way through.' },
  {
    kind: 'nudge',
    nudge: 'teach',
    tier: 1,
    source: N,
    text: 'Gem from the tray. Onto a bright socket. Wrong spot? Pick it up again. The form allows this.',
  },
  {
    kind: 'nudge',
    nudge: 'channel',
    tier: 1,
    source: N,
    text: 'Plain blue. In one side, out the other. Like the paperwork.',
  },
  {
    kind: 'nudge',
    nudge: 'bend',
    tier: 1,
    source: N,
    text: 'New gem on the altar. It has opinions about straight lines.',
  },
  {
    kind: 'nudge',
    nudge: 'amplify',
    tier: 1,
    source: N,
    text: 'Amber on the altar. Handle it like the meter is watching.',
  },
  {
    kind: 'nudge',
    nudge: 'split',
    tier: 1,
    source: N,
    text: "Magenta's on the altar now. It's been waiting all morning.",
  },
  {
    kind: 'nudge',
    nudge: 'gate',
    tier: 1,
    source: N,
    text: "New one on the altar. It won't work alone. Nobody here does.",
  },
  {
    kind: 'nudge',
    nudge: 'capacitor',
    tier: 3,
    source: N,
    text: "Ice on the altar. I'd use it. Eventually. That's rather the point.",
  },
];

function idFor(d: Def): string {
  if (d.id) return d.id;
  switch (d.kind) {
    case 'arrive':
    case 'solve':
      return `${d.machine}.${d.kind}`;
    case 'locked':
      return `${d.machine}.locked`;
    case 'socket':
      return `socket.${d.capability}`;
    case 'codex':
      return `codex.${d.gem}`;
    case 'beat':
      return `beat.${d.beat}`;
    case 'chat':
      return `chat.${d.order}`;
    case 'exact':
      return `exact.t${d.tier}`;
    case 'nudge':
      return `nudge.${d.nudge}`;
    case 'hall':
    case 'reaction': {
      const tag = d.kind === 'hall' ? d.beat : d.outcome;
      const n = DEFS.filter(
        (o) =>
          o.kind === d.kind &&
          o.tier === d.tier &&
          (o.kind === 'hall' ? o.beat : o.kind === 'reaction' ? o.outcome : '') === tag &&
          DEFS.indexOf(o) < DEFS.indexOf(d),
      ).length;
      return `${d.kind}.${tag}.t${d.tier}.${n + 1}`;
    }
  }
}

export const LINES: readonly FuseLine[] = DEFS.map((d) => ({ ...d, id: idFor(d) }) as FuseLine);

// ─── Lookups ─────────────────────────────────────────────────────────────────

export function lineById(id: string): FuseLine {
  const l = LINES.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown line: ${id}`);
  return l;
}

/** Arrive or solve line. The Last Rune has none (it uses beats). */
export function machineLine(machine: MachineId, kind: 'arrive' | 'solve'): FuseLine | undefined {
  return LINES.find(
    (l) => (l.kind === 'arrive' || l.kind === 'solve') && l.kind === kind && l.machine === machine,
  );
}

/**
 * The door's own locked line, if it has one and its condition holds.
 * Otherwise the hall falls back to `socketLine` for each empty socket.
 */
export function lockedLineFor(
  machine: MachineId,
  missing: readonly CapabilityKey[],
  missingMachines: number,
): FuseLine | undefined {
  return LINES.find(
    (l) =>
      l.kind === 'locked' &&
      l.machine === machine &&
      (l.when === 'machines' ? missingMachines > 0 : missing.includes(l.when)),
  );
}

export function socketLine(capability: CapabilityKey): FuseLine {
  const l = LINES.find((x) => x.kind === 'socket' && x.capability === capability);
  if (!l) throw new Error(`No socket line for ${capability}`);
  return l;
}

/**
 * Reaction lines for a failed attempt in the given story tier (falls back to
 * lower tiers). `gemsUsed` filters lines that only make sense with a gem.
 * Pick deterministically with `pick` (e.g. the attempt count).
 */
export function reactionLine(
  outcome: Outcome,
  tier: Tier,
  gemsUsed: readonly GemKind[],
  pick = 0,
): FuseLine | undefined {
  for (let t = Math.min(tier, 3); t >= 1; t--) {
    const pool = LINES.filter(
      (l) =>
        l.kind === 'reaction' &&
        l.outcome === outcome &&
        l.tier === t &&
        (!l.needsGem || gemsUsed.includes(l.needsGem)),
    );
    if (pool.length > 0) return pool[Math.abs(pick) % pool.length];
  }
  return undefined;
}

/** Hall lines for a beat that belong to a tier. */
export function hallLines(beat: 'first-entry' | 'ambient' | 'echo', tier: Tier): FuseLine[] {
  return LINES.filter((l) => l.kind === 'hall' && l.beat === beat && l.tier === tier);
}

export function codexNote(gem: GemKind): FuseLine | undefined {
  return LINES.find((l) => l.kind === 'codex' && l.gem === gem);
}

export function beatLine(beat: BeatId): FuseLine {
  const l = LINES.find((x) => x.kind === 'beat' && x.beat === beat);
  if (!l) throw new Error(`No beat ${beat}`);
  return l;
}

export function chatLines(): FuseLine[] {
  return LINES.filter((l) => l.kind === 'chat').sort(
    (a, b) => (a.kind === 'chat' ? a.order : 0) - (b.kind === 'chat' ? b.order : 0),
  );
}

/** The altar's exact-solve line for a story tier (falls back to lower tiers). */
export function exactLine(tier: Tier): FuseLine {
  for (let t = tier; t >= 1; t--) {
    const l = LINES.find((x) => x.kind === 'exact' && x.tier === t);
    if (l) return l;
  }
  throw new Error('No exact line');
}

/** Idle nudge on the first puzzle (intake-desk). */
export const TEACH_NUDGE: FuseLine = lineById('nudge.teach');

/** One-line nudge for the first puzzle that offers this gem (altar-clarity hooks). */
export function gemNudge(gem: GemKind): FuseLine | undefined {
  return LINES.find((l) => l.kind === 'nudge' && l.nudge === gem);
}

// ─── Text utilities ──────────────────────────────────────────────────────────

/** The corner card's word limit (pitch: "Nothing over twenty words"). */
export const MAX_WORDS_PER_CARD = 20;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Counts FUSE's "I" (including I'll, I've, I'd, I'm, and "I…"). */
export function countI(text: string): number {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^['"‘“(]+/, ''))
    .filter((w) => /^I(?:['’](?:ll|ve|d|m))?(?![\p{L}])/u.test(w)).length;
}

/**
 * Splits a line into corner cards of at most 20 words, breaking only between
 * sentences (or after "…"), as evenly as possible. Lines that fit are one card.
 */
export function cardsOf(text: string): string[] {
  if (wordCount(text) <= MAX_WORDS_PER_CARD) return [text];
  const sentences = text.split(/(?<=[.!?…]['"’”]?)\s+/);
  const n = sentences.length;
  // Fewest cards, then the most even split: DP over sentence boundaries.
  const words = sentences.map(wordCount);
  const best: { cards: number; worst: number; prev: number }[] = [{ cards: 0, worst: 0, prev: -1 }];
  for (let j = 1; j <= n; j++) {
    best[j] = { cards: Number.POSITIVE_INFINITY, worst: Number.POSITIVE_INFINITY, prev: -1 };
    let w = 0;
    for (let i = j - 1; i >= 0; i--) {
      w += words[i]!;
      if (w > MAX_WORDS_PER_CARD) break;
      const b = best[i]!;
      const cards = b.cards + 1;
      const worst = Math.max(b.worst, w);
      const cur = best[j]!;
      if (cards < cur.cards || (cards === cur.cards && worst < cur.worst)) {
        best[j] = { cards, worst, prev: i };
      }
    }
  }
  if (!Number.isFinite(best[n]!.cards)) return [text];
  const out: string[] = [];
  for (let j = n; j > 0; j = best[j]!.prev) {
    out.unshift(sentences.slice(best[j]!.prev, j).join(' '));
  }
  return out;
}
