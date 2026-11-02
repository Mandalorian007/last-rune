/**
 * Candle body (wax + brass dish, lit by its own flame and the light set), the flame sprite,
 * and two small utility materials: additive glow (halos, light pools) and soft shadow.
 */
import { LIGHTS_WGSL } from './lights-wgsl';

/**
 * Candle body. Quad layout (local 0..1): wax from y = TOP to y = 0.9, brass dish below.
 * params.x = flame intensity (flicker), params.y = seed, params.z = wax width (fraction of
 * quad width), params.w = burn-down (0 = fresh, 1 = melted stub look).
 * tint = wax colour (linear).
 */
export const CANDLE_WGSL = /* wgsl */ `${LIGHTS_WGSL}
@fragment fn fs_main(in: VSOut) -> FragOut {
  let lx = in.local.x;
  let ly = in.local.y;
  let flame = in.params.x;
  let seed = in.params.y;
  let bw = in.params.z * 0.5;
  let melt = in.params.w;
  let wax = in.color.rgb;
  let px = in.size;

  // Melted, uneven top edge and drips.
  let top = 0.07 + (engine_noise(vec2f(lx * 9.0 + seed, 1.0)) - 0.5) * 0.03;
  let col = floor((lx - 0.5) / max(bw, 0.01) * 4.0 + seed * 3.0);
  let dripLen = pow(engine_hash21(vec2f(col, seed)), 2.0) * (0.25 + 0.35 * melt);
  let dripX = fract((lx - 0.5) / max(bw, 0.01) * 4.0 + seed * 3.0);
  let dripShape = smoothstep(0.5, 0.15, abs(dripX - 0.5));
  let drip = dripShape * (1.0 - smoothstep(top + dripLen - 0.03, top + dripLen, ly)) * step(top, ly);
  let bulge = drip * 0.035;

  let nx = (lx - 0.5) / (bw + bulge);
  let insideX = 1.0 - smoothstep(0.96, 1.04, abs(nx));
  let insideY = smoothstep(top - 0.005, top + 0.005, ly) * (1.0 - smoothstep(0.895, 0.905, ly));
  let body = insideX * insideY;

  // Cylinder normal.
  let cx = clamp(nx, -1.0, 1.0);
  let n = normalize(vec3f(cx, -0.1, sqrt(max(1.0 - cx * cx, 0.0)) + 0.2));
  let lit = lights_shade(in.world, 20.0, n, 24.0);
  // Its own flame, just above the top: strong wrap light on the upper wax.
  let dTop = max(ly - top, 0.0) * px.y;
  let own = vec3f(1.0, 0.55, 0.2) * flame * (1.4 * exp(-dTop / (px.x * 0.35)) + 0.25);
  // Subsurface: light scattering through the wax near the flame.
  let sss = vec3f(1.0, 0.5, 0.18) * flame * exp(-dTop / (px.x * 0.22)) * (0.6 + 0.4 * (1.0 - abs(cx)));
  // Round the cylinder: dark at the sides, falling off down the stick away from the flame.
  let round = 0.18 + 0.82 * pow(1.0 - abs(cx), 0.7);
  let down = mix(1.0, 0.3, smoothstep(top, 0.9, ly));
  var c = wax * (lit.diffuse * 0.4 * round * mix(1.0, 0.6, smoothstep(top, 0.9, ly)) + own * round * down * 0.7)
    + lit.spec * 0.05 * round;
  c *= 0.85 + 0.3 * drip;
  c *= 0.9 + 0.1 * engine_noise(vec2f(lx * 40.0, ly * 6.0) + seed);
  c += sss * 0.45 * round;
  // Melted pool on the top surface: a darker ring with a bright lip.
  let lipLine = exp(-pow((ly - top) * px.y / 2.0, 2.0));
  c += vec3f(1.0, 0.7, 0.35) * lipLine * flame * 0.5 * insideX;

  // Wick.
  let wick = (1.0 - smoothstep(0.012, 0.022, abs(lx - 0.5))) *
    step(top - 0.06, ly) * step(ly, top + 0.005);
  // Brass dish.
  let dp = vec2f((lx - 0.5) / 0.5, (ly - 0.925) / 0.06);
  let dr = length(dp);
  let dish = 1.0 - smoothstep(0.95, 1.05, dr);
  let dn = normalize(vec3f(dp.x * 0.6, dp.y * 0.9 - 0.2, 1.0));
  let dlit = lights_shade(in.world, 6.0, dn, 40.0);
  let brass = vec3f(0.578, 0.305, 0.048);
  var dc = brass * (dlit.diffuse * 0.8 + own * 0.25) + dlit.spec * vec3f(1.0, 0.8, 0.5) * 1.4;
  dc *= 0.75 + 0.25 * smoothstep(0.6, 0.95, dr);
  let dishOnTop = dish * (1.0 - body * step(ly, 0.9));

  var outc = c;
  var a = body;
  outc = mix(outc, dc, dishOnTop);
  a = max(a, dishOnTop);
  outc = mix(outc, vec3f(0.02, 0.012, 0.01), wick);
  a = max(a, wick);
  outc *= lights_floor(in.world);

  var o: FragOut;
  o.color = vec4f(outc, a);
  o.emissive = vec4f(sss * 0.35 * body + vec3f(1.0, 0.7, 0.35) * lipLine * flame * 0.4 * insideX, a);
  return o;
}
`;

/**
 * Flame (additive). The quad's bottom-centre sits on the wick. params.x = flicker (0.6..1.2),
 * params.y = seed, params.z = sway amount. Colours are fixed (blue root, white core, candle
 * body, red-orange tip); tint scales brightness.
 */
export const FLAME_WGSL = /* wgsl */ `
@fragment fn fs_main(in: VSOut) -> FragOut {
  let t = globals.time;
  let fl = in.params.x;
  let seed = in.params.y;
  let sway = in.params.z;
  let y = 1.0 - in.local.y;                  // 0 at the base, 1 at the tip
  var x = in.local.x - 0.5;
  // Sway and lick: more at the tip.
  x += (sin(y * 3.2 - t * 6.5 + seed) * 0.05 + (engine_noise(vec2f(t * 4.0 + seed, y * 3.0)) - 0.5) * 0.08)
    * y * y * sway;
  let yb = 0.22;
  var w = 0.0;
  if (y < yb) {
    w = 0.36 * sqrt(max(y / yb, 0.0));
  } else {
    w = 0.36 * pow(max(1.0 - (y - yb) / (1.0 - yb), 0.0), 1.35);
  }
  w *= 0.85 + 0.25 * fl;
  let d = abs(x) / max(w, 1e-3);
  let inside = (1.0 - smoothstep(0.75, 1.0, d)) * step(0.0, y);
  let core = (1.0 - smoothstep(0.0, 0.55, d)) * smoothstep(0.02, 0.15, y) * (1.0 - smoothstep(0.35, 0.75, y));
  let blue = (1.0 - smoothstep(0.0, 0.18, y)) * smoothstep(0.3, 0.9, d);
  let tipFade = 1.0 - smoothstep(0.55, 1.0, y);
  var c = mix(vec3f(1.0, 0.25, 0.05), vec3f(1.0, 0.55, 0.15), tipFade);
  c = mix(c, vec3f(1.0, 0.9, 0.62), core);
  c = mix(c, vec3f(0.08, 0.25, 1.0), blue * 0.8);
  let a = inside * (0.35 + 0.65 * tipFade) * in.color.a;
  let k = (1.2 + 2.5 * core) * fl * in.color.r;
  var o: FragOut;
  o.color = vec4f(c * k * 0.5, a);
  o.emissive = vec4f(c * k * in.emissive, a);
  return o;
}
`;

/**
 * Soft additive glow. params.x = falloff sharpness (default 3), params.y = 1 to write the
 * colour target only (light pooling on a surface, no bloom). tint = colour × intensity.
 */
export const GLOW_WGSL = /* wgsl */ `
@fragment fn fs_main(in: VSOut) -> FragOut {
  let p = in.local * 2.0 - 1.0;
  let r2 = dot(p, p);
  let k = select(in.params.x, 3.0, in.params.x <= 0.0);
  let g = exp(-r2 * k) * (1.0 - smoothstep(0.75, 1.0, sqrt(r2)));
  let surfaceOnly = in.params.y > 0.5;
  var o: FragOut;
  o.color = vec4f(in.color.rgb, g * in.color.a);
  let e = select(in.emissive, 0.0, surfaceOnly);
  o.emissive = vec4f(in.color.rgb * e, g * in.color.a);
  return o;
}
`;

/** Soft contact shadow (alpha). tint.rgb = shadow colour, tint.a = opacity; params.x = softness 0..1. */
export const SHADOW_WGSL = /* wgsl */ `
@fragment fn fs_main(in: VSOut) -> FragOut {
  let p = in.local * 2.0 - 1.0;
  let r = length(p);
  let soft = clamp(in.params.x, 0.05, 1.0);
  let a = (1.0 - smoothstep(1.0 - soft, 1.0, r)) * in.color.a;
  var o: FragOut;
  o.color = vec4f(in.color.rgb, a);
  o.emissive = vec4f(0.0, 0.0, 0.0, a * 0.6);
  return o;
}
`;
