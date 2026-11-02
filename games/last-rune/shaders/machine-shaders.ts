/**
 * Machine: riveted iron box with a real gauge (0..125 %, red zone above 100 %), a brass input
 * terminal on the left where the bolt lands, a status lamp, vents that blaze cyan when awake.
 *
 * Per instance params = (needle fraction 0..1.25, awake 0..1, breaker 0..1, seed).
 * Quad covers [-1, 1]² machine units, y up.
 */
import { PROP_COMMON_WGSL, PROP_LIGHT_FLOATS } from '../art/props/lighting';

export const MACHINE_UNIFORM_FLOATS = PROP_LIGHT_FLOATS + 4;
/** Gauge sweep: 0 at 225°, 1.25 at -45° (270° of travel). */
export const MACHINE_GAUGE_MAX = 1.25;

export const MACHINE_MATERIAL_WGSL = /* wgsl */ `
${PROP_COMMON_WGSL}
struct MachineU { L: PropLights, a: vec4f }; // a: time
@group(1) @binding(0) var<uniform> U: MachineU;

const G_C = vec2f(0.0, 0.16);
const G_R = 0.34;

fn gauge_angle(f: f32) -> f32 {
  return radians(225.0 - 270.0 * f / ${MACHINE_GAUGE_MAX});
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let t = U.a.x;
  let needleF = in.params.x;
  let awake = in.params.y;
  let breaker = in.params.z;
  let seed = in.params.w;
  let p = vec2f(in.local.x - 0.5, 0.5 - in.local.y) * 2.0;
  let aa = max(fwidth(p.x), fwidth(p.y));
  let world = in.world;
  var acc: Acc;
  acc.col = vec4f(0.0);
  acc.emi = vec3f(0.0);
  let cy = C_CYAN * 1.4;
  let hum = 0.85 + 0.15 * sin(t * 9.0 + seed) * sin(t * 3.1);
  let glowA = awake * hum;
  let blink = step(0.5, fract(t * 3.0));
  let lampC = mix(cy * glowA, C_DANGER * 2.0 * blink, breaker);

  // Shadow, feet.
  put_shadow(&acc, sdg_ellipse(p - vec2f(0.0, -0.9), vec2f(0.95, 0.07)).x, 0.07, 0.75);
  let ft = sdg_box(vec2f(abs(p.x) - 0.56, p.y + 0.8), vec2f(0.13, 0.09), 0.03);
  put(&acc, ft.x, aa, prop_light(U.L, world, to_world_n(pillow(ft, 0.04), 1.0, 0.0),
      iron_albedo(p, seed + 2.0) * 0.8, 0.6, 0.4), vec3f(0.0), 1.0);

  // Exhaust pipe (behind the body, top right).
  let pipe = sdg_box(p - vec2f(0.5, 0.7), vec2f(0.075, 0.2), 0.02);
  put(&acc, pipe.x, aa, prop_light(U.L, world, to_world_n(pillow(pipe, 0.07), 1.0, 0.0),
      iron_albedo(p * 1.5, seed + 4.0), 0.7, 0.5), vec3f(0.0), 1.0);
  let cap = sdg_box(p - vec2f(0.5, 0.9), vec2f(0.11, 0.035), 0.02);
  put(&acc, cap.x, aa, prop_light(U.L, world, to_world_n(pillow(cap, 0.03), 1.0, 0.0),
      brass_albedo(p, 1.0, seed), 0.9, 0.7), vec3f(0.0), 1.0);
  // Pipe mouth glows when awake.
  add_glow(&acc, cy * glowA * 0.6 * exp(-length((p - vec2f(0.5, 0.95)) * vec2f(1.0, 2.5)) * 14.0), 1.5);

  // Body.
  let body = sdg_box(p - vec2f(0.0, -0.08), vec2f(0.8, 0.66), 0.07);
  var ironC = iron_albedo(p, seed);
  ironC *= 1.0 - 0.25 * (1.0 - awake) * smoothstep(0.4, 0.7, engine_fbm(p * 4.0 + seed, 3));
  let bodyN = to_world_n(pillow(body, 0.09), 1.0, 0.0);
  var bodyCol = prop_light(U.L, world, bodyN, ironC, 0.55, 0.45);
  put(&acc, body.x, aa, bodyCol, vec3f(0.0), 1.2);
  // Panel seams (inset rectangle) + awake light leaking through them.
  let panel = sdg_box(p - vec2f(0.0, -0.12), vec2f(0.66, 0.5), 0.04);
  let seam = abs(panel.x) - 0.006;
  let seamK = 1.0 - smoothstep(0.0, aa * 1.5, seam);
  acc.col = vec4f(mix(acc.col.rgb, C_INK * 0.5, seamK * 0.8), acc.col.a);
  add_glow(&acc, cy * glowA * (seamK * 0.7 + exp(-abs(seam) * 160.0) * 0.08) * step(body.x, 0.0), 1.4);
  // Top band (brass).
  let band = sdg_box(p - vec2f(0.0, 0.52), vec2f(0.82, 0.055), 0.025);
  put(&acc, band.x, aa, prop_light(U.L, world, to_world_n(pillow(band, 0.04), 1.0, 0.0),
      brass_albedo(p * 2.0, 1.0, seed + 1.0), 0.9, 0.7), vec3f(0.0), 1.0);
  // Rivets around the body and the band.
  {
    let rx = (fract((p.x + 0.8) / 0.16 + 0.5) - 0.5) * 0.16;
    let rowY = vec2f(abs(p.y - 0.52), abs(p.y + 0.67));
    let ry = min(rowY.x, rowY.y);
    let rv = sdg_circle(vec2f(rx, ry), 0.022);
    let inside = step(abs(p.x), 0.74);
    if (inside > 0.5) {
      put(&acc, rv.x, aa, prop_light(U.L, world, to_world_n(dome(rv, 0.022), 1.0, 0.0),
          mix(C_IRON, C_BRASS, step(rowY.x, rowY.y)) * 1.2, 0.8, 0.8), vec3f(0.0), 0.5);
    }
    let cy2 = (fract((p.y + 0.6) / 0.16 + 0.5) - 0.5) * 0.16;
    let rs = sdg_circle(vec2f(abs(p.x) - 0.73, cy2), 0.02);
    if (p.y > -0.62 && p.y < 0.42) {
      put(&acc, rs.x, aa, prop_light(U.L, world, to_world_n(dome(rs, 0.02), 1.0, 0.0), C_IRON * 1.2, 0.8, 0.8),
          vec3f(0.0), 0.5);
    }
  }

  // Input terminal (left side): brass post with an insulator collar.
  let post = sdg_box(p - vec2f(-0.86, 0.18), vec2f(0.07, 0.035), 0.015);
  put(&acc, post.x, aa, prop_light(U.L, world, to_world_n(pillow(post, 0.03), 1.0, 0.0),
      brass_albedo(p * 3.0, 1.0, seed + 3.0), 0.9, 0.7), vec3f(0.0), 1.0);
  let knob = sdg_circle(p - vec2f(-0.94, 0.18), 0.05);
  put(&acc, knob.x, aa, prop_light(U.L, world, to_world_n(dome(knob, 0.05), 1.0, 0.0), C_BRASS * 1.2, 0.95, 0.85),
      cy * glowA * 0.5, 0.8);

  // Vents (bottom): slots, dark when dead, cyan when awake.
  {
    let vq = vec2f(p.x, (fract((p.y + 0.42) / 0.09 + 0.5) - 0.5) * 0.09);
    let slots = sdg_box(vq, vec2f(0.4, 0.016), 0.016);
    let rows = step(abs(p.y + 0.42), 0.14);
    if (rows > 0.5) {
      let inner = mix(C_INK * 0.4, cy * (0.6 + 0.4 * engine_noise(vec2f(p.x * 6.0 - t * 3.0, p.y * 9.0))), glowA);
      put(&acc, slots.x, aa, inner, inner * glowA * 1.2, 0.0);
    }
  }

  // Gauge: brass bezel, dial face, ticks, red zone, needle, glass.
  let gq = p - G_C;
  let gr = length(gq);
  let bez = sdg_circle(gq, G_R + 0.06);
  put(&acc, bez.x, aa, prop_light(U.L, world, to_world_n(pillow(bez, 0.05), 1.0, 0.0),
      brass_albedo(p * 2.0, 1.0, seed + 5.0) * 1.1, 0.9, 0.75), vec3f(0.0), 1.2);
  let face = sdg_circle(gq, G_R);
  var dial = C_DIAL * (0.8 + 0.2 * engine_fbm(p * 6.0 + seed, 3));
  dial *= 1.0 - 0.35 * smoothstep(G_R * 0.6, G_R, gr); // vignette / grime at the rim
  var faceCol = prop_light(U.L, world, vec3f(0.0, 0.0, 1.0), dial, 0.0, 0.2);
  // Dial backlight when awake.
  faceCol += C_ICE * 0.06 * glowA;
  put(&acc, face.x, aa, faceCol, C_ICE * 0.05 * glowA, 1.0);
  {
    var ang = degrees(atan2(gq.y, gq.x));
    var f = (225.0 - ang) / 270.0 * ${MACHINE_GAUGE_MAX};
    if (f < -0.2) { f += 360.0 / 270.0 * ${MACHINE_GAUGE_MAX}; }
    let inSweep = step(0.0, f + 0.004) * step(f, ${MACHINE_GAUGE_MAX} + 0.004);
    // Red zone band 100..125 %.
    let band = step(abs(gr - G_R * 0.83), G_R * 0.09) * step(1.0, f) * inSweep;
    let redC = C_DANGER * (0.7 + 0.3 * breaker * blink);
    acc.col = vec4f(mix(acc.col.rgb, prop_light(U.L, world, vec3f(0.0, 0.0, 1.0), redC, 0.0, 0.2) + redC * 0.5 * breaker * blink, band), acc.col.a);
    acc.emi += redC * band * breaker * blink * 0.8;
    // Ticks every 5 %, long every 25 %.
    let minor = abs(fract(f / 0.05 + 0.5) - 0.5) * 0.05 * (gr * 0.0175 * 270.0 / ${MACHINE_GAUGE_MAX});
    let major = abs(fract(f / 0.25 + 0.5) - 0.5) * 0.25 * (gr * 0.0175 * 270.0 / ${MACHINE_GAUGE_MAX});
    let tickMinor = step(minor, 0.006) * step(abs(gr - G_R * 0.86), G_R * 0.06);
    let tickMajor = step(major, 0.011) * step(abs(gr - G_R * 0.8), G_R * 0.12);
    let tk = max(tickMinor, tickMajor) * inSweep * step(gr, G_R * 0.95);
    acc.col = vec4f(mix(acc.col.rgb, C_INK * 0.9, tk), acc.col.a);
    // The 100 % mark: a fat ink wedge.
    let full = abs(f - 1.0) * gr * 0.0175 * 270.0 / ${MACHINE_GAUGE_MAX};
    let fullK = step(full, 0.016) * step(abs(gr - G_R * 0.72), G_R * 0.2) * step(gr, G_R * 0.95);
    acc.col = vec4f(mix(acc.col.rgb, C_INK, fullK), acc.col.a);
  }
  // Needle.
  let na = gauge_angle(needleF);
  let nd = vec2f(cos(na), sin(na));
  let needle = sdg_segment(gq, -nd * 0.07, nd * G_R * 0.86, 0.013);
  put_shadow(&acc, sdg_segment(gq - vec2f(0.015, -0.02), -nd * 0.07, nd * G_R * 0.86, 0.013).x, 0.02, 0.35);
  let needleC = mix(vec3f(0.55, 0.06, 0.03), vec3f(0.8, 0.1, 0.05), 0.5);
  put(&acc, needle.x, aa, prop_light(U.L, world, vec3f(0.0, 0.0, 1.0), needleC, 0.2, 0.5), vec3f(0.0), 0.4);
  let hub = sdg_circle(gq, 0.04);
  put(&acc, hub.x, aa, prop_light(U.L, world, to_world_n(dome(hub, 0.04), 1.0, 0.0), C_BRASS * 1.2, 0.95, 0.85),
      vec3f(0.0), 0.6);
  // Glass: a soft sheen and a crisp highlight.
  let sheen = smoothstep(0.02, 0.0, abs(gr - G_R * 0.78)) * smoothstep(0.2, 0.9, -gq.x * 0.7 + gq.y * 0.7) * step(gr, G_R);
  add_glow(&acc, vec3f(0.6, 0.65, 0.7) * sheen * 0.35, 0.0);
  let hl = smoothstep(0.05, 0.0, length((gq - vec2f(-0.13, 0.17)) * vec2f(1.0, 1.8)));
  add_glow(&acc, vec3f(0.9) * hl * 0.5, 0.0);

  // Nameplate under the gauge with engraved lines.
  let plate = sdg_box(p - vec2f(0.0, -0.3), vec2f(0.24, 0.05), 0.012);
  put(&acc, plate.x, aa, prop_light(U.L, world, to_world_n(pillow(plate, 0.02), 1.0, 0.0),
      brass_albedo(p * 4.0, 1.0, seed + 8.0), 0.85, 0.7), vec3f(0.0), 0.8);
  let engr = step(abs(p.y + 0.3), 0.008) * step(abs(p.x), 0.18) * step(0.35, engine_noise(vec2f(p.x * 40.0, seed)));
  acc.col = vec4f(mix(acc.col.rgb, C_BRASS_DARK * 0.4, engr), acc.col.a);

  // Status lamp (top left): cyan when awake, red blinking on breaker.
  let lampP = p - vec2f(-0.56, 0.36);
  let lampB = sdg_circle(lampP, 0.085);
  put(&acc, lampB.x, aa, prop_light(U.L, world, to_world_n(pillow(lampB, 0.03), 1.0, 0.0), C_BRASS, 0.9, 0.7),
      vec3f(0.0), 0.8);
  let lamp = sdg_circle(lampP, 0.06);
  let lampOff = vec3f(0.05, 0.08, 0.1) + 0.1 * smoothstep(0.03, 0.0, length(lampP - vec2f(-0.02, 0.02)));
  let lampLit = lampC * (0.7 + 0.5 * smoothstep(0.06, 0.0, length(lampP)));
  put(&acc, lamp.x, aa, lampOff + lampLit, lampLit * 1.5, 0.6);
  add_glow(&acc, lampC * 0.35 * exp(-length(lampP) * 18.0), 1.4);
  // Second lamp (right): amber "ready" pilot.
  let lp2 = p - vec2f(0.56, 0.36);
  let lb2 = sdg_circle(lp2, 0.06);
  put(&acc, lb2.x, aa, prop_light(U.L, world, to_world_n(pillow(lb2, 0.025), 1.0, 0.0), C_BRASS, 0.9, 0.7),
      vec3f(0.0), 0.8);
  let l2 = sdg_circle(lp2, 0.04);
  let pilot = C_AMBER * 1.6 * (1.0 - breaker) * (0.3 + 0.7 * awake);
  put(&acc, l2.x, aa, vec3f(0.06) + pilot * 0.7, pilot, 0.6);

  // Awake: cool rim light from inside spilling over the front.
  add_glow(&acc, cy * glowA * 0.015 * smoothstep(-0.12, 0.0, body.x) * step(body.x, 0.0), 1.0);
  // Breaker: a red wash.
  add_glow(&acc, C_DANGER * breaker * blink * 0.04 * step(body.x, 0.0), 0.5);

  var o: FragOut;
  o.color = acc.col * in.color.a;
  o.emissive = vec4f(acc.emi * in.emissive * in.color.a, acc.col.a * in.color.a);
  return o;
}
`;
