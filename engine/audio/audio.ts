/**
 * Runtime audio: an `AudioContext` created and resumed on the first user gesture, four buses
 * (master ← music, sfx, ui), named sounds rendered from specs, one-shots and loops.
 */
import { volumeToGain } from './dsp';
import { type OfflineContextFactory, renderSound, type SoundSpec } from './synth';

export const BUS_NAMES = ['master', 'music', 'sfx', 'ui'] as const;
export type BusName = (typeof BUS_NAMES)[number];
/** Buses a sound can play on (everything feeds master). */
export type OutputBus = Exclude<BusName, 'master'>;

export interface BusSettings {
  /** Slider position 0..1 (mapped to gain with a squared curve). */
  volume: number;
  muted: boolean;
}
export type MixerSettings = Record<BusName, BusSettings>;

export const DEFAULT_MIXER: Readonly<MixerSettings> = {
  master: { volume: 0.8, muted: false },
  music: { volume: 0.7, muted: false },
  sfx: { volume: 0.9, muted: false },
  ui: { volume: 0.8, muted: false },
};

/** Clamp and fill gaps so any (possibly hand-edited) object becomes valid settings. */
export function sanitizeMixer(input: unknown): MixerSettings {
  const src = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const out = {} as MixerSettings;
  for (const bus of BUS_NAMES) {
    const b = (typeof src[bus] === 'object' && src[bus] !== null ? src[bus] : {}) as Record<
      string,
      unknown
    >;
    const vol =
      typeof b.volume === 'number' && Number.isFinite(b.volume)
        ? b.volume
        : DEFAULT_MIXER[bus].volume;
    out[bus] = {
      volume: Math.min(1, Math.max(0, vol)),
      muted: typeof b.muted === 'boolean' ? b.muted : DEFAULT_MIXER[bus].muted,
    };
  }
  return out;
}

/** Effective linear gain for a bus. */
export function busGain(s: BusSettings): number {
  return s.muted ? 0 : volumeToGain(s.volume);
}

/**
 * - `locked`: waiting for a user gesture (or no context yet).
 * - `running`: playing.
 * - `suspended`: unlocked but paused (tab hidden or `suspend()`).
 * - `unavailable`: no WebAudio in this browser; everything is a silent no-op.
 */
export type AudioState = 'locked' | 'running' | 'suspended' | 'unavailable';

export interface PlayOptions {
  /** Default `sfx` for `play`, `music` for `loop`. */
  bus?: OutputBus;
  /** Linear gain on top of the bus. Default 1. */
  gain?: number;
  /** Playback rate (1 = original, 2 = octave up). Default 1. */
  rate?: number;
  /** Cents. */
  detune?: number;
  /** -1..1. */
  pan?: number;
  /** Seconds from now. */
  delay?: number;
  /** Seconds to fade in. Default 0 for one-shots, 0.5 for loops. */
  fadeIn?: number;
}

/** A playing (or pending) sound. Every method is safe to call at any time. */
export interface Voice {
  /** Stop, optionally fading out over `fade` seconds. */
  stop(fade?: number): void;
  setGain(gain: number, ramp?: number): void;
  setRate(rate: number, ramp?: number): void;
  readonly playing: boolean;
}

type SoundSource = SoundSpec | (() => Promise<AudioBuffer>);

interface SoundEntry {
  source: SoundSource;
  buffer: AudioBuffer | null;
  pending: Promise<AudioBuffer> | null;
  /** Voices currently playing, oldest first, for voice-stealing. */
  voices: VoiceImpl[];
  maxVoices: number;
}

const NULL_VOICE: Voice = {
  stop() {},
  setGain() {},
  setRate() {},
  playing: false,
};

/** One-shots requested while their buffer is still rendering are dropped after this long. */
const MAX_LATE_START = 0.15;

class VoiceImpl implements Voice {
  private src: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private stopped = false;
  private targetGain: number;
  private rate: number;
  private ended = false;

  constructor(
    private readonly engine: AudioEngine,
    readonly loop: boolean,
    private readonly opts: PlayOptions,
    private readonly onEnd: (v: VoiceImpl) => void,
  ) {
    this.targetGain = opts.gain ?? 1;
    this.rate = opts.rate ?? 1;
  }

  get playing(): boolean {
    return !this.stopped && !this.ended;
  }

  get started(): boolean {
    return this.src !== null;
  }

  get bus(): OutputBus {
    return this.opts.bus ?? (this.loop ? 'music' : 'sfx');
  }

  /** Create nodes and start. Returns false if it can't (no context). */
  start(buffer: AudioBuffer): boolean {
    const ctx = this.engine.context;
    if (!ctx || this.stopped) return false;
    const bus = this.engine.busNode(this.bus);
    if (!bus) return false;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = this.loop;
    src.playbackRate.value = this.rate;
    if (this.opts.detune) src.detune.value = this.opts.detune;
    const g = ctx.createGain();
    const t = ctx.currentTime + (this.opts.delay ?? 0);
    const fadeIn = this.opts.fadeIn ?? (this.loop ? 0.5 : 0);
    if (fadeIn > 0) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(this.targetGain, t + fadeIn);
    } else {
      g.gain.value = this.targetGain;
    }
    let tail: AudioNode = g;
    if (this.opts.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = this.opts.pan;
      g.connect(p);
      tail = p;
    }
    src.connect(g);
    tail.connect(bus);
    src.onended = () => {
      this.ended = true;
      tail.disconnect();
      this.onEnd(this);
    };
    src.start(t);
    this.src = src;
    this.gainNode = g;
    return true;
  }

  stop(fade = 0): void {
    if (this.stopped) return;
    this.stopped = true;
    const ctx = this.engine.context;
    if (!this.src || !this.gainNode || !ctx) {
      this.onEnd(this);
      return;
    }
    const t = ctx.currentTime;
    try {
      if (fade > 0) {
        const g = this.gainNode.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0, t + fade);
        this.src.stop(t + fade);
      } else {
        this.src.stop(t);
      }
    } catch {
      // Already stopped.
    }
  }

  setGain(gain: number, ramp = 0.05): void {
    this.targetGain = gain;
    const ctx = this.engine.context;
    if (!this.gainNode || !ctx) return;
    this.gainNode.gain.setTargetAtTime(gain, ctx.currentTime, Math.max(0.001, ramp / 3));
  }

  setRate(rate: number, ramp = 0.05): void {
    this.rate = rate;
    const ctx = this.engine.context;
    if (!this.src || !ctx) return;
    this.src.playbackRate.setTargetAtTime(rate, ctx.currentTime, Math.max(0.001, ramp / 3));
  }
}

export interface AudioEngineOptions {
  /** Create the realtime context. Called lazily, inside a user gesture. */
  createContext?: () => AudioContext;
  /** Offline renderer factory (tests). */
  createOffline?: OfflineContextFactory;
  /** Initial mixer settings (e.g. from a save). */
  settings?: unknown;
}

export interface AttachAudioOptions {
  /** Where to listen for the unlocking gesture. Default `window`. */
  target?: EventTarget;
  /** Suspend while the tab is hidden. Default true. */
  pauseWhenHidden?: boolean;
}

const GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'mousedown', 'click'] as const;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private _state: AudioState = 'locked';
  private buses: Partial<Record<BusName, GainNode>> = {};
  private _settings: MixerSettings;
  private readonly sounds = new Map<string, SoundEntry>();
  private readonly deferred = new Set<{ voice: VoiceImpl; sound: string | AudioBuffer }>();
  private readonly active = new Set<VoiceImpl>();
  private readonly stateListeners = new Set<(s: AudioState) => void>();
  private readonly settingsListeners = new Set<(s: Readonly<MixerSettings>) => void>();
  private readonly createContext: () => AudioContext;
  private readonly createOffline: OfflineContextFactory | undefined;
  private detachFns: (() => void)[] = [];
  private userSuspended = false;
  private hidden = false;

  constructor(opts: AudioEngineOptions = {}) {
    this._settings = sanitizeMixer(opts.settings);
    this.createOffline = opts.createOffline;
    this.createContext =
      opts.createContext ??
      (() => {
        const Ctor =
          globalThis.AudioContext ??
          (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) throw new Error('WebAudio unavailable');
        return new Ctor({ latencyHint: 'interactive' });
      });
  }

  get state(): AudioState {
    return this._state;
  }
  /** The realtime context, once created (after the first gesture). */
  get context(): AudioContext | null {
    return this.ctx;
  }
  get settings(): Readonly<MixerSettings> {
    return this._settings;
  }

  onStateChange(fn: (s: AudioState) => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }
  onSettingsChange(fn: (s: Readonly<MixerSettings>) => void): () => void {
    this.settingsListeners.add(fn);
    return () => this.settingsListeners.delete(fn);
  }

  private setState(s: AudioState) {
    if (s === this._state) return;
    this._state = s;
    for (const fn of this.stateListeners) fn(s);
  }

  // ------------------------------------------------------------ lifecycle

  /** Listen for the first user gesture to unlock audio, and pause while hidden. Returns detach. */
  attach(opts: AttachAudioOptions = {}): () => void {
    const target = opts.target ?? (typeof window !== 'undefined' ? window : undefined);
    if (target) {
      const onGesture = () => {
        void this.unlock().then((ok) => {
          if (ok) for (const g of GESTURES) target.removeEventListener(g, onGesture, true);
        });
      };
      for (const g of GESTURES) target.addEventListener(g, onGesture, true);
      this.detachFns.push(() => {
        for (const g of GESTURES) target.removeEventListener(g, onGesture, true);
      });
    }
    if (opts.pauseWhenHidden !== false && typeof document !== 'undefined') {
      const onVis = () => {
        this.hidden = document.visibilityState === 'hidden';
        void this.syncSuspension();
      };
      document.addEventListener('visibilitychange', onVis);
      this.detachFns.push(() => document.removeEventListener('visibilitychange', onVis));
    }
    return () => this.detach();
  }

  detach(): void {
    for (const fn of this.detachFns) fn();
    this.detachFns = [];
  }

  /**
   * Create/resume the context. Must run inside a user-gesture handler the first time
   * (`attach` does this for you). Resolves true once audio is running.
   */
  async unlock(): Promise<boolean> {
    if (this._state === 'unavailable') return false;
    if (!this.ctx) {
      try {
        this.ctx = this.createContext();
      } catch {
        this.setState('unavailable');
        return false;
      }
      this.buildBuses();
      this.ctx.onstatechange = () => this.onContextState();
    }
    // iOS Safari: a silent buffer started inside the gesture fully unlocks output.
    try {
      const silent = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const s = this.ctx.createBufferSource();
      s.buffer = silent;
      s.connect(this.ctx.destination);
      s.start();
    } catch {
      // ignore
    }
    if (this.ctx.state !== 'running' && !this.hidden && !this.userSuspended) {
      try {
        await this.ctx.resume();
      } catch {
        // Not allowed yet; a later gesture will retry.
      }
    }
    this.onContextState();
    return this.ctx.state === 'running' || (this._state === 'suspended' && this.isPaused());
  }

  private isPaused(): boolean {
    return this.hidden || this.userSuspended;
  }

  private onContextState() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'running') {
      this.setState('running');
      this.startDeferred();
    } else if (ctx.state === 'suspended') {
      // Suspended before ever running means the browser still wants a gesture.
      this.setState(this._state === 'locked' && !this.isPaused() ? 'locked' : 'suspended');
    } else {
      this.setState('unavailable');
    }
  }

  /** Pause all audio (e.g. game paused). Pair with `resume()`. */
  async suspend(): Promise<void> {
    this.userSuspended = true;
    await this.syncSuspension();
  }

  async resume(): Promise<void> {
    this.userSuspended = false;
    await this.syncSuspension();
  }

  private async syncSuspension() {
    const ctx = this.ctx;
    if (!ctx || this._state === 'unavailable' || this._state === 'locked') return;
    try {
      if (this.isPaused() && ctx.state === 'running') {
        await ctx.suspend();
        this.setState('suspended');
      } else if (!this.isPaused() && ctx.state !== 'running') {
        await ctx.resume();
      }
    } catch {
      // ignore
    }
    this.onContextState();
  }

  /** Close the context and drop everything. */
  async dispose(): Promise<void> {
    this.detach();
    this.stopAll();
    this.deferred.clear();
    const ctx = this.ctx;
    this.ctx = null;
    this.buses = {};
    if (ctx) await ctx.close().catch(() => {});
    this.setState('locked');
  }

  // ------------------------------------------------------------ mixer

  private buildBuses() {
    const ctx = this.ctx!;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    this.buses.master = master;
    for (const name of BUS_NAMES) {
      if (name === 'master') continue;
      const g = ctx.createGain();
      g.connect(master);
      this.buses[name] = g;
    }
    for (const name of BUS_NAMES) this.buses[name]!.gain.value = busGain(this._settings[name]);
  }

  /** Internal: the GainNode for a bus, once the context exists. */
  busNode(name: BusName): GainNode | null {
    return this.buses[name] ?? null;
  }

  private applyBus(name: BusName) {
    const node = this.buses[name];
    if (!node || !this.ctx) return;
    // Short time-constant ramp avoids zipper clicks.
    node.gain.setTargetAtTime(busGain(this._settings[name]), this.ctx.currentTime, 0.015);
  }

  private emitSettings() {
    for (const fn of this.settingsListeners) fn(this._settings);
  }

  setVolume(bus: BusName, volume: number): void {
    this._settings = {
      ...this._settings,
      [bus]: { ...this._settings[bus], volume: Math.min(1, Math.max(0, volume)) },
    };
    this.applyBus(bus);
    this.emitSettings();
  }

  setMuted(bus: BusName, muted: boolean): void {
    this._settings = { ...this._settings, [bus]: { ...this._settings[bus], muted } };
    this.applyBus(bus);
    this.emitSettings();
  }

  toggleMuted(bus: BusName): boolean {
    this.setMuted(bus, !this._settings[bus].muted);
    return this._settings[bus].muted;
  }

  /** Replace all settings (sanitized), e.g. after loading a save. */
  applySettings(settings: unknown): void {
    this._settings = sanitizeMixer(settings);
    for (const b of BUS_NAMES) this.applyBus(b);
    this.emitSettings();
  }

  // ------------------------------------------------------------ sounds

  /**
   * Register a named sound from a spec (rendered lazily or via `prepare`) or an async buffer
   * factory. `maxVoices` caps simultaneous plays of this sound (oldest is stolen). Default 8.
   */
  define(name: string, source: SoundSource, opts: { maxVoices?: number } = {}): void {
    const prev = this.sounds.get(name);
    for (const v of prev?.voices ?? []) v.stop();
    this.sounds.set(name, {
      source,
      buffer: null,
      pending: null,
      voices: [],
      maxVoices: opts.maxVoices ?? 8,
    });
  }

  has(name: string): boolean {
    return this.sounds.has(name);
  }

  /** Render (or fetch) the buffer for a sound. Needs no gesture. Cached. */
  load(name: string): Promise<AudioBuffer> {
    const e = this.sounds.get(name);
    if (!e) return Promise.reject(new Error(`unknown sound "${name}"`));
    if (e.buffer) return Promise.resolve(e.buffer);
    if (!e.pending) {
      const src = e.source;
      e.pending = (typeof src === 'function' ? src() : renderSound(src, this.createOffline)).then(
        (buf) => {
          e.buffer = buf;
          e.pending = null;
          return buf;
        },
        (err) => {
          e.pending = null;
          throw err;
        },
      );
    }
    return e.pending;
  }

  /** Render several (default: all) defined sounds up front. Call at boot or behind a loading screen. */
  async prepare(names: readonly string[] = [...this.sounds.keys()]): Promise<void> {
    await Promise.all(names.map((n) => this.load(n)));
  }

  /** Rendered buffer if ready. */
  buffer(name: string): AudioBuffer | null {
    return this.sounds.get(name)?.buffer ?? null;
  }

  /**
   * Fire a one-shot. Dropped (returns an inert voice) while audio is locked, suspended or
   * unavailable: a click sound arriving seconds late after unlock would be wrong.
   */
  play(sound: string | AudioBuffer, opts: PlayOptions = {}): Voice {
    if (this._state !== 'running' || !this.ctx) return NULL_VOICE;
    return this.startVoice(sound, false, opts, false);
  }

  /**
   * Start a loop (music, ambience). If audio is still locked, it starts as soon as it unlocks.
   * Stop it with `voice.stop(fade)`.
   */
  loop(sound: string | AudioBuffer, opts: PlayOptions = {}): Voice {
    if (this._state === 'unavailable') return NULL_VOICE;
    return this.startVoice(sound, true, opts, this._state !== 'running');
  }

  private startVoice(
    sound: string | AudioBuffer,
    loop: boolean,
    opts: PlayOptions,
    defer: boolean,
  ): Voice {
    const entry = typeof sound === 'string' ? this.sounds.get(sound) : undefined;
    if (typeof sound === 'string' && !entry) {
      console.warn(`[audio] unknown sound "${sound}"`);
      return NULL_VOICE;
    }
    const voice: VoiceImpl = new VoiceImpl(this, loop, opts, (v) => {
      this.active.delete(v);
      if (entry) {
        const i = entry.voices.indexOf(v);
        if (i >= 0) entry.voices.splice(i, 1);
      }
      for (const d of this.deferred) if (d.voice === v) this.deferred.delete(d);
    });
    this.active.add(voice);
    if (entry) {
      entry.voices.push(voice);
      while (entry.voices.length > entry.maxVoices) entry.voices.shift()!.stop(0.02);
    }
    if (defer) {
      this.deferred.add({ voice, sound });
      if (typeof sound === 'string') void this.load(sound).catch(() => {});
      return voice;
    }
    const buf = typeof sound === 'string' ? entry!.buffer : sound;
    if (buf) {
      voice.start(buf);
    } else {
      const requested = this.ctx!.currentTime;
      void this.load(sound as string).then(
        (b) => {
          const late = (this.ctx?.currentTime ?? Infinity) - requested;
          if (loop || late <= MAX_LATE_START) voice.start(b);
          else voice.stop();
        },
        (err) => {
          console.warn(`[audio] failed to render "${String(sound)}":`, err);
          voice.stop();
        },
      );
    }
    return voice;
  }

  private startDeferred() {
    for (const d of [...this.deferred]) {
      this.deferred.delete(d);
      if (!d.voice.playing) continue;
      if (typeof d.sound !== 'string') {
        d.voice.start(d.sound);
        continue;
      }
      void this.load(d.sound).then(
        (b) => {
          if (d.voice.playing && !d.voice.started) d.voice.start(b);
        },
        () => d.voice.stop(),
      );
    }
  }

  /** Stop every voice (or only those on `bus`), with an optional fade. */
  stopAll(fade = 0, bus?: OutputBus): void {
    for (const v of [...this.active]) if (!bus || v.bus === bus) v.stop(fade);
  }

  /** Number of voices playing or waiting to start. */
  get voiceCount(): number {
    return this.active.size;
  }
}
