/**
 * FUSE (Foreman Unit, Slightly Expired), painted entirely from 2D SDFs.
 *
 * Local space: y up, origin on the floor under his centre, ~2.25 units tall. The rig values
 * (`FuseState`) come from `art/props/fuse.ts`, which mirrors the joint positions below so the
 * scene knows where his eye is (it is a light source).
 */
import { PROP_COMMON_WGSL, PROP_LIGHT_FLOATS } from '../art/props/lighting';

/** Uniform floats: lights + 4 state vec4s. */
export const FUSE_UNIFORM_FLOATS = PROP_LIGHT_FLOATS + 16;

/** Shared painting code, used by both the in-scene material and the portrait pass. */
export const FUSE_PAINT_WGSL = /* wgsl */ `
// 1 once FUSE has dropped his clipboard (in-scene material sets it from params.x; the portrait never does).
var<private> fuse_dropped: f32 = 0.0;

${PROP_COMMON_WGSL}

struct FuseState {
  a: vec4f, // time, bob, headTilt, bodyLean
  b: vec4f, // lookX, lookY, eyeGlow, lid
  c: vec4f, // talk, quiet, wheelAngle, armSwing
  d: vec4f, // flipX, portrait, clipboardRaise, deadSpark
};

const HEAD_PIVOT = vec2f(0.0, 1.24);
const EYE_L = vec2f(0.205, 1.57);   // live eye (his left, screen right when unflipped)
const EYE_D = vec2f(-0.205, 1.57);  // dead eye

fn rivet_row(p: vec2f, a: vec2f, b: vec2f, n: f32, r: f32) -> vec3f {
  let ab = b - a;
  let k = clamp(round(dot(p - a, ab) / dot(ab, ab) * (n - 1.0)), 0.0, n - 1.0);
  return sdg_circle(p - (a + ab * k / (n - 1.0)), r);
}

/** Lit surface + spill from his own eye (warm, falls off fast, faces-the-eye weighted). */
fn fuse_lit(L: PropLights, world: vec2f, p: vec2f, nl: vec3f, alb: vec3f, metal: f32, gloss: f32,
            s: FuseState, eyeP: vec2f) -> vec3f {
  let n = to_world_n(nl, s.d.x, 0.0);
  var c = prop_light(L, world, n, alb, metal, gloss);
  let dv = vec3f(eyeP - p, 0.12);
  let dist = length(dv.xy);
  let ld = normalize(dv);
  let spill = max(dot(nl, ld), 0.0) * exp(-dist * dist * 9.0) * s.b.z;
  c += C_EYE * alb * spill * 0.8;
  return c;
}

fn paint_rivets(acc: ptr<function, Acc>, sd: vec3f, aa: f32, L: PropLights, world: vec2f,
                p: vec2f, s: FuseState, eyeP: vec2f) {
  put_shadow(acc, sd.x - 0.006, 0.012, 0.45);
  let c = fuse_lit(L, world, p, dome(sd, 0.025), C_BRASS * 1.1, 0.9, 0.75, s, eyeP);
  put(acc, sd.x, aa, c, vec3f(0.0), 0.6);
}

fn fuse_paint(p_in: vec2f, aa: f32, world: vec2f, L: PropLights, s: FuseState) -> Acc {
  var acc: Acc;
  acc.col = vec4f(0.0);
  acc.emi = vec3f(0.0);
  let t = s.a.x;
  let bob = s.a.y;
  let tilt = s.a.z;
  let lean = s.a.w;
  let look = vec2f(s.b.x, s.b.y);
  let glow = s.b.z;
  let lid = s.b.w;
  let talk = s.c.x;
  let quiet = s.c.y;
  let wheel = s.c.z;
  let swing = s.c.w;
  let raise = s.d.z;
  let p = p_in;

  // ---- Body space (lean around the neck base, bob up).
  let pb = rot2(lean) * (p - vec2f(0.0, 0.32)) + vec2f(0.0, 0.32 - bob);
  // ---- Head space (tilt around the head pivot, quiet drops the head a touch).
  let drop = quiet * 0.04;
  let ph = rot2(tilt) * (pb - HEAD_PIVOT + vec2f(0.0, drop)) + HEAD_PIVOT;
  // Live eye in body-local space (for spill light).
  let eyeP = rot2(-tilt) * (EYE_L - HEAD_PIVOT) + HEAD_PIVOT - vec2f(0.0, drop) + vec2f(0.0, bob);

  // ---- Ground shadow.
  let gsh = sdg_ellipse(p - vec2f(0.0, 0.01), vec2f(0.72, 0.075));
  put_shadow(&acc, gsh.x, 0.06, 0.75);

  // ---- Tread (iron), with rolling lugs.
  let tread = sdg_box(p - vec2f(0.0, 0.17), vec2f(0.5, 0.15), 0.145);
  let tAlb = iron_albedo(p, 1.0) * 0.8;
  put(&acc, tread.x, aa, fuse_lit(L, world, p, pillow(tread, 0.07), tAlb, 0.6, 0.45, s, eyeP),
      vec3f(0.0), 1.2);
  // Lugs: stripes that slide around the tread outline.
  let lugPhase = fract((p.x * 14.0 - wheel * 1.6) + select(0.0, 0.5, p.y > 0.17));
  let lugBand = smoothstep(-0.035, -0.012, tread.x) * (1.0 - smoothstep(-0.012, 0.0, tread.x));
  shade_under(&acc, lugBand * step(0.5, lugPhase) * 0.55);
  // Wheels.
  for (var i = 0; i < 3; i++) {
    let wc = vec2f(-0.31 + f32(i) * 0.31, 0.17);
    let q = p - wc;
    let wd = sdg_circle(q, 0.095);
    let wAlb = brass_albedo(q * 3.0, 1.0, f32(i));
    put(&acc, wd.x, aa, fuse_lit(L, world, p, pillow(wd, 0.04), wAlb, 0.85, 0.6, s, eyeP),
        vec3f(0.0), 0.8);
    // Spokes rotate with the roll.
    let qr = rot2(wheel) * q;
    let ang = atan2(qr.y, qr.x);
    let lq = length(q);
    let spoke = abs(fract(ang / TAU * 5.0 + 0.5) - 0.5) * lq * TAU / 5.0;
    let holeD = max(max(lq - 0.07, 0.034 - lq), 0.013 - spoke);
    shade_under(&acc, cover(holeD, aa) * 0.7);
    let hub = sdg_circle(q, 0.026);
    put(&acc, hub.x, aa, fuse_lit(L, world, p, dome(hub, 0.026), C_IRON, 0.7, 0.6, s, eyeP),
        vec3f(0.0), 0.5);
  }

  // ---- Neck piston.
  let neck = sdg_box(pb - vec2f(0.0, 0.36), vec2f(0.15, 0.1), 0.03);
  put(&acc, neck.x, aa, fuse_lit(L, world, p, pillow(neck, 0.05), C_IRON * 1.2, 0.8, 0.7, s, eyeP),
      vec3f(0.0), 1.0);

  // ---- Upper arms (behind the body).
  let shL = vec2f(-0.5, 1.0);
  let shR = vec2f(0.5, 1.0);
  let elL = vec2f(-0.74, 0.72 + raise * 0.08);
  let wrL = vec2f(-0.54, 0.6 + raise * 0.12);
  let elR = shR + rot2(-0.25 + swing * 0.5) * vec2f(0.22, -0.26);
  let wrR = elR + rot2(swing * 1.1) * vec2f(0.06, -0.27);
  let uaL = sdg_segment(pb, shL, elL, 0.062);
  let uaR = sdg_segment(pb, shR, elR, 0.062);
  let ua = sdg_union(uaL, uaR);
  put(&acc, ua.x, aa, fuse_lit(L, world, p, pillow(ua, 0.05), C_IRON * 1.1, 0.75, 0.55, s, eyeP),
      vec3f(0.0), 1.0);
  let faR = sdg_segment(pb, elR, wrR, 0.055);
  put(&acc, faR.x, aa, fuse_lit(L, world, p, pillow(faR, 0.045), C_IRON * 1.1, 0.75, 0.55, s, eyeP),
      vec3f(0.0), 1.0);

  // ---- Body: brass barrel.
  let bq = pb - vec2f(0.0, 0.8);
  let body = sdg_box(bq * vec2f(1.0 - bq.y * 0.12, 1.0), vec2f(0.53, 0.4), 0.22);
  put_shadow(&acc, body.x - 0.03, 0.05, 0.35);
  let bAlb = brass_albedo(pb, smoothstep(0.0, 0.08, -body.x), 2.0);
  put(&acc, body.x, aa, fuse_lit(L, world, p, pillow(body, 0.16), bAlb, 0.85, 0.55, s, eyeP),
      vec3f(0.0), 1.6);
  // Panel seam (a soft inset line).
  let seam = abs(sdg_box(bq - vec2f(0.0, -0.02), vec2f(0.4, 0.29), 0.12).x) - 0.006;
  shade_under(&acc, cover(seam, aa) * 0.45);
  // Iron belly band with rivets.
  let band = sdg_intersect(sdg_box(bq - vec2f(0.0, 0.14), vec2f(0.7, 0.06), 0.01), body);
  put(&acc, band.x, aa, fuse_lit(L, world, p, pillow(band, 0.03), iron_albedo(pb, 3.0), 0.7, 0.5, s, eyeP),
      vec3f(0.0), 1.0);
  let rv = rivet_row(bq, vec2f(-0.42, 0.14), vec2f(0.42, 0.14), 7.0, 0.022);
  paint_rivets(&acc, rv, aa, L, world, p, s, eyeP);
  let rv2 = sdg_union(
    rivet_row(bq, vec2f(-0.38, -0.3), vec2f(0.38, -0.3), 2.0, 0.02),
    rivet_row(bq, vec2f(-0.38, 0.32), vec2f(0.38, 0.32), 2.0, 0.02));
  paint_rivets(&acc, rv2, aa, L, world, p, s, eyeP);
  // Speaker grille: three slots that glow when he talks.
  let gq = bq - vec2f(0.12, -0.14);
  let slotY = clamp(round(gq.y / 0.055), -1.0, 1.0);
  let slot = sdg_box(gq - vec2f(0.0, slotY * 0.055), vec2f(0.15, 0.014), 0.012);
  let slotGlow = talk * (0.6 + 0.4 * sin(t * 31.0 + slotY * 2.0));
  put(&acc, slot.x, aa, C_IRON_DARK * 0.4 + C_EYE * slotGlow * 1.5, C_EYE * slotGlow * 1.2, 0.0);
  // Day-count plate with tally marks (he counts the days).
  let pq = bq - vec2f(-0.22, -0.14);
  let plate = sdg_box(pq, vec2f(0.12, 0.07), 0.02);
  put(&acc, plate.x, aa, fuse_lit(L, world, p, pillow(plate, 0.02), C_IRON_DARK * 1.6, 0.5, 0.7, s, eyeP),
      vec3f(0.0), 0.8);
  let tx = clamp(round((pq.x + 0.065) / 0.026), 0.0, 5.0);
  let tally = sdg_box(pq - vec2f(-0.065 + tx * 0.026, 0.0), vec2f(0.004, 0.038), 0.002);
  let slash = sdg_segment(pq, vec2f(-0.085, -0.03), vec2f(0.045, 0.035), 0.004);
  let marks = sdg_union(tally, slash);
  put(&acc, marks.x, aa, C_PARCHMENT * 0.9, C_EYE * 0.15 * glow, 0.0);

  // ---- Antenna (behind head).
  let droop = quiet * 0.08;
  let a0 = vec2f(0.14, 1.8);
  let a1 = vec2f(0.2, 2.0 - droop);
  let a2 = vec2f(0.3 + droop * 0.6, 2.07 - droop * 2.0);
  let ant = sdg_union(sdg_segment(ph, a0, a1, 0.014), sdg_segment(ph, a1, a2, 0.012));
  put(&acc, ant.x, aa, fuse_lit(L, world, p, pillow(ant, 0.012), C_IRON * 1.3, 0.8, 0.7, s, eyeP),
      vec3f(0.0), 0.6);
  let bulb = sdg_circle(ph - a2, 0.036);
  let bulbOn = (0.12 + 0.9 * talk * step(0.4, fract(t * 3.1))) * (1.0 - quiet * 0.8);
  put(&acc, bulb.x, aa, fuse_lit(L, world, p, dome(bulb, 0.036), C_BRASS_DARK, 0.5, 0.8, s, eyeP)
      + C_EYE * bulbOn * 0.9, C_EYE * bulbOn, 0.6);

  // ---- Upper neck: ribbed iron collar.
  let nq = ph - vec2f(0.0, 1.22);
  let collar = sdg_box(nq, vec2f(0.17, 0.08), 0.03);
  let rib = 0.75 + 0.25 * smoothstep(0.2, 0.5, abs(fract(nq.y * 30.0) - 0.5));
  put(&acc, collar.x, aa, fuse_lit(L, world, p, pillow(collar, 0.06), C_IRON * rib, 0.8, 0.6, s, eyeP),
      vec3f(0.0), 1.0);

  // ---- Head: domed brass can.
  let hq = ph - vec2f(0.0, 1.56);
  let headBox = sdg_box(hq, vec2f(0.47, 0.27), 0.2);
  let headDome = sdg_ellipse(hq - vec2f(0.0, 0.06), vec2f(0.4, 0.3));
  let head = sdg_smin(headBox, headDome, 0.06);
  put_shadow(&acc, head.x - 0.02, 0.05, 0.4);
  let hAlb = brass_albedo(ph + 3.0, smoothstep(0.0, 0.08, -head.x), 4.0) * 1.08;
  put(&acc, head.x, aa, fuse_lit(L, world, p, pillow(head, 0.18), hAlb, 0.85, 0.6, s, eyeP),
      vec3f(0.0), 1.6);
  // Ear bolts.
  let ear = sdg_circle(vec2f(abs(hq.x) - 0.47, hq.y + 0.02), 0.065);
  put(&acc, ear.x, aa, fuse_lit(L, world, p, dome(ear, 0.065), C_IRON * 1.2, 0.8, 0.65, s, eyeP),
      vec3f(0.0), 1.0);
  // Brow rivets.
  let rv3 = rivet_row(hq, vec2f(-0.26, 0.22), vec2f(0.26, 0.22), 5.0, 0.018);
  paint_rivets(&acc, rv3, aa, L, world, p, s, eyeP);
  // Iron visor band.
  let visor = sdg_box(hq - vec2f(0.0, 0.01), vec2f(0.43, 0.13), 0.11);
  put_shadow(&acc, visor.x - 0.012, 0.03, 0.5);
  put(&acc, visor.x, aa, fuse_lit(L, world, p, pillow(visor, 0.05), iron_albedo(ph, 5.0) * 0.9, 0.75, 0.55, s, eyeP),
      vec3f(0.0), 1.2);
  // Mouth: a small riveted vent under the visor.
  let mouth = sdg_box(hq - vec2f(0.0, -0.18), vec2f(0.12, 0.02 + talk * 0.012 * (0.5 + 0.5 * sin(t * 23.0))), 0.015);
  put(&acc, mouth.x, aa, C_IRON_DARK * 0.3 + C_EYE * talk * 0.6, C_EYE * talk * 0.5, 0.0);

  // ---- Eye bezels (brass rings).
  let eyeR = 0.104;
  let qL = ph - EYE_L;
  let qD = ph - EYE_D;
  let bez = sdg_union(sdg_circle(qL, eyeR + 0.03), sdg_circle(qD, eyeR + 0.03));
  put(&acc, bez.x, aa, fuse_lit(L, world, p, dome(bez, 0.05), C_BRASS * 1.2, 0.9, 0.8, s, eyeP),
      vec3f(0.0), 1.0);

  // ---- Dead eye: dusty cracked glass.
  let de = sdg_circle(qD, eyeR);
  let crack = min(min(
      sdg_segment(qD, vec2f(0.02, 0.03), vec2f(0.09, 0.07), 0.0).x,
      sdg_segment(qD, vec2f(0.02, 0.03), vec2f(-0.05, 0.08), 0.0).x),
      min(sdg_segment(qD, vec2f(0.02, 0.03), vec2f(0.0, -0.09), 0.0).x,
          sdg_segment(qD, vec2f(0.0, -0.03), vec2f(-0.08, -0.05), 0.0).x));
  let dust = engine_fbm(qD * 40.0, 3);
  var deadCol = mix(vec3f(0.012, 0.014, 0.02), vec3f(0.06, 0.055, 0.05), dust * 0.7 + 0.2 * smoothstep(0.0, -eyeR, -de.x));
  deadCol += vec3f(0.5, 0.55, 0.6) * smoothstep(0.03, 0.0, length(qD - vec2f(-0.04, 0.045))) * 0.35;
  deadCol = mix(deadCol, vec3f(0.18, 0.2, 0.22), (1.0 - smoothstep(0.0, aa * 1.5, crack)) * 0.8);
  let spark = s.d.w * step(0.97, engine_hash21(vec2f(floor(t * 20.0), 3.0)));
  put(&acc, de.x, aa, deadCol + C_EYE * spark * 0.4, C_EYE * spark * 0.6, 0.9);

  // ---- Live eye: amber lens, iris, hot pupil, brass lid.
  let le = sdg_circle(qL, eyeR);
  let pupilP = qL - look * 0.032;
  let pr = length(pupilP);
  let irisR = 0.062 * (1.0 - quiet * 0.2);
  let hum = 0.92 + 0.08 * sin(t * 9.0) + talk * 0.25 * sin(t * 17.0);
  let g = glow * hum;
  var lens = mix(C_EYE * 0.35, C_EYE * 1.1, smoothstep(eyeR, 0.0, length(qL)));
  lens = mix(lens, C_EYE * 0.18, smoothstep(irisR - 0.01, irisR, pr) * smoothstep(irisR + 0.02, irisR, pr) * 0.9);
  let core = smoothstep(irisR * 0.6, 0.0, pr);
  lens += vec3f(1.0, 0.8, 0.5) * core * 0.9;
  // Iris rays.
  let ang = atan2(pupilP.y, pupilP.x);
  lens *= 0.9 + 0.12 * sin(ang * 14.0) * smoothstep(0.0, irisR, pr) * step(pr, irisR);
  var eyeCol = lens * g;
  let glint = smoothstep(0.022, 0.0, length(qL - vec2f(-0.04, 0.045)));
  eyeCol += vec3f(1.0, 0.95, 0.85) * glint * 0.8;
  put(&acc, le.x, aa, eyeCol, lens * g * (0.35 + 0.5 * core), 0.5);
  // Lid: a brass shutter dropping from the top (blink, quiet, skeptical).
  let lidEdge = eyeR - lid * 2.0 * eyeR;
  let lidD = max(le.x, -(qL.y - lidEdge));
  let lidSd = vec3f(lidD, 0.0, -1.0);
  let lidN = normalize(vec3f(0.0, -smoothstep(0.03, 0.0, abs(qL.y - lidEdge)) * 1.2, 1.0));
  put(&acc, lidSd.x, aa, fuse_lit(L, world, p, lidN, C_BRASS * 0.9, 0.9, 0.7, s, eyeP), vec3f(0.0), 0.0);
  // Halo from the live eye (additive, also feeds bloom).
  let halo = exp(-length(qL) * length(qL) * 60.0) * g * (1.0 - lid * 0.6);
  add_glow(&acc, C_EYE * halo * 0.2, 1.2);

  // ---- Left forearm + clipboard (in front of the body).
  let faL = sdg_segment(pb, elL, wrL, 0.055);
  let joints = sdg_union(sdg_union(sdg_circle(pb - elL, 0.066), sdg_circle(pb - elR, 0.066)),
                         sdg_union(sdg_circle(pb - shL, 0.075), sdg_circle(pb - shR, 0.075)));
  put(&acc, joints.x, aa, fuse_lit(L, world, p, dome(joints, 0.07), C_BRASS * 1.1, 0.9, 0.7, s, eyeP),
      vec3f(0.0), 1.0);
  // Pushed off the SDF when the clipboard has been dropped (story-scenes ending).
  let gone = fuse_dropped * 10.0;
  let cbc = vec2f(-0.36, 0.64 + raise * 0.12);
  let cq = rot2(0.14 - raise * 0.1) * (pb - cbc);
  let board = sdg_box(cq, vec2f(0.2, 0.27), 0.025) + vec3f(gone, 0.0, 0.0);
  put_shadow(&acc, board.x - 0.02, 0.04, 0.5);
  let wood = 0.75 + 0.35 * engine_fbm(cq * vec2f(4.0, 40.0), 3);
  put(&acc, board.x, aa, fuse_lit(L, world, p, pillow(board, 0.015), C_BOARD * wood, 0.0, 0.3, s, eyeP),
      vec3f(0.0), 1.2);
  let paper = sdg_box(cq - vec2f(0.0, -0.025), vec2f(0.165, 0.215), 0.006) + vec3f(gone, 0.0, 0.0);
  let paperTone = C_PARCHMENT * (0.82 + 0.18 * engine_fbm(cq * 18.0, 3));
  put(&acc, paper.x, aa, fuse_lit(L, world, p, vec3f(0.0, 0.0, 1.0), paperTone, 0.0, 0.2, s, eyeP),
      vec3f(0.0), 0.0);
  // Ink: a form with lines and a checkbox column.
  let ly = clamp(round((cq.y + 0.02) / 0.042), -4.0, 3.0);
  let lineLen = 0.1 + 0.03 * engine_hash21(vec2f(ly, 2.0));
  let line = sdg_box(cq - vec2f(0.02 + lineLen * 0.5 - 0.08, -0.02 + ly * 0.042), vec2f(lineLen * 0.5, 0.004), 0.002);
  let box = abs(sdg_box(cq - vec2f(-0.12, -0.02 + ly * 0.042), vec2f(0.013, 0.013), 0.002).x) - 0.003;
  let ink = min(line.x, box) + gone;
  put(&acc, ink, aa, C_INK * 1.5 + vec3f(0.03, 0.02, 0.05), vec3f(0.0), 0.0);
  let clip = sdg_box(cq - vec2f(0.0, 0.25), vec2f(0.075, 0.035), 0.02) + vec3f(gone, 0.0, 0.0);
  put(&acc, clip.x, aa, fuse_lit(L, world, p, pillow(clip, 0.025), C_IRON * 1.6, 0.9, 0.85, s, eyeP),
      vec3f(0.0), 0.8);
  put(&acc, faL.x, aa, fuse_lit(L, world, p, pillow(faL, 0.045), C_IRON * 1.1, 0.75, 0.55, s, eyeP),
      vec3f(0.0), 1.0);

  // ---- Clamps (C-shaped jaws) at both wrists.
  for (var k = 0; k < 2; k++) {
    let wr = select(wrR, wrL, k == 1);
    let dirA = select(-1.57 + swing * 1.1, 0.5, k == 1);
    let qc = rot2(-dirA) * (pb - wr);
    let open = select(0.35 + talk * 0.25 * sin(t * 6.0), 0.12, k == 1);
    let jawRing = sdg_ring(qc - vec2f(0.075, 0.0), 0.06, 0.022);
    let wedge = abs(atan2(qc.y, qc.x - 0.075)) - open;
    let jaw = vec3f(max(jawRing.x, -wedge * 0.06), jawRing.yz);
    let knuckle = sdg_circle(qc, 0.045);
    let cl = sdg_union(jaw, knuckle);
    put(&acc, cl.x, aa, fuse_lit(L, world, p, pillow(cl, 0.03), C_IRON * 1.35, 0.85, 0.7, s, eyeP),
        vec3f(0.0), 1.0);
  }
  return acc;
}
`;

/** In-scene material: one quad per FUSE; uniform = lights + state. */
export const FUSE_MATERIAL_WGSL = /* wgsl */ `
${FUSE_PAINT_WGSL}
struct FuseU { L: PropLights, s: FuseState };
@group(1) @binding(0) var<uniform> U: FuseU;

// Quad covers x ∈ [-1.1, 1.1], y ∈ [-0.12, 2.38] in FUSE units.
@fragment fn fs_main(in: VSOut) -> FragOut {
  var p = vec2f((in.local.x - 0.5) * 2.2, (1.0 - in.local.y) * 2.5 - 0.12);
  p.x *= U.s.d.x;
  fuse_dropped = in.params.x;
  let aa = max(fwidth(p.x), fwidth(p.y)) * 1.0;
  let acc = fuse_paint(p, aa, in.world, U.L, U.s);
  var o: FragOut;
  o.color = vec4f(acc.col.rgb * in.color.a, acc.col.a * in.color.a);
  o.emissive = vec4f(acc.emi * in.emissive * in.color.a, acc.col.a * in.color.a);
  return o;
}
`;

/** Portrait pass: head and shoulders on a dark plate, sRGB-encoded for a canvas. */
export const FUSE_PORTRAIT_WGSL = /* wgsl */ `
${FUSE_PAINT_WGSL}
struct PortraitU { L: PropLights, s: FuseState, view: vec4f };
@group(0) @binding(0) var<uniform> U: PortraitU;

fn aces(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}
fn to_srgb(c: vec3f) -> vec3f {
  return select(1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, c * 12.92, c <= vec3f(0.0031308));
}

@fragment fn fs_main(in: FullscreenIn) -> @location(0) vec4f {
  // view: centre x, centre y, half-extent (units), corner radius (0..0.5 of size)
  let uv = in.uv;
  var p = vec2f((uv.x - 0.5) * 2.0, (0.5 - uv.y) * 2.0) * U.view.z + U.view.xy;
  p.x *= U.s.d.x;
  let aa = max(fwidth(p.x), fwidth(p.y));
  // Synthetic "world" px for the lights: 100 px per unit, y down.
  let world = vec2f(p.x * U.s.d.x, -p.y) * 100.0;
  let acc = fuse_paint(p, aa, world, U.L, U.s);
  // Plate: ink with a warm bloom behind his eye and a cool rim, inside a gold bezel.
  let q = uv - 0.5;
  let r = length(q);
  var bg = mix(vec3f(0.05, 0.06, 0.1), vec3f(0.012, 0.012, 0.022), smoothstep(0.0, 0.7, r));
  let eyeUv = vec2f(0.5 + 0.205 * U.s.d.x / (2.0 * U.view.z) - U.view.x / (2.0 * U.view.z), 0.5 - (1.57 - U.view.y) / (2.0 * U.view.z));
  bg += C_EYE * 0.25 * exp(-dot(uv - eyeUv, uv - eyeUv) * 9.0) * U.s.b.z;
  var c = acc.col.rgb + bg * (1.0 - acc.col.a) + acc.emi * 0.35;
  // Rounded-square bezel.
  let bd = sdg_box(q, vec2f(0.5), U.view.w).x;
  let px = fwidth(q.x);
  let rim = smoothstep(-0.035, -0.02, bd) * (1.0 - smoothstep(-0.008, 0.0, bd));
  let rimN = normalize(vec3f(normalize(q + 1e-4) * (1.0 - smoothstep(-0.035, -0.0, bd)) * 2.0, 1.0));
  let gold = C_GOLD * (0.35 + 0.9 * max(dot(rimN, normalize(vec3f(-0.5, -0.6, 0.7))), 0.0));
  c = mix(c, gold, rim);
  let inside = 1.0 - smoothstep(-px, px, bd);
  c = aces(c * 1.1);
  return vec4f(to_srgb(c) * inside, inside);
}
`;
