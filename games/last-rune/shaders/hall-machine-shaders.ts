/**
 * Hall machines: one material, fifteen recognisable silhouettes, drawn inside the alcoves in a
 * single instanced batch. Each machine is built from shared part primitives (pipes, chimneys,
 * gears, tanks, gauges, lamps, lattice trusses, windows) and lit once per pixel by the shared
 * light set, so the whole wall of machines costs one draw call.
 *
 * Space: 'q' is logical px relative to the alcove centre, y up (the alcove interior spans
 * x ±61, floor y -65, arch spring y 22.5, crown y 84). The quad is HALL_MACHINE_QUAD px and sits
 * HALL_MACHINE_LIFT px above the alcove centre.
 *
 * Per instance: params = (kind, open 0..1, alive 0..1, anim seconds), tint = accent rgb (the
 * colour the machine grants) with alpha = opacity. Uniform a = (time, -, -, -).
 *
 * State reads at a glance:
 * - locked (open 0): a dark, cold silhouette behind the alcove's grate (the grate and padlock
 *   are cut out so they stay on top);
 * - available (open 1, alive 0): lit, pilot lights on, and a gentle gold pulse around the
 *   silhouette;
 * - restored (alive 1): warm and alive: fires, lamps, turning gears, steam, moving parts.
 */
import { PROP_COMMON_WGSL, PROP_LIGHT_FLOATS } from '../art/props/lighting';

export const HALL_MACHINE_UNIFORM_FLOATS = PROP_LIGHT_FLOATS + 4;
/** Quad size in px (w, h). */
export const HALL_MACHINE_QUAD = [140, 160] as const;
/** The quad's centre sits this many px above the alcove centre. */
export const HALL_MACHINE_LIFT = 10;

/** Machine ids in shader kind order. */
export const HALL_MACHINE_KINDS = [
  'intake-desk',
  'furnace',
  'splitter-mill',
  'relay-tower',
  'conveyor-a',
  'press-unit-4',
  'storm-cell-2',
  'crane',
  'boiler-room',
  'archive',
  'foundry',
  'capacitor-bay',
  'lift-shaft',
  'roof-array',
  'control-booth',
] as const;

const PARTS_WGSL = /* wgsl */ `
struct Surf {
  alb: vec3f,
  nrm: vec3f,
  met: f32,
  emi: vec3f,
  cov: f32,
  d: f32,
};

var<private> S: Surf;
var<private> g_glow: vec3f;
var<private> g_steam: f32;
var<private> g_aa: f32;
var<private> g_seed: f32;
var<private> g_op: f32;
var<private> g_al: f32;
var<private> g_t: f32;
var<private> g_now: f32;
var<private> g_acc: vec3f;

fn flat(d: f32) -> vec3f { return vec3f(d, 0.0, 0.0); }

/** Lay an opaque part (albedo, bevel px, metalness, emissive) over what's there. */
fn lay(sd: vec3f, alb: vec3f, bevel: f32, met: f32, emi: vec3f) {
  S.d = min(S.d, sd.x);
  let c = cover(sd.x, g_aa);
  if (c <= 0.0) { return; }
  let rim = smoothstep(g_aa * 0.5, g_aa * 1.6, -sd.x);
  S.alb = mix(S.alb, mix(C_INK * 0.25, alb, rim), c);
  S.nrm = mix(S.nrm, pillow(sd, max(bevel, 0.5)), c);
  S.met = mix(S.met, met, c);
  S.emi = mix(S.emi, emi * rim, c);
  S.cov = c + S.cov * (1.0 - c);
}

/** Rotated box (angle a, CCW), gradient rotated back to q space. */
fn rbox(q: vec2f, c: vec2f, h: vec2f, r: f32, a: f32) -> vec3f {
  let b = sdg_box(rot2(-a) * (q - c), h, r);
  return vec3f(b.x, rot2(a) * b.yz);
}

/** Half-plane keeping the side the unit normal 'n' points away from (d < 0 inside). */
fn hplane(q: vec2f, o: vec2f, n: vec2f) -> vec3f {
  return vec3f(dot(q - o, n), n);
}

fn a_iron(q: vec2f) -> vec3f { return iron_albedo(q * 0.03, g_seed); }
fn a_brass(q: vec2f) -> vec3f { return brass_albedo(q * 0.03, 1.0, g_seed); }
fn a_copper(q: vec2f) -> vec3f { return mix(C_BRASS, C_RUST, 0.55) * (0.85 + 0.3 * engine_noise(q * 0.2 + g_seed)); }
fn a_wood(q: vec2f) -> vec3f {
  let n = engine_noise(q * vec2f(0.05, 0.6) + g_seed);
  return vec3f(0.34, 0.21, 0.12) * (0.7 + 0.45 * n);
}
fn a_stone(q: vec2f) -> vec3f { return C_SLATE * (1.2 + 0.4 * engine_noise(q * 0.15 + g_seed)); }
fn a_brick(q: vec2f) -> vec3f {
  let row = floor(q.y / 8.0);
  let bx = q.x / 15.0 + row * 0.5;
  let my = abs(fract(q.y / 8.0) - 0.5) * 8.0;
  let mx = abs(fract(bx) - 0.5) * 15.0;
  let m = max(smoothstep(3.0, 3.7, my), smoothstep(6.6, 7.3, mx));
  let h = engine_hash21(vec2f(floor(bx), row) + g_seed);
  let base = mix(C_RUST * 0.85, C_RUST * 1.35, h);
  return mix(base, vec3f(0.1, 0.09, 0.085), m);
}
fn a_paint(q: vec2f) -> vec3f {
  // Crane-yellow enamel, worn at the edges by noise.
  let n = engine_noise(q * 0.25 + g_seed);
  return mix(vec3f(0.62, 0.42, 0.08), vec3f(0.3, 0.22, 0.1), smoothstep(0.62, 0.8, n));
}

/** Glass lamp in a brass bezel; 'on' 0..1. */
fn lamp(q: vec2f, c: vec2f, r: f32, col: vec3f, on: f32) {
  lay(sdg_circle(q - c, r + 1.4), a_brass(q), 1.2, 0.9, vec3f(0.0));
  let hot = 1.0 - smoothstep(0.0, r, length(q - c - vec2f(-r * 0.25, r * 0.25)));
  lay(sdg_circle(q - c, r), vec3f(0.05, 0.06, 0.07) + col * on * (0.5 + 0.5 * hot), r, 0.1,
      col * on * (1.2 + hot));
  g_glow += col * on * 0.35 * exp(-length(q - c) / (r * 2.4));
}

/** Round pressure gauge: brass bezel, dial face, red needle at 'v' 0..1. */
fn gauge(q: vec2f, c: vec2f, r: f32, v: f32) {
  lay(sdg_circle(q - c, r), a_brass(q), 2.0, 0.9, vec3f(0.0));
  lay(sdg_circle(q - c, r * 0.76), C_DIAL, r * 0.4, 0.0, C_DIAL * 0.25 * g_al);
  let ang = radians(220.0 - 260.0 * v);
  let tip = c + vec2f(cos(ang), sin(ang)) * r * 0.68;
  lay(sdg_segment(q, c, tip, 0.9), C_DANGER, 0.5, 0.0, C_DANGER * 0.4 * g_al);
  lay(sdg_circle(q - c, 1.4), C_IRON_DARK, 1.0, 0.5, vec3f(0.0));
}

/** Gear of radius r with n teeth turned by 'ang'; four lightening holes. */
fn gear(q: vec2f, r: f32, n: f32, ang: f32) -> vec3f {
  let l = max(length(q), 1e-4);
  let a = atan2(q.y, q.x) - ang;
  let tooth = clamp(cos(a * n) * 2.5, -1.0, 1.0) * 0.5 + 0.5;
  var s = vec3f((l - (r * 0.84 + r * 0.16 * tooth)) * 0.85, q / l);
  s = sdg_sub(s, sdg_circle(q, r * 0.16));
  for (var i = 0; i < 4; i++) {
    let ha = f32(i) * 1.5708 + ang;
    s = sdg_sub(s, sdg_circle(q - vec2f(cos(ha), sin(ha)) * r * 0.5, r * 0.17));
  }
  return s;
}

/**
 * Lattice truss along axis coordinate 'a' (from a0 to a1) with half-width w0 -> w1 across 'b';
 * X-bracing every 'cell' px with members 'th' px thick. Flat-shaded distance.
 */
fn truss(a: f32, b: f32, a0: f32, a1: f32, w0: f32, w1: f32, cell: f32, th: f32) -> f32 {
  let v = clamp((a - a0) / (a1 - a0), 0.0, 1.0);
  let w = mix(w0, w1, v);
  let ends = max(a0 - a, a - a1);
  let chords = max(abs(abs(b) - w) - th * 1.35, ends);
  let f = fract((a - a0) / cell);
  let u = b / max(w, 1.0);
  let k = 2.0 * w / cell;
  let diag = min(abs(u - (2.0 * f - 1.0)), abs(u + (2.0 * f - 1.0))) * w / sqrt(1.0 + k * k);
  let ties = min(f, 1.0 - f) * cell;
  var br = min(diag, ties) - th;
  br = max(br, abs(b) - w);
  br = max(br, ends);
  return min(chords, br);
}

/** Rising steam puffs from 'o' (density 0..1). Uses anim time so it stops when asleep. */
fn steam(q: vec2f, o: vec2f, rise: f32, s: f32) -> f32 {
  var acc = 0.0;
  for (var i = 0; i < 4; i++) {
    let fi = f32(i);
    let ph = fract(g_t * 0.32 + fi * 0.25 + s * 0.37);
    let c = o + vec2f(sin(ph * 4.0 + fi * 2.1 + s) * 3.0 + ph * 7.0, ph * rise);
    let r = 3.0 + ph * 10.0;
    let k = 1.0 - smoothstep(r * 0.15, r, length(q - c));
    acc += k * (1.0 - ph) * smoothstep(0.0, 0.12, ph);
  }
  let n = engine_noise(q * 0.14 + vec2f(s, -g_t * 0.9));
  return clamp(acc * (0.55 + 0.7 * n), 0.0, 1.0);
}

/** Embers or sparks rising from 'o'. */
fn sparks(q: vec2f, o: vec2f, rise: f32, col: vec3f, k: f32) {
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    let ph = fract(g_t * 0.7 + fi * 0.33);
    let c = o + vec2f(sin(fi * 7.0 + ph * 6.0) * 6.0, ph * rise);
    g_glow += col * k * (1.0 - ph) * exp(-length(q - c) * 0.9);
  }
}
`;

const MACHINES_WGSL = /* wgsl */ `
// 0 Intake desk: clerk's desk, pigeonhole hutch, green banker's lamp, pneumatic tube.
fn m_desk(q: vec2f) {
  lay(sdg_box(q - vec2f(-34.0, 52.0), vec2f(5.0, 26.0), 2.0), a_brass(q), 5.0, 0.9, vec3f(0.0));
  lay(sdg_box(vec2f(q.x + 34.0, abs(q.y - 52.0) - 12.0), vec2f(7.0, 2.2), 1.0), a_iron(q), 1.5, 0.7, vec3f(0.0));
  // A capsule zips up the tube when alive.
  let cy = 30.0 + fract(g_t * 0.5) * 60.0;
  g_glow += C_AMBER * g_al * 0.6 * exp(-length((q - vec2f(-34.0, cy)) * vec2f(0.6, 0.35)));
  let hut = sdg_box(q - vec2f(4.0, 6.0), vec2f(44.0, 30.0), 2.0);
  lay(hut, a_wood(q), 3.0, 0.0, vec3f(0.0));
  let hp = q - vec2f(4.0, 6.0) + vec2f(38.0, 24.0);
  if (hp.x > 0.0 && hp.x < 76.0 && hp.y > 0.0 && hp.y < 48.0) {
    let cell = vec2f(19.0, 16.0);
    let id = floor(hp / cell);
    let lp = (fract(hp / cell) - 0.5) * cell;
    lay(sdg_box(lp, vec2f(7.5, 6.0), 1.0), vec3f(0.025, 0.018, 0.012), 1.0, 0.0, vec3f(0.0));
    if (engine_hash21(id + 3.0) > 0.35) {
      lay(sdg_box(lp - vec2f(0.0, -3.0), vec2f(5.5, 2.4), 0.5), C_PARCHMENT * 0.8, 1.0, 0.0,
          C_PARCHMENT * 0.12 * g_al);
    }
  }
  lay(sdg_box(q - vec2f(0.0, -26.0), vec2f(58.0, 5.0), 2.0), a_wood(q * 1.7) * 0.8, 3.0, 0.1, vec3f(0.0));
  lay(sdg_box(q - vec2f(-32.0, -48.0), vec2f(20.0, 17.0), 2.0), a_wood(q * 1.3), 3.0, 0.0, vec3f(0.0));
  lay(flat(max(abs(q.y + 48.0) - 0.8, abs(q.x + 32.0) - 17.0)), C_INK * 0.4, 0.5, 0.0, vec3f(0.0));
  lay(sdg_circle(vec2f(q.x + 32.0, abs(q.y + 48.0) - 8.0), 2.2), a_brass(q), 2.0, 0.9, vec3f(0.0));
  lay(sdg_box(q - vec2f(46.0, -48.0), vec2f(4.0, 17.0), 1.0), a_wood(q * 1.3), 2.0, 0.0, vec3f(0.0));
  // Open ledger and a brass bell.
  lay(sdg_box(q - vec2f(-6.0, -19.0), vec2f(13.0, 2.2), 0.8), C_PARCHMENT * 0.85, 1.0, 0.0, C_PARCHMENT * 0.08 * g_al);
  lay(sdg_intersect(sdg_circle(q - vec2f(-34.0, -21.0), 5.5), hplane(q, vec2f(0.0, -21.0), vec2f(0.0, -1.0))),
      a_brass(q), 4.0, 0.9, vec3f(0.0));
  // Banker's lamp.
  lay(sdg_box(q - vec2f(30.0, -20.0), vec2f(7.0, 1.8), 0.8), a_brass(q), 1.0, 0.9, vec3f(0.0));
  lay(sdg_segment(q, vec2f(30.0, -20.0), vec2f(30.0, -6.0), 1.4), a_brass(q), 1.4, 0.9, vec3f(0.0));
  let on = 0.12 * g_op + 0.88 * g_al;
  lay(sdg_intersect(sdg_ellipse(q - vec2f(30.0, -5.0), vec2f(14.0, 9.0)), hplane(q, vec2f(0.0, -5.0), vec2f(0.0, -1.0))),
      C_EMERALD * 0.45, 6.0, 0.4, C_EMERALD * 0.5 * on);
  g_glow += C_WARM * on * 0.5 * exp(-length((q - vec2f(30.0, -16.0)) * vec2f(0.55, 1.3)) / 9.0);
}

// 1 Furnace: brick beehive kiln with a glowing mouth behind a grate, and a tall chimney.
fn m_furnace(q: vec2f) {
  let fireK = mix(0.14 * g_op, 1.0, g_al) * (0.85 + 0.15 * sin(g_now * 13.0) * sin(g_now * 5.3));
  lay(sdg_box(q - vec2f(30.0, 12.0), vec2f(10.0, 42.0), 1.0), a_brick(q), 4.0, 0.0, vec3f(0.0));
  lay(sdg_box(q - vec2f(30.0, 55.0), vec2f(13.0, 4.0), 1.5), a_iron(q), 2.0, 0.7, vec3f(0.0));
  g_steam = max(g_steam, steam(q, vec2f(30.0, 60.0), 26.0, 1.0) * g_al * 0.8);
  sparks(q, vec2f(30.0, 60.0), 24.0, C_AMBER * 2.0, g_al);
  let body = sdg_union(sdg_box(q - vec2f(-10.0, -44.0), vec2f(46.0, 20.0), 3.0),
                       sdg_ellipse(q - vec2f(-10.0, -24.0), vec2f(46.0, 40.0)));
  lay(body, a_brick(q), 10.0, 0.0, vec3f(0.0));
  lay(sdg_intersect(sdg_box(q - vec2f(-10.0, -22.0), vec2f(50.0, 2.6), 1.0), body), a_iron(q), 1.5, 0.7, vec3f(0.0));
  let mo = q - vec2f(-10.0, -48.0);
  lay(sdg_union(sdg_box(mo, vec2f(22.0, 12.0), 0.0), sdg_circle(mo - vec2f(0.0, 10.0), 22.0)),
      a_stone(q), 3.0, 0.0, vec3f(0.0));
  let mouth = sdg_union(sdg_box(mo, vec2f(17.0, 11.0), 0.0), sdg_circle(mo - vec2f(0.0, 10.0), 17.0));
  let fb = engine_fbm(mo * vec2f(0.12, 0.08) + vec2f(g_seed, -g_t * 2.0), 3);
  let heat = clamp(fb * 1.4 - (mo.y + 2.0) / 30.0, 0.0, 1.4);
  let fire = mix(C_DANGER * 0.7, C_AMBER * 1.8 + vec3f(0.35, 0.25, 0.05), heat) * fireK;
  lay(mouth, vec3f(0.02) + fire * 0.3, 2.0, 0.0, fire * 1.3);
  let bx = mo.x - clamp(round(mo.x / 9.0) * 9.0, -9.0, 9.0);
  lay(sdg_intersect(sdg_box(vec2f(bx, mo.y - 4.0), vec2f(1.6, 30.0), 0.5), mouth), a_iron(q) * 0.7, 1.0, 0.6, vec3f(0.0));
  g_glow += fire * 0.22 * exp(-length((q - vec2f(-10.0, -58.0)) * vec2f(0.45, 1.2)) / 14.0);
  lay(sdg_ellipse(q - vec2f(40.0, -62.0), vec2f(16.0, 6.0)), vec3f(0.04), 4.0, 0.2, C_DANGER * 0.5 * g_al * step(0.6, engine_noise(q * 0.6)));
}

// 2 Splitter mill: spoked gear on an A-frame, hopper above, a Y chute splitting into two bins.
fn m_mill(q: vec2f) {
  lay(sdg_segment(q, vec2f(-42.0, -64.0), vec2f(-4.0, 14.0), 3.5), a_iron(q), 3.0, 0.6, vec3f(0.0));
  lay(sdg_segment(q, vec2f(42.0, -64.0), vec2f(4.0, 14.0), 3.5), a_iron(q), 3.0, 0.6, vec3f(0.0));
  let hp = q - vec2f(0.0, 54.0);
  let hop = sdg_intersect(sdg_box(hp, vec2f(28.0, 10.0), 1.0),
                          hplane(vec2f(abs(hp.x), hp.y), vec2f(10.0, -10.0), normalize(vec2f(1.0, -0.9))));
  lay(sdg_union(hop, sdg_box(q - vec2f(0.0, 40.0), vec2f(6.0, 6.0), 1.0)), a_wood(q), 3.0, 0.0, vec3f(0.0));
  lay(sdg_box(hp - vec2f(0.0, 9.0), vec2f(26.0, 2.0), 0.8), a_iron(q), 1.0, 0.6, vec3f(0.0));
  // Chutes.
  lay(sdg_box(q - vec2f(0.0, -18.0), vec2f(11.0, 6.0), 1.5), a_iron(q), 2.0, 0.6, vec3f(0.0));
  lay(sdg_segment(vec2f(abs(q.x), q.y), vec2f(6.0, -20.0), vec2f(44.0, -44.0), 4.5), a_iron(q) * 1.1, 4.0, 0.6, vec3f(0.0));
  lay(sdg_box(vec2f(abs(q.x) - 46.0, q.y + 56.0), vec2f(13.0, 8.0), 1.5), a_wood(q * 1.3), 2.0, 0.0, vec3f(0.0));
  let fill = 0.25 + 0.75 * g_al;
  lay(sdg_box(vec2f(abs(q.x) - 46.0, q.y + 48.5), vec2f(10.0, 2.2), 1.0), g_acc * 0.4 * fill, 1.0, 0.0, g_acc * 1.4 * g_al);
  // The gear itself.
  let wq = q - vec2f(0.0, 12.0);
  lay(gear(wq, 30.0, 12.0, g_t * 0.9), a_brass(q), 4.0, 0.9, vec3f(0.0));
  lay(sdg_circle(wq, 6.0), a_iron(q), 3.0, 0.7, vec3f(0.0));
  // Glints sliding down both chutes.
  let ph = fract(g_t * 0.6);
  let gp = mix(vec2f(6.0, -15.0), vec2f(44.0, -39.0), ph);
  g_glow += g_acc * g_al * 1.2 * (1.0 - ph) * exp(-length(vec2f(abs(q.x), q.y) - gp) * 0.5);
}

// 3 Relay tower: tapering lattice mast, insulator crossarms, a beacon broadcasting rings.
fn m_relay(q: vec2f) {
  lay(sdg_box(q - vec2f(0.0, -60.0), vec2f(36.0, 4.0), 1.0), a_stone(q), 2.0, 0.0, vec3f(0.0));
  lay(flat(truss(q.y, q.x, -56.0, 64.0, 30.0, 5.0, 15.0, 1.4)), a_iron(q) * 1.15, 1.0, 0.7, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 50.0), vec2f(34.0, 2.4), 0.5), a_iron(q), 1.0, 0.7, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 26.0), vec2f(26.0, 2.2), 0.5), a_iron(q), 1.0, 0.7, vec3f(0.0));
  let ax = abs(q.x);
  lay(sdg_segment(vec2f(ax, q.y), vec2f(31.0, 42.0), vec2f(64.0, 36.0), 0.6), C_IRON_DARK, 0.5, 0.5, vec3f(0.0));
  lay(sdg_segment(vec2f(ax, q.y), vec2f(23.0, 18.0), vec2f(64.0, 12.0), 0.6), C_IRON_DARK, 0.5, 0.5, vec3f(0.0));
  let ins = sdg_union(sdg_box(vec2f(ax - 31.0, q.y - 44.0), vec2f(3.2, 6.0), 2.0),
                      sdg_box(vec2f(ax - 23.0, q.y - 20.0), vec2f(3.0, 5.0), 2.0));
  let rib = 0.75 + 0.25 * step(0.5, fract(q.y / 3.0));
  lay(ins, C_PARCHMENT * 0.55 * rib, 2.5, 0.2, vec3f(0.0));
  let blink = step(0.45, fract(g_now * 0.7));
  lamp(q, vec2f(0.0, 70.0), 4.0, C_DANGER * 1.3, 0.15 * g_op + g_al * blink);
  for (var i = 0; i < 2; i++) {
    let ph = fract(g_t * 0.45 + f32(i) * 0.5);
    let rr = 8.0 + ph * 48.0;
    g_glow += g_acc * g_al * 0.5 * (1.0 - ph) * exp(-abs(length(q - vec2f(0.0, 70.0)) - rr) * 0.9);
  }
}

// 4 Conveyor A: inclined belt on rollers with crates riding up it.
fn m_conveyor(q: vec2f) {
  let A = vec2f(-48.0, -36.0);
  let B = vec2f(44.0, 26.0);
  let dir = normalize(B - A);
  let nrm = vec2f(-dir.y, dir.x);
  let len = length(B - A);
  let ang = atan2(dir.y, dir.x);
  lay(sdg_box(q - vec2f(-52.0, -55.0), vec2f(11.0, 9.0), 1.5), a_wood(q), 2.0, 0.0, vec3f(0.0));
  lay(sdg_box(q - vec2f(-28.0, -44.0), vec2f(3.0, 20.0), 1.0), a_iron(q), 2.0, 0.6, vec3f(0.0));
  lay(sdg_box(q - vec2f(18.0, -28.0), vec2f(3.0, 36.0), 1.0), a_iron(q), 2.0, 0.6, vec3f(0.0));
  lay(sdg_segment(q, vec2f(-28.0, -60.0), vec2f(18.0, -20.0), 1.4), a_iron(q) * 0.8, 1.0, 0.6, vec3f(0.0));
  lay(sdg_box(q - vec2f(-28.0, -62.0), vec2f(7.0, 2.0), 0.5), a_iron(q), 1.0, 0.6, vec3f(0.0));
  lay(sdg_box(q - vec2f(18.0, -62.0), vec2f(7.0, 2.0), 0.5), a_iron(q), 1.0, 0.6, vec3f(0.0));
  // Frame, then the belt with moving treads.
  lay(sdg_segment(q, A, B, 7.5), a_iron(q) * 0.9, 3.0, 0.6, vec3f(0.0));
  let s = dot(q - A, dir);
  let tread = step(0.5, fract((s - g_t * 16.0) / 7.0));
  lay(sdg_segment(q, A + nrm * 4.0, B + nrm * 4.0, 3.2), vec3f(0.035 + 0.03 * tread), 2.0, 0.1, vec3f(0.0));
  // Chevrons along the frame light up when running.
  let along = step(8.0, s) * step(s, len - 8.0);
  let dash = step(0.6, fract((s - g_t * 20.0) / 12.0));
  g_glow += g_acc * g_al * 0.6 * dash * along * exp(-abs(dot(q - A, nrm) + 3.5) * 0.9);
  for (var i = 0; i < 2; i++) {
    let rc = select(A, B, i == 1);
    lay(sdg_circle(q - rc, 7.0), a_brass(q), 4.0, 0.9, vec3f(0.0));
    let sp = rot2(-g_t * 2.2) * (q - rc);
    lay(sdg_intersect(flat(abs(sp.y) - 1.0), sdg_circle(q - rc, 5.0)), C_INK * 0.5, 0.5, 0.0, vec3f(0.0));
  }
  for (var i = 0; i < 3; i++) {
    let si = 12.0 + fract(g_t * 0.11 + f32(i) / 3.0) * (len - 24.0);
    let pc = A + dir * si + nrm * 14.0;
    let cr = rbox(q, pc, vec2f(7.5, 6.5), 1.0, ang);
    lay(cr, a_wood(q * 1.4 + f32(i) * 9.0), 2.0, 0.0, vec3f(0.0));
    let lq = rot2(-ang) * (q - pc);
    let x = min(abs(lq.x - lq.y * 1.15), abs(lq.x + lq.y * 1.15)) * 0.65 - 0.7;
    lay(sdg_intersect(flat(x), cr), a_wood(q) * 0.55, 0.5, 0.0, vec3f(0.0));
  }
}

// 5 Press Unit 4: two columns, a heavy crown with a cylinder, a ram stamping a hot plate.
fn m_press(q: vec2f) {
  lay(sdg_box(q - vec2f(0.0, -61.0), vec2f(54.0, 4.0), 1.0), a_iron(q) * 0.7, 2.0, 0.6, vec3f(0.0));
  lay(sdg_box(vec2f(abs(q.x) - 37.0, q.y + 6.0), vec2f(6.0, 52.0), 1.5), a_iron(q) * 1.1, 6.0, 0.8, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, -48.0), vec2f(40.0, 9.0), 2.0), a_iron(q), 3.0, 0.6, vec3f(0.0));
  let cyc = fract(g_t * 0.45);
  let down = smoothstep(0.0, 0.14, cyc) * (1.0 - smoothstep(0.24, 0.9, cyc));
  let yR = 20.0 - 44.0 * down;
  lay(sdg_box(q - vec2f(0.0, (38.0 + yR) * 0.5), vec2f(4.5, max((38.0 - yR) * 0.5, 0.5)), 1.0),
      C_MIST * 0.55, 4.5, 1.0, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, yR), vec2f(27.0, 9.0), 2.0), a_iron(q) * 1.25, 3.0, 0.7, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, yR - 9.5), vec2f(23.0, 1.5), 0.5), a_brass(q), 1.0, 0.9, vec3f(0.0));
  let hot = 0.12 * g_op + 0.88 * g_al;
  lay(sdg_box(q - vec2f(0.0, -36.5), vec2f(17.0, 2.6), 1.0), mix(a_iron(q), C_AMBER * 0.9, hot),
      1.0, 0.4, C_AMBER * 1.4 * hot);
  let hit = smoothstep(0.1, 0.14, cyc) * (1.0 - smoothstep(0.14, 0.32, cyc));
  g_glow += C_AMBER * g_al * hit * 1.2 * exp(-length((q - vec2f(0.0, -35.0)) * vec2f(0.35, 1.0)) / 6.0);
  // Crown with a stencilled 4, and the hydraulic cylinder on top.
  lay(sdg_box(q - vec2f(0.0, 68.0), vec2f(15.0, 8.0), 3.0), a_brass(q), 6.0, 0.9, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 50.0), vec2f(50.0, 12.0), 3.0), a_iron(q), 4.0, 0.6, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 50.0), vec2f(50.0, 2.2), 0.5), a_brass(q), 1.0, 0.9, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 50.0), vec2f(9.0, 8.5), 1.5), C_INK * 0.6, 1.0, 0.2, vec3f(0.0));
  let gq = q - vec2f(0.0, 50.0);
  let four = min(min(sdg_segment(gq, vec2f(2.0, 6.0), vec2f(-5.0, -2.0), 1.3).x,
                     sdg_segment(gq, vec2f(-5.0, -2.0), vec2f(5.0, -2.0), 1.3).x),
                 sdg_segment(gq, vec2f(2.5, 6.0), vec2f(2.5, -6.5), 1.3).x);
  lay(flat(four), C_GOLD * 0.9, 0.5, 0.6, C_GOLD * (0.15 * g_op + 0.7 * g_al));
}

// 6 Storm Cell II: Tesla coil with a toroid, Leyden jars, and arcs when alive.
fn m_storm(q: vec2f) {
  lay(sdg_box(q - vec2f(0.0, -57.0), vec2f(30.0, 7.0), 2.0), a_iron(q), 3.0, 0.6, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, -49.5), vec2f(30.0, 1.6), 0.5), a_brass(q), 1.0, 0.9, vec3f(0.0));
  let jq = vec2f(abs(q.x) - 45.0, q.y + 46.0);
  let jar = sdg_box(jq, vec2f(9.0, 15.0), 4.0);
  lay(jar, vec3f(0.07, 0.1, 0.12), 4.0, 0.3, g_acc * 0.25 * g_al);
  lay(sdg_intersect(jar, hplane(jq, vec2f(0.0, -1.0), vec2f(0.0, 1.0))), a_brass(q) * 0.8, 3.0, 0.9, vec3f(0.0));
  lay(sdg_segment(jq, vec2f(0.0, 14.0), vec2f(0.0, 21.0), 1.0), a_brass(q), 1.0, 0.9, vec3f(0.0));
  lay(sdg_circle(jq - vec2f(0.0, 22.0), 2.6), a_brass(q), 2.0, 0.9, vec3f(0.0));
  let cq = q - vec2f(0.0, -10.0);
  let wl = abs(fract(cq.y / 3.0) - 0.5) * 3.0;
  lay(sdg_box(cq, vec2f(11.0, 38.0), 3.0), a_copper(q) * (0.55 + 0.45 * smoothstep(0.2, 0.9, wl)),
      11.0, 0.9, g_acc * 0.08 * g_al);
  lay(sdg_segment(q, vec2f(0.0, 28.0), vec2f(0.0, 48.0), 1.6), C_MIST * 0.5, 1.5, 1.0, vec3f(0.0));
  lay(sdg_ellipse(q - vec2f(0.0, 32.0), vec2f(28.0, 8.0)), C_MIST * 0.55, 8.0, 1.0, vec3f(0.0));
  lay(sdg_circle(q - vec2f(0.0, 50.0), 6.0), C_MIST * 0.6, 6.0, 1.0, C_ICE * 0.4 * g_al);
  // Arcs: jagged, re-rolled ~12x per second, flung off the toroid.
  let ax = abs(q.x);
  let fr = floor(g_now * 12.0);
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    let on = step(0.35, engine_hash21(vec2f(fr, fi + sign(q.x) * 7.0)));
    let y = 34.0 + (engine_noise(vec2f(ax * 0.22 + fr * 3.1, fi * 5.0)) - 0.5) * 22.0 + (ax - 26.0) * (fi - 1.0) * 0.5;
    let d = abs(q.y - y);
    let span = smoothstep(24.0, 28.0, ax) * (1.0 - smoothstep(52.0, 60.0, ax));
    g_glow += C_ICE * 1.6 * g_al * on * span * (exp(-d * 1.1) + 0.2 * exp(-d * 0.2));
  }
  g_glow += C_ICE * g_al * 0.6 * exp(-length(q - vec2f(0.0, 50.0)) / 9.0);
}

// 7 Crane: lattice tower, yellow jib with counterweight, trolley, hook and a swinging crate.
fn m_crane(q: vec2f) {
  lay(sdg_box(q - vec2f(-36.0, -61.0), vec2f(17.0, 4.0), 1.0), a_stone(q), 2.0, 0.0, vec3f(0.0));
  lay(flat(truss(q.y, q.x + 36.0, -58.0, 44.0, 10.0, 8.0, 13.0, 1.3)), a_iron(q) * 1.1, 1.0, 0.7, vec3f(0.0));
  // Tie lines from the mast head.
  lay(sdg_segment(q, vec2f(-36.0, 70.0), vec2f(56.0, 54.0), 0.7), C_IRON_DARK, 0.5, 0.5, vec3f(0.0));
  lay(sdg_segment(q, vec2f(-36.0, 70.0), vec2f(-58.0, 54.0), 0.7), C_IRON_DARK, 0.5, 0.5, vec3f(0.0));
  lay(sdg_segment(q, vec2f(-36.0, 52.0), vec2f(-36.0, 71.0), 1.8), a_paint(q), 1.5, 0.4, vec3f(0.0));
  lay(flat(truss(q.x, q.y - 49.0, -58.0, 58.0, 5.0, 3.2, 10.0, 1.1)), a_paint(q), 1.0, 0.4, vec3f(0.0));
  lay(sdg_box(q - vec2f(-53.0, 42.0), vec2f(7.0, 8.0), 1.0), a_stone(q) * 0.9, 2.0, 0.0, vec3f(0.0));
  lay(sdg_box(q - vec2f(-36.0, 34.0), vec2f(12.0, 9.0), 2.0), a_paint(q), 3.0, 0.4, vec3f(0.0));
  let on = 0.1 * g_op + 0.9 * g_al;
  lay(sdg_box(q - vec2f(-31.0, 36.0), vec2f(5.5, 4.0), 1.0), vec3f(0.05, 0.07, 0.09) + C_WARM * on * 0.5,
      1.0, 0.1, C_WARM * on);
  let xT = 24.0 + 16.0 * sin(g_t * 0.5);
  let yH = -8.0 + 6.0 * sin(g_t * 0.8 + 1.0);
  lay(sdg_box(q - vec2f(xT, 43.0), vec2f(6.0, 2.6), 1.0), a_iron(q), 1.5, 0.6, vec3f(0.0));
  lay(sdg_segment(q, vec2f(xT, 42.0), vec2f(xT, yH + 4.0), 0.6), C_IRON_DARK, 0.5, 0.5, vec3f(0.0));
  lay(sdg_intersect(sdg_ring(q - vec2f(xT, yH + 1.0), 3.5, 1.1), hplane(q, vec2f(0.0, yH + 2.0), vec2f(0.0, 1.0))),
      a_iron(q) * 1.3, 1.0, 0.8, vec3f(0.0));
  let cq = q - vec2f(xT, yH - 12.0);
  let box1 = sdg_box(cq, vec2f(12.0, 9.0), 1.0);
  lay(box1, a_wood(q * 1.3), 2.0, 0.0, vec3f(0.0));
  let xb = min(abs(cq.x - cq.y * 1.3), abs(cq.x + cq.y * 1.3)) * 0.6 - 0.8;
  let border = -max(abs(cq.x) - 9.5, abs(cq.y) - 6.5);
  lay(sdg_intersect(flat(min(xb, border)), box1), a_wood(q) * 0.5, 0.5, 0.0, vec3f(0.0));
  lamp(q, vec2f(57.0, 56.0), 2.4, C_AMBER * 1.4, g_al * step(0.5, fract(g_now * 0.9)));
}

// 8 Boiler room: riveted horizontal boiler on saddles, steam dome, pipes, valve wheel, gauge.
fn m_boiler(q: vec2f) {
  lay(sdg_box(vec2f(abs(q.x - 2.0) - 30.0, q.y + 57.0), vec2f(7.0, 8.0), 1.0), a_iron(q) * 0.7, 2.0, 0.6, vec3f(0.0));
  // Pipework behind the tank.
  lay(sdg_segment(q, vec2f(-10.0, 4.0), vec2f(-10.0, 52.0), 3.6), a_iron(q), 3.6, 0.7, vec3f(0.0));
  lay(sdg_segment(q, vec2f(-10.0, 52.0), vec2f(16.0, 52.0), 3.6), a_iron(q), 3.6, 0.7, vec3f(0.0));
  lay(sdg_box(q - vec2f(16.0, 56.0), vec2f(5.0, 3.0), 1.0), a_brass(q), 2.0, 0.9, vec3f(0.0));
  lay(sdg_circle(q - vec2f(-10.0, 52.0), 5.0), a_iron(q) * 1.2, 4.0, 0.7, vec3f(0.0));
  g_steam = max(g_steam, steam(q, vec2f(16.0, 60.0), 22.0, 0.0) * g_al);
  // Valve wheel on the riser.
  let vq = q - vec2f(-10.0, 34.0);
  let va = atan2(vq.y, vq.x) - g_t * 0.4;
  let spokes = abs(sin(va * 2.0)) * length(vq) - 1.2;
  lay(sdg_union(sdg_ring(vq, 7.5, 1.6), flat(max(spokes, length(vq) - 7.0))), C_DANGER * 0.65, 1.5, 0.4, vec3f(0.0));
  let tk = q - vec2f(2.0, -26.0);
  let tank = sdg_box(tk, vec2f(52.0, 24.0), 22.0);
  lay(tank, mix(a_iron(q), C_RUST * 0.75, 0.3) * 1.1, 22.0, 0.6, vec3f(0.0));
  let sx = vec2f(abs(tk.x + 1.0) - 19.0, tk.y);
  lay(sdg_intersect(sdg_box(sx, vec2f(1.4, 30.0), 0.0), tank), a_iron(q) * 0.6, 1.0, 0.6, vec3f(0.0));
  let rv = vec2f(sx.x - 3.5, (fract(tk.y / 6.0) - 0.5) * 6.0);
  lay(sdg_intersect(sdg_circle(rv, 1.2), sdg_box(tk, vec2f(52.0, 21.0), 18.0)), a_iron(q) * 1.6, 1.2, 0.8, vec3f(0.0));
  // Firebox door at the front end.
  let fireK = mix(0.12 * g_op, 1.0, g_al) * (0.85 + 0.15 * sin(g_now * 11.0));
  lay(sdg_circle(tk - vec2f(-36.0, -4.0), 9.0), a_brass(q), 3.0, 0.9, vec3f(0.0));
  lay(sdg_circle(tk - vec2f(-36.0, -4.0), 6.0), vec3f(0.03) + C_AMBER * fireK * 0.4, 2.0, 0.0, C_AMBER * 1.4 * fireK);
  g_glow += C_AMBER * fireK * 0.25 * exp(-length(tk - vec2f(-36.0, -4.0)) / 10.0);
  lay(sdg_box(q - vec2f(-10.0, 6.0), vec2f(10.0, 9.0), 5.0), a_brass(q), 6.0, 0.9, vec3f(0.0));
  lay(sdg_segment(q, vec2f(30.0, -2.0), vec2f(30.0, 14.0), 2.0), a_brass(q), 2.0, 0.9, vec3f(0.0));
  gauge(q, vec2f(30.0, 25.0), 12.0, 0.12 + 0.62 * g_al + 0.04 * sin(g_now * 3.0) * g_al);
}

// 9 Archive: tall bookcase of coloured spines, a rolling ladder, a lantern on top.
fn m_archive(q: vec2f) {
  let cq = q - vec2f(-8.0, -6.0);
  lay(sdg_box(cq, vec2f(43.0, 58.0), 2.0), a_wood(q) * 0.9, 3.0, 0.0, vec3f(0.0));
  lay(sdg_box(cq - vec2f(0.0, 59.0), vec2f(46.0, 3.0), 1.0), a_wood(q * 1.5) * 0.8, 2.0, 0.0, vec3f(0.0));
  let inner = sdg_box(cq - vec2f(0.0, -1.0), vec2f(38.0, 53.0), 1.0);
  if (inner.x < 1.0) {
    lay(inner, vec3f(0.03, 0.02, 0.015), 1.0, 0.0, vec3f(0.0));
    let yy = cq.y + 54.0;
    let b = floor(yy / 27.0);
    let ly = yy - b * 27.0;
    let bi = floor((cq.x + 38.0) / 5.5);
    let lx = (fract((cq.x + 38.0) / 5.5) - 0.5) * 5.5;
    let h = engine_hash21(vec2f(bi, b) + g_seed);
    let h2 = engine_hash21(vec2f(b, bi) + 3.7);
    let bh = 13.0 + h * 9.0;
    var col = C_RUST * 1.1;
    if (h2 > 0.8) { col = vec3f(0.08, 0.22, 0.13); }
    else if (h2 > 0.6) { col = vec3f(0.22, 0.09, 0.24); }
    else if (h2 > 0.4) { col = C_PARCHMENT * 0.55; }
    else if (h2 > 0.2) { col = vec3f(0.08, 0.11, 0.28); }
    if (h > 0.08) {
      let book = sdg_intersect(sdg_box(vec2f(lx, ly - 3.0 - bh * 0.5), vec2f(2.3, bh * 0.5), 0.6), inner);
      let band = 1.0 - smoothstep(0.4, 0.9, abs(ly - 3.0 - bh * 0.72));
      lay(book, mix(col, C_GOLD, band * 0.6), 1.5, 0.1, C_GOLD * band * 0.35 * g_al);
    }
    lay(sdg_intersect(flat(abs(ly - 1.5) - 1.6), inner), a_wood(q * 2.0) * 0.75, 1.0, 0.0, vec3f(0.0));
  }
  // Rolling ladder.
  let lean = (q.y + 64.0) * 0.1;
  let rx = q.x - 34.0 - lean;
  lay(flat(max(min(abs(rx) - 1.4, abs(rx - 11.0) - 1.4), max(-64.0 - q.y, q.y - 52.0))), a_brass(q), 1.0, 0.9, vec3f(0.0));
  let rung = abs(fract((q.y + 58.0) / 11.0) - 0.5) * 11.0 - 1.0;
  lay(flat(max(rung, max(-rx, rx - 11.0))), a_wood(q), 1.0, 0.0, vec3f(0.0));
  // Lantern on top.
  lay(sdg_box(q - vec2f(-28.0, 64.0), vec2f(6.0, 8.0), 2.0), a_iron(q), 1.5, 0.7, vec3f(0.0));
  lamp(q, vec2f(-28.0, 64.0), 4.0, C_WARM * 1.4, 0.1 * g_op + g_al * (0.9 + 0.1 * sin(g_now * 7.0)));
}

// 10 Foundry: gantry with a crucible on chains that tips molten metal into an ingot mould.
fn m_foundry(q: vec2f) {
  lay(sdg_box(vec2f(abs(q.x) - 50.0, q.y + 8.0), vec2f(4.0, 56.0), 1.0), a_iron(q), 3.0, 0.7, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 48.0), vec2f(58.0, 5.0), 1.0), a_iron(q) * 1.1, 3.0, 0.7, vec3f(0.0));
  let pour = g_al * (0.5 + 0.5 * sin(g_t * 0.6));
  let tilt = -(0.1 + 0.55 * pour);
  let P = vec2f(-10.0, 18.0);
  let link = 0.7 + 0.3 * step(0.5, fract(q.y / 4.0));
  lay(sdg_segment(q, vec2f(-24.0, 43.0), P, 1.2), C_IRON_DARK * 1.4 * link, 1.0, 0.7, vec3f(0.0));
  lay(sdg_segment(q, vec2f(4.0, 43.0), P, 1.2), C_IRON_DARK * 1.4 * link, 1.0, 0.7, vec3f(0.0));
  let lc = rot2(-tilt) * (q - P);
  let hot = 0.15 * g_op + 0.85 * g_al;
  lay(sdg_intersect(sdg_ring(lc - vec2f(0.0, -6.0), 22.0, 1.3), flat(-(lc.y + 6.0))), a_iron(q), 1.0, 0.7, vec3f(0.0));
  let bq = lc - vec2f(0.0, -18.0);
  let bucket = sdg_box(bq, vec2f(17.0 + bq.y * 0.22, 13.0), 4.0);
  lay(bucket, a_iron(q) * 0.85, 6.0, 0.6, C_DANGER * 0.12 * hot * smoothstep(-13.0, 10.0, bq.y));
  lay(sdg_box(lc - vec2f(0.0, -5.0), vec2f(21.0, 2.6), 1.2), a_iron(q) * 1.2, 1.5, 0.7, vec3f(0.0));
  lay(sdg_ellipse(lc - vec2f(0.0, -3.0), vec2f(17.0, 2.2)), C_AMBER * hot, 1.0, 0.0, C_AMBER * 1.8 * hot);
  // Molten stream from the lip.
  let lip = P + rot2(tilt) * vec2f(21.0, -4.0);
  let on = smoothstep(0.35, 0.55, pour);
  let sx = q.x - lip.x - 2.0 - sin(q.y * 0.35 + g_now * 10.0) * 0.8;
  let yin = step(-48.0, q.y) * step(q.y, lip.y);
  let sd = abs(sx) - 1.8;
  g_glow += (C_AMBER * 1.8 + vec3f(0.3, 0.2, 0.0)) * on * yin * (exp(-max(sd, 0.0) * 1.2) * 0.9);
  // Ingot mould.
  lay(sdg_box(q - vec2f(18.0, -55.0), vec2f(32.0, 8.0), 1.0), a_iron(q) * 0.65, 2.0, 0.6, vec3f(0.0));
  let mq = vec2f((fract((q.x - 18.0 + 30.0) / 20.0) - 0.5) * 20.0, q.y + 51.0);
  let slot = sdg_intersect(sdg_box(mq, vec2f(7.0, 2.4), 0.8), sdg_box(q - vec2f(18.0, -55.0), vec2f(30.0, 8.0), 0.0));
  lay(slot, C_AMBER * 0.6 * hot, 1.0, 0.0, C_AMBER * 1.3 * hot);
  sparks(q, vec2f(lip.x + 2.0, -46.0), 22.0, C_AMBER * 2.0, on);
}

// 11 Capacitor bay: three tall capacitor cans with ceramic insulators, bus bar, charge windows.
fn m_caps(q: vec2f) {
  lay(sdg_box(q - vec2f(0.0, -61.0), vec2f(56.0, 4.0), 1.0), a_iron(q) * 0.8, 2.0, 0.6, vec3f(0.0));
  lay(sdg_segment(q, vec2f(-36.0, 18.0), vec2f(0.0, 34.0), 1.7), a_copper(q), 1.7, 0.9, vec3f(0.0));
  lay(sdg_segment(q, vec2f(36.0, 18.0), vec2f(0.0, 34.0), 1.7), a_copper(q), 1.7, 0.9, vec3f(0.0));
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    let xi = (fi - 1.0) * 36.0;
    let hh = select(26.0, 33.0, i == 1);
    let cy = -57.0 + hh;
    let cq = q - vec2f(xi, cy);
    if (abs(cq.x) > 18.0) { continue; }
    let body = sdg_box(cq, vec2f(13.0, hh), 5.0);
    let band = step(abs(abs(cq.y) - hh + 6.0), 1.6);
    lay(body, mix(a_iron(q), C_SLATE * 1.6, 0.35) * (1.0 - 0.35 * band), 13.0, 0.7, vec3f(0.0));
    let win = sdg_box(cq, vec2f(3.6, hh - 11.0), 1.5);
    let lvl = (0.2 + 0.8 * fract(g_t * 0.22 + fi * 0.31)) * g_al + 0.08 * g_op;
    let top = -(hh - 11.0) + 2.0 * (hh - 11.0) * lvl;
    let filled = step(cq.y, top);
    lay(win, vec3f(0.03, 0.04, 0.05) + g_acc * 0.4 * filled * lvl, 1.0, 0.1, g_acc * 1.5 * filled * (0.3 + 0.7 * g_al));
    let iq = cq - vec2f(0.0, hh);
    lay(sdg_box(iq - vec2f(0.0, 6.0), vec2f(3.0, 7.0), 1.0), C_PARCHMENT * 0.5, 2.0, 0.2, vec3f(0.0));
    for (var j = 0; j < 3; j++) {
      lay(sdg_ellipse(iq - vec2f(0.0, 2.0 + f32(j) * 4.0), vec2f(8.0 - f32(j) * 1.4, 2.0)), C_PARCHMENT * 0.65, 2.0, 0.2, vec3f(0.0));
    }
    lay(sdg_circle(iq - vec2f(0.0, 16.0), 3.0), a_brass(q), 3.0, 0.9, vec3f(0.0));
    let zap = step(0.82, engine_hash21(vec2f(floor(g_now * 6.0), fi)));
    g_glow += g_acc * g_al * (0.25 + 1.2 * zap) * exp(-length(iq - vec2f(0.0, 16.0)) / 5.0);
  }
}

// 12 Lift shaft: braced cage, headframe with a turning pulley, a car riding up and down.
fn m_lift(q: vec2f) {
  let yc = -40.0 + 48.0 * (0.5 - 0.5 * cos(g_t * 0.55));
  let br = q.y + 64.0;
  let v = fract(br / 24.0);
  let u = q.x / 32.0;
  let dg = min(abs(u - (2.0 * v - 1.0)), abs(u + (2.0 * v - 1.0))) * 32.0 / sqrt(1.0 + 7.1) - 0.9;
  lay(flat(max(dg, max(abs(q.x) - 32.0, q.y - 56.0))), a_iron(q) * 0.45, 1.0, 0.5, vec3f(0.0));
  lay(flat(max(min(v, 1.0 - v) * 24.0 - 1.3, max(abs(q.x) - 34.0, q.y - 56.0))), a_iron(q) * 0.75, 1.0, 0.6, vec3f(0.0));
  lay(sdg_box(vec2f(abs(q.x) - 36.0, q.y - 2.0), vec2f(4.0, 66.0), 1.0), a_iron(q), 3.0, 0.7, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 58.0), vec2f(42.0, 4.0), 1.0), a_iron(q) * 1.1, 2.0, 0.7, vec3f(0.0));
  lay(sdg_segment(q, vec2f(-26.0, 62.0), vec2f(0.0, 74.0), 1.6), a_iron(q), 1.0, 0.7, vec3f(0.0));
  lay(sdg_segment(q, vec2f(26.0, 62.0), vec2f(0.0, 74.0), 1.6), a_iron(q), 1.0, 0.7, vec3f(0.0));
  // Counterweight on its own cable.
  let ycw = 22.0 - (yc + 40.0) * 0.8;
  lay(sdg_segment(q, vec2f(46.0, 58.0), vec2f(46.0, ycw), 0.6), C_IRON_DARK, 0.5, 0.5, vec3f(0.0));
  lay(sdg_box(q - vec2f(46.0, ycw - 7.0), vec2f(3.6, 8.0), 1.0), a_iron(q) * 0.9, 2.0, 0.6, vec3f(0.0));
  lay(sdg_segment(q, vec2f(0.0, 62.0), vec2f(0.0, yc + 22.0), 0.7), C_IRON_DARK, 0.5, 0.5, vec3f(0.0));
  lay(gear(q - vec2f(0.0, 66.0), 10.0, 10.0, g_t * 1.6), a_brass(q), 3.0, 0.9, vec3f(0.0));
  // The car.
  let cq = q - vec2f(0.0, yc);
  lay(sdg_box(cq, vec2f(25.0, 20.0), 1.5), a_brass(q) * 0.85, 3.0, 0.8, vec3f(0.0));
  lay(sdg_box(cq - vec2f(0.0, 21.0), vec2f(28.0, 2.2), 0.8), a_iron(q), 1.0, 0.7, vec3f(0.0));
  let on = 0.1 * g_op + 0.9 * g_al;
  let win = sdg_box(cq - vec2f(0.0, 1.0), vec2f(20.0, 15.0), 1.0);
  let warm = C_WARM * on * (0.35 + 0.65 * exp(-length(cq - vec2f(0.0, 12.0)) / 14.0));
  lay(win, vec3f(0.03, 0.03, 0.04) + warm * 0.35, 1.0, 0.0, warm * 0.8);
  let bx = (fract(cq.x / 6.0 + 0.5) - 0.5) * 6.0;
  lay(sdg_intersect(flat(abs(bx) - 0.8), win), a_brass(q), 0.8, 0.9, vec3f(0.0));
  g_glow += C_WARM * on * 0.15 * exp(-length(cq) / 22.0);
  lay(sdg_box(q - vec2f(0.0, -62.0), vec2f(40.0, 2.0), 0.5), a_iron(q), 1.0, 0.6, vec3f(0.0));
}

// 13 Roof array: tiled gable roof carrying a tilted array of collector panels and lightning rods.
fn m_roof(q: vec2f) {
  // Rods first (behind the panels).
  lay(sdg_segment(vec2f(abs(q.x), q.y), vec2f(50.0, -44.0), vec2f(50.0, 46.0), 1.0), a_iron(q), 1.0, 0.8, vec3f(0.0));
  lay(sdg_circle(vec2f(abs(q.x) - 50.0, q.y - 47.0), 2.2), a_brass(q), 2.0, 0.9, vec3f(0.0));
  lay(sdg_segment(q, vec2f(0.0, 10.0), vec2f(0.0, 76.0), 1.3), a_iron(q), 1.0, 0.8, vec3f(0.0));
  lay(sdg_circle(q - vec2f(0.0, 77.0), 3.0), a_brass(q), 3.0, 0.9, g_acc * 0.6 * g_al);
  // Struts and the array.
  lay(sdg_segment(q, vec2f(-28.0, -50.0), vec2f(-28.0, 0.0), 2.4), a_iron(q), 2.0, 0.7, vec3f(0.0));
  lay(sdg_segment(q, vec2f(28.0, -50.0), vec2f(28.0, 20.0), 2.4), a_iron(q), 2.0, 0.7, vec3f(0.0));
  let pa = 0.33;
  let pc = vec2f(0.0, 10.0);
  let frame = rbox(q, pc, vec2f(50.0, 17.0), 1.5, pa);
  lay(frame, a_iron(q) * 1.1, 2.0, 0.8, vec3f(0.0));
  let lp = rot2(-pa) * (q - pc) + vec2f(48.0, 15.0);
  if (lp.x > 0.0 && lp.x < 96.0 && lp.y > 0.0 && lp.y < 30.0) {
    let cell = vec2f(24.0, 15.0);
    let gp = (fract(lp / cell) - 0.5) * cell;
    let shim = 0.55 + 0.45 * sin(lp.x * 0.09 - g_now * 2.5 + floor(lp.y / 15.0));
    let col = vec3f(0.05, 0.08, 0.16) + C_ICE * 0.12 * g_op;
    lay(sdg_box(gp, vec2f(10.5, 6.0), 0.8), col + g_acc * 0.25 * g_al * shim, 1.0, 0.6,
        g_acc * (0.9 * shim * g_al + 0.08 * g_op));
  }
  // Roof.
  let rq = vec2f(abs(q.x), q.y + 64.0);
  let rn = normalize(vec2f(34.0, 60.0));
  let roof = sdg_intersect(vec3f(dot(rq - vec2f(0.0, 34.0), rn), rn.x * sign(q.x), rn.y), flat(-rq.y));
  let tile = 0.75 + 0.25 * step(0.5, fract((rq.y + rq.x * 0.57) / 6.0));
  lay(roof, C_SLATE * 1.5 * tile, 3.0, 0.2, vec3f(0.0));
  lay(sdg_box(q - vec2f(-34.0, -40.0), vec2f(5.0, 9.0), 1.0), a_brick(q), 2.0, 0.0, vec3f(0.0));
  g_steam = max(g_steam, steam(q, vec2f(-34.0, -30.0), 20.0, 2.0) * g_al * 0.6);
}

// 14 Control booth: small cabin with a big lit window, an operator inside, levers and lamps.
fn m_booth(q: vec2f) {
  lay(sdg_box(q - vec2f(0.0, -61.0), vec2f(48.0, 3.5), 1.0), a_stone(q), 2.0, 0.0, vec3f(0.0));
  lay(sdg_segment(q, vec2f(34.0, 35.0), vec2f(34.0, 62.0), 1.0), a_iron(q), 1.0, 0.8, vec3f(0.0));
  lamp(q, vec2f(34.0, 64.0), 2.6, C_DANGER * 1.3, 0.1 * g_op + g_al * step(0.5, fract(g_now * 0.8)));
  let cb = q - vec2f(0.0, -16.0);
  let plank = 0.82 + 0.18 * step(0.18, abs(fract(cb.y / 7.0) - 0.5));
  lay(sdg_box(cb, vec2f(44.0, 42.0), 2.0), mix(a_iron(q), C_VERDIGRIS * 0.6, 0.35) * plank, 3.0, 0.4, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 30.0), vec2f(52.0, 5.0), 1.5), a_iron(q) * 0.8, 2.0, 0.6, vec3f(0.0));
  lay(sdg_box(q - vec2f(0.0, 37.0), vec2f(40.0, 3.0), 1.0), a_iron(q) * 0.7, 1.5, 0.6, vec3f(0.0));
  let wq = q - vec2f(0.0, -2.0);
  lay(sdg_box(wq, vec2f(36.0, 18.0), 2.0), a_brass(q), 2.0, 0.9, vec3f(0.0));
  let win = sdg_box(wq, vec2f(32.0, 15.0), 1.0);
  let on = 0.1 * g_op + 0.9 * g_al;
  let warm = C_WARM * on * (0.45 + 0.55 * exp(-length(wq - vec2f(-6.0, 4.0)) / 18.0));
  let streak = (1.0 - smoothstep(0.0, 3.0, abs(wq.x + wq.y * 0.8 - 8.0))) * 0.06 * (1.0 - on);
  lay(win, vec3f(0.035, 0.05, 0.07) + streak + warm * 0.5, 1.0, 0.0, warm);
  if (win.x < 1.0 && on > 0.3) {
    // Operator silhouette and his screens (only once lit).
    let man = sdg_union(sdg_circle(wq - vec2f(-10.0, 0.0), 4.6), sdg_ellipse(wq - vec2f(-10.0, -13.0), vec2f(11.0, 8.0)));
    lay(sdg_intersect(man, win), vec3f(0.015), 1.0, 0.0, vec3f(0.0));
    let scr = sdg_intersect(sdg_box(vec2f(abs(wq.x - 16.0) - 6.0, wq.y + 7.0), vec2f(4.5, 3.5), 0.8), win);
    lay(scr, g_acc * 0.3 * on, 0.8, 0.0, g_acc * 1.4 * on);
  }
  lay(sdg_intersect(flat(min(abs(wq.x) - 1.0, abs(wq.y - 5.0) - 0.9)), win), a_brass(q), 0.8, 0.9, vec3f(0.0));
  g_glow += C_WARM * on * 0.18 * exp(-length((q - vec2f(0.0, -26.0)) * vec2f(0.6, 1.0)) / 18.0);
  // Lever panel and lamps.
  lay(sdg_box(q - vec2f(0.0, -38.0), vec2f(30.0, 8.0), 1.5), a_iron(q) * 0.75, 2.0, 0.6, vec3f(0.0));
  for (var i = 0; i < 4; i++) {
    let fi = f32(i);
    let lc = vec2f(-18.0 + fi * 12.0, -38.0);
    let blink = step(0.5, fract(g_now * 0.7 + fi * 0.27));
    let col = select(C_AMBER, g_acc, i % 2 == 0) * 1.4;
    lamp(q, lc, 2.4, col, 0.1 * g_op + g_al * blink);
  }
  lay(sdg_segment(q, vec2f(-26.0, -44.0), vec2f(-31.0, -54.0), 1.3), a_iron(q), 1.0, 0.7, vec3f(0.0));
  lay(sdg_circle(q - vec2f(-31.0, -55.0), 2.6), C_DANGER * 0.7, 2.0, 0.4, vec3f(0.0));
}
`;

export const HALL_MACHINE_WGSL = /* wgsl */ `
${PROP_COMMON_WGSL}
struct HallMachU { L: PropLights, a: vec4f };
@group(1) @binding(0) var<uniform> U: HallMachU;
${PARTS_WGSL}
${MACHINES_WGSL}

/** 1 where the alcove's grate bars or padlock cover this pixel (so they stay in front). */
fn grate_cut(q: vec2f, open: f32) -> f32 {
  let ap = q / 125.0;
  let aa = g_aa / 125.0;
  let lift = smoothstep(0.1, 0.9, open) * 1.9;
  let gp = ap - vec2f(0.0, lift);
  let bx = (fract(gp.x / 0.14 + 0.5) - 0.5) * 0.14;
  let bars = sdg_box(vec2f(bx, gp.y + 0.15), vec2f(0.018, 0.85), 0.01).x;
  let c1 = sdg_box(gp - vec2f(0.0, -0.32), vec2f(0.6, 0.02), 0.01).x;
  let c2 = sdg_box(gp - vec2f(0.0, 0.18), vec2f(0.6, 0.02), 0.01).x;
  let g = 1.0 - smoothstep(-aa, aa, min(bars, min(c1, c2)));
  let lockA = 1.0 - smoothstep(0.45, 0.6, open);
  let drop = smoothstep(0.25, 0.6, open);
  let lp = ap - vec2f(0.0, -0.12 - drop * drop * 0.9);
  let lk = (1.0 - smoothstep(-aa, aa, sdg_box(lp - vec2f(0.0, -0.01), vec2f(0.105, 0.16), 0.03).x)) * lockA;
  return max(g, lk);
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let kind = i32(in.params.x + 0.5);
  g_op = clamp(in.params.y, 0.0, 1.0);
  g_al = clamp(in.params.z, 0.0, 1.0);
  g_t = in.params.w;
  g_now = U.a.x;
  g_seed = f32(kind) * 7.31 + 1.0;
  g_acc = in.color.rgb;
  let q = vec2f(in.local.x - 0.5, 0.5 - in.local.y) * in.size + vec2f(0.0, ${HALL_MACHINE_LIFT}.0);
  g_aa = max(fwidth(q.x), fwidth(q.y));
  S.alb = vec3f(0.0);
  S.nrm = vec3f(0.0, 0.0, 1.0);
  S.met = 0.0;
  S.emi = vec3f(0.0);
  S.cov = 0.0;
  S.d = 1e5;
  g_glow = vec3f(0.0);
  g_steam = 0.0;

  switch kind {
    case 0: { m_desk(q); }
    case 1: { m_furnace(q); }
    case 2: { m_mill(q); }
    case 3: { m_relay(q); }
    case 4: { m_conveyor(q); }
    case 5: { m_press(q); }
    case 6: { m_storm(q); }
    case 7: { m_crane(q); }
    case 8: { m_boiler(q); }
    case 9: { m_archive(q); }
    case 10: { m_foundry(q); }
    case 11: { m_caps(q); }
    case 12: { m_lift(q); }
    case 13: { m_roof(q); }
    default: { m_booth(q); }
  }

  let world = in.world;
  let cold = 1.0 - g_op;
  let avail = g_op * (1.0 - g_al);
  var col = vec3f(0.0);
  if (S.cov > 0.0) {
    let n = to_world_n(normalize(S.nrm), 1.0, 0.0);
    col = prop_light(world, n, S.alb, S.met, 0.5);
    // Self fill so each silhouette reads even in a dark niche: cold when locked, warm when alive.
    let fill = vec3f(0.035, 0.04, 0.06) * cold + C_GOLD * 0.08 * avail + C_WARM * 0.25 * g_al;
    col += S.alb * fill;
    // Locked: dim and drained of colour.
    let lum = dot(col, vec3f(0.3, 0.55, 0.15));
    col = mix(col, vec3f(lum) * vec3f(0.8, 0.9, 1.15), 0.65 * cold) * (1.0 - 0.55 * cold);
    col += S.emi;
  }
  // Available: a gentle gold pulse around the silhouette, inviting a click.
  let pulse = 0.5 + 0.5 * sin(g_now * 2.6 + g_seed);
  let outD = max(S.d, 0.0);
  let halo = C_GOLD * avail * (0.2 + 0.8 * pulse) * 0.5 * exp(-outD * 0.3) * (1.0 - S.cov);
  // Alive: warm light from behind the machine fills the niche.
  let back = C_WARM * g_al * 0.06 * exp(-length((q - vec2f(0.0, -6.0)) * vec2f(1.0, 0.85)) / 36.0) * (1.0 - S.cov);
  let glow = g_glow * (1.0 - 0.6 * cold) + halo + back;

  // Contact shadow on the sill.
  let sh = (1.0 - smoothstep(-6.0, 6.0, sdg_ellipse(q - vec2f(0.0, -64.0), vec2f(58.0, 5.0)).x)) * 0.55;
  var rgb = col * S.cov;
  // A soft dark backdrop so the silhouette stands out from the lit niche.
  let backdrop = 0.3 * g_op * (1.0 - smoothstep(-30.0, 0.0, sdg_union(sdg_box(q - vec2f(0.0, -22.0), vec2f(61.0, 44.5), 0.0), sdg_circle(q - vec2f(0.0, 22.5), 61.0)).x + 6.0));
  let under = max(sh, backdrop);
  var a = S.cov + under * (1.0 - S.cov);
  // Steam, lit warm by the machine.
  let sA = g_steam * 0.55;
  let steamC = C_MIST * 0.22 + C_WARM * 0.08;
  rgb = rgb * (1.0 - sA) + steamC * sA;
  a = a * (1.0 - sA) + sA;
  rgb += glow;

  // Clip to the niche, and keep the grate and padlock in front.
  let niche = sdg_union(sdg_box(q - vec2f(0.0, -22.0), vec2f(61.0, 44.5), 0.0), sdg_circle(q - vec2f(0.0, 22.5), 61.0));
  let mask = cover(niche.x, g_aa) * (1.0 - grate_cut(q, g_op)) * in.color.a;
  var o: FragOut;
  o.color = vec4f(rgb, a) * mask;
  o.emissive = vec4f((S.emi * S.cov + glow) * in.emissive * mask, a * mask);
  return o;
}
`;
