/**
 * Browser glue: render a `SoundDef` to an `AudioBuffer`. The engine synth renders the dry
 * spec offline; the game then saturates, adds the room (loop-aware), sets the final peak,
 * trims the inaudible tail and fades the edges of one-shots so nothing clicks.
 */
import { normalize, type OfflineContextFactory, renderSound } from '@engine/audio';
import type { SoundDef } from './bank';
import { applyReverb, audibleLength, edgeFade, padSeconds, reverbRt60, saturate } from './post';

/** Channel data after game post-processing (pure part of the pipeline, testable with a fake dry render). */
export function postProcess(
  def: SoundDef,
  dry: readonly Float32Array[],
  sampleRate: number,
): Float32Array[] {
  const loop = def.spec.loop !== undefined;
  let chans: Float32Array[] = dry.map((c) => new Float32Array(c));
  if (def.saturate) {
    normalize(chans, 0.9);
    saturate(chans, def.saturate);
  }
  if (def.reverb) {
    if (!loop) {
      const tail = reverbRt60(def.reverb, sampleRate);
      chans = chans.map((c) => padSeconds(c, sampleRate, tail));
    }
    chans = applyReverb(chans, sampleRate, def.reverb, loop);
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
 * Post-processing (reverb especially) is main-thread work, up to ~40 ms a sound. The offline
 * renders of a group finish together, so run back to back their post steps make one long task
 * that stalls the title for 100+ ms. Instead they queue, and a pump runs them in slices of
 * about `SLICE_MS`, yielding to the event loop (a frame, an input) between slices.
 */
const SLICE_MS = 8;
const postQueue: (() => void)[] = [];
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
    postQueue.shift()!();
    if (performance.now() - t0 >= SLICE_MS) break;
  }
  if (postQueue.length > 0) yieldTask(pump);
  else pumping = false;
}

function postInTurn(def: SoundDef, dry: AudioBuffer): Promise<Float32Array[]> {
  return new Promise((resolve, reject) => {
    postQueue.push(() => {
      try {
        const chans: Float32Array[] = [];
        for (let c = 0; c < dry.numberOfChannels; c++) chans.push(dry.getChannelData(c));
        resolve(postProcess(def, chans, dry.sampleRate));
      } catch (e) {
        reject(e);
      }
    });
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
