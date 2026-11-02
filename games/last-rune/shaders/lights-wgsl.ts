/**
 * Shared 2D point-light set, read by every lit material (stone, altar, gems, candles, gold).
 * Layout matches `LightSet` in `art/materials/lights.ts`. Must be the material's uniform
 * block at `@group(1) @binding(0)`.
 *
 * Space: logical px, x right, y down, z toward the viewer. Normals use the same frame.
 */
export const MAX_LIGHTS = 16;
/** ambient vec4 + info vec4 + MAX_LIGHTS × (pos vec4 + col vec4). */
export const LIGHT_SET_FLOATS = 8 + MAX_LIGHTS * 8;

export const LIGHTS_WGSL = /* wgsl */ `
struct LightSet {
  ambient: vec4f,                       // rgb ambient, w = floor darkening (0..1)
  info: vec4f,                          // x = light count, y = floor start (0..1 of height)
  pos: array<vec4f, ${MAX_LIGHTS}>,     // x, y, z (height above the surface, px), radius
  col: array<vec4f, ${MAX_LIGHTS}>,     // rgb × intensity, w = flags (unused)
};
@group(1) @binding(0) var<uniform> LS: LightSet;

struct Lit {
  diffuse: vec3f,
  spec: vec3f,
};

fn light_atten(d: f32, radius: f32) -> f32 {
  let x = clamp(1.0 - d / radius, 0.0, 1.0);
  return x * x;
}

/**
 * Shade a surface point. world = logical px, h = surface height (px toward the viewer),
 * n = unit normal (x right, y down, z out), shininess = specular exponent.
 */
fn lights_shade(world: vec2f, h: f32, n: vec3f, shininess: f32) -> Lit {
  var r: Lit;
  r.diffuse = LS.ambient.rgb * (0.55 + 0.45 * n.z);
  r.spec = vec3f(0.0);
  let count = i32(LS.info.x);
  for (var i = 0; i < count; i++) {
    let p = LS.pos[i];
    let c = LS.col[i].rgb;
    let dv = vec3f(p.xy - world, p.z - h);
    let d2 = length(dv.xy);
    let att = light_atten(d2, p.w);
    if (att <= 0.0) { continue; }
    let l = normalize(dv);
    // Half-lambert keeps the shadow side of rough stone from going dead black.
    let ndl = max(dot(n, l), 0.0);
    r.diffuse += c * att * (ndl * 0.85 + 0.15);
    let hv = normalize(l + vec3f(0.0, 0.0, 1.0));
    r.spec += c * att * pow(max(dot(n, hv), 0.0), shininess);
  }
  return r;
}

/** Darken and cool the bottom of the frame (the floor in shadow under the mist). */
fn lights_floor(world: vec2f) -> f32 {
  let y = world.y / globals.logicalSize.y;
  return 1.0 - smoothstep(LS.info.y, 1.0, y) * LS.ambient.w;
}
`;
