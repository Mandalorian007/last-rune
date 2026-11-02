# Workstream: engine-render

**Owns:** `engine/core/`, `engine/render/`, `engine/post/`, `engine/fx/`, `engine/platform/`, `games/last-rune/main.ts` (boot only), a dev demo under `games/last-rune/scenes/_demo/`.
**Contracts:** C5 (render API), C7 draft (scene stack) in `docs/architecture.md`.

## Deliver
1. **platform/**: mount a canvas into `#app`, DPR-aware resize (capped DPR, e.g. 2), 16:9 letterbox around a 1920×1080 logical space, pointer → logical coords helper. WebGPU capability check (`navigator.gpu`, adapter, device) that shows a **styled unsupported screen** (DOM, on-brand dark slate + gold, names Chrome/Edge/Safari) when it fails. Handle device loss (show a message and offer reload). Visibility-change pause.
2. **core/**: game loop (fixed-step update at 60 Hz, variable render, clamp big dt), time, a tiny typed event emitter, and a scene stack implementing the C7 draft (`enter/exit/update/render`, push/pop/replace). No ECS unless it's clearly needed.
3. **render/**: WebGPU device/context wrapper, HDR render target (rgba16float) for the scene, a **2D batch** (instanced quads/sprites with transform, tint, UV, per-instance params), simple **mesh** path, and a **material system**: a material = WGSL module + bind group layout + uniforms. Game code must be able to register custom WGSL materials (gem refraction, storm cell) without editing engine code. Emissive output feeds bloom. Procedural texture helper: create textures from `ImageData`/`OffscreenCanvas` or a compute/fragment pass.
4. **post/**: configurable stack. Bloom (dual-filter/Kawase or mip-chain), height-based volumetric-style floor fog/mist (screen-space is fine), god rays (radial blur from a light point), vignette, colour grade (lift/gamma/gain + saturation), ACES-ish tonemap to the swapchain. Each pass can be toggled, and parameters can be set at runtime.
5. **fx/**: GPU particles (compute-updated, at least 20k sparks at 60 fps), emitters with burst/rate, gravity, drag, colour over life, additive blending into emissive. Light flicker helper (noise-driven intensity) and emissive pulse.
6. **Demo:** `?demo=render` (dev only) shows a dark stone-ish backdrop quad, a few glowing coloured orbs (custom material), floor mist, bloom, god rays from a point, and a spark burst on click. This proves the stack end to end and is the template for wave 2.
7. `engine/render/README.md` and `engine/post/README.md`: API docs with short examples.

## Quality bar
- No per-frame GPU buffer/bind-group allocation in the steady state; pool and reuse.
- Pipelines created once; WGSL compile errors surfaced clearly in dev.
- Unit-test what's testable in Node (loop timing, letterbox math, scene stack). The GPU path is verified with the demo; Playwright smoke is ship-ops' job, but keep the demo route stable for it.
- Zero game nouns in `engine/`.

## Log
_(agent appends progress, decisions, open issues here)_

### 2026-11-02, wave 1 (engine-render agent)
**Done:** platform, core, render, post, and fx are all in, plus `?demo=render`. `pnpm check` (32 tests) and `pnpm build` pass. The dev-only demo is tree-shaken out of the production bundle (8.8 kB JS).

**Verified in headless Chromium (Apple Metal, WebGPU):**
- `?demo=render` runs at 60 fps with 0 GPU validation errors.
- `&sparks=20000` also runs at 60 fps.
- A click burst lands at the clicked logical point, so pointer → logical mapping works.
- Keys 1–5 toggle each post pass.
- An 800×900 viewport letterboxes correctly.
- `?nogpu` (dev) previews the unsupported screen.

**Decisions:**
- The scene pass writes MRT: two rgba16float targets, colour and emissive. Materials write both. The final image is colour + emissive + bloom, so glow is explicit, not threshold luck.
- One pipeline shape serves all quads and meshes: 32-byte vertex + 80-byte instance (xform, rotation/emissive, uvRect, tint, params). Consecutive draws with the same material and mesh merge into one instanced draw. There is no depth buffer; draw order is submission order.
- Material WGSL = engine prelude + the game's `fs_main(VSOut) -> FragOut`. Bindings: group 0 = engine globals, group 1 = material (uniform 0, sampler 1, textures 2+).
- Post: bloom runs on a half-res mip chain. God rays march over a half-res light disc plus a fraction of the bloom. Fog is screen-space and runs inside the composite. Output is sRGB-encoded in-shader to `bgra8unorm`.
- Particles: compute spawn + integrate in a ring buffer (64k by default). The CPU only writes small spawn records each frame. They render as velocity-stretched additive quads into both targets.
- WGSL errors: `createShaderModule` logs `getCompilationInfo` with line and caret. `installGpuErrorLogging` logs `uncapturederror` and counts errors in `gpuDiagnostics`, which the demo exposes as `window.__demo`.

**Open issues / risks:**
- No depth sorting or layers. Wave 2 orders draws by hand, so a layer API may be needed.
- Particles render in a single draw of `capacity` instances; dead ones are culled in the vertex shader. That's fine at 64k, but there's no indirect draw yet.
- Device loss shows the reload screen; there is no automatic resource rebuild.
- Headless WebGPU on macOS needs a full Chrome for Testing binary (`executablePath`) served from `http://localhost`. `about:blank` has no `navigator.gpu`. ship-ops should know this for the Playwright smoke test.
- The demo stone is lit by fake 2D point lights inside a game material. A real lighting helper could move into the engine later if wave 2 wants one.
