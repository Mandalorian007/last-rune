# Workstream: hall-art (wave 3)

**Goal:** the Machine Hall and Title look like the pitch: a storm-lit stone factory hall with 16 alcoves, FUSE rolling about, a sense of place and progress. Plus cleanup so the two art kits are one.

**Owns:** `games/last-rune/scenes/hall/` *views* (`ctx.views.hall`, `ctx.views.title` per `scenes/views.ts`), `games/last-rune/art/hall/`, `games/last-rune/art/title/`, and the reconciliation of `art/props/palette.ts` + lighting with `art/materials` (palette.ts, lights.ts).
**Don't touch:** `scenes/altar/`, `scenes/solve/` (altar-scene is building them), `audio/`, `content/puzzles/`, `rules/`.

## Deliver
1. **Unify art kits:** one gem colour source of truth (`art/materials/palette.ts` `PALETTE_HEX`; props' `GEM_COLOUR`/`PITCH` derive from it), and props' 6-light `PropLightRig` merged with or adapted onto `LightSet` so props and materials share one lighting model in the same scene. Match the reference rig in `docs/design/art-direction.md`. Keep `?demo=art` and `?demo=props` working.
2. **Hall view:** use `content/machines.ts` alcove positions (move alcoves in content if needed for composition; tell the PM). Each alcove is a real `Alcove` prop (locked with capability sockets from `missingFor`, unlocked, restored) with its `Machine` inside; hover/focus is highlighted; the hall darkens and warms with tier/progress (restored machines cast warm light). A storm cell or high windows with lightning, candles, mist and god rays. FUSE (`Fuse` prop) rolls to the hovered/last alcove and talks via the caption portrait (`createFusePortrait` into `ctx.fuse.setPortrait`). Implement `onRestored(machine)` with the alcove `restore()` and unlocking of newly available doors.
3. **Layout fixes from game-shell:** the FUSE caption card currently covers the bottom-right alcove. Fix the composition (caption position in the hall or alcove layout). Keep the HUD clear of alcoves.
4. **Title view:** the title in gold emboss over a storm-lit stone wall, the storm cell, FUSE idle; "Continue/New game/Settings" stay DOM UI.
5. **Reduce flashes setting:** add it to the save settings and settings panel (defaults on when reduced motion is on). The bolt/breaker full-screen whiteout and the storm lightning flashes respect it. Coordinate the field name in your report. game-shell's settings code is in `game/save.ts` and the settings panel. Minimal, additive change.
6. **Perf:** the hall with 16 alcoves + machines + FUSE + storm + candles stays 60 fps. Measure draw calls and report; batch where props share materials.
7. Screenshots `docs/design/screens/hall-*.png` and `title-*.png` (each under ~400 KB) at the start, mid-game (some restored), and near the end. Iterate on them critically.

## Log
