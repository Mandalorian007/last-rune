/**
 * Gem material: a faceted crystal seen from above, glowing from inside.
 *
 * Per instance:
 * - tint     = gem colour (linear)
 * - params.x = kind (0 channel, 1 bend, 2 split, 3 amplify, 4 gate, 5 capacitor)
 * - params.y = state (0 idle, 1 hover, 2 placed, 3 energised, 4 dim-locked, 5 spent: a tray
 *   gem with none left, drawn as a dimmed copy of its idle look)
 * - params.z = rotation in radians, clockwise (rotates cut + glyph; lighting stays fixed)
 * - params.w = seed (inclusions, facet sparkle phase)
 * - emissive = glow multiplier (1 = default for the state)
 *
 * Rotation 0 matches rules.md rot 0: straight gems run south→north; Bend joins N–E; Gate takes
 * W + E and outputs N; Split takes S and outputs W + E. Keep glyphs in step with the rules:
 * players read them as the wiring.
 *
 * Look: flat table + two rows of crown facets per side, a dark girdle. The inner glyph is lit
 * from inside and seen through each facet with a different refraction offset (per-channel,
 * so edges split into RGB), cloudy inclusions drift slowly, and specular glints come from
 * the scene's lights (warm candles land on cool stones).
 */
import { LIGHTS_WGSL } from './lights-wgsl';

export const GEM_WGSL = /* wgsl */ `${LIGHTS_WGSL}
const TAU = 6.2831853;

fn g_rot(p: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn g_seg(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

fn g_ring(p: vec2f, c: vec2f, r: f32) -> f32 {
  return abs(length(p - c) - r);
}

/**
 * Glyph distance (gem space, -1..1, y down; flow enters at +y, leaves at -y).
 * Every glyph is drawn edge to edge so it reads at 1280x720: the stroke reaches the sides the
 * bolt uses, with a short "door" bar on each, so the glyph is the wiring (rules.md section 4).
 */
fn g_glyph(p: vec2f, kind: i32) -> f32 {
  var d = 1e3;
  if (kind == 0) {
    // Channel: a straight conduit S to N with a diamond node and a door at each end.
    d = g_seg(p, vec2f(0.0, 0.72), vec2f(0.0, 0.2));
    d = min(d, g_seg(p, vec2f(0.0, -0.2), vec2f(0.0, -0.72)));
    d = min(d, abs(abs(p.x) + abs(p.y) - 0.2));
    d = min(d, g_seg(p, vec2f(-0.16, 0.72), vec2f(0.16, 0.72)));
    d = min(d, g_seg(p, vec2f(-0.16, -0.72), vec2f(0.16, -0.72)));
  } else if (kind == 1) {
    // Bend: an L through the centre, north door to east door (rules: rot 0 joins N-E), with a
    // rounded corner. Both legs run edge to centre, so the turn reads at a glance even small;
    // no arrowhead (it is two-way).
    let e = 0.72;
    let r = 0.26;
    d = g_seg(p, vec2f(0.0, -e), vec2f(0.0, -r));
    d = min(d, g_seg(p, vec2f(r, 0.0), vec2f(e, 0.0)));
    let q = p - vec2f(r, -r);
    if (q.x <= 0.0 && q.y >= 0.0) { d = min(d, abs(length(q) - r)); }
    d = min(d, g_seg(p, vec2f(-0.16, -e), vec2f(0.16, -e)));
    d = min(d, g_seg(p, vec2f(e, -0.16), vec2f(e, 0.16)));
  } else if (kind == 2) {
    // Split (rules rot 0): one way in, from the south; out both sides (west and east), never
    // straight on. A bold T: the stem runs from the input rim to the centre, the crossbar runs
    // rim to rim, and each arm ends in a wide arrowhead pointing out (D-031). Drawn heavier
    // than the other glyphs so it, not the cut, is what reads; nothing points at the input.
    // glyph-truth: the input is a heavy stem capped by a wide door bar at the rim (the
    // Channel's "a side the bolt uses" mark), so the no-arrow end reads at ~30 CSS px, lit or not.
    let e = 0.7;
    let h = 0.24;
    d = g_seg(p, vec2f(0.0, 0.72), vec2f(0.0, 0.0)) - 0.035;
    d = min(d, g_seg(p, vec2f(-0.27, 0.72), vec2f(0.27, 0.72)) - 0.03);
    d = min(d, g_seg(p, vec2f(-e, 0.0), vec2f(e, 0.0)));
    d = min(d, g_seg(p, vec2f(-e + h, -h), vec2f(-e, 0.0)));
    d = min(d, g_seg(p, vec2f(-e + h, h), vec2f(-e, 0.0)));
    d = min(d, g_seg(p, vec2f(e - h, -h), vec2f(e, 0.0)));
    d = min(d, g_seg(p, vec2f(e - h, h), vec2f(e, 0.0)));
    d -= 0.035;
  } else if (kind == 3) {
    // Amplify: a Channel with its diamond node doubled (a diamond inside a diamond), so it reads
    // "a Channel, twice". Symmetric end to end: it can't turn and points neither way (D-031).
    // The two diamonds sit well apart and the stroke is a touch thinner than the others, so
    // the dark gap between them survives the glow and bloom even small (Codex, tray).
    d = g_seg(p, vec2f(0.0, 0.72), vec2f(0.0, 0.54));
    d = min(d, g_seg(p, vec2f(0.0, -0.54), vec2f(0.0, -0.72)));
    d = min(d, abs(abs(p.x) + abs(p.y) - 0.54));
    d = min(d, abs(abs(p.x) + abs(p.y) - 0.2));
    d = min(d, g_seg(p, vec2f(-0.16, 0.72), vec2f(0.16, 0.72)));
    d = min(d, g_seg(p, vec2f(-0.16, -0.72), vec2f(0.16, -0.72)));
    d += 0.022;
  } else if (kind == 4) {
    // Gate: inputs from west and east meet in a ring; one output leaves north (rules rot 0).
    // glyph-truth: each input is a heavy lead capped by a wide door bar at the rim (as the
    // Split's input and the Channel's ends), and the output a bold arrow, so both input sides
    // read at ~30 CSS px, lit or not.
    d = g_seg(p, vec2f(-0.66, 0.0), vec2f(-0.2, 0.0)) - 0.03;
    d = min(d, g_seg(p, vec2f(0.66, 0.0), vec2f(0.2, 0.0)) - 0.03);
    d = min(d, g_seg(p, vec2f(-0.66, -0.25), vec2f(-0.66, 0.25)) - 0.03);
    d = min(d, g_seg(p, vec2f(0.66, -0.25), vec2f(0.66, 0.25)) - 0.03);
    d = min(d, g_ring(p, vec2f(0.0, 0.0), 0.2));
    d = min(d, g_seg(p, vec2f(0.0, -0.2), vec2f(0.0, -0.68)));
    d = min(d, g_seg(p, vec2f(-0.21, -0.47), vec2f(0.0, -0.68)));
    d = min(d, g_seg(p, vec2f(0.21, -0.47), vec2f(0.0, -0.68)));
    d -= 0.01;
  } else {
    // Capacitor: two plates with leads, straight through.
    d = g_seg(p, vec2f(0.0, 0.66), vec2f(0.0, 0.14));
    d = min(d, g_seg(p, vec2f(0.0, -0.14), vec2f(0.0, -0.66)));
    d = min(d, g_seg(p, vec2f(-0.38, 0.14), vec2f(0.38, 0.14)) - 0.015);
    d = min(d, g_seg(p, vec2f(-0.38, -0.14), vec2f(0.38, -0.14)) - 0.015);
  }
  return d;
}

struct Cut {
  sides: f32,
  phase: f32,     // angle of the first vertex
  scale: vec2f,   // anisotropic stretch (gem space → unit polygon)
  offset: vec2f,  // centroid shift
};

fn g_cut(kind: i32) -> Cut {
  var c: Cut;
  c.offset = vec2f(0.0);
  c.scale = vec2f(0.98);
  if (kind == 0) {          // long hexagon, points along the flow
    c.sides = 6.0; c.phase = -TAU / 4.0; c.scale = vec2f(0.66, 1.0);
  } else if (kind == 1) {   // square cushion
    c.sides = 4.0; c.phase = TAU / 8.0; c.scale = vec2f(1.08);
  } else if (kind == 2) {   // octagon, flats on the four sides: points nowhere, so the T leads
    c.sides = 8.0; c.phase = TAU / 16.0; c.scale = vec2f(1.02);
  } else if (kind == 3) {   // round brilliant
    c.sides = 12.0; c.phase = 0.0; c.scale = vec2f(0.97);
  } else if (kind == 4) {   // shield
    c.sides = 5.0; c.phase = -TAU / 4.0; c.scale = vec2f(1.0); c.offset = vec2f(0.0, 0.06);
  } else {                  // flat hexagon
    c.sides = 6.0; c.phase = 0.0; c.scale = vec2f(1.0, 0.9);
  }
  return c;
}

struct Facet {
  sdf: f32,       // polygon distance (unit polygon space, <0 inside)
  rho: f32,       // 0 centre .. 1 girdle
  n: vec3f,       // facet normal (gem space)
  id: f32,
  edge: f32,      // distance to the nearest facet boundary (unit polygon space)
  refr: f32,      // refraction strength through this facet
};

fn g_facet(q: vec2f, cut: Cut) -> Facet {
  var f: Facet;
  let N = cut.sides;
  let T = TAU / N;
  let A = cos(T * 0.5);
  let halfEdge = A * tan(T * 0.5);
  let a = atan2(q.y, q.x) - cut.phase - T * 0.5;
  let k = round(a / T);
  let th = cut.phase + T * 0.5 + k * T;
  let dir = vec2f(cos(th), sin(th));
  let perp = vec2f(-dir.y, dir.x);
  let d = dot(q, dir);
  let rho = d / A;
  let t = clamp(dot(q, perp) / max(halfEdge * max(rho, 0.05), 1e-3), -1.0, 1.0);
  f.sdf = d - A;
  f.rho = rho;
  let table = 0.5;
  var n = vec3f(0.0, 0.0, 1.0);
  var id = 0.0;
  var edge = abs(rho - table) * A;
  f.refr = 0.0;
  if (rho > table) {
    let u = (rho - table) / (1.0 - table);
    let star = u < 0.55 * (1.0 - abs(t));
    // Distance to the sector boundary (t = ±1) and the star/girdle boundary.
    edge = min(edge, (1.0 - abs(t)) * halfEdge * rho);
    edge = min(edge, abs(u - 0.55 * (1.0 - abs(t))) * (1.0 - table) * A * 0.7);
    if (star) {
      n = normalize(vec3f(dir * 0.42, 1.0));
      id = k * 4.0 + 1.0;
      f.refr = 0.22;
    } else {
      let side = select(-1.0, 1.0, t > 0.0);
      edge = min(edge, abs(t) * halfEdge * rho);
      n = normalize(vec3f(dir * 0.85 + perp * side * 0.32, 1.0));
      id = k * 4.0 + 2.0 + max(side, 0.0);
      f.refr = 0.38;
    }
  }
  f.n = vec3f(n.xy / cut.scale, n.z);
  f.n = normalize(f.n);
  f.id = id;
  f.edge = edge;
  return f;
}

fn g_glyph_light(p: vec2f, kind: i32, w: f32) -> f32 {
  let d = g_glyph(p, kind);
  return smoothstep(w, w * 0.4, d) + exp(-d * 20.0) * 0.3;
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let kind = i32(in.params.x + 0.5);
  let state = i32(in.params.y + 0.5);
  let rot = in.params.z;
  let seed = in.params.w;
  let t = globals.time;
  var base = in.color.rgb;

  let p = in.local * 2.0 - 1.0;              // screen-aligned -1..1 (y down)
  let q0 = g_rot(p, -rot);                   // gem space
  let cut = g_cut(kind);
  let q = (q0 + cut.offset) / cut.scale;     // unit polygon space
  let f = g_facet(q, cut);
  let pxUnit = 2.0 / in.size.x;              // gem-space units per px
  let alpha = clamp(0.5 - f.sdf / (pxUnit * 1.2), 0.0, 1.0);

  // State knobs.
  var glow = 0.6;
  var glyphK = 0.85;
  var rimK = 0.0;
  var energy = 0.0;
  if (state == 1) { glow = 0.95; glyphK = 1.25; rimK = 1.0; }
  else if (state == 2) { glow = 0.6; glyphK = 0.9; }
  else if (state == 3) { glow = 1.15; glyphK = 1.6; energy = 1.0; }
  let dim = state == 4;
  let spent = state == 5;

  // Dim-locked gems are dead stone: desaturated, dark, glyph engraved rather than lit.
  if (dim) {
    let l = engine_luma(base);
    base = mix(vec3f(l) * vec3f(0.55, 0.6, 0.8), base, 0.25) * 0.28;
    glow = 0.0;
    glyphK = 0.0;
  }

  // World-space facet normal (rotation applied back) for lighting.
  let nw = vec3f(g_rot(f.n.xy, rot), f.n.z);
  let lit = lights_shade(in.world, 28.0, nw, 70.0);
  // A fixed cool key from the upper left so every gem has one crisp glint.
  let key = normalize(vec3f(-0.5, -0.7, 0.9));
  let keySpec = pow(max(dot(nw, normalize(key + vec3f(0.0, 0.0, 1.0))), 0.0), 60.0);

  // Refraction: each facet sees the inner glyph from a slightly different offset, split per
  // channel. Kept small: the glyph is the wiring and must read cleanly at 1280x720.
  let off = f.n.xy * f.refr;
  let gp = q0 * 1.08 - off * 0.3;
  let lw = 0.13;
  let disp = off * 0.08 + vec2f(0.008, 0.0);
  var gl = vec3f(
    g_glyph_light(gp + disp, kind, lw),
    g_glyph_light(gp, kind, lw),
    g_glyph_light(gp - disp, kind, lw),
  );
  // Energised: a pulse runs along the glyph from input to output.
  let flow = exp(-pow((fract(q0.y * 0.6 + t * 1.1) - 0.5) * 5.0, 2.0));
  gl *= 1.0 + energy * (1.6 * flow);

  // Body: deep and saturated at the girdle, clearer toward the centre.
  let r2 = f.rho * f.rho;
  let fh = engine_hash21(vec2f(f.id, seed * 17.0 + f32(kind)));
  let shimmer = mix(1.0, 0.65 + 0.7 * (0.5 + 0.5 * sin(t * 2.6 + fh * 40.0)), energy);
  let facetVar = (0.3 + 1.05 * fh * fh) * shimmer;
  let cloud = engine_fbm(q0 * 2.3 + vec2f(seed * 9.0 + t * 0.04, t * 0.025), 4);
  let veil = smoothstep(0.45, 0.85, cloud);
  let inner = exp(-r2 * 1.6);
  var body = base * (0.07 + 0.55 * inner) * facetVar * (0.7 + 0.6 * cloud);
  body = mix(body, base * 0.05, smoothstep(0.82, 1.0, f.rho) * 0.75);   // dark girdle band
  // Capacitor is frosted ice: milkier body, softer glyph.
  // glyph-truth: less milk and a cooler blue than before, so a Capacitor in stock reads as
  // available ice, not as the pale, washed-out look of a gem that is used up.
  if (kind == 5) {
    body = mix(body, vec3f(engine_luma(body)) * 1.2 + base * 0.06, 0.18 * veil + 0.06);
    body *= vec3f(0.5, 0.82, 1.35);
  }

  // Facet edges catch the light; the girdle has a thin bright rim.
  let edgeW = pxUnit * 1.1;
  let edgeLine = 1.0 - smoothstep(0.0, edgeW, f.edge);
  let girdle = exp(-pow((f.sdf / pxUnit + 1.6) / 1.2, 2.0));

  var glyphCol = mix(base, vec3f(1.0), 0.5 + 0.2 * energy) * glyphK;
  if (kind == 5) { glyphCol *= vec3f(0.78, 0.94, 1.12); }
  // A dark halo behind the stroke so the glyph stands off the coloured body.
  let halo = 1.0 - smoothstep(lw * 1.2, lw * 3.0, g_glyph(gp, kind));
  var col = body * (1.0 - halo * select(0.65, 0.0, dim));
  col += gl * glyphCol * 0.9;
  // Facet edges stay out of the glyph's way (a cut line must not read as part of the wiring).
  col += base * edgeLine * (0.3 + 0.2 * fh) * select(1.0 - halo, 0.5, dim);
  col += vec3f(1.0, 0.95, 0.9) * girdle * (0.18 + 0.5 * rimK);
  // Neighbour light glints, pulled toward white so a gem doesn't turn rainbow.
  let specW = mix(lit.spec, vec3f(engine_luma(lit.spec)), 0.5) * select(0.55, 0.18, dim);
  col += specW * (0.6 + 0.8 * fh);
  col += vec3f(0.75, 0.85, 1.0) * keySpec * 0.55;
  col += lit.diffuse * base * 0.08;
  // Hot white core when energised.
  col += mix(base, vec3f(1.0, 0.97, 0.92), 0.5) * exp(-r2 * 12.0) * energy * 0.35;
  if (dim) {
    // Engraved glyph: a dark groove with a faint lit lower lip.
    let dg = g_glyph(q0 * 1.08, kind);
    col *= 1.0 - (1.0 - smoothstep(0.03, 0.06, dg)) * 0.6;
  }

  // Spent (a tray gem with none left): the same gem, dimmed and a little greyed, its glyph
  // still drawn, so every kind keeps its own cut, colour and wiring.
  let spentK = select(1.0, 0.16, spent);
  if (spent) {
    col = mix(col, vec3f(engine_luma(col)), 0.35) * 0.42;
  }

  var o: FragOut;
  o.color = vec4f(col, alpha);
  let em = base * (inner * 0.32 + veil * 0.1) * glow + gl * glyphCol * glow * 0.55 +
    mix(base, vec3f(1.0), 0.3) * exp(-r2 * 14.0) * energy * 0.6 + specW * 0.2;
  // Normalise by brightness so pale gems (capacitor) don't out-bloom saturated ones.
  let lumK = 0.35 / max(engine_luma(base), 0.35);
  o.emissive = vec4f(em * in.emissive * alpha * lumK * spentK, alpha);
  return o;
}
`;
