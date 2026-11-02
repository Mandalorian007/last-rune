/**
 * Journal desk shaders (pitch screen 6): wood desk, parchment, and the desk
 * props (FUSE's brass-tacked plate, the leather journal cover, inkwell, quill,
 * soft contact shadows). All lit by the shared `LightSet` (one candle).
 * Procedural only: no textures.
 */
import { LIGHTS_WGSL } from '../../shaders/lights-wgsl';

/** Paper kinds (`params.y`). */
export const PAPER = { slip: 0, leftLeaf: 1, rightLeaf: 2, sheet: 3 } as const;
/** Prop modes (`params.y`). */
export const PROP = { plate: 0, cover: 1, inkwell: 2, quill: 3, shadow: 4, clipboard: 5 } as const;
/** Ruled-line pitch on the leaves (px). DOM text uses the same line height. */
export const RULE_PITCH = 54;
/** First rule's distance from the top of a leaf (px). */
export const RULE_TOP = 168;

/**
 * Full-screen wood desk. Planks run left to right; grain is warped fbm with ring
 * bands, varnished. `params.x` = vignette strength (0..1).
 */
export const DESK_WGSL = /* wgsl */ `${LIGHTS_WGSL}
fn wood_height(q: vec2f) -> f32 {
  let warp = engine_fbm(q * vec2f(0.0016, 0.012), 3);
  let g = engine_fbm(vec2f(q.x * 0.003, q.y * 0.06 + warp * 2.5), 4);
  let rings = sin(q.y * 0.075 + warp * 14.0 + g * 5.0) * 0.5 + 0.5;
  return rings * 0.55 + g * 0.45;
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let p = in.world;
  let plankH = 176.0;
  let row = floor((p.y + 40.0) / plankH);
  let fy = fract((p.y + 40.0) / plankH);
  let offs = engine_hash21(vec2f(row, 3.1)) * 1700.0;
  let q = vec2f(p.x + offs, p.y + row * 37.0);
  let hgt = wood_height(q);
  // Knots: a few dark eyes per plank, grain swirls around them.
  let cell = floor(q.x / 640.0);
  let kx = cell * 640.0 + 320.0 + (engine_hash21(vec2f(row, cell)) - 0.5) * 300.0;
  let ky = (fy - 0.5) * plankH - (engine_hash21(vec2f(cell, row)) - 0.5) * 60.0;
  let kd = length(vec2f((q.x - kx) * 0.35, ky));
  let hasKnot = step(0.55, engine_hash21(vec2f(row * 7.0, cell)));
  let knot = hasKnot * (1.0 - smoothstep(6.0, 22.0, kd));

  let dark = vec3f(0.030, 0.012, 0.005);
  let mid = vec3f(0.105, 0.042, 0.015);
  let light = vec3f(0.190, 0.085, 0.034);
  var albedo = mix(dark, mid, smoothstep(0.15, 0.6, hgt));
  albedo = mix(albedo, light, smoothstep(0.62, 0.95, hgt) * 0.8);
  // Each plank a slightly different board.
  albedo *= 0.82 + 0.3 * engine_hash21(vec2f(row, 9.7));
  albedo = mix(albedo, dark * 0.6, knot);
  // Fine pores along the grain.
  let pores = engine_noise(vec2f(q.x * 0.05, q.y * 0.9));
  albedo *= 0.9 + 0.1 * pores;

  let k = 2.2;
  let n = normalize(vec3f(-dpdx(hgt) * k, -dpdy(hgt) * k, 1.0));
  let lit = lights_shade(p, 0.0, n, 40.0);
  var col = albedo * lit.diffuse + lit.spec * 0.06;

  // Plank seams and the odd butt joint.
  let seam = smoothstep(0.0, 0.018, fy) * smoothstep(1.0, 0.986, fy);
  let jx = fract((p.x + offs * 0.37) / 1180.0);
  let joint = smoothstep(0.0, 0.0025, jx) * smoothstep(1.0, 0.9975, jx);
  col *= mix(0.25, 1.0, seam * joint);
  col += vec3f(0.02, 0.008, 0.002) * smoothstep(0.018, 0.04, fy) * (1.0 - smoothstep(0.04, 0.07, fy)) * lit.diffuse.r;

  // Vignette: the candle is the only light that matters.
  let v = (in.local - vec2f(0.45, 0.45)) * vec2f(1.25, 1.0);
  col *= 1.0 - smoothstep(0.35, 0.95, length(v)) * in.params.x;
  var o: FragOut;
  o.color = vec4f(col, 1.0);
  o.emissive = vec4f(0.0, 0.0, 0.0, 1.0);
  return o;
}
`;

/**
 * Parchment. params: x = seed, y = kind (PAPER), z = warm highlight (new page,
 * 0..1), w = 1 for faint ruled lines. tint.a = opacity.
 */
export const PAPER_WGSL = /* wgsl */ `${LIGHTS_WGSL}
@fragment fn fs_main(in: VSOut) -> FragOut {
  let size = in.size;
  let px = in.local * size;
  let seed = in.params.x;
  let kind = i32(in.params.y + 0.5);
  let sp = px + vec2f(seed * 131.0, seed * 71.0);

  // Deckled edge: distance to the nearest edge, nibbled by noise.
  let edge = min(min(px.x, size.x - px.x), min(px.y, size.y - px.y));
  let nib = engine_fbm(sp * 0.09, 3) * 6.0 + engine_noise(sp * 0.6) * 1.2;
  var cut = edge - nib * select(1.0, 0.35, kind == 1 || kind == 2);
  // The gutter side of a leaf is bound, not torn.
  if (kind == 1) { cut = min(min(px.y, size.y - px.y), px.x) - nib * 0.35; }
  if (kind == 2) { cut = min(min(px.y, size.y - px.y), size.x - px.x) - nib * 0.35; }
  let alpha = smoothstep(0.0, 1.5, cut);
  if (alpha <= 0.001) { discard; }

  // Base parchment with mottling, fibres and foxing.
  let pale = vec3f(0.80, 0.66, 0.43);
  let aged = vec3f(0.47, 0.33, 0.15);
  let mott = engine_fbm(sp * 0.006, 4);
  var albedo = mix(pale, aged, smoothstep(0.35, 0.85, mott) * 0.45);
  let fibre = engine_noise(vec2f(sp.x * 0.4, sp.y * 0.05)) * engine_noise(vec2f(sp.x * 0.05, sp.y * 0.4));
  albedo *= 0.94 + 0.12 * fibre;
  let fox = smoothstep(0.72, 0.8, engine_fbm(sp * 0.02 + 7.0, 3));
  albedo = mix(albedo, aged * 0.8, fox * 0.4);
  // Aged, slightly burnt rim.
  let rim = 1.0 - smoothstep(0.0, 34.0, cut);
  albedo = mix(albedo, aged * 0.55, rim * rim * 0.75);

  // Leaf curvature: shade toward the gutter, a soft highlight on the curl.
  var nx = 0.0;
  var shade = 1.0;
  if (kind == 1) {
    let g = in.local.x;
    shade = 1.0 - smoothstep(0.78, 1.0, g) * 0.55;
    nx = smoothstep(0.7, 1.0, g) * 0.6 - smoothstep(0.0, 0.08, 0.08 - g) * 0.2;
  } else if (kind == 2) {
    let g = in.local.x;
    shade = 1.0 - smoothstep(0.22, 0.0, g) * 0.55;
    nx = -smoothstep(0.3, 0.0, g) * 0.6 + smoothstep(0.92, 1.0, g) * 0.2;
  }
  let n = normalize(vec3f(nx, (engine_noise(sp * 0.05) - 0.5) * 0.15, 1.0));
  let lit = lights_shade(in.world, 3.0, n, 6.0);
  var col = albedo * lit.diffuse * shade + lit.spec * 0.03;

  // Faint ruled lines on the leaves.
  if (in.params.w > 0.5 && (kind == 1 || kind == 2)) {
    let ry = px.y - ${RULE_TOP}.0;
    let ln = abs(fract(ry / ${RULE_PITCH}.0 + 0.5) - 0.5) * ${RULE_PITCH}.0;
    let on = (1.0 - smoothstep(0.4, 1.3, ln)) * step(0.0, ry + 4.0) * step(px.y, size.y - 70.0)
           * step(56.0, px.x) * step(px.x, size.x - 56.0);
    col = mix(col, col * vec3f(0.62, 0.66, 0.78), on * 0.35);
  }

  // New page: a warm breath of gold, as if it caught the candle.
  col += vec3f(0.9, 0.55, 0.16) * in.params.z * 0.22 * (0.4 + 0.6 * rim);

  var o: FragOut;
  o.color = vec4f(col, alpha * in.color.a);
  o.emissive = vec4f(vec3f(0.9, 0.55, 0.16) * in.params.z * 0.08, alpha * in.color.a);
  return o;
}
`;

/**
 * Desk props. params: x = seed, y = mode (PROP), z = shadow blur px (shadow mode) /
 * corner radius, w = spare. Shapes are drawn in px about the quad centre.
 */
export const PROPS_WGSL = /* wgsl */ `${LIGHTS_WGSL}
fn sd_round_box(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

fn brass(n: vec3f, world: vec2f, h: f32) -> vec3f {
  let lit = lights_shade(world, h, n, 30.0);
  let base = vec3f(0.58, 0.32, 0.08);
  return base * lit.diffuse + lit.spec * vec3f(1.0, 0.75, 0.4) * 0.9;
}

fn tack(p: vec2f, c: vec2f, world: vec2f, col: ptr<function, vec3f>, a: ptr<function, f32>) {
  let d = length(p - c);
  let r = 11.0;
  if (d < r + 1.0) {
    let t = clamp(d / r, 0.0, 1.0);
    let nz = sqrt(max(0.0, 1.0 - t * t));
    let nxy = (p - c) / r;
    let n = normalize(vec3f(nxy, nz * 1.4));
    let m = 1.0 - smoothstep(r - 1.0, r + 0.5, d);
    *col = mix(*col, brass(n, world, 12.0), m);
    *a = max(*a, m);
  }
  // Contact shadow below-right of the tack.
  let ds = length(p - c - vec2f(3.0, 4.0));
  let sm = (1.0 - smoothstep(r - 2.0, r + 5.0, ds)) * step(r, d);
  *col = mix(*col, *col * 0.4, sm * 0.6);
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let size = in.size;
  let p = (in.local - 0.5) * size;
  let mode = i32(in.params.y + 0.5);
  let seed = in.params.x;
  var col = vec3f(0.0);
  var a = 0.0;
  var em = vec3f(0.0);

  if (mode == 4) {
    // Soft rounded-rect contact shadow.
    let blur = max(in.params.z, 1.0);
    let d = sd_round_box(p, size * 0.5 - vec2f(blur), blur * 0.6);
    a = (1.0 - smoothstep(-blur, blur, d)) * in.color.a;
    var o: FragOut;
    o.color = vec4f(in.color.rgb, a);
    o.emissive = vec4f(0.0, 0.0, 0.0, a * 0.5);
    return o;
  }

  if (mode == 0 || mode == 5) {
    // Dark iron plate, bevelled, four brass tacks (mode 5: a clipboard board with a clamp).
    let r = select(10.0, 14.0, mode == 5);
    let d = sd_round_box(p, size * 0.5 - vec2f(2.0), r);
    a = 1.0 - smoothstep(-1.0, 0.5, d);
    if (a <= 0.001) { discard; }
    let sp = p + vec2f(seed * 97.0);
    let bevel = 1.0 - smoothstep(0.0, 9.0, -d);
    let e = 1.0;
    let gx = sd_round_box(p + vec2f(e, 0.0), size * 0.5 - vec2f(2.0), r) - d;
    let gy = sd_round_box(p + vec2f(0.0, e), size * 0.5 - vec2f(2.0), r) - d;
    let n = normalize(vec3f(gx * bevel * 1.6, gy * bevel * 1.6, 1.0));
    var base = vec3f(0.035, 0.034, 0.038);
    if (mode == 5) { base = vec3f(0.16, 0.085, 0.035); }
    let brush = engine_noise(vec2f(sp.x * 0.02, sp.y * 1.3));
    base *= 0.8 + 0.4 * brush;
    base *= 0.85 + 0.3 * engine_fbm(sp * 0.01, 3);
    let lit = lights_shade(in.world, 6.0, n, 22.0);
    col = base * lit.diffuse + lit.spec * select(0.35, 0.12, mode == 5);
    // A thin brass inlay just inside the bevel.
    let inlay = 1.0 - smoothstep(0.6, 1.6, abs(-d - 14.0));
    if (mode == 0) { col = mix(col, brass(vec3f(0.0, 0.0, 1.0), in.world, 6.0), inlay * 0.55); }
    let hx = size.x * 0.5 - 26.0;
    let hy = size.y * 0.5 - 24.0;
    if (mode == 0) {
      tack(p, vec2f(-hx, -hy), in.world, &col, &a);
      tack(p, vec2f(hx, -hy), in.world, &col, &a);
      tack(p, vec2f(-hx, hy), in.world, &col, &a);
      tack(p, vec2f(hx, hy), in.world, &col, &a);
    } else {
      // Clipboard clamp at the top.
      let cp = p - vec2f(0.0, -size.y * 0.5 + 34.0);
      let cd = sd_round_box(cp, vec2f(70.0, 20.0), 8.0);
      let cm = 1.0 - smoothstep(-0.5, 0.8, cd);
      let cn = normalize(vec3f(0.0, cp.y / 26.0, 1.0));
      col = mix(col, brass(cn, in.world, 14.0) * 0.8, cm);
      tack(p, vec2f(0.0, -size.y * 0.5 + 34.0), in.world, &col, &a);
    }
  } else if (mode == 1) {
    // Oxblood leather cover with gold stitching.
    let d = sd_round_box(p, size * 0.5 - vec2f(2.0), 22.0);
    a = 1.0 - smoothstep(-1.0, 0.5, d);
    if (a <= 0.001) { discard; }
    let sp = p + vec2f(seed * 53.0);
    let grain = engine_fbm(sp * 0.08, 3);
    let cells = engine_noise(sp * 0.35);
    var base = vec3f(0.11, 0.028, 0.02) * (0.75 + 0.5 * grain) * (0.9 + 0.2 * cells);
    let wear = 1.0 - smoothstep(0.0, 26.0, -d);
    base = mix(base, vec3f(0.2, 0.08, 0.04), wear * 0.6 * engine_noise(sp * 0.05));
    let bevel = 1.0 - smoothstep(0.0, 12.0, -d);
    let n = normalize(vec3f(sign(p.x) * bevel * 0.5 * step(size.x * 0.4, abs(p.x)),
                            sign(p.y) * bevel * 0.5 * step(size.y * 0.4, abs(p.y)),
                            1.0) + vec3f((grain - 0.5) * 0.3, (cells - 0.5) * 0.3, 0.0));
    let lit = lights_shade(in.world, 4.0, normalize(n), 14.0);
    col = base * lit.diffuse + lit.spec * 0.12;
    // Stitching: a dashed line 16px in from the edge.
    let sd = abs(-d - 16.0);
    let along = select(p.x, p.y, abs(p.x) > size.x * 0.5 - 30.0);
    let dash = step(0.45, fract(along / 14.0));
    let st = (1.0 - smoothstep(0.8, 2.0, sd)) * dash;
    col = mix(col, brass(vec3f(0.0, 0.0, 1.0), in.world, 4.0) * 0.8, st * 0.8);
  } else if (mode == 2) {
    // Inkwell: squat bottle of near-black glass, full of ink, with a brass collar.
    let body = sd_round_box(p - vec2f(0.0, 16.0), vec2f(size.x * 0.42, size.y * 0.3), 24.0);
    let neck = sd_round_box(p - vec2f(0.0, -size.y * 0.2), vec2f(size.x * 0.16, size.y * 0.09), 4.0);
    let lip = sd_round_box(p - vec2f(0.0, -size.y * 0.3), vec2f(size.x * 0.2, size.y * 0.045), 3.0);
    let d = min(min(body, neck), lip);
    a = 1.0 - smoothstep(-0.8, 0.8, d);
    if (a <= 0.001) { discard; }
    let bx = clamp(p.x / (size.x * 0.42), -1.0, 1.0);
    let by = clamp((p.y - 16.0) / (size.y * 0.3), -1.0, 1.0);
    let n = normalize(vec3f(bx * 0.95, by * 0.5 - 0.15, sqrt(max(0.04, 1.0 - bx * bx))));
    let lit = lights_shade(in.world, 30.0, n, 90.0);
    col = vec3f(0.004, 0.005, 0.009) * (0.4 + lit.diffuse) + lit.spec * 1.4;
    // Rim light along the glass edge and a sharp window highlight.
    let rimB = (1.0 - smoothstep(0.0, 4.0, -body)) * step(body, 0.5);
    col += vec3f(0.6, 0.4, 0.22) * rimB * 0.9 * lit.diffuse;
    let hl = (1.0 - smoothstep(0.0, 3.0, abs(p.x + size.x * 0.24))) * smoothstep(-6.0, 6.0, p.y) * (1.0 - smoothstep(26.0, 40.0, p.y));
    col += vec3f(1.0, 0.85, 0.65) * hl * 1.2 * lit.diffuse;
    // Ink surface seen through the shoulder.
    col += vec3f(0.03, 0.035, 0.08) * (1.0 - smoothstep(0.0, 6.0, abs(p.y + 2.0))) * step(body, 0.0);
    if (min(neck, lip) < 0.5 && body > 0.0) {
      let cn = normalize(vec3f(p.x / (size.x * 0.2), 0.0, 0.8));
      col = brass(cn, in.world, 40.0);
    }
  } else if (mode == 3) {
    // Quill: shaft from the nib (bottom) to the tip (top), vane on both sides.
    let t = in.local.y;                     // 0 top .. 1 nib
    let along = 1.0 - t;                    // 0 nib .. 1 top
    let curve = (along * along) * size.x * 0.18;
    let x = p.x - curve;
    let shaftW = mix(3.2, 1.0, along);
    let shaft = abs(x) - shaftW;
    // Vane width profile: starts a fifth of the way up, widest at 60 %, tapers to the tip.
    let s = clamp((along - 0.2) / 0.8, 0.0, 1.0);
    let prof = sin(s * 3.14159) * (0.6 + 0.4 * s) * step(0.2, along);
    let wl = prof * size.x * 0.26;
    let wr = prof * size.x * 0.36;
    let vaneW = select(wr, wl, x < 0.0);
    // Ragged vane edge and a couple of splits.
    let rag = engine_noise(vec2f(along * 60.0 + seed, sign(x) * 3.0)) * 5.0;
    let vane = abs(x) - vaneW + rag;
    let d = min(shaft, vane);
    a = 1.0 - smoothstep(-0.8, 0.8, d);
    if (a <= 0.001) { discard; }
    let barbs = fract((p.y * 0.55 + abs(x) * 0.9) / 3.2);
    // A dark goose-grey feather with a pale shaft: reads as a quill, not a leaf.
    var base = mix(vec3f(0.16, 0.14, 0.13), vec3f(0.07, 0.06, 0.06), smoothstep(0.5, 1.0, along));
    base *= 0.7 + 0.3 * barbs;
    // A few splits in the vane where barbs have parted.
    let split = smoothstep(0.92, 1.0, engine_noise(vec2f(along * 18.0 + seed, sign(x))));
    a *= 1.0 - split * smoothstep(0.3, 0.9, abs(x) / max(vaneW, 1.0));
    base *= mix(0.7, 1.0, smoothstep(0.0, 0.6, abs(x) / max(vaneW, 1.0)));
    if (shaft < 0.0) { base = vec3f(0.7, 0.64, 0.54); }
    // Ink-stained nib.
    base = mix(base, vec3f(0.015, 0.012, 0.02), smoothstep(0.12, 0.02, along));
    let n = normalize(vec3f(-x / max(vaneW, 4.0) * 0.4, 0.0, 1.0));
    let lit = lights_shade(in.world, 40.0, n, 40.0);
    col = base * lit.diffuse + lit.spec * 0.35;
  }

  var o: FragOut;
  o.color = vec4f(col, a * in.color.a);
  o.emissive = vec4f(em, a * in.color.a);
  return o;
}
`;
