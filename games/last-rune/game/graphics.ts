/**
 * Graphics quality tiers (perf-tiers workstream).
 *
 * The game is fill-bound: almost all GPU time is the scene pass (lit full-screen materials),
 * so the main lever is the scene's internal resolution (`Renderer.setResolution`). The post
 * caps, light cap and particle cap trim the rest. The DOM overlay is unaffected.
 *
 * - `high`: today's look. Native resolution up to the surface cap (2560×1440), every effect.
 *   Fixed resolution: what the player picked is what they get.
 * - `low`: a 1280×720 pixel budget, cheaper post (fewer bloom levels, half the god-ray
 *   samples, three-octave mist) and half the particles. Dynamic resolution may drop further
 *   on very slow GPUs. Lights stay at 16: capping them measured as noise and would drop
 *   gameplay lights (energised gems, restored alcoves are added last). The cap hook remains.
 * - `auto` (default): starts with high effects and native resolution, with dynamic resolution
 *   on. It settles on `low` for the session when the adapter is a software fallback, when the
 *   first seconds of frames show the GPU cannot get near budget even at reduced scale, or
 *   when dynamic resolution sits at its floor and frames are still over budget. On a
 *   handheld (phone-sized touch device; D-039) it starts on `low`: small battery, tiled GPU,
 *   thermal throttling, and a screen where Low's 0.92 MP is already ~1.5× DPR.
 *
 * Steady 30: on `low` with dynamic resolution at its floor, if the GPU is still over budget
 * and frames really are missing vsync (median interval over `SLOW_FRAME_MS`) for
 * `HALF_RATE_MS`, the controller caps the frame rate at 30 for the session, rather than leave
 * a jittery 40–50. The GPU budget doubles with it, so dynamic resolution can climb back up.
 * Frame intervals gate it, so the queue-latency fallback timer (which can read several times
 * the real cost) can't trigger it on its own.
 *
 * Pure apart from the `GraphicsTargets` it drives (unit-tested with fakes).
 */
import { DynamicResolution } from '@thunderclap/engine/render';
import type { GraphicsPref } from './settings';

export type GraphicsTier = 'high' | 'low';

export interface TierSpec {
  /** Scene-target pixel budget (width × height). */
  readonly maxPixels: number;
  readonly post: {
    maxBloomLevels: number;
    raySamples: number;
    fogOctaves: number;
    /** Composite at scene resolution and upscale (saves fill at high DPR; softer mist). */
    compositeAtScene: boolean;
  };
  /** Most point lights per light set (MAX_LIGHTS = 16). */
  readonly lights: number;
  /** Multiplier on particle spawning (on top of reduced motion). */
  readonly particles: number;
}

export const TIERS: Readonly<Record<GraphicsTier, TierSpec>> = {
  high: {
    maxPixels: 2560 * 1440,
    post: { maxBloomLevels: 8, raySamples: 64, fogOctaves: 5, compositeAtScene: false },
    lights: 16,
    particles: 1,
  },
  low: {
    maxPixels: 1280 * 720,
    post: { maxBloomLevels: 5, raySamples: 32, fogOctaves: 3, compositeAtScene: true },
    lights: 16,
    particles: 0.5,
  },
};

/** What the controller drives. `ctx.ts` wires these to the renderer, post stack and art. */
export interface GraphicsTargets {
  setResolution(opts: { scale?: number; maxPixels?: number }): void;
  setPostQuality(q: TierSpec['post']): void;
  setLightCap(n: number): void;
  setParticleScale(k: number): void;
  /** Sample GPU time every N frames (0 = off). */
  setTiming(every: number): void;
  /** Cap the frame rate (null = display rate). */
  setFrameCap?(fps: number | null): void;
}

export interface GraphicsOptions {
  /** `GPUAdapter.info.isFallbackAdapter` (a software rasteriser): start on low. */
  fallbackAdapter?: boolean;
  /** GPU time budget per frame (ms). Default 14. */
  budgetMs?: number;
  /** A phone-sized touch device (`deviceTraits().handheld`): auto starts on low. */
  handheld?: boolean;
}

/** Auto: ignore the first second (pipelines warming, scene loading). */
const PROBE_SKIP_MS = 1000;
/** Auto: decide from this much measured time. */
const PROBE_MS = 3000;
/** Auto: at least this many samples before deciding. */
const PROBE_MIN_SAMPLES = 20;
/** Auto: give up on high when dynamic resolution has been saturated this long. */
const SATURATED_MS = 4000;
/** Dynamic resolution never goes below this scale of the tier's budget. */
const MIN_SCALE = 0.6;
/** Steady 30: a median frame interval above this is not holding 60 fps (ms). */
const SLOW_FRAME_MS = 20;
/** Steady 30: saturated and slow for this long before capping at 30 (ms). */
const HALF_RATE_MS = 4000;
/** Frame intervals kept for the median (about 1 s at 60 fps). */
const FRAME_WINDOW = 60;

export class GraphicsController {
  private pref: GraphicsPref = 'auto';
  private _tier: GraphicsTier = 'high';
  /** Auto settled on low for this session. */
  private autoLow: boolean;
  private dr: DynamicResolution;
  /** Capped at 30 fps for the session (see the class comment). */
  private halfRate = false;
  private slowSince = -1;
  private readonly frames = new Float32Array(FRAME_WINDOW);
  private readonly framesSorted = new Float32Array(FRAME_WINDOW);
  private frameCount = 0;
  private readonly budgetMs: number;
  private probeStart = -1;
  private probeSamples: number[] = [];
  private probed = false;
  private saturatedSince = -1;
  /** Scene pixel cap from `capPixels` (null = none). */
  private cap: number | null = null;
  private readonly listeners = new Set<(tier: GraphicsTier) => void>();
  /** Why auto chose low (for diagnostics), or null. */
  autoReason: string | null = null;

  constructor(
    private readonly targets: GraphicsTargets,
    opts: GraphicsOptions = {},
  ) {
    this.budgetMs = opts.budgetMs ?? 14;
    this.dr = new DynamicResolution({ budgetMs: this.budgetMs, minScale: MIN_SCALE });
    this.autoLow = !!opts.fallbackAdapter || !!opts.handheld;
    if (opts.fallbackAdapter) this.autoReason = 'fallback adapter';
    else if (opts.handheld) this.autoReason = 'handheld';
    this.apply();
  }

  /** The stored preference. */
  get preference(): GraphicsPref {
    return this.pref;
  }

  /** The tier in effect. */
  get tier(): GraphicsTier {
    return this._tier;
  }

  get spec(): TierSpec {
    return TIERS[this._tier];
  }

  /** True when dynamic resolution is on (auto and low). */
  get dynamic(): boolean {
    return this.pref !== 'high';
  }

  /** Current dynamic-resolution scale (1 when off). */
  get scale(): number {
    return this.dynamic ? this.dr.scale : 1;
  }

  /** Capped at 30 fps (steady 30; see the class comment). */
  get frameCapped(): boolean {
    return this.halfRate;
  }

  /** Smoothed GPU time estimate (ms), -1 before samples. */
  get gpuMs(): number {
    return this.dr.estimateMs;
  }

  /** Apply a preference from settings. Cheap when unchanged. */
  setPreference(pref: GraphicsPref): void {
    if (pref === this.pref) return;
    this.pref = pref;
    this.apply();
  }

  /**
   * Cap the scene's pixel budget below the tier's (null clears it). For a heavy stretch of a
   * scene: the ending's gold flood caps itself to CSS pixels (DPR 1), which leaves a 1× image
   * untouched and halves the fill on a DPR 2 screen. Cheap when unchanged.
   */
  capPixels(px: number | null): void {
    const next = px === null ? null : Math.max(1, Math.floor(px));
    if (next === this.cap) return;
    this.cap = next;
    this.targets.setResolution({ maxPixels: this.maxPixels });
  }

  /** The scene pixel budget in effect: the tier's, under any `capPixels` cap. */
  get maxPixels(): number {
    const tier = TIERS[this._tier].maxPixels;
    return this.cap === null ? tier : Math.min(tier, this.cap);
  }

  onChange(fn: (tier: GraphicsTier) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Feed a GPU time sample (from `Renderer.onGpuTime`). */
  sample(gpuMs: number, nowMs: number): void {
    if (!this.dynamic) return;
    if (this.pref === 'auto' && !this.autoLow && !this.probed) this.probe(gpuMs, nowMs);
    const before = this.dr.scale;
    const scale = this.dr.sample(gpuMs, nowMs);
    if (scale !== before) this.targets.setResolution({ scale });

    if (this.pref === 'auto' && !this.autoLow) {
      if (this.dr.saturated) {
        if (this.saturatedSince < 0) this.saturatedSince = nowMs;
        else if (nowMs - this.saturatedSince >= SATURATED_MS) {
          this.goLow(`over budget at scale ${MIN_SCALE}`, nowMs);
        }
      } else {
        this.saturatedSince = -1;
      }
    }
  }

  /**
   * Feed a rendered frame's interval (ms since the previous frame). Drives the steady-30 rule;
   * allocation-free.
   */
  frame(intervalMs: number, nowMs: number): void {
    if (this.halfRate || !this.dynamic || this._tier !== 'low') return;
    this.frames[this.frameCount % FRAME_WINDOW] = intervalMs;
    this.frameCount++;
    if (this.frameCount < FRAME_WINDOW || !this.dr.saturated) {
      this.slowSince = -1;
      return;
    }
    this.framesSorted.set(this.frames);
    this.framesSorted.sort();
    if (this.framesSorted[FRAME_WINDOW >> 1]! <= SLOW_FRAME_MS) {
      this.slowSince = -1;
      return;
    }
    if (this.slowSince < 0) this.slowSince = nowMs;
    else if (nowMs - this.slowSince >= HALF_RATE_MS) this.capHalfRate(nowMs);
  }

  private capHalfRate(nowMs: number): void {
    this.halfRate = true;
    this.slowSince = -1;
    // Twice the time per frame: dynamic resolution may climb back up within it.
    const scale = this.dr.scale;
    this.dr = new DynamicResolution({ budgetMs: this.budgetMs * 2, minScale: MIN_SCALE });
    this.dr.reset(scale, nowMs);
    this.targets.setFrameCap?.(30);
  }

  /**
   * First seconds on auto: if the median GPU time at full scale predicts that even the
   * dynamic-resolution floor would be over budget, go straight to low instead of crawling
   * down step by step.
   */
  private probe(gpuMs: number, nowMs: number): void {
    if (this.probeStart < 0) this.probeStart = nowMs;
    const t = nowMs - this.probeStart;
    if (t < PROBE_SKIP_MS) return;
    // Normalise to full scale (cost ∝ pixels).
    this.probeSamples.push(gpuMs / this.dr.scale ** 2);
    if (t < PROBE_SKIP_MS + PROBE_MS || this.probeSamples.length < PROBE_MIN_SAMPLES) return;
    this.probed = true;
    const sorted = this.probeSamples.sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    this.probeSamples = [];
    if (median * MIN_SCALE ** 2 > this.budgetMs) {
      this.goLow(`probe ${median.toFixed(1)} ms at full scale`, nowMs);
    }
  }

  private goLow(reason: string, nowMs: number): void {
    this.autoLow = true;
    this.autoReason = reason;
    this.apply(nowMs);
  }

  private apply(nowMs = Number.NEGATIVE_INFINITY): void {
    const tier: GraphicsTier =
      this.pref === 'high' ? 'high' : this.pref === 'low' || this.autoLow ? 'low' : 'high';
    const changed = tier !== this._tier;
    this._tier = tier;
    const spec = TIERS[tier];
    if (this.halfRate) {
      // A new preference (or tier) starts again at the display rate.
      this.halfRate = false;
      this.dr = new DynamicResolution({ budgetMs: this.budgetMs, minScale: MIN_SCALE });
      this.targets.setFrameCap?.(null);
    }
    this.slowSince = -1;
    this.frameCount = 0;
    this.dr.reset(1, nowMs);
    this.saturatedSince = -1;
    this.targets.setResolution({ maxPixels: this.maxPixels, scale: 1 });
    this.targets.setPostQuality(spec.post);
    this.targets.setLightCap(spec.lights);
    this.targets.setParticleScale(spec.particles);
    this.targets.setTiming(this.dynamic ? 2 : 0);
    if (changed) for (const fn of this.listeners) fn(tier);
  }
}
