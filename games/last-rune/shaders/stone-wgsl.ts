/**
 * Stone: baked once into two textures per surface (albedo sRGB + normal/height/AO), then lit
 * every frame by the light set. Surfaces: rough-hewn block wall, perspective flagstone floor,
 * and the carved altar slab with round sockets.
 */
import { LIGHTS_WGSL } from './lights-wgsl';

/** Generator uniforms (`StoneGen`), 16 floats. */
export const STONE_GEN_FLOATS = 16;

/** Cells per float of the altar's solid-cell mask (an f32 holds 24 integer bits exactly). */
export const SOLID_BITS = 24;

/** Generator modes. */
export const STONE_MODE = { wall: 0, floor: 1, altar: 2 } as const;

/** Vertical height scale (px) of the baked height field; used by the lit pass for lights. */
export const STONE_HEIGHT_PX = 26;

const GEN_COMMON = /* wgsl */ `
struct StoneGen {
  size: vec4f,    // width px, height px, seed, mode
  altar: vec4f,   // cols, rows, pitch px, margin px
  altar2: vec4f,  // front face height px, socket radius px, top face height px, -
  solid: vec4f,   // altar: cells carved solid (no socket), 24 bits per float, row-major
};
@group(0) @binding(0) var<uniform> G: StoneGen;

struct Surf {
  h: f32,          // 0..1 height
  albedo: vec3f,   // linear
  ao: f32,
  alpha: f32,
  front: f32,      // 1 on a vertical front face (altar), normal is overridden
};

const SLATE = vec3f(0.050, 0.056, 0.072);
const SLATE_DARK = vec3f(0.011, 0.014, 0.021);
const SLATE_LIGHT = vec3f(0.127, 0.153, 0.209);
const MOSS = vec3f(0.032, 0.062, 0.020);
const MOSS_TIP = vec3f(0.07, 0.10, 0.03);

fn st_voronoi(p: vec2f) -> vec3f {
  let ip = floor(p);
  let fp = fract(p);
  var best = 8.0;
  var bc = vec2f(0.0);
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let g = vec2f(f32(i), f32(j));
      let o = engine_hash22(ip + g);
      let r = g + o - fp;
      let d = dot(r, r);
      if (d < best) {
        best = d;
        bc = ip + g + o;
      }
    }
  }
  return vec3f(bc, sqrt(best));
}

fn st_rbox(p: vec2f, half: vec2f, r: f32) -> f32 {
  // Signed distance to a rounded box (negative inside).
  let q = abs(p) - half + r;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

/** Hewn block surface: chisel facets, grain, tool marks. e = distance to the block edge. */
fn st_hewn(px: vec2f, hb: f32, e: f32, scale: f32) -> vec2f {
  let vp = px / (70.0 * scale) + hb * 13.0;
  let vor = st_voronoi(vp);
  let g = (engine_hash22(vor.xy * 3.1) - 0.5) * 0.8;
  let facet = dot(vp - vor.xy, g);
  var top = 0.8 + 0.08 * hb + facet * 0.16;
  top += (engine_fbm(px * 0.018 / scale + hb * 5.0, 4) - 0.5) * 0.3;
  top += (engine_noise(px * 0.2) - 0.5) * 0.035;
  // Parallel tool marks in patches.
  let ang = hb * 6.2831;
  let dir = vec2f(cos(ang), sin(ang));
  let gl = abs(fract(dot(px, dir) / (8.0 * scale)) - 0.5) * 2.0;
  let groove = 1.0 - smoothstep(0.0, 0.35, gl);
  let toolMask = smoothstep(0.5, 0.72, engine_fbm(px * 0.008 / scale + hb * 7.0, 3));
  top -= groove * toolMask * 0.06;
  let shoulder = sqrt(clamp(e / (16.0 * scale), 0.0, 1.0));
  return vec2f(top * shoulder, toolMask * groove);
}

fn st_slate_albedo(px: vec2f, hb: f32, scale: f32) -> vec3f {
  var c = SLATE * (0.7 + 0.65 * hb);
  c *= mix(vec3f(1.08, 0.98, 0.9), vec3f(0.88, 0.97, 1.12), engine_hash21(vec2f(hb * 91.0, 3.0)));
  let strata = engine_fbm(vec2f(px.x * 0.003, px.y * 0.035) / scale + hb * 9.0, 4);
  c *= 0.72 + 0.6 * strata;
  let mottled = engine_fbm(px * 0.04 / scale + 3.0, 3);
  c *= 0.85 + 0.3 * mottled;
  // Mica speckles.
  c += SLATE_LIGHT * 0.18 * step(0.995, engine_hash21(floor(px * 0.6)));
  return c;
}

fn st_moss(px: vec2f, amount: f32) -> f32 {
  let clump = engine_fbm(px * 0.02 + 11.0, 4);
  let fine = engine_noise(px * 0.35);
  return smoothstep(0.55 - amount * 0.25, 0.75 - amount * 0.2, clump) * (0.75 + 0.25 * fine);
}

fn wall_surf(px: vec2f) -> Surf {
  var s: Surf;
  let seed = G.size.z;
  let rowH = 135.0;
  let yb = px.y + (engine_noise(vec2f(px.x * 0.004, 1.3 + seed)) - 0.5) * 16.0;
  let row = floor(yb / rowH);
  let ty = yb - row * rowH;
  let bw = 250.0;
  let xs = px.x + row * 97.0;
  let i = floor(xs / bw);
  let jit = 120.0;
  let b0 = i * bw + (engine_hash21(vec2f(i, row + seed)) - 0.5) * jit;
  let b1 = (i + 1.0) * bw + (engine_hash21(vec2f(i + 1.0, row + seed)) - 0.5) * jit;
  var left = b0;
  var right = b1;
  var bi = i;
  if (xs < b0) {
    left = (i - 1.0) * bw + (engine_hash21(vec2f(i - 1.0, row + seed)) - 0.5) * jit;
    right = b0;
    bi = i - 1.0;
  } else if (xs >= b1) {
    left = b1;
    right = (i + 2.0) * bw + (engine_hash21(vec2f(i + 2.0, row + seed)) - 0.5) * jit;
    bi = i + 1.0;
  }
  let hb = engine_hash21(vec2f(bi, row) * 1.37 + seed);
  let centre = vec2f((left + right) * 0.5, rowH * 0.5);
  let half = vec2f((right - left) * 0.5 - 4.0, rowH * 0.5 - 4.0);
  var e = -st_rbox(vec2f(xs, ty) - centre, half, 16.0);
  // Chipped edges: small bites everywhere, a few big ones.
  e -= (engine_fbm(px * 0.035 + hb * 50.0, 4) - 0.35) * 14.0;
  e -= smoothstep(0.6, 0.9, engine_noise(px * 0.014 + hb * 31.0)) * 26.0;

  let hw = st_hewn(px, hb, e, 1.0);
  let mortarH = 0.06 + engine_fbm(px * 0.09, 3) * 0.1;
  let inBlock = smoothstep(-1.0, 1.5, e);
  s.h = mix(mortarH, hw.x, inBlock);

  var c = st_slate_albedo(px, hb, 1.0);
  // Fresh chips and worn edges are lighter.
  let rim = 1.0 - smoothstep(0.0, 12.0, e);
  c = mix(c, SLATE_LIGHT * (0.6 + 0.4 * hb), rim * 0.45 * inBlock);
  // Grime streaks running down from the mortar line above.
  let streak = engine_fbm(vec2f(px.x * 0.06, px.y * 0.006), 3);
  c *= 1.0 - smoothstep(0.45, 0.8, streak) * 0.45 * (1.0 - ty / rowH);
  // Damp moss: lower part of blocks and in the joints, more of it near the floor.
  let lowWall = 0.25 + smoothstep(0.35, 1.0, px.y / G.size.y) * 0.9;
  let mossBand = smoothstep(0.55, 0.95, ty / rowH) + (1.0 - inBlock);
  let m = st_moss(px, lowWall) * clamp(mossBand, 0.0, 1.0) * lowWall;
  let mossCol = mix(MOSS, MOSS_TIP, engine_noise(px * 0.25));
  c = mix(c, mossCol, clamp(m, 0.0, 0.85));
  s.h += m * 0.06;

  let mortar = SLATE_DARK * (0.5 + 0.7 * engine_noise(px * 0.3));
  s.albedo = mix(mortar, c, inBlock);
  s.ao = mix(0.3, 1.0, smoothstep(-3.0, 22.0, e)) * (1.0 - hw.y * 0.25);
  s.alpha = 1.0;
  s.front = 0.0;
  return s;
}

fn floor_surf(pxIn: vec2f) -> Surf {
  var s: Surf;
  let seed = G.size.z;
  // Perspective: v = 0 far (top), 1 near (bottom).
  let v = pxIn.y / G.size.y;
  let depth = 1.0 / (0.3 + 0.7 * v);
  let px = vec2f((pxIn.x - G.size.x * 0.5) * depth + G.size.x * 0.5, depth * 520.0);
  let rowH = 330.0;
  let row = floor(px.y / rowH);
  let ty = px.y - row * rowH;
  let bw = 420.0;
  let xs = px.x + row * 140.0;
  let i = floor(xs / bw);
  let jit = 110.0;
  let b0 = i * bw + (engine_hash21(vec2f(i, row + seed)) - 0.5) * jit;
  let b1 = (i + 1.0) * bw + (engine_hash21(vec2f(i + 1.0, row + seed)) - 0.5) * jit;
  var left = b0;
  var right = b1;
  var bi = i;
  if (xs < b0) {
    left = (i - 1.0) * bw + (engine_hash21(vec2f(i - 1.0, row + seed)) - 0.5) * jit;
    right = b0;
    bi = i - 1.0;
  } else if (xs >= b1) {
    left = b1;
    right = (i + 2.0) * bw + (engine_hash21(vec2f(i + 2.0, row + seed)) - 0.5) * jit;
    bi = i + 1.0;
  }
  let hb = engine_hash21(vec2f(bi, row) * 2.11 + seed);
  let centre = vec2f((left + right) * 0.5, rowH * 0.5);
  let half = vec2f((right - left) * 0.5 - 5.0, rowH * 0.5 - 5.0);
  var e = -st_rbox(vec2f(xs, ty) - centre, half, 20.0);
  e -= (engine_fbm(px * 0.03 + hb * 40.0, 4) - 0.35) * 16.0;
  e -= smoothstep(0.62, 0.9, engine_noise(px * 0.012 + hb * 17.0)) * 24.0;
  // Measure edges in screen px so bevels compress with distance.
  let es = e / depth;
  let hw = st_hewn(px, hb, e, 1.3);
  let inBlock = smoothstep(-1.0, 1.5, es);
  s.h = mix(0.05, hw.x * 0.8, inBlock);
  var c = st_slate_albedo(vec2f(px.x, px.y * 0.1), hb, 1.3) * 0.85;
  // Foot-worn centre is smoother and slightly lighter.
  c *= 1.0 + 0.15 * smoothstep(20.0, 60.0, e);
  let m = st_moss(px * 0.8, 0.8) * (1.0 - inBlock * 0.7);
  c = mix(c, mix(MOSS, MOSS_TIP, engine_noise(px * 0.2)), clamp(m, 0.0, 0.9));
  let mortar = SLATE_DARK * (0.4 + 0.6 * engine_noise(px * 0.25));
  s.albedo = mix(mortar, c, inBlock);
  s.ao = mix(0.3, 1.0, smoothstep(-3.0, 18.0, es));
  s.alpha = 1.0;
  s.front = 0.0;
  return s;
}

// A cell carved solid (phones: blocked)?
fn alt_solid(cell: vec2f) -> bool {
  let ci = u32(cell.y * G.altar.x + cell.x);
  return ((u32(G.solid[ci / ${SOLID_BITS}u]) >> (ci % ${SOLID_BITS}u)) & 1u) == 1u;
}

// Hugged slab (phones, mobile-5-board): signed distance to the top face as the union of one
// rounded block per open cell, each a margin bigger than its cell. Solid cells are left out,
// so the wall shows through where there is no socket.
fn alt_hug(px: vec2f) -> f32 {
  let pitch = G.altar.z;
  let m = G.altar.w;
  let base = round((px - m - pitch * 0.5) / pitch);
  let half = vec2f(pitch * 0.5 + m - 3.0);
  let rc = min(m * 0.9, 22.0);
  var d = 1e5;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let cell = base + vec2f(f32(dx), f32(dy));
      if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= G.altar.x || cell.y >= G.altar.y) {
        continue;
      }
      if (alt_solid(cell)) { continue; }
      let sc = m + pitch * 0.5 + cell * pitch;
      d = min(d, st_rbox(px - sc, half, rc));
    }
  }
  return d;
}

fn alt_open(cell: vec2f) -> bool {
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= G.altar.x || cell.y >= G.altar.y) {
    return false;
  }
  return !alt_solid(cell);
}

// A solid cell inside the slab (mobile-6-board; mirrored by recessCells in socket-looks.ts):
// open sockets on both sides of it along its row, or above and below it in its column.
fn alt_inner(cell: vec2f) -> bool {
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= G.altar.x || cell.y >= G.altar.y) {
    return false;
  }
  if (!alt_solid(cell)) { return false; }
  var l = false;
  var r = false;
  var u = false;
  var d = false;
  for (var i = 0.0; i < G.altar.x; i += 1.0) {
    if (i == cell.x || alt_solid(vec2f(i, cell.y))) { continue; }
    if (i < cell.x) { l = true; } else { r = true; }
  }
  for (var j = 0.0; j < G.altar.y; j += 1.0) {
    if (j == cell.y || alt_solid(vec2f(cell.x, j))) { continue; }
    if (j < cell.y) { u = true; } else { d = true; }
  }
  return (l && r) || (u && d);
}

// Signed distance to the recessed stone: one block per inner solid cell, the same size as the
// hugged top face's blocks, so recess and top face meet without a seam of wall between them.
fn alt_recess(px: vec2f) -> f32 {
  let pitch = G.altar.z;
  let m = G.altar.w;
  let base = round((px - m - pitch * 0.5) / pitch);
  let half = vec2f(pitch * 0.5 + m - 3.0);
  let rc = min(m * 0.9, 22.0);
  var d = 1e5;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let cell = base + vec2f(f32(dx), f32(dy));
      if (!alt_inner(cell)) { continue; }
      let sc = m + pitch * 0.5 + cell * pitch;
      d = min(d, st_rbox(px - sc, half, rc));
    }
  }
  return d;
}

// How deep inside the hugged top face a point is (px, negative outside). The union's own
// distance (alt_hug) is only good near its edge: between two open cells it reads a margin
// deep, which would draw chipped seams across the stone. So deeper in, measure to the
// nearest hole instead: each non-open cell, grown into non-open neighbours and shrunk away
// from open ones by the same margin, so the holes tile the wall exactly.
fn alt_depth(px: vec2f) -> f32 {
  let u = -alt_hug(px);
  let m = G.altar.w;
  if (u < m * 0.5) { return u; }
  let pitch = G.altar.z;
  let k = m - 3.0;
  let base = round((px - m - pitch * 0.5) / pitch);
  var d = 1e5;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let cell = base + vec2f(f32(dx), f32(dy));
      if (alt_open(cell)) { continue; }
      let lo = m + cell * pitch - vec2f(
        select(k + 2.0, -k, alt_open(cell + vec2f(-1.0, 0.0))),
        select(k + 2.0, -k, alt_open(cell + vec2f(0.0, -1.0))));
      let hi = m + (cell + 1.0) * pitch + vec2f(
        select(k + 2.0, -k, alt_open(cell + vec2f(1.0, 0.0))),
        select(k + 2.0, -k, alt_open(cell + vec2f(0.0, 1.0))));
      d = min(d, st_rbox(px - (lo + hi) * 0.5, (hi - lo) * 0.5, 0.0));
    }
  }
  return max(d, m * 0.5);
}

// Distance from the top face's outline, inset by k (negative inside): the full rounded rect,
// or the hugged union on phones (which keeps its own corner radius, not r).
fn alt_inset(px: vec2f, k: f32, r: f32) -> f32 {
  if (G.altar2.w > 0.5) { return alt_hug(px) + k - 3.0; }
  let inner = vec2f(G.size.x, G.altar2.z) * 0.5;
  return st_rbox(px - inner, inner - k, r);
}

fn altar_surf(px: vec2f) -> Surf {
  var s: Surf;
  let seed = G.size.z;
  let W = G.size.x;
  let topH = G.altar2.z;
  let fh = G.altar2.x;
  let pitch = G.altar.z;
  let margin = G.altar.w;
  let R = G.altar2.y;
  let hb = engine_hash21(vec2f(seed, 7.7));
  let hug = G.altar2.w > 0.5;

  // Outer silhouette with chips. Hugged: the top face swept down by the front face.
  var uTop = 0.0;
  var uUp = 0.0;
  var e = 0.0;
  if (hug) {
    uTop = alt_depth(px);
    uUp = alt_depth(px - vec2f(0.0, fh));
    e = max(max(uTop, uUp), alt_depth(px - vec2f(0.0, fh * 0.5)));
  } else {
    let full = vec2f(W, topH + fh);
    e = -st_rbox(px - full * 0.5, full * 0.5 - 3.0, 28.0);
  }
  e -= (engine_fbm(px * 0.04 + 9.0, 4) - 0.4) * 10.0;
  e -= smoothstep(0.65, 0.9, engine_noise(px * 0.02 + seed)) * 18.0;
  s.alpha = smoothstep(0.0, 1.5, e);

  let lipY = topH;
  // How far below the top face's lip a front-face pixel is (px).
  var below = px.y - lipY;
  var onTop = px.y < lipY;
  if (hug) {
    onTop = uTop > 0.0;
    below = fh - clamp(uUp, 0.0, fh);
  }
  if (onTop) {
    // --- top face ---
    let eFront = select(lipY - px.y, uTop, hug);
    let eTop = min(e, eFront + (engine_noise(px * 0.05) - 0.5) * 8.0);
    let hw = st_hewn(px, hb, eTop, 1.6);
    var h = 0.55 + hw.x * 0.45;
    var c = st_slate_albedo(px * 0.9, hb, 1.4) * 1.05;
    // Worn, smoother centre.
    // (The worn centre and the moss keep to the whole rect, hugged or not.)
    let innerD = -st_rbox(px - vec2f(W, topH) * 0.5, vec2f(W, topH) * 0.5 - margin, 18.0);
    c *= 1.0 + 0.12 * smoothstep(0.0, 80.0, innerD);

    // Carved border groove (double line).
    let gi = margin * 0.45;
    let gd = abs(alt_inset(px, gi, 22.0));
    let groove = 1.0 - smoothstep(2.5, 6.0, gd);
    let gd2 = abs(alt_inset(px, gi + 14.0, 16.0));
    // Hugged, the inner line would ring every cell on a thin phone margin: one line only.
    let groove2 = (1.0 - smoothstep(0.8, 2.2, gd2)) * select(1.0, 0.0, hug);
    h -= groove * 0.35 + groove2 * 0.12;
    c *= 1.0 - groove * 0.45 - groove2 * 0.25;
    // Rune ticks between the outer edge and the groove.
    let band = smoothstep(2.0, 6.0, -alt_inset(px, 6.0, 26.0)) *
      (1.0 - smoothstep(-1.0, 3.0, -alt_inset(px, gi - 7.0, 24.0)));
    let along = (px.x + px.y) / 38.0;
    let tick = (1.0 - smoothstep(0.06, 0.12, abs(fract(along) - 0.5))) *
      step(0.35, engine_hash21(vec2f(floor(along), 3.0)));
    h -= tick * band * 0.12;
    c *= 1.0 - tick * band * 0.3;

    // Sockets: round carved bowls on the grid.
    let g = (px - margin - pitch * 0.5) / pitch;
    let cell = clamp(round(g), vec2f(0.0), vec2f(G.altar.x - 1.0, G.altar.y - 1.0));
    let sc = margin + pitch * 0.5 + cell * pitch;
    let r = length(px - sc);
    let ch = engine_hash21(cell + seed);
    // A solid cell (phones: blocked) has no socket: the worn slab runs on over it.
    let ci = u32(cell.y * G.altar.x + cell.x);
    let solid = (u32(G.solid[ci / ${SOLID_BITS}u]) >> (ci % ${SOLID_BITS}u)) & 1u;
    let rr = select(r / R, 2.0, solid == 1u);
    if (rr < 1.0) {
      let bowl = sqrt(1.0 - rr * rr);
      h = 0.95 - 0.7 * bowl + (engine_noise(px * 0.3) - 0.5) * 0.03;
      // Radial chisel marks inside the bowl.
      let a = atan2(px.y - sc.y, px.x - sc.x);
      let rad = abs(fract(a * 9.0 / 6.2831 + ch) - 0.5);
      h -= (1.0 - smoothstep(0.05, 0.2, rad)) * 0.03 * rr;
      c = c * mix(0.55, 0.8, rr) * vec3f(0.95, 0.97, 1.05);
    } else {
      // Raised, worn lip.
      let lip = (1.0 - smoothstep(0.0, 10.0, r - R)) * f32(1u - solid);
      h += lip * 0.12 * (1.0 - smoothstep(0.0, 3.0, R - r));
      c = mix(c, SLATE_LIGHT * 0.75, lip * 0.35);
    }
    // Moss in the corners and along the groove.
    let corner = 1.0 - smoothstep(60.0, 200.0, min(min(px.x, W - px.x), min(px.y, topH - px.y)));
    let m = st_moss(px, 0.25) * clamp(corner * 0.8 + groove * 0.3, 0.0, 1.0);
    c = mix(c, mix(MOSS, MOSS_TIP, engine_noise(px * 0.25)), clamp(m, 0.0, 0.6));
    // Fresh chips at the rim.
    let rim = 1.0 - smoothstep(0.0, 14.0, eTop);
    c = mix(c, SLATE_LIGHT * 0.8, rim * 0.5);
    s.h = h;
    s.albedo = c;
    s.ao = mix(0.45, 1.0, smoothstep(0.0, 20.0, eTop)) * (1.0 - groove * 0.4) *
      mix(0.55, 1.0, smoothstep(0.35, 1.0, rr));
    s.front = 0.0;
  } else {
    // --- front face (vertical, faces the viewer and down) ---
    let fy = below / fh;
    let hw = st_hewn(px * vec2f(1.0, 2.0), hb + 0.3, e, 1.2);
    var c = st_slate_albedo(px * vec2f(1.0, 2.5), hb + 0.5, 1.0) * 1.05;
    // Horizontal chisel lines.
    let ln = 1.0 - smoothstep(0.0, 0.25, abs(fract(px.y / 7.0) - 0.5) * 2.0);
    c *= 1.0 - ln * 0.12;
    let m = st_moss(px * vec2f(1.0, 1.5), 0.9) * smoothstep(0.3, 1.0, fy);
    c = mix(c, mix(MOSS, MOSS_TIP, engine_noise(px * 0.25)), clamp(m, 0.0, 0.85));
    // Bright worn lip at the top edge.
    let lip = 1.0 - smoothstep(0.0, 8.0, below);
    c = mix(c, SLATE_LIGHT, lip * 0.5);
    s.h = hw.x * 0.5;
    s.albedo = c;
    s.ao = mix(0.75, 1.0, fy) * (1.0 - 0.45 * smoothstep(0.8, 1.0, fy));
    s.front = 1.0;
  }
  if (hug) {
    // A soft contact shadow on the wall round the hugged stone, so it stands off the wall.
    // The stone a shade paler than the wall too: on a phone the wall shows between islands.
    let sh = 0.75 * (1.0 - smoothstep(0.0, 18.0, -e));
    // A blocked cell inside the slab (mobile-6-board): the same stone, sunk a step, its floor
    // shaded where the raised stone overhangs it. Never the black wall in a clipped box.
    let rd = alt_recess(px) - (engine_fbm(px * 0.04 + 3.0, 3) - 0.4) * 6.0;
    let rk = (1.0 - smoothstep(-1.5, 1.5, rd)) * (1.0 - s.alpha);
    let sunk = st_slate_albedo(px * 0.9, hb, 1.4) * 1.3 * (0.62 + 0.3 * smoothstep(2.0, 22.0, -e));
    s.albedo = mix(SLATE_DARK * 0.15, s.albedo * 1.3, s.alpha);
    s.albedo = mix(s.albedo, sunk, rk);
    s.h = mix(s.h, 0.0, rk);
    // A floor faces up like the top face: no front-face tilt, open to the light.
    s.ao = mix(s.ao, 0.9, rk);
    s.front = select(s.front, 0.0, rk > 0.5);
    s.alpha = max(max(s.alpha, rk), sh);
  }
  return s;
}

fn stone_surf(px: vec2f) -> Surf {
  let mode = i32(G.size.w);
  if (mode == 1) { return floor_surf(px); }
  if (mode == 2) { return altar_surf(px); }
  return wall_surf(px);
}
`;

/** Albedo pass (rgba8unorm-srgb): rgb albedo, a = coverage. */
export const STONE_ALBEDO_WGSL = /* wgsl */ `${GEN_COMMON}
fn shade(uv: vec2f) -> vec4f {
  let s = stone_surf(uv * G.size.xy);
  return vec4f(s.albedo, s.alpha);
}
`;

/** Normal pass (rgba8unorm): rg = normal.xy * 0.5 + 0.5, b = height, a = AO. */
export const STONE_NORMAL_WGSL = /* wgsl */ `${GEN_COMMON}
fn shade(uv: vec2f) -> vec4f {
  let px = uv * G.size.xy;
  let s = stone_surf(px);
  let sx = stone_surf(px + vec2f(1.0, 0.0));
  let sy = stone_surf(px + vec2f(0.0, 1.0));
  let k = ${STONE_HEIGHT_PX.toFixed(1)};
  var n = normalize(vec3f(-(sx.h - s.h) * k, -(sy.h - s.h) * k, 1.0));
  if (s.front > 0.5) {
    n = normalize(vec3f(n.x * 0.7, 0.25 + n.y * 0.5, 0.95));
  }
  return vec4f(n.xy * 0.5 + 0.5, clamp(s.h, 0.0, 1.0), clamp(s.ao, 0.0, 1.0));
}
`;

/**
 * Lit surface: samples a baked albedo + normal/height texture pair and shades it with the
 * light set. tint multiplies albedo; params.x = normal strength (0 → 1), params.y = specular
 * (wet sheen, default 0.08).
 */
export const LIT_SURFACE_WGSL = /* wgsl */ `${LIGHTS_WGSL}
@group(1) @binding(1) var samp: sampler;
@group(1) @binding(2) var albedoTex: texture_2d<f32>;
@group(1) @binding(3) var normalTex: texture_2d<f32>;

@fragment fn fs_main(in: VSOut) -> FragOut {
  let a = textureSample(albedoTex, samp, in.uv);
  let nh = textureSample(normalTex, samp, in.uv);
  let strength = select(in.params.x, 1.0, in.params.x <= 0.0);
  var nxy = (nh.xy * 2.0 - 1.0) * strength;
  let n = normalize(vec3f(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.05))));
  let h = nh.z * ${STONE_HEIGHT_PX.toFixed(1)};
  let lit = lights_shade(in.world, h, n, 18.0);
  let specK = select(in.params.y, 0.08, in.params.y <= 0.0);
  let ao = nh.w;
  var col = a.rgb * in.color.rgb * lit.diffuse * ao + lit.spec * specK * ao * ao;
  col *= lights_floor(in.world);
  var o: FragOut;
  o.color = vec4f(col, a.a * in.color.a);
  o.emissive = vec4f(0.0, 0.0, 0.0, a.a * in.color.a);
  return o;
}
`;

/**
 * Socket state overlay, drawn over a baked socket (quad = 2.6 × socket radius).
 * params.x = state (1 blocked, 2 highlighted, 3 wanted: dotted ring in the needed colour, 4 rim,
 * 5 plate, 6 collar: the iron ring and rivets of a fixed gem, 7 legal: the held gem may go here,
 * 8 fault: the thick red ring a failed strike's Try line points at),
 * params.y = seed, params.z = intensity/pulse (0..1+). tint = highlight colour (linear).
 */
export const SOCKET_WGSL = /* wgsl */ `${LIGHTS_WGSL}
@fragment fn fs_main(in: VSOut) -> FragOut {
  // Socket radius = 1; the quad reaches 1.3 radii, or params.w when set (collar 1.6, fault 1.42).
  let p = (in.local * 2.0 - 1.0) * select(1.3, in.params.w, in.params.w > 0.0);
  let r = length(p);
  let state = i32(in.params.x + 0.5);
  let seed = in.params.y;
  let k = in.params.z;
  var o: FragOut;
  o.color = vec4f(0.0);
  o.emissive = vec4f(0.0);

  if (state == 1) {
    // Blocked: the socket is sealed with a dressed capstone, flush with the slab and paler than
    // it, with a deep X chiselled across. An open socket keeps its dark bowl and rim, so the
    // two never read alike, even under a veil or in the dark.
    let cap = 0.96;
    let a = 1.0 - smoothstep(cap - 0.03, cap + 0.03, r);
    // Bevelled edge: the rim rounds down into the seam.
    let bevel = smoothstep(cap - 0.2, cap, r);
    // Two grooves, V-section, stopping short of the rim.
    let u = (p.x + p.y) * 0.70710678;
    let v = (p.x - p.y) * 0.70710678;
    let w = 0.11;
    let reach = smoothstep(0.7, 0.6, r);
    let g1 = max(1.0 - abs(u) / w, 0.0) * reach;
    let g2 = max(1.0 - abs(v) / w, 0.0) * reach;
    let groove = max(g1, g2);
    // Height: flat top, bevel falling away, grooves cut in.
    let h = 1.0 - bevel * bevel * 0.8 - groove * 0.7 + (engine_noise(p * 16.0 + seed) - 0.5) * 0.05;
    // Normal from the analytic slopes (bevel radial, grooves across their axis).
    var gx = 0.0;
    var gy = 0.0;
    if (r > 0.001) {
      let rb = 1.6 * bevel / 0.2;
      gx -= p.x / r * rb * smoothstep(cap - 0.2, cap - 0.18, r);
      gy -= p.y / r * rb * smoothstep(cap - 0.2, cap - 0.18, r);
    }
    if (g1 >= g2 && g1 > 0.0) {
      let s = sign(u) * 0.7 / w;
      gx += s * 0.70710678;
      gy += s * 0.70710678;
    } else if (g2 > 0.0) {
      let s = sign(v) * 0.7 / w;
      gx += s * 0.70710678;
      gy -= s * 0.70710678;
    }
    let n = normalize(vec3f(-gx * 0.12, -gy * 0.12, 1.0));
    let lit = lights_shade(in.world, h * 10.0, n, 10.0);
    let grain = 0.82 + 0.3 * engine_fbm(p * 5.0 + seed * 3.0, 3);
    let stone = vec3f(0.16, 0.152, 0.142) * grain;
    // Grooves hold soot; the lid gets a little lichen at the seam.
    var c = mix(stone, vec3f(0.025, 0.024, 0.024), smoothstep(0.15, 0.75, groove));
    c = mix(c, vec3f(0.06, 0.08, 0.04), bevel * 0.35 * smoothstep(0.55, 0.8, engine_fbm(p * 4.0 + seed, 3)));
    var col = c * lit.diffuse * 1.4 + lit.spec * 0.04 * (1.0 - groove);
    // A thin dark seam where the lid meets the slab.
    col *= 1.0 - 0.75 * exp(-pow((r - cap) * 22.0, 2.0));
    // Keep the cap legible in the dark: a faint floor of its own pale stone.
    col = max(col, c * 0.07);
    col *= lights_floor(in.world);
    o.color = vec4f(col, a);
    o.emissive = vec4f(0.0, 0.0, 0.0, a);
    return o;
  }

  if (state == 4) {
    // Rim (phones): a faint pale lip round an open socket, so every empty socket reads as a
    // place for a gem from edge to edge of the board. Painted stone, not light.
    // mobile-6-board: a pale worn-stone band, lit from the top, at least 3:1 on the slab.
    let lip = smoothstep(0.86, 0.91, r) * (1.0 - smoothstep(1.02, 1.08, r));
    let lit = lights_shade(in.world, 4.0, vec3f(0.0, 0.0, 1.0), 6.0);
    let top = 0.86 - 0.14 * (p.y / max(r, 0.001)); // y-down: the upper lip catches the light
    let c = vec3f(0.74, 0.7, 0.62) * top * (0.75 + 0.25 * lit.diffuse);
    let g = lip * 0.92 * k;
    o.color = vec4f(c, g);
    o.emissive = vec4f(0.0, 0.0, 0.0, g);
    return o;
  }

  if (state == 5) {
    // Plate (phones): a blocked socket filled flush with matte stone, sitting a hair low: a
    // soft shadow along its upper edge, a faint light lip along its lower. No mark on it, so
    // it reads as "nothing goes here", never as a button.
    let cap = 0.94;
    let a = 1.0 - smoothstep(cap - 0.04, cap + 0.02, r);
    let edge = smoothstep(cap - 0.22, cap, r);
    let dir = p.y / max(r, 0.001); // -1 top, +1 bottom (y-down)
    let lit = lights_shade(in.world, 2.0, vec3f(0.0, 0.0, 1.0), 6.0);
    let grain = 0.85 + 0.25 * engine_fbm(p * 4.0 + seed * 3.0, 3);
    var col = vec3f(0.085, 0.082, 0.078) * grain * (0.5 + 0.7 * lit.diffuse);
    col *= 1.0 - edge * 0.55 * max(-dir, 0.0);
    col += vec3f(0.05, 0.048, 0.044) * edge * max(dir, 0.0);
    col = max(col, vec3f(0.02));
    col *= lights_floor(in.world);
    o.color = vec4f(col, a * 0.92);
    o.emissive = vec4f(0.0, 0.0, 0.0, a * 0.92);
    return o;
  }

  if (state == 6) {
    // Collar (fixed gems, every platform): a solid dark-iron ring bolted round the socket with
    // four rivets, so the gem reads as part of the machine. Lit metal, never a glow, so it
    // cannot pass for a selection or hover mark. mobile-5-board: thicker, with a pale bevel
    // on the outer edge and bigger rivets, so it reads as fixed at a glance on any screen.
    let r0 = 0.98;
    let r1 = 1.38;
    let band = smoothstep(r0 - 0.03, r0 + 0.02, r) * (1.0 - smoothstep(r1 - 0.03, r1 + 0.01, r));
    let mid = (r0 + r1) * 0.5;
    let t = (r - mid) / ((r1 - r0) * 0.5); // -1 inner edge .. +1 outer edge
    // Rounded section: the normal tips inward at the inner edge and outward at the outer.
    let rd = p / max(r, 0.001);
    var n = normalize(vec3f(rd * t * 0.9, 1.0));
    var hgt = 1.0 - t * t * 0.6;
    // Four rivets on the diagonals.
    let q = abs(p) * 0.70710678;
    let rv = vec2f(q.x + q.y, abs(q.x - q.y));
    let rp = rv - vec2f(mid, 0.0);
    let rl = length(rp);
    let rivR = 0.15;
    let riv = 1.0 - smoothstep(rivR - 0.025, rivR + 0.01, rl);
    if (riv > 0.0) {
      // Domed head: the slope runs out from the rivet's centre (signs follow the quadrant).
      let sx = sign(p.x);
      let sy = sign(p.y);
      let d = vec2f(p.x - sx * mid * 0.70710678, p.y - sy * mid * 0.70710678) / rivR;
      n = normalize(mix(n, vec3f(d * 0.9, 1.0), riv));
      hgt = mix(hgt, 1.3 - dot(d, d) * 0.3, riv);
    }
    let lit = lights_shade(in.world, hgt * 6.0, n, 8.0);
    let grain = 0.9 + 0.15 * engine_noise(p * 22.0 + seed);
    // altar-truth: heavy bronze, not dark iron, so it reads at arm's length on a phone; still
    // lit metal and never a glow, so it can't pass for a selection mark.
    let bronze = vec3f(0.30, 0.17, 0.06) * grain;
    let brass = vec3f(0.55, 0.38, 0.14);
    let base = mix(bronze, brass, riv);
    var col = base * (0.35 + lit.diffuse * 0.65) + lit.spec * mix(0.10, 0.22, riv);
    // A dark seam at both edges so the ring reads cut, not painted, on any stone.
    col *= 1.0 - 0.7 * (exp(-pow((r - r0) * 30.0, 2.0)) + exp(-pow((r - r1) * 30.0, 2.0)));
    col = max(col, base * 0.3);
    // Pale bevelled outer edge (filed bronze), brightest toward the light above.
    let bev = exp(-pow((r - (r1 - 0.06)) / 0.035, 2.0)) * (1.0 - riv);
    col = mix(col, vec3f(0.62, 0.48, 0.26) * (0.7 + 0.3 * max(-rd.y, 0.0)), bev * 0.75);
    // Rivet heads catch a fixed pale glint so they read even in the dark.
    let rc = vec2f(p.x - sign(p.x) * mid * 0.70710678, p.y - sign(p.y) * mid * 0.70710678);
    let glint = 1.0 - smoothstep(0.0, 0.5, length(rc / rivR + vec2f(0.35, 0.35)));
    col = mix(col, vec3f(0.70, 0.58, 0.36), riv * 0.5 * glint);
    // The lock pip (altar-truth): the lower-right rivet is a bigger brass disc carrying a dark
    // padlock (body and shackle), so "can't move this" reads without the card.
    // glyph-truth: bigger (0.42 radii, ~12 CSS px across on an SE) and pushed out past the gem's
    // edge onto the collar's lower-right shoulder, so no gem cut covers it.
    let lc = p - vec2f(1.0, 1.0);
    let lr = length(lc);
    let pipR = 0.42;
    let pip = 1.0 - smoothstep(pipR - 0.03, pipR + 0.005, lr);
    var lockA = 0.0;
    if (pip > 0.0) {
      let u = lc / pipR; // -1..1 across the pip, y down
      let bodyD = max(abs(u.x) - 0.42, abs(u.y - 0.22) - 0.32);
      let body = 1.0 - smoothstep(-0.02, 0.06, bodyD);
      let sh = abs(length(u - vec2f(0.0, -0.12)) - 0.28) - 0.09;
      let shackle = (1.0 - smoothstep(-0.02, 0.06, sh)) * step(u.y, -0.08);
      lockA = max(body, shackle);
      let dome = 1.0 - dot(u, u) * 0.35;
      let disc = vec3f(0.78, 0.58, 0.24) * (0.55 + 0.45 * dome) * (0.7 + 0.3 * max(-u.y, 0.0));
      let ink = vec3f(0.05, 0.03, 0.015);
      // A dark rim keeps the pip apart from the band.
      let rim = smoothstep(0.78, 0.95, lr / pipR);
      let pc = mix(mix(disc, ink, lockA), ink, rim * 0.8);
      col = mix(col, pc, pip);
    }
    col *= lights_floor(in.world);
    let a = max(max(band, riv), pip) * 0.98;
    o.color = vec4f(col, a);
    o.emissive = vec4f(0.0, 0.0, 0.0, a);
    return o;
  }

  let tint = in.color.rgb;
  if (state == 7) {
    // Legal (mobile-6-board): a steady, crisp ring of light just outside the bowl, with a dark
    // keyline either side so it reads on pale stone and on dark alike. No shimmer and no pulse:
    // every socket the held gem may go in wears exactly the same ring.
    // glyph-truth: calmer. A thin warm-gold line over the rim, not a full cream band, with a
    // faint keyline inside, so the circuit and the built-in gems keep the eye.
    let band = smoothstep(0.95, 0.99, r) * (1.0 - smoothstep(1.06, 1.1, r));
    let key = smoothstep(0.86, 0.93, r) * (1.0 - smoothstep(0.95, 0.99, r));
    let a = max(band * 0.78, key * 0.4) * min(k, 1.0);
    let c = mix(vec3f(0.015, 0.012, 0.01), tint, band / max(max(band, key), 0.001));
    o.color = vec4f(c, a);
    o.emissive = vec4f(tint * band * in.emissive * 0.04 * k, a);
    return o;
  }
  if (state == 8) {
    // Fault (mobile-7-strike): the red mark. A solid band from 0.9 to 1.24 radii (at least
    // 3 CSS px on the smallest phone socket), a dark keyline either side so it holds on pale
    // stone and on the navy wall, a hot core line, and a halo that breathes slowly (~3 s).
    let band = smoothstep(0.86, 0.9, r) * (1.0 - smoothstep(1.24, 1.28, r));
    let key = smoothstep(0.76, 0.84, r) * (1.0 - smoothstep(1.3, 1.38, r));
    let core = exp(-pow((r - 1.07) * 14.0, 2.0));
    let breathe = 0.5 + 0.5 * sin(globals.time * 2.1);
    let halo = exp(-max(r - 1.28, 0.0) * 18.0) * step(1.28, r) * (0.25 + 0.45 * breathe);
    let red = mix(vec3f(0.93, 0.13, 0.08), vec3f(1.0, 0.62, 0.5), core * (0.55 + 0.35 * breathe));
    let a = clamp(max(max(band, key * 0.85), halo) * min(k, 1.0), 0.0, 1.0);
    let w = band / max(max(band, key * 0.85), 0.001);
    var c = mix(vec3f(0.02, 0.01, 0.01), red, w);
    c = mix(c, vec3f(1.0, 0.2, 0.12), halo * (1.0 - band) * (1.0 - key));
    o.color = vec4f(c, a);
    o.emissive = vec4f(tint * (band * 0.12 + halo * 0.25) * in.emissive * k, a);
    return o;
  }
  if (state == 2) {
    // Highlighted: the rim glows, light pools in the bowl.
    let ring = exp(-pow((r - 1.0) * 16.0, 2.0)) * 0.8;
    let pool = exp(-r * r * 2.5) * step(r, 1.0) * 0.14;
    let halo = exp(-max(r - 1.0, 0.0) * 9.0) * step(1.0, r) * 0.12;
    let shimmer = 0.85 + 0.15 * sin(atan2(p.y, p.x) * 6.0 + globals.time * 2.0);
    let g = (ring * shimmer + pool + halo) * k;
    o.color = vec4f(tint * g * 0.7, clamp(g, 0.0, 1.0));
    o.emissive = vec4f(tint * g * in.emissive * 0.35, clamp(g, 0.0, 1.0));
    return o;
  }

  // Wanted: a dotted ring in the colour that belongs here.
  let a = atan2(p.y, p.x);
  let dots = smoothstep(0.32, 0.18, abs(fract(a * 10.0 / 6.2831853 + 0.25) - 0.5));
  let ring = exp(-pow((r - 0.98) * 14.0, 2.0)) * dots;
  let inner = exp(-r * r * 3.0) * 0.12;
  let g = (ring + inner) * k;
  o.color = vec4f(tint * g * 0.5, clamp(g, 0.0, 1.0));
  o.emissive = vec4f(tint * g * in.emissive, clamp(g, 0.0, 1.0));
  return o;
}
`;
