import { describe, expect, it } from 'vitest';
import { analyze, encodeWav, problems } from './analyze';
import {
  applyReverb,
  applyReverbSteps,
  audibleLength,
  edgeFade,
  padSeconds,
  REVERB_CHUNK,
  reverbRt60,
  saturate,
} from './post';

const SR = 8000;
const sine = (hz: number, seconds: number, amp = 0.5) =>
  Float32Array.from(
    { length: Math.round(seconds * SR) },
    (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR),
  );
const rms = (a: Float32Array, s: number, e: number) =>
  Math.sqrt(a.slice(s, e).reduce((x, v) => x + v * v, 0) / (e - s));

describe('post: reverb', () => {
  it('adds a decaying tail after an impulse and stays finite', () => {
    const imp = new Float32Array(SR * 3);
    imp[0] = 1;
    const [l, r] = applyReverb([imp], SR, { room: 0.7, wet: 0.5 });
    expect(l.length).toBe(imp.length);
    expect(analyze([l, r], SR).nonFinite).toBe(0);
    const early = rms(l, SR * 0.1, SR * 0.4);
    const late = rms(l, SR * 2.2, SR * 2.5);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeLessThan(early * 0.25);
  });

  it('the sliced reverb yields in chunks and matches the one-shot result', () => {
    const dry = sine(330, 6, 0.4);
    const steps = applyReverbSteps([dry], SR, { room: 0.8, wet: 0.4 }, true);
    let yields = 0;
    let r = steps.next();
    while (!r.done) {
      yields++;
      r = steps.next();
    }
    // Two channels over two loop periods, a yield per chunk.
    expect(yields).toBeGreaterThanOrEqual(Math.floor((2 * 2 * dry.length) / REVERB_CHUNK));
    const whole = applyReverb([dry], SR, { room: 0.8, wet: 0.4 }, true);
    expect(r.value[0]).toEqual(whole[0]);
    expect(r.value[1]).toEqual(whole[1]);
  });

  it('RT60 grows with room size', () => {
    expect(reverbRt60({ room: 0.9 }, SR)).toBeGreaterThan(reverbRt60({ room: 0.2 }, SR));
  });

  it('loop mode wraps the tail so a periodic input stays seamless', () => {
    const dry = sine(220, 4, 0.4); // whole cycles: the dry loop is seamless
    const out = applyReverb([dry], SR, { room: 0.8, wet: 0.4 }, true);
    const m = analyze(out, SR, true);
    expect(problems(m, true)).toEqual([]);
    // Without wrapping, the start has no tail yet: the level jumps at the seam.
    const plain = analyze(applyReverb([dry], SR, { room: 0.8, wet: 0.4 }, false), SR, true);
    expect(Math.abs(plain.seamLevelDb)).toBeGreaterThan(Math.abs(m.seamLevelDb));
  });
});

describe('post: edges and trimming', () => {
  it('edgeFade forces exact zeros at both ends', () => {
    const c = new Float32Array(1000).fill(0.7);
    edgeFade([c], SR, 0.01, 0.02);
    expect(c[0]).toBe(0);
    expect(Math.abs(c[999]!)).toBeLessThan(1e-6);
    expect(c[500]).toBeCloseTo(0.7);
  });

  it('audibleLength trims silence but keeps a margin', () => {
    const c = padSeconds(sine(440, 0.5), SR, 1);
    const n = audibleLength([c], SR, 1e-4, 0.05);
    expect(n).toBeGreaterThan(0.5 * SR);
    expect(n).toBeLessThanOrEqual(0.56 * SR);
  });

  it('saturate keeps ±1 at ±1 and lifts the middle', () => {
    const c = Float32Array.from([-1, -0.25, 0, 0.25, 1]);
    saturate([c], 0.5);
    expect(c[0]).toBeCloseTo(-1);
    expect(c[4]).toBeCloseTo(1);
    expect(c[2]).toBe(0);
    expect(c[3]!).toBeGreaterThan(0.25);
  });
});

describe('analyze', () => {
  it('flags clipping, NaN and a cut-off end', () => {
    expect(problems(analyze([sine(100, 0.5, 1)], SR), false).join()).toMatch(/peak/);
    const nan = sine(100, 0.5);
    nan[10] = Number.NaN;
    expect(problems(analyze([nan], SR), false).join()).toMatch(/non-finite/);
    expect(problems(analyze([sine(97, 0.5)], SR), false).join()).toMatch(/click|tail/);
  });

  it('passes a clean faded one-shot', () => {
    const c = padSeconds(sine(200, 0.4), SR, 0.3);
    edgeFade([c], SR, 0.001, 0.32);
    expect(problems(analyze([c], SR), false)).toEqual([]);
  });

  it('detects a loop seam click', () => {
    expect(analyze([sine(201.3, 2)], SR, true).seamRatio).toBeGreaterThan(1.5);
    expect(problems(analyze([sine(200, 2)], SR, true), true)).toEqual([]);
  });

  it('encodes a valid WAV header', () => {
    const w = encodeWav([new Float32Array(10), new Float32Array(10)], 44100);
    expect(w.length).toBe(44 + 10 * 2 * 2);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe('RIFF');
    expect(new DataView(w.buffer).getUint16(22, true)).toBe(2);
  });
});
