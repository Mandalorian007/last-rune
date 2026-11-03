/**
 * The ending (pitch §4 "Script · The door"). Data only; the ending scene plays it.
 *
 * D-032 (amends D-005): FUSE went to ThunderClap Gaming and found friends. He is a
 * game character, not a bot or a member of a real server, so the ending shows no
 * chat, server or member details. The only network touch is the player clicking
 * the invite link on the end card (D-013).
 */
import { wordCount } from './lines';

/** The ThunderClap Gaming invite. If empty, the ending hides the Join button. */
export const DISCORD_INVITE_URL: string = 'https://discord.gg/thunderclap';

/** Optional tip-jar link. Empty means use itch's own tip prompt (button hidden). */
export const TIP_JAR_URL: string = '';

/**
 * On-screen copy for the title and end card (UI text, not FUSE lines). Confirmed by
 * the user, D-032. The title card is lore, so it reads the same with or without an invite.
 */
export const ENDING_COPY = {
  titleCard: [
    'FUSE went to ThunderClap Gaming.',
    'He made friends. Loud ones.',
    'He still has questions about your safety record.',
  ],
  joinLabel: 'Join ThunderClap Gaming',
  tipLabel: 'Leave a tip',
  footer: 'This was the whole game. Thank you for finishing it.',
} as const;

export interface EndingButton {
  readonly id: 'join' | 'tip';
  readonly label: string;
  readonly href: string;
}

/**
 * Buttons for the ending screen. Any button whose URL is blank or not https is
 * left out, so an unset constant never produces a dead link.
 */
export function endingButtons(
  inviteUrl: string = DISCORD_INVITE_URL,
  tipUrl: string = TIP_JAR_URL,
): EndingButton[] {
  const ok = (u: string) => /^https:\/\/\S+$/.test(u.trim());
  const out: EndingButton[] = [];
  if (ok(inviteUrl)) out.push({ id: 'join', label: ENDING_COPY.joinLabel, href: inviteUrl.trim() });
  if (ok(tipUrl)) out.push({ id: 'tip', label: ENDING_COPY.tipLabel, href: tipUrl.trim() });
  return out;
}

/** One step of the ending, in order. `line` ids refer to content/lines.ts. */
export type EndingStep =
  | { readonly type: 'silence'; readonly note: string }
  | { readonly type: 'line'; readonly line: string }
  /** Directions are verbatim from the pitch unless marked `new` (D-032 rewrote the ending's). */
  | { readonly type: 'direction'; readonly text: string; readonly source?: 'new' }
  | { readonly type: 'title-card' }
  | { readonly type: 'idle'; readonly seconds: number; readonly line: string };

/** The finale from the Last Rune's arrival to the post-credits clipboard. Verbatim stage directions. */
export const ENDING_SEQUENCE: readonly EndingStep[] = [
  {
    type: 'silence',
    note: 'No line on arrival. No line while you work. The corner card is empty for the first time in the game.',
  },
  { type: 'direction', text: 'Only when the final gem is set:' },
  { type: 'line', line: 'beat.rune-final-report' },
  { type: 'line', line: 'beat.rune-lights' },
  {
    type: 'direction',
    text: "The rune catches the storm. It was always a door. The player walks toward it. FUSE doesn't move.",
  },
  { type: 'line', line: 'beat.rune-not-for-you' },
  {
    type: 'direction',
    text: 'FUSE rolls to the edge of the gold light. Stops. Clipboard still in his clamp.',
  },
  { type: 'line', line: 'beat.door-list' },
  { type: 'line', line: 'beat.door-key' },
  {
    type: 'direction',
    text: 'He drops the clipboard. It lands on the floor. He goes through. The screen goes white.',
  },
  {
    type: 'direction',
    text: 'The white warms to gold. Somewhere in the light, a great many people are talking at once, and laughing. FUSE, from the other side:',
    source: 'new',
  },
  { type: 'line', line: 'beat.beyond-arrived' },
  { type: 'line', line: 'beat.beyond-arguing' },
  { type: 'line', line: 'beat.beyond-day-1' },
  {
    type: 'direction',
    text: 'The light settles back over the hall. Gold floods it. Title card:',
    source: 'new',
  },
  { type: 'title-card' },
  { type: 'idle', seconds: 30, line: 'beat.post-credits' },
];

export interface PlayStats {
  readonly playSeconds: number;
  readonly breakersTripped: number;
}

/**
 * FUSE's closing remark on the player's safety record, for the ending screen
 * under the title card ("He has questions about your safety record").
 * Stands in for the pitch's greeting that referenced play time.
 */
export function safetyRecordLine(stats: PlayStats): string {
  const mins = Math.max(1, Math.round(stats.playSeconds / 60));
  const time = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  const b = Math.max(0, Math.floor(stats.breakersTripped));
  const breakers =
    b === 0 ? 'Breakers tripped: none. Suspicious.' : `Breakers tripped: ${b}. Generous.`;
  const line = `Visitor #4,211. Time on site: ${time}. ${breakers} Monitoring continues.`;
  if (wordCount(line) > 20) throw new Error('safety record line too long');
  return line;
}
