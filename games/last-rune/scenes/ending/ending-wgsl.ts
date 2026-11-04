/**
 * Ending shaders (pitch screen 7): the Last Rune as a room-sized gold disc at
 * the hall centre, the storm funnelling into it, the door of light it always
 * was, and full-screen washes (cool dusk, white-out, gold flood).
 *
 * One WGSL, picked by `params.x` (mode). Built as two materials: `premultiplied`
 * for the disc and washes, `additive` for light (funnel, door, flood).
 *
 *   mode 0  rune disc        params.y ignition 0..1, z time, w aperture 0..1
 *   mode 1  storm funnel     params.y intensity, z time, w collapse 0..1 (pull into the centre)
 *   mode 2  radial wash      tint rgba; params.y radius px, z softness px, w unused
 *   mode 3  door of light    params.y open 0..1, z time, w brightness
 *
 * Quads are centred (frame.sprite). `in.local` is 0..1 over the quad.
 */
export const ENDING_MODE = { disc: 0, funnel: 1, wash: 2, door: 3 } as const;

/** Centre of the hall and of the rune (design px). */
export const RUNE_CENTRE = { x: 960, y: 540 } as const;

export const ENDING_WGSL = /* wgsl */ `
fn rot2e(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

fn seg_e(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

fn last_rune_e(q: vec2f, r: f32) -> f32 {
  // The Last Rune, stroke for stroke as the hall's seal draws it (hall-shaders.ts rune_glyph):
  // a stave, two crossing branches, a hooked foot, a small ring. y points up.
  var d = seg_e(q, vec2f(0.0, -0.62 * r), vec2f(0.0, 0.62 * r));
  d = min(d, seg_e(q, vec2f(0.0, 0.2 * r), vec2f(0.38 * r, 0.52 * r)));
  d = min(d, seg_e(q, vec2f(0.0, 0.2 * r), vec2f(-0.38 * r, 0.52 * r)));
  d = min(d, seg_e(q, vec2f(0.0, -0.18 * r), vec2f(0.32 * r, -0.4 * r)));
  d = min(d, seg_e(q, vec2f(0.32 * r, -0.4 * r), vec2f(0.32 * r, -0.62 * r)));
  d = min(d, abs(length(q - vec2f(0.0, -0.05 * r)) - 0.16 * r));
  return d;
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let mode = i32(in.params.x + 0.5);
  var col = vec3f(0.0);
  var a = 0.0;
  var emi = vec3f(0.0);

  if (mode == 0) {
    // ── The Last Rune: engraved gold disc, lit from within.
    let p = (in.local - vec2f(0.5)) * 2.0;           // -1..1
    let r = length(p);
    if (r > 1.0) { discard; }
    let ign = in.params.y;
    let t = in.params.z;
    let ap = in.params.w;
    let ang = atan2(p.y, p.x);
    a = 1.0 - smoothstep(0.985, 1.0, r);
    // Metal: dark bronze when cold, hot gold when lit. Brushed in rings.
    let brush = 0.85 + 0.15 * engine_noise(vec2f(r * 160.0, ang * 2.0));
    let cold = vec3f(0.11, 0.075, 0.03) * brush;
    let hot = vec3f(1.0, 0.72, 0.28) * brush;
    col = mix(cold, hot * 0.42, ign);
    // Rim band and inner bands.
    let rim = smoothstep(0.9, 0.92, r) * (1.0 - smoothstep(0.975, 0.99, r));
    let band2 = 1.0 - smoothstep(0.004, 0.012, abs(r - 0.7));
    let band3 = 1.0 - smoothstep(0.004, 0.012, abs(r - 0.52));
    // Rune glyph ring between 0.74 and 0.88: notched strokes, turning slowly.
    let ra = ang + t * 0.05;
    let cell = floor(ra / 6.2831853 * 36.0);
    let cf = fract(ra / 6.2831853 * 36.0) - 0.5;
    let h = engine_hash21(vec2f(cell, 7.0));
    let stroke = (1.0 - smoothstep(0.06, 0.12, abs(cf - (h - 0.5) * 0.3)))
      * step(0.76 + h * 0.03, r) * (1.0 - step(0.86 - h * 0.04, r));
    let tick = (1.0 - smoothstep(0.02, 0.06, abs(cf))) * step(0.885, r) * (1.0 - step(0.9, r));
    // Central sigil: the Last Rune itself, the same glyph the hall's seal carries (chrome-polish-3:
    // the climax showed a different mark, a triangle and cross), and three dots for the gems.
    let q = rot2e(-t * 0.02) * p;
    let glyph = last_rune_e(vec2f(q.x, -q.y), 0.56) - 0.016;
    var dots = 1.0;
    for (var i = 0; i < 3; i++) {
      let a0 = 1.5708 + f32(i) * 2.0944;
      dots = min(dots, length(q - vec2f(cos(a0), -sin(a0)) * 0.41) - 0.025);
    }
    let ring = abs(r - 0.47) - 0.01;
    let sig = 1.0 - smoothstep(0.0, 0.01, min(min(glyph, dots), ring));
    let lines = max(max(rim, max(band2, band3)), max(max(stroke, tick), sig));
    // Engraving reads dark when cold, bright when lit.
    col = mix(col * (1.0 - lines * 0.55), col + hot * lines * 0.9, ign);
    // Edge shading so it sits in the floor.
    col *= mix(0.55, 1.0, 1.0 - smoothstep(0.6, 1.0, r) * 0.5);
    // Inner light: rises from the centre as it ignites; the aperture opens to white-gold.
    // The mark is cut out of the inner light, so it stays a readable silhouette as the
    // aperture opens behind it (instead of melting into one white-gold blob).
    let cut = 1.0 - sig * 0.9;
    let core = exp(-r * r * mix(14.0, 9.0, ign)) * ign * cut;
    let open = (1.0 - smoothstep(ap * 0.9 - 0.08, ap * 0.9, r)) * step(0.001, ap) * cut;
    let pulse = 0.85 + 0.15 * sin(t * 2.4 - r * 9.0);
    emi = hot * (lines * ign * 0.7 * pulse + core * 0.35) + vec3f(1.0, 0.86, 0.6) * open * 0.28;
    col += hot * (lines * ign * 0.3 + core * 0.15) + vec3f(1.0, 0.9, 0.7) * open * 0.32;
  } else if (mode == 1) {
    // ── Storm funnel: spiral streaks pulled into the rune.
    let d = in.world - vec2f(960.0, 540.0);
    let r = length(d) + 1.0;
    let ang = atan2(d.y, d.x);
    let t = in.params.z;
    let k = in.params.y;
    let pull = in.params.w;
    let lr = log(r);
    let sw = ang * 3.0 + lr * 4.5 - t * 1.6;
    let n1 = engine_noise(vec2f(sw * 1.9, lr * 3.0 - t * 2.2));
    let n2 = engine_noise(vec2f(sw * 4.3 + 11.0, lr * 7.0 - t * 3.1));
    let streak = pow(max(0.0, n1 * 0.7 + n2 * 0.5 - 0.42), 2.4) * 1.1;
    let reach = mix(1150.0, 420.0, pull);
    let fall = (1.0 - smoothstep(reach * 0.25, reach, r)) * smoothstep(60.0, 220.0, r * (1.0 + pull * 2.0));
    let storm = vec3f(0.45, 0.75, 1.0);
    let gold = vec3f(1.0, 0.75, 0.35);
    let c = mix(storm, gold, (1.0 - smoothstep(150.0, 650.0, r)) * 0.8 + pull * 0.4);
    let sparks = step(0.985, engine_hash21(floor(vec2f(sw * 8.0, lr * 24.0 - t * 9.0)))) * fall;
    let v = (streak * fall + sparks * 0.5) * k;
    col = c * v;
    emi = col * 0.35;
    a = 1.0;
  } else if (mode == 2) {
    // ── Radial wash: tint, revealed from the centre out to params.y.
    let d = length(in.world - vec2f(960.0, 540.0));
    let soft = max(1.0, in.params.z);
    let m = 1.0 - smoothstep(in.params.y - soft, in.params.y, d);
    col = in.color.rgb;
    a = in.color.a * m;
    emi = col * in.emissive;
  } else {
    // ── Door of light: a tall arch standing on the rune, opening upward.
    let sz = in.size;
    let p = (in.local - vec2f(0.5, 1.0)) * sz;      // origin at the bottom centre
    let open = in.params.y;
    let t = in.params.z;
    let bright = in.params.w;
    let hw = sz.x * 0.34;
    let hh = sz.y * 0.86 * open;
    // Arch: box from the floor to hh - hw, capped with a semicircle.
    let top = -hh + hw;
    var dd: f32;
    if (p.y < top) { dd = length(vec2f(p.x, p.y - top)) - hw; }
    else { dd = max(abs(p.x) - hw, p.y); }
    let inside = 1.0 - smoothstep(-6.0, 2.0, dd);
    let halo = exp(-max(dd, 0.0) / (sz.x * 0.08)) * 0.35;
    let rays = 0.75 + 0.25 * engine_noise(vec2f(p.x * 0.03, t * 0.6))
      + 0.15 * sin(p.x * 0.05 + t * 1.3);
    let fadeTop = smoothstep(-sz.y, -sz.y * 0.4, p.y * (1.0 / max(open, 0.05)));
    let core = vec3f(1.0, 0.93, 0.78);
    let edge = vec3f(1.0, 0.68, 0.28);
    let rim = 1.0 - smoothstep(0.0, 14.0, abs(dd));
    // Thin the door's body over the disc centre so the Last Rune reads through it.
    let veil = mix(0.28, 1.0, smoothstep(50.0, 210.0, length(in.world - vec2f(960.0, 540.0))));
    col = (core * inside * rays * 0.62 * veil + edge * (halo + rim * 0.7)) * bright * (0.5 + 0.5 * fadeTop);
    emi = col * 0.55 * veil;
    a = 1.0;
  }

  var o: FragOut;
  if (mode == 0) {
    o.color = vec4f(col * a, a);
    o.emissive = vec4f(emi * in.emissive * a, a);
  } else if (mode == 2) {
    o.color = vec4f(col * a, a);
    o.emissive = vec4f(emi * a, a);
  } else {
    o.color = vec4f(col, 1.0);
    o.emissive = vec4f(emi * in.emissive, 1.0);
  }
  return o;
}
`;
