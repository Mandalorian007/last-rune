/**
 * Objective checks for rendered sounds (we can't listen in CI): level, NaN, clicks at the
 * edges of one-shots, loop seams, tails cut short. Pure maths on Float32Arrays, used by the
 * Node unit tests, the in-browser render check (`render-check.ts`) and the audio demo.
 */
import { dbToGain, gainToDb } from '@engine/audio';

export interface SoundMetrics {
  /** Seconds. */
  duration: number;
  channels: number;
  sampleRate: number;
  /** Non-finite samples (NaN/±Infinity). Must be 0. */
  nonFinite: number;
  peak: number;
  peakDb: number;
  /** RMS over the whole buffer, dBFS. */
  rmsDb: number;
  /** RMS of the loudest 100 ms window, dBFS: a short-term loudness proxy for mix balance. */
  loudDb: number;
  /** Mean sample value (DC offset). */
  dc: number;
  /** Largest |sample| at the first and last frame. One-shots: ~0. */
  startAbs: number;
  endAbs: number;
  /** RMS of the last 30 ms before the final edge fade, dBFS. One-shots: a tail that rang out. */
  tailDb: number;
  /**
   * Loops only: the jump across the wrap (last → first sample) divided by the largest
   * sample-to-sample jump nearby. ≤ ~1.5 means the seam is no worse than the material.
   */
  seamRatio: number;
  /** Loops only: RMS(first 50 ms) / RMS(last 50 ms) in dB. Near 0 for an even loop. */
  seamLevelDb: number;
  /**
   * Loops only: 95th percentile of the level change between adjacent 50 ms windows inside
   * the loop, dB. Stochastic material (crackle, rain) moves this much on its own, so the
   * seam level check allows a jump up to this size.
   */
  materialJumpDb: number;
}

export interface Limits {
  /** Default -1 dBFS. */
  maxPeakDb: number;
  /** Not silent. Default -30 dBFS. */
  minPeakDb: number;
  /** One-shot edge sample. Default 1e-3. */
  maxEdge: number;
  /** One-shot tail level before the fade. Default -40 dBFS. */
  maxTailDb: number;
  maxSeamRatio: number;
  maxSeamLevelDb: number;
  maxDc: number;
}

export const DEFAULT_LIMITS: Readonly<Limits> = {
  maxPeakDb: -1,
  minPeakDb: -30,
  maxEdge: 1e-3,
  maxTailDb: -40,
  maxSeamRatio: 1.5,
  maxSeamLevelDb: 1.5,
  maxDc: 0.02,
};

const rmsOf = (ch: Float32Array, from: number, to: number): number => {
  const a = Math.max(0, from);
  const b = Math.min(ch.length, to);
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += ch[i]! * ch[i]!;
  return Math.sqrt(s / (b - a));
};

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** Measure a rendered buffer. `loop` switches the edge checks to seam checks. */
export function analyze(
  channels: readonly Float32Array[],
  sampleRate: number,
  loop = false,
): SoundMetrics {
  const n = channels[0]?.length ?? 0;
  let nonFinite = 0;
  let peak = 0;
  let sumSq = 0;
  let sum = 0;
  for (const ch of channels) {
    for (let i = 0; i < n; i++) {
      const v = ch[i]!;
      if (!Number.isFinite(v)) {
        nonFinite++;
        continue;
      }
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sumSq += v * v;
      sum += v;
    }
  }
  const total = Math.max(1, n * channels.length);

  // Loudest 100 ms window (hop 25 ms), averaged across channels.
  const win = Math.max(1, Math.round(0.1 * sampleRate));
  const hop = Math.max(1, Math.round(0.025 * sampleRate));
  let loud = 0;
  for (let s = 0; s < Math.max(1, n - win + 1); s += hop) {
    const r = avg(channels.map((ch) => rmsOf(ch, s, s + win)));
    if (r > loud) loud = r;
  }

  const startAbs = Math.max(0, ...channels.map((ch) => Math.abs(ch[0] ?? 0)));
  const endAbs = Math.max(0, ...channels.map((ch) => Math.abs(ch[n - 1] ?? 0)));
  const t30 = Math.round(0.03 * sampleRate);
  const fadeGuard = Math.round(0.03 * sampleRate);
  const tail = avg(channels.map((ch) => rmsOf(ch, n - fadeGuard - t30, n - fadeGuard)));

  let seamRatio = 0;
  let seamLevelDb = 0;
  let materialJumpDb = 0;
  if (loop && n > 4) {
    const near = Math.min(256, Math.floor(n / 4));
    let worst = 0;
    let local = 1e-6;
    for (const ch of channels) {
      worst = Math.max(worst, Math.abs(ch[0]! - ch[n - 1]!));
      for (let i = 1; i < near; i++) {
        local = Math.max(local, Math.abs(ch[i]! - ch[i - 1]!));
        local = Math.max(local, Math.abs(ch[n - i]! - ch[n - i - 1]!));
      }
    }
    seamRatio = worst / local;
    const w50 = Math.round(0.05 * sampleRate);
    const head = avg(channels.map((ch) => rmsOf(ch, 0, w50)));
    const end = avg(channels.map((ch) => rmsOf(ch, n - w50, n)));
    seamLevelDb = head > 1e-6 && end > 1e-6 ? gainToDb(head / end) : 0;
    const levels: number[] = [];
    for (let s = 0; s + w50 <= n; s += w50)
      levels.push(avg(channels.map((ch) => rmsOf(ch, s, s + w50))));
    const jumps: number[] = [];
    for (let i = 1; i < levels.length; i++) {
      const a = levels[i - 1]!;
      const b = levels[i]!;
      if (a > 1e-6 && b > 1e-6) jumps.push(Math.abs(gainToDb(b / a)));
    }
    jumps.sort((a, b) => a - b);
    materialJumpDb = jumps.length ? jumps[Math.floor(0.95 * (jumps.length - 1))]! : 0;
  }

  return {
    duration: n / sampleRate,
    channels: channels.length,
    sampleRate,
    nonFinite,
    peak,
    peakDb: gainToDb(peak),
    rmsDb: gainToDb(Math.sqrt(sumSq / total)),
    loudDb: gainToDb(loud),
    dc: sum / total,
    startAbs,
    endAbs,
    tailDb: gainToDb(tail),
    seamRatio,
    seamLevelDb,
    materialJumpDb,
  };
}

/** Human-readable problems with a measurement, or an empty array. */
export function problems(m: SoundMetrics, loop: boolean, limits: Partial<Limits> = {}): string[] {
  const L = { ...DEFAULT_LIMITS, ...limits };
  const out: string[] = [];
  if (m.nonFinite > 0) out.push(`${m.nonFinite} non-finite samples`);
  if (m.peak > dbToGain(L.maxPeakDb) + 1e-6)
    out.push(`peak ${m.peakDb.toFixed(2)} dBFS > ${L.maxPeakDb}`);
  if (m.peakDb < L.minPeakDb) out.push(`near silent (peak ${m.peakDb.toFixed(1)} dBFS)`);
  if (Math.abs(m.dc) > L.maxDc) out.push(`DC offset ${m.dc.toFixed(4)}`);
  if (loop) {
    if (m.seamRatio > L.maxSeamRatio) out.push(`loop seam click (ratio ${m.seamRatio.toFixed(2)})`);
    if (Math.abs(m.seamLevelDb) > Math.max(L.maxSeamLevelDb, m.materialJumpDb))
      out.push(`loop seam level jump ${m.seamLevelDb.toFixed(2)} dB`);
  } else {
    if (m.startAbs > L.maxEdge) out.push(`starts at ${m.startAbs.toFixed(4)} (click)`);
    if (m.endAbs > L.maxEdge) out.push(`ends at ${m.endAbs.toFixed(4)} (click)`);
    // Very short sounds are all "tail"; the edge checks cover them.
    if (m.duration > 0.15 && m.tailDb > L.maxTailDb)
      out.push(`tail cut off (${m.tailDb.toFixed(1)} dBFS at the end)`);
  }
  return out;
}

/** 16-bit PCM WAV bytes, for dumping renders to disk to listen to. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const nc = channels.length;
  const n = channels[0]?.length ?? 0;
  const bytes = 44 + n * nc * 2;
  const buf = new ArrayBuffer(bytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, bytes - 8, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nc, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nc * 2, true);
  v.setUint16(32, nc * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * nc * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]![i] ?? 0));
      v.setInt16(o, Math.round(s * 32767), true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}
