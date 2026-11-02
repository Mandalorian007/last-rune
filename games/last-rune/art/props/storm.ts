/**
 * Storm cell: brass-caged glass sphere of crackling plasma.
 *
 * ```ts
 * const storm = new StormCell(renderer, { x: 330, y: 420, size: 420, strength: 1 });
 * storm.strength = 2;      // 1 | 2 | 4 → 1/2/4 rings, more violent plasma (animates)
 * storm.surge();           // flash when a bolt leaves
 * storm.update(dt);
 * lights.add(storm.light.x, storm.light.y, 900, storm.light.color, storm.light.intensity);
 * storm.draw(frame, lights);  // records its sim pre-pass too
 * ```
 *
 * The plasma is a real (cheap) feedback fluid: a 256² rgba16float state advected each frame
 * by a swirling curl field (`shaders/storm-shaders.ts`), so it trails and curls instead of
 * looping like a sprite.
 */
import { flicker } from '@engine/fx';
import type {
  DrawParams,
  Frame,
  FullscreenPass,
  Material,
  PingPong,
  Renderer,
} from '@engine/render';
import {
  STORM_MATERIAL_WGSL,
  STORM_SIM_FLOATS,
  STORM_SIM_SIZE,
  STORM_SIM_WGSL,
  STORM_UNIFORM_FLOATS,
} from '../../shaders/storm-shaders';
import { PROP_LIGHT_FLOATS, type PropLightSource } from './lighting';
import { pitch } from './palette';

export type { StormStrength } from '../../rules/types';

import type { StormStrength } from '../../rules/types';

export interface StormOptions {
  x: number;
  y: number;
  /** Width of the drawn quad in logical px (the sphere is ~half of it). Default 400. */
  size?: number;
  strength?: StormStrength;
}

/** The sim clears to opaque black each step (its alpha channel is unused). */
const SIM_STEP = { clear: { r: 0, g: 0, b: 0, a: 1 } } as const;

export class StormCell {
  x: number;
  y: number;
  size: number;
  strength: StormStrength;
  /** 0..1 master brightness (dim it in menus). */
  intensity = 1;
  /**
   * Photosensitivity (settings `reduceFlashes`): surges are a third as bright and the light it
   * casts on the room barely flickers.
   */
  reduceFlashes = false;
  /** Cool light emitted by the cell (add to your scene lights). */
  readonly light = { x: 0, y: 0, intensity: 1, color: pitch('cyan') };

  private time = Math.random() * 10;
  private rings = 1;
  private surgeK = 0;
  private readonly seed = Math.random() * 50;
  private readonly flickerLive = { seed: this.seed, speed: 13, amount: 0.35 };
  private readonly flickerCalm = { seed: this.seed, speed: 4, amount: 0.08 };
  /** The fluid state: each frame's sim step reads one target and writes the other. */
  private readonly state: PingPong;
  private readonly sim: FullscreenPass;
  private readonly simU = new Float32Array(STORM_SIM_FLOATS);
  private readonly material: Material;
  private readonly u = new Float32Array(STORM_UNIFORM_FLOATS);
  private readonly dp: DrawParams = { x: 0, y: 0, tint: [1, 1, 1, 1], emissive: 1.3 };
  private simDt = 0;
  private readonly runSim = (encoder: GPUCommandEncoder): void => {
    const s = this.simU;
    s[0] = this.time;
    s[1] = Math.min(this.simDt, 1 / 20);
    s[2] = this.rings;
    s[3] = this.seed;
    s[4] = this.surgeK;
    this.simDt = 0;
    this.sim.setUniforms(s);
    this.state.step(encoder, this.sim, SIM_STEP);
    this.material.setTexture(0, this.state.read);
  };

  constructor(renderer: Renderer, opts: StormOptions) {
    this.x = opts.x;
    this.y = opts.y;
    this.size = opts.size ?? 400;
    this.strength = opts.strength ?? 1;
    this.rings = this.strength;
    this.state = renderer.createPingPong({
      width: STORM_SIM_SIZE,
      height: STORM_SIM_SIZE,
      label: 'storm-sim',
    });
    this.sim = renderer.createFullscreenPass({
      label: 'storm-sim',
      wgsl: STORM_SIM_WGSL,
      targets: ['rgba16float'],
      uniformBytes: STORM_SIM_FLOATS * 4,
      textures: 1,
      sampler: 'linear-clamp',
    });
    this.material = renderer.createMaterial({
      label: 'storm-cell',
      wgsl: STORM_MATERIAL_WGSL,
      blend: 'premultiplied',
      uniformBytes: STORM_UNIFORM_FLOATS * 4,
      textures: 1,
      sampler: 'linear-clamp',
    });
    this.material.setTexture(0, this.state.read);
  }

  /** A bolt just left the cell: flood it with light for a moment. */
  surge(amount = 1): void {
    this.surgeK = Math.max(this.surgeK, this.reduceFlashes ? amount * 0.3 : amount);
  }

  /** Where a bolt should start (the top of the sphere, logical px). */
  get boltOrigin(): { x: number; y: number } {
    return { x: this.x, y: this.y - (0.12 / 2.5) * this.size };
  }

  /** Sphere centre and radius in logical px. */
  get sphere(): { x: number; y: number; r: number } {
    return { x: this.x, y: this.y - (0.12 / 2.5) * this.size, r: (0.6 / 2.5) * this.size };
  }

  update(dt: number): void {
    this.time += dt;
    this.simDt += dt;
    this.rings += (this.strength - this.rings) * (1 - Math.exp(-3 * dt));
    this.surgeK *= Math.exp(-3.5 * dt);
    const f = flicker(this.time, this.reduceFlashes ? this.flickerCalm : this.flickerLive);
    const sph = this.sphere;
    this.light.x = sph.x;
    this.light.y = sph.y;
    this.light.intensity = this.intensity * (0.6 + 0.25 * this.rings) * f * (1 + this.surgeK * 2);
  }

  draw(frame: Frame, lights: PropLightSource): void {
    frame.prePass(this.runSim);
    const u = this.u;
    u.set(lights.data, 0);
    const o = PROP_LIGHT_FLOATS;
    u[o] = this.time;
    u[o + 1] = this.rings;
    u[o + 2] = this.intensity * (0.75 + 0.06 * this.rings);
    u[o + 3] = this.seed;
    u[o + 4] = this.surgeK;
    this.material.setUniforms(u);
    const dp = this.dp;
    dp.x = this.x;
    dp.y = this.y;
    dp.w = this.size;
    dp.h = this.size;
    frame.sprite(this.material, dp);
  }

  destroy(): void {
    this.state.destroy();
    this.sim.destroy();
    this.material.destroy();
  }
}
