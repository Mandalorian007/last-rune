/**
 * Ending model (pure: no DOM, no GPU). The beat list the ending scene plays,
 * derived from `content/ending.ts` ENDING_SEQUENCE so the script stays the one
 * source, plus the end card's buttons, the skip rule and the credits.
 *
 * The first two sequence entries (the silent arrival and "Only when the final
 * gem is set") belong to the altar and the solve moment; the ending scene
 * starts at the final report.
 */
import {
  DISCORD_INVITE_URL,
  ENDING_COPY,
  ENDING_SEQUENCE,
  type EndingButton,
  type EndingStep,
  endingButtons,
  KOFI_URL,
  type PlayStats,
  safetyRecordLine,
} from '../../content/ending';
import { type FuseLine, lineById } from '../../content/lines';

/** One staged beat. `cue` names what the scene does on screen for direction beats. */
export type EndingBeat =
  | { readonly kind: 'line'; readonly line: FuseLine }
  | { readonly kind: 'direction'; readonly cue: DirectionCue; readonly text: string }
  | { readonly kind: 'title-card' }
  | { readonly kind: 'idle'; readonly seconds: number; readonly line: FuseLine };

export type DirectionCue =
  | 'door' // the rune catches the storm; it was always a door; the player walks toward it
  | 'edge' // FUSE rolls to the edge of the gold light
  | 'through' // he drops the clipboard, goes through, the screen goes white
  | 'beyond' // the white warms to gold light; a happy crowd somewhere in it
  | 'flood'; // the light settles back over the hall; gold floods it

const CUES: readonly [RegExp, DirectionCue][] = [
  [/gold floods/i, 'flood'],
  [/always a door/i, 'door'],
  [/edge of the gold light/i, 'edge'],
  [/drops the clipboard/i, 'through'],
  [/white warms to gold/i, 'beyond'],
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
  readonly footer: string;
  /** The ThunderClap Gaming door: present only when the invite is a real https link. */
  readonly join: EndingButton | null;
  /** The Ko-fi link (D-034), secondary to Join; present only when its URL is https. */
  readonly coffee: EndingButton | null;
}

export function endCard(
  stats: PlayStats,
  invite: string = DISCORD_INVITE_URL,
  coffee: string = KOFI_URL,
): EndCard {
  const buttons = endingButtons(invite, coffee);
  return {
    title: ENDING_COPY.titleCard,
    safety: safetyRecordLine(stats),
    footer: ENDING_COPY.footer,
    join: buttons.find((b) => b.id === 'join') ?? null,
    coffee: buttons.find((b) => b.id === 'coffee') ?? null,
  };
}

/** Credits (UI copy, not story text; confirmed by the user, D-032). */
export const CREDITS: readonly (readonly [string, string])[] = [
  ['The Last Rune', 'A ThunderClap Gaming game'],
  ['Made by', 'ThunderSoap'],
  ['Every stone, gem, candle and spark', 'Drawn in code, on your GPU'],
  ['Every sound', 'Synthesised as you play'],
  ['FUSE', 'As himself'],
];

/** Where a falling board is drawn: centre, scale (1 = resting size) and angle. */
export interface DropPose {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rot: number;
}

/** Seconds from release to landing for the dropped clipboard. */
export const CLIP_FALL_SECONDS = 0.62;

/**
 * FUSE's clipboard falling from his clamp to where it rests in the foreground, `t` seconds
 * after release. It reads as a drop, not a toss: it leaves the clamp with no speed, and its
 * bottom edge (the part that meets the floor) falls with gravity the whole way. It grows and
 * drifts out toward the rest spot more slowly at first, so the first moments are a plain
 * fall; it tips over as it goes, with a slight flutter, and settles with a small bounce.
 * `rest.h` is the board's resting height, used to find its bottom edge.
 */
export function clipDropPose(
  t: number,
  from: { x: number; y: number; scale: number; rot: number },
  rest: { x: number; y: number; h: number; rot: number },
): DropPose {
  const T = CLIP_FALL_SECONDS;
  const k = Math.min(1, Math.max(0, t / T));
  const fall = k * k; // gravity: the bottom edge's drop
  const out = k * k * (1.6 - 0.6 * k); // ease-in drift and growth, slower than the fall at first
  const scale = from.scale + (1 - from.scale) * out;
  const bottomFrom = from.y + (rest.h * from.scale) / 2;
  const bottomTo = rest.y + rest.h / 2;
  let bottom = bottomFrom + (bottomTo - bottomFrom) * fall;
  const after = t - T;
  if (after > 0 && after < 0.3) bottom -= Math.sin((after / 0.3) * Math.PI) * 6;
  const flutter = Math.sin(k * Math.PI * 2) * 0.07 * (1 - k);
  return {
    x: from.x + (rest.x - from.x) * out,
    y: bottom - (rest.h * scale) / 2,
    scale,
    rot: from.rot + (rest.rot - from.rot) * out + flutter,
  };
}
