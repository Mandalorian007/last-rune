/**
 * Candles: wax body + brass dish (lit), flickering flame, warm halo, and a warm point light.
 *
 *   const candles = new CandleRenderer(renderer);
 *   const list: CandleInstance[] = [{ x: 200, y: 900, height: 150 }, ...];
 *   // per frame
 *   candles.update(list, time);          // flicker values
 *   candles.addLights(lights, list);     // warm lights first (they matter most)
 *   candles.light(lights);
 *   candles.drawBodies(frame, list);     // one batch
 *   candles.drawFlames(frame, list);     // one batch of halos + one of flames
 */
import { valueNoise1 } from '@engine/fx';
import type { DrawParams, Frame, Material, Renderer, RGBA } from '@engine/render';
import { CANDLE_WGSL, FLAME_WGSL, GLOW_WGSL } from '../../shaders/candle-wgsl';
import { LIGHT_HEIGHT, LIGHT_SET_FLOATS, type LightSet } from './lights';
import { LINEAR } from './palette';

export interface CandleInstance {
  /** Base of the candle (bottom of the dish). */
  x: number;
  y: number;
  /** Wax height in px. */
  height: number;
  /** Wax width in px. Default height × 0.32 clamped to 26..48. */
  width?: number;
  seed?: number;
  /** 0 fresh .. 1 melted stub (more drips). */
  melt?: number;
  /** Light radius. Default 720. */
  radius?: number;
  /** Set by `update`: current flicker (≈0.7..1, mean ≈0.85; steady ≈0.92..1 in reduced motion). */
  flicker?: number;
}

const WAX: RGBA = [0.6, 0.52, 0.42, 1];

/**
 * Candles are mood, never focus (D-027): anything selectable must stay the brightest thing near
 * it. These scale the light a candle throws on the scene, its halo/bloom and its lit wax, from
 * the flicker value. Flame cores stay bright and small.
 */
export const CANDLE_LIGHT = {
  /** Point-light intensity per unit flicker (was 1.6). */
  light: 1.0,
  /** Light radius multiplier on `CandleInstance.radius` (pools less light on slab and floor). */
  radius: 0.9,
  /** Halo colour strength, bloom (emissive), size in px and falloff (were 0.12, 0.6, 220, 4). */
  halo: 0.085,
  haloBloom: 0.45,
  haloSize: 170,
  haloFalloff: 5,
  /** Wax lit by its own flame (scales the body shader's flame term). */
  wax: 0.7,
  /** Flame bloom (emissive; was 2.2). The core keeps its colour; it just spills less. */
  flameBloom: 1.7,
} as const;

/**
 * Warm, breathing candle light in ≈0.7..1 (mean ≈0.85): a slow swell (a ~6 s breath blended
 * with slower drift) plus a small, smooth flutter. Continuous noise only: no dips, pops or
 * strobe. Reduced motion / reduced flashes: a steady level with a very slow, shallow swell.
 * Pure and allocation-free.
 */
export function candleBreath(t: number, seed: number, calm = false): number {
  if (calm) return 1 - 0.08 * valueNoise1(t * 0.12, seed);
  const breath = 0.5 + 0.5 * Math.sin(t * 1.05 + seed * 2.3);
  const drift = valueNoise1(t * 0.3, seed);
  const swell = 0.55 * breath + 0.45 * drift;
  const flutter = 0.65 * valueNoise1(t * 2.2 + 7.1, seed + 1) + 0.35 * valueNoise1(t * 4.7, seed + 2);
  return 1 - 0.19 * swell - 0.11 * flutter;
}

export class CandleRenderer {
  private readonly bodyMat: Material;
  private readonly flameMat: Material;
  private readonly glowMat: Material;
  private readonly dp: DrawParams = { x: 0, y: 0, params: [0, 0, 0, 0] };
  private readonly tint: RGBA = [1, 1, 1, 1];
  /** Reduced motion (or reduced flashes): steady light with a very slow swell; calmer sway. */
  reducedMotion = false;

  constructor(renderer: Renderer) {
    this.bodyMat = renderer.createMaterial({
      label: 'candle-body',
      wgsl: CANDLE_WGSL,
      blend: 'alpha',
      uniformBytes: LIGHT_SET_FLOATS * 4,
    });
    this.flameMat = renderer.createMaterial({
      label: 'candle-flame',
      wgsl: FLAME_WGSL,
      blend: 'additive',
    });
    this.glowMat = renderer.createMaterial({
      label: 'candle-halo',
      wgsl: GLOW_WGSL,
      blend: 'additive',
    });
  }

  update(list: CandleInstance[], time: number): void {
    for (const c of list) c.flicker = candleBreath(time, c.seed ?? c.x, this.reducedMotion);
  }

  /** Flame position (wick tip) of a candle. */
  flamePos(c: CandleInstance, out: { x: number; y: number }): { x: number; y: number } {
    const quadH = c.height / 0.83;
    out.x = c.x;
    out.y = c.y - quadH + quadH * 0.07 - 4;
    return out;
  }

  addLights(lights: LightSet, list: readonly CandleInstance[]): void {
    const pt = this.pt;
    for (const c of list) {
      this.flamePos(c, pt);
      lights.add(
        pt.x,
        pt.y - 10,
        (c.radius ?? 720) * CANDLE_LIGHT.radius,
        LINEAR.candle,
        CANDLE_LIGHT.light * (c.flicker ?? 1),
        LIGHT_HEIGHT.candle,
      );
    }
  }
  private readonly pt = { x: 0, y: 0 };

  light(lights: LightSet): void {
    lights.apply(this.bodyMat);
  }

  drawBodies(frame: Frame, list: readonly CandleInstance[]): void {
    const dp = this.dp;
    const p = dp.params as number[];
    dp.rotation = 0;
    dp.tint = WAX;
    dp.emissive = 0;
    for (const c of list) {
      const w = c.width ?? Math.min(48, Math.max(26, c.height * 0.32));
      const quadW = w * 2.1;
      const quadH = c.height / 0.83;
      dp.x = c.x;
      dp.y = c.y - quadH / 2;
      dp.w = quadW;
      dp.h = quadH;
      p[0] = (c.flicker ?? 1) * CANDLE_LIGHT.wax;
      p[1] = c.seed ?? c.x * 0.013;
      p[2] = w / quadW;
      p[3] = c.melt ?? 0.4;
      frame.sprite(this.bodyMat, dp);
    }
  }

  drawFlames(frame: Frame, list: readonly CandleInstance[]): void {
    const dp = this.dp;
    const p = dp.params as number[];
    const tint = this.tint;
    const pt = this.pt;
    dp.tint = tint;
    dp.rotation = 0;
    // Halos first (one batch), then flames (one batch).
    for (const c of list) {
      const f = c.flicker ?? 1;
      this.flamePos(c, pt);
      const k = CANDLE_LIGHT.halo * f;
      tint[0] = LINEAR.candle[0] * k;
      tint[1] = LINEAR.candle[1] * k;
      tint[2] = LINEAR.candle[2] * k;
      tint[3] = 1;
      p[0] = CANDLE_LIGHT.haloFalloff;
      p[1] = 0;
      dp.emissive = CANDLE_LIGHT.haloBloom;
      dp.x = pt.x;
      dp.y = pt.y - 18;
      dp.w = CANDLE_LIGHT.haloSize * (0.9 + 0.1 * f);
      dp.h = dp.w;
      frame.sprite(this.glowMat, dp);
    }
    for (const c of list) {
      const f = c.flicker ?? 1;
      this.flamePos(c, pt);
      const fh = 44 + c.height * 0.08;
      tint[0] = 1;
      tint[1] = 1;
      tint[2] = 1;
      tint[3] = 1;
      p[0] = 0.75 + 0.35 * f;
      p[1] = c.seed ?? c.x * 0.013;
      p[2] = this.reducedMotion ? 0.3 : 1;
      dp.emissive = CANDLE_LIGHT.flameBloom;
      dp.x = pt.x;
      dp.y = pt.y - fh / 2 + 6;
      dp.w = fh * 0.55;
      dp.h = fh * (0.9 + 0.15 * f);
      frame.sprite(this.flameMat, dp);
    }
    dp.emissive = 0;
  }

  destroy(): void {
    this.bodyMat.destroy();
    this.flameMat.destroy();
    this.glowMat.destroy();
  }
}
