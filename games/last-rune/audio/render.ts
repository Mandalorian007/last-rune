/**
 * Browser glue: render a `SoundDef` to an `AudioBuffer`. The engine synth renders the dry
 * spec offline; the game then saturates, adds the room (loop-aware), sets the final peak,
 * trims the inaudible tail and fades the edges of one-shots so nothing clicks.
 */
import { normalize, type OfflineContextFactory, renderSound } from '@engine/audio';
import type { SoundDef } from './bank';
import {
  applyReverbSteps,
  audibleLength,
  drain,
  edgeFade,
  padSeconds,
  reverbRt60,
  saturate,
} from './post';

/** Channel data after game post-processing (pure part of the pipeline, testable with a fake dry render). */
export function postProcess(
  def: SoundDef,
  dry: readonly Float32Array[],
  sampleRate: number,
): Float32Array[] {
  return drain(postProcessSteps(def, dry, sampleRate));
}

/** `postProcess` in slices: yields between passes and inside the reverb (see `pump`). */
function* postProcessSteps(
  def: SoundDef,
  dry: readonly Float32Array[],
  sampleRate: number,
): Generator<void, Float32Array[]> {
  const loop = def.spec.loop !== undefined;
  let chans: Float32Array[] = dry.map((c) => new Float32Array(c));
  if (def.saturate) {
    normalize(chans, 0.9);
    saturate(chans, def.saturate);
    yield;
  }
  if (def.reverb) {
    if (!loop) {
      const tail = reverbRt60(def.reverb, sampleRate);
      chans = chans.map((c) => padSeconds(c, sampleRate, tail));
    }
    chans = yield* applyReverbSteps(chans, sampleRate, def.reverb, loop);
  }
  normalize(chans, def.level);
  if (!loop) {
    const n = audibleLength(chans, sampleRate, 1e-4, 0.04);
    chans = chans.map((c) => c.slice(0, n));
    edgeFade(chans, sampleRate, 0.001, 0.03);
  }
  return chans;
}

/**
 * Post-processing (reverb especially) is main-thread work, 40+ ms for a long loop. The offline
 * renders of a group finish together, so run back to back their post steps would make one long
 * task that stalls the title for 100+ ms. Instead each sound's steps queue, and a pump runs
 * them in slices of about `SLICE_MS`, yielding to the event loop (a frame, an input) between
 * slices. A single step (one reverb chunk or one linear pass) is a few ms at most.
 */
const SLICE_MS = 8;
const postQueue: Generator<void, void>[] = [];
let pumping = false;

function yieldTask(fn: () => void): void {
  if (typeof MessageChannel === 'undefined') {
    setTimeout(fn, 0);
    return;
  }
  const ch = new MessageChannel();
  ch.port1.onmessage = () => {
    ch.port1.close();
    fn();
  };
  ch.port2.postMessage(0);
}

function pump(): void {
  const t0 = performance.now();
  while (postQueue.length > 0) {
    if (postQueue[0]!.next().done) postQueue.shift();
    if (performance.now() - t0 >= SLICE_MS) break;
  }
  if (postQueue.length > 0) yieldTask(pump);
  else pumping = false;
}

function* settle<T>(
  steps: Generator<void, T>,
  resolve: (v: T) => void,
  reject: (e: unknown) => void,
): Generator<void, void> {
  try {
    resolve(yield* steps);
  } catch (e) {
    reject(e);
  }
}

function postInTurn(def: SoundDef, dry: AudioBuffer): Promise<Float32Array[]> {
  return new Promise((resolve, reject) => {
    const chans: Float32Array[] = [];
    for (let c = 0; c < dry.numberOfChannels; c++) chans.push(dry.getChannelData(c));
    postQueue.push(settle(postProcessSteps(def, chans, dry.sampleRate), resolve, reject));
    if (!pumping) {
      pumping = true;
      yieldTask(pump);
    }
  });
}

/** Render a bank entry. Needs `OfflineAudioContext` (any browser); no user gesture. */
export async function renderDef(
  def: SoundDef,
  createOffline?: OfflineContextFactory,
): Promise<AudioBuffer> {
  const dry = await renderSound({ ...def.spec, normalize: undefined }, createOffline);
  const out = await postInTurn(def, dry);
  const buf = new AudioBuffer({
    length: out[0]!.length,
    numberOfChannels: out.length,
    sampleRate: dry.sampleRate,
  });
  for (let i = 0; i < out.length; i++) buf.copyToChannel(out[i] as Float32Array<ArrayBuffer>, i);
  return buf;
}
