/**
 * The Last Rune sound bank: every named game sound as data (an engine `SoundSpec` plus game
 * post-processing: reverb, saturation, final level, bus). Pure; `render.ts` turns a def into
 * an `AudioBuffer`, and `bank.test.ts` validates every spec in Node.
 *
 * Sonic identity (docs/design/audio.md): everything in D. Gems are glass bells on the
 * D major pentatonic, the factory hums on D, FUSE is a little brass reed, and the stone
 * hall gives everything a long cool tail.
 */
import {
  type Layer,
  loopSafeFreq,
  midiToHz,
  type OutputBus,
  pluck,
  type SoundSpec,
} from '@engine/audio';
import { GEM_KINDS, type GemKind } from '../rules/types';
import type { ReverbOptions } from './post';
import { GEM_VOICES, gemHz } from './theory';
import {
  at,
  gemBell,
  glassBell,
  HOLD,
  knockLayers,
  oneShot,
  padLayers,
  plinks,
  riffle,
  snap,
  stoneSeat,
} from './voices';

/** Pre-render priority: lower renders first after unlock. */
export type RenderGroup = 0 | 1 | 2 | 3;

export interface SoundDef {
  spec: SoundSpec;
  bus: OutputBus;
  /** Final peak (linear) after post-processing. ≤ 0.85 keeps every sound under -1 dBFS. */
  level: number;
  reverb?: ReverbOptions;
  /** tanh drive 0..1 before the reverb (warmth). */
  saturate?: number;
  maxVoices?: number;
  group: RenderGroup;
}

/** Reverb rooms. */
export const ROOMS = {
  /** The stone factory hall: long, cool, a little dark. */
  hall: { room: 0.8, damp: 0.35, wet: 0.2, preDelay: 0.025, width: 1 },
  /** The altar chamber: closer walls. */
  altar: { room: 0.62, damp: 0.45, wet: 0.14, preDelay: 0.012 },
  /** Desk, book, UI: a small warm room. */
  small: { room: 0.4, damp: 0.6, wet: 0.07, preDelay: 0.006 },
  /** Music: big and soft. */
  music: { room: 0.86, damp: 0.3, wet: 0.32, preDelay: 0.03 },
} as const satisfies Record<string, ReverbOptions>;

const hz = midiToHz;
const pentHz = (midis: readonly number[]) => midis.map(hz);

// ---------------------------------------------------------------- gems

function gemPlace(gem: GemKind): SoundDef {
  const v = GEM_VOICES[gem];
  return {
    spec: oneShot([
      ...stoneSeat(0.8, 41),
      ...at(
        0.006,
        gemBell(v, (i) => gemHz(gem, i), 1, 31),
      ),
    ]),
    bus: 'sfx',
    level: 0.7,
    reverb: ROOMS.altar,
    maxVoices: 4,
    group: 0,
  };
}

function boltStep(gem: GemKind): SoundDef {
  const v = GEM_VOICES[gem];
  // Up an octave from the placed bell, short: the bolt "plays" each gem as it passes.
  return {
    spec: oneShot([
      ...snap(gemHz(gem), 0.8, 51),
      ...at(
        0.004,
        gemBell(v, (i) => gemHz(gem, i) * 2, 0.4, 37),
      ),
    ]),
    bus: 'sfx',
    level: 0.6,
    reverb: ROOMS.altar,
    maxVoices: 6,
    group: 1,
  };
}

const gemPick: SoundDef = {
  // Lifting a cut stone: a light glass tick, a breath of air upward, a faint stone scrape.
  spec: oneShot([
    {
      source: { type: 'noise', color: 'pink', seed: 101 },
      env: { attack: 0.06, decay: 0.12, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 700, freqEnd: 3200, q: 1.4 },
      gain: 0.35,
    },
    {
      source: { type: 'noise', color: 'brown', seed: 102 },
      env: pluck(0.06, 0.004),
      filter: { type: 'bandpass', freq: 500, q: 1.2 },
      gain: 0.4,
    },
    ...at(
      0.02,
      glassBell({
        freq: hz(93),
        ring: 0.35,
        bright: 0.4,
        partials: 'clear',
        gain: 0.4,
        strike: 0.3,
      }),
    ),
  ]),
  bus: 'sfx',
  level: 0.45,
  reverb: ROOMS.small,
  maxVoices: 4,
  group: 0,
};

const gemRotate: SoundDef = {
  // Stone grinding a quarter turn, landing in a detent, with a small glass ting.
  spec: oneShot([
    {
      source: { type: 'noise', color: 'brown', seed: 111 },
      env: { attack: 0.015, hold: 0.06, decay: 0.05, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 420, q: 1.5 },
      tremolo: { rate: 45, depth: 0.7 },
      gain: 1,
    },
    ...at(0.11, knockLayers(260, { gain: 0.5, decay: 0.05, seed: 112 })),
    ...at(0.115, [
      {
        source: { type: 'osc', wave: 'sine', freq: hz(93) },
        env: pluck(0.25, 0.002),
        gain: 0.12,
      } satisfies Layer,
    ]),
  ]),
  bus: 'sfx',
  level: 0.5,
  reverb: ROOMS.small,
  maxVoices: 4,
  group: 0,
};

const socketBlocked: SoundDef = {
  // "No." A dull double thunk and a short low buzz. Firm, never harsh.
  spec: oneShot([
    ...knockLayers(150, { gain: 0.9, decay: 0.12, dark: 0.8, seed: 121 }),
    ...at(0.09, knockLayers(120, { gain: 0.7, decay: 0.12, dark: 0.8, seed: 122 })),
    {
      source: { type: 'osc', wave: 'square', freq: 98 },
      env: { attack: 0.004, hold: 0.08, decay: 0.08, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'lowpass', freq: 520, q: 1 },
      start: 0.02,
      gain: 0.28,
    },
  ]),
  bus: 'sfx',
  level: 0.55,
  reverb: ROOMS.small,
  maxVoices: 2,
  group: 0,
};

// ---------------------------------------------------------------- machine outcomes

const machineUnder: SoundDef = {
  // Too little charge: the motor tries, coughs, and winds down. A small sad "bwoo".
  spec: oneShot([
    {
      source: { type: 'osc', wave: 'sawtooth', freq: 42, freqEnd: 74, glide: 0.35 },
      env: { attack: 0.05, hold: 0.25, decay: 0.08, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'lowpass', freq: 380, freqEnd: 650, q: 3 },
      gain: 0.7,
    },
    {
      source: { type: 'osc', wave: 'sawtooth', freq: 74, freqEnd: 26, glide: 0.8 },
      env: { attack: 0.02, decay: 0.85, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'lowpass', freq: 600, freqEnd: 140, q: 3 },
      start: 0.35,
      gain: 0.75,
    },
    {
      source: { type: 'crackle', density: 55, seed: 131, clickDecay: 0.006 },
      env: { attack: 0.01, decay: 0.9, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 1600, q: 0.8 },
      start: 0.1,
      gain: 0.8,
    },
    {
      source: { type: 'osc', wave: 'square', freq: hz(69), freqEnd: hz(62), glide: 0.18 },
      env: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'lowpass', freq: 1100, q: 1 },
      start: 1.0,
      gain: 0.12,
    },
  ]),
  bus: 'sfx',
  level: 0.6,
  reverb: ROOMS.altar,
  maxVoices: 2,
  group: 1,
};

const machineExact: SoundDef = (() => {
  // The bolt lands through the ceiling (crack + boom), the machine spins up on D, and a
  // stack of gem bells climbs the pentatonic: the solve.
  const stack = [74, 78, 81, 86, 88, 93];
  const bells = stack.flatMap((m, i) =>
    at(
      0.3 + i * 0.11,
      glassBell({
        freq: hz(m),
        ring: 2.2 - i * 0.12,
        bright: 0.5,
        partials: i % 2 ? 'glass' : 'clear',
        gain: 0.5,
        pan: -0.5 + i * 0.2,
        seed: 140 + i,
      }),
    ),
  );
  return {
    spec: oneShot([
      {
        source: { type: 'noise', color: 'white', seed: 141 },
        env: pluck(0.12, 0.0008),
        filter: { type: 'highpass', freq: 1800, q: 0.7 },
        gain: 0.7,
      },
      {
        source: { type: 'crackle', density: 160, seed: 142, clickDecay: 0.004 },
        env: pluck(0.6, 0.001),
        filter: { type: 'bandpass', freq: 3200, q: 0.7 },
        gain: 0.8,
      },
      {
        source: { type: 'noise', color: 'brown', seed: 143 },
        env: { attack: 0.006, decay: 2.0, sustain: 0, release: 0.01, curve: 'exp' },
        filter: { type: 'lowpass', freq: 320, freqEnd: 70, q: 0.8 },
        gain: 1.3,
      },
      {
        source: { type: 'osc', wave: 'sine', freq: 62, freqEnd: 31, glide: 0.5 },
        env: pluck(0.9, 0.002),
        gain: 0.7,
      },
      {
        source: { type: 'osc', wave: 'sawtooth', freq: hz(26), freqEnd: hz(38), glide: 1.2 },
        env: { attack: 0.4, decay: 0.6, sustain: 0.5, release: 0.9, curve: 'exp' },
        gate: 2.0,
        filter: { type: 'lowpass', freq: 220, freqEnd: 700, q: 2 },
        start: 0.2,
        gain: 0.3,
      },
      ...bells,
      ...plinks(10, 1.0, 1.0, pentHz([98, 100, 102, 105, 107]), { gain: 0.18, seed: 149 }),
    ]),
    bus: 'sfx',
    level: 0.84,
    reverb: { ...ROOMS.hall, wet: 0.18 },
    maxVoices: 1,
    group: 1,
  };
})();

const breakerTrip: SoundDef = {
  // Too much: a hard electric bang, the breaker relay clacks open twice, the buzz collapses
  // and sparks rain down. Loud but rounded off below -1 dBFS.
  spec: oneShot([
    {
      source: { type: 'noise', color: 'white', seed: 151 },
      env: pluck(0.07, 0.0005),
      filter: { type: 'lowpass', freq: 9000, q: 0.7 },
      gain: 1,
    },
    {
      source: { type: 'osc', wave: 'square', freq: 230, freqEnd: 38, glide: 0.16 },
      env: pluck(0.22, 0.0008),
      filter: { type: 'lowpass', freq: 2200, q: 1 },
      gain: 0.45,
    },
    {
      source: { type: 'osc', wave: 'sine', freq: 72, freqEnd: 34, glide: 0.25 },
      env: pluck(0.4, 0.001),
      gain: 0.9,
    },
    ...at(0.03, knockLayers(1500, { gain: 0.35, decay: 0.03, dark: 0, seed: 152 })),
    ...at(0.17, knockLayers(1300, { gain: 0.3, decay: 0.03, dark: 0, seed: 153 })),
    {
      source: { type: 'osc', wave: 'sawtooth', freq: 120, freqEnd: 32, glide: 0.95 },
      env: { attack: 0.01, decay: 1.0, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 800, freqEnd: 180, q: 3 },
      tremolo: { rate: 26, depth: 0.7 },
      start: 0.05,
      gain: 0.5,
    },
    {
      source: { type: 'crackle', density: 70, seed: 154, clickDecay: 0.005 },
      env: { attack: 0.005, decay: 1.1, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 4800, q: 0.7 },
      start: 0.08,
      gain: 0.9,
      pan: 0.2,
    },
  ]),
  bus: 'sfx',
  level: 0.84,
  reverb: ROOMS.altar,
  saturate: 0.3,
  maxVoices: 1,
  group: 1,
};

// ---------------------------------------------------------------- loops on the altar

function boltLow(): SoundDef {
  const d = 4;
  return {
    spec: {
      duration: d,
      loop: { crossfade: 0.3 },
      sampleRate: 44100,
      layers: [
        {
          source: { type: 'osc', wave: 'sawtooth', freq: 73.5 },
          env: HOLD,
          filter: { type: 'lowpass', freq: 320, q: 1.5 },
          tremolo: { rate: 2 / d, depth: 0.3 },
          gain: 0.35,
        },
        {
          source: { type: 'osc', wave: 'sine', freq: 147 },
          env: HOLD,
          gain: 0.15,
        },
        {
          source: { type: 'crackle', density: 22, seed: 161, clickDecay: 0.005 },
          env: HOLD,
          filter: { type: 'bandpass', freq: 2600, q: 0.7 },
          gain: 0.9,
          pan: -0.2,
        },
        {
          source: { type: 'noise', color: 'brown', seed: 162 },
          env: HOLD,
          filter: { type: 'lowpass', freq: 160 },
          gain: 0.35,
        },
      ],
    },
    bus: 'sfx',
    level: 0.5,
    maxVoices: 2,
    group: 1,
  };
}

function boltHigh(): SoundDef {
  const d = 3;
  return {
    spec: {
      duration: d,
      loop: { crossfade: 0.25 },
      layers: [
        {
          source: { type: 'crackle', density: 110, seed: 171, clickDecay: 0.003 },
          env: HOLD,
          filter: { type: 'bandpass', freq: 4200, q: 0.6 },
          gain: 1,
          pan: 0.25,
        },
        {
          source: { type: 'noise', color: 'white', seed: 172 },
          env: HOLD,
          filter: { type: 'bandpass', freq: 6500, q: 2 },
          tremolo: { rate: 21 / d, depth: 0.6 },
          gain: 0.2,
        },
        {
          source: {
            type: 'osc',
            wave: 'sawtooth',
            freq: 147,
            vibrato: { rate: 18 / d, depth: 25 },
          },
          env: HOLD,
          filter: { type: 'bandpass', freq: 950, q: 4 },
          gain: 0.25,
        },
      ],
    },
    bus: 'sfx',
    level: 0.5,
    maxVoices: 2,
    group: 1,
  };
}

/** Storm cell hum at 1×, 2×, 4×: deeper, denser and faster with strength. */
function stormCell(strength: 1 | 2 | 4): SoundDef {
  const d = 6;
  const s = strength === 1 ? 0 : strength === 2 ? 1 : 2;
  const layers: Layer[] = [
    {
      source: { type: 'osc', wave: 'sine', freq: 73.5 },
      env: HOLD,
      tremolo: { rate: (3 * (s + 1)) / d, depth: 0.25 + 0.12 * s },
      gain: 0.5,
    },
    {
      source: { type: 'osc', wave: 'triangle', freq: 147 },
      env: HOLD,
      filter: { type: 'lowpass', freq: 600 },
      gain: 0.2,
    },
    {
      source: { type: 'crackle', density: [7, 16, 36][s]!, seed: 181 + s, clickDecay: 0.004 },
      env: HOLD,
      filter: { type: 'bandpass', freq: 2200 + 800 * s, q: 0.7 },
      gain: 0.7,
      pan: 0.15,
    },
    {
      source: { type: 'noise', color: 'brown', seed: 185 },
      env: HOLD,
      filter: { type: 'lowpass', freq: 130 },
      tremolo: { rate: 1 / d, depth: 0.4 },
      gain: 0.45,
    },
  ];
  if (s >= 1)
    layers.push({
      source: { type: 'osc', wave: 'sine', freq: 110 },
      env: HOLD,
      tremolo: { rate: 5 / d, depth: 0.4 },
      gain: 0.25,
    });
  if (s >= 2)
    layers.push(
      {
        source: { type: 'osc', wave: 'sine', freq: loopSafeFreq(36.75, d) },
        env: HOLD,
        tremolo: { rate: 12 / d, depth: 0.5 },
        gain: 0.45,
      },
      {
        source: { type: 'osc', wave: 'sawtooth', freq: 73.5 },
        env: HOLD,
        filter: { type: 'lowpass', freq: 420, q: 3 },
        tremolo: { rate: 12 / d, depth: 0.5 },
        gain: 0.2,
      },
      {
        source: { type: 'noise', color: 'white', seed: 187 },
        env: HOLD,
        filter: { type: 'bandpass', freq: 5200, q: 1.5 },
        tremolo: { rate: 24 / d, depth: 0.7 },
        gain: 0.08,
      },
    );
  return {
    spec: { duration: d, loop: { crossfade: 0.4 }, layers },
    bus: 'sfx',
    level: 0.45 + 0.1 * s,
    maxVoices: 1,
    group: 2,
  };
}

// ---------------------------------------------------------------- progression and story

const gemGranted: SoundDef = {
  // A new gem slides in on a gold plate: an upward breath, a strummed warm chord of gem
  // bells, gold sparkle on top and a low warm bloom underneath.
  spec: oneShot([
    {
      source: { type: 'noise', color: 'pink', seed: 201 },
      env: { attack: 0.3, decay: 0.3, sustain: 0, release: 0.01, curve: 'linear' },
      filter: { type: 'bandpass', freq: 400, freqEnd: 3600, q: 1.3 },
      gain: 0.45,
    },
    ...[74, 78, 81, 88].flatMap((m, i) =>
      at(
        0.3 + i * 0.045,
        glassBell({
          freq: hz(m),
          ring: 2.4,
          bright: 0.4,
          gain: 0.45,
          pan: -0.3 + i * 0.2,
          seed: 202 + i,
        }),
      ),
    ),
    {
      source: { type: 'osc', wave: 'triangle', freq: hz(50) },
      env: { attack: 0.08, decay: 1.6, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'lowpass', freq: 700 },
      start: 0.28,
      gain: 0.35,
    },
    ...plinks(9, 0.45, 0.8, pentHz([98, 100, 102, 105, 107, 110]), { gain: 0.16, seed: 209 }),
  ]),
  bus: 'sfx',
  level: 0.75,
  reverb: ROOMS.hall,
  maxVoices: 1,
  group: 2,
};

const doorUnlock: SoundDef = {
  // Iron latch, a stone slab grinding aside with its chain, a heavy final clunk.
  spec: oneShot([
    {
      source: { type: 'osc', wave: 'sine', freq: 190, fm: { ratio: 1.41, index: 3, indexEnd: 0 } },
      env: pluck(0.25, 0.001),
      gain: 0.5,
    },
    ...knockLayers(240, { gain: 0.5, decay: 0.06, dark: 0.3, seed: 211 }),
    {
      source: { type: 'noise', color: 'brown', seed: 212 },
      env: { attack: 0.08, hold: 0.45, decay: 0.2, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 340, q: 1.4 },
      tremolo: { rate: 13, depth: 0.55 },
      start: 0.15,
      gain: 1.2,
    },
    {
      source: { type: 'noise', color: 'pink', seed: 213 },
      env: { attack: 0.1, hold: 0.4, decay: 0.2, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 1300, q: 1.2 },
      tremolo: { rate: 23, depth: 0.6 },
      start: 0.17,
      gain: 0.18,
    },
    {
      source: { type: 'crackle', density: 45, seed: 214, clickDecay: 0.012 },
      env: { attack: 0.02, hold: 0.45, decay: 0.15, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 2800, q: 1.5 },
      start: 0.2,
      gain: 0.35,
      pan: 0.3,
    },
    ...at(0.95, knockLayers(88, { gain: 1, decay: 0.4, dark: 0.7, seed: 215 })),
    {
      source: { type: 'osc', wave: 'sine', freq: 140, fm: { ratio: 2.76, index: 2, indexEnd: 0 } },
      env: pluck(0.5, 0.001),
      start: 0.95,
      gain: 0.25,
    },
  ]),
  bus: 'sfx',
  level: 0.8,
  reverb: ROOMS.hall,
  maxVoices: 1,
  group: 2,
};

const pageFound: SoundDef = {
  // A parchment page flutters down and settles; the faintest warm ting.
  spec: oneShot([
    {
      source: { type: 'noise', color: 'pink', seed: 221 },
      env: { attack: 0.03, decay: 0.32, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 3400, q: 0.8 },
      tremolo: { rate: 17, depth: 0.85 },
      gain: 0.8,
      pan: -0.2,
    },
    {
      source: { type: 'noise', color: 'pink', seed: 222 },
      env: { attack: 0.03, decay: 0.28, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 2400, q: 0.8 },
      tremolo: { rate: 11, depth: 0.8 },
      start: 0.18,
      gain: 0.6,
      pan: 0.2,
    },
    ...at(0.48, riffle(2, 0, 0.03, { freq: 2200, gain: 0.5, seed: 223 })),
    ...at(0.5, knockLayers(200, { gain: 0.25, decay: 0.05, dark: 0.9, seed: 224 })),
    {
      source: { type: 'osc', wave: 'sine', freq: hz(86) },
      env: pluck(0.9, 0.004),
      start: 0.52,
      gain: 0.05,
    },
  ]),
  bus: 'sfx',
  level: 0.55,
  reverb: ROOMS.small,
  maxVoices: 1,
  group: 2,
};

const codexOpen: SoundDef = {
  // Heavy leather tome: creak of the spine, the cover thumps open, pages riffle.
  spec: oneShot([
    {
      source: { type: 'osc', wave: 'sawtooth', freq: 70, freqEnd: 98, glide: 0.22 },
      env: { attack: 0.05, decay: 0.18, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 520, q: 6 },
      tremolo: { rate: 31, depth: 0.5 },
      gain: 0.35,
    },
    ...at(0.2, knockLayers(105, { gain: 0.9, decay: 0.18, dark: 0.85, seed: 231 })),
    ...riffle(6, 0.24, 0.035, { freq: 3000, gain: 0.55, seed: 232 }),
  ]),
  bus: 'ui',
  level: 0.5,
  reverb: ROOMS.small,
  maxVoices: 1,
  group: 2,
};

const codexClose: SoundDef = {
  spec: oneShot([
    ...riffle(3, 0, 0.03, { freq: 2600, gain: 0.45, seed: 241 }),
    {
      source: { type: 'osc', wave: 'sawtooth', freq: 95, freqEnd: 72, glide: 0.1 },
      env: { attack: 0.02, decay: 0.08, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 480, q: 6 },
      start: 0.04,
      gain: 0.3,
    },
    ...at(0.12, knockLayers(95, { gain: 1, decay: 0.2, dark: 0.85, seed: 242 })),
  ]),
  bus: 'ui',
  level: 0.5,
  reverb: ROOMS.small,
  maxVoices: 1,
  group: 2,
};

const uiHover: SoundDef = {
  spec: oneShot([
    { source: { type: 'osc', wave: 'sine', freq: hz(98) }, env: pluck(0.035, 0.002), gain: 0.6 },
    {
      source: { type: 'osc', wave: 'triangle', freq: hz(110) },
      env: pluck(0.012, 0.001),
      gain: 0.1,
    },
  ]),
  bus: 'ui',
  level: 0.22,
  maxVoices: 3,
  group: 0,
};

const uiClick: SoundDef = {
  // A small stone tick with a glint of glass.
  spec: oneShot([
    {
      source: { type: 'osc', wave: 'triangle', freq: 1300, freqEnd: 850, glide: 0.02 },
      env: pluck(0.03, 0.0008),
      gain: 0.7,
    },
    {
      source: { type: 'noise', color: 'white', seed: 251 },
      env: pluck(0.006, 0.0005),
      filter: { type: 'highpass', freq: 3000 },
      gain: 0.3,
    },
    {
      source: { type: 'osc', wave: 'sine', freq: hz(93) },
      env: pluck(0.12, 0.002),
      start: 0.004,
      gain: 0.18,
    },
  ]),
  bus: 'ui',
  level: 0.4,
  reverb: ROOMS.small,
  maxVoices: 3,
  group: 0,
};

// ---------------------------------------------------------------- FUSE

/** Vowel formants (F1, F2) for FUSE's brass reed. */
export const FUSE_VOWELS = {
  a: [730, 1090],
  e: [530, 1840],
  i: [390, 2100],
  o: [570, 840],
  u: [440, 1020],
} as const;
export type FuseVowel = keyof typeof FUSE_VOWELS;
export const FUSE_BASE_HZ = 196; // G3: below the gems, warm.

function fuseBlip(vowel: FuseVowel, quiet: boolean): SoundDef {
  const [f1, f2] = FUSE_VOWELS[vowel];
  const f0 = quiet ? FUSE_BASE_HZ * 0.94 : FUSE_BASE_HZ;
  const env = quiet
    ? { attack: 0.014, hold: 0.02, decay: 0.07, sustain: 0, release: 0.01, curve: 'exp' as const }
    : { attack: 0.005, hold: 0.025, decay: 0.05, sustain: 0, release: 0.01, curve: 'exp' as const };
  // A little "bwip": the pitch lifts into the note like a reed being blown.
  const src = {
    type: 'osc' as const,
    wave: 'sawtooth' as const,
    freq: f0 * 0.93,
    freqEnd: f0,
    glide: 0.025,
  };
  const layers: Layer[] = [
    { source: src, env, filter: { type: 'bandpass', freq: f1, q: 4 }, gain: 1 },
    { source: src, env, filter: { type: 'bandpass', freq: f2, q: 5 }, gain: quiet ? 0.25 : 0.6 },
    {
      source: { type: 'osc', wave: 'square', freq: f0 * 0.93, freqEnd: f0, glide: 0.025 },
      env,
      filter: { type: 'lowpass', freq: quiet ? 400 : 650 },
      gain: 0.35,
    },
  ];
  if (!quiet)
    layers.push({
      // Servo tick under the voice.
      source: { type: 'noise', color: 'white', seed: 261 },
      env: pluck(0.01, 0.001),
      filter: { type: 'bandpass', freq: 5200, q: 3 },
      gain: 0.12,
    });
  return {
    spec: oneShot(layers, quiet ? { duration: 0.14 } : {}),
    bus: 'sfx',
    level: quiet ? 0.32 : 0.42,
    saturate: quiet ? 0.1 : 0.45,
    reverb: { ...ROOMS.small, wet: 0.05 },
    maxVoices: 3,
    group: 0,
  };
}

const fuseBzzt: SoundDef = {
  // "This unit does not do a victory noise. Bzzt." A buzz, then a servo whirr, very proud.
  spec: oneShot([
    {
      source: { type: 'osc', wave: 'square', freq: 110 },
      env: { attack: 0.01, hold: 0.22, decay: 0.08, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 900, q: 2 },
      tremolo: { rate: 28, depth: 0.85 },
      gain: 0.8,
    },
    {
      source: { type: 'osc', wave: 'sawtooth', freq: 55 },
      env: { attack: 0.01, hold: 0.22, decay: 0.08, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'lowpass', freq: 300 },
      gain: 0.5,
    },
    {
      source: { type: 'osc', wave: 'sawtooth', freq: 420, freqEnd: 640, glide: 0.1 },
      env: { attack: 0.01, hold: 0.05, decay: 0.06, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 1600, q: 8 },
      start: 0.34,
      gain: 0.35,
    },
  ]),
  bus: 'sfx',
  level: 0.5,
  saturate: 0.3,
  reverb: ROOMS.small,
  maxVoices: 1,
  group: 1,
};

// ---------------------------------------------------------------- story beats

const knock: SoundDef = {
  // Title: "Someone's at the door." Three knocks on a heavy door, far down the hall.
  spec: oneShot([
    ...knockLayers(92, { gain: 1, decay: 0.16, dark: 0.6, seed: 271 }),
    ...at(0.27, knockLayers(96, { gain: 0.9, decay: 0.16, dark: 0.6, seed: 272 })),
    ...at(0.5, knockLayers(90, { gain: 1, decay: 0.18, dark: 0.6, seed: 273 })),
  ]),
  bus: 'sfx',
  level: 0.7,
  reverb: { ...ROOMS.hall, wet: 0.32 },
  maxVoices: 1,
  group: 3,
};

const clipboardDrop: SoundDef = {
  // Ending beat 1: FUSE drops the clipboard. A thin board clatters twice, papers slide.
  spec: oneShot([
    {
      source: { type: 'osc', wave: 'sine', freq: 410, fm: { ratio: 1.7, index: 2.2, indexEnd: 0 } },
      env: pluck(0.07, 0.0008),
      gain: 0.8,
    },
    ...knockLayers(300, { gain: 0.6, decay: 0.05, dark: 0.2, seed: 281 }),
    ...at(0.15, [
      {
        source: {
          type: 'osc',
          wave: 'sine',
          freq: 450,
          fm: { ratio: 1.7, index: 1.5, indexEnd: 0 },
        },
        env: pluck(0.05, 0.0008),
        gain: 0.45,
      } satisfies Layer,
      ...knockLayers(320, { gain: 0.35, decay: 0.04, dark: 0.2, seed: 282 }),
    ]),
    ...at(0.24, knockLayers(340, { gain: 0.18, decay: 0.03, dark: 0.2, seed: 283 })),
    {
      source: { type: 'noise', color: 'pink', seed: 284 },
      env: { attack: 0.03, decay: 0.3, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 2800, q: 0.9 },
      start: 0.06,
      gain: 0.3,
    },
  ]),
  bus: 'sfx',
  level: 0.6,
  reverb: ROOMS.hall,
  maxVoices: 1,
  group: 3,
};

const tarp: SoundDef = {
  // Storm Cell II: the tarp comes off. Heavy cloth swept away, a soft flop.
  spec: oneShot([
    {
      source: { type: 'noise', color: 'pink', seed: 291 },
      env: { attack: 0.06, decay: 0.55, sustain: 0, release: 0.01, curve: 'exp' },
      filter: { type: 'bandpass', freq: 1700, freqEnd: 500, q: 0.9 },
      tremolo: { rate: 9, depth: 0.55 },
      gain: 1,
    },
    ...at(0.5, knockLayers(80, { gain: 0.5, decay: 0.15, dark: 0.9, seed: 292 })),
  ]),
  bus: 'sfx',
  level: 0.6,
  reverb: ROOMS.hall,
  maxVoices: 1,
  group: 3,
};

function thunder(seed: number): SoundDef {
  // Distant thunder for the hall: a far crack and a long uneven rumble.
  return {
    spec: oneShot(
      [
        {
          source: { type: 'noise', color: 'white', seed },
          env: pluck(0.35, 0.004),
          filter: { type: 'lowpass', freq: 2200, q: 0.7 },
          gain: 0.15,
        },
        {
          source: { type: 'crackle', density: 28, seed: seed + 1, clickDecay: 0.035 },
          env: { attack: 0.15, decay: 3.6, sustain: 0, release: 0.01, curve: 'exp' },
          filter: { type: 'lowpass', freq: 320, freqEnd: 110, q: 0.7 },
          gain: 1.4,
        },
        {
          source: { type: 'noise', color: 'brown', seed: seed + 2 },
          env: { attack: 0.35, decay: 3.2, sustain: 0, release: 0.01, curve: 'exp' },
          filter: { type: 'lowpass', freq: 180, q: 0.7 },
          gain: 1,
        },
      ],
      { sampleRate: 22050 },
    ),
    bus: 'music',
    level: 0.6,
    reverb: { ...ROOMS.hall, wet: 0.3 },
    maxVoices: 2,
    group: 3,
  };
}

const drip: SoundDef = {
  // A water drip somewhere in the dark: a rising "plip" with a big stone tail.
  spec: oneShot([
    {
      source: { type: 'osc', wave: 'sine', freq: 1250, freqEnd: 2500, glide: 0.025 },
      env: pluck(0.05, 0.001),
      gain: 0.7,
    },
    {
      source: { type: 'osc', wave: 'sine', freq: 880 },
      env: pluck(0.03, 0.001),
      gain: 0.2,
    },
  ]),
  bus: 'music',
  level: 0.35,
  reverb: { ...ROOMS.hall, wet: 0.55, dry: 0.7 },
  maxVoices: 3,
  group: 3,
};

const endingSwell: SoundDef = (() => {
  // Gold floods the hall: a D add9 chord swelling from the low end up, shimmer and sparkle at
  // the crest, then a long warm release.
  const chord = [50, 57, 62, 66, 69, 76];
  const tones: Layer[] = chord.flatMap((m, i) => {
    const f = hz(m);
    const env = {
      attack: 2.6 + i * 0.25,
      hold: 1.2,
      decay: 0,
      sustain: 1,
      release: 2.4,
      curve: 'exp' as const,
    };
    const gate = 4.6;
    return [
      {
        source: { type: 'osc', wave: 'sawtooth', freq: f, vibrato: { rate: 4.5, depth: 4 } },
        env,
        gate,
        filter: { type: 'lowpass', freq: 300, freqEnd: 2600, q: 0.7 },
        gain: 0.22 / (1 + i * 0.15),
        pan: -0.5 + i * 0.2,
      },
      {
        source: { type: 'osc', wave: 'triangle', freq: f * 1.003 },
        env,
        gate,
        gain: 0.35 / (1 + i * 0.15),
        pan: 0.5 - i * 0.2,
      },
    ] satisfies Layer[];
  });
  return {
    spec: oneShot([
      ...tones,
      {
        source: { type: 'noise', color: 'pink', seed: 301 },
        env: { attack: 3.6, decay: 2.5, sustain: 0, release: 0.01, curve: 'exp' },
        filter: { type: 'bandpass', freq: 1500, freqEnd: 5000, q: 0.6 },
        gain: 0.1,
      },
      ...[86, 93, 90].map(
        (m, i): Layer => ({
          source: { type: 'osc', wave: 'sine', freq: hz(m) },
          env: { attack: 3.2, hold: 0.8, decay: 2.2, sustain: 0, release: 0.01, curve: 'exp' },
          tremolo: { rate: 4 + i, depth: 0.5 },
          start: 0.3 * i,
          gain: 0.06,
          pan: i - 1,
        }),
      ),
      ...plinks(14, 3.4, 2.0, pentHz([86, 88, 90, 93, 95, 98]), {
        gain: 0.12,
        seed: 309,
        ring: 0.6,
      }),
    ]),
    bus: 'music',
    level: 0.8,
    reverb: ROOMS.music,
    saturate: 0.15,
    maxVoices: 1,
    group: 3,
  };
})();

// ---------------------------------------------------------------- music notes (sequencer)

/** Base MIDI note each note sample is rendered at (the sequencer pitches by rate). */
export const NOTE_BASE = {
  'note.glass': 74, // D5
  'note.low': 50, // D3
  'note.box': 86, // D6
  'note.warm': 62, // D4
} as const;
export type NoteSound = keyof typeof NOTE_BASE;

const noteGlass: SoundDef = {
  spec: oneShot(
    glassBell({
      freq: hz(NOTE_BASE['note.glass']),
      ring: 2.6,
      bright: 0.35,
      partials: 'clear',
      strike: 0.25,
    }),
  ),
  bus: 'music',
  level: 0.5,
  reverb: ROOMS.music,
  maxVoices: 6,
  group: 2,
};

const noteLow: SoundDef = {
  // Soft low mallet (marimba-like 1:4 partials).
  spec: oneShot([
    {
      source: { type: 'osc', wave: 'sine', freq: hz(NOTE_BASE['note.low']) },
      env: pluck(1.6, 0.004),
      gain: 1,
    },
    {
      source: { type: 'osc', wave: 'sine', freq: hz(NOTE_BASE['note.low']) * 3.99 },
      env: pluck(0.35, 0.003),
      gain: 0.25,
    },
    {
      source: { type: 'osc', wave: 'triangle', freq: hz(NOTE_BASE['note.low']) * 2 },
      env: pluck(0.6, 0.004),
      filter: { type: 'lowpass', freq: 900 },
      gain: 0.2,
    },
  ]),
  bus: 'music',
  level: 0.5,
  reverb: ROOMS.music,
  maxVoices: 4,
  group: 2,
};

const noteBox: SoundDef = {
  // Music-box tine for the journal desk.
  spec: oneShot([
    ...glassBell({
      freq: hz(NOTE_BASE['note.box']),
      ring: 1.4,
      bright: 0.2,
      partials: 'clear',
      strike: 0.6,
      gain: 0.8,
    }),
  ]),
  bus: 'music',
  level: 0.38,
  reverb: ROOMS.small,
  maxVoices: 4,
  group: 2,
};

const noteWarm: SoundDef = {
  // A soft horn-ish note: warm saw through a low-pass, for the ending and title.
  spec: oneShot([
    {
      source: {
        type: 'osc',
        wave: 'sawtooth',
        freq: hz(NOTE_BASE['note.warm']),
        vibrato: { rate: 5, depth: 6 },
      },
      env: { attack: 0.12, decay: 0.5, sustain: 0.55, release: 0.9, curve: 'exp' },
      gate: 0.8,
      filter: { type: 'lowpass', freq: 1300, freqEnd: 700, q: 0.8 },
      gain: 0.6,
    },
    {
      source: { type: 'osc', wave: 'triangle', freq: hz(NOTE_BASE['note.warm']) * 2.002 },
      env: { attack: 0.1, decay: 0.6, sustain: 0.3, release: 0.8, curve: 'exp' },
      gate: 0.8,
      gain: 0.3,
    },
  ]),
  bus: 'music',
  level: 0.45,
  reverb: ROOMS.music,
  saturate: 0.2,
  maxVoices: 4,
  group: 2,
};

// ---------------------------------------------------------------- music beds (loops)

const LOOP_SR = 22050;
const PAD_LEN = 12;

function pad(
  chordMidi: readonly number[],
  o: Partial<Parameters<typeof padLayers>[0]> & { level?: number },
): SoundDef {
  return {
    spec: {
      duration: PAD_LEN,
      loop: { crossfade: 1 },
      sampleRate: LOOP_SR,
      channels: 2,
      layers: padLayers({ duration: PAD_LEN, chordHz: chordMidi.map(hz), cutoff: 1200, ...o }),
    },
    bus: 'music',
    level: o.level ?? 0.5,
    reverb: ROOMS.music,
    maxVoices: 1,
    group: 2,
  };
}

const ambStorm: SoundDef = {
  // Distant storm over the factory roof: rumble, faint far cracks, wind. No rain (FUSE
  // would find rain awkward).
  spec: {
    duration: 12,
    loop: { crossfade: 1 },
    sampleRate: LOOP_SR,
    channels: 2,
    layers: [
      {
        source: { type: 'noise', color: 'brown', seed: 311 },
        env: HOLD,
        filter: { type: 'lowpass', freq: 150 },
        tremolo: { rate: 3 / 12, depth: 0.45 },
        gain: 1,
      },
      {
        source: { type: 'crackle', density: 3, seed: 312, clickDecay: 0.05 },
        env: HOLD,
        filter: { type: 'lowpass', freq: 260 },
        gain: 2.5,
        pan: -0.3,
      },
      {
        source: { type: 'noise', color: 'pink', seed: 313 },
        env: HOLD,
        filter: { type: 'bandpass', freq: 520, q: 0.8 },
        tremolo: { rate: 2 / 12, depth: 0.7 },
        gain: 0.14,
        pan: 0.4,
      },
    ],
  },
  bus: 'music',
  level: 0.45,
  reverb: { ...ROOMS.hall, wet: 0.25 },
  maxVoices: 1,
  group: 1,
};

const ambHum: SoundDef = {
  // The factory's electrical hum, on D, with a slow breath.
  spec: {
    duration: 6,
    loop: { crossfade: 0.5 },
    sampleRate: LOOP_SR,
    layers: [
      {
        source: { type: 'osc', wave: 'sine', freq: 73.5 },
        env: HOLD,
        tremolo: { rate: 3 / 6, depth: 0.15 },
        gain: 0.6,
      },
      {
        source: { type: 'osc', wave: 'sine', freq: 147 },
        env: HOLD,
        tremolo: { rate: 2 / 6, depth: 0.3 },
        gain: 0.25,
      },
      { source: { type: 'osc', wave: 'sine', freq: 220.5 }, env: HOLD, gain: 0.08 },
      {
        source: { type: 'osc', wave: 'sawtooth', freq: loopSafeFreq(36.75, 6) },
        env: HOLD,
        filter: { type: 'lowpass', freq: 190 },
        gain: 0.15,
      },
    ],
  },
  bus: 'music',
  level: 0.3,
  maxVoices: 1,
  group: 1,
};

const ambCandle: SoundDef = {
  // The journal desk: a candle's small crackle and breath in a quiet room.
  spec: {
    duration: 6,
    loop: { crossfade: 0.5 },
    sampleRate: LOOP_SR,
    channels: 2,
    layers: [
      {
        source: { type: 'crackle', density: 4, seed: 321, clickDecay: 0.002 },
        env: HOLD,
        filter: { type: 'bandpass', freq: 2400, q: 0.8 },
        gain: 0.9,
        pan: 0.25,
      },
      {
        source: { type: 'noise', color: 'pink', seed: 322 },
        env: HOLD,
        filter: { type: 'lowpass', freq: 420 },
        tremolo: { rate: 3 / 6, depth: 0.5 },
        gain: 0.18,
      },
      {
        source: { type: 'noise', color: 'brown', seed: 323 },
        env: HOLD,
        filter: { type: 'lowpass', freq: 220 },
        gain: 0.12,
      },
    ],
  },
  bus: 'music',
  level: 0.3,
  reverb: ROOMS.small,
  maxVoices: 1,
  group: 2,
};

const ambCrowd: SoundDef = (() => {
  // The ending, beyond the door: a lively room somewhere in the light. Muffled voices
  // (buzzy reeds through a vowel band, chopped into syllables, pitch rising and falling)
  // over a soft din, and now and then a burst of laughter. Far away, warm, never words.
  const D = 8;
  // Syllable rates alternate sign: a negative rate starts that talker's chop falling instead
  // of rising, so the voices don't all swell together across the loop's wrap.
  const talkers: Layer[] = [
    [118, 0.625, 120, 3.625, 620, -0.6],
    [152, 0.875, 150, -4.375, 780, -0.2],
    [196, 0.5, 180, 5.125, 900, 0.25],
    [231, 1.125, 140, -3.875, 1050, 0.6],
    [136, 0.75, 100, 4.75, 700, 0.05],
    [174, 0.625, 130, -4.125, 820, -0.4],
  ].map(([f, vib, depth, syl, band, pan]) => ({
    source: { type: 'osc', wave: 'sawtooth', freq: f!, vibrato: { rate: vib!, depth: depth! } },
    env: HOLD,
    filter: [
      { type: 'bandpass', freq: band!, q: 1.2 },
      { type: 'lowpass', freq: 1600 },
    ],
    tremolo: { rate: syl!, depth: 0.8 },
    gain: 0.22,
    pan: pan!,
  }));
  const laughs: Layer[] = (
    [
      [1.3, 262, -0.4],
      [3.9, 300, 0.5],
      [6.2, 220, 0.1],
    ] as const
  ).flatMap(([start, f, pan]): Layer[] => {
    const env = {
      attack: 0.04,
      hold: 0.3,
      decay: 0.6,
      sustain: 0,
      release: 0.05,
      curve: 'exp' as const,
    };
    const ha = { rate: 6.5, depth: 1 };
    return [
      {
        source: { type: 'osc', wave: 'sawtooth', freq: f, vibrato: { rate: 2, depth: 90 } },
        env,
        start,
        filter: { type: 'bandpass', freq: 1100, q: 1.5 },
        tremolo: ha,
        gain: 0.35,
        pan,
      },
      {
        source: { type: 'noise', color: 'pink', seed: 331 + Math.round(start * 10) },
        env,
        start,
        filter: { type: 'bandpass', freq: 1800, q: 1 },
        tremolo: ha,
        gain: 0.15,
        pan,
      },
    ];
  });
  return {
    spec: {
      duration: D,
      loop: { crossfade: 1 },
      sampleRate: LOOP_SR,
      channels: 2,
      layers: [
        ...talkers,
        {
          source: { type: 'noise', color: 'pink', seed: 330 },
          env: HOLD,
          filter: { type: 'bandpass', freq: 650, q: 0.7 },
          tremolo: { rate: 2 / D, depth: 0.3 },
          gain: 0.25,
        },
        ...laughs,
      ],
    },
    bus: 'sfx',
    level: 0.35,
    reverb: { ...ROOMS.hall, wet: 0.45 },
    maxVoices: 1,
    group: 3,
  };
})();

// ---------------------------------------------------------------- the bank

export const FUSE_VOWEL_KEYS = Object.keys(FUSE_VOWELS) as FuseVowel[];
export const FUSE_QUIET_VOWELS: readonly FuseVowel[] = ['a', 'o', 'u'];

function buildBank(): Record<string, SoundDef> {
  const bank: Record<string, SoundDef> = {
    gemPick,
    gemRotate,
    socketBlocked,
    machineUnder,
    machineExact,
    breakerTrip,
    'bolt.low': boltLow(),
    'bolt.high': boltHigh(),
    'storm.1': stormCell(1),
    'storm.2': stormCell(2),
    'storm.4': stormCell(4),
    gemGranted,
    doorUnlock,
    pageFound,
    codexOpen,
    codexClose,
    uiHover,
    uiClick,
    fuseBzzt,
    knock,
    clipboardDrop,
    tarp,
    'thunder.a': thunder(331),
    'thunder.b': thunder(341),
    drip,
    endingSwell,
    'note.glass': noteGlass,
    'note.low': noteLow,
    'note.box': noteBox,
    'note.warm': noteWarm,
    'pad.title': pad([38, 45, 50, 54, 57], { cutoff: 700, soft: true, level: 0.45, air: 0.04 }),
    'pad.t1': pad([50, 57, 64, 66], { cutoff: 1500, shimmerHz: [hz(81), hz(88)], level: 0.45 }),
    'pad.t2': pad([50, 57, 60, 64], { cutoff: 1100, spread: 1.005, movement: 2, level: 0.45 }),
    'pad.t3': pad([38, 45, 53, 55], {
      cutoff: 650,
      spread: 1.007,
      movement: 1,
      shimmerHz: [hz(71)],
      air: 0.05,
      level: 0.5,
    }),
    'pad.journal': pad([50, 54, 57, 62], { cutoff: 800, soft: true, level: 0.4 }),
    'pad.ending': pad([50, 57, 62, 66, 69, 76], {
      cutoff: 2400,
      shimmerHz: [hz(86), hz(90), hz(93)],
      air: 0.03,
      level: 0.55,
    }),
    'amb.storm': ambStorm,
    'amb.hum': ambHum,
    'amb.candle': ambCandle,
    'amb.crowd': ambCrowd,
  };
  for (const g of GEM_KINDS) {
    bank[`gemPlace.${g}`] = gemPlace(g);
    bank[`boltStep.${g}`] = boltStep(g);
  }
  for (const v of FUSE_VOWEL_KEYS) bank[`fuse.${v}`] = fuseBlip(v, false);
  for (const v of FUSE_QUIET_VOWELS) bank[`fuse.quiet.${v}`] = fuseBlip(v, true);
  return bank;
}

/** Every game sound by name. */
export const BANK: Readonly<Record<string, SoundDef>> = buildBank();

/** Names in pre-render order (group, then name). */
export function renderOrder(bank: Readonly<Record<string, SoundDef>> = BANK): string[] {
  return Object.keys(bank).sort((a, b) => bank[a]!.group - bank[b]!.group || a.localeCompare(b));
}

export const isLoop = (def: SoundDef): boolean => def.spec.loop !== undefined;
