/**
 * Small local lighting helper for props (stand-in until art-materials' lighting helper lands;
 * same idea: an ambient term plus a short list of coloured 2D point lights in logical px).
 *
 * Every prop material starts its uniform block with `PropLights` (PROP_LIGHT_FLOATS floats),
 * so a scene fills one `PropLightRig` per frame and every prop copies it in.
 */
import { hex } from '@engine/render';
import { PITCH, PROP } from './palette';

export const PROP_MAX_LIGHTS = 6;
/** ambient vec4 + 2 vec4 per light. */
export const PROP_LIGHT_FLOATS = 4 + PROP_MAX_LIGHTS * 8;

export class PropLightRig {
  readonly data = new Float32Array(PROP_LIGHT_FLOATS);
  private count = 0;

  /** Reset to an ambient colour (linear rgb). `w` is unused (kept for alignment). */
  begin(r: number, g: number, b: number): this {
    this.data.fill(0);
    this.data[0] = r;
    this.data[1] = g;
    this.data[2] = b;
    this.count = 0;
    return this;
  }

  /**
   * Add a point light. `height` is the light's distance above the picture plane in px
   * (low = raking light that picks out rivets; default radius × 0.35).
   */
  add(
    x: number,
    y: number,
    radius: number,
    rgb: ArrayLike<number>,
    intensity: number,
    height = radius * 0.35,
  ): this {
    if (this.count >= PROP_MAX_LIGHTS) return this;
    const o = 4 + this.count++ * 8;
    const d = this.data;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = radius;
    d[o + 3] = height;
    d[o + 4] = rgb[0]!;
    d[o + 5] = rgb[1]!;
    d[o + 6] = rgb[2]!;
    d[o + 7] = intensity;
    return this;
  }

  get lightCount(): number {
    return this.count;
  }
}

function vec3(value: string, k = 1): string {
  const c = hex(value, k);
  return `vec3f(${c[0].toFixed(5)}, ${c[1].toFixed(5)}, ${c[2].toFixed(5)})`;
}

/** Palette as WGSL constants, generated from `palette.ts` (single source of truth). */
export const PROP_PALETTE_WGSL = /* wgsl */ `
const C_CYAN = ${vec3(PITCH.cyan)};
const C_AMETHYST = ${vec3(PITCH.amethyst)};
const C_MAGENTA = ${vec3(PITCH.magenta)};
const C_AMBER = ${vec3(PITCH.amber)};
const C_EMERALD = ${vec3(PITCH.emerald)};
const C_ICE = ${vec3(PITCH.ice)};
const C_SLATE = ${vec3(PITCH.slate)};
const C_INK = ${vec3(PITCH.ink)};
const C_WARM = ${vec3(PITCH.warm)};
const C_GOLD = ${vec3(PITCH.gold)};
const C_PARCHMENT = ${vec3(PITCH.parchment)};
const C_MIST = ${vec3(PITCH.mist)};
const C_BRASS = ${vec3(PROP.brass)};
const C_BRASS_DARK = ${vec3(PROP.brassDark)};
const C_BRASS_HI = ${vec3(PROP.brassHi)};
const C_VERDIGRIS = ${vec3(PROP.verdigris)};
const C_IRON = ${vec3(PROP.iron)};
const C_IRON_DARK = ${vec3(PROP.ironDark)};
const C_RUST = ${vec3(PROP.rust)};
const C_EYE = ${vec3(PROP.eye)};
const C_BOARD = ${vec3(PROP.board)};
const C_DIAL = ${vec3(PROP.dial)};
const C_DANGER = ${vec3(PROP.danger)};
`;

/**
 * Shared WGSL for prop shaders: SDFs that also return their gradient (iq's sdg* family, so
 * normals are analytic and resolution independent), layer compositing with an ink outline,
 * and a lighting model for painted metal.
 *
 * Conventions: shape functions return vec3f(d, grad.x, grad.y) with d < 0 inside.
 * Prop-local space is y-up; convert normals to world (y-down) with `to_world_n`.
 */
export const PROP_COMMON_WGSL = /* wgsl */ `
${PROP_PALETTE_WGSL}
const PI = 3.14159265;
const TAU = 6.2831853;

struct PropLights {
  ambient: vec4f,
  lights: array<vec4f, ${PROP_MAX_LIGHTS * 2}>,
};

fn rot2(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

fn sdg_circle(p: vec2f, r: f32) -> vec3f {
  let l = max(length(p), 1e-5);
  return vec3f(l - r, p / l);
}

fn sdg_box(p: vec2f, b: vec2f, r: f32) -> vec3f {
  let w = abs(p) - (b - vec2f(r));
  let s = vec2f(select(1.0, -1.0, p.x < 0.0), select(1.0, -1.0, p.y < 0.0));
  let g = max(w.x, w.y);
  let q = max(w, vec2f(0.0));
  let l = max(length(q), 1e-5);
  let inside = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), w.x > w.y);
  let d = select(g, l, g > 0.0);
  let gr = s * select(inside, q / l, g > 0.0);
  return vec3f(d - r, gr);
}

fn sdg_segment(p: vec2f, a: vec2f, b: vec2f, r: f32) -> vec3f {
  let ba = b - a;
  let pa = p - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  let q = pa - h * ba;
  let l = max(length(q), 1e-5);
  return vec3f(l - r, q / l);
}

/** Ellipse-ish: circle in a scaled space (gradient approximate, fine for shading). */
fn sdg_ellipse(p: vec2f, r: vec2f) -> vec3f {
  let q = p / r;
  let l = max(length(q), 1e-5);
  let k = min(r.x, r.y);
  let g = normalize(q / r);
  return vec3f((l - 1.0) * k, g);
}

fn sdg_ring(p: vec2f, r: f32, th: f32) -> vec3f {
  let c = sdg_circle(p, r);
  let s = select(-1.0, 1.0, c.x > 0.0);
  return vec3f(abs(c.x) - th, c.yz * s);
}

fn sdg_union(a: vec3f, b: vec3f) -> vec3f {
  return select(b, a, a.x < b.x);
}

fn sdg_smin(a: vec3f, b: vec3f, k: f32) -> vec3f {
  let h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  let d = mix(b.x, a.x, h) - k * h * (1.0 - h);
  return vec3f(d, normalize(mix(b.yz, a.yz, h) + vec2f(1e-5, 0.0)));
}

fn sdg_sub(a: vec3f, b: vec3f) -> vec3f {
  return select(a, vec3f(-b.x, -b.yz), -b.x > a.x);
}

fn sdg_intersect(a: vec3f, b: vec3f) -> vec3f {
  return select(b, a, a.x > b.x);
}

/** Pillowed normal (y-up local): flat on top, rolling over at the edge within 'bevel'. */
fn pillow(sd: vec3f, bevel: f32) -> vec3f {
  let t = clamp(-sd.x / bevel, 0.0, 1.0);
  let s = (1.0 - t) * (1.0 - t) * 2.6;
  return normalize(vec3f(sd.yz * s, 1.0));
}

/** Dome normal: a hemisphere over the whole shape (for lenses, bulbs, rivets). */
fn dome(sd: vec3f, radius: f32) -> vec3f {
  let t = clamp(-sd.x / radius, 0.0, 1.0);
  let z = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0));
  return normalize(vec3f(sd.yz * (1.0 - t) * 1.6, z + 0.15));
}

/** Local (y-up, maybe mirrored) normal → world (y-down) normal. */
fn to_world_n(n: vec3f, flip: f32, rot: f32) -> vec3f {
  let r = rot2(-rot) * vec2f(n.x * flip, n.y);
  return vec3f(r.x, -r.y, n.z);
}

/** Coverage from a signed distance, 'aa' = local units per pixel. */
fn cover(d: f32, aa: f32) -> f32 {
  return clamp(0.5 - d / aa, 0.0, 1.0);
}

struct Acc {
  col: vec4f,  // premultiplied colour + coverage
  emi: vec3f,  // emissive (bloom) premultiplied by coverage
};

/** Paint 'c' (with emissive 'e') over the accumulator where d < 0, with an ink rim. */
fn put(acc: ptr<function, Acc>, d: f32, aa: f32, c: vec3f, e: vec3f, inkW: f32) {
  let cov = cover(d, aa);
  let rim = smoothstep(inkW * aa, inkW * aa + aa * 1.2, -d);
  let cc = mix(C_INK * 0.6, c, rim);
  let ee = e * rim;
  (*acc).col = vec4f(cc * cov + (*acc).col.rgb * (1.0 - cov), cov + (*acc).col.a * (1.0 - cov));
  (*acc).emi = ee * cov + (*acc).emi * (1.0 - cov);
}

/** Additive light (no coverage change): glows, sparks, arcs. */
fn add_glow(acc: ptr<function, Acc>, c: vec3f, emissive: f32) {
  (*acc).col = vec4f((*acc).col.rgb + c, (*acc).col.a);
  (*acc).emi += c * emissive;
}

/** Darken what's already there (soft contact shadows / AO). */
fn shade_under(acc: ptr<function, Acc>, k: f32) {
  (*acc).col = vec4f((*acc).col.rgb * (1.0 - k), (*acc).col.a);
  (*acc).emi *= 1.0 - k;
}

/** Drop shadow onto the background (adds coverage, darkens). */
fn put_shadow(acc: ptr<function, Acc>, d: f32, soft: f32, k: f32) {
  let a = (1.0 - smoothstep(-soft, soft, d)) * k;
  (*acc).col = vec4f((*acc).col.rgb * (1.0 - a), a + (*acc).col.a * (1.0 - a));
  (*acc).emi *= 1.0 - a;
}

/**
 * Painted-metal lighting. 'world' = logical px, 'n' = world normal, 'metal' 0..1,
 * 'gloss' 0..1. Returns lit linear colour.
 */
fn prop_light(L: PropLights, world: vec2f, n: vec3f, albedo: vec3f, metal: f32, gloss: f32) -> vec3f {
  // Hemisphere ambient: cool from above, warm bounce from below.
  let hemi = mix(vec3f(0.55, 0.5, 0.45), vec3f(0.8, 0.9, 1.1), 0.5 - 0.5 * n.y);
  var c = L.ambient.rgb * albedo * hemi * (0.55 + 0.45 * n.z);
  let shin = mix(6.0, 90.0, gloss);
  let specCol = mix(vec3f(0.04), albedo * 1.6 + 0.05, metal);
  for (var i = 0; i < ${PROP_MAX_LIGHTS}; i++) {
    let lp = L.lights[i * 2];
    let lc = L.lights[i * 2 + 1];
    if (lc.w <= 0.0) { continue; }
    let dv = vec3f(lp.xy - world, lp.w);
    let dist = length(dv.xy);
    let att = (1.0 - smoothstep(0.0, lp.z, dist)) / (1.0 + dist * dist / (lp.z * lp.z) * 6.0);
    let ld = normalize(dv);
    let ndl = max(dot(n, ld), 0.0);
    let wrap = max((dot(n, ld) + 0.35) / 1.35, 0.0);
    let hv = normalize(ld + vec3f(0.0, 0.0, 1.0));
    let sp = pow(max(dot(n, hv), 0.0), shin) * (shin + 8.0) / 32.0;
    let diff = albedo * mix(wrap, ndl, 0.6) * (1.0 - metal * 0.75);
    c += lc.rgb * lc.w * att * (diff + specCol * sp * ndl);
  }
  return c;
}

/** Brush-stroke breakup: a soft directional fbm in [0.85, 1.15]-ish. */
fn brush(p: vec2f, dir: f32, scale: f32) -> f32 {
  let q = rot2(dir) * p * scale;
  return 0.85 + 0.3 * engine_fbm(q * vec2f(1.0, 5.0), 3);
}

/** Brass albedo with tarnish and verdigris in the crevices ('edge' 0 = crevice, 1 = open). */
fn brass_albedo(p: vec2f, edge: f32, seed: f32) -> vec3f {
  let n = engine_fbm(p * 7.0 + seed * 13.0, 4);
  var c = mix(C_BRASS_DARK, C_BRASS, 0.55 + 0.45 * n);
  let verd = smoothstep(0.55, 0.85, engine_fbm(p * 11.0 + seed * 7.0, 3)) * (1.0 - edge);
  c = mix(c, C_VERDIGRIS * 0.6, verd * 0.65);
  return c * brush(p, 0.6, 9.0);
}

/** Wrought iron albedo with rust blooms. */
fn iron_albedo(p: vec2f, seed: f32) -> vec3f {
  let n = engine_fbm(p * 9.0 + seed * 17.0, 4);
  var c = C_IRON * (0.7 + 0.6 * n);
  let rust = smoothstep(0.6, 0.85, engine_fbm(p * 5.0 + seed * 3.0 + 4.0, 4));
  c = mix(c, C_RUST, rust * 0.55);
  return c * brush(p, -0.4, 12.0);
}
`;
