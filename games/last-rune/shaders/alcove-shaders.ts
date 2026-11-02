/**
 * Alcove / locked door: an arched stone niche in the hall wall, barred by an iron grate with a
 * padlock, with a socket plate on the sill showing the missing capabilities as dotted rings in
 * their colours.
 *
 * Per instance params = (state, socketCount 0..4, kinds packed k0 + k1*8 + k2*64 + k3*512, seed).
 * state: 0 locked, 0..1 unlocking (lock drops, grate rises, sockets fill), 1 open, 2 restored
 * (machine inside solved: warm gold glow). Kinds: 0..5 gem colour (GEM_ORDER), 6 storm, 7 altar.
 * Quad covers [-1, 1]² alcove units, y up.
 */
import { PROP_COMMON_WGSL, PROP_LIGHT_FLOATS } from '../art/props/lighting';

export const ALCOVE_UNIFORM_FLOATS = PROP_LIGHT_FLOATS + 4;

export const ALCOVE_MATERIAL_WGSL = /* wgsl */ `
${PROP_COMMON_WGSL}
struct AlcoveU { L: PropLights, a: vec4f }; // a: time
@group(1) @binding(0) var<uniform> U: AlcoveU;

fn arch(p: vec2f, hw: f32, spring: f32, bottom: f32) -> vec3f {
  // Rect from bottom to spring line, semicircle on top.
  let r = sdg_box(p - vec2f(0.0, (spring + bottom) * 0.5), vec2f(hw, (spring - bottom) * 0.5), 0.0);
  let c = sdg_circle(p - vec2f(0.0, spring), hw);
  return sdg_union(r, c);
}

fn kind_col(k: f32) -> vec3f {
  if (k < 0.5) { return C_CYAN; }
  if (k < 1.5) { return C_AMETHYST; }
  if (k < 2.5) { return C_MAGENTA; }
  if (k < 3.5) { return C_AMBER; }
  if (k < 4.5) { return C_EMERALD; }
  if (k < 5.5) { return C_ICE; }
  if (k < 6.5) { return mix(C_CYAN, vec3f(1.0), 0.4); }
  return C_GOLD;
}

fn stone_albedo(p: vec2f, seed: f32) -> vec3f {
  let n = engine_fbm(p * 6.0 + seed, 4);
  let m = engine_fbm(p * 22.0 + seed * 3.0, 3);
  return C_SLATE * 1.7 * (0.75 + 0.5 * n) * (0.9 + 0.2 * m);
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let t = U.a.x;
  let state = in.params.x;
  let nSock = in.params.y;
  let packed = in.params.z;
  let seed = in.params.w;
  let p = vec2f(in.local.x - 0.5, 0.5 - in.local.y) * 2.0;
  let aa = max(fwidth(p.x), fwidth(p.y));
  let world = in.world;
  var acc: Acc;
  acc.col = vec4f(0.0);
  acc.emi = vec3f(0.0);
  let open = clamp(state, 0.0, 1.0);
  let restored = clamp(state - 1.0, 0.0, 1.0);

  // Outer stone surround (voussoirs + jambs).
  let outer = arch(p, 0.74, 0.18, -0.74);
  let inner = arch(p, 0.5, 0.18, -0.52);
  let frame = sdg_sub(outer, inner);
  {
    // Joints: radial in the arch, coursed in the jambs.
    var joint = 1.0;
    if (p.y > 0.18) {
      let a = atan2(p.y - 0.18, p.x);
      let seg = abs(fract(a / 3.14159 * 7.0) - 0.5);
      joint = smoothstep(0.0, 0.03, seg * 0.6 - 0.005);
    } else {
      let row = abs(fract((p.y + 0.74) / 0.23) - 0.5) * 0.23;
      joint = smoothstep(0.004, 0.012, 0.115 - row);
    }
    let blockId = floor(atan2(p.y - 0.18, p.x) / 3.14159 * 7.0) + floor((p.y + 0.74) / 0.23) * 3.0;
    var alb = stone_albedo(p, seed) * (0.85 + 0.3 * engine_hash21(vec2f(blockId, seed)));
    let n = to_world_n(pillow(frame, 0.05), 1.0, 0.0);
    var c = prop_light(U.L, world, n, alb, 0.0, 0.15);
    c *= mix(0.35, 1.0, joint);
    // Open/restored: warm light from inside rakes the inner edge.
    let rake = exp(-max(inner.x, 0.0) * 14.0);
    c += C_WARM * rake * (0.15 * open + 0.3 * restored) * alb * 2.0;
    put(&acc, frame.x, aa, c, vec3f(0.0), 1.2);
  }
  // Keystone.
  let ks = sdg_box(p - vec2f(0.0, 0.8), vec2f(0.09, 0.12), 0.015);
  put(&acc, ks.x, aa, prop_light(U.L, world, to_world_n(pillow(ks, 0.05), 1.0, 0.0),
      stone_albedo(p + 3.0, seed) * 1.15, 0.0, 0.2), vec3f(0.0), 1.0);
  // Carved rune on the keystone, glows gold when restored.
  {
    let kq = p - vec2f(0.0, 0.8);
    let rune = min(sdg_segment(kq, vec2f(0.0, -0.07), vec2f(0.0, 0.07), 0.008).x,
                   sdg_segment(kq, vec2f(-0.04, 0.02), vec2f(0.04, -0.03), 0.008).x);
    let rk = 1.0 - smoothstep(0.0, aa * 1.5, rune);
    acc.col = vec4f(mix(acc.col.rgb, C_INK * 0.6 + C_GOLD * 2.0 * restored, rk * step(ks.x, 0.0)), acc.col.a);
    acc.emi += C_GOLD * 2.0 * restored * rk * step(ks.x, 0.0);
  }

  // Interior: deep recess, lit gold from within when open.
  {
    let depth = smoothstep(0.0, -0.18, inner.x);
    let back = vec3f(0.012, 0.014, 0.022) * (0.6 + 0.4 * engine_fbm(p * 5.0 + seed, 3));
    var c = back * mix(0.4, 1.0, depth);
    // Glimpse of machinery: a gear silhouette inside.
    let gq = p - vec2f(0.12, -0.05);
    let ga = atan2(gq.y, gq.x) + t * 0.3 * restored;
    let gear = length(gq) - (0.23 + 0.03 * step(0.5, fract(ga / 6.2831 * 10.0)));
    let hole = length(gq) - 0.07;
    let gearK = (1.0 - smoothstep(0.0, aa * 1.5, gear)) * smoothstep(0.0, aa * 1.5, hole);
    // A lamp somewhere behind the gear: hot centre, falling off to dark corners.
    let lampD = length((p - vec2f(0.12, -0.05)) * vec2f(1.0, 0.8));
    let warm = C_WARM * (0.06 * open + 0.2 * restored) * (0.15 + 1.6 * exp(-lampD * 4.5));
    c = mix(c + warm * 0.6 * depth, c * 0.3 + warm * 0.15, gearK * (0.4 + 0.6 * open));
    let rim = (1.0 - depth) * 0.6;
    c = mix(c, c * 0.25, rim);
    put(&acc, inner.x, aa, c, warm * 0.2 * depth * (1.0 - gearK * 0.8), 0.0);
  }

  // Iron grate: vertical bars + two crossbars; rises out of view as it unlocks.
  let lift = smoothstep(0.1, 0.9, open) * 1.9;
  {
    let gp = p - vec2f(0.0, lift);
    let bx = (fract(gp.x / 0.14 + 0.5) - 0.5) * 0.14;
    let bars = sdg_box(vec2f(bx, gp.y + 0.15), vec2f(0.018, 0.85), 0.01);
    let cross1 = sdg_box(gp - vec2f(0.0, -0.32), vec2f(0.6, 0.02), 0.01);
    let cross2 = sdg_box(gp - vec2f(0.0, 0.18), vec2f(0.6, 0.02), 0.01);
    var g = sdg_union(sdg_union(bars, cross1), cross2);
    g = sdg_intersect(g, inner);
    put_shadow(&acc, sdg_intersect(sdg_union(sdg_union(sdg_box(vec2f(bx - 0.02, gp.y + 0.13), vec2f(0.018, 0.85), 0.01), cross1), cross2), inner).x, 0.03, 0.5);
    put(&acc, g.x, aa, prop_light(U.L, world, to_world_n(pillow(g, 0.015), 1.0, 0.0),
        iron_albedo(gp * 2.0, seed) * 1.3, 0.6, 0.5), vec3f(0.0), 0.6);
  }

  // Padlock on the grate: shakes, then drops and fades as it unlocks.
  {
    let shake = sin(t * 40.0) * 0.015 * smoothstep(0.0, 0.1, open) * (1.0 - smoothstep(0.2, 0.3, open));
    let drop = smoothstep(0.25, 0.6, open);
    let lp = p - vec2f(shake, -0.12 - drop * drop * 0.9);
    let lockA = 1.0 - smoothstep(0.45, 0.6, open);
    if (lockA > 0.0) {
      let tilt = rot2(drop * 0.9) * lp;
      let shackle = sdg_intersect(sdg_ring(tilt - vec2f(0.0, 0.06 + drop * 0.05), 0.065, 0.018), vec3f(-(tilt.y - 0.04), 0.0, 1.0));
      let shL = sdg_box(vec2f(abs(tilt.x) - 0.065, tilt.y - 0.05), vec2f(0.018, 0.04), 0.0);
      let sh = sdg_union(shackle, shL);
      put(&acc, sh.x, aa, prop_light(U.L, world, to_world_n(pillow(sh, 0.015), 1.0, 0.0), C_IRON * 1.4, 0.8, 0.8) * lockA,
          vec3f(0.0), 0.6);
      let bodyL = sdg_box(tilt - vec2f(0.0, -0.06), vec2f(0.1, 0.085), 0.025);
      put_shadow(&acc, sdg_box(tilt - vec2f(0.02, -0.08), vec2f(0.1, 0.085), 0.025).x, 0.03, 0.45 * lockA);
      put(&acc, bodyL.x, aa, prop_light(U.L, world, to_world_n(pillow(bodyL, 0.04), 1.0, 0.0),
          brass_albedo(tilt * 3.0, 0.8, seed + 1.0) * 1.2, 0.9, 0.7) * lockA, vec3f(0.0), 1.0);
      // Keyhole.
      let kh = sdg_union(sdg_circle(tilt - vec2f(0.0, -0.04), 0.018), sdg_box(tilt - vec2f(0.0, -0.08), vec2f(0.008, 0.03), 0.0));
      put(&acc, kh.x, aa, C_INK * 0.4, vec3f(0.0), 0.0);
    }
  }

  // Sill.
  let sill = sdg_box(p - vec2f(0.0, -0.6), vec2f(0.82, 0.08), 0.02);
  put(&acc, sill.x, aa, prop_light(U.L, world, to_world_n(pillow(sill, 0.04), 1.0, 0.0),
      stone_albedo(p * 1.3 + 7.0, seed) * 1.1, 0.0, 0.2), vec3f(0.0), 1.2);

  // Socket plate (brass) with dotted sockets.
  let n = max(nSock, 0.0);
  if (n > 0.5) {
    let pw = 0.1 + n * 0.13;
    let plate = sdg_box(p - vec2f(0.0, -0.82), vec2f(pw, 0.12), 0.04);
    put(&acc, plate.x, aa, prop_light(U.L, world, to_world_n(pillow(plate, 0.04), 1.0, 0.0),
        brass_albedo(p * 2.0, 0.6, seed + 3.0), 0.85, 0.65), vec3f(0.0), 1.0);
    let rv = sdg_circle(vec2f(abs(p.x) - pw + 0.04, p.y + 0.82), 0.015);
    put(&acc, rv.x, aa, prop_light(U.L, world, to_world_n(dome(rv, 0.015), 1.0, 0.0), C_BRASS * 1.3, 0.9, 0.8),
        vec3f(0.0), 0.4);
    for (var i = 0; i < 4; i++) {
      let fi = f32(i);
      if (fi >= n) { break; }
      let k = floor(packed / pow(8.0, fi)) % 8.0;
      let cx = (fi - (n - 1.0) * 0.5) * 0.26;
      let sq = p - vec2f(cx, -0.82);
      let col = kind_col(k);
      let fill = smoothstep(0.15 + fi * 0.12, 0.35 + fi * 0.12, open);
      // Carved hole.
      let hole = select(sdg_circle(sq, 0.075), sdg_box(sq, vec2f(0.065, 0.065), 0.01), k > 6.5);
      put(&acc, hole.x, aa, vec3f(0.01, 0.012, 0.02) + col * 0.04, vec3f(0.0), 0.8);
      // Dotted ring in the needed colour (breathing).
      let r = length(sq);
      let a = atan2(sq.y, sq.x);
      let dots = abs(fract(a / 6.2831853 * 12.0 + t * 0.15) - 0.5) * r * 6.2831853 / 12.0;
      let ringD = length(vec2f(dots, r - 0.052));
      let breathe = 0.6 + 0.4 * sin(t * 2.2 + fi * 1.3);
      let dotK = smoothstep(0.014, 0.008, ringD) * (1.0 - fill);
      acc.col = vec4f(acc.col.rgb + col * dotK * 1.2 * breathe, acc.col.a);
      acc.emi += col * dotK * 1.2 * breathe;
      add_glow(&acc, col * exp(-r * 30.0) * 0.12 * breathe * (1.0 - fill), 1.0);
      // Storm socket: a little zigzag in the middle.
      if (k > 5.5 && k < 6.5) {
        let z = sdg_segment(sq, vec2f(-0.02, 0.035), vec2f(0.01, 0.0), 0.006).x;
        let z2 = sdg_segment(sq, vec2f(0.01, 0.0), vec2f(-0.01, -0.0), 0.006).x;
        let z3 = sdg_segment(sq, vec2f(-0.01, 0.0), vec2f(0.02, -0.035), 0.006).x;
        let zk = smoothstep(aa, 0.0, min(min(z, z2), z3)) * (1.0 - fill);
        add_glow(&acc, col * zk * breathe, 1.0);
      }
      // Filled: a glowing gem (faceted dome).
      let gem = sdg_circle(sq, 0.055 * fill);
      if (fill > 0.0) {
        let gn = dome(gem, 0.055);
        let facet = floor((atan2(sq.y, sq.x) + 3.14159) / 6.2831853 * 6.0);
        let shade = 0.7 + 0.3 * engine_hash21(vec2f(facet, fi)) + 0.4 * gn.y;
        put(&acc, gem.x, aa, col * shade * 1.2 + vec3f(0.3) * smoothstep(0.02, 0.0, length(sq - vec2f(-0.018, 0.02))),
            col * 1.6, 0.6);
        add_glow(&acc, col * exp(-r * 18.0) * 0.25 * fill, 1.5);
      }
    }
  }

  var o: FragOut;
  o.color = acc.col * in.color.a;
  o.emissive = vec4f(acc.emi * in.emissive * in.color.a, acc.col.a * in.color.a);
  return o;
}
`;
