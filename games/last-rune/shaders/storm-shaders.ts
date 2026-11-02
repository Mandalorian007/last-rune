/**
 * Storm cell: a feedback "fluid" (semi-Lagrangian advection of plasma through a swirling curl
 * field, re-energised by ridged-noise filaments and strikes) rendered inside a glass sphere,
 * caged by 1/2/4 brass armillary rings that spin, with arcs leaping to them.
 */
import { PROP_COMMON_WGSL, PROP_LIGHT_FLOATS } from '../art/props/lighting';

export const STORM_SIM_SIZE = 256;
export const STORM_SIM_FLOATS = 8;
export const STORM_UNIFORM_FLOATS = PROP_LIGHT_FLOATS + 8;

/** Sim pass: state rgba = (filament energy, glow dye, violet, -). */
export const STORM_SIM_WGSL = /* wgsl */ `
struct SimU { a: vec4f, b: vec4f }; // a: time, dt, strength(1..4), seed · b: surge, -, -, -
@group(0) @binding(0) var<uniform> U: SimU;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var prevTex: texture_2d<f32>;

fn pot(p: vec2f, t: f32) -> f32 {
  return engine_fbm(p * 2.2 + vec2f(t * 0.21, -t * 0.17), 4);
}
fn curl(p: vec2f, t: f32) -> vec2f {
  let e = 0.01;
  let dx = pot(p + vec2f(e, 0.0), t) - pot(p - vec2f(e, 0.0), t);
  let dy = pot(p + vec2f(0.0, e), t) - pot(p - vec2f(0.0, e), t);
  return vec2f(dy, -dx) / (2.0 * e);
}

@fragment fn fs_main(in: FullscreenIn) -> @location(0) vec4f {
  let t = U.a.x;
  let dt = U.a.y;
  let str = U.a.z;
  let seed = U.a.w;
  let surge = U.b.x;
  let uv = in.uv;
  let p = uv * 2.0 - 1.0;
  let r = length(p);
  let speed = 0.55 + 0.25 * str;

  // Velocity: a swirl around the core + curl turbulence, pulled gently inward near the glass.
  let swirl = vec2f(-p.y, p.x) * (0.9 + 0.35 * str) * smoothstep(1.0, 0.1, r);
  let turb = curl(p + seed, t * speed) * (0.35 + 0.12 * str);
  let inward = -p * smoothstep(0.6, 0.95, r) * 0.8;
  let vel = swirl + turb + inward;
  let back = uv - vel * dt * 0.5;
  var s = textureSample(prevTex, samp, back);
  // Slight diffusion so trails soften into vapour.
  let px = 1.0 / ${STORM_SIM_SIZE}.0;
  let blur = (textureSample(prevTex, samp, back + vec2f(px, 0.0)) +
              textureSample(prevTex, samp, back - vec2f(px, 0.0)) +
              textureSample(prevTex, samp, back + vec2f(0.0, px)) +
              textureSample(prevTex, samp, back - vec2f(0.0, px))) * 0.25;
  s = mix(s, blur, 0.25);

  // Decay: filaments are fast, glow dye lingers.
  s.r *= exp(-dt * (5.5 - str * 0.4));
  s.g *= exp(-dt * 1.3);
  s.b *= exp(-dt * 0.9);

  // Filaments: ridged noise, flickering on and off in bursts.
  let q = p * (2.4 + 0.3 * str);
  let n1 = engine_fbm(q + vec2f(t * 1.7, -t * 1.3) + seed, 4);
  let ridge = 1.0 - abs(n1 * 2.0 - 1.0);
  let fil = pow(ridge, 18.0 - str * 1.5);
  let burst = step(0.45 - 0.07 * str, engine_noise(vec2f(t * 11.0, seed)));
  let core = exp(-r * r * (7.0 - str * 0.8));
  let inject = fil * burst * (0.7 + 0.5 * str) * smoothstep(0.95, 0.4, r);
  s.r += inject * dt * 60.0 * 0.35;
  s.g += (inject * 0.3 + core * (0.1 + 0.04 * str)) * dt * 5.0;
  s.b += inject * dt * 4.0 * smoothstep(1.5, 4.0, str);

  // Strikes: occasional jagged bolts from the core out to the glass.
  let rate = 2.0 + 2.5 * str;
  let slot = floor(t * rate);
  let ft = fract(t * rate);
  let ang = engine_hash21(vec2f(slot, seed)) * 6.2831853;
  let dir = vec2f(cos(ang), sin(ang));
  let along = dot(p, dir);
  let perp = dot(p, vec2f(-dir.y, dir.x));
  let jag = (engine_noise(vec2f(along * 9.0, slot)) - 0.5) * 0.22 * along;
  let strike = smoothstep(0.035, 0.0, abs(perp - jag)) * step(0.0, along) * step(along, 0.92)
             * step(ft, 0.25) * step(0.35, engine_hash21(vec2f(slot, seed + 3.0)));
  s.r += strike * (1.2 + surge * 2.0);
  s.g += strike * 0.15;

  // Surge (a bolt was fired): flood the sphere.
  s.r += surge * core * dt * 30.0;
  s.g += surge * dt * 3.0 * smoothstep(1.0, 0.0, r);

  let inside = smoothstep(1.0, 0.94, r);
  s = min(s * inside, vec4f(4.0));
  return vec4f(s.rgb, 1.0);
}
`;

/** Display material: housing, glass, plasma, rings, arcs. One material per storm cell. */
export const STORM_MATERIAL_WGSL = /* wgsl */ `
${PROP_COMMON_WGSL}
struct StormU { L: PropLights, a: vec4f, b: vec4f };
// a: time, rings (1..4, fractional while changing), intensity, seed
// b: surge, -, -, -
@group(1) @binding(0) var<uniform> U: StormU;
@group(1) @binding(1) var samp: sampler;
@group(1) @binding(2) var simTex: texture_2d<f32>;

const SPHERE_C = vec2f(0.0, 0.12);
const SPHERE_R = 0.6;

fn plasma_col(e: f32, g: f32, v: f32, k: f32) -> vec3f {
  let deep = vec3f(0.01, 0.02, 0.07);
  var c = deep + C_AMETHYST * 0.1 * g + vec3f(0.03, 0.18, 0.7) * g * 0.35;
  c += mix(C_CYAN, C_AMETHYST, clamp(v, 0.0, 1.0) * 0.7) * e * 0.9;
  c += vec3f(0.85, 0.95, 1.0) * smoothstep(1.2, 3.5, e) * 1.0;
  return c * k;
}

/** Ring i: returns (dist, depthSign, paramAngle). */
fn ring_geo(p: vec2f, i: f32, t: f32, R: f32) -> vec3f {
  let roll = i * 0.785 + 0.35;
  let spin = t * (0.35 + 0.17 * i) + i * 1.9;
  let squash = cos(spin);
  let q = rot2(roll) * (p - SPHERE_C);
  let sq = max(abs(squash), 0.07);
  let e = sdg_ellipse(q, vec2f(R, R * sq));
  let a = atan2(q.y / sq, q.x);
  let z = sin(a) * sin(spin) * sign(squash + 1e-4);
  return vec3f(e.x, z, a);
}

fn paint_ring(acc: ptr<function, Acc>, p: vec2f, aa: f32, world: vec2f, i: f32, t: f32,
              front: bool, show: f32) {
  if (show <= 0.0) { return; }
  let R = 0.8 + i * 0.075;
  let g = ring_geo(p, i, t, R);
  let side = select((g.y < 0.0), (g.y >= 0.0), front);
  let d = abs(g.x) - 0.026 * show;
  // Rings read as round brass bars: lit across their width.
  let across = clamp(g.x / 0.026, -1.0, 1.0);
  let n = normalize(vec3f(across * 0.8 * normalize(p - SPHERE_C), 1.0 - across * across * 0.5));
  let wn = to_world_n(n, 1.0, 0.0);
  var c = prop_light(U.L, world, wn, brass_albedo(vec2f(g.z, i), 1.0, i) * 1.15, 0.9, 0.7);
  // Cool light from the plasma on the inner faces.
  c += C_CYAN * 0.35 * U.a.z * max(-across, 0.0);
  c *= select(0.55, 1.0, front);
  // Rivet ticks along the ring.
  let tick = smoothstep(0.85, 0.95, abs(fract(g.z / 6.2831853 * 12.0) - 0.5) * 2.0);
  c = mix(c, c * 1.6 + 0.04, tick * 0.6);
  if (side) {
    put(acc, d, aa, c, vec3f(0.0), 0.6);
  }
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let t = U.a.x;
  let rings = U.a.y;
  let k = U.a.z;
  let surge = U.b.x;
  // Quad covers [-1.25, 1.25]² in storm units, y up.
  let p = vec2f(in.local.x - 0.5, 0.5 - in.local.y) * 2.5;
  let aa = max(fwidth(p.x), fwidth(p.y));
  let world = in.world;
  let sim = textureSample(simTex, samp, (p - SPHERE_C) / SPHERE_R * vec2f(0.5, -0.5) + 0.5);
  var acc: Acc;
  acc.col = vec4f(0.0);
  acc.emi = vec3f(0.0);

  // Shadow + pedestal (iron foot, brass cup).
  put_shadow(&acc, sdg_ellipse(p - vec2f(0.0, -1.1), vec2f(0.75, 0.08)).x, 0.08, 0.7);
  let foot = sdg_box(p - vec2f(0.0, -0.98), vec2f(0.5, 0.1), 0.05);
  let stem = sdg_box(p - vec2f(0.0, -0.72), vec2f(0.13 + (p.y + 0.72) * -0.25, 0.22), 0.03);
  let ped = sdg_smin(foot, stem, 0.08);
  put(&acc, ped.x, aa, prop_light(U.L, world, to_world_n(pillow(ped, 0.06), 1.0, 0.0),
      iron_albedo(p, 9.0), 0.7, 0.5), vec3f(0.0), 1.0);
  let fr = sdg_circle(vec2f(abs(p.x) - 0.38, p.y + 0.98), 0.03);
  put(&acc, fr.x, aa, prop_light(U.L, world, to_world_n(dome(fr, 0.03), 1.0, 0.0), C_BRASS, 0.9, 0.7),
      vec3f(0.0), 0.5);

  // Back halves of the rings.
  for (var i = 0; i < 4; i++) {
    paint_ring(&acc, p, aa, world, f32(i), t, false, clamp(rings - f32(i), 0.0, 1.0));
  }

  // Cup under the sphere (behind the glass's lower half).
  let cupO = sdg_circle(p - SPHERE_C, SPHERE_R + 0.07);
  let cup = sdg_intersect(cupO, vec3f(p.y - (SPHERE_C.y - 0.28), 0.0, 1.0));
  put(&acc, cup.x, aa, prop_light(U.L, world, to_world_n(pillow(cup, 0.08), 1.0, 0.0),
      brass_albedo(p * 2.0, 1.0, 5.0), 0.85, 0.6), vec3f(0.0), 1.2);

  // Glass sphere with the plasma inside.
  let sp = p - SPHERE_C;
  let sd = sdg_circle(sp, SPHERE_R);
  let rr = length(sp) / SPHERE_R;
  // Soft-clip the energy so 4x stays crackly rather than a white blob.
  let e0 = sim.r * k;
  let e = e0 / (1.0 + e0 * 0.12 * rings);
  let gd = sim.g * k / (1.0 + sim.g * 0.25 * rings);
  var inner = plasma_col(e, gd, sim.b, 1.0);
  // Thickness darkening toward the glass edge + inner reflection rim.
  inner *= mix(1.0, 0.55, smoothstep(0.6, 1.0, rr));
  let fres = pow(clamp(rr, 0.0, 1.0), 6.0);
  var glass = inner + vec3f(0.3, 0.5, 0.7) * fres * 0.35;
  let hl = smoothstep(0.16, 0.0, length(sp - vec2f(-0.24, 0.3))) * 0.8
         + smoothstep(0.03, 0.0, abs(length(sp - vec2f(0.05, -0.05)) - 0.5)) * step(0.0, -sp.x - sp.y) * 0.25;
  glass += vec3f(0.9, 0.95, 1.0) * hl;
  let emi = inner * (0.6 + surge * 1.5) + vec3f(0.3, 0.6, 1.0) * fres * 0.1;
  put(&acc, sd.x, aa, glass, emi, 0.8);

  // Front lip of the cup with rivets.
  let lip = sdg_intersect(sdg_ring(sp, SPHERE_R + 0.03, 0.045), vec3f(sp.y + 0.24, 0.0, -1.0));
  put(&acc, lip.x, aa, prop_light(U.L, world, to_world_n(pillow(lip, 0.04), 1.0, 0.0),
      brass_albedo(p * 3.0, 1.0, 6.0) * 1.1, 0.9, 0.7), vec3f(0.0), 0.8);

  // Front halves of the rings.
  for (var i = 0; i < 4; i++) {
    paint_ring(&acc, p, aa, world, f32(i), t, true, clamp(rings - f32(i), 0.0, 1.0));
  }

  // Arcs: jagged lightning from the glass to a point on a ring, a few per second.
  let nArcs = 2.0 + rings * 1.5;
  for (var j = 0; j < 6; j++) {
    let fj = f32(j);
    if (fj >= nArcs) { break; }
    let rate = 3.0 + fj * 0.7;
    let slot = floor(t * rate + fj * 0.37);
    let ph = fract(t * rate + fj * 0.37);
    let live = step(ph, 0.35) * step(0.3, engine_hash21(vec2f(slot, fj + U.a.w)));
    let ang = engine_hash21(vec2f(slot, fj * 7.0 + 1.0)) * 6.2831853;
    let ringI = floor(engine_hash21(vec2f(slot, fj + 11.0)) * min(rings, 4.0));
    let R = 0.8 + ringI * 0.075;
    let a = SPHERE_C + vec2f(cos(ang), sin(ang)) * SPHERE_R * 0.75;
    let b = SPHERE_C + vec2f(cos(ang + 0.2), sin(ang + 0.2)) * R;
    let ab = b - a;
    let h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    let n = (engine_noise(vec2f(h * 9.0, slot * 3.1 + t * 30.0)) - 0.5) * 0.12 * sin(h * 3.14159);
    let perp = normalize(vec2f(-ab.y, ab.x));
    let dd = length(p - (a + ab * h + perp * n));
    let core = smoothstep(aa * 2.5, 0.0, dd);
    let halo = exp(-dd * dd * 900.0) * 0.6;
    let flick = live * (1.0 - ph / 0.35) * (0.7 + 0.6 * engine_noise(vec2f(t * 60.0, fj)));
    add_glow(&acc, (vec3f(0.85, 0.95, 1.0) * core + C_CYAN * halo) * flick * k, 1.6);
  }

  // Outer corona (soft, additive; feeds bloom and god rays).
  let cor = exp(-max(length(sp) - SPHERE_R, 0.0) * 9.0) * step(SPHERE_R, length(sp));
  add_glow(&acc, vec3f(0.2, 0.55, 1.0) * cor * 0.12 * k * (1.0 + surge), 1.2);

  var o: FragOut;
  o.color = acc.col * in.color.a;
  o.emissive = vec4f(acc.emi * in.emissive * in.color.a, acc.col.a * in.color.a);
  return o;
}
`;
