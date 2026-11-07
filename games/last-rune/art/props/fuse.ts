/**
 * FUSE rig: state machine + animation for the SDF foreman (`shaders/fuse-shaders.ts`).
 *
 * ```ts
 * const fuse = new Fuse(renderer, { x: 700, y: 980, scale: 150 });
 * fuse.mood = 'talk';            // 'idle' | 'talk' | 'quiet' (Tier 3)
 * fuse.lookAt(960, 540);         // or fuse.lookAt(null) to look at the player
 * fuse.rollTo(1200);             // roll in/out; fuse.rollTo(-300) to leave stage left
 * fuse.update(dt);               // fixed step
 * lights.add(fuse.eye.x, fuse.eye.y, 420, fuse.eye.color, fuse.eye.intensity); // his eye is a light
 * fuse.draw(frame, lights);
 * ```
 */
import { flicker, valueNoise1 } from '@thunderclap-engine/engine/fx';
import type { DrawParams, Frame, Material, Renderer } from '@thunderclap-engine/engine/render';
import { FUSE_MATERIAL_WGSL, FUSE_UNIFORM_FLOATS } from '../../shaders/fuse-shaders';
import { PROP_LIGHT_FLOATS, type PropLightSource } from './lighting';
import { prop } from './palette';

export type FuseMood = 'idle' | 'talk' | 'quiet';

export interface FuseOptions {
  /** Floor point under his centre (logical px). */
  x: number;
  y: number;
  /** Logical px per FUSE unit (he is ~2.2 units tall). Default 150. */
  scale?: number;
  /** 1 faces right-ish (default), -1 mirrored. */
  facing?: 1 | -1;
}

/** Joint constants mirrored from the shader. */
const HEAD_PIVOT_Y = 1.24;
const EYE_X = 0.205;
const EYE_Y = 1.57;

/** Default top rolling speed, FUSE units per second. */
export const DEFAULT_FUSE_SPEED = 9;

function approach(v: number, target: number, rate: number, dt: number): number {
  return v + (target - v) * (1 - Math.exp(-rate * dt));
}

/** The animated state that the shader reads (also used by the portrait). */
export interface FuseRigState {
  time: number;
  bob: number;
  tilt: number;
  lean: number;
  lookX: number;
  lookY: number;
  eyeGlow: number;
  lid: number;
  talk: number;
  quiet: number;
  wheel: number;
  swing: number;
  facing: number;
  raise: number;
  deadSpark: number;
}

export function writeFuseState(s: FuseRigState, out: Float32Array, o: number, portrait = 0): void {
  out[o] = s.time;
  out[o + 1] = s.bob;
  out[o + 2] = s.tilt;
  out[o + 3] = s.lean;
  out[o + 4] = s.lookX;
  out[o + 5] = s.lookY;
  out[o + 6] = s.eyeGlow;
  out[o + 7] = s.lid;
  out[o + 8] = s.talk;
  out[o + 9] = s.quiet;
  out[o + 10] = s.wheel;
  out[o + 11] = s.swing;
  out[o + 12] = s.facing;
  out[o + 13] = portrait;
  out[o + 14] = s.raise;
  out[o + 15] = s.deadSpark;
}

export class Fuse {
  x: number;
  y: number;
  scale: number;
  facing: 1 | -1;
  mood: FuseMood = 'idle';
  /** 0..1 global fade (e.g. walking through the door). */
  opacity = 1;
  /** False once he has dropped the clipboard (the ending). */
  clipboard = true;
  /** Top rolling speed in FUSE units per second (`DEFAULT_FUSE_SPEED`; lower for a stroll). */
  maxSpeed = DEFAULT_FUSE_SPEED;
  /** Seconds left of an automatic talk burst (see `speak`). */
  private talkTimer = 0;

  readonly state: FuseRigState = {
    time: 0,
    bob: 0,
    tilt: 0,
    lean: 0,
    lookX: 0,
    lookY: 0,
    eyeGlow: 1,
    lid: 0.1,
    talk: 0,
    quiet: 0,
    wheel: 0,
    swing: 0,
    facing: 1,
    raise: 0,
    deadSpark: 1,
  };

  /** Where his live eye is, and how bright: add it to your scene's lights. */
  readonly eye = { x: 0, y: 0, intensity: 1, color: prop('eye') };

  private readonly material: Material;
  private readonly uniforms = new Float32Array(FUSE_UNIFORM_FLOATS);
  private readonly dp: DrawParams = {
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    tint: [1, 1, 1, 1],
    emissive: 1.4,
    params: [0, 0, 0, 0],
  };
  private targetX: number;
  private vx = 0;
  private readonly look = { x: 0, y: 0 };
  private lookTarget: { x: number; y: number } | null = null;
  private blinkIn = 2.5;
  private blinkT = -1;
  private seed = Math.random() * 100;

  constructor(renderer: Renderer, opts: FuseOptions) {
    this.x = opts.x;
    this.y = opts.y;
    this.targetX = opts.x;
    this.scale = opts.scale ?? 150;
    this.facing = opts.facing ?? 1;
    this.material = renderer.createMaterial({
      label: 'fuse',
      wgsl: FUSE_MATERIAL_WGSL,
      blend: 'premultiplied',
      uniformBytes: FUSE_UNIFORM_FLOATS * 4,
    });
  }

  /** Free GPU resources (the material's uniform buffer). Don't draw the Fuse afterwards. */
  destroy(): void {
    this.material.destroy();
  }

  /** Look at a logical point, or `null` to look out at the player. */
  lookAt(x: number | null, y?: number): void {
    if (x === null) this.lookTarget = null;
    else {
      this.look.x = x;
      this.look.y = y ?? this.y - 2 * this.scale;
      this.lookTarget = this.look;
    }
  }

  /** Roll to a floor x (logical px). Use an off-screen x to roll in/out. */
  rollTo(x: number): void {
    this.targetX = x;
  }

  /** Jump without rolling. */
  place(x: number, y = this.y): void {
    this.x = x;
    this.targetX = x;
    this.y = y;
    this.vx = 0;
  }

  get rolling(): boolean {
    return Math.abs(this.targetX - this.x) > 1 || Math.abs(this.vx) > 5;
  }

  /** Talk for `seconds` (caption length), then fall back to the current mood. */
  speak(seconds: number): void {
    this.talkTimer = seconds;
  }

  update(dt: number): void {
    const s = this.state;
    s.time += dt;
    const t = s.time;

    // Rolling: critically-damped-ish spring on x, speed-capped.
    const dx = this.targetX - this.x;
    const maxV = this.maxSpeed * this.scale;
    const desired = Math.max(-maxV, Math.min(maxV, dx * 3.2));
    const prevV = this.vx;
    this.vx = approach(this.vx, desired, 5, dt);
    this.x += this.vx * dt;
    const accel = (this.vx - prevV) / Math.max(dt, 1e-4);
    s.wheel -= (this.vx * dt) / (0.095 * this.scale);
    const leanTarget =
      (this.vx / (DEFAULT_FUSE_SPEED * this.scale)) * 0.12 +
      (accel / (60 * this.scale)) * 0.06 * this.facing;
    s.lean = approach(s.lean, leanTarget * this.facing, 8, dt);

    // Mood blend.
    if (this.talkTimer > 0) this.talkTimer -= dt;
    const talking = this.mood === 'talk' || this.talkTimer > 0;
    s.talk = approach(s.talk, talking ? 1 : 0, 10, dt);
    s.quiet = approach(s.quiet, this.mood === 'quiet' ? 1 : 0, 2.5, dt);

    // Idle hum: bob + head sway; talking adds bounce; quiet is still.
    const still = 1 - s.quiet * 0.75;
    s.bob =
      (Math.sin(t * 2.1) * 0.012 + Math.sin(t * 13) * 0.002) * still +
      s.talk * Math.abs(Math.sin(t * 7.3)) * 0.018;
    let tilt = (valueNoise1(t * 0.35, this.seed) - 0.5) * 0.08 * still;
    tilt += s.talk * Math.sin(t * 3.7) * 0.05;
    tilt -= s.quiet * 0.09;

    // Look-at: eye offset + head tilt toward the target.
    let lx = 0;
    let ly = 0;
    if (this.lookTarget) {
      const ex = this.eye.x;
      const ey = this.eye.y;
      const vx = (this.lookTarget.x - ex) * this.facing;
      const vy = -(this.lookTarget.y - ey);
      const len = Math.hypot(vx, vy);
      const k = Math.min(1, len / (3 * this.scale));
      if (len > 1e-3) {
        lx = (vx / len) * k;
        ly = (vy / len) * k;
      }
      tilt += -lx * 0.08 + ly * 0.04;
    } else {
      lx = (valueNoise1(t * 0.5, this.seed + 3) - 0.5) * 0.3;
      ly = (valueNoise1(t * 0.43, this.seed + 7) - 0.5) * 0.2;
    }
    s.lookX = approach(s.lookX, lx, 9, dt);
    s.lookY = approach(s.lookY, ly - s.quiet * 0.45, 9, dt);
    s.tilt = approach(s.tilt, tilt, 6, dt);

    // Blinks (the lid also rests half-closed when quiet).
    this.blinkIn -= dt;
    if (this.blinkIn <= 0 && this.blinkT < 0) {
      this.blinkT = 0;
      this.blinkIn = 2.5 + Math.random() * 4;
    }
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const bt = this.blinkT / 0.16;
      blink = bt < 1 ? Math.sin(bt * Math.PI) : 0;
      if (bt >= 1) this.blinkT = -1;
    }
    const lidRest = 0.12 + s.quiet * 0.38 - s.talk * 0.06;
    s.lid = Math.min(1, lidRest + blink * (1 - lidRest));

    // Eye: steady warm hum with a little brownout flicker; quiet dims it.
    const f = flicker(t, { seed: this.seed, speed: 5, amount: 0.12 });
    s.eyeGlow = (1.15 * f + s.talk * 0.25) * (1 - s.quiet * 0.35);
    s.deadSpark = 1 - s.quiet;

    // Arms: clamp gestures while talking, clipboard raised to read from.
    s.swing = approach(s.swing, s.talk * Math.sin(t * 4.1) * 0.35, 6, dt);
    s.raise = approach(s.raise, s.talk * 0.5 - s.quiet * 0.6, 3, dt);
    s.facing = this.facing;

    // Eye position in logical px (mirrors the shader's head transform).
    const drop = s.quiet * 0.04;
    const c = Math.cos(-s.tilt);
    const sn = Math.sin(-s.tilt);
    const ex0 = EYE_X;
    const ey0 = EYE_Y - HEAD_PIVOT_Y;
    const exL = ex0 * c - ey0 * sn;
    const eyL = ex0 * sn + ey0 * c + HEAD_PIVOT_Y - drop + s.bob;
    this.eye.x = this.x + exL * this.facing * this.scale;
    this.eye.y = this.y - eyL * this.scale;
    this.eye.intensity = s.eyeGlow * (1 - s.lid * 0.7) * this.opacity;
  }

  draw(frame: Frame, lights: PropLightSource): void {
    const u = this.uniforms;
    u.set(lights.data, 0);
    writeFuseState(this.state, u, PROP_LIGHT_FLOATS);
    this.material.setUniforms(u);
    const dp = this.dp;
    dp.x = this.x;
    dp.y = this.y - 1.13 * this.scale;
    dp.w = 2.2 * this.scale;
    dp.h = 2.5 * this.scale;
    (dp.tint as number[])[3] = this.opacity;
    (dp.params as number[])[0] = this.clipboard ? 0 : 1;
    frame.sprite(this.material, dp);
  }
}
