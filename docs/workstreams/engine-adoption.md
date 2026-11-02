# Workstream: engine-adoption (wave 4)

**Goal:** game code uses the engine APIs that engine-cleanup added, and the workarounds go away, with no visible regressions except where things get smoother (for example, the ending's eased post transitions).

**Owns:** `games/last-rune/scenes/ending/`, `games/last-rune/art/props/` (storm, bolt, fuse, other props), `games/last-rune/art/materials/`, `games/last-rune/ui/hud.ts`, `games/last-rune/game/ctx.ts` (Input options only), `games/last-rune/audio/render.ts`.
**Don't touch:** `scenes/altar/` (altar-clarity), `scenes/hall/` and `art/hall/` (hall-floor), `tests/e2e/` apart from `ending.spec.ts` (full-run), `engine/` (ask the PM if an engine API is missing).

## Deliver
Take the items from PLAN.md, "Engine adoption":
1. **Ending:** replace the white and dark washes that hide preset swaps with `post.blendTo`, so bloom and grade ease (for example, as the door opens). Keep a wash only where the story wants one, and keep Reduce flashes behaviour (`ctx.settings.reduceFlashes`). Also fix two polish items:
   - add a darker backing behind the credits over the gold flood;
   - tame the door's hot bloom over the disc centre so the Builder's mark stays readable.
2. **`storm.ts`:** use `renderer.createPingPong`, and make `destroy()` free its material.
3. **Shared material:** move bolt, storm and fuse onto one shared `perDrawUniforms` material where it reduces materials or draws without hurting clarity. Measure the result; if it doesn't pay off, document why and skip it.
4. **Textures:** the emboss and mask textures use `textureFromPixels` or `{ linear: true }` wherever the data isn't colour.
5. **Input:** pass `globalKeys: ['KeyC','KeyO']` and drop the HUD-button blur workaround.
6. **`audio/render.ts`:** import `OfflineContextFactory` from `@engine/audio`.
7. Your own scenes and props call `fuse.destroy()` and other cleanup on exit. List any that live in hall or altar files for the PM.

Before/after checks:
- `?demo=art`, `?demo=props`, the hall and the ending stay at 60 fps;
- draw counts;
- before/after screenshots of the ending beats (door, flood, credits).

`pnpm check`, `pnpm build` and `pnpm test:e2e` must pass.

## Log

### 2026-11-02: engine-adoption pass (agent)
1. **Ending, done.**
   - Every post change after arrival is a `post.blendTo`: door 3.8 s, through 4.5 s, chat 1.6 s, flood 3 s (5 s with Reduce flashes).
   - Arrival stays a hard `set` because the view itself cuts from the solve scene.
   - The white-out (through) and the white-to-dark chat wash stay because the story calls for them.
   - `skip()` calls `finishBlend()` and then sets the flood look. `exit()` calls `finishBlend()` and `fuse.destroy()`. The ending's `Fuse` was previously leaked on every run.
   - Door: the shader cuts the mark out of the disc core and the aperture light, which is also dimmer. The door body thins over the disc centre, and `DOOR_POST` eases bloom, god rays and fog down. The mark now reads at the door and edge beats.
   - Credits and the end-card footer get a radial dark backing that fades in.
2. **`storm.ts`, done.** It uses `createPingPong` instead of two targets plus a `copyTextureToTexture` per frame. `destroy()` now frees the material too.
3. **Shared `perDrawUniforms` material, skipped.** Measured draws are 6 (props demo), 12 (hall) and 16–17 (ending), so there is nothing to win:
   - Bolt is additive while storm and fuse are premultiplied, and the three use different WGSL. One material would need an uber-shader and a blend mode none of them wants.
   - Storm also needs its own sim texture per instance.
   - A per-draw block breaks batching, so a bolt's segments would go from shared-material sprites to one draw each.
   - Fuse and storm have one instance per scene, so sharing saves no pipelines.
   - Added `BoltRibbon.destroy()` so owners can free ribbons.
4. **Textures, done.** The emboss mask uses `textureFromPixels` (linear `rgba8unorm`). The stone normal map was already linear (`textureFromShader`, `rgba8unorm`). No other data textures came up from `getImageData` or `textureFromSource`.
5. **Input, partly done.** `globalKeys: ['KeyC','KeyO','KeyJ']` is set in ctx.ts (J added because the Journal button is there too). The HUD blur stays, with its comment rewritten. `ui.stack` hands focus back to the opener on close, so without the blur a closed Codex would leave the HUD button focused. Input then ignores arrows, Enter and Space, and Enter/Space would click the button again: a keyboard regression in the hall and the altar.
6. **`audio/render.ts`, done.** It imports `OfflineContextFactory` from `@engine/audio`. Nothing imported the local alias.
7. **Cleanup.** The ending now destroys its fuse. Hall and altar fuses and bolts live in per-renderer caches and are reused, so they are not leaks. For their owners:
   - `scenes/altar/solve-scene.ts:147` and `altar-scene.ts:247` still say `particles.clear()` is broken; it can be called now.
   - The altar asset cache could call `BoltRibbon.destroy()` if it ever drops the cache.

Perf (Chromium, 1280×720, 300 frames). Every page holds 60 fps with p95 at 16.7–16.8 ms, before and after:

| Page | Draws before | Draws after |
|---|---|---|
| `?demo=art` | 10 | 10 |
| `?demo=props` | 6 | 6 |
| hall | 12 | 12 |
| ending door | 17 | 17 |
| ending flood | 16 | 16 |
