/**
 * Bolt ribbon: a crackling lightning ribbon along a polyline that travels from node to node,
 * taking each segment's colour and thickening with charge.
 *
 * ```ts
 * const bolt = new BoltRibbon(renderer, { particles });           // particles optional (sparks)
 * // From a sim trace (C2 SimResult.trace), with your altar's cell → px mapping:
 * bolt.play(boltSegmentsFromTrace(result.trace, cellToPx), result.outcome); // 'exact'|'over'|'under'
 * // ...or from any polyline:
 * bolt.play(boltSegmentsFromPolyline(points, { colours, charges, speed: 1400 }), 'exact');
 * bolt.update(dt);           // fixed step; emits sparks
 * bolt.draw(frame);
 * bolt.flash();              // solve flash (exact)
 * bolt.head                  // {x, y, colour} while travelling: add as a light
 * bolt.done                  // finished (incl. over/under tails); bolt.clear() to remove
 * ```
 */
import type { ParticleSystem } from '@engine/fx';
import type { DrawParams, Frame, Material, Renderer, RGBA } from '@engine/render';
import type { Cell, GemKind } from '../../rules/types';
import { BOLT_MATERIAL_WGSL, BOLT_UNIFORM_FLOATS } from '../../shaders/bolt-shaders';
import { GEM_COLOUR, pitch } from './palette';

export type BoltMode = 'exact' | 'over' | 'under';

/** One drawn segment in logical px; times in seconds from `play()`. */
export interface BoltSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Linear RGB(A). */
  colour: ArrayLike<number>;
  /** 1 = a single storm's worth. Drives width/brightness. */
  charge: number;
  t0: number;
  t1: number;
}

/** Structural copy of a C2 trace segment (rules owns the real type). */
export interface TraceSegmentLike {
  from: Cell;
  to: Cell;
  charge: number;
  colour: GemKind;
  pulse?: number;
  t0: number;
  t1: number;
}

export interface TraceOptions {
  /** Seconds per trace time unit. Default 0.14. */
  timeScale?: number;
}

/** Convert a sim render trace to drawable segments. `cellToPx` maps a cell to its socket centre. */
export function boltSegmentsFromTrace(
  trace: readonly TraceSegmentLike[],
  cellToPx: (c: Cell) => { x: number; y: number },
  opts: TraceOptions = {},
): BoltSegment[] {
  const ts = opts.timeScale ?? 0.14;
  return trace.map((s) => {
    const a = cellToPx(s.from);
    const b = cellToPx(s.to);
    return {
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      colour: pitch(GEM_COLOUR[s.colour], 1.6),
      charge: s.charge,
      t0: s.t0 * ts,
      t1: s.t1 * ts,
    };
  });
}

export interface PolylineOptions {
  /** One colour per segment (or one for all). Linear RGB(A). Default cyan. */
  colours?: ArrayLike<number> | readonly ArrayLike<number>[];
  /** One charge per segment (or one for all). Default 1. */
  charges?: number | readonly number[];
  /** Travel speed in px/s. Default 1400. */
  speed?: number;
  /** Start delay (s). Default 0. */
  delay?: number;
}

/** Segments for a polyline travelled at constant speed. */
export function boltSegmentsFromPolyline(
  points: readonly { x: number; y: number }[],
  opts: PolylineOptions = {},
): BoltSegment[] {
  const speed = opts.speed ?? 1400;
  const cols = opts.colours ?? pitch('cyan', 1.6);
  const out: BoltSegment[] = [];
  let t = opts.delay ?? 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const colour = Array.isArray(cols)
      ? ((cols as readonly ArrayLike<number>[])[i] ?? (cols as readonly ArrayLike<number>[])[0]!)
      : (cols as ArrayLike<number>);
    const ch = opts.charges;
    const charge = typeof ch === 'number' ? ch : (ch?.[i] ?? 1);
    out.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, colour, charge, t0: t, t1: t + len / speed });
    t += len / speed;
  }
  return out;
}

export interface BoltOptions {
  /** Sparks go here when given (head trail, node bursts, breaker blowout). */
  particles?: ParticleSystem;
  /** Core width in px at charge 1. Default 14. */
  width?: number;
  /** Sideways crackle in px at charge 1. Default 12. */
  jitter?: number;
}

const MODE_ID: Record<BoltMode, number> = { exact: 0, over: 1, under: 2 };
const WHITE: RGBA = [3, 3, 3.2, 1];

interface Seg extends BoltSegment {
  len: number;
  arc0: number;
  passed: boolean;
}

export class BoltRibbon {
  /** Master brightness. */
  intensity = 1;
  readonly particles?: ParticleSystem;
  mode: BoltMode = 'exact';
  /** Seconds since play(). */
  time = 0;
  /** Travelling head (null once the bolt has arrived or before play). */
  head: { x: number; y: number; colour: ArrayLike<number> } | null = null;
  /** Where the bolt ended (for the breaker / fizzle effects and lights). */
  readonly end = { x: 0, y: 0 };
  /** 0..1, how bright the whole ribbon is right now (for scene lights). */
  glow = 0;

  private segs: Seg[] = [];
  private tEnd = 0;
  private flashK = 0;
  private fade = 1;
  private fadeRate = 0;
  private tailDone = false;
  private endFired = false;
  private readonly width: number;
  private readonly jitter: number;
  private readonly seed = Math.random() * 100;
  private readonly material: Material;
  private readonly u = new Float32Array(BOLT_UNIFORM_FLOATS);
  private readonly dp: DrawParams = { x: 0, y: 0, tint: [1, 1, 1, 1], params: [0, 0, 0, 0] };
  private readonly params = new Float32Array(4);
  private readonly tint = new Float32Array(4);

  constructor(renderer: Renderer, opts: BoltOptions = {}) {
    this.particles = opts.particles;
    this.width = opts.width ?? 14;
    this.jitter = opts.jitter ?? 12;
    this.material = renderer.createMaterial({
      label: 'bolt-ribbon',
      wgsl: BOLT_MATERIAL_WGSL,
      blend: 'additive',
      uniformBytes: BOLT_UNIFORM_FLOATS * 4,
    });
    this.dp.params = this.params;
    this.dp.tint = this.tint;
  }

  /** Start a new bolt. */
  play(segments: readonly BoltSegment[], mode: BoltMode = 'exact'): void {
    let arc = 0;
    this.segs = segments.map((s) => {
      const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
      const seg: Seg = { ...s, len, arc0: arc, passed: false };
      arc += len;
      return seg;
    });
    this.tEnd = segments.reduce((m, s) => Math.max(m, s.t1), 0);
    const last = segments[segments.length - 1];
    this.end.x = last?.bx ?? 0;
    this.end.y = last?.by ?? 0;
    this.mode = mode;
    this.time = 0;
    this.flashK = 0;
    this.fade = 1;
    this.fadeRate = 0;
    this.tailDone = false;
    this.endFired = false;
  }

  /** Solve flash: blazes the whole ribbon white-hot for a moment. */
  flash(amount = 1): void {
    this.flashK = Math.max(this.flashK, amount);
  }

  /** Fade the ribbon out over `seconds` (e.g. leaving the puzzle). */
  fadeOut(seconds = 0.6): void {
    this.fadeRate = 1 / Math.max(seconds, 1e-3);
  }

  clear(): void {
    this.segs = [];
    this.head = null;
    this.glow = 0;
  }

  /** Has arrived and its mode tail is over (over: sputtered out, under: fizzled). */
  get done(): boolean {
    return this.segs.length === 0 || this.tailDone;
  }

  /** Total travel time in seconds. */
  get duration(): number {
    return this.tEnd;
  }

  update(dt: number): void {
    if (this.segs.length === 0) return;
    this.time += dt;
    this.flashK *= Math.exp(-2.5 * dt);
    this.fade = Math.max(0, this.fade - this.fadeRate * dt);
    const T = this.time;
    const after = T - this.tEnd;
    const ps = this.particles;
    this.head = null;
    for (const s of this.segs) {
      if (T >= s.t0 && T < s.t1) {
        const u = (T - s.t0) / Math.max(s.t1 - s.t0, 1e-4);
        this.head = { x: s.ax + (s.bx - s.ax) * u, y: s.ay + (s.by - s.ay) * u, colour: s.colour };
      }
      if (!s.passed && T >= s.t1) {
        s.passed = true;
        ps?.emit(
          {
            x: s.bx,
            y: s.by,
            speed: [80, 320],
            life: [0.25, 0.6],
            size: [5, 1],
            colorStart: s.colour,
            gravity: [0, 500],
            emissive: 1.5,
          },
          this.mode === 'under' ? 4 : Math.round(10 + 6 * Math.min(s.charge, 4)),
        );
      }
    }
    if (this.head && ps && Math.random() < dt * 40) {
      ps.emit(
        {
          x: this.head.x,
          y: this.head.y,
          speed: [40, 200],
          life: [0.15, 0.4],
          size: [4, 1],
          colorStart: this.head.colour,
          gravity: [0, 300],
        },
        3,
      );
    }
    if (after >= 0 && !this.endFired) {
      this.endFired = true;
      if (this.mode === 'over') {
        ps?.emit(
          {
            x: this.end.x,
            y: this.end.y,
            speed: [250, 900],
            life: [0.4, 1.1],
            size: [9, 1],
            colorStart: WHITE,
            colorEnd: [2.5, 0.6, 0.15, 0],
            gravity: [0, 700],
            emissive: 2,
          },
          140,
        );
      } else if (this.mode === 'under') {
        ps?.emit(
          {
            x: this.end.x,
            y: this.end.y,
            speed: [20, 90],
            life: [0.4, 0.9],
            size: [4, 0.5],
            colorStart: this.segs[this.segs.length - 1]!.colour,
            gravity: [0, 200],
            emissive: 0.6,
          },
          10,
        );
      }
    }
    // Breaker sputter: stray sparks from random points along the dying circuit.
    if (this.mode === 'over' && after > 0.4 && after < 2.2 && ps && Math.random() < dt * 14) {
      const s = this.segs[Math.floor(Math.random() * this.segs.length)]!;
      const u = Math.random();
      ps.emit(
        {
          x: s.ax + (s.bx - s.ax) * u,
          y: s.ay + (s.by - s.ay) * u,
          speed: [60, 260],
          life: [0.2, 0.5],
          size: [5, 1],
          colorStart: WHITE,
          colorEnd: [2, 0.5, 0.1, 0],
          gravity: [0, 600],
        },
        6,
      );
    }
    // Overall brightness, for lights.
    let g = 1;
    if (this.mode === 'over' && after > 0) {
      g = after < 0.4 ? 1 + 3 * Math.exp(-after * 3.5) : Math.exp(-(after - 0.4) * 1.6) * 0.6;
    } else if (this.mode === 'under') {
      g =
        (1 - 0.65 * Math.min(T / Math.max(this.tEnd, 1e-3), 1)) *
        (after > 0 ? Math.exp(-after * 2.2) : 1);
    }
    this.glow = g * this.fade * this.intensity * (1 + this.flashK * 2);
    if (
      (this.mode === 'over' && after > 3.2) ||
      (this.mode === 'under' && after > 2.5) ||
      this.fade <= 0
    ) {
      this.tailDone = true;
    }
  }

  draw(frame: Frame): void {
    if (this.segs.length === 0 || this.tailDone) return;
    const u = this.u;
    u[0] = this.time;
    u[1] = MODE_ID[this.mode];
    u[2] = this.tEnd;
    u[3] = this.intensity;
    u[4] = this.width;
    u[5] = this.jitter;
    u[6] = this.seed;
    u[7] = this.flashK;
    u[8] = this.fade;
    this.material.setUniforms(u);
    const dp = this.dp;
    const pad = this.width * 3 + this.jitter * 2.5;
    for (const s of this.segs) {
      if (this.time < s.t0 || s.len < 0.5) continue;
      dp.x = (s.ax + s.bx) / 2;
      dp.y = (s.ay + s.by) / 2;
      dp.w = s.len + pad * 2;
      dp.h = pad * 2;
      dp.rotation = Math.atan2(s.by - s.ay, s.bx - s.ax);
      this.params[0] = s.t0;
      this.params[1] = s.t1;
      this.params[2] = s.charge;
      this.params[3] = s.arc0;
      this.tint[0] = s.colour[0]!;
      this.tint[1] = s.colour[1]!;
      this.tint[2] = s.colour[2]!;
      this.tint[3] = 1;
      dp.emissive = 1.2;
      frame.sprite(this.material, dp);
    }
  }
}
