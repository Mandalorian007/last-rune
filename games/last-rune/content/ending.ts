/**
 * The ending (pitch §4 "Script · The door"). Data only; the ending scene plays it.
 *
 * D-038 (amends D-032): beyond the door FUSE rolls into the ThunderClap Gaming community
 * hangout, a Discord-like chat drawn in the game's own style, with the server's real
 * channel list. He is a game character, not a bot (no BOT tag), and every poster apart
 * from ThunderSoap (the author) is invented. No member counts. The chat is a script
 * played locally: the only network touches are the player clicking the invite (D-013)
 * or the Ko-fi link (D-034): plain links, new tab, no widgets.
 */
import { safeExternalUrl } from '../../../engine/platform/links';
import { wordCount } from './lines';

/** The ThunderClap Gaming invite. If empty, the ending hides the Join button. */
export const DISCORD_INVITE_URL: string = 'https://discord.gg/thunderclap';

/** ThunderSoap's Ko-fi page (D-034). Shown on the title and the end card; blank hides it. */
export const KOFI_URL: string = 'https://ko-fi.com/thundersoap';

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
  coffeeLabel: 'Buy ThunderSoap a coffee',
  footer: 'This was the whole game. Thank you for finishing it.',
} as const;

/** Labels for the engine's external-link widget (D-036): Copy link, Copied, and the fallback. */
export const LINK_COPY_TEXT = {
  copy: 'Copy link',
  copied: 'Copied!',
  copiedAnnounce: 'Link copied.',
  close: 'Close',
  copyBlocked: 'Your browser blocked copying. Copy the link:',
  popupBlocked: 'Your browser blocked the new tab. Copy the link:',
} as const;

export interface EndingButton {
  readonly id: 'join' | 'coffee';
  readonly label: string;
  readonly href: string;
}

/** The Ko-fi link (title and end card), or null when the URL is blank or not https. */
export function coffeeLink(url: string = KOFI_URL): EndingButton | null {
  const href = safeExternalUrl(url);
  return href ? { id: 'coffee', label: ENDING_COPY.coffeeLabel, href } : null;
}

/**
 * Buttons for the ending screen: Join first, the Ko-fi link second. Any button whose
 * URL is blank or not https is left out, so an unset constant never produces a dead link.
 */
export function endingButtons(
  inviteUrl: string = DISCORD_INVITE_URL,
  coffeeUrl: string = KOFI_URL,
): EndingButton[] {
  const out: EndingButton[] = [];
  const join = safeExternalUrl(inviteUrl);
  if (join) out.push({ id: 'join', label: ENDING_COPY.joinLabel, href: join });
  const coffee = coffeeLink(coffeeUrl);
  if (coffee) out.push(coffee);
  return out;
}

/** One step of the ending, in order. `line` ids refer to content/lines.ts. */
export type EndingStep =
  | { readonly type: 'silence'; readonly note: string }
  | { readonly type: 'line'; readonly line: string }
  /** Directions are verbatim from the pitch unless marked `new` (D-032 rewrote the ending's). */
  | { readonly type: 'direction'; readonly text: string; readonly source?: 'new' }
  /** The community hangout beyond the door (D-038): plays `HANGOUT_SCRIPT`. */
  | { readonly type: 'hangout' }
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
    text: 'The white warms to gold. In the light, a window opens on a community hangout in full swing: ThunderClap Gaming. FUSE rolls in and wanders the channels:',
    source: 'new',
  },
  { type: 'hangout' },
  {
    type: 'direction',
    text: 'The window folds back into the light. It settles over the hall, and gold floods it. Title card:',
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

// ── The community hangout beyond the door (D-038) ──────────────────────────

/** The server as FUSE finds it. The channel list is the real one, in order (D-038). */
export const HANGOUT_SERVER = 'ThunderClap Gaming';
export const HANGOUT_CATEGORY = 'Community';

export const HANGOUT_CHANNELS = [
  { id: 'welcome', emoji: '👋', name: 'welcome' },
  { id: 'introductions', emoji: '🧑', name: 'introductions' },
  { id: 'the-hangout', emoji: '💬', name: 'the-hangout' },
  { id: 'supporter-sneak-peeks', emoji: '👀', name: 'supporter-sneak-peeks' },
  { id: 'supporter-chat', emoji: '💬', name: 'supporter-chat' },
  { id: 'events-and-contests', emoji: '🏆', name: 'events-and-contests' },
  { id: 'furry-friends', emoji: '🐈', name: 'furry-friends' },
  { id: 'omg-food', emoji: '🍔', name: 'omg-food' },
  { id: 'jammin-out', emoji: '🎶', name: 'jammin-out' },
  { id: 'otaku-oasis', emoji: '🍜', name: 'otaku-oasis' },
  { id: 'book-worms', emoji: '📚', name: 'book-worms' },
  { id: 'watch-me-grow', emoji: '🌱', name: 'watch-me-grow' },
  { id: 'sports-ball', emoji: '⚽', name: 'sports-ball' },
  { id: 'gearhead', emoji: '🚗', name: 'gearhead' },
] as const;

export type ChannelId = (typeof HANGOUT_CHANNELS)[number]['id'];

/**
 * Who posts. FUSE is drawn with his own procedural face; everyone else gets an emoji on a
 * coloured disc. ThunderSoap is the author and the only real name (D-038); every other
 * handle is made up for the scene. `invented` is checked by the content tests.
 */
export interface HangoutMember {
  readonly name: string;
  /** Avatar glyph (system emoji text). Empty for FUSE: his avatar is his face. */
  readonly emoji: string;
  /** Avatar disc hue (HSL degrees). */
  readonly hue: number;
  readonly invented: boolean;
}

export const HANGOUT_MEMBERS = {
  fuse: { name: 'FUSE', emoji: '', hue: 36, invented: false },
  thundersoap: { name: 'ThunderSoap', emoji: '⚡', hue: 44, invented: false },
  mossy: { name: 'mossy.lamp', emoji: '🍄', hue: 140, invented: true },
  kettle: { name: 'kettle.knight', emoji: '☕', hue: 200, invented: true },
  grumble: { name: 'grumbleberry', emoji: '🍇', hue: 280, invented: true },
  pudding: { name: 'pixel_pudding', emoji: '🍮', hue: 30, invented: true },
  ohm: { name: 'ohm_sweet_ohm', emoji: '🎧', hue: 330, invented: true },
  torque: { name: 'torque.taco', emoji: '🌮', hue: 12, invented: true },
} as const satisfies Record<string, HangoutMember>;

export type MemberId = keyof typeof HANGOUT_MEMBERS;

/** A message already in a channel when FUSE first opens it. */
export interface HangoutPost {
  readonly who: MemberId;
  readonly text: string;
}

/** What each channel says before FUSE gets there (a hangout is mid-conversation). */
export const HANGOUT_HISTORY: Partial<Record<ChannelId, readonly HangoutPost[]>> = {
  welcome: [
    { who: 'thundersoap', text: 'Welcome in! Grab a seat and say hi in 🧑 introductions 💜' },
  ],
  introductions: [{ who: 'kettle', text: "hi all! I'm Kettle. I like tea and losing at chess ☕" }],
  'the-hangout': [
    { who: 'grumble', text: 'the water level is the best level and I will die on this hill' },
    { who: 'pudding', text: "you WILL die on that hill. you'll drown on it" },
    { who: 'grumble', text: 'TAKE THAT BACK' },
  ],
  'jammin-out': [{ who: 'ohm', text: '🔊🔊🔊 TURN IT UP 🔊🔊🔊' }],
  gearhead: [
    { who: 'torque', text: 'rewired my own headlights last night 🔧 only one small fire' },
  ],
  'watch-me-grow': [
    { who: 'mossy', text: 'Day 212 of my sourdough starter. His name is Kevin 🌱' },
  ],
};

/**
 * The hangout, step by step. `key` names a message so later steps can react to it or pin it.
 * FUSE's posts type into the message bar first, then send. His three closing lines are the
 * content lines `beat.beyond-*` (D-032), placed where they land best: hello in introductions,
 * the argument in the-hangout, and "Day 1." in watch-me-grow, where people log their days.
 */
export type HangoutStep =
  /** FUSE moves to a channel: it opens, its unread pip clears, his face moves beside it. */
  | { readonly type: 'go'; readonly channel: ChannelId }
  /** He arrives: the server's join notice in the open channel. */
  | { readonly type: 'join'; readonly key: string; readonly text: string }
  /** FUSE posts a content line, or chat-only text; `form` attaches his little paper form. */
  | {
      readonly type: 'fuse';
      readonly key: string;
      readonly line?: string;
      readonly text?: string;
      readonly form?: readonly (readonly [string, string])[];
    }
  /** Someone else posts, after a moment of "is typing…". */
  | { readonly type: 'post'; readonly who: MemberId; readonly text: string; readonly key?: string }
  /** A reaction on a message, its count ticking up to `count`. */
  | { readonly type: 'react'; readonly key: string; readonly emoji: string; readonly count: number }
  /** Channels light up with unread pips (the rest of the server noticing). */
  | { readonly type: 'unread'; readonly channels: readonly ChannelId[] }
  | { readonly type: 'pin'; readonly key: string; readonly by: MemberId; readonly text: string }
  | { readonly type: 'wait'; readonly seconds: number };

export const HANGOUT_START: ChannelId = 'welcome';

export const HANGOUT_SCRIPT: readonly HangoutStep[] = [
  { type: 'wait', seconds: 0.9 },
  { type: 'join', key: 'join', text: 'FUSE came through the door. Say hi!' },
  { type: 'react', key: 'join', emoji: '👋', count: 9 },
  { type: 'unread', channels: ['the-hangout', 'jammin-out', 'omg-food'] },
  { type: 'wait', seconds: 1.4 },
  { type: 'go', channel: 'introductions' },
  { type: 'wait', seconds: 0.5 },
  {
    type: 'fuse',
    key: 'hello',
    line: 'beat.beyond-arrived',
    form: [
      ['Name', 'FUSE'],
      ['Last post', 'Foreman, 40 years'],
      ['Hobbies', 'Pending'],
    ],
  },
  { type: 'react', key: 'hello', emoji: '👋', count: 12 },
  { type: 'post', who: 'mossy', text: 'he brought a FORM 😭' },
  { type: 'react', key: 'hello', emoji: '📋', count: 5 },
  { type: 'post', who: 'thundersoap', text: 'Welcome home, FUSE 💜' },
  { type: 'react', key: 'hello', emoji: '🥰', count: 8 },
  { type: 'wait', seconds: 1.3 },
  { type: 'go', channel: 'the-hangout' },
  { type: 'wait', seconds: 1.0 },
  { type: 'fuse', key: 'argue', line: 'beat.beyond-arguing' },
  { type: 'react', key: 'argue', emoji: '😂', count: 14 },
  { type: 'post', who: 'grumble', text: 'we are DISCUSSING' },
  { type: 'react', key: 'argue', emoji: '💯', count: 6 },
  { type: 'unread', channels: ['gearhead', 'book-worms', 'watch-me-grow'] },
  { type: 'wait', seconds: 1.1 },
  { type: 'go', channel: 'jammin-out' },
  { type: 'wait', seconds: 0.5 },
  { type: 'fuse', key: 'loud', text: 'Volume exceeds regulation. Leaving.' },
  { type: 'react', key: 'loud', emoji: '😂', count: 4 },
  { type: 'wait', seconds: 0.7 },
  { type: 'go', channel: 'gearhead' },
  { type: 'wait', seconds: 0.7 },
  { type: 'fuse', key: 'fire', text: 'Incident report filed on your behalf. Wear gloves.' },
  { type: 'react', key: 'fire', emoji: '⚡', count: 7 },
  { type: 'react', key: 'fire', emoji: '🔧', count: 3 },
  { type: 'unread', channels: ['furry-friends', 'events-and-contests', 'otaku-oasis'] },
  { type: 'wait', seconds: 1.1 },
  { type: 'go', channel: 'watch-me-grow' },
  { type: 'wait', seconds: 0.9 },
  { type: 'fuse', key: 'day1', line: 'beat.beyond-day-1' },
  { type: 'wait', seconds: 0.4 },
  { type: 'react', key: 'day1', emoji: '🌱', count: 21 },
  { type: 'react', key: 'day1', emoji: '💜', count: 27 },
  { type: 'react', key: 'day1', emoji: '🥰', count: 12 },
  { type: 'react', key: 'day1', emoji: '🙏', count: 9 },
  { type: 'react', key: 'day1', emoji: '🍕', count: 1 },
  { type: 'pin', key: 'day1', by: 'thundersoap', text: 'pinned a message.' },
  { type: 'unread', channels: ['the-hangout', 'sports-ball', 'supporter-chat', 'introductions'] },
  { type: 'wait', seconds: 2.4 },
];

/** For screen readers: the hangout in two short announcements, not message by message. */
export const HANGOUT_SUMMARY = {
  open: 'Beyond the door is ThunderClap Gaming, a lively community chat. FUSE rolls in, introduces himself and wanders the channels.',
  end: 'He posts “Day 1.” Everyone reacts, and ThunderSoap pins it.',
} as const;

/** Chat chrome copy (UI text). */
export const HANGOUT_COPY = {
  today: 'today',
  messagePrefix: 'Message #',
  isTyping: 'is typing',
  formTitle: 'New arrival',
} as const;
