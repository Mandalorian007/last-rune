/**
 * The game's musical frame. Everything is in D: the factory hum is a D, the gems ring on
 * the D major pentatonic (so any order of gems the bolt passes through is consonant), and
 * the music changes mode by tier rather than key. Pure data and maths.
 */
import { midiToHz } from '@thunderclap-engine/engine/audio';
import type { GemKind } from '../rules/types';

/** MIDI note of the tonic used for scale maths (D4). */
export const TONIC_MIDI = 62;

export const SCALES = {
  /** Tier 1, title: open and light. */
  majorPent: [0, 2, 4, 7, 9],
  /** Ending: warm, full. */
  major: [0, 2, 4, 5, 7, 9, 11],
  /** Tier 2: the jokes know too much. The flat seventh is the "wrong" note. */
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  /** Tier 3: quiet and tense. */
  dorian: [0, 2, 3, 5, 7, 9, 10],
  minorPent: [0, 3, 5, 7, 10],
} as const satisfies Record<string, readonly number[]>;
export type ScaleName = keyof typeof SCALES;

/** Semitones above the tonic for a scale degree. Degrees wrap into octaves (negative too). */
export function degreeToSemis(scale: readonly number[], degree: number): number {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return oct * 12 + scale[idx]!;
}

/** Playback rate that shifts a sample by `semis` semitones. */
export const rateForSemis = (semis: number): number => 2 ** (semis / 12);

/**
 * Timbre family per gem. Each gem is a glass bell, and its family says how it differs:
 * - `clear`: near-harmonic partials, the purest tone (Channel: carries straight through).
 * - `bent`: glass partials with a pitch bend into the note (Bend: turns 90°).
 * - `split`: two bells a fifth apart, panned apart (Split: two outputs).
 * - `doubled`: warm bell doubled an octave below (Amplify: doubles the charge).
 * - `twin`: two quick strikes (Gate: needs both inputs).
 * - `stored`: soft swelling attack, very high, longest ring (Capacitor: stores, then releases).
 */
export type GemFamily = 'clear' | 'bent' | 'split' | 'doubled' | 'twin' | 'stored';

export interface GemVoice {
  family: GemFamily;
  /** MIDI notes struck (first is the main note). All on D major pentatonic. */
  notes: readonly number[];
  /** 0..1 high-partial content. */
  brightness: number;
  /** Ring time of the main partial, seconds. */
  ring: number;
  /** Stereo position when placed, -1..1 (small: the altar is in front of you). */
  pan: number;
}

/** D major pentatonic: D E F# A B. */
export const GEM_VOICES: Readonly<Record<GemKind, GemVoice>> = {
  channel: { family: 'clear', notes: [81], brightness: 0.45, ring: 1.4, pan: 0 }, // A5
  bend: { family: 'bent', notes: [78], brightness: 0.55, ring: 1.3, pan: -0.1 }, // F#5
  split: { family: 'split', notes: [86, 81], brightness: 0.8, ring: 1.2, pan: 0.1 }, // D6 + A5
  amplify: { family: 'doubled', notes: [74, 62], brightness: 0.3, ring: 1.8, pan: 0 }, // D5 + D4
  gate: { family: 'twin', notes: [76, 83], brightness: 0.5, ring: 1.3, pan: 0.05 }, // E5, B5
  capacitor: { family: 'stored', notes: [93, 100], brightness: 0.7, ring: 2.2, pan: 0 }, // A6 + E7
};

export const gemHz = (gem: GemKind, i = 0): number => {
  const notes = GEM_VOICES[gem].notes;
  return midiToHz(notes[Math.min(i, notes.length - 1)]!);
};

/**
 * Charge (bolt units, 1 = a single storm-cell bolt) to gain and rate for the bolt stepping
 * through a gem: more charge is louder and a touch higher, saturating so 4× isn't deafening.
 */
export function boltStepParams(charge: number): { gain: number; rate: number } {
  const c = Number.isFinite(charge) && charge > 0 ? charge : 1;
  const l = Math.log2(Math.min(8, Math.max(0.25, c)));
  return {
    gain: Math.min(1, Math.max(0.35, 0.7 + 0.15 * l)),
    rate: rateForSemis(Math.min(2, Math.max(-2, l * 0.7))),
  };
}

/**
 * Bolt loop intensity 0..1 to the gains of its two layers (a low hum-and-crackle bed and a
 * dense high sizzle) and a slight rate lift. Equal-power, so the sum stays even.
 */
export function boltMix(intensity: number): { low: number; high: number; rate: number } {
  const i = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : 0));
  return {
    low: 0.35 + 0.65 * Math.cos((i * Math.PI) / 2),
    high: Math.sin((i * Math.PI) / 2),
    rate: 1 + 0.06 * i,
  };
}
