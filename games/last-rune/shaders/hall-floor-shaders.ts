/**
 * Hall floor dressing: one material for every prop on the factory floor and the wall around it
 * (pipes, ceiling cables, hanging lamps, a junction box, rails and a mine cart, crates, barrels,
 * steam vents and puddles). Each instance picks its kind; consecutive instances batch into one
 * draw call. Everything is lit by the shared light set, so restored machines and lightning light
 * the floor too; puddles mirror the light set as vertical streaks.
 *
 * Space: 'q' is logical px relative to the quad centre, y up.
 * Per instance: params = (kind, a, b, c), tint = (r, g, b, alpha). See HallFloorKind for a, b, c.
 * Uniform a = (time, motion 0..1 (0 under reduced motion), warmth 0..1, lamp level 0..1).
 */
import { PROP_COMMON_WGSL, PROP_LIGHT_FLOATS } from '../art/props/lighting';
import { HALL_PARTS_WGSL } from './hall-machine-shaders';

export const HALL_FLOOR_UNIFORM_FLOATS = PROP_LIGHT_FLOATS + 4;

/** Prop kinds (params.x). */
export const HallFloorKind = {
  /** a = radius px, b = flange spacing px, c = 0 iron / 1 copper. Quad h >= 2r + 12. */
  pipeH: 0,
  /** As pipeH, vertical. c: + 2 adds a valve wheel, + 4 a gauge (at 40% height). */
  pipeV: 1,
  /** a = sag px, b = strand count (1..3), c = thickness px. Hangs from the quad's top corners. */
  cable: 2,
  /** a = variant seed. Quad about 170 x 125. */
  crates: 3,
  /** a = variant seed. Quad about 130 x 100. */
  barrels: 4,
  /** Rail track along the quad (h about 26). a = sleeper spacing. */
  rails: 5,
  /** Mine cart of rune ore. Quad about 110 x 70. */
  cart: 6,
  /** Floor steam vent at the quad bottom, puffs rising. a = phase seed, b = density 0..1. */
  vent: 7,
  /** Hanging lamp: hook at the quad top, shade at the bottom. a = phase seed, b = brightness. */
  lamp: 8,
  /** Puddle filling the quad (ellipse). a = seed. */
  puddle: 9,
  /** Junction box with a pilot lamp. a = phase seed. */
  junction: 10,
} as const;
export type HallFloorKind = (typeof HallFloorKind)[keyof typeof HallFloorKind];

const FLOOR_WGSL = /* wgsl */ `
var<private> g_world: vec2f;
var<private> g_size: vec2f;
var<private> g_motion: f32;
var<private> g_lamp: f32;
var<private> g_shadow: f32;

/** Drop shadow cast down-right onto the wall/floor behind (accumulates). */
fn drop_sh(d: f32, soft: f32, k: f32) {
  g_shadow = max(g_shadow, (1.0 - smoothstep(-soft, soft, d)) * k);
}

/** Cylinder across 'v' (-1..1): normal in local y-up space. */
fn cyl_n(v: f32, horizontal: bool) -> vec3f {
  let c = clamp(v, -0.98, 0.98);
  let z = sqrt(1.0 - c * c);
  if (horizontal) { return vec3f(0.0, c, z); }
  return vec3f(c, 0.0, z);
}

/** Lay a part with an explicit local normal (for cylinders). */
fn lay_n(d: f32, alb: vec3f, n: vec3f, met: f32, emi: vec3f) {
  S.d = min(S.d, d);
  let c = cover(d, g_aa);
  if (c <= 0.0) { return; }
  let rim = smoothstep(g_aa * 0.5, g_aa * 1.6, -d);
  S.alb = mix(S.alb, mix(C_INK * 0.25, alb, rim), c);
  S.nrm = mix(S.nrm, n, c);
  S.met = mix(S.met, met, c);
  S.emi = mix(S.emi, emi * rim, c);
  S.cov = c + S.cov * (1.0 - c);
}

fn pipe_alb(q: vec2f, copper: bool) -> vec3f {
  if (copper) { return a_copper(q) * 1.1; }
  return a_iron(q) * 1.15;
}

// 0/1: a pipe run along x (or y) with flanges, bolts and wall brackets.
fn k_pipe(q0: vec2f, r: f32, sp: f32, style: f32, horizontal: bool) {
  var q = q0;
  var len = g_size.x;
  if (!horizontal) { q = vec2f(q0.y, -q0.x); len = g_size.y; }
  let copper = (style % 2.0) > 0.5;
  let half = len * 0.5;
  // Bracket straps into the wall every flange.
  let fx = (fract((q.x + half) / sp + 0.5) - 0.5) * sp;
  let fi = floor((q.x + half) / sp + 0.5);
  let body = max(abs(q.y) - r, abs(q.x) - half);
  drop_sh(max(abs(q.y + 5.0) - r, abs(q.x) - half + 2.0), 5.0, 0.55);
  let tube = vec2f(q.x, q.y);
  let alb = pipe_alb(tube * vec2f(0.2, 1.0) + vec2f(0.0, fi * 3.0), copper);
  let v = q.y / r;
  var n = cyl_n(v, true);
  if (!horizontal) { n = vec3f(-n.y, n.x, n.z); }
  // Weld seams and grime streaks.
  let grime = 0.8 + 0.2 * engine_noise(vec2f(q.x * 0.05, q.y * 0.4) + g_seed);
  lay_n(body, alb * grime, n, 0.75, vec3f(0.0));
  // Flanges (skip the very ends) with bolt heads.
  let inside = step(sp * 0.4, half - abs(q.x));
  if (inside > 0.0) {
    let fl = max(abs(fx) - 3.0, abs(q.y) - (r + 2.6));
    let fv = clamp(q.y / (r + 2.6), -0.98, 0.98);
    var fn2 = cyl_n(fv, true);
    if (!horizontal) { fn2 = vec3f(-fn2.y, fn2.x, fn2.z); }
    lay_n(fl, pipe_alb(q * 1.7 + fi, copper) * 1.15, fn2, 0.8, vec3f(0.0));
    let bolt = length(vec2f(fx, abs(q.y) - r * 0.6)) - 1.3;
    lay_n(bolt, C_IRON * 1.6, vec3f(0.0, 0.0, 1.0), 0.8, vec3f(0.0));
  }
  // Rounded elbow caps where the run meets the wall.
  let cap = length(vec2f(abs(q.x) - half + r * 0.4, q.y)) - r * 1.05;
  let capN = normalize(vec3f(0.0, q.y / r, 1.0));
  if (abs(q.x) > half - r * 1.5) {
    lay_n(cap, pipe_alb(q, copper) * 0.7, capN, 0.7, vec3f(0.0));
  }
  if (!horizontal) {
    let extras = floor(style / 2.0);
    if ((extras % 2.0) > 0.5) {
      // Valve wheel on a short stem, 10% below the middle.
      let wc = vec2f(-r - 9.0, -len * 0.1);
      lay(sdg_box(q0 - vec2f(-r - 3.0, wc.y), vec2f(5.0, 2.0), 0.5), C_IRON, 1.0, 0.7, vec3f(0.0));
      let wq = q0 - wc;
      let spokes = min(abs(wq.x), abs(wq.y)) - 1.2;
      let wheel = sdg_union(sdg_ring(wq, 9.0, 1.8), flat(max(spokes, length(wq) - 8.5)));
      drop_sh(length(wq - vec2f(3.0, -4.0)) - 10.0, 3.0, 0.4);
      lay(wheel, C_DANGER * 0.6, 1.6, 0.4, vec3f(0.0));
    }
    if (extras >= 1.5) {
      // Pressure gauge on a short arm, just below the middle.
      let gc = vec2f(r + 13.0, -len * 0.05);
      drop_sh(length(q0 - gc - vec2f(3.0, -4.0)) - 11.0, 3.0, 0.45);
      lay(sdg_box(q0 - vec2f(r + 3.0, gc.y), vec2f(5.0, 1.6), 0.5), a_brass(q0), 1.0, 0.9, vec3f(0.0));
      gauge(q0, gc, 10.0, 0.35 + 0.15 * g_lamp + 0.03 * sin(g_now * 2.3));
    }
  }
}

// 2: sagging cable strands between the quad's top corners.
fn k_cable(q: vec2f, sag: f32, count: f32, th: f32) {
  let hw = g_size.x * 0.5;
  let u = clamp(q.x / hw, -1.0, 1.0);
  let top = g_size.y * 0.5 - th - 2.0;
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    if (fi >= count) { break; }
    let s = sag * (1.0 + fi * 0.18);
    let yc = top - fi * (th * 1.3) - s * (1.0 - u * u);
    // Slope-corrected distance.
    let slope = 2.0 * s * u / hw;
    let d = abs(q.y - yc) / sqrt(1.0 + slope * slope) - th;
    let v = clamp((q.y - yc) / th, -1.0, 1.0);
    let alb = select(vec3f(0.035, 0.03, 0.03), C_RUST * 0.45, i == 1);
    lay_n(max(d, abs(q.x) - hw), alb, cyl_n(v, true), 0.15, vec3f(0.0));
    drop_sh(max(abs(q.y + 6.0 - yc) - th, abs(q.x) - hw), 4.0, 0.3);
  }
}

// 3: a stack of three wooden crates (two on the floor, one on top).
fn crate_box(q: vec2f, c: vec2f, h: vec2f, seed: f32) {
  let cq = q - c;
  let box1 = sdg_box(cq, h, 1.5);
  lay(box1, a_wood(q * 1.2 + seed * 13.0), 2.5, 0.0, vec3f(0.0));
  // Frame boards around the edge and a diagonal brace.
  let edge = -max(abs(cq.x) - h.x + 5.0, abs(cq.y) - h.y + 5.0);
  let k = h.y / h.x;
  let diag = abs(cq.y - cq.x * k * select(1.0, -1.0, seed > 0.5)) / sqrt(1.0 + k * k) - 3.2;
  lay(sdg_intersect(flat(min(edge, diag)), box1), a_wood(q * 0.9 + seed) * 0.62, 1.5, 0.0, vec3f(0.0));
  // Plank gaps.
  let pl = abs(fract(cq.y / 9.0) - 0.5) * 9.0;
  lay(sdg_intersect(flat(max(0.5 - pl, -edge)), box1), C_INK * 0.6, 0.5, 0.0, vec3f(0.0));
  // Nails at the corners.
  let nq = vec2f(abs(cq.x) - h.x + 2.6, abs(cq.y) - h.y + 2.6);
  lay(sdg_circle(nq, 1.1), C_IRON * 1.8, 1.0, 0.8, vec3f(0.0));
}
fn k_crates(q: vec2f, seed: f32) {
  let base = -g_size.y * 0.5 + 6.0;
  // Contact shadow on the floor.
  g_shadow = max(g_shadow, (1.0 - smoothstep(-8.0, 10.0, sdg_ellipse(q - vec2f(4.0, base), vec2f(g_size.x * 0.48, 9.0)).x)) * 0.7);
  crate_box(q, vec2f(-38.0, base + 34.0), vec2f(40.0, 34.0), 0.2 + seed);
  crate_box(q, vec2f(42.0, base + 28.0), vec2f(36.0, 28.0), 0.7 + seed);
  // Sacking thrown over the top crate.
  crate_box(q, vec2f(-14.0 + seed * 10.0, base + 68.0 + 26.0), vec2f(30.0, 26.0), 0.4 + seed);
  let sq = q - vec2f(-24.0 + seed * 10.0, base + 120.0);
  let sack = sdg_union(sdg_ellipse(sq, vec2f(17.0, 9.0)), sdg_ellipse(sq - vec2f(12.0, -4.0), vec2f(10.0, 6.0)));
  lay(sack, C_PARCHMENT * 0.42 * (0.85 + 0.3 * engine_noise(q * 0.4)), 7.0, 0.0, vec3f(0.0));
  // A stencil mark on the big crate (a small rune).
  let rq = q - vec2f(-38.0, base + 34.0);
  let rune = min(sdg_segment(rq, vec2f(0.0, -10.0), vec2f(0.0, 10.0), 1.5).x,
                 min(sdg_segment(rq, vec2f(0.0, 4.0), vec2f(8.0, 10.0), 1.5).x, sdg_segment(rq, vec2f(0.0, 4.0), vec2f(-8.0, 10.0), 1.5).x));
  lay(flat(rune), vec3f(0.12, 0.07, 0.04), 0.5, 0.0, vec3f(0.0));
}

// 4: two upright barrels and one on its side.
fn barrel(q: vec2f, c: vec2f, h: vec2f) {
  let bq = q - c;
  let bulge = h.x * (1.0 + 0.08 * (1.0 - (bq.y / h.y) * (bq.y / h.y)));
  let d = max(abs(bq.x) - bulge, abs(bq.y) - h.y);
  let v = clamp(bq.x / bulge, -0.98, 0.98);
  let stave = 0.82 + 0.18 * step(0.12, abs(fract(bq.x / 7.0) - 0.5));
  lay_n(d, a_wood(q * vec2f(0.4, 1.4)) * stave, vec3f(v, 0.0, sqrt(1.0 - v * v)), 0.05, vec3f(0.0));
  // Iron hoops.
  let hy = min(abs(abs(bq.y) - h.y * 0.62), abs(abs(bq.y) - h.y * 0.92)) - 2.0;
  lay_n(max(hy, d), C_IRON * 1.3, vec3f(v, 0.0, sqrt(1.0 - v * v)), 0.8, vec3f(0.0));
  // Lid rim.
  lay(sdg_ellipse(bq - vec2f(0.0, h.y), vec2f(bulge * 0.92, 3.2)), a_wood(q) * 0.55, 2.0, 0.0, vec3f(0.0));
}
fn k_barrels(q: vec2f, seed: f32) {
  let base = -g_size.y * 0.5 + 6.0;
  g_shadow = max(g_shadow, (1.0 - smoothstep(-8.0, 10.0, sdg_ellipse(q - vec2f(0.0, base), vec2f(g_size.x * 0.47, 8.0)).x)) * 0.7);
  barrel(q, vec2f(-30.0, base + 36.0), vec2f(21.0, 36.0));
  barrel(q, vec2f(14.0, base + 31.0), vec2f(19.0, 31.0));
  // On its side in front.
  let sq = q - vec2f(36.0 - seed * 6.0, base + 15.0);
  let d = sdg_box(sq, vec2f(24.0, 15.0), 9.0);
  let v = clamp(sq.y / 15.0, -0.98, 0.98);
  lay_n(d.x, a_wood(q * vec2f(1.4, 0.4)) * (0.82 + 0.18 * step(0.12, abs(fract(sq.y / 6.0) - 0.5))),
        vec3f(0.0, v, sqrt(1.0 - v * v)), 0.05, vec3f(0.0));
  let hx = abs(abs(sq.x) - 14.0) - 2.0;
  lay_n(max(hx, d.x), C_IRON * 1.3, vec3f(0.0, v, sqrt(1.0 - v * v)), 0.8, vec3f(0.0));
  lay(sdg_ellipse(sq - vec2f(24.0, 0.0), vec2f(5.0, 14.0)), a_wood(q) * 0.5, 3.0, 0.0, vec3f(0.0));
}

// 5: rail track: two steel rails on timber sleepers, foreshortened toward the hall's centre.
fn k_rails(q: vec2f, sp: f32) {
  let skew = (g_world.x - 960.0) / 960.0;
  let sx = q.x + q.y * skew * 0.35;
  let cell = (fract(sx / sp + 0.5) - 0.5) * sp;
  let sid = floor(sx / sp + 0.5);
  let sl = max(abs(cell) - 4.5, abs(q.y + 0.5) - 9.5);
  drop_sh(max(abs(cell - 2.0) - 4.5, abs(q.y + 3.0) - 9.5), 3.0, 0.5);
  lay(flat(sl), a_wood(vec2f(sid * 9.0, q.y * 2.0)) * 0.6, 1.5, 0.0, vec3f(0.0));
  for (var i = 0; i < 2; i++) {
    let y = select(5.0, -5.5, i == 1);
    let th = select(1.4, 1.9, i == 1);
    let d = abs(q.y - y) - th;
    drop_sh(abs(q.y - y + 2.5) - th, 2.0, 0.5);
    let v = clamp((q.y - y) / th, -1.0, 1.0);
    lay_n(d, mix(C_IRON * 1.4, C_RUST * 0.8, 0.35 * engine_noise(q * vec2f(0.05, 1.0) + f32(i))),
          vec3f(0.0, v * 0.8, 0.6), 1.0, vec3f(0.0));
  }
}

// 6: a mine cart full of rune ore, on the rails.
fn k_cart(q: vec2f) {
  let base = -g_size.y * 0.5 + 10.0;
  // Ore heap, glinting with gem colours.
  let hq = q - vec2f(0.0, base + 44.0);
  let heap = sdg_ellipse(hq, vec2f(42.0, 14.0));
  let cellv = engine_hash22(floor(q / 6.0));
  let lump = 0.75 + 0.35 * cellv.x;
  lay(heap, C_SLATE * 1.4 * lump, 6.0, 0.2, vec3f(0.0));
  let gk = step(0.86, engine_hash21(floor(q / 6.0) + 3.0)) * step(heap.x, -1.0);
  let gc = select(select(C_CYAN, C_AMETHYST, cellv.y > 0.33), C_MAGENTA, cellv.y > 0.66);
  let tw = 0.6 + 0.4 * sin(g_now * 2.0 * g_motion + cellv.x * 30.0);
  S.emi += gc * gk * 0.9 * tw;
  S.alb = mix(S.alb, gc * 0.5, gk);
  // Tub.
  let tq = q - vec2f(0.0, base + 24.0);
  let tub = sdg_intersect(sdg_box(tq, vec2f(46.0, 17.0), 3.0),
                          hplane(vec2f(abs(tq.x), tq.y), vec2f(40.0, -17.0), normalize(vec2f(1.0, -0.25))));
  lay(tub, mix(a_iron(q), C_RUST * 0.9, 0.4), 4.0, 0.6, vec3f(0.0));
  lay(sdg_intersect(flat(abs(tq.y - 13.0) - 2.2), tub), C_IRON * 1.5, 1.0, 0.8, vec3f(0.0));
  let rv = vec2f((fract(tq.x / 10.0) - 0.5) * 10.0, tq.y - 13.0);
  lay(sdg_intersect(sdg_circle(rv, 1.1), tub), C_IRON * 2.0, 1.0, 0.8, vec3f(0.0));
  // Wheels on the rail.
  for (var i = 0; i < 2; i++) {
    let wq = q - vec2f(select(-26.0, 26.0, i == 1), base + 3.0);
    lay(sdg_circle(wq, 8.0), C_IRON * 1.1, 4.0, 0.8, vec3f(0.0));
    lay(sdg_circle(wq, 2.4), a_brass(q), 2.0, 0.9, vec3f(0.0));
  }
  drop_sh(sdg_box(q - vec2f(4.0, base + 18.0), vec2f(46.0, 22.0), 4.0).x, 6.0, 0.45);
}

// 7: an iron floor grate venting steam.
fn k_vent(q: vec2f, seed: f32, dens: f32) {
  let base = -g_size.y * 0.5 + 12.0;
  let gq = q - vec2f(0.0, base);
  let rim = sdg_ellipse(gq, vec2f(34.0, 9.0));
  lay(rim, C_IRON * 1.1, 3.0, 0.7, vec3f(0.0));
  let inner = sdg_ellipse(gq, vec2f(28.0, 6.5));
  let slots = abs(fract(gq.x / 6.0) - 0.5) * 6.0 - 1.2;
  lay(sdg_intersect(inner, flat(-slots)), vec3f(0.006, 0.006, 0.01), 0.5, 0.0, vec3f(0.0));
  // Puffs: four overlapping plumes, curling up and fading.
  if (dens * g_motion > 0.0) {
    var acc = 0.0;
    for (var i = 0; i < 5; i++) {
      let fi = f32(i);
      let ph = fract(g_now * 0.16 + fi * 0.2 + seed * 0.37);
      let rise = ph * (g_size.y - 30.0);
      let c = vec2f(sin(ph * 5.0 + fi * 2.3 + seed) * (6.0 + ph * 16.0), base + 6.0 + rise);
      let r = 9.0 + ph * 30.0;
      let k = 1.0 - smoothstep(r * 0.1, r, length((q - c) * vec2f(1.0, 1.25)));
      acc += k * (1.0 - ph) * smoothstep(0.0, 0.1, ph);
    }
    let n = engine_noise(q * 0.06 + vec2f(seed * 4.0, -g_now * 0.5));
    g_steam = clamp(acc * (0.45 + 0.8 * n), 0.0, 1.0) * dens;
  }
}

// 8: a hanging factory lamp on a chain, swaying slightly; warm cone of light below.
fn k_lamp(q0: vec2f, seed: f32, bright: f32) {
  let hook = vec2f(0.0, g_size.y * 0.5);
  let sway = sin(g_now * 0.55 + seed * 3.0) * 0.022 * g_motion;
  let q = hook + rot2(-sway) * (q0 - hook);
  let sy = -g_size.y * 0.5 + 34.0;
  // Chain links.
  let ly = q.y - sy;
  let link = (fract(ly / 7.0) - 0.5) * 7.0;
  let odd = step(0.5, fract(ly / 14.0));
  let lk = select(sdg_ring(vec2f(q.x, link), 2.6, 0.8).x, abs(q.x) - 0.9, odd > 0.5);
  lay(flat(max(lk, max(-ly + 10.0, q.y - hook.y))), C_IRON * 1.4, 0.8, 0.8, vec3f(0.0));
  // Shade: a wide iron cone with a rolled lip, and the hot bulb under it.
  let shq = q - vec2f(0.0, sy);
  let shade = sdg_intersect(sdg_box(shq - vec2f(0.0, -2.0), vec2f(24.0, 10.0), 1.5),
                            hplane(vec2f(abs(shq.x), shq.y), vec2f(8.0, 10.0), normalize(vec2f(1.0, 0.95))));
  lay(shade, mix(C_IRON, C_VERDIGRIS * 0.7, 0.3) * 1.2, 5.0, 0.7, vec3f(0.0));
  lay(sdg_box(shq - vec2f(0.0, 10.0), vec2f(4.0, 3.5), 1.0), a_brass(q), 2.0, 0.9, vec3f(0.0));
  let flick = 0.92 + 0.08 * sin(g_now * 17.0 + seed * 9.0) * sin(g_now * 6.3) * g_motion;
  let on = bright * flick * g_lamp;
  let bq = shq - vec2f(0.0, -12.0);
  lay(sdg_ellipse(bq, vec2f(6.0, 5.0)), vec3f(0.08) + C_WARM * on, 4.0, 0.0, (C_WARM + vec3f(0.3, 0.2, 0.05)) * on * 2.4);
  lay(sdg_box(shq - vec2f(0.0, -10.5), vec2f(25.0, 1.4), 0.6), C_BRASS * 0.9, 1.0, 0.9, vec3f(0.0));
  // Light cone below the shade and a soft halo.
  let cq = shq - vec2f(0.0, -12.0);
  let below = smoothstep(2.0, -8.0, cq.y);
  let spread = abs(cq.x) / max(-cq.y * 0.75 + 18.0, 1.0);
  let cone = below * (1.0 - smoothstep(0.6, 1.0, spread)) * exp(cq.y / 140.0);
  g_glow += C_WARM * on * (0.05 * cone + 0.5 * exp(-length(bq) / 9.0));
}

// 9: a puddle: dark water mirroring every light above it as a vertical streak.
fn k_puddle(q: vec2f, seed: f32) {
  let h = g_size * 0.5;
  let p = q / h;
  let wob = 0.85 + 0.15 * engine_noise(vec2f(atan2(p.y, p.x) * 1.8, seed * 5.0));
  let r = length(p);
  let d = (r - wob) * min(h.x, h.y);
  let cov = cover(d, g_aa);
  if (cov <= 0.0) { return; }
  // Ripples: slow rings from drips.
  let ph = fract(g_now * 0.18 + seed);
  let rp = q - vec2f((engine_hash21(vec2f(floor(g_now * 0.18 + seed), seed)) - 0.5) * h.x, 0.0);
  let ring = exp(-abs(length(rp * vec2f(1.0, 3.2)) - ph * h.x * 0.7) * 0.5) * (1.0 - ph) * g_motion;
  let jit = (engine_noise(q * vec2f(0.05, 0.4) + vec2f(0.0, g_now * 0.6 * g_motion)) - 0.5) * 7.0 + ring * 5.0;
  var refl = vec3f(0.0);
  let count = i32(U.L.info.x);
  for (var i = 0; i < 16; i++) {
    if (i >= count) { break; }
    let lp = U.L.pos[i];
    let dy = g_world.y - lp.y;
    if (dy < 4.0) { continue; }
    let dx = g_world.x + jit - lp.x;
    let sig = 3.0 + dy * 0.035;
    let streak = exp(-dx * dx / (2.0 * sig * sig));
    let fall = 1.0 / (1.0 + dy * dy / 160000.0);
    refl += U.L.col[i].rgb * (streak * 0.85 + exp(-abs(dx) / 120.0) * 0.03) * fall;
  }
  let edge = smoothstep(0.55, 1.0, r / wob);
  // Cool sheen of the sky on the water, brighter toward the far (upper) edge, and a thin wet
  // rim, so a puddle reads as water even with no light above it.
  let far = smoothstep(-0.4, 0.9, p.y);
  let sky = U.L.ambient.rgb * (0.3 + 0.35 * far) + vec3f(0.006, 0.009, 0.016);
  var c = sky + refl * (1.0 - 0.5 * edge);
  c += vec3f(0.05, 0.065, 0.09) * exp(-abs(d) / 1.6);
  c += vec3f(0.03, 0.04, 0.055) * ring;
  S.alb = vec3f(0.0);
  S.cov = cov * (0.92 - 0.35 * edge);
  S.emi = c;
  S.d = d;
}

// 10: a riveted junction box with a pilot lamp and cable glands.
fn k_junction(q: vec2f, seed: f32) {
  drop_sh(sdg_box(q - vec2f(3.0, -4.0), vec2f(18.0, 22.0), 2.0).x, 4.0, 0.5);
  lay(sdg_box(q, vec2f(18.0, 22.0), 2.0), mix(C_IRON, C_VERDIGRIS * 0.6, 0.3) * 1.3, 3.0, 0.6, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 2.0), vec2f(13.0, 15.0), 1.0), C_IRON * 0.9, 1.5, 0.6, vec3f(0.0));
  let rv = vec2f(abs(q.x) - 15.0, abs(q.y) - 19.0);
  lay(sdg_circle(rv, 1.2), C_IRON * 2.0, 1.0, 0.8, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, -24.0), vec2f(10.0, 3.0), 1.0), a_brass(q), 1.5, 0.9, vec3f(0.0));
  // Danger stripe plate.
  let st = step(0.5, fract((q.x + q.y) / 6.0));
  lay(sdg_box(q - vec2f(0.0, -10.0), vec2f(10.0, 3.0), 0.5), mix(C_AMBER * 0.5, C_INK, st), 0.8, 0.2, vec3f(0.0));
  let blink = step(0.55, fract(g_now * 0.5 + seed)) * g_motion + (1.0 - g_motion) * 0.6;
  lamp(q, vec2f(0.0, 8.0), 3.4, C_AMBER * 1.3, 0.15 + 0.85 * blink * g_lamp);
}
`;

export const HALL_FLOOR_WGSL = /* wgsl */ `
${PROP_COMMON_WGSL}
struct HallFloorU { L: PropLights, a: vec4f };
@group(1) @binding(0) var<uniform> U: HallFloorU;
${HALL_PARTS_WGSL}
${FLOOR_WGSL}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let kind = i32(in.params.x + 0.5);
  g_now = U.a.x;
  g_motion = U.a.y;
  g_lamp = U.a.w;
  g_t = g_now * g_motion;
  g_now = g_t;
  g_seed = f32(kind) * 5.17 + in.params.y * 3.1;
  g_size = in.size;
  g_world = in.world;
  g_op = 1.0;
  g_al = 1.0;
  g_acc = in.color.rgb;
  let q = vec2f(in.local.x - 0.5, 0.5 - in.local.y) * in.size;
  g_aa = max(fwidth(q.x), fwidth(q.y));
  S.alb = vec3f(0.0);
  S.nrm = vec3f(0.0, 0.0, 1.0);
  S.met = 0.0;
  S.emi = vec3f(0.0);
  S.cov = 0.0;
  S.d = 1e5;
  g_glow = vec3f(0.0);
  g_steam = 0.0;
  g_shadow = 0.0;

  let a = in.params.y;
  let b = in.params.z;
  let c = in.params.w;
  var lit = true;
  switch kind {
    case 0: { k_pipe(q, a, b, c, true); }
    case 1: { k_pipe(q, a, b, c, false); }
    case 2: { k_cable(q, a, b, c); }
    case 3: { k_crates(q, a); }
    case 4: { k_barrels(q, a); }
    case 5: { k_rails(q, a); }
    case 6: { k_cart(q); }
    case 7: { k_vent(q, a, b); }
    case 8: { k_lamp(q, a, b); }
    case 9: { k_puddle(q, a); lit = false; }
    default: { k_junction(q, a); }
  }

  var col = vec3f(0.0);
  if (S.cov > 0.0) {
    if (lit) {
      let n = to_world_n(normalize(S.nrm), 1.0, 0.0);
      col = prop_light(g_world, n, S.alb, S.met, 0.45);
    }
    col += S.emi;
  }
  var rgb = col * S.cov;
  var al = S.cov;
  // Shadow cast onto what's behind (darkens, adds coverage).
  let sh = g_shadow * (1.0 - S.cov);
  al += sh;
  // Steam, lit by the room.
  let sA = g_steam * 0.6;
  let steamC = C_MIST * 0.3 + U.L.ambient.rgb * 1.5;
  rgb = rgb * (1.0 - sA) + steamC * sA;
  al = al * (1.0 - sA) + sA;
  rgb += g_glow;
  let k = in.color.a;
  var o: FragOut;
  o.color = vec4f(rgb, al) * k;
  let emK = select(1.0, 0.0, kind == 9);
  o.emissive = vec4f((S.emi * S.cov * emK + g_glow) * in.emissive * k, al * k);
  return o;
}
`;
