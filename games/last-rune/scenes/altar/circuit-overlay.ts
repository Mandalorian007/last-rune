/**
 * Board overlays that make the slab read as a circuit (altar-clarity):
 *
 * - **veil**: a stone skim over an empty socket that is not in play, so its bowl recedes and
 *   the sockets near the circuit stand out. The socket still accepts a gem.
 * - **conduit**: a carved groove between two points (storm → entry socket, exit socket →
 *   machine terminal, and the edit-time route through placed gems). `glow` lights it in the
 *   tint colour (emissive, so it blooms) when charge runs down it.
 *
 * One small material, drawn as quads after the slab and before the socket marks.
 */
import type { DrawParams, Frame, Material, Renderer } from '@engine/render';

const OVERLAY_WGSL = /* wgsl */ `
@fragment fn fs_main(in: VSOut) -> FragOut {
  var o: FragOut;
  o.color = vec4f(0.0);
  o.emissive = vec4f(0.0);
  let mode = i32(in.params.x + 0.5);
  let amt = in.params.y;
  let glow = in.params.z;
  let seed = in.params.w;
  if (mode == 0) {
    // Veil: soft disc of slab-coloured stone; a little grain so it isn't a flat sticker. It
    // stops inside the bowl's rim (socket radius = 0.87 here), so a quiet socket still reads
    // as an open hole and never as the capstone of a blocked one.
    let p = in.local * 2.0 - 1.0;
    let r = length(p);
    let edge = smoothstep(0.8, 0.58, r);
    let grain = 0.85 + 0.3 * engine_fbm(in.world * 0.045 + seed, 3);
    let a = edge * amt;
    o.color = vec4f(in.color.rgb * grain * a, a);
    return o;
  }
  // Conduit: local.x runs along the groove, local.y across. Width in px = in.size.y.
  let across = abs(in.local.y * 2.0 - 1.0);
  let lenPx = in.size.x;
  let along = in.local.x * lenPx;
  // Round the two ends so joints between conduits overlap cleanly.
  let endFade = smoothstep(0.0, in.size.y * 0.5, along) * smoothstep(0.0, in.size.y * 0.5, lenPx - along);
  let body = smoothstep(1.0, 0.55, across) * endFade;
  // Groove: a dark channel cut in the stone with a brass wire laid in it, catching the light
  // along its upper edge.
  // Bright (phones, mobile-6-board): a wider, lit brass wire that reads at a glance.
  let bright = step(1.1, in.params.x);
  let wire = smoothstep(mix(0.42, 0.6, bright), mix(0.28, 0.46, bright), across);
  let shine = smoothstep(0.3, 0.0, abs(in.local.y - 0.4) * 2.0);
  let brass = vec3f(0.16, 0.1, 0.045) * (0.7 + 0.6 * shine) * mix(1.0, 3.2, bright);
  let shade = mix(vec3f(0.006, 0.007, 0.01), brass, wire);
  let a = body * amt * mix(0.8, 1.0, wire);
  var rgb = shade * a;
  // Glow: a hot core along the groove floor, flickering a touch along its length.
  let core = smoothstep(0.7, 0.0, across) * endFade;
  let flick = 0.85 + 0.15 * engine_noise(vec2f(along * 0.05 - globals.time * 6.0, seed));
  let g = core * glow * flick;
  rgb += in.color.rgb * g * 0.6;
  o.color = vec4f(rgb, max(a, min(g, 1.0)));
  o.emissive = vec4f(in.color.rgb * g * in.emissive, 0.0);
  return o;
}
`;

/** Slab-matched skim colour (linear). Tuned against the baked slab under candlelight. */
const VEIL: readonly number[] = [0.024, 0.027, 0.046, 1];

export class CircuitOverlay {
  /** Lay a wider, lit brass wire in the grooves (phones: the wires to the storm and gauges). */
  bright = false;
  private readonly material: Material;
  private readonly dp: DrawParams = { x: 0, y: 0, params: [0, 0, 0, 0], tint: [1, 1, 1, 1] };

  constructor(renderer: Renderer) {
    this.material = renderer.createMaterial({
      label: 'altar-circuit',
      wgsl: OVERLAY_WGSL,
      blend: 'premultiplied',
    });
  }

  /** Skim over a socket bowl of radius `r` at (x, y); `amount` 0..1. */
  veil(frame: Frame, x: number, y: number, r: number, amount: number): void {
    if (amount <= 0.001) return;
    const dp = this.dp;
    dp.x = x;
    dp.y = y;
    dp.w = r * 2.3;
    dp.h = r * 2.3;
    dp.rotation = 0;
    dp.emissive = 0;
    const p = dp.params as number[];
    p[0] = 0;
    p[1] = amount;
    p[2] = 0;
    p[3] = (x * 0.13 + y * 0.07) % 17;
    const t = dp.tint as number[];
    t[0] = VEIL[0]!;
    t[1] = VEIL[1]!;
    t[2] = VEIL[2]!;
    t[3] = 1;
    frame.sprite(this.material, dp);
  }

  /**
   * Groove from (ax, ay) to (bx, by), `width` px. `amount` is how deep it reads (0..1);
   * `glow` lights it in `color` (linear, HDR ok).
   */
  conduit(
    frame: Frame,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    width: number,
    amount: number,
    glow = 0,
    color: ArrayLike<number> = VEIL,
  ): void {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1 || (amount <= 0.001 && glow <= 0.001)) return;
    const dp = this.dp;
    dp.x = (ax + bx) / 2;
    dp.y = (ay + by) / 2;
    dp.w = len + width;
    dp.h = width;
    dp.rotation = Math.atan2(dy, dx);
    dp.emissive = 1.4;
    const p = dp.params as number[];
    p[0] = this.bright ? 1.25 : 1;
    p[1] = amount;
    p[2] = glow;
    p[3] = (ax * 0.11 + by * 0.05) % 13;
    const t = dp.tint as number[];
    t[0] = color[0] ?? 1;
    t[1] = color[1] ?? 1;
    t[2] = color[2] ?? 1;
    t[3] = 1;
    frame.sprite(this.material, dp);
  }

  destroy(): void {
    this.material.destroy();
  }
}
