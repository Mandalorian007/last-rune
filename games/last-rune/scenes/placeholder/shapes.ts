/**
 * Placeholder drawing kit for the shell's stand-in visuals (title, hall). SDF
 * shapes in one material, an additive glow, and a procedural backdrop. The
 * art workstreams replace the views that use this; nothing else depends on it.
 */
import {
  type DrawParams,
  type Frame,
  hex,
  type Material,
  type Renderer,
  type RGBA,
} from '@engine/render';
import type { SocketColour } from '../../rules/progression';

/** Socket colours as linear RGBA (pitch palette). */
export const SOCKET_RGBA: Record<SocketColour, RGBA> = {
  amethyst: hex('#9b5cff'),
  magenta: hex('#ff3fb4'),
  amber: hex('#ffb03f'),
  emerald: hex('#3fff9a'),
  ice: hex('#8fc8ff'),
  cyan: hex('#3fe0ff'),
  slate: hex('#6c7488'),
};
export const GOLD = hex('#e8c06a');
export const CANDLE = hex('#ffb35c');
export const STONE = hex('#3a3f4c');
export const STONE_DARK = hex('#1c1f27');

const SHAPES_WGSL = /* wgsl */ `
fn sd_round_box(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
// params: x = kind (0 rounded rect, 1 disc), y = corner radius px,
//         z = outline width px (0 = filled), w = dash count (0 = solid)
@fragment fn fs_main(in: VSOut) -> FragOut {
  let half = in.size * 0.5;
  let p = (in.local - vec2f(0.5)) * in.size;
  var d: f32;
  if (in.params.x < 0.5) {
    d = sd_round_box(p, half, min(in.params.y, min(half.x, half.y)));
  } else {
    d = length(p) - min(half.x, half.y);
  }
  let bw = in.params.z;
  if (bw > 0.0) {
    d = abs(d + bw * 0.5) - bw * 0.5;
  }
  var a = 1.0 - smoothstep(-0.75, 0.75, d);
  if (in.params.w > 0.0) {
    let ang = atan2(p.y, p.x);
    a *= smoothstep(-0.15, 0.15, sin(ang * in.params.w));
  }
  let shade = 1.0 + 0.3 * (0.5 - in.local.y);
  var o: FragOut;
  o.color = vec4f(in.color.rgb * shade, in.color.a * a);
  o.emissive = vec4f(in.color.rgb * in.emissive, in.color.a * a);
  return o;
}
`;

const GLOW_WGSL = /* wgsl */ `
@fragment fn fs_main(in: VSOut) -> FragOut {
  let p = in.local * 2.0 - 1.0;
  let r2 = dot(p, p);
  let k = max(in.params.x, 0.5);
  let g = exp(-r2 * k) * (1.0 - smoothstep(0.7, 1.0, sqrt(r2)));
  var o: FragOut;
  o.color = vec4f(in.color.rgb, g * in.color.a);
  o.emissive = vec4f(in.color.rgb * in.emissive, g * in.color.a);
  return o;
}
`;

/**
 * Procedural backdrop. params.x: 0 = hall (back wall of blocks, flagstone floor
 * from the horizon at params.y), 1 = title (night stone with a violet storm glow).
 */
const BACKDROP_WGSL = /* wgsl */ `
fn blocks(p: vec2f, size: vec2f) -> vec3f {
  let row = floor(p.y / size.y);
  let q = vec2f(p.x / size.x + 0.5 * (row - 2.0 * floor(row / 2.0)), p.y / size.y);
  let cell = floor(q);
  let f = fract(q);
  let edge = min(min(f.x, 1.0 - f.x) * size.x, min(f.y, 1.0 - f.y) * size.y);
  return vec3f(edge, engine_hash21(cell), 0.0);
}
@fragment fn fs_main(in: VSOut) -> FragOut {
  let px = in.local * in.size;
  let n = engine_fbm(px * 0.01, 4);
  var col: vec3f;
  if (in.params.x < 0.5) {
    let horizon = in.params.y;
    if (px.y < horizon) {
      let b = blocks(px, vec2f(160.0, 72.0));
      let mortar = smoothstep(1.0, 4.0, b.x);
      let base = mix(vec3f(0.07, 0.075, 0.095), vec3f(0.12, 0.125, 0.15), b.y * 0.6 + n * 0.5);
      col = base * mix(0.35, 1.0, mortar);
      col *= mix(0.55, 1.0, px.y / horizon);
    } else {
      let t = (px.y - horizon) / (in.size.y - horizon);
      let depth = 0.25 + 0.75 * t;
      let fx = (px.x - in.size.x * 0.5) / depth + in.size.x * 0.5;
      let fy = pow(t, 0.6) * 9.0;
      let cell = vec2f(fx / 210.0, fy);
      let f = fract(cell);
      let edge = min(min(f.x, 1.0 - f.x) * 210.0 * depth, min(f.y, 1.0 - f.y) * 60.0 * depth);
      let h = engine_hash21(floor(cell));
      let base = mix(vec3f(0.085, 0.085, 0.1), vec3f(0.14, 0.135, 0.15), h * 0.5 + n * 0.6);
      col = base * mix(0.4, 1.0, smoothstep(0.5, 3.0, edge)) * mix(0.6, 1.1, t);
    }
  } else {
    let c = in.local - vec2f(0.5, 0.32);
    let storm = exp(-dot(c * vec2f(1.3, 2.2), c * vec2f(1.3, 2.2)) * 6.0);
    let b = blocks(px, vec2f(180.0, 80.0));
    let mortar = smoothstep(1.0, 4.0, b.x);
    let base = mix(vec3f(0.035, 0.03, 0.05), vec3f(0.08, 0.07, 0.1), b.y * 0.5 + n * 0.6);
    col = base * mix(0.4, 1.0, mortar) + vec3f(0.28, 0.12, 0.5) * storm * (0.6 + 0.4 * n);
  }
  var o: FragOut;
  o.color = vec4f(col, 1.0);
  o.emissive = vec4f(0.0, 0.0, 0.0, 1.0);
  return o;
}
`;

export interface ShapeStyle {
  color: ArrayLike<number>;
  /** Multiplies colour (HDR allowed). Default 1. */
  k?: number;
  alpha?: number;
  emissive?: number;
  radius?: number;
  outline?: number;
  dashes?: number;
  rotation?: number;
}

/** Small immediate-mode painter over three materials. Reuses its scratch objects. */
export class Painter {
  readonly shapes: Material;
  readonly glowMat: Material;
  readonly backdropMat: Material;
  private readonly dp: DrawParams = { x: 0, y: 0 };
  private readonly tint: RGBA = [1, 1, 1, 1];
  private readonly params = [0, 0, 0, 0];

  constructor(renderer: Renderer) {
    this.shapes = renderer.createMaterial({
      label: 'lr-ph-shapes',
      wgsl: SHAPES_WGSL,
      blend: 'alpha',
    });
    this.glowMat = renderer.createMaterial({
      label: 'lr-ph-glow',
      wgsl: GLOW_WGSL,
      blend: 'additive',
    });
    this.backdropMat = renderer.createMaterial({
      label: 'lr-ph-backdrop',
      wgsl: BACKDROP_WGSL,
      blend: 'opaque',
    });
  }

  backdrop(frame: Frame, w: number, h: number, variant: 0 | 1, horizon = 0): void {
    this.setParams(variant, horizon, 0, 0);
    this.place(w / 2, h / 2, w, h, 0);
    this.setTint([1, 1, 1, 1], 1, 1);
    this.dp.emissive = 0;
    frame.sprite(this.backdropMat, this.dp);
  }

  rect(frame: Frame, x: number, y: number, w: number, h: number, s: ShapeStyle): void {
    this.shape(frame, 0, x, y, w, h, s);
  }

  disc(frame: Frame, x: number, y: number, d: number, s: ShapeStyle): void {
    this.shape(frame, 1, x, y, d, d, s);
  }

  ellipse(frame: Frame, x: number, y: number, w: number, h: number, s: ShapeStyle): void {
    // Rounded rect with full radius reads as a capsule/ellipse at placeholder fidelity.
    this.shape(frame, 0, x, y, w, h, { ...s, radius: Math.min(w, h) / 2 });
  }

  /** A straight bar from (x0,y0) to (x1,y1). */
  line(
    frame: Frame,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    width: number,
    s: ShapeStyle,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    this.shape(frame, 0, (x0 + x1) / 2, (y0 + y1) / 2, len, width, {
      ...s,
      radius: s.radius ?? width / 2,
      rotation: Math.atan2(dy, dx),
    });
  }

  glow(
    frame: Frame,
    x: number,
    y: number,
    size: number,
    color: ArrayLike<number>,
    k: number,
    falloff = 2.5,
    emissive = 0,
  ): void {
    this.setParams(falloff, 0, 0, 0);
    this.place(x, y, size, size, 0);
    this.setTint(color, k, 1);
    this.dp.emissive = emissive;
    frame.sprite(this.glowMat, this.dp);
  }

  private shape(
    frame: Frame,
    kind: number,
    x: number,
    y: number,
    w: number,
    h: number,
    s: ShapeStyle,
  ): void {
    this.setParams(kind, s.radius ?? 0, s.outline ?? 0, s.dashes ?? 0);
    this.place(x, y, w, h, s.rotation ?? 0);
    this.setTint(s.color, s.k ?? 1, s.alpha ?? 1);
    this.dp.emissive = s.emissive ?? 0;
    frame.sprite(this.shapes, this.dp);
  }

  private setParams(a: number, b: number, c: number, d: number): void {
    const p = this.params;
    p[0] = a;
    p[1] = b;
    p[2] = c;
    p[3] = d;
    this.dp.params = p;
  }

  private place(x: number, y: number, w: number, h: number, rotation: number): void {
    const dp = this.dp;
    dp.x = x;
    dp.y = y;
    dp.w = w;
    dp.h = h;
    dp.rotation = rotation;
  }

  private setTint(c: ArrayLike<number>, k: number, a: number): void {
    const t = this.tint;
    t[0] = c[0]! * k;
    t[1] = c[1]! * k;
    t[2] = c[2]! * k;
    t[3] = a * (c[3] ?? 1);
    this.dp.tint = t;
  }
}
