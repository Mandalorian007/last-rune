/**
 * Machine: riveted iron box with a real gauge.
 *
 * ```ts
 * const m = new Machine(renderer, { x: 1560, y: 560, size: 360 });
 * m.gauge = 0.62;          // fraction of the target delivered (needle springs there)
 * m.solve();               // pins at 100 %, wakes (blazes cyan)
 * m.breaker();             // slams past 100 % into the red, blinks, drops back to 0
 * m.reset();               // dead, needle at 0
 * m.update(dt); m.draw(frame, lights);
 * m.terminal               // {x, y}: where the bolt should land
 * m.light                  // cyan glow while awake (add to scene lights)
 * ```
 * Machines share one material per renderer (state rides in per-instance params), so draw them
 * consecutively with the same light rig to keep it one draw call.
 */
import { flicker } from '@engine/fx';
import type { DrawParams, Frame, Material, Renderer } from '@engine/render';
import {
  MACHINE_GAUGE_MAX,
  MACHINE_MATERIAL_WGSL,
  MACHINE_UNIFORM_FLOATS,
} from '../../shaders/machine-shaders';
import { PROP_LIGHT_FLOATS, type PropLightSource } from './lighting';
import { pitch } from './palette';

export interface MachineOptions {
  x: number;
  y: number;
  /** Width of the drawn quad in logical px. Default 360. */
  size?: number;
  awake?: boolean;
}

interface Shared {
  material: Material;
  u: Float32Array<ArrayBuffer>;
}
const shared = new WeakMap<Renderer, Shared>();
/** Preconverted light colours (update() swaps between them without allocating). */
const LIGHT_AWAKE = pitch('cyan');
const LIGHT_BREAKER = pitch('magenta');

export class Machine {
  x: number;
  y: number;
  size: number;
  /** Target gauge reading 0..1.25 (1 = exactly the machine's need). The needle springs to it. */
  gauge = 0;
  /** Wake target (0 dead .. 1 awake); `awakeK` eases toward it. */
  awake: boolean;
  opacity = 1;
  /** Cool light while awake / red on breaker. */
  readonly light = { x: 0, y: 0, intensity: 0, color: pitch('cyan') };

  private needle = 0;
  private vel = 0;
  private awakeK = 0;
  private breakerK = 0;
  private breakerT = -1;
  private pinned = false;
  private time = Math.random() * 10;
  private readonly seed = Math.random() * 20;
  private readonly sh: Shared;
  private readonly dp: DrawParams = {
    x: 0,
    y: 0,
    tint: [1, 1, 1, 1],
    params: [0, 0, 0, 0],
    emissive: 1.2,
  };
  private readonly params = new Float32Array(4);
  private readonly tint = new Float32Array([1, 1, 1, 1]);

  constructor(renderer: Renderer, opts: MachineOptions) {
    this.x = opts.x;
    this.y = opts.y;
    this.size = opts.size ?? 360;
    this.awake = opts.awake ?? false;
    this.awakeK = this.awake ? 1 : 0;
    let s = shared.get(renderer);
    if (!s) {
      s = {
        material: renderer.createMaterial({
          label: 'machine',
          wgsl: MACHINE_MATERIAL_WGSL,
          blend: 'premultiplied',
          uniformBytes: MACHINE_UNIFORM_FLOATS * 4,
        }),
        u: new Float32Array(MACHINE_UNIFORM_FLOATS),
      };
      shared.set(renderer, s);
    }
    this.sh = s;
    this.dp.params = this.params;
    this.dp.tint = this.tint;
  }

  /** Where the bolt lands (the brass terminal on the left), logical px. */
  get terminal(): { x: number; y: number } {
    const k = this.size / 2;
    return { x: this.x - 0.96 * k, y: this.y - 0.18 * k };
  }

  /** Current needle reading (0..1.25). */
  get reading(): number {
    return this.needle;
  }

  /** Exact charge: needle pins at 100 % and the machine wakes. */
  solve(): void {
    this.gauge = 1;
    this.pinned = true;
    this.awake = true;
  }

  /** Over-charge: needle slams into the red, lamp blinks, then everything drops dead. */
  breaker(): void {
    this.gauge = MACHINE_GAUGE_MAX;
    this.vel += 6;
    this.breakerT = 0;
    this.pinned = false;
    this.awake = false;
  }

  reset(): void {
    this.gauge = 0;
    this.pinned = false;
    this.awake = false;
    this.breakerT = -1;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.breakerT >= 0) {
      this.breakerT += dt;
      this.breakerK = this.breakerT < 1.6 ? 1 : Math.max(0, 1 - (this.breakerT - 1.6) * 2);
      if (this.breakerT > 1.1) this.gauge = 0;
      if (this.breakerT > 2.2) this.breakerT = -1;
    } else {
      this.breakerK = 0;
    }
    // Underdamped spring: overshoots a little, like a real movement.
    const target = Math.min(this.gauge, MACHINE_GAUGE_MAX);
    const k = 70;
    const c = 7;
    this.vel += ((target - this.needle) * k - this.vel * c) * dt;
    this.needle += this.vel * dt;
    // The case stops: it can't go below 0 or past the red pin.
    if (this.needle < 0) {
      this.needle = 0;
      this.vel = Math.abs(this.vel) * 0.3;
    }
    if (this.needle > MACHINE_GAUGE_MAX) {
      this.needle = MACHINE_GAUGE_MAX;
      this.vel = -Math.abs(this.vel) * 0.4;
    }
    this.awakeK +=
      ((this.awake ? 1 : 0) - this.awakeK) * (1 - Math.exp(-(this.awake ? 2.5 : 4) * dt));
    const f = flicker(this.time, { seed: this.seed, speed: 6, amount: 0.15 });
    this.light.x = this.x;
    this.light.y = this.y;
    this.light.color = this.breakerK > 0.5 ? LIGHT_BREAKER : LIGHT_AWAKE;
    this.light.intensity = Math.max(this.awakeK * f, this.breakerK * 0.6);
  }

  draw(frame: Frame, lights: PropLightSource): void {
    const s = this.sh;
    // Upload shared uniforms once per frame (time + the caller's lights).
    const u = s.u;
    u.set(lights.data, 0);
    u[PROP_LIGHT_FLOATS] = this.time;
    s.material.setUniforms(u);
    // Pinned needle trembles against the stop; awake hum.
    const tremble =
      this.pinned && Math.abs(this.needle - 1) < 0.05 ? Math.sin(this.time * 47) * 0.004 : 0;
    this.params[0] = this.needle + tremble;
    this.params[1] = this.awakeK;
    this.params[2] = this.breakerK;
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
