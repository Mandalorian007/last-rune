/**
 * Ending model (pure: no DOM, no GPU). The beat list the ending scene plays,
 * derived from `content/ending.ts` ENDING_SEQUENCE so the script stays the one
 * source, plus the end card's buttons, the skip rule and the chat mock's cast.
 *
 * The first two sequence entries (the silent arrival and "Only when the final
 * gem is set") belong to the altar and the solve moment; the ending scene
 * starts at the final report.
 */
import {
  CHAT_CHANNEL,
  DISCORD_INVITE_URL,
  ENDING_COPY,
  ENDING_SEQUENCE,
  type EndingButton,
  type EndingStep,
  endingButtons,
  endingTitleCard,
  type PlayStats,
  safetyRecordLine,
  TIP_JAR_URL,
} from '../../content/ending';
import { type FuseLine, lineById } from '../../content/lines';

/** One staged beat. `cue` names what the scene does on screen for direction beats. */
export type EndingBeat =
  | { readonly kind: 'line'; readonly line: FuseLine }
  | { readonly kind: 'direction'; readonly cue: DirectionCue; readonly text: string }
  | { readonly kind: 'chat'; readonly line: FuseLine }
  | { readonly kind: 'title-card' }
  | { readonly kind: 'idle'; readonly seconds: number; readonly line: FuseLine };

export type DirectionCue =
  | 'door' // the rune catches the storm; it was always a door; the player walks toward it
  | 'edge' // FUSE rolls to the edge of the gold light
  | 'through' // he drops the clipboard, goes through, the screen goes white
  | 'chat-open' // white fades to the chat window
  | 'react' // a second line of avatars reacts
  | 'flood'; // the chat shrinks into the ending screen; gold floods the hall

const CUES: readonly [RegExp, DirectionCue][] = [
  [/gold floods/i, 'flood'],
  [/always a door/i, 'door'],
  [/edge of the gold light/i, 'edge'],
  [/drops the clipboard/i, 'through'],
  [/^white fades/i, 'chat-open'],
  [/avatars/i, 'react'],
];

function cueFor(text: string): DirectionCue | null {
  for (const [re, cue] of CUES) if (re.test(text)) return cue;
  return null;
}

/** The ending's beats, in order, from the final report to the post-credits clipboard. */
export function endingBeats(seq: readonly EndingStep[] = ENDING_SEQUENCE): EndingBeat[] {
  const start = seq.findIndex((s) => s.type === 'line');
  const out: EndingBeat[] = [];
  for (const s of seq.slice(Math.max(0, start))) {
    switch (s.type) {
      case 'line':
        out.push({ kind: 'line', line: lineById(s.line) });
        break;
      case 'chat':
        out.push({ kind: 'chat', line: lineById(s.line) });
        break;
      case 'direction': {
        const cue = cueFor(s.text);
        if (cue) out.push({ kind: 'direction', cue, text: s.text });
        break;
      }
      case 'title-card':
        out.push({ kind: 'title-card' });
        break;
      case 'idle':
        out.push({ kind: 'idle', seconds: s.seconds, line: lineById(s.line) });
        break;
      case 'silence':
        break;
    }
  }
  return out;
}

/** Skippable after the first viewing: any replay of the Last Rune once the facility is complete. */
export function endingSkippable(moment: { readonly firstTime: boolean }): boolean {
  return !moment.firstTime;
}

export interface EndCard {
  readonly title: readonly string[];
  readonly safety: string;
  readonly buttons: readonly EndingButton[];
  readonly footer: string;
  /** The Discord door: present only when the invite is a real https link. */
  readonly join: EndingButton | null;
}

export function endCard(
  stats: PlayStats,
  invite: string = DISCORD_INVITE_URL,
  tip: string = TIP_JAR_URL,
): EndCard {
  const buttons = endingButtons(invite, tip);
  return {
    title: endingTitleCard(invite),
    safety: safetyRecordLine(stats),
    buttons,
    footer: ENDING_COPY.footer,
    join: buttons.find((b) => b.id === 'join') ?? null,
  };
}

/**
 * Credits (UI copy, not story text; see docs/design/ending.md). Facts about how
 * the game is made, no names: the PM can swap in real credits.
 */
export const CREDITS: readonly (readonly [string, string])[] = [
  ['The Last Rune', 'A ThunderClap game'],
  ['Every stone, gem, candle and spark', 'Drawn in code, on your GPU'],
  ['Every sound', 'Synthesised as you play'],
  ['FUSE', 'As himself'],
];

/** The mock chat (D-005: lore, never a live widget). Handles are invented, not real people. */
export const CHAT = {
  channel: CHAT_CHANNEL,
  server: 'ThunderClap',
  channels: ['#welcome', '#rules', '#this-will-break', '#gem-theory', '#screenshots', '#off-topic'],
  /** The "real" members who react after FUSE's third line. */
  reactors: [
    { name: 'ohm_sweet_ohm', hue: 32 },
    { name: 'gearwright', hue: 190 },
    { name: 'mossy.lamp', hue: 140 },
    { name: 'spark_plug', hue: 290 },
    { name: 'tarp_enjoyer', hue: 12 },
    { name: 'breaker-7', hue: 220 },
  ],
} as const;
