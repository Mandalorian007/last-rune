/**
 * Gold embossed text and plates. The mask texture (rgba8unorm, linear) is drawn on a canvas:
 *   r = text coverage (sharp)      g = text height (blurred, bevel profile)
 *   b = drop shadow (blurred, offset down)   a = plate height (blurred; plate coverage = a > 0.5)
 * Lit by the shared LightSet with a fake environment (warm from above, amethyst below) so the
 * gold reads as metal even with few lights. params.x = shine (default 1), params.y = plate
 * enamel darkness, params.z = emissive glint strength. tint = gold colour (linear).
 */
import { LIGHTS_WGSL } from './lights-wgsl';

export const EMBOSS_WGSL = /* wgsl */ `${LIGHTS_WGSL}
@group(1) @binding(1) var samp: sampler;
@group(1) @binding(2) var maskTex: texture_2d<f32>;

fn gold_env(n: vec3f, gold: vec3f) -> vec3f {
  // Up-facing (n.y < 0): warm candle sky; down-facing: amethyst shadow; facing: deep gold.
  let up = clamp(-n.y, 0.0, 1.0);
  let down = clamp(n.y, 0.0, 1.0);
  let side = abs(n.x);
  var e = gold * 0.35;
  e += vec3f(1.0, 0.82, 0.45) * up * 1.2;
  e += vec3f(0.12, 0.05, 0.28) * down;
  e += gold * side * 0.4;
  return e;
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let dims = vec2f(textureDimensions(maskTex));
  let tx = vec2f(1.0 / dims.x, 0.0);
  let ty = vec2f(0.0, 1.0 / dims.y);
  let m = textureSample(maskTex, samp, in.uv);
  let mx0 = textureSample(maskTex, samp, in.uv - tx);
  let mx1 = textureSample(maskTex, samp, in.uv + tx);
  let my0 = textureSample(maskTex, samp, in.uv - ty);
  let my1 = textureSample(maskTex, samp, in.uv + ty);

  let shine = select(in.params.x, 1.0, in.params.x <= 0.0);
  let gold = in.color.rgb;
  let t = globals.time;

  // Text relief.
  let tGrad = vec2f(mx1.g - mx0.g, my1.g - my0.g) * 0.5 * dims.x / 120.0;
  let tn = normalize(vec3f(-tGrad * 6.0, 1.0));
  // Plate relief.
  let pGrad = vec2f(mx1.a - mx0.a, my1.a - my0.a) * 0.5 * dims.x / 120.0;
  let pn = normalize(vec3f(-pGrad * 5.0, 1.0));

  let textA = m.r;
  let plateA = smoothstep(0.42, 0.55, m.a);
  let rim = plateA * (1.0 - smoothstep(0.82, 0.95, m.a));

  // Gold shading (used for text and the plate rim).
  let n = normalize(mix(pn, tn, textA));
  let h = 6.0 + 8.0 * m.g + 4.0 * m.a;
  let lit = lights_shade(in.world, h, n, 60.0);
  let env = gold_env(n, gold);
  // Brushed noise across the metal.
  let brush = 0.9 + 0.1 * engine_noise(vec2f(in.local.x * 260.0, in.local.y * 14.0));
  var goldC = gold * (lit.diffuse * 0.9 + env * 0.55) * brush + lit.spec * vec3f(1.0, 0.85, 0.55) * 1.6 * shine;
  // A slow sweep of light across the letters.
  let sweep = exp(-pow((in.local.x - fract(t * 0.07) * 1.6 + 0.3 - in.local.y * 0.3) * 9.0, 2.0));
  let crest = clamp(1.0 - length(tGrad) * 4.0, 0.0, 1.0) * m.g;
  goldC += vec3f(1.0, 0.9, 0.6) * sweep * crest * 0.5 * shine;

  // Plate: dark enamel inset with a gold bevelled rim.
  let enamelDark = select(in.params.y, 1.0, in.params.y <= 0.0);
  let pl = lights_shade(in.world, 6.0, pn, 30.0);
  var enamel = vec3f(0.025, 0.018, 0.05) * (pl.diffuse * 2.0 + 0.35) / enamelDark;
  enamel *= 0.85 + 0.15 * engine_noise(in.local * vec2f(40.0, 12.0));
  enamel += pl.spec * 0.15;
  // Thin engraved inner line on the plate.
  let inner = smoothstep(0.02, 0.0, abs(m.a - 0.97)) * plateA;

  var col = vec3f(0.0);
  var a = 0.0;
  // Drop shadow (amethyst-black), under everything.
  let shadowA = m.b * 0.85;
  col = vec3f(0.02, 0.008, 0.04);
  a = shadowA;
  // Plate.
  let plateCol = mix(enamel, goldC, max(rim, inner * 0.6));
  col = mix(col, plateCol, plateA);
  a = max(a, plateA);
  // Text.
  col = mix(col, goldC, textA);
  a = max(a, textA);
  col *= lights_floor(in.world);

  let metal = max(textA, max(rim, inner * 0.6) * plateA);
  let glintK = select(in.params.z, 0.25, in.params.z <= 0.0);
  let glint = (lit.spec * 1.2 + vec3f(1.0, 0.85, 0.55) * sweep * crest * 0.6) * metal * glintK * in.emissive;
  var o: FragOut;
  o.color = vec4f(col, a * in.color.a);
  o.emissive = vec4f(glint, a * in.color.a);
  return o;
}
`;
