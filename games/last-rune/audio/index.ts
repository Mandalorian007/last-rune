/**
 * The game's audio API. Wraps one `AudioEngine`:
 *
 *   const audio = createGameAudio(engine);      // defines the bank; renders nothing yet
 *   audio.sfx.play('gemPlace', { gem: 'split' });
 *   const bolt = audio.sfx.bolt();  bolt.setIntensity(0.7);  bolt.stop();
 *   audio.music.setMood(moodFor('hall', tier));
 *   caption.onChar = audio.fuse.onChar(fuseModeForTier(tier));
 *
 * Every sound is rendered offline the first time audio unlocks (priority groups first, so
 * clicks and gems are ready within a frame or two of the first gesture), then cached.
 * Before that, one-shots are silently dropped and loops start once their buffer is ready.
 */
import type { AudioEngine, Voice } from '@thunderclap-engine/engine/audio';
import type { GemKind } from '../rules/types';
import { BANK, type RenderGroup, renderOrder } from './bank';
import { type FuseMode, type FuseState, fuseBlip, newFuseState } from './fuse';
import { createMusicDirector, type MusicDirector } from './music';
import { renderDef } from './render';
import { boltMix, boltStepParams, GEM_VOICES } from './theory';

export { type FuseMode, fuseModeForTier } from './fuse';
export { MOOD_IDS, type MoodId, moodFor, type SceneName } from './moods';
export type { MusicDirector } from './music';

/** One-shot sounds the game can play, and the params each takes. */
export interface SfxParams {
  gemPick: { gem?: GemKind };
  gemPlace: { gem: GemKind };
  gemRotate: object;
  socketBlocked: object;
  /** `charge`: bolt units passing through (1 = one storm-cell bolt). */
  boltStep: { gem: GemKind; charge?: number };
  machineUnder: object;
  machineExact: object;
  breakerTrip: object;
  gemGranted: object;
  doorUnlock: object;
  pageFound: object;
  codexOpen: object;
  codexClose: object;
  uiHover: object;
  uiClick: object;
  /** FUSE's cross "bzzt" (a regulation violated). */
  fuseBzzt: object;
  /** FUSE knocking his clipboard / a door. */
  knock: object;
  /** Ending: FUSE drops the clipboard. */
  clipboardDrop: object;
  /** Pulling the tarp off a machine. */
  tarp: object;
  endingSwell: object;
  /** Near thunder on demand (moods schedule distant thunder themselves). */
  thunder: { near?: boolean };
}
export type SfxName = keyof SfxParams;
export const SFX_NAMES = [
  'gemPick',
  'gemPlace',
  'gemRotate',
  'socketBlocked',
  'boltStep',
  'machineUnder',
  'machineExact',
  'breakerTrip',
  'gemGranted',
  'doorUnlock',
  'pageFound',
  'codexOpen',
  'codexClose',
  'uiHover',
  'uiClick',
  'fuseBzzt',
  'knock',
  'clipboardDrop',
  'tarp',
  'endingSwell',
  'thunder',
] as const satisfies readonly SfxName[];

/** Common to every sfx: per-call gain, pan, and a start delay in seconds. */
export interface SfxCommon {
  gain?: number;
  pan?: number;
  delay?: number;
}

export interface ResolvedSfx {
  /** Bank key. */
  key: string;
  rate: number;
  gain: number;
  pan: number;
}

/**
 * Pure: an sfx name and params to the bank key and playback tweaks. Repeated sounds get a
 * small random rate wobble (`rand` 0..1) so a run of clicks doesn't sound stamped.
 */
export function resolveSfx<N extends SfxName>(
  name: N,
  params: SfxParams[N] & SfxCommon,
  rand: () => number = Math.random,
): ResolvedSfx {
  const p = params as Partial<SfxParams[SfxName]> & SfxCommon & Record<string, unknown>;
  const wobble = (cents: number) => 2 ** (((rand() * 2 - 1) * cents) / 1200);
  let key: string = name;
  let rate = 1;
  let gain = 1;
  let pan = 0;
  switch (name) {
    case 'gemPlace': {
      const gem = p.gem as GemKind;
      key = `gemPlace.${gem}`;
      pan = GEM_VOICES[gem].pan;
      break;
    }
    case 'boltStep': {
      const gem = p.gem as GemKind;
      const s = boltStepParams((p.charge as number | undefined) ?? 1);
      key = `boltStep.${gem}`;
      rate = s.rate;
      gain = s.gain;
      break;
    }
    case 'gemPick':
    case 'gemRotate':
    case 'uiClick':
    case 'uiHover':
    case 'knock':
    case 'socketBlocked':
      rate = wobble(40);
      break;
    case 'thunder':
      key = rand() < 0.5 ? 'thunder.a' : 'thunder.b';
      rate = p.near ? 1.1 * wobble(60) : 0.85 * wobble(80);
      gain = p.near ? 1 : 0.6;
      break;
  }
  return {
    key,
    rate,
    gain: gain * (p.gain ?? 1),
    pan: Math.max(-1, Math.min(1, pan + (p.pan ?? 0))),
  };
}

/** A running bolt-travel crackle. Intensity 0..1 (e.g. charge / max charge). */
export interface BoltHandle {
  setIntensity(intensity: number, ramp?: number): void;
  stop(fade?: number): void;
}

/** A storm cell's hum while it is on screen: 1×, 2× or 4×. */
export interface StormCellHandle {
  setStrength(strength: 1 | 2 | 4, ramp?: number): void;
  setGain(gain: number, ramp?: number): void;
  stop(fade?: number): void;
}

export interface PrepareStats {
  /** Wall time from first unlock to every sound rendered, ms. */
  totalMs: number;
  /** Per render group: wall ms (group 0 = interaction sounds, ready first). */
  groupMs: number[];
  sounds: number;
}

export interface GameAudio {
  readonly engine: AudioEngine;
  sfx: {
    play<N extends SfxName>(
      name: N,
      ...params: object extends SfxParams[N]
        ? [(SfxParams[N] & SfxCommon)?]
        : [SfxParams[N] & SfxCommon]
    ): Voice;
    bolt(intensity?: number): BoltHandle;
    stormCell(strength: 1 | 2 | 4, gain?: number): StormCellHandle;
    /** Ending: a lively crowd far off in the light (a quiet loop; stop it with a fade). */
    crowd(gain?: number, fadeIn?: number): Voice;
  };
  music: MusicDirector;
  fuse: {
    /** Play the blip for one caption character (null when silent). */
    blip(ch: string, index: number, mode: FuseMode, text?: string): void;
    /** A caption-card `onChar` handler for one line in a given mode. */
    onChar(mode: FuseMode, text?: string): (ch: string, index: number) => void;
  };
  /** Render everything now (also runs automatically on first unlock). */
  prepare(): Promise<PrepareStats>;
  /** Resolves when the first-unlock pre-render finishes. */
  readonly ready: Promise<PrepareStats>;
  dispose(): void;
}

export interface GameAudioOptions {
  /** Seed for generative music. */
  seed?: number;
  /** Called when the pre-render finishes (for dev logging). */
  onPrepared?: (stats: PrepareStats) => void;
}

export function createGameAudio(engine: AudioEngine, opts: GameAudioOptions = {}): GameAudio {
  for (const [name, def] of Object.entries(BANK)) {
    if (!engine.has(name))
      engine.define(name, () => renderDef(def), { maxVoices: def.maxVoices ?? 4 });
  }

  let prepared: Promise<PrepareStats> | null = null;
  let resolveReady!: (s: PrepareStats) => void;
  const ready = new Promise<PrepareStats>((r) => {
    resolveReady = r;
  });

  function prepare(): Promise<PrepareStats> {
    if (prepared) return prepared;
    prepared = (async () => {
      const t0 = performance.now();
      const order = renderOrder();
      const groupMs: number[] = [];
      for (const g of [0, 1, 2, 3] as RenderGroup[]) {
        const tg = performance.now();
        await engine.prepare(order.filter((n) => BANK[n]!.group === g));
        groupMs.push(performance.now() - tg);
        // Yield a frame between groups so the first interaction isn't blocked.
        await new Promise((r) => setTimeout(r, 0));
      }
      const stats = { totalMs: performance.now() - t0, groupMs, sounds: order.length };
      opts.onPrepared?.(stats);
      resolveReady(stats);
      return stats;
    })();
    return prepared;
  }

  const offState = engine.onStateChange((s) => {
    if (s === 'running') void prepare();
  });
  if (engine.state === 'running') void prepare();

  const music = createMusicDirector(engine, opts.seed);
  const fuseState: FuseState = newFuseState();

  const blip = (ch: string, index: number, mode: FuseMode, text?: string): void => {
    const b = fuseBlip(ch, index, performance.now(), mode, fuseState, text);
    if (b) engine.play(b.sound, { bus: 'sfx', rate: b.rate, gain: b.gain, pan: b.pan });
  };

  const play = (name: SfxName, params: SfxCommon & Record<string, unknown> = {}): Voice => {
    const r = resolveSfx(name, params as never);
    const def = BANK[r.key];
    if (!def) {
      if (import.meta.env?.DEV) console.warn(`[audio] unknown sfx ${r.key}`);
      return engine.play(r.key);
    }
    return engine.play(r.key, {
      bus: def.bus,
      rate: r.rate,
      gain: r.gain,
      pan: r.pan,
      delay: params.delay,
    });
  };

  return {
    engine,
    sfx: {
      play: play as GameAudio['sfx']['play'],
      bolt(intensity = 0.3) {
        const m = boltMix(intensity);
        const low = engine.loop('bolt.low', {
          bus: 'sfx',
          gain: m.low,
          rate: m.rate,
          fadeIn: 0.08,
        });
        const high = engine.loop('bolt.high', {
          bus: 'sfx',
          gain: m.high,
          rate: m.rate,
          fadeIn: 0.08,
        });
        return {
          setIntensity(i, ramp = 0.1) {
            const n = boltMix(i);
            low.setGain(n.low, ramp);
            high.setGain(n.high, ramp);
            low.setRate(n.rate, ramp);
            high.setRate(n.rate, ramp);
          },
          stop(fade = 0.12) {
            low.stop(fade);
            high.stop(fade);
          },
        };
      },
      stormCell(strength, gain = 1) {
        let cur = strength;
        let g = gain;
        let voice = engine.loop(`storm.${cur}`, { bus: 'sfx', gain: g, fadeIn: 0.6 });
        return {
          setStrength(s, ramp = 0.6) {
            if (s === cur) return;
            voice.stop(ramp);
            cur = s;
            voice = engine.loop(`storm.${cur}`, { bus: 'sfx', gain: g, fadeIn: ramp });
          },
          setGain(next, ramp = 0.2) {
            g = next;
            voice.setGain(next, ramp);
          },
          stop(fade = 0.6) {
            voice.stop(fade);
          },
        };
      },
      crowd(gain = 1, fadeIn = 2.5) {
        return engine.loop('amb.crowd', { bus: 'sfx', gain, fadeIn });
      },
    },
    music,
    fuse: {
      blip,
      onChar: (mode, text) => (ch, index) => blip(ch, index, mode, text),
    },
    prepare,
    ready,
    dispose() {
      offState();
      music.dispose();
    },
  };
}
