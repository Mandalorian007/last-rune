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
