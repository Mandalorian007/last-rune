/**
 * Gem rendering: faceted crystals lit from inside (see `shaders/gem-wgsl.ts`).
 *
 * Usage per frame:
 *   gems.light(lights);              // after the LightSet is built
 *   gems.drawUnder(frame, list);     // contact shadows + coloured light pools on the stone
 *   gems.drawGems(frame, list);      // the crystals
 * Batching: each call is one instanced draw, whatever the count.
 */
import type { DrawParams, Frame, Material, Renderer, RGBA } from '@thunderclap/engine/render';
import type { GemKind } from '../../rules/types';
import { GLOW_WGSL, SHADOW_WGSL } from '../../shaders/candle-wgsl';
import { GEM_WGSL } from '../../shaders/gem-wgsl';
import { LIGHT_HEIGHT, LIGHT_SET_FLOATS, type LightSet } from './lights';
import { GEM_INDEX, gemColor } from './palette';

export type GemState = 'idle' | 'hover' | 'placed' | 'energised' | 'dim';

const STATE_INDEX: Readonly<Record<GemState, number>> = {
  idle: 0,
  hover: 1,
  placed: 2,
  energised: 3,
  dim: 4,
};

/** One gem to draw. Keep these objects around and mutate them (no per-frame allocation). */
export interface GemInstance {
  kind: GemKind;
  x: number;
  y: number;
  /** Diameter in logical px. */
  size: number;
  state: GemState;
  /** Quarter turns clockwise (0..3, fractional allowed for animation). 0 = output north. */
  rot?: number;
  /** Glow multiplier on top of the state's default (1). */
  glow?: number;
  /** 0..1 hover lift (animate it). Lifts the gem, grows it slightly, spreads the shadow. */
  lift?: number;
  /** Stable per-gem seed (inclusions, sparkle). */
  seed?: number;
}

export const GEM_LIFT_PX = 16;

export class GemRenderer {
  readonly material: Material;
  private readonly shadowMat: Material;
  private readonly glowMat: Material;
  private readonly dp: DrawParams = { x: 0, y: 0, params: [0, 0, 0, 0] };
  private readonly tint: RGBA = [1, 1, 1, 1];

  constructor(renderer: Renderer) {
    this.material = renderer.createMaterial({
      label: 'gem',
      wgsl: GEM_WGSL,
      blend: 'alpha',
      uniformBytes: LIGHT_SET_FLOATS * 4,
    });
    this.shadowMat = renderer.createMaterial({
      label: 'gem-shadow',
      wgsl: SHADOW_WGSL,
      blend: 'alpha',
    });
    this.glowMat = renderer.createMaterial({
      label: 'gem-pool',
      wgsl: GLOW_WGSL,
      blend: 'additive',
    });
  }

  light(lights: LightSet): void {
    lights.apply(this.material);
  }

  /** Contact shadows, then coloured light pools, for every gem in `list`. */
  drawUnder(frame: Frame, list: readonly GemInstance[]): void {
    const dp = this.dp;
    const p = dp.params as number[];
    const tint = this.tint;
    dp.rotation = 0;
    dp.emissive = 0;
    dp.tint = tint;
    for (const g of list) {
      const lift = g.lift ?? 0;
      tint[0] = 0.003;
      tint[1] = 0.004;
      tint[2] = 0.008;
      tint[3] = 0.75 - 0.3 * lift;
      p[0] = 0.55 + 0.4 * lift;
      dp.x = g.x + 3 + 6 * lift;
      dp.y = g.y + g.size * 0.12 + 4 * lift;
      dp.w = g.size * (1.05 + 0.25 * lift);
      dp.h = g.size * (0.95 + 0.2 * lift);
      frame.sprite(this.shadowMat, dp);
    }
    p[0] = 3.6;
    p[1] = 1; // colour target only: light on stone, no bloom
    for (const g of list) {
      if (g.state === 'dim') continue;
      const c = gemColor(g.kind);
      const k = poolStrength(g) * 0.055;
      tint[0] = c[0] * k;
      tint[1] = c[1] * k;
      tint[2] = c[2] * k;
      tint[3] = 1;
      dp.x = g.x;
      dp.y = g.y + g.size * 0.08;
      dp.w = g.size * 2.6;
      dp.h = g.size * 2.3;
      frame.sprite(this.glowMat, dp);
    }
    p[1] = 0;
  }

  /** The crystals themselves. */
  drawGems(frame: Frame, list: readonly GemInstance[]): void {
    const dp = this.dp;
    const p = dp.params as number[];
    dp.rotation = 0;
    for (const g of list) {
      const lift = g.lift ?? (g.state === 'hover' ? 1 : 0);
      const s = g.size * (1 + 0.07 * lift);
      dp.x = g.x;
      dp.y = g.y - GEM_LIFT_PX * lift;
      dp.w = s;
      dp.h = s;
      dp.tint = gemColor(g.kind);
      p[0] = GEM_INDEX[g.kind];
      p[1] = STATE_INDEX[g.state];
      p[2] = ((g.rot ?? 0) * Math.PI) / 2;
      p[3] = g.seed ?? 0;
      dp.emissive = g.glow ?? 1;
      frame.sprite(this.material, dp);
    }
    dp.emissive = 0;
  }

  /** Convenience: shadow + pool + gem for a single gem (3 draw calls; prefer the batched pair). */
  draw(frame: Frame, g: GemInstance): void {
    single[0] = g;
    this.drawUnder(frame, single);
    this.drawGems(frame, single);
  }

  destroy(): void {
    this.material.destroy();
    this.shadowMat.destroy();
    this.glowMat.destroy();
  }
}

const single: GemInstance[] = [];

function poolStrength(g: GemInstance): number {
  const base =
    g.state === 'energised' ? 2.2 : g.state === 'hover' ? 1.5 : g.state === 'placed' ? 1 : 0.8;
  return base * (g.glow ?? 1);
}

/**
 * Add a gem's cool light to the light set (stone around it picks up its colour, other gems
 * glint with it). Light budget is 16: add energised gems first.
 */
export function addGemLight(lights: LightSet, g: GemInstance, intensity = 1): boolean {
  if (g.state === 'dim') return false;
  return lights.add(
    g.x,
    g.y,
    g.size * 3.2,
    gemColor(g.kind),
    0.55 * poolStrength(g) * intensity,
    LIGHT_HEIGHT.gem,
  );
}
