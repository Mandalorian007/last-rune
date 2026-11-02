/**
 * Hall and title set pieces: lancet storm windows, the Last Rune's great seal, and a small FX
 * material (focus rings, conduits). All lit by the shared light set through 'prop_light', so they
 * sit in the same light as the props and the stone. Coordinates inside the shaders are local
 * logical px with y up ('q'), so bevels and line widths are in px.
 */
import { PROP_COMMON_WGSL, PROP_LIGHT_FLOATS } from '../art/props/lighting';

/** Lights + a: (time, storm level 0..1, calm 0/1, -). */
export const HALL_WINDOW_UNIFORM_FLOATS = PROP_LIGHT_FLOATS + 4;
/** Lights + a + b + 10 socket vec4s. */
export const HALL_SEAL_SOCKETS = 10;
export const HALL_SEAL_UNIFORM_FLOATS = PROP_LIGHT_FLOATS + 8 + HALL_SEAL_SOCKETS * 4;

const STONE_FNS = /* wgsl */ `
fn hall_stone(p: vec2f, seed: f32) -> vec3f {
  let n = engine_fbm(p * 0.035 + seed, 4);
  let base = mix(C_SLATE * 0.55, C_SLATE * 0.95, n);
  return base * (0.9 + 0.2 * engine_noise(p * 0.21 + seed * 3.0));
}

/** Pointed (equilateral) arch opening of half-width w; spring line and bottom in px, y up. */
fn lancet(q: vec2f, w: f32, spring: f32, bottom: f32) -> vec3f {
  let lowH = max(spring - bottom, 1.0) * 0.5;
  let box = sdg_box(q - vec2f(0.0, bottom + lowH), vec2f(w, lowH), 0.0);
  let lens = sdg_intersect(sdg_circle(q - vec2f(-w, spring), 2.0 * w),
                           sdg_circle(q - vec2f(w, spring), 2.0 * w));
  let top = sdg_intersect(lens, vec3f(spring - q.y, 0.0, -1.0));
  return sdg_union(box, top);
}
`;

/**
 * Lancet storm window. Per instance: params = (flash 0..1, seed, bolt x px from centre, bolt 0..1),
 * size = quad (the window fills it). Premultiplied.
 */
export const HALL_WINDOW_WGSL = /* wgsl */ `
${PROP_COMMON_WGSL}
struct HallU { L: PropLights, a: vec4f };
@group(1) @binding(0) var<uniform> U: HallU;
${STONE_FNS}

fn storm_sky(q: vec2f, t: f32, seed: f32, level: f32, flash: f32) -> vec3f {
  let uv = q * 0.012 + vec2f(seed * 7.0, 0.0);
  let drift = vec2f(t * 0.05, t * 0.012);
  let c1 = engine_fbm(uv + drift, 5);
  let c2 = engine_fbm(uv * 2.3 - drift * 1.7 + 4.0, 4);
  let cloud = smoothstep(0.25, 0.85, c1 * 0.7 + c2 * 0.45);
  // Deep storm blue, darker as the storm builds; cloud bellies lit by the flash.
  let deep = mix(vec3f(0.035, 0.05, 0.11), vec3f(0.016, 0.02, 0.05), level);
  let belly = mix(vec3f(0.07, 0.09, 0.17), vec3f(0.05, 0.06, 0.12), level);
  var sky = mix(deep, belly, cloud);
  sky += vec3f(0.55, 0.65, 1.0) * flash * (0.35 + 1.4 * cloud);
  return sky;
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let t = U.a.x;
  let level = U.a.y;
  let flash = in.params.x;
  let seed = in.params.y;
  let boltX = in.params.z;
  let boltK = in.params.w;
  let q = vec2f(in.local.x - 0.5, 0.5 - in.local.y) * in.size;
  let aa = max(fwidth(q.x), fwidth(q.y));
  let world = in.world;
  let hw = in.size.x * 0.5;
  let top = in.size.y * 0.5;
  let wo = hw - 2.0;
  let wi = wo - 14.0;
  let spring = top - wo * 1.732 - 2.0;
  let outer = lancet(q, wo, spring, -top + 2.0);
  let inner = lancet(q, wi, spring - 6.0, -top + 26.0);
  var acc: Acc;
  acc.col = vec4f(0.0);
  acc.emi = vec3f(0.0);

  // Stone surround with a chamfer into the glass.
  {
    let band = sdg_sub(outer, inner);
    let alb = hall_stone(q + world * 0.3, seed) * 1.1;
    let n = to_world_n(pillow(band, 7.0), 1.0, 0.0);
    var c = prop_light(world, n, alb, 0.0, 0.1);
    // Flash rakes the inner chamfer.
    let rake = exp(-max(inner.x, 0.0) * 0.25);
    c += vec3f(0.5, 0.6, 1.0) * flash * rake * 0.35 * alb * 4.0;
    put(&acc, band.x, aa, c, vec3f(0.0), 1.0);
  }

  // Glass: storm sky, rain, the bolt, lead cames.
  {
    let inside = inner.x;
    var sky = storm_sky(q, t, seed, level, flash);
    // Rain: slanted streaks, faint, brighter in the flash.
    let rq = vec2f(q.x + q.y * 0.25, q.y + t * 900.0);
    let col = floor(rq.x / 5.0);
    let streak = step(0.82, engine_hash21(vec2f(col, seed))) *
                 smoothstep(0.6, 1.0, fract(rq.y / 70.0 + engine_hash21(vec2f(col, 3.0)) ));
    sky += vec3f(0.12, 0.15, 0.22) * streak * (0.35 + flash * 2.0) * (1.0 - U.a.z * 0.6);
    // Bolt: a jagged filament from the top, with a fork.
    if (boltK > 0.001) {
      let j = (engine_noise(vec2f(q.y * 0.045, seed * 11.0)) - 0.5) * 34.0
            + (engine_noise(vec2f(q.y * 0.17, seed * 5.0)) - 0.5) * 9.0;
      let d = abs(q.x - boltX - j);
      let fj = j + (q.y - top * 0.2) * 0.35;
      let df = abs(q.x - boltX - fj) + step(top * 0.2, q.y) * 1e3 + step(q.y, -top * 0.4) * 1e3;
      let core = exp(-d * d * 0.35) * 2.5 + exp(-d * 0.18) * 0.6 + exp(-df * df * 0.6) * 1.2;
      sky += vec3f(0.85, 0.9, 1.0) * core * boltK;
    }
    // Leaded glass: diamond quarries, a mullion, faint stained tints.
    let dq = vec2f(q.x * 0.8 + q.y * 0.5, q.y * 0.5 - q.x * 0.8) / 26.0;
    let cell = floor(dq);
    let fq = abs(fract(dq) - 0.5);
    let lead = min(0.5 - fq.x, 0.5 - fq.y) * 26.0;
    let mull = abs(q.x) - 2.2;
    let lines = min(lead - 1.1, mull);
    let tintPick = engine_hash21(cell + seed);
    var glass = vec3f(1.0);
    if (tintPick > 0.86) { glass = mix(vec3f(1.0), C_AMBER * 1.4, 0.45); }
    else if (tintPick > 0.74) { glass = mix(vec3f(1.0), C_CYAN * 1.3, 0.35); }
    else if (tintPick > 0.66) { glass = mix(vec3f(1.0), C_AMETHYST * 1.5, 0.4); }
    let pane = sky * glass * (0.85 + 0.3 * engine_hash21(cell * 1.7 + seed));
    put(&acc, inside, aa, pane, pane * (0.6 + flash * 0.8), 0.0);
    let came = max(lines, inside);
    let leadC = prop_light(world, vec3f(0.0, 0.0, 1.0), C_IRON_DARK * 0.8, 0.5, 0.4)
              + vec3f(0.3, 0.35, 0.5) * flash * 0.15;
    put(&acc, came, aa, leadC, vec3f(0.0), 0.0);
  }

  // Sill.
  {
    let sill = sdg_box(q - vec2f(0.0, -top + 12.0), vec2f(hw, 10.0), 2.0);
    let n = to_world_n(pillow(sill, 5.0), 1.0, 0.0);
    put(&acc, sill.x, aa, prop_light(world, n, hall_stone(q * 1.3 + 9.0, seed) * 1.2, 0.0, 0.15),
        vec3f(0.0), 1.0);
  }

  var o: FragOut;
  o.color = acc.col * in.color.a;
  o.emissive = vec4f(acc.emi * in.emissive * in.color.a, acc.col.a * in.color.a);
  return o;
}
`;

/**
 * The Last Rune's great seal: a round carved stone door. Uniforms: a = (time, open 0..1,
 * highlight 0..1, socket count), b = (focus 0..1, -, -, -), s[i] = (rgb, filled 0/1).
 * Premultiplied; one instance.
 */
export const HALL_SEAL_WGSL = /* wgsl */ `
${PROP_COMMON_WGSL}
struct SealU { L: PropLights, a: vec4f, b: vec4f, s: array<vec4f, ${HALL_SEAL_SOCKETS}> };
@group(1) @binding(0) var<uniform> U: SealU;
${STONE_FNS}

fn rune_glyph(q: vec2f, r: f32) -> f32 {
  // The Last Rune: a stave, two crossing branches, a hooked foot.
  var d = sdg_segment(q, vec2f(0.0, -0.62 * r), vec2f(0.0, 0.62 * r), 0.0).x;
  d = min(d, sdg_segment(q, vec2f(0.0, 0.2 * r), vec2f(0.38 * r, 0.52 * r), 0.0).x);
  d = min(d, sdg_segment(q, vec2f(0.0, 0.2 * r), vec2f(-0.38 * r, 0.52 * r), 0.0).x);
  d = min(d, sdg_segment(q, vec2f(0.0, -0.18 * r), vec2f(0.32 * r, -0.4 * r), 0.0).x);
  d = min(d, sdg_segment(q, vec2f(0.32 * r, -0.4 * r), vec2f(0.32 * r, -0.62 * r), 0.0).x);
  d = min(d, abs(length(q - vec2f(0.0, -0.05 * r)) - 0.16 * r));
  return d;
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let t = U.a.x;
  let open = U.a.y;
  let hi = U.a.z;
  let n = U.a.w;
  let focus = U.b.x;
  let q = vec2f(in.local.x - 0.5, 0.5 - in.local.y) * in.size;
  let aa = max(fwidth(q.x), fwidth(q.y));
  let world = in.world;
  let R = in.size.x * 0.5 - 12.0;
  let r = length(q);
  let ang = atan2(q.y, q.x);
  var acc: Acc;
  acc.col = vec4f(0.0);
  acc.emi = vec3f(0.0);

  // Contact shadow behind the disc.
  put_shadow(&acc, r - R - 4.0, 14.0, 0.7);

  // Outer ring: voussoir blocks with carved tick runes.
  let outerRing = sdg_ring(q, R * 0.91, R * 0.09);
  {
    let blocks = abs(fract(ang / TAU * 16.0) - 0.5) * r * TAU / 16.0;
    let joint = smoothstep(0.8, 2.2, blocks);
    let id = floor(ang / TAU * 16.0);
    let alb = hall_stone(q + 31.0, id) * (0.85 + 0.3 * engine_hash21(vec2f(id, 4.0)));
    let nn = to_world_n(pillow(outerRing, R * 0.06), 1.0, 0.0);
    var c = prop_light(world, nn, alb * 1.15, 0.0, 0.12) * mix(0.35, 1.0, joint);
    // Ticks: short carved runes between the joints.
    let tick = abs(fract(ang / TAU * 48.0) - 0.5) * r * TAU / 48.0;
    let tk = (1.0 - smoothstep(0.6, 1.6, tick)) * (1.0 - smoothstep(R * 0.02, R * 0.035, abs(r - R * 0.91)));
    let glowCol = mix(C_AMETHYST * 0.5, C_GOLD * 1.4, open);
    c = mix(c, C_INK * 0.4 + glowCol * (0.25 + 0.75 * open), tk * 0.85);
    put(&acc, outerRing.x, aa, c, glowCol * tk * (0.1 + 1.2 * open), 1.0);
  }

  // Recessed face.
  let face = sdg_circle(q, R * 0.82);
  {
    let alb = hall_stone(q * 0.8 + 77.0, 2.0) * 0.75;
    let depth = smoothstep(0.0, R * 0.12, -face.x);
    let nn = to_world_n(vec3f(-face.yz * (1.0 - depth) * 0.9, 1.0), 1.0, 0.0);
    var c = prop_light(world, normalize(nn), alb, 0.0, 0.08) * mix(0.45, 1.0, depth);
    // Concentric grooves; the inner band turns slowly once the seal is open.
    let g1 = abs(r - R * 0.6) - 1.4;
    let g2 = abs(r - R * 0.44) - 1.0;
    let spin = ang + t * 0.15 * open;
    let dash = step(0.35, fract(spin / TAU * 24.0));
    let grooves = min(g1, max(g2, -0.5 + dash));
    let gk = 1.0 - smoothstep(-0.5, 0.8, grooves);
    let glowCol = mix(C_AMETHYST * 0.7, C_GOLD * 1.5, open);
    let breathe = 0.6 + 0.4 * sin(t * 1.3);
    c = mix(c, C_INK * 0.5 + glowCol * (0.08 + 0.5 * open) * breathe, gk);
    // The rune itself.
    let rd = rune_glyph(q, R * 0.38) - R * 0.022;
    let rk = 1.0 - smoothstep(-aa, aa, rd);
    let runeCol = glowCol * mix(0.35 * breathe, 1.8 + 0.3 * sin(t * 2.0), open);
    c = mix(c, C_INK * 0.4 + runeCol, rk);
    var e = runeCol * rk + glowCol * gk * open * 0.6;
    // Soft inner bloom around the rune when open.
    let halo = exp(-max(rd, 0.0) * 0.06) * 0.12 * open;
    c += C_GOLD * halo;
    e += C_GOLD * halo * 0.6;
    put(&acc, face.x, aa, c, e, 1.5);
  }

  // Sockets on the face: dotted rings (missing) or gems (held).
  let count = i32(n);
  for (var i = 0; i < ${HALL_SEAL_SOCKETS}; i++) {
    if (i >= count) { break; }
    let s = U.s[i];
    let a = PI * 0.5 - (f32(i) + 0.5) / n * TAU;
    let c0 = vec2f(cos(a), sin(a)) * R * 0.71;
    let sq = q - c0;
    let sr = length(sq);
    let col = s.rgb;
    let filled = s.w;
    let hole = sdg_circle(sq, R * 0.075);
    put(&acc, hole.x, aa, vec3f(0.008, 0.01, 0.016) + col * 0.05, vec3f(0.0), 1.0);
    if (filled > 0.5) {
      let gem = sdg_circle(sq, R * 0.06);
      let gn = dome(gem, R * 0.06);
      let facet = floor((atan2(sq.y, sq.x) + PI) / TAU * 6.0);
      let shade = 0.7 + 0.3 * engine_hash21(vec2f(facet, f32(i))) + 0.4 * gn.y;
      put(&acc, gem.x, aa, col * shade * 1.3, col * 1.4, 0.6);
      add_glow(&acc, col * exp(-sr / (R * 0.05)) * 0.25, 1.2);
    } else {
      let sa = atan2(sq.y, sq.x);
      let dots = abs(fract(sa / TAU * 10.0 + t * 0.12) - 0.5) * sr * TAU / 10.0;
      let ringD = length(vec2f(dots, sr - R * 0.05));
      let breathe = 0.6 + 0.4 * sin(t * 2.0 + f32(i) * 1.1);
      let dk = smoothstep(2.4, 1.2, ringD);
      add_glow(&acc, col * dk * 1.3 * breathe, 1.0);
    }
  }

  // Highlight (hover/focus): gold rim light.
  let rim = exp(-abs(r - R) * 0.18) * max(hi, focus);
  add_glow(&acc, C_GOLD * rim * 0.9, 0.8);

  var o: FragOut;
  o.color = acc.col * in.color.a;
  o.emissive = vec4f(acc.emi * in.emissive * in.color.a, acc.col.a * in.color.a);
  return o;
}
`;

/**
 * Hall FX (premultiplied, no uniforms; batches). params.w selects:
 * - 0 ring: rounded-rect outline glow. params = (corner radius px, line px, dash 0/1 · phase, 0).
 *   tint = colour × intensity. Additive (alpha 0).
 * - 1 conduit: a channel along the quad's x axis. params = (lit 0..2, time, arc start px, 1).
 *   tint = colour. Dark carved groove plus a glowing core with pulses when lit.
 * - 2 pool: soft radial glow, additive. params = (falloff, -, -, 2).
 */
export const HALL_FX_WGSL = /* wgsl */ `
@fragment fn fs_main(in: VSOut) -> FragOut {
  let mode = in.params.w;
  let q = (in.local - 0.5) * in.size;
  var o: FragOut;
  if (mode < 0.5) {
    let rad = in.params.x;
    let lw = in.params.y;
    let half = in.size * 0.5 - vec2f(18.0);
    let b = abs(q) - (half - vec2f(rad));
    let d = length(max(b, vec2f(0.0))) + min(max(b.x, b.y), 0.0) - rad;
    let line = abs(d) - lw * 0.5;
    var k = smoothstep(1.0, -0.5, line) + exp(-max(line, 0.0) * 0.22) * 0.35;
    if (in.params.z > 0.0) {
      // Marching dashes along the perimeter (focus).
      let per = atan2(q.y, q.x) * 18.0 / 3.14159 + in.params.z * 6.0;
      k *= mix(0.45, 1.0, step(0.5, fract(per)));
    }
    let c = in.color.rgb * k;
    o.color = vec4f(c, 0.0);
    o.emissive = vec4f(c * in.emissive, 0.0);
    return o;
  }
  if (mode < 1.5) {
    let lit = in.params.x;
    let t = in.params.y;
    let s = q.x + in.params.z;
    let d = abs(q.y);
    let w = in.size.y * 0.5;
    let groove = 1.0 - smoothstep(w * 0.45, w * 0.6, d);
    let lip = smoothstep(w * 0.2, w * 0.45, d) * groove;
    var c = vec3f(0.006, 0.007, 0.012) * groove + vec3f(0.05, 0.055, 0.07) * lip * 0.4;
    let on = clamp(lit, 0.0, 1.0);
    let both = clamp(lit - 1.0, 0.0, 1.0);
    let core = exp(-d * d / (w * w * 0.06)) * groove;
    let pulse = 0.55 + 0.45 * sin(s * 0.035 - t * 4.0);
    let glow = in.color.rgb * core * (0.35 * on + both * (0.5 + 0.35 * pulse));
    let halo = in.color.rgb * exp(-d / (w * 0.5)) * 0.07 * (on * 0.4 + both);
    let a = groove * 0.85;
    o.color = vec4f(c * a + glow + halo, a);
    o.emissive = vec4f((glow + halo * 0.5) * in.emissive, a);
    return o;
  }
  let p = in.local * 2.0 - 1.0;
  let r2 = dot(p, p);
  let g = exp(-r2 * max(in.params.x, 0.5)) * (1.0 - smoothstep(0.7, 1.0, sqrt(r2)));
  let c = in.color.rgb * g;
  o.color = vec4f(c, 0.0);
  o.emissive = vec4f(c * in.emissive, 0.0);
  return o;
}
`;
