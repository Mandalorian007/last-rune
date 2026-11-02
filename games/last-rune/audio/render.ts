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

/** Render a bank entry. Needs `OfflineAudioContext` (any browser); no user gesture. */
export async function renderDef(
  def: SoundDef,
  createOffline?: OfflineContextFactory,
): Promise<AudioBuffer> {
  const dry = await renderSound({ ...def.spec, normalize: undefined }, createOffline);
  const chans: Float32Array[] = [];
  for (let c = 0; c < dry.numberOfChannels; c++) chans.push(dry.getChannelData(c));
  const out = postProcess(def, chans, dry.sampleRate);
  const buf = new AudioBuffer({
    length: out[0]!.length,
    numberOfChannels: out.length,
    sampleRate: dry.sampleRate,
  });
  for (let i = 0; i < out.length; i++) buf.copyToChannel(out[i] as Float32Array<ArrayBuffer>, i);
  return buf;
}
