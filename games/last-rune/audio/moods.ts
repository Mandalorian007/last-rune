/**
 * Moods: what plays under each scene and tier. A mood is a set of looped layers (ambience
 * and a drone pad, each at a gain), an optional generative note sequencer, and sparse
 * ambient events (drips, distant thunder). Pure data and planning maths; `music.ts` runs it.
 *
 * Tier arc: tier 1 light and a little funny (major pentatonic, bouncy music box), tier 2
 * the flat seventh creeps in (mixolydian, fewer notes), tier 3 sparse and tense (dorian,
 * low notes, long rests), the Last Rune has no music at all (storm only, FUSE is silent),
 * the ending is warm and full (major, the warm bell, gold pad).
 */
import type { NoteSound } from './bank';
import { degreeToSemis, rateForSemis, SCALES, type ScaleName } from './theory';

export const MOOD_IDS = [
  'silence',
  'title',
  'hall-t1',
  'hall-t2',
  'hall-t3',
  'altar-t1',
  'altar-t2',
  'altar-t3',
  'codex',
  'journal',
  'last-rune',
  'ending',
] as const;
export type MoodId = (typeof MOOD_IDS)[number];

export interface MoodLayer {
  /** A loop in the bank. */
  sound: string;
  gain: number;
}

export interface SeqVoice {
  sound: NoteSound;
  /** Relative pick weight. */
  weight: number;
  /** Scale degrees relative to the voice's own base note (every note sample is a D), inclusive. */
  degrees: readonly [number, number];
  gain: number;
}

export interface SeqConfig {
  scale: ScaleName;
  bpm: number;
  /** Chance a given eighth-note slot sounds, 0..1. */
  density: number;
  /** Chance a whole bar rests (breathing room), 0..1. */
  restBars: number;
  voices: readonly SeqVoice[];
  /** Max stereo spread of notes, 0..1. */
  spread: number;
}

export interface AmbientEvent {
  /** One of these is picked each time. */
  sounds: readonly string[];
  /** Average occurrences per minute (Poisson). */
  perMinute: number;
  gain: readonly [number, number];
  rate: readonly [number, number];
  pan: readonly [number, number];
}

export interface Mood {
  layers: readonly MoodLayer[];
  seq?: SeqConfig;
  events: readonly AmbientEvent[];
  /** Crossfade time into this mood, seconds. */
  fade: number;
}

const drips: AmbientEvent = {
  sounds: ['drip'],
  perMinute: 7,
  gain: [0.35, 0.8],
  rate: [0.85, 1.25],
  pan: [-0.8, 0.8],
};
const farThunder = (perMinute: number, gain = 0.6): AmbientEvent => ({
  sounds: ['thunder.a', 'thunder.b'],
  perMinute,
  gain: [gain * 0.5, gain],
  rate: [0.8, 1.05],
  pan: [-0.6, 0.6],
});

const HALL_BED: readonly MoodLayer[] = [
  { sound: 'amb.storm', gain: 0.55 },
  { sound: 'amb.hum', gain: 0.32 },
];

export const MOODS: Readonly<Record<MoodId, Mood>> = {
  silence: { layers: [], events: [], fade: 1.5 },
  title: {
    layers: [
      { sound: 'amb.storm', gain: 0.7 },
      { sound: 'pad.title', gain: 0.55 },
    ],
    seq: {
      scale: 'majorPent',
      bpm: 66,
      density: 0.1,
      restBars: 0.4,
      voices: [{ sound: 'note.glass', weight: 1, degrees: [0, 5], gain: 0.35 }],
      spread: 0.6,
    },
    events: [farThunder(1.5, 0.7)],
    fade: 2.5,
  },
  'hall-t1': {
    layers: [...HALL_BED, { sound: 'pad.t1', gain: 0.45 }],
    seq: {
      scale: 'majorPent',
      bpm: 92,
      density: 0.2,
      restBars: 0.25,
      voices: [
        { sound: 'note.box', weight: 3, degrees: [-3, 5], gain: 0.32 },
        { sound: 'note.glass', weight: 1, degrees: [0, 6], gain: 0.3 },
        { sound: 'note.low', weight: 1, degrees: [0, 4], gain: 0.4 },
      ],
      spread: 0.7,
    },
    events: [drips, farThunder(1.2)],
    fade: 3,
  },
  'hall-t2': {
    layers: [...HALL_BED, { sound: 'pad.t2', gain: 0.45 }],
    seq: {
      scale: 'mixolydian',
      bpm: 80,
      density: 0.13,
      restBars: 0.35,
      voices: [
        { sound: 'note.glass', weight: 2, degrees: [-2, 7], gain: 0.32 },
        { sound: 'note.box', weight: 1, degrees: [-4, 4], gain: 0.25 },
        { sound: 'note.low', weight: 1, degrees: [0, 5], gain: 0.42 },
      ],
      spread: 0.6,
    },
    events: [drips, farThunder(1.8)],
    fade: 3,
  },
  'hall-t3': {
    layers: [
      { sound: 'amb.storm', gain: 0.7 },
      { sound: 'amb.hum', gain: 0.38 },
      { sound: 'pad.t3', gain: 0.5 },
    ],
    seq: {
      scale: 'dorian',
      bpm: 60,
      density: 0.07,
      restBars: 0.5,
      voices: [
        { sound: 'note.low', weight: 2, degrees: [-2, 5], gain: 0.45 },
        { sound: 'note.glass', weight: 1, degrees: [0, 7], gain: 0.25 },
      ],
      spread: 0.8,
    },
    events: [{ ...drips, perMinute: 4 }, farThunder(2.5, 0.75)],
    fade: 4,
  },
  // At the altar the room recedes: the hum comes forward, the storm sits back, notes thin
  // out so gem bells and the bolt own the foreground.
  'altar-t1': {
    layers: [
      { sound: 'amb.storm', gain: 0.32 },
      { sound: 'amb.hum', gain: 0.4 },
      { sound: 'pad.t1', gain: 0.32 },
    ],
    seq: {
      scale: 'majorPent',
      bpm: 92,
      density: 0.08,
      restBars: 0.45,
      voices: [{ sound: 'note.box', weight: 1, degrees: [-3, 4], gain: 0.25 }],
      spread: 0.5,
    },
    events: [{ ...drips, perMinute: 3 }],
    fade: 2,
  },
  'altar-t2': {
    layers: [
      { sound: 'amb.storm', gain: 0.35 },
      { sound: 'amb.hum', gain: 0.42 },
      { sound: 'pad.t2', gain: 0.32 },
    ],
    seq: {
      scale: 'mixolydian',
      bpm: 80,
      density: 0.06,
      restBars: 0.5,
      voices: [{ sound: 'note.glass', weight: 1, degrees: [0, 7], gain: 0.25 }],
      spread: 0.5,
    },
    events: [{ ...drips, perMinute: 3 }, farThunder(0.8, 0.45)],
    fade: 2,
  },
  'altar-t3': {
    layers: [
      { sound: 'amb.storm', gain: 0.45 },
      { sound: 'amb.hum', gain: 0.45 },
      { sound: 'pad.t3', gain: 0.38 },
    ],
    events: [farThunder(1.2, 0.5)],
    fade: 2.5,
  },
  // Over the dimmed altar: keep whatever room tone, just the hum and a soft pad.
  codex: {
    layers: [
      { sound: 'amb.hum', gain: 0.25 },
      { sound: 'pad.journal', gain: 0.3 },
    ],
    events: [],
    fade: 0.8,
  },
  journal: {
    layers: [
      { sound: 'amb.candle', gain: 0.7 },
      { sound: 'amb.storm', gain: 0.18 },
      { sound: 'pad.journal', gain: 0.4 },
    ],
    seq: {
      scale: 'majorPent',
      bpm: 56,
      density: 0.05,
      restBars: 0.6,
      voices: [{ sound: 'note.warm', weight: 1, degrees: [0, 6], gain: 0.28 }],
      spread: 0.4,
    },
    events: [],
    fade: 1.2,
  },
  // The Last Rune: no music. The storm, the hum and the player.
  'last-rune': {
    layers: [
      { sound: 'amb.storm', gain: 0.85 },
      { sound: 'amb.hum', gain: 0.45 },
    ],
    events: [farThunder(3, 0.85)],
    fade: 4,
  },
  ending: {
    layers: [
      { sound: 'pad.ending', gain: 0.6 },
      { sound: 'amb.storm', gain: 0.15 },
    ],
    seq: {
      scale: 'major',
      bpm: 72,
      density: 0.16,
      restBars: 0.2,
      voices: [
        { sound: 'note.warm', weight: 2, degrees: [0, 7], gain: 0.32 },
        { sound: 'note.glass', weight: 2, degrees: [-2, 7], gain: 0.28 },
        { sound: 'note.low', weight: 1, degrees: [-3, 4], gain: 0.4 },
      ],
      spread: 0.7,
    },
    events: [],
    fade: 5,
  },
};

export type SceneName = 'title' | 'hall' | 'altar' | 'codex' | 'journal' | 'last-rune' | 'ending';

/** The mood for a scene at a tier (1..3). The Last Rune and ending ignore tier. */
export function moodFor(scene: SceneName, tier = 1): MoodId {
  const t = Math.min(3, Math.max(1, Math.round(tier) || 1));
  switch (scene) {
    case 'hall':
    case 'altar':
      return `${scene}-t${t}` as MoodId;
    default:
      return scene;
  }
}

export interface TransitionPlan {
  /** Layers to start (fade in to their gain). */
  start: MoodLayer[];
  /** Layers already playing that only change gain. */
  retune: MoodLayer[];
  /** Sounds to fade out and stop. */
  stop: string[];
}

/** Which loops to start, keep (re-gain) and stop going between moods. Shared beds don't restart. */
export function planTransition(from: Mood | null, to: Mood): TransitionPlan {
  const before = new Map((from?.layers ?? []).map((l) => [l.sound, l] as const));
  const after = new Set(to.layers.map((l) => l.sound));
  return {
    start: to.layers.filter((l) => !before.has(l.sound)),
    retune: to.layers.filter((l) => before.has(l.sound)),
    stop: [...before.keys()].filter((s) => !after.has(s)),
  };
}

export interface NoteEvent {
  /** Seconds from the bar start. */
  t: number;
  sound: NoteSound;
  rate: number;
  gain: number;
  pan: number;
}

export interface SeqState {
  /** Last degree played per voice, for stepwise melody. */
  last: Partial<Record<NoteSound, number>>;
}

export const barSeconds = (seq: SeqConfig): number => (4 * 60) / seq.bpm;

/**
 * One bar of generative notes. Eighth-note grid; each slot sounds with `density` (downbeats
 * a little more likely); melody moves mostly by step within each voice's range so it reads
 * as phrases rather than noise. Deterministic for a given `rand`.
 */
export function planBar(seq: SeqConfig, rand: () => number, state: SeqState): NoteEvent[] {
  if (rand() < seq.restBars) return [];
  const scale = SCALES[seq.scale];
  const eighth = 60 / seq.bpm / 2;
  const total = seq.voices.reduce((a, v) => a + v.weight, 0);
  const out: NoteEvent[] = [];
  for (let slot = 0; slot < 8; slot++) {
    const p = seq.density * (slot % 4 === 0 ? 1.6 : slot % 2 === 0 ? 1 : 0.6);
    if (rand() >= p) continue;
    let pick = rand() * total;
    let voice = seq.voices[0]!;
    for (const v of seq.voices) {
      pick -= v.weight;
      if (pick <= 0) {
        voice = v;
        break;
      }
    }
    const [lo, hi] = voice.degrees;
    const prev = state.last[voice.sound] ?? Math.round((lo + hi) / 2);
    const r = rand();
    const step = r < 0.35 ? -1 : r < 0.7 ? 1 : r < 0.82 ? 0 : r < 0.91 ? -2 : 2;
    let deg = prev + step;
    if (deg < lo) deg = lo + (lo - deg);
    if (deg > hi) deg = hi - (deg - hi);
    deg = Math.min(hi, Math.max(lo, deg));
    state.last[voice.sound] = deg;
    out.push({
      t: slot * eighth,
      sound: voice.sound,
      rate: rateForSemis(degreeToSemis(scale, deg)),
      gain: voice.gain * (0.75 + 0.25 * rand()),
      pan: (rand() * 2 - 1) * seq.spread,
    });
  }
  return out;
}

/** Chance an event with `perMinute` fires within `dt` seconds. */
export const eventChance = (perMinute: number, dt: number): number =>
  1 - Math.exp((-perMinute * dt) / 60);

export const lerp = (r: readonly [number, number], u: number): number => r[0] + (r[1] - r[0]) * u;
