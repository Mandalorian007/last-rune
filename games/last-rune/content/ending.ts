/**
 * The ending (pitch §4 "Script · The door"). Data only; the ending scene plays it.
 *
 * D-005: the Discord is lore. There is no bot and no live widget; beat 2 is
 * always the mock chat window. The only network touch is the player clicking
 * the invite link.
 */
import { wordCount } from './lines';

/** The ThunderClap Discord invite. If empty, the ending hides the Join button. */
export const DISCORD_INVITE_URL: string = 'https://discord.gg/thunderclap';

/** Optional tip-jar link. Empty means use itch's own tip prompt (button hidden). */
export const TIP_JAR_URL: string = '';

/** Channel name shown in the mock chat (beat 2). */
export const CHAT_CHANNEL = '#this-will-break';

/** On-screen copy for beat 3 (UI text, not FUSE lines). Verbatim from the pitch. */
export const ENDING_COPY = {
  titleCard: [
    'FUSE lives in the ThunderClap Discord now.',
    'He has questions about your safety record.',
  ],
  joinLabel: 'Join ThunderClap',
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

/**
 * The title card. With no invite link, the Discord claim stays (it is lore) but
 * reads as an aside rather than a call to action.
 */
export function endingTitleCard(inviteUrl: string = DISCORD_INVITE_URL): readonly string[] {
  return endingButtons(inviteUrl, '').some((b) => b.id === 'join')
    ? ENDING_COPY.titleCard
    : [ENDING_COPY.titleCard[1]];
}

/** One step of the ending, in order. `line` ids refer to content/lines.ts. */
export type EndingStep =
  | { readonly type: 'silence'; readonly note: string }
  | { readonly type: 'line'; readonly line: string }
  | { readonly type: 'direction'; readonly text: string }
  | { readonly type: 'chat'; readonly line: string }
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
    text: 'White fades to a very different kind of screen: a chat window. Dark theme, familiar layout, a channel list down the side. A cursor blinks in a channel called #this-will-break. Then, slowly, typed:',
  },
  { type: 'chat', line: 'chat.1' },
  { type: 'chat', line: 'chat.2' },
  { type: 'chat', line: 'chat.3' },
  {
    type: 'direction',
    text: 'Beat. A second line of avatars lights up as "real" members react.',
  },
  {
    type: 'direction',
    text: 'The chat window shrinks into the ending screen. Gold floods the hall. Title card:',
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
 * Lore-safe stand-in for the pitch's bot greeting that referenced play time.
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
