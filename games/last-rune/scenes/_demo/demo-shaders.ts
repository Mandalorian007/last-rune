/**
 * Demo-only WGSL. These live in the game folder on purpose: they prove that game shaders plug
 * into the engine as materials without touching engine code.
 */

/** Procedural slate block wall, generated once into a texture via `textureFromShader`. */
export const STONE_TEXTURE_WGSL = /* wgsl */ `
fn shade(uv: vec2f) -> vec4f {
  // 2:1 blocks, 9 rows on a 16:9 canvas.
  var p = vec2f(uv.x * (16.0 / 9.0) * 4.5, uv.y * 9.0);
  let row = floor(p.y);
  p.x += 0.5 * (row - 2.0 * floor(row * 0.5)) + engine_hash21(vec2f(row, 3.0)) * 0.3;
  let cell = floor(p);
  let f = fract(p);
  let h = engine_hash21(cell);

  // Chipped mortar edges: distance to block edge, perturbed by noise.
  let edge = min(min(f.x, 1.0 - f.x) * 2.0, min(f.y, 1.0 - f.y));
  let wob = engine_fbm(p * 6.0 + cell * 3.1, 3) * 0.12;
  let block = smoothstep(0.035, 0.075, edge - wob * 0.5);

  let grain = engine_fbm(p * vec2f(9.0, 14.0) + h * 10.0, 5);
  let fine = engine_noise(p * 60.0);
  let tool = 0.5 + 0.5 * sin((p.x + p.y * 0.3) * 40.0 + grain * 6.0);

  var slate = vec3f(0.050, 0.058, 0.078) * (0.65 + 0.7 * h);
  slate *= 0.7 + 0.55 * grain + 0.12 * fine + 0.05 * tool;
  // Warm/cool variation per block.
  slate *= mix(vec3f(1.05, 0.98, 0.92), vec3f(0.9, 0.98, 1.1), engine_hash21(cell + 7.0));
  // Moss creeping up from the lower edge of some blocks.
  let moss = smoothstep(0.55, 0.95, f.y) * smoothstep(0.55, 0.75, engine_fbm(p * 4.0, 4)) * step(0.6, h);
  slate = mix(slate, vec3f(0.035, 0.06, 0.03), moss * 0.7);

  let mortar = vec3f(0.018, 0.019, 0.024) * (0.6 + 0.8 * engine_noise(p * 30.0));
  // Bevel: brighten the top-left inner edge, darken bottom-right.
  let bevel = smoothstep(0.0, 0.12, f.y) - smoothstep(0.88, 1.0, f.y);
  slate *= 0.85 + 0.25 * bevel;
  return vec4f(mix(mortar, slate, block), 1.0);
}
`;

export const MAX_LIGHTS = 16;
/** Uniform floats for the lit-stone material: ambient vec4 + 2 vec4 per light. */
export const LIT_STONE_FLOATS = 4 + MAX_LIGHTS * 8;

/** Stone texture lit by a list of coloured point lights (warm candles, cool gems). */
export const LIT_STONE_WGSL = /* wgsl */ `
struct Lights {
  ambient: vec4f,                       // rgb, floor darkening
  lights: array<vec4f, ${MAX_LIGHTS * 2}>,  // [2i] = x, y, radius, -   [2i+1] = rgb, intensity
};
@group(1) @binding(0) var<uniform> L: Lights;
@group(1) @binding(1) var samp: sampler;
@group(1) @binding(2) var stoneTex: texture_2d<f32>;

@fragment fn fs_main(in: VSOut) -> FragOut {
  let albedo = textureSample(stoneTex, samp, in.uv).rgb * in.color.rgb;
  // Fake relief from the texture's luminance gradient so lights rake across the stone.
  let lum = engine_luma(albedo);
  var light = L.ambient.rgb;
  for (var i = 0; i < ${MAX_LIGHTS}; i++) {
    let p = L.lights[i * 2];
    let c = L.lights[i * 2 + 1];
    if (c.w <= 0.0) { continue; }
    let d = distance(in.world, p.xy);
    let att = pow(clamp(1.0 - d / p.z, 0.0, 1.0), 2.2);
    light += c.rgb * c.w * att;
  }
  // Floor band (bottom of the frame) is darker and cooler.
  let floorK = smoothstep(0.72, 1.0, in.world.y / globals.logicalSize.y);
  light *= 1.0 - floorK * L.ambient.w;
  var o: FragOut;
  o.color = vec4f(albedo * light * (0.8 + 2.5 * lum), 1.0);
  o.emissive = vec4f(0.0, 0.0, 0.0, 1.0);
  return o;
}
`;

/**
 * Faceted glowing orb. tint = gem colour; params.x = pulse (0..1), params.y = seed;
 * emissive = glow strength.
 */
export const ORB_WGSL = /* wgsl */ `
@fragment fn fs_main(in: VSOut) -> FragOut {
  let p = in.local * 2.0 - 1.0;
  let r = length(p);
  let base = in.color.rgb;
  let seed = in.params.y;
  let t = globals.time;

  let n = vec3f(p, sqrt(max(1.0 - r * r, 0.0)));
  let ang = atan2(p.y, p.x) + seed;
  let facets = 7.0;
  let fa = floor((ang / 6.2831853 + 0.5) * facets);
  let ring = floor(r * 3.0);
  let facet = engine_hash21(vec2f(fa + seed * 13.0, ring));
  let lightDir = normalize(vec3f(-0.45, -0.6, 0.65));
  let diff = max(dot(n, lightDir), 0.0);
  let spec = pow(max(dot(reflect(-lightDir, n), vec3f(0.0, 0.0, 1.0)), 0.0), 28.0);
  let fres = pow(1.0 - n.z, 2.5);

  // Inner glyph: a ring with rotating notches + a cross, lit from inside.
  let a2 = atan2(p.y, p.x) + t * 0.4 + seed;
  let notches = step(0.35, fract(a2 * 3.0 / 6.2831853));
  let glyphRing = smoothstep(0.05, 0.0, abs(r - 0.45)) * notches;
  let cross = smoothstep(0.045, 0.0, min(abs(p.x), abs(p.y))) * step(r, 0.3);
  let glyph = max(glyphRing, cross);
  let core = exp(-r * r * 5.0);
  let pulse = in.params.x;

  let body = base * (0.18 + 0.45 * diff + 0.35 * facet) + base * fres * 0.9;
  let col = body + vec3f(spec) * 0.9;
  let aa = 1.0 - smoothstep(0.96, 1.0, r);

  var o: FragOut;
  o.color = vec4f(col, aa);
  let glow = base * (core * (0.8 + 1.2 * pulse) + glyph * (1.5 + 2.0 * pulse) + facet * 0.15);
  o.emissive = vec4f(glow * in.emissive, aa);
  return o;
}
`;

/** Soft additive glow (flames, halos). params.x = falloff sharpness. */
export const GLOW_WGSL = /* wgsl */ `
@fragment fn fs_main(in: VSOut) -> FragOut {
  let p = in.local * 2.0 - 1.0;
  let r2 = dot(p, p);
  let k = max(in.params.x, 0.5);
  let g = exp(-r2 * k) * (1.0 - smoothstep(0.7, 1.0, sqrt(r2)));
  var o: FragOut;
  o.color = vec4f(in.color.rgb, g * in.color.a);
  o.emissive = vec4f(in.color.rgb * in.emissive, g * in.color.a);
  return o;
}
`;
