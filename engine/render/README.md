# engine/render

A raw WebGPU 2D renderer: HDR scene targets, instanced quads and meshes, and materials that
take custom WGSL. It has no runtime dependencies.

## Frame model

```
beginFrame(time, dt) → Frame
  frame.sprite / frame.mesh / frame.drawable   (record only; nothing hits the GPU yet)
endFrame()
  1. write globals + all instance data (one writeBuffer each)
  2. pre-passes, then drawable.prepare() (compute, uploads); each runs once per frame
  3. scene pass → two rgba16float targets: colour (@location 0) and emissive (@location 1)
  4. renderer.post (e.g. PostStack) or the built-in present pass → swapchain
  5. submit
```

- **Logical space** is 1920×1080 by default, with the origin at top-left and y pointing down.
  `renderer.camera` holds `{ x, y, zoom, rotation }`.
- **Draw order is submission order.** There is no depth buffer. Consecutive draws that use
  the same material and mesh merge into one instanced draw call, so draws batch best when
  grouped by material.
- **The emissive target feeds bloom.** Anything written to it glows. The final image is
  colour + emissive + bloom.
- In steady state the renderer allocates nothing per frame. The instance buffer doubles in
  size when it runs out of room. Reuse your `DrawParams` objects.

## Setup

```ts
import { boot } from '@engine/platform';
import { Renderer, installGpuErrorLogging } from '@engine/render';
import { PostStack } from '@engine/post';

const res = await boot(document.getElementById('app')!, { title: 'My Game' });
if (!res.ok) return; // unsupported screen already shown
installGpuErrorLogging(res.gpu.device);
const renderer = new Renderer(res.gpu); // 1920×1080 logical
renderer.post = new PostStack(renderer);
res.surface.onResize(({ backbuffer }) => renderer.resize(backbuffer.width, backbuffer.height));
```

## Drawing

```ts
const dp: DrawParams = { x: 960, y: 540, w: 200, h: 200 }; // quad: x,y = centre, w,h = size
const frame = renderer.beginFrame(time, dt);
frame.clear(0, 0, 0);
frame.sprite(null, dp);                       // default sprite: white texture × tint
dp.tint = hex('#3fe0ff', 2); dp.emissive = 1; // HDR tint, glows
frame.sprite(spriteMat, dp);
frame.mesh(myMesh, myMat, dp);                // custom geometry, same instance params
frame.drawable(particles);                    // anything implementing Drawable
renderer.endFrame();
```

`DrawParams` fields: `x, y, w, h, rotation` (radians, clockwise), `tint` (linear RGBA),
`uv` (u0, v0, u1, v1), `params` (a free vec4 passed to your shader), and `emissive`.

## Custom materials

A material is your WGSL fragment shader plus an optional uniform block and textures. The
engine prepends a prelude that provides:

- `globals`: `viewProj`, `logicalSize`, `targetSize`, `time`, `dt` at `@group(0) @binding(0)`
- noise helpers: `engine_hash21`, `engine_hash22`, `engine_noise`, `engine_fbm(p, octaves)`,
  `engine_luma`
- `VSOut { clip, uv, local, color, params, world, emissive, size }`, where `local` is 0..1
  across the quad and `world` is the logical position
- `FragOut { color: @location(0), emissive: @location(1) }`
- the default vertex shader `vs_main`

You write `@fragment fn fs_main(in: VSOut) -> FragOut`. Your own bindings go in `@group(1)`:
`binding(0)` is the uniform block, `binding(1)` the sampler, and `binding(2 + i)` texture i.

```ts
const orb = renderer.createMaterial({
  label: 'orb',
  blend: 'alpha',            // 'alpha' | 'premultiplied' | 'additive' | 'opaque'
  uniformBytes: 16,          // optional
  textures: 1,               // optional
  sampler: 'linear-clamp',   // 'linear-repeat' | 'nearest-clamp'
  wgsl: /* wgsl */ `
    @group(1) @binding(0) var<uniform> u: vec4f;
    @group(1) @binding(1) var samp: sampler;
    @group(1) @binding(2) var tex: texture_2d<f32>;
    @fragment fn fs_main(in: VSOut) -> FragOut {
      let r = length(in.local * 2.0 - 1.0);
      var o: FragOut;
      o.color = vec4f(in.color.rgb, 1.0 - smoothstep(0.95, 1.0, r));
      o.emissive = vec4f(in.color.rgb * in.emissive * (1.0 - r), o.color.a);
      return o;
    }`,
});
orb.setUniforms(new Float32Array([1, 0, 0, 0])); // queue.writeBuffer; call whenever
orb.setTexture(0, someTexture);                   // bind group rebuilt lazily, only on change
```

A material can also override the vertex stage with `vertexEntry`. Use `engine_vertex(v)`
inside it to keep the standard transform.

## Textures

- `renderer.createTexture(desc)` and `renderer.createRenderTarget(desc)`
- `renderer.textureFromSource(ImageBitmap | ImageData | OffscreenCanvas | HTMLCanvasElement)`
- `renderer.textureFromShader({ width, height, wgsl, uniforms? })` runs a WGSL
  `fn shade(uv: vec2f) -> vec4f` once into a texture. Use it for procedural stone, noise,
  and glyphs. The default format is `rgba8unorm-srgb`, and `shade` returns linear colour.
- `renderer.createSpriteMaterial(texture, label, { blend, sampler })`
- Colour helpers: `hex('#rrggbb', intensity)` returns linear RGBA; also `rgba`, `scaleRgb`,
  `srgbToLinear`, `linearToSrgb`.

## Lower-level pieces

- `renderer.createFullscreenPass({ label, wgsl, targets, blend, uniformBytes, textures })` is
  the building block for post effects. It uses `vs_fullscreen` with `FullscreenIn { pos, uv }`.
- `renderer.createMesh({ vertices, indices })`. A vertex is `pos.xy, uv.xy, color.rgba`
  (8 floats). `mesh.update()` replaces the data.
- `Drawable { prepare?(encoder, frame); draw(pass, frame) }` lets you run your own pipelines
  inside the scene pass. Build them with `layout: [renderer.globalsLayout, yours]` and
  `targets: renderer.sceneFormats`.
- `frame.prePass(fn)` runs before the scene pass, for things like render-to-texture.

## Diagnostics

- `createShaderModule` logs every WGSL compile message with its line and a caret pointing at
  the problem.
- `installGpuErrorLogging(device)` loudly logs `uncapturederror` events. The errors also
  collect in `gpuDiagnostics.errors` and `gpuDiagnostics.errorCount`, which headless tests
  can check.
- `renderer.stats` reports `{ drawCalls, instances, drawables }` for the last frame.
