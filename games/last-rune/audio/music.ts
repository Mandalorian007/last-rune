/**
 * Music director: runs a mood. Crossfades looped layers between moods (shared beds keep
 * playing and only change gain), and schedules the generative notes and ambient events with
 * a short look-ahead against the audio clock so timing is sample-accurate even when the main
 * thread stutters. Silent and idle while audio is locked.
 */
import type { AudioEngine, Voice } from '@engine/audio';
import { rng } from '@engine/audio';
import {
  barSeconds,
  eventChance,
  lerp,
  MOODS,
  type Mood,
  type MoodId,
  planBar,
  planTransition,
  type SeqState,
} from './moods';

/** How far ahead notes are scheduled, seconds. */
const LOOKAHEAD = 0.6;
const TICK_MS = 150;

export interface MusicDirector {
  readonly mood: MoodId;
  /** Crossfade to a mood. `fade` overrides the mood's own crossfade time. Same mood: no-op. */
  setMood(id: MoodId, opts?: { fade?: number }): void;
  /** Dip the whole bed (layers and notes) to `gain` for `seconds`, e.g. under the solve fanfare. */
  duck(gain: number, seconds: number, release?: number): void;
  stop(fade?: number): void;
  dispose(): void;
}

export function createMusicDirector(engine: AudioEngine, seed = Date.now()): MusicDirector {
  const rand = rng(seed >>> 0);
  let moodId: MoodId = 'silence';
  let mood: Mood = MOODS.silence;
  const layers = new Map<string, { voice: Voice; gain: number }>();
  let seqState: SeqState = { last: {} };
  /** Audio-clock time the next bar starts, or null to start on the next tick. */
  let nextBar: number | null = null;
  let lastTick: number | null = null;
  let duckGain = 1;
  let duckTimer: ReturnType<typeof setTimeout> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const now = (): number | null =>
    engine.state === 'running' ? (engine.context?.currentTime ?? null) : null;

  function tick(): void {
    const t = now();
    if (t === null) {
      nextBar = null;
      lastTick = null;
      return;
    }
    const dt = lastTick === null ? TICK_MS / 1000 : Math.min(1, t - lastTick);
    lastTick = t;

    const seq = mood.seq;
    if (seq) {
      if (nextBar === null || nextBar < t) nextBar = t + 0.1;
      while (nextBar < t + LOOKAHEAD) {
        for (const n of planBar(seq, rand, seqState)) {
          engine.play(n.sound, {
            bus: 'music',
            delay: nextBar - t + n.t,
            rate: n.rate,
            gain: n.gain * duckGain,
            pan: n.pan,
          });
        }
        nextBar += barSeconds(seq);
      }
    }
    for (const ev of mood.events) {
      if (rand() < eventChance(ev.perMinute, dt)) {
        const sound = ev.sounds[Math.floor(rand() * ev.sounds.length)]!;
        engine.play(sound, {
          bus: 'music',
          delay: rand() * dt,
          gain: lerp(ev.gain, rand()) * duckGain,
          rate: lerp(ev.rate, rand()),
          pan: lerp(ev.pan, rand()),
        });
      }
    }
  }

  function ensureTimer(): void {
    if (timer === null && typeof setInterval !== 'undefined') timer = setInterval(tick, TICK_MS);
  }

  function setMood(id: MoodId, opts: { fade?: number } = {}): void {
    if (id === moodId) return;
    const target = MOODS[id];
    const fade = opts.fade ?? target.fade;
    const plan = planTransition(mood, target);
    for (const s of plan.stop) {
      layers.get(s)?.voice.stop(fade);
      layers.delete(s);
    }
    for (const l of plan.retune) {
      const cur = layers.get(l.sound);
      if (!cur) continue;
      cur.gain = l.gain;
      cur.voice.setGain(l.gain * duckGain, fade);
    }
    for (const l of plan.start) {
      const voice = engine.loop(l.sound, { bus: 'music', gain: l.gain * duckGain, fadeIn: fade });
      layers.set(l.sound, { voice, gain: l.gain });
    }
    // New mood, new phrase. Keep the bar clock if both moods sequence, so notes don't bunch.
    if (!target.seq) nextBar = null;
    seqState = { last: {} };
    mood = target;
    moodId = id;
    ensureTimer();
  }

  function duck(gain: number, seconds: number, release = 1.5): void {
    duckGain = Math.min(1, Math.max(0, gain));
    for (const l of layers.values()) l.voice.setGain(l.gain * duckGain, 0.15);
    if (duckTimer !== null) clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      duckGain = 1;
      duckTimer = null;
      for (const l of layers.values()) l.voice.setGain(l.gain, release);
    }, seconds * 1000);
  }

  return {
    get mood() {
      return moodId;
    },
    setMood,
    duck,
    stop(fade = 1.5) {
      setMood('silence', { fade });
    },
    dispose() {
      for (const l of layers.values()) l.voice.stop(0.2);
      layers.clear();
      if (timer !== null) clearInterval(timer);
      if (duckTimer !== null) clearTimeout(duckTimer);
      timer = null;
      mood = MOODS.silence;
      moodId = 'silence';
    },
  };
}
