/**
 * Hall alcove / locked door: arched stone niche, iron grate + padlock, socket plate showing what
 * is missing.
 *
 * ```ts
 * const a = new Alcove(renderer, { x: 1040, y: 230, size: 300 });
 * a.setNeeds(missingFor(machine, progress));  // C3 capabilities → dotted sockets in their colours
 * a.unlock();      // lock shakes and drops, grate rises, sockets fill (≈1.6 s)
 * a.restore();     // machine inside solved: warm gold glow, keystone rune lights
 * a.lock();        // back to locked (snaps)
 * a.update(dt); a.draw(frame, lights);
 * ```
 * Alcoves share one material per renderer: draw them consecutively for a single draw call.
 */
import type { DrawParams, Frame, Material, Renderer } from '@thunderclap/engine/render';
import type { Capability } from '../../rules/types';
import { ALCOVE_MATERIAL_WGSL, ALCOVE_UNIFORM_FLOATS } from '../../shaders/alcove-shaders';
import { PROP_LIGHT_FLOATS, type PropLightSource } from './lighting';
import { GEM_COLOUR, GEM_ORDER, pitch } from './palette';

/** Socket kinds: 0..5 gem colours in GEM_ORDER, 6 storm, 7 altar. */
export type SocketKind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Capability → socket kind. */
export function socketKindOf(c: Capability): SocketKind {
  if (c.type === 'gem') return GEM_ORDER.indexOf(GEM_COLOUR[c.gem]) as SocketKind;
  return c.type === 'storm' ? 6 : 7;
}

export interface AlcoveOptions {
  x: number;
  y: number;
  /** Quad size in logical px. Default 300. */
  size?: number;
}

interface Shared {
  material: Material;
  u: Float32Array<ArrayBuffer>;
}
const shared = new WeakMap<Renderer, Shared>();

export class Alcove {
  x: number;
  y: number;
  size: number;
  opacity = 1;
  /** Warm light from inside once open/restored (add to scene lights). */
  readonly light = { x: 0, y: 0, intensity: 0, color: pitch('warm') };

  private state = 0;
  private target = 0;
  private kinds: SocketKind[] = [];
  private time = Math.random() * 10;
  private readonly seed = Math.random() * 20;
  private readonly sh: Shared;
  private readonly params = new Float32Array(4);
  private readonly tint = new Float32Array([1, 1, 1, 1]);
  private readonly dp: DrawParams = { x: 0, y: 0, emissive: 1 };

  constructor(renderer: Renderer, opts: AlcoveOptions) {
    this.x = opts.x;
    this.y = opts.y;
    this.size = opts.size ?? 300;
    let s = shared.get(renderer);
    if (!s) {
      s = {
        material: renderer.createMaterial({
          label: 'alcove',
          wgsl: ALCOVE_MATERIAL_WGSL,
          blend: 'premultiplied',
          uniformBytes: ALCOVE_UNIFORM_FLOATS * 4,
        }),
        u: new Float32Array(ALCOVE_UNIFORM_FLOATS),
      };
      shared.set(renderer, s);
    }
    this.sh = s;
    this.dp.params = this.params;
    this.dp.tint = this.tint;
  }

  /** Show these missing capabilities as sockets (max 4; extra are dropped). */
  setNeeds(needs: readonly Capability[]): void {
    this.kinds = needs.slice(0, 4).map(socketKindOf);
  }

  /** Show raw socket kinds (0..5 gems in GEM_ORDER, 6 storm, 7 altar). */
  setSockets(kinds: readonly SocketKind[]): void {
    this.kinds = kinds.slice(0, 4);
  }

  lock(): void {
    this.state = 0;
    this.target = 0;
  }
  unlock(): void {
    this.target = Math.max(this.target, 1);
  }
  restore(): void {
    this.target = 2;
  }
  /** Snap to a state without animating (0 locked, 1 open, 2 restored). */
  set(state: 0 | 1 | 2): void {
    this.state = state;
    this.target = state;
  }
  get unlocking(): boolean {
    return this.state !== this.target;
  }

  update(dt: number): void {
    this.time += dt;
    // Unlock plays linearly (it's a little sequence), restore eases.
    const rate = this.state < 1 ? 1 / 1.6 : 1 / 1.2;
    if (this.state < this.target) this.state = Math.min(this.target, this.state + rate * dt);
    else if (this.state > this.target) this.state = this.target;
    const k = this.size / 2;
    this.light.x = this.x;
    this.light.y = this.y + 0.1 * k;
    this.light.intensity = Math.min(this.state, 1) * 0.35 + Math.max(this.state - 1, 0) * 0.65;
  }

  draw(frame: Frame, lights: PropLightSource): void {
    const s = this.sh;
    s.u.set(lights.data, 0);
    s.u[PROP_LIGHT_FLOATS] = this.time;
    s.material.setUniforms(s.u);
    let packed = 0;
    for (let i = 0; i < this.kinds.length; i++) packed += this.kinds[i]! * 8 ** i;
    this.params[0] = this.state;
    this.params[1] = this.kinds.length;
    this.params[2] = packed;
    this.params[3] = this.seed;
    this.tint[3] = this.opacity;
    const dp = this.dp;
    dp.x = this.x;
    dp.y = this.y;
    dp.w = this.size;
    dp.h = this.size;
    frame.sprite(s.material, dp);
  }
}
