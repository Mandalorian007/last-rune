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
