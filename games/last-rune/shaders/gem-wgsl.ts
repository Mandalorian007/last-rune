/**
 * Gem material: a faceted crystal seen from above, glowing from inside.
 *
 * Per instance:
 * - tint     = gem colour (linear)
 * - params.x = kind (0 channel, 1 bend, 2 split, 3 amplify, 4 gate, 5 capacitor)
 * - params.y = state (0 idle, 1 hover, 2 placed, 3 energised, 4 dim-locked, 5 spent: a tray
 *   gem with none left, drawn as a dimmed copy of its idle look, 6 ghost: the held gem
 *   previewed in the socket it would land in, its body faint and its glyph still clear, 7 ring:
 *   the held tray gem's selection ring, the cut's own outline drawn round the gem and turned
 *   with it; nothing is laid over the gem)
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

// held-gem (blind review 9, finding C): one arrow language on every gem. An arrowhead always
// means OUT. An input side is a port: a solid round plug set in from the rim, its lead running
// on to the centre. Round, never pointed, so it cannot read as an arrow (the old half-disc,
// flat on the rim and domed inward, flared under the glow into a funnel that read as one, and
// players wired the Gate backwards). \`at\` is the rim point, \`dir\` points into the gem.
// glyph-truth-2's name is kept: its test counts the inputs by it.
// glyph-truth-4 (blind review 10, E): the port is a hollow ring, not a solid plug. Solid, at
// board size (~32 px) it read as a soft white blob the weight of a facet highlight. As a thin
// bright ring round a dark hole, sat in the glyph's dark halo, it is clearly a mark, and it is
// the opposite of an arrowhead (open and round vs solid and pointed). Leads stop at the ring's
// outer edge (PORT_R + PORT_AT below), so the hole stays dark.
const PORT_AT = 0.32;   // ring centre, in from the rim point
const PORT_R = 0.2;     // ring radius (centre of the stroke)
fn g_inlet(p: vec2f, at: vec2f, dir: vec2f) -> f32 {
  return abs(length(p - (at + dir * PORT_AT)) - PORT_R) + 0.02;
}

// A solid triangle (iq's exact distance), for the outlets' arrowheads.
fn g_tri(p: vec2f, p0: vec2f, p1: vec2f, p2: vec2f) -> f32 {
  let e0 = p1 - p0;
  let e1 = p2 - p1;
  let e2 = p0 - p2;
  let v0 = p - p0;
  let v1 = p - p1;
  let v2 = p - p2;
  let pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  let pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  let pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  let s = sign(e0.x * e2.y - e0.y * e2.x);
  let d = min(min(vec2f(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                  vec2f(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                  vec2f(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

// An outlet: a solid arrowhead whose tip sits at \`tip\`, pointing along \`dir\` (out of the gem).
fn g_outlet(p: vec2f, tip: vec2f, dir: vec2f) -> f32 {
  let n = vec2f(-dir.y, dir.x);
  let back = tip - dir * 0.3;
  return g_tri(p, tip, back + n * 0.25, back - n * 0.25);
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
    // no arrowhead (it is two-way). glyph-truth-3: exactly two arms and nothing else. The old
    // door bar across each end read, lit and bloomed, as a third arm (a T, blind review 8), so
    // each leg now ends plain at the rim, a touch heavier than the hairline glyphs, and nothing
    // is drawn on the two dead sides (the hot core follows the stroke too, see fs_main).
    let e = 0.74;
    let r = 0.26;
    d = g_seg(p, vec2f(0.0, -e), vec2f(0.0, -r));
    d = min(d, g_seg(p, vec2f(r, 0.0), vec2f(e, 0.0)));
    let q = p - vec2f(r, -r);
    if (q.x <= 0.0 && q.y >= 0.0) { d = min(d, abs(length(q) - r)); }
    d -= 0.03;
  } else if (kind == 2) {
    // Split (rules rot 0): one way in, from the south; out both sides (west and east), never
    // straight on. A bold T: a port on the input rim (\`g_inlet\`) feeds the stem to the
    // centre, and the crossbar runs out both ways to a solid arrowhead on each side (D-031).
    // held-gem: one port and two arrows, where the Gate has two ports and one arrow.
    // glyph-truth-4: the stem stops at the ring, so the port's hole stays open; the crossbar
    // with its two heads reads as one double arrow (↔) across the gem, the port below it.
    d = g_seg(p, vec2f(0.0, 0.8 - PORT_AT - PORT_R), vec2f(0.0, 0.0)) - 0.02;
    d = min(d, g_inlet(p, vec2f(0.0, 0.8), vec2f(0.0, -1.0)));
    d = min(d, g_seg(p, vec2f(-0.5, 0.0), vec2f(0.5, 0.0)) - 0.02);
    d = min(d, g_outlet(p, vec2f(-0.8, 0.0), vec2f(-1.0, 0.0)));
    d = min(d, g_outlet(p, vec2f(0.8, 0.0), vec2f(1.0, 0.0)));
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
    // Gate: inputs from west and east meet at the centre; one output leaves north (rules rot
    // 0). held-gem: a port on each input rim (\`g_inlet\`, as the Split's) with its lead to the
    // centre, and one solid arrowhead out: two ports and one arrow, where the Split has one
    // port and two arrows. No ring at the centre: it sat between the two and, small, made the
    // glyph a cross of blobs like the Split's. glyph-truth-4: the crossbar runs ring to ring
    // (o-o, a dumbbell) and the single arrow rises from its middle, where the Split's crossbar
    // ends in two arrowheads (<->) with its one ring below.
    let gl = 0.8 - PORT_AT - PORT_R;
    d = g_seg(p, vec2f(-gl, 0.0), vec2f(gl, 0.0)) - 0.02;
    d = min(d, g_inlet(p, vec2f(-0.8, 0.0), vec2f(1.0, 0.0)));
    d = min(d, g_inlet(p, vec2f(0.8, 0.0), vec2f(-1.0, 0.0)));
    d = min(d, g_seg(p, vec2f(0.0, 0.0), vec2f(0.0, -0.52)) - 0.02);
    d = min(d, g_outlet(p, vec2f(0.0, -0.8), vec2f(0.0, -1.0)));
  } else {
    // Capacitor: two plates across a straight run. glyph-truth-4 (blind review 10, E): the
    // run is one unbroken line rim to rim, like a Channel's, so the way it passes charge
    // ("straight on", either way) shows; before, the leads stopped at the plates and the
    // glyph gave no direction. The plates are long bars across it (a ‡ on a wide bar).
    d = g_seg(p, vec2f(0.0, 0.66), vec2f(0.0, -0.66)) - 0.005;
    d = min(d, g_seg(p, vec2f(-0.56, 0.17), vec2f(0.56, 0.17)) - 0.01);
    d = min(d, g_seg(p, vec2f(-0.56, -0.17), vec2f(0.56, -0.17)) - 0.01);
  }
  return d;
}

// glyph-truth-4: distance to the nearest port's centre (glyph space), for the one-way gems'
// hollow ports; fs_main darkens the hole so the port reads open (a ring, not a blob) under the
// body's inner glow and the bloom. Keep in step with the g_inlet calls in g_glyph.
fn g_port_hole(p: vec2f, kind: i32) -> f32 {
  let c = 0.8 - PORT_AT;
  if (kind == 2) { return length(p - vec2f(0.0, c)); }
  if (kind == 4) { return length(vec2f(abs(p.x) - c, p.y)); }
  return 1e3;
}

struct Cut {
  sides: f32,
  phase: f32,     // angle of the first vertex
  scale: vec2f,   // anisotropic stretch (gem space → unit polygon)
  offset: vec2f,  // centroid shift
};

// glyph-truth-4 (blind review 10, E): a cut's points say where charge leaves. The Split is a
// wide hexagon with its two points on its two outs (W, E), flat top and bottom (no point on N,
// glyph-truth-3, and its port sits on a flat); the Gate is a shield pointing at its one out.
// The Capacitor is no longer a hexagon like the Channel's (pale blue beside cyan read alike):
// it is a squat square-cornered bar lying across its run, the plates along its length.
fn g_cut(kind: i32) -> Cut {
  var c: Cut;
  c.offset = vec2f(0.0);
  c.scale = vec2f(0.98);
  if (kind == 0) {          // long hexagon, points along the flow
    c.sides = 6.0; c.phase = -TAU / 4.0; c.scale = vec2f(0.66, 1.0);
  } else if (kind == 1) {   // square cushion
    c.sides = 4.0; c.phase = TAU / 8.0; c.scale = vec2f(1.08);
  } else if (kind == 2) {   // wide hexagon, pointing at both outs
    c.sides = 6.0; c.phase = 0.0; c.scale = vec2f(1.08, 1.0);
  } else if (kind == 3) {   // round brilliant
    c.sides = 12.0; c.phase = 0.0; c.scale = vec2f(0.97);
  } else if (kind == 4) {   // shield
    c.sides = 5.0; c.phase = -TAU / 4.0; c.scale = vec2f(1.0); c.offset = vec2f(0.0, 0.06);
  } else {                  // squat bar across the run
    c.sides = 4.0; c.phase = TAU / 8.0; c.scale = vec2f(1.2, 0.86);
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

fn g_glyph_light(p: vec2f, kind: i32, w: f32, soft: f32) -> f32 {
  let d = g_glyph(p, kind);
  return smoothstep(w, w * 0.4, d) + exp(-d * 20.0) * soft;
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
  // Derivatives before any early return (WGSL uniformity).
  let gemPx = 1.0 / max(fwidth(in.local.x), 1e-4);
  if (state == 7) {
    // held-gem ring: a gold line on a dark under-stroke along the cut's outline, shrunk so its
    // corners stay inside the quad. Drawn under the held tray gem, hugging its edge.
    let rs = 1.16;
    let fr = g_facet((g_rot(p * rs, -rot) + cut.offset) / cut.scale, cut);
    let pu = 2.0 / in.size.x;
    let dl = abs(fr.sdf / rs + 0.07);
    let lineW = max(0.03, 1.4 * pu);
    let underW = lineW + max(0.03, 1.2 * pu);
    let line = 1.0 - smoothstep(lineW - pu, lineW + pu, dl);
    let under = 1.0 - smoothstep(underW - pu, underW + pu, dl);
    let gold = vec3f(1.0, 0.72, 0.3);
    var ro: FragOut;
    let ra = max(under * 0.85, line);
    ro.color = vec4f(gold * line * 1.1 + vec3f(0.008, 0.005, 0.002) * (1.0 - line), ra);
    ro.emissive = vec4f(gold * line * 0.3 * in.emissive, ra);
    return ro;
  }
  let q = (q0 + cut.offset) / cut.scale;     // unit polygon space
  let f = g_facet(q, cut);
  let pxUnit = 2.0 / in.size.x;              // gem-space units per px
  let alpha = clamp(0.5 - f.sdf / (pxUnit * 1.2), 0.0, 1.0);
  // glyph-truth-3: how small the gem lands on screen (render px across it). Small gems (The
  // Last Rune, Archive, Lift Shaft, a phone's tray) lose their direction marks to the glyph's
  // soft glow and the bloom, which spread by screen pixels, not by gem size. So, small, the
  // glyph glows less softly, blooms less and sits in a darker halo: arrowheads and inlets
  // keep their shape. Large gems are unchanged.
  let small = 1.0 - smoothstep(44.0, 84.0, gemPx);
  let soft = 0.3 * (1.0 - 0.7 * small);

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
  let ghost = state == 6;
  if (ghost) { glow = 0.35; glyphK = 1.15; }

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
    g_glyph_light(gp + disp, kind, lw, soft),
    g_glyph_light(gp, kind, lw, soft),
    g_glyph_light(gp - disp, kind, lw, soft),
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
  let dgl = g_glyph(gp, kind);
  let halo = 1.0 - smoothstep(lw * 1.2, lw * 3.0, dgl);
  // glyph-truth-3: a Bend's two dead sides are dark body, lit or not. Its turn sits off the
  // gem's centre, so a round hot core (and the body's glow) spilled past the elbow onto the
  // dead sides and, under the solve bloom, read as a third arm. For the Bend the core runs
  // along the stroke instead, and an energised Bend's body glow is held down beside it.
  let bend = kind == 1;
  let core = select(exp(-r2 * 12.0), exp(-pow(dgl / 0.1, 2.0)) * exp(-dot(q0, q0) * 2.5), bend);
  // Past the elbow (rot 0: south of it or west of it) is the Bend's dead side; lit, it falls
  // to shadow so the light visibly goes round the corner and nowhere else.
  let deadSide = smoothstep(0.05, 0.45, max(gp.y, -gp.x));
  let bodyK = select(1.0, 1.0 - energy * (0.45 + 0.45 * deadSide), bend);
  body *= bodyK;
  let haloK = max(select(0.65, 0.85, bend), 0.65 + 0.25 * small);
  var col = body * (1.0 - halo * select(haloK, 0.0, dim));
  col += gl * glyphCol * 0.9;
  // Facet edges stay out of the glyph's way (a cut line must not read as part of the wiring).
  col += base * edgeLine * (0.3 + 0.2 * fh) * select(1.0 - halo, 0.5, dim) * bodyK;
  col += vec3f(1.0, 0.95, 0.9) * girdle * (0.18 + 0.5 * rimK);
  // Neighbour light glints, pulled toward white so a gem doesn't turn rainbow.
  let specW = mix(lit.spec, vec3f(engine_luma(lit.spec)), 0.5) * select(0.55, 0.18, dim) * bodyK;
  col += specW * (0.6 + 0.8 * fh);
  col += vec3f(0.75, 0.85, 1.0) * keySpec * 0.55;
  col += lit.diffuse * base * 0.08;
  // Hot white core when energised.
  col += mix(base, vec3f(1.0, 0.97, 0.92), 0.5) * core * energy * 0.35;
  // glyph-truth-4: a port's hole is dark (a hollow ring with a dark rim inside and out), so
  // small it cannot read as a soft white blob, the weight of a facet highlight.
  let hole = (1.0 - smoothstep(PORT_R * 0.45, PORT_R * 0.8, g_port_hole(gp, kind))) * select(1.0, 0.0, dim);
  col *= 1.0 - hole * 0.85;
  if (dim) {
    // Engraved glyph: a dark groove with a faint lit lower lip.
    let dg = g_glyph(q0 * 1.08, kind);
    col *= 1.0 - (1.0 - smoothstep(0.03, 0.06, dg)) * 0.6;
  }

  // Spent (a tray gem with none left): the same gem, dimmed and a little greyed, its glyph
  // still drawn, so every kind keeps its own cut, colour and wiring.
  // polish-10: dimmed only slightly and barely greyed. At 0.42 and 35% grey a gold Amplify
  // went brown and read as another gem (blind review 10); the struck "×0" badge says spent.
  let spentK = select(1.0, 0.35, spent);
  if (spent) {
    col = mix(col, vec3f(engine_luma(col)), 0.12) * 0.68;
  }

  // Ghost (held-gem): the stone shows through the body, the glyph stays near solid, so the
  // preview reads as "this gem, this turn, not here yet".
  // polish-10: it still read as placed (blind review 10), so the whole gem is see-through
  // (body ~36%, glyph ~58%) and a dashed light rim runs round the cut's outline, turned with
  // it: a placed gem never has dashes. Static, so reduced motion needs nothing.
  var a = alpha;
  if (ghost) {
    let gm = clamp(max(max(gl.r, gl.g), gl.b), 0.0, 1.0);
    // glyph-truth-4: a port's hole is open in the ghost, the socket shows through it.
    a = alpha * mix(0.36, 0.58, smoothstep(0.15, 0.7, gm)) * (1.0 - hole);
    let rimD = abs(f.sdf / pxUnit + 2.8);
    let rimW = max(1.4, 0.035 / pxUnit);
    let rimLine = 1.0 - smoothstep(rimW - 0.6, rimW + 0.6, rimD);
    let ang = atan2(q0.y, q0.x) / TAU + 0.5;
    let dk = fract(ang * 10.0);
    let dash = smoothstep(0.02, 0.1, dk) * (1.0 - smoothstep(0.5, 0.58, dk));
    let rim = rimLine * dash;
    col = mix(col, vec3f(1.0, 0.93, 0.74), rim);
    a = max(a, rim * alpha);
  }

  var o: FragOut;
  o.color = vec4f(col, a);
  let em = base * (inner * 0.32 + veil * 0.1) * glow * bodyK + gl * glyphCol * glow * 0.55 * (1.0 - 0.4 * small) +
    mix(base, vec3f(1.0), 0.3) * select(exp(-r2 * 14.0), core, bend) * energy * 0.6 + specW * 0.2;
  // Normalise by brightness so pale gems (capacitor) don't out-bloom saturated ones.
  let lumK = 0.35 / max(engine_luma(base), 0.35);
  o.emissive = vec4f(em * in.emissive * a * lumK * spentK * (1.0 - hole * 0.95), a);
  return o;
}
`;
