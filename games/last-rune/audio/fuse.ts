/**
 * FUSE's voice: one short brass-reed blip per typed character of a caption, Animal Crossing
 * style. The vowel formant follows the letter, the pitch follows a hash of the letter onto
 * the pentatonic (so the same word always "sounds" the same), the line falls a little
 * towards its end, and a question rises. Pure: it decides what to play; `index.ts` plays it.
 *
 * Tier arc (pitch): tier 1-2 chatty (`normal`); tier 3 he "gets quiet and fast" (`quiet`:
 * lower, softer, a muted variant, tighter spacing); the Last Rune he says nothing (`silent`).
 */
import { FUSE_QUIET_VOWELS, FUSE_VOWEL_KEYS, type FuseVowel } from './bank';
import { degreeToSemis, rateForSemis, SCALES } from './theory';

export type FuseMode = 'normal' | 'quiet' | 'silent';

export interface FuseBlip {
  sound: string;
  rate: number;
  gain: number;
  pan: number;
}

export interface FuseState {
  /** Time of the last blip, ms. */
  lastMs: number;
}

export const newFuseState = (): FuseState => ({ lastMs: -Infinity });

/** Minimum gap between blips, ms. Caption typing is ~30 chars/s; this thins it to a patter. */
export const FUSE_MIN_GAP_MS: Record<Exclude<FuseMode, 'silent'>, number> = {
  normal: 70,
  quiet: 55,
};

export function fuseModeForTier(tier: number | 'last-rune' | 'ending'): FuseMode {
  if (tier === 'last-rune') return 'silent';
  if (tier === 'ending') return 'quiet';
  return tier >= 3 ? 'quiet' : 'normal';
}

const VOWEL_OF: Record<string, FuseVowel> = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', y: 'i' };

function hashChar(ch: string): number {
  let h = ch.toLowerCase().charCodeAt(0) * 2654435761;
  h ^= h >>> 13;
  return Math.abs(h) >>> 0;
}

/** The vowel variant for a character: its own vowel, else a stable pick by hash. */
export function vowelFor(ch: string, mode: Exclude<FuseMode, 'silent'>): FuseVowel {
  const pool = mode === 'quiet' ? FUSE_QUIET_VOWELS : FUSE_VOWEL_KEYS;
  const own = VOWEL_OF[ch.toLowerCase()];
  if (own && pool.includes(own)) return own;
  return pool[hashChar(ch) % pool.length]!;
}

const speakable = (ch: string): boolean => /[\p{L}\p{N}]/u.test(ch);

/**
 * The blip for character `ch` at `index` of `text`, or null to stay silent (punctuation,
 * spaces, too soon after the last blip, or `silent` mode). Updates `state` when it blips.
 */
export function fuseBlip(
  ch: string,
  index: number,
  nowMs: number,
  mode: FuseMode,
  state: FuseState,
  text = '',
): FuseBlip | null {
  if (mode === 'silent' || !speakable(ch)) return null;
  if (nowMs - state.lastMs < FUSE_MIN_GAP_MS[mode]) return null;
  state.lastMs = nowMs;

  const vowel = vowelFor(ch, mode);
  const sound = mode === 'quiet' ? `fuse.quiet.${vowel}` : `fuse.${vowel}`;
  const isDigit = /\p{N}/u.test(ch);
  // Pentatonic degree 0..4 from the letter; digits sit a degree higher (he likes numbers).
  const degree = (hashChar(ch) % 5) + (isDigit ? 2 : 0);
  let semis = degreeToSemis(SCALES.majorPent, degree) * (mode === 'quiet' ? 0.5 : 1);
  // Declination: a sentence drifts down ~2 semitones; a question lifts its last words.
  const len = text.length;
  if (len > 1) {
    const pos = Math.min(1, index / (len - 1));
    semis -= 2 * pos;
    const trimmed = text.trimEnd();
    if (trimmed.endsWith('?') && index >= trimmed.length - 6) semis += 3;
  }
  // Capital letters (names, REGULATION) get a little extra push.
  const upper = ch !== ch.toLowerCase();
  return {
    sound,
    rate: rateForSemis(semis),
    gain: (mode === 'quiet' ? 0.55 : 0.8) * (upper ? 1.15 : 1) * (0.9 + 0.1 * ((index * 7) % 3)),
    pan: 0,
  };
}
