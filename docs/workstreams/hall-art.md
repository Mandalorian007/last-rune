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

### 2026-11-02: delivered (branch `worktree-agent-a16dfe74293bf6f3a`)
- **art:** one palette (`art/materials/palette.ts` `PALETTE_HEX` is the source; props' `GEM_COLOUR`/`PITCH` derive from it) and one light set (props read `LightSet` data via `PROP_COMMON_WGSL`'s `prop_light`). `?demo=art` and `?demo=props` still work.
- **settings:** `reduceFlashes` added to save settings (`'auto' | 'on' | 'off'`, default `'auto'` follows reduced motion), with a settings-panel toggle. The effective boolean is `ctx.settings.reduceFlashes`. `BoltRibbon`/`StormCell` take `reduceFlashes`: no full-frame whiteouts, and lightning is softened and capped. **altar-scene:** read `ctx.settings.reduceFlashes` each frame, set it on bolt and storm, and skip any full-screen flash of your own.
- **hall:** three tiers of alcoves around the Last Rune seal (960,540), two storm windows with lightning (thunder sfx synced, `doorUnlock` on unlock), candles, mist, god rays (960,540, no source blob), cyan conduits between restored machines, and FUSE rolling to the hovered alcove. Mood darkens outside and warms inside with progress. `onRestored` restores the alcove and opens newly unlocked doors.
- **layout:** the alcove positions in `content/machines.ts` moved to a 6-column, 3-tier grid (y 170/415/660, intake-desk alone on the floor at 960,930), so the caption card and HUD buttons sit over empty wall or floor.
- **title:** a storm-lit wall, the name in gold emboss on canvas, the storm cell and an idle FUSE. The menu stays DOM.

### 2026-11-02: user feedback, "machines read as plain boxes"
- New `shaders/hall-machine-shaders.ts`: one material, 15 distinct procedural silhouettes (`HALL_MACHINE_KINDS` in content order): an intake desk with pigeonholes, a brick furnace with chimney and glowing mouth, a splitter mill with hopper and gear, a lattice relay mast with beacon, an inclined conveyor with crates, a numbered press, a Tesla storm cell, a tower crane with jib and swinging crate, a boiler with pipes and gauge, archive shelves, a foundry crucible, a capacitor bank, a lift-shaft cage, a roof solar array, and a control booth with an operator in the window. The generic `Machine` prop is no longer used in the hall; the class is unchanged.
- State clarity, all in that shader: **locked** is drained and dark behind the grate and padlock (cut out of the machine so the grate stays in front); **available** is a gold silhouette with a slow pulse halo, and the pool beckon is stronger; **restored** is fully lit, warm back-glow, animated (fires, gears, beacons, steam) and frozen under reduced motion. The name plate shows on hover or focus (existing HUD plate).
- Perf: hall 11-12 draw calls, about 120 instances, 60 fps (p95 16.8 ms); title 9 draw calls, 60 fps. Same draw-call count as before, since the machine batch replaces the old one. No per-frame allocation (params are a per-slot `Float32Array`; the uniform buffer is reused).
- Screens: `docs/design/screens/hall-before-mid.png` (old boxes), `hall-start.png`, `hall-mid.png`, `hall-end.png`, `hall-hover.png`, `title-new.png` and `title-return.png`.

### Open / follow-ups
- Floor flavour (pipes and cables along the wall base, crates, rails, steam vents, hanging lamps, puddles that catch lightning): not done. Plan: one batched `hall-floor-props` material, about 1 draw call.
- Available silhouettes are flat gold. Possibly show a faint lit interior instead.
- Engine gaps: no per-instance uniforms (all per-instance state goes through `params`/`tint`), and `Fuse` has no `destroy()`.
