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
 *   when dynamic resolution sits at its floor and frames are still over budget.
 *
 * Pure apart from the `GraphicsTargets` it drives (unit-tested with fakes).
 */
import { DynamicResolution } from '@engine/render';
import type { GraphicsPref } from './settings';

export type GraphicsTier = 'high' | 'low';

export interface TierSpec {
  /** Scene-target pixel budget (width × height). */
  readonly maxPixels: number;
  readonly post: { maxBloomLevels: number; raySamples: number; fogOctaves: number };
  /** Most point lights per light set (MAX_LIGHTS = 16). */
  readonly lights: number;
  /** Multiplier on particle spawning (on top of reduced motion). */
  readonly particles: number;
}

export const TIERS: Readonly<Record<GraphicsTier, TierSpec>> = {
  high: {
    maxPixels: 2560 * 1440,
    post: { maxBloomLevels: 8, raySamples: 64, fogOctaves: 5 },
    lights: 16,
    particles: 1,
  },
  low: {
    maxPixels: 1280 * 720,
    post: { maxBloomLevels: 5, raySamples: 32, fogOctaves: 3 },
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
}

export interface GraphicsOptions {
  /** `GPUAdapter.info.isFallbackAdapter` (a software rasteriser): start on low. */
  fallbackAdapter?: boolean;
  /** GPU time budget per frame (ms). Default 14. */
  budgetMs?: number;
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

export class GraphicsController {
  private pref: GraphicsPref = 'auto';
  private _tier: GraphicsTier = 'high';
  /** Auto settled on low for this session. */
  private autoLow: boolean;
  private readonly dr: DynamicResolution;
  private readonly budgetMs: number;
  private probeStart = -1;
  private probeSamples: number[] = [];
  private probed = false;
  private saturatedSince = -1;
  private readonly listeners = new Set<(tier: GraphicsTier) => void>();
  /** Why auto chose low (for diagnostics), or null. */
  autoReason: string | null = null;

  constructor(
    private readonly targets: GraphicsTargets,
    opts: GraphicsOptions = {},
  ) {
    this.budgetMs = opts.budgetMs ?? 14;
    this.dr = new DynamicResolution({ budgetMs: this.budgetMs, minScale: MIN_SCALE });
    this.autoLow = !!opts.fallbackAdapter;
    if (this.autoLow) this.autoReason = 'fallback adapter';
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
    this.dr.reset(1, nowMs);
    this.saturatedSince = -1;
    this.targets.setResolution({ maxPixels: spec.maxPixels, scale: 1 });
    this.targets.setPostQuality(spec.post);
    this.targets.setLightCap(spec.lights);
    this.targets.setParticleScale(spec.particles);
    this.targets.setTiming(this.dynamic ? 2 : 0);
    if (changed) for (const fn of this.listeners) fn(tier);
  }
}
