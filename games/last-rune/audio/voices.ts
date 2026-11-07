/**
 * Game-side instrument builders on top of the engine's `SoundSpec`: glass gem bells, stone
 * contacts, electric snaps, held tones and loop beds. Each returns plain layers, so the bank
 * stays declarative and every spec can be validated in Node.
 */
import {
  type Envelope,
  type Layer,
  loopSafeFreq,
  pluck,
  rng,
  type SoundSpec,
} from '@thunderclap-engine/engine/audio';
import { type GemVoice, rateForSemis } from './theory';

/** Hold envelope for loop layers (the loop fold hides the 5 ms attack). */
export const HOLD: Envelope = {
  attack: 0.005,
  decay: 0,
  sustain: 1,
  release: 0.01,
  curve: 'linear',
};

/** Seconds a layer sounds for, from the start of the sound. */
export function layerEnd(l: Layer): number {
  const body = l.gate ?? l.env.attack + (l.env.hold ?? 0) + l.env.decay;
  return (l.start ?? 0) + body + l.env.release;
}

/** A one-shot spec whose duration fits every layer (plus a small pad). */
export function oneShot(layers: Layer[], extra: Partial<SoundSpec> = {}): SoundSpec {
  const end = Math.max(...layers.map(layerEnd));
  return { duration: Math.ceil((end + 0.02) * 1000) / 1000, layers, ...extra };
}

/** Shift every layer's start (and keep the rest). */
export function at(start: number, layers: Layer[]): Layer[] {
  return layers.map((l) => ({ ...l, start: (l.start ?? 0) + start }));
}

export function scaleGain(g: number, layers: Layer[]): Layer[] {
  return layers.map((l) => ({ ...l, gain: (l.gain ?? 1) * g }));
}

export function panAll(pan: number, layers: Layer[]): Layer[] {
  return layers.map((l) => ({ ...l, pan: Math.max(-1, Math.min(1, (l.pan ?? 0) + pan)) }));
}

/** Partial tables: [ratio, gain, decay fraction of ring]. */
const GLASS: readonly [number, number, number][] = [
  [1, 1, 1],
  [2.32, 0.42, 0.55],
  [4.25, 0.22, 0.32],
  [6.63, 0.11, 0.2],
  [9.38, 0.05, 0.12],
];
const CLEAR: readonly [number, number, number][] = [
  [1, 1, 1],
  [2.0, 0.3, 0.6],
  [3.01, 0.1, 0.35],
  [4.02, 0.05, 0.2],
];

export interface BellOptions {
  freq: number;
  /** Seconds for the fundamental to ring out (to -80 dB). */
  ring: number;
  /** 0..1 high-partial content. */
  bright?: number;
  partials?: 'glass' | 'clear';
  /** Semitones the note bends down from (e.g. 1.5 = starts 1.5 st sharp). */
  bendFrom?: number;
  /** Seconds of the bend. */
  bendTime?: number;
  /** Attack seconds (a swell for the capacitor). Default 0.002. */
  attack?: number;
  gain?: number;
  pan?: number;
  /** Strike transient level 0..1. Default 0.5. */
  strike?: number;
  /** Seed for the strike noise. */
  seed?: number;
}

/**
 * A struck glass bell: inharmonic (or near-harmonic) partials that die faster the higher
 * they are, a slow beating pair on the fundamental for shimmer, a short FM bloom and a soft
 * noise "tick" where the striker meets the glass.
 */
export function glassBell(o: BellOptions): Layer[] {
  const b = Math.min(1, Math.max(0, o.bright ?? 0.5));
  const g = o.gain ?? 1;
  const attack = o.attack ?? 0.002;
  const bend = o.bendFrom ? rateForSemis(o.bendFrom) : 1;
  const glide = o.bendTime ?? 0.08;
  const table = o.partials === 'clear' ? CLEAR : GLASS;
  const layers: Layer[] = [];
  for (const [ratio, pg, frac] of table) {
    const f = o.freq * ratio;
    if (f * bend > 16000) continue;
    const brightScale = ratio === 1 ? 1 : 0.35 + 1.3 * b;
    layers.push({
      source: {
        type: 'osc',
        wave: 'sine',
        freq: f * bend,
        ...(bend !== 1 ? { freqEnd: f, glide } : {}),
      },
      env: pluck(o.ring * frac, attack),
      gain: g * pg * brightScale * 0.6,
      pan: o.pan,
    });
  }
  // Beating twin of the fundamental: a slow shimmer.
  layers.push({
    source: {
      type: 'osc',
      wave: 'sine',
      freq: o.freq * 1.0021 * bend,
      ...(bend !== 1 ? { freqEnd: o.freq * 1.0021, glide } : {}),
    },
    env: pluck(o.ring * 0.8, attack * 2),
    gain: g * 0.32,
    pan: o.pan !== undefined ? -o.pan : undefined,
  });
  // FM bloom: a brief metallic-glassy edge that fades into the pure tone.
  if (o.freq * 3.5 < 16000)
    layers.push({
      source: {
        type: 'osc',
        wave: 'sine',
        freq: o.freq,
        fm: { ratio: 3.5, index: 0.4 + 1.4 * b, indexEnd: 0 },
      },
      env: pluck(o.ring * 0.22, attack),
      gain: g * 0.18,
      pan: o.pan,
    });
  const strike = o.strike ?? 0.5;
  if (strike > 0)
    layers.push({
      source: { type: 'noise', color: 'white', seed: o.seed ?? 31 },
      env: pluck(0.008, 0.0008),
      filter: { type: 'highpass', freq: Math.min(12000, Math.max(3000, o.freq * 4)), q: 0.7 },
      gain: g * 0.22 * strike,
      pan: o.pan,
    });
  return layers;
}

/** The gem itself, by family (see `GemVoice`). `ringScale` shortens it for bolt steps. */
export function gemBell(v: GemVoice, hz: (i: number) => number, ringScale = 1, seed = 31): Layer[] {
  const ring = v.ring * ringScale;
  const base = { ring, bright: v.brightness, seed };
  switch (v.family) {
    case 'clear':
      return glassBell({ ...base, freq: hz(0), partials: 'clear', pan: v.pan });
    case 'bent':
      return glassBell({ ...base, freq: hz(0), bendFrom: 1.6, bendTime: 0.09, pan: v.pan });
    case 'split':
      return [
        ...glassBell({ ...base, freq: hz(0), pan: -0.45, gain: 0.75 }),
        ...at(0.012, glassBell({ ...base, freq: hz(1), pan: 0.45, gain: 0.75, strike: 0.3 })),
      ];
    case 'doubled':
      return [
        ...glassBell({ ...base, freq: hz(0), partials: 'clear', gain: 0.85 }),
        ...glassBell({
          ...base,
          freq: hz(1),
          ring: ring * 1.2,
          bright: 0.15,
          gain: 0.7,
          strike: 0.2,
        }),
      ];
    case 'twin':
      return [
        ...glassBell({ ...base, freq: hz(0), gain: 0.8, pan: -0.15 }),
        ...at(0.075, glassBell({ ...base, freq: hz(1), gain: 0.75, pan: 0.15 })),
      ];
    case 'stored':
      return [
        // Charging whine into the note, then a swelling, very long crystal ring.
        {
          source: { type: 'osc', wave: 'sine', freq: hz(0) * 0.5, freqEnd: hz(0), glide: 0.05 },
          env: { attack: 0.03, decay: 0.05, sustain: 0, release: 0.01, curve: 'exp' },
          gain: 0.12,
        },
        ...glassBell({ ...base, freq: hz(0), attack: 0.03, partials: 'clear', strike: 0 }),
        ...at(0.05, glassBell({ ...base, freq: hz(1), ring: ring * 0.6, gain: 0.35, strike: 0.2 })),
      ];
  }
}

/** Gem settling into a carved stone socket: a low knock with a gritty contact. */
export function stoneSeat(gain = 1, seed = 41): Layer[] {
  return [
    {
      source: { type: 'osc', wave: 'sine', freq: 170, freqEnd: 95, glide: 0.05 },
      env: pluck(0.09, 0.001),
      gain: 0.7 * gain,
    },
    {
      source: { type: 'noise', color: 'brown', seed },
      env: pluck(0.05, 0.0008),
      filter: { type: 'lowpass', freq: 900, q: 0.7 },
      gain: 0.9 * gain,
    },
    {
      source: { type: 'noise', color: 'white', seed: seed + 1 },
      env: pluck(0.012, 0.0005),
      filter: { type: 'bandpass', freq: 2600, q: 1.2 },
      gain: 0.25 * gain,
    },
  ];
}

/** Electric snap: the bolt arcing into something. */
export function snap(freq: number, gain = 1, seed = 51): Layer[] {
  return [
    {
      source: { type: 'noise', color: 'white', seed },
      env: pluck(0.018, 0.0005),
      filter: { type: 'highpass', freq: 2500, q: 0.7 },
      gain: 0.6 * gain,
    },
    {
      source: { type: 'osc', wave: 'sawtooth', freq: freq * 2, freqEnd: freq * 0.4, glide: 0.035 },
      env: pluck(0.045, 0.0008),
      filter: { type: 'lowpass', freq: 5000, freqEnd: 900, q: 2 },
      gain: 0.28 * gain,
    },
  ];
}

/** A soft impact (wood, stone, book): falling sine body and filtered noise. */
export function knockLayers(
  freq: number,
  o: { gain?: number; dark?: number; seed?: number; decay?: number } = {},
): Layer[] {
  const g = o.gain ?? 1;
  const decay = o.decay ?? 0.14;
  return [
    {
      source: { type: 'osc', wave: 'sine', freq, freqEnd: freq * 0.7, glide: decay * 0.6 },
      env: pluck(decay, 0.001),
      gain: 0.9 * g,
    },
    {
      source: { type: 'osc', wave: 'triangle', freq: freq * 2.3 },
      env: pluck(decay * 0.35, 0.001),
      gain: 0.25 * g,
    },
    {
      source: { type: 'noise', color: 'brown', seed: o.seed ?? 61 },
      env: pluck(decay * 0.3, 0.0008),
      filter: { type: 'lowpass', freq: 600 + 1400 * (1 - (o.dark ?? 0.5)), q: 0.7 },
      gain: 0.8 * g,
    },
  ];
}

/** Short filtered-noise bursts in a row: page riffles, paper. */
export function riffle(
  count: number,
  start: number,
  spacing: number,
  o: { freq?: number; gain?: number; seed?: number } = {},
): Layer[] {
  const rand = rng(o.seed ?? 71);
  const out: Layer[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      source: { type: 'noise', color: 'pink', seed: (o.seed ?? 71) + i },
      env: pluck(0.02 + 0.02 * rand(), 0.002),
      start: start + i * spacing * (0.8 + 0.4 * rand()),
      filter: { type: 'bandpass', freq: (o.freq ?? 3000) * (0.8 + 0.4 * rand()), q: 0.9 },
      gain: (o.gain ?? 1) * (1 - (0.5 * i) / count) * (0.7 + 0.3 * rand()),
      pan: (rand() - 0.5) * 0.4,
    });
  }
  return out;
}

/** Scattered high glass plinks on a pentatonic set (gold sparkle). */
export function plinks(
  count: number,
  start: number,
  span: number,
  notesHz: readonly number[],
  o: { gain?: number; seed?: number; ring?: number } = {},
): Layer[] {
  const rand = rng(o.seed ?? 81);
  const out: Layer[] = [];
  for (let i = 0; i < count; i++) {
    const f = notesHz[Math.floor(rand() * notesHz.length)]!;
    out.push({
      source: { type: 'osc', wave: 'sine', freq: f },
      env: pluck((o.ring ?? 0.35) * (0.6 + 0.6 * rand()), 0.002),
      start: start + (i / count) * span + rand() * (span / count) * 0.5,
      gain: (o.gain ?? 1) * (0.35 + 0.4 * rand()),
      pan: rand() * 1.4 - 0.7,
    });
  }
  return out;
}

export interface PadOptions {
  /** Loop length, seconds. */
  duration: number;
  /** Frequencies of the chord tones. */
  chordHz: readonly number[];
  /** Low-pass cutoff, Hz. */
  cutoff: number;
  /** Detune between the two oscillators of each tone (ratio, e.g. 1.003). */
  spread?: number;
  /** Base tremolo cycles per loop for the lowest tone (higher tones move faster). */
  movement?: number;
  /** Softer, rounder pad (triangles only). */
  soft?: boolean;
  gain?: number;
  /** Extra high sine shimmer tones (Hz). */
  shimmerHz?: readonly number[];
  /** Low-passed noise "air" level. */
  air?: number;
  seed?: number;
}

/**
 * A seamless pad loop: each chord tone is a detuned saw/triangle pair through a low-pass,
 * with a slow tremolo (whole cycles per loop), spread across the stereo field. Every
 * frequency is snapped with `loopSafeFreq` so the loop wraps with no phase jump.
 */
export function padLayers(o: PadOptions): Layer[] {
  const d = o.duration;
  const spread = o.spread ?? 1.003;
  const mv = o.movement ?? 1;
  const g = o.gain ?? 1;
  const n = o.chordHz.length;
  const layers: Layer[] = [];
  o.chordHz.forEach((hz, i) => {
    const pan = n > 1 ? ((i / (n - 1)) * 2 - 1) * 0.6 : 0;
    const level = g / (1 + i * 0.25);
    const trem = { rate: (mv * (1 + (i % 3))) / d, depth: 0.35 };
    layers.push({
      source: { type: 'osc', wave: o.soft ? 'triangle' : 'sawtooth', freq: loopSafeFreq(hz, d) },
      env: HOLD,
      filter: { type: 'lowpass', freq: Math.min(o.cutoff, 9000), q: 0.6 },
      gain: (o.soft ? 0.5 : 0.22) * level,
      tremolo: trem,
      pan,
    });
    layers.push({
      source: { type: 'osc', wave: 'triangle', freq: loopSafeFreq(hz * spread, d) },
      env: HOLD,
      filter: { type: 'lowpass', freq: Math.min(o.cutoff * 1.5, 9000), q: 0.5 },
      gain: 0.4 * level,
      tremolo: { rate: (mv * (2 + (i % 2))) / d, depth: 0.3 },
      pan: -pan,
    });
  });
  (o.shimmerHz ?? []).forEach((hz, i) => {
    layers.push({
      source: { type: 'osc', wave: 'sine', freq: loopSafeFreq(hz, d) },
      env: HOLD,
      gain: 0.05 * g,
      tremolo: { rate: (mv * (3 + i)) / d, depth: 0.9 },
      pan: i % 2 ? 0.5 : -0.5,
    });
  });
  if (o.air)
    layers.push({
      source: { type: 'noise', color: 'pink', seed: o.seed ?? 91 },
      env: HOLD,
      filter: { type: 'bandpass', freq: 1800, q: 0.5 },
      gain: o.air * g,
      tremolo: { rate: (mv * 2) / d, depth: 0.5 },
    });
  return layers;
}
