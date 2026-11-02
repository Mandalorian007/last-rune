/**
 * Bolt ribbon: one additive quad per polyline segment, rotated along it. The ribbon is a
 * jittering lightning filament whose sideways offset is enveloped by sin(pi * s / len), so every
 * joint stays pinned to its node (gem centre) while the middle crackles.
 *
 * Per instance: params = (t0, t1, charge, arcStart px), tint.rgb = segment colour,
 * size = (len + 2 * pad, 2 * pad).
 */

export const BOLT_UNIFORM_FLOATS = 12;

export const BOLT_MATERIAL_WGSL = /* wgsl */ `
struct BoltU { a: vec4f, b: vec4f, c: vec4f };
// a: time, mode (0 exact, 1 over, 2 under), tEnd, intensity
// b: width px, jitter px, seed, flash
// c: fade, reduce flashes (0/1), -, -
@group(1) @binding(0) var<uniform> U: BoltU;

fn jit(x: f32, tick: f32, seed: f32) -> f32 {
  return (engine_noise(vec2f(x * 0.03, tick + seed)) - 0.5) * 2.0
       + (engine_noise(vec2f(x * 0.11, tick * 1.7 + seed + 9.0)) - 0.5) * 0.7;
}

@fragment fn fs_main(in: VSOut) -> FragOut {
  let T = U.a.x;
  let mode = U.a.y;
  let tEnd = U.a.z;
  let k = U.a.w;
  let seed = U.b.z;
  // Reduce flashes: the solve flash and breaker blowout stay local and never white out.
  let calm = U.c.y;
  let flash = U.b.w * mix(1.0, 0.3, calm);
  let t0 = in.params.x;
  let t1 = in.params.y;
  let charge = in.params.z;
  let arc0 = in.params.w;
  let pad = in.size.y * 0.5;
  let L = max(in.size.x - in.size.y, 1.0);
  let q = (in.local - 0.5) * in.size;
  let s = q.x + L * 0.5;
  let after = max(T - tEnd, 0.0);
  let ended = step(tEnd, T);
  let isOver = step(0.5, mode) * step(mode, 1.5);
  let isUnder = step(1.5, mode);

  // How far along this segment the bolt has travelled.
  let u = clamp((T - t0) / max(t1 - t0, 1e-4), 0.0, 1.0);
  let sHead = u * L;
  let vis = smoothstep(sHead + 3.0, sHead - 3.0, s) * step(t0, T);

  // Width from charge; the breaker blows it out, a weak bolt is thin.
  let ch = clamp(charge, 0.0, 6.0);
  var W = U.b.x * (0.55 + 0.3 * sqrt(ch));
  let blow = isOver * ended * exp(-after * 3.5) * mix(1.0, 0.2, calm);
  W *= 1.0 + blow * 1.6;

  // Crackle: re-rolled ~24 times a second, envelope pins the ends.
  let rate = select(24.0, 40.0, isOver * ended > 0.5);
  let tick = floor(T * rate);
  let env = sin(3.14159265 * clamp(s / L, 0.0, 1.0));
  var amp = U.b.y * (0.6 + 0.25 * ch) * (1.0 + blow * 3.0);
  amp = min(amp, L * 0.18 + 2.0);
  let x = arc0 + s;
  let off = jit(x, tick, seed) * amp * env;
  // Capsule distance: beyond the ends the glow rounds off instead of filling the quad.
  let sx = s - clamp(s, 0.0, L);
  let dy = length(vec2f(sx, q.y - off));
  // A thinner second filament that wanders more: reads as a fork.
  let off2 = jit(x, tick + 31.0, seed + 4.0) * amp * 1.6 * env;
  let dy2 = length(vec2f(sx, q.y - off2));

  let core = smoothstep(W * 0.32, W * 0.08, dy);
  let glow = exp(-(dy * dy) / (W * W) * 1.4);
  // Fade to exactly zero at the quad edge so no rectangle ever shows.
  let edge = smoothstep(pad, pad * 0.5, dy);
  let halo = exp(-dy / (W * 1.6)) * 0.22 * edge;
  let fork = smoothstep(W * 0.18, 0.0, dy2) * step(0.55, engine_noise(vec2f(x * 0.02, tick + 3.0)));

  // Brightness along the path: hot near the travelling head, steady behind it.
  var b = 0.8 + 0.6 * exp(-max(sHead - s, 0.0) / 90.0) * step(u, 0.999);
  let headGlow = exp(-pow((s - sHead) / (W * 1.4), 2.0)) * step(0.001, u) * step(u, 0.999);
  b += headGlow * 2.0;
  // Pulse shimmer travelling along the circuit once it's complete.
  b *= 1.0 + 0.18 * sin(x * 0.045 - T * 14.0) * ended;

  // Mode tails.
  // over: violent flash, then the breaker sputters out.
  // 26 Hz strobe, or a steady dim when flashes are reduced.
  let sputterOn = mix(step(0.45, engine_noise(vec2f(T * 26.0, seed))), 0.6, calm);
  let sputter = mix(1.0, sputterOn * exp(-(after - 0.4) * 1.6), smoothstep(0.35, 0.45, after));
  b *= mix(1.0, (1.0 + blow * 4.0) * sputter, isOver * ended);
  // under: weakens as it goes, breaks into dashes, gutters out.
  let gp = clamp(T / max(tEnd, 1e-3), 0.0, 1.0);
  let dash = step(0.3 + 0.35 * gp, engine_noise(vec2f(x * 0.04, tick * 0.5 + seed)));
  let fizz = mix(1.0, 0.35, gp) * mix(1.0, dash, gp * 0.8) * exp(-after * 2.2)
           * (0.6 + 0.4 * step(0.35, engine_noise(vec2f(T * 18.0, seed + 2.0))));
  b *= mix(1.0, fizz, isUnder);
  b *= U.c.x;

  let tint = in.color.rgb;
  let hot = mix(tint, vec3f(1.0, 0.98, 0.95), clamp(0.65 + flash * 0.35 + blow * 0.3, 0.0, 1.0));
  let body = hot * core * 2.2 + tint * glow * 1.1 + mix(tint, vec3f(1.0), 0.5) * fork * 0.9;
  let gain = b * (1.0 + flash * 2.0) * vis * k * edge;
  let col = (body + tint * halo) * gain;

  var o: FragOut;
  o.color = vec4f(col, 1.0);
  // Only the hot body feeds bloom; the halo is already soft.
  o.emissive = vec4f(body * gain * in.emissive, 1.0);
  return o;
}
`;
