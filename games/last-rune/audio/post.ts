/**
 * Pure post-processing applied to rendered sound buffers: a small Freeverb-style stereo
 * reverb (the engine synth has no reverb), loop-aware so ambience tails wrap seamlessly,
 * and edge fades so one-shots never click. Plain Float32Array maths: runs and is tested in
 * Node. The browser glue lives in `render.ts`.
 */

export interface ReverbOptions {
  /** 0..1 → comb feedback 0.7..0.98 (longer tail). Default 0.6. */
  room?: number;
  /** 0..1 high-frequency damping inside the tail. Default 0.4. */
  damp?: number;
  /** Wet level. Default 0.25. */
  wet?: number;
  /** Dry level. Default 1. */
  dry?: number;
  /** 0..1 stereo width of the tail. Default 1. */
  width?: number;
  /** Seconds before the tail starts. Default 0.012. */
  preDelay?: number;
  /** One-pole high-pass on the reverb send, Hz (keeps the tail from going muddy). Default 180. */
  lowCut?: number;
}

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
const SPREAD = 23;
const FIXED_GAIN = 0.015;

/** Comb feedback for a `room` setting (Freeverb's scaling). */
export function roomFeedback(room: number): number {
  return 0.7 + 0.28 * Math.min(1, Math.max(0, room));
}

/**
 * Seconds for the tail to fall 60 dB, from the longest comb's feedback. Used to size the tail
 * appended to one-shots and to check that a loop is longer than its own reverb.
 */
export function reverbRt60(o: ReverbOptions = {}, sampleRate = 44100): number {
  const g = roomFeedback(o.room ?? 0.6);
  const d = (COMBS[COMBS.length - 1]! + SPREAD) * (sampleRate / 44100);
  // Damping shortens the high end only; the low end rings for the full RT60.
  return (-3 * d) / (sampleRate * Math.log10(g)) + (o.preDelay ?? 0.012);
}

class Comb {
  private readonly buf: Float32Array;
  private i = 0;
  private store = 0;
  constructor(
    len: number,
    private readonly feedback: number,
    private readonly damp: number,
  ) {
    this.buf = new Float32Array(Math.max(1, len));
  }
  tick(x: number): number {
    const y = this.buf[this.i]!;
    this.store = y * (1 - this.damp) + this.store * this.damp;
    this.buf[this.i] = x + this.store * this.feedback;
    if (++this.i >= this.buf.length) this.i = 0;
    return y;
  }
}

class Allpass {
  private readonly buf: Float32Array;
  private i = 0;
  constructor(len: number) {
    this.buf = new Float32Array(Math.max(1, len));
  }
  tick(x: number): number {
    const b = this.buf[this.i]!;
    this.buf[this.i] = x + b * 0.5;
    if (++this.i >= this.buf.length) this.i = 0;
    return b - x;
  }
}

/** Tail of one reverb channel (wet only) for a mono send. */
function tailChannel(
  send: Float32Array,
  sr: number,
  o: Required<ReverbOptions>,
  spread: number,
): Float32Array {
  const scale = sr / 44100;
  const fb = roomFeedback(o.room);
  const damp = Math.min(1, Math.max(0, o.damp)) * 0.4;
  const combs = COMBS.map((n) => new Comb(Math.round((n + spread) * scale), fb, damp));
  const aps = ALLPASSES.map((n) => new Allpass(Math.round((n + spread) * scale)));
  const out = new Float32Array(send.length);
  for (let i = 0; i < send.length; i++) {
    const x = send[i]! * FIXED_GAIN;
    let acc = 0;
    for (const c of combs) acc += c.tick(x);
    for (const a of aps) acc = a.tick(acc);
    out[i] = acc;
  }
  return out;
}

/**
 * Stereo reverb. `input` is 1 or 2 channels; the result is always 2 channels of the same
 * length (append a tail with `padSeconds` first for one-shots). With `loop: true` the input is
 * treated as periodic: the reverb is run over two periods and the second is kept, so the tail
 * of the end rings into the start and the loop stays seamless.
 */
export function applyReverb(
  input: readonly Float32Array[],
  sampleRate: number,
  opts: ReverbOptions = {},
  loop = false,
): [Float32Array, Float32Array] {
  const o: Required<ReverbOptions> = {
    room: opts.room ?? 0.6,
    damp: opts.damp ?? 0.4,
    wet: opts.wet ?? 0.25,
    dry: opts.dry ?? 1,
    width: opts.width ?? 1,
    preDelay: opts.preDelay ?? 0.012,
    lowCut: opts.lowCut ?? 180,
  };
  const n = input[0]!.length;
  const L = input[0]!;
  const R = input[1] ?? input[0]!;
  const reps = loop ? 2 : 1;
  const pre = Math.round(o.preDelay * sampleRate);

  // Mono send: high-passed, pre-delayed. For loops, sample i of the periodic signal is x[i % n].
  const send = new Float32Array(n * reps);
  const a = Math.exp((-2 * Math.PI * o.lowCut) / sampleRate);
  let lpState = 0;
  for (let rep = 0; rep < reps; rep++) {
    for (let i = 0; i < n; i++) {
      const j = rep * n + i;
      const src = j - pre;
      let x = 0;
      if (src >= 0) x = (L[src % n]! + R[src % n]!) * 0.5;
      else if (loop) x = (L[(src % n) + n]! + R[(src % n) + n]!) * 0.5;
      lpState = (1 - a) * x + a * lpState;
      send[j] = x - lpState;
    }
  }
  const tl = tailChannel(send, sampleRate, o, 0);
  const tr = tailChannel(send, sampleRate, o, SPREAD);
  const w1 = o.wet * (o.width / 2 + 0.5);
  const w2 = o.wet * ((1 - o.width) / 2);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const off = (reps - 1) * n;
  for (let i = 0; i < n; i++) {
    const l = tl[off + i]!;
    const r = tr[off + i]!;
    outL[i] = L[i]! * o.dry + l * w1 + r * w2;
    outR[i] = R[i]! * o.dry + r * w1 + l * w2;
  }
  return [outL, outR];
}

/** Copy `ch` with `seconds` of silence appended (room for a reverb tail). */
export function padSeconds(ch: Float32Array, sampleRate: number, seconds: number): Float32Array {
  const out = new Float32Array(ch.length + Math.max(0, Math.round(seconds * sampleRate)));
  out.set(ch);
  return out;
}

/**
 * Raised-cosine fade over the first `inS` and last `outS` seconds, in place. Guarantees a
 * one-shot starts and ends at exactly 0, so it never clicks however it was synthesised.
 */
export function edgeFade(
  channels: readonly Float32Array[],
  sampleRate: number,
  inS: number,
  outS: number,
): void {
  for (const ch of channels) {
    const n = ch.length;
    const fi = Math.min(n, Math.max(1, Math.round(inS * sampleRate)));
    const fo = Math.min(n, Math.max(1, Math.round(outS * sampleRate)));
    for (let i = 0; i < fi; i++) ch[i]! *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fi);
    for (let i = 0; i < fo; i++) ch[n - 1 - i]! *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fo);
  }
}

/**
 * Trim trailing near-silence (below `floor` on every channel), keeping `keep` seconds after
 * the last audible sample. Returns the new length (callers slice). Keeps reverb tails from
 * wasting memory once they are inaudible.
 */
export function audibleLength(
  channels: readonly Float32Array[],
  sampleRate: number,
  floor = 1e-4,
  keep = 0.02,
): number {
  let last = 0;
  for (const ch of channels) {
    for (let i = ch.length - 1; i > last; i--) {
      if (Math.abs(ch[i]!) > floor) {
        last = i;
        break;
      }
    }
  }
  const n = channels[0]?.length ?? 0;
  return Math.min(n, last + 1 + Math.round(keep * sampleRate));
}

/** Gentle tanh saturation that maps ±1 to ±1 (warmth for brass and pads), in place. */
export function saturate(channels: readonly Float32Array[], drive: number): void {
  if (drive <= 0) return;
  const k = 1 + drive * 4;
  const norm = 1 / Math.tanh(k);
  for (const ch of channels)
    for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i]! * k) * norm;
}
