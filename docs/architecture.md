# Architecture

Based on pitch §6, reshaped by D-041 (Phase 1, ws/workspace). The repo is a pnpm workspace: the root package is the game and its tooling, and the engine is the workspace package `@thunderclap/engine` that the game depends on (`workspace:*`). Its contracts and the planned target are in [packages/engine/ARCHITECTURE.md](../packages/engine/ARCHITECTURE.md).

```
packages/engine/        # @thunderclap/engine. Knows NOTHING about gems/machines/FUSE.
  package.json          # "exports" map = the public API (./audio, ./core, ... ./ui, ./testing)
  ARCHITECTURE.md       # contracts, today vs planned
  CHANGELOG.md
  src/
    core/               # loop (fixed-step update + render), time, events, ecs-lite (only if needed)
    render/             # WebGPU device/context, sprite+mesh batch, material system, render targets
    post/               # bloom, volumetric fog, god rays, vignette, colour grade
    fx/                 # GPU particles, trails, light flicker, emissive pulse
    input/              # pointer, keys, gamepad → action map (bindings supplied by the game)
    audio/              # WebAudio buses (master/music/sfx/ui), one-shots, loops, synth helpers
    ui/                 # DOM overlay stack, panels, buttons, toasts, theme tokens (CSS vars)
    save/               # versioned localStorage slots + migrations
    platform/           # canvas mount, DPR/resize, letterbox, WebGPU capability check, itch boot
games/last-rune/
  rules/                # gems, charge sim, solver, capability graph (PURE TS, no DOM/GPU)
  content/              # machines.json, lines.json, journal/, puzzles/
  scenes/               # title, hall, altar, solve, codex, journal, ending
  art/                  # procedural generators: stone, gems, FUSE, parchment
  shaders/              # WGSL: storm cell, gem refraction, etc.
  main.ts
```

## Rules

1. **Promotion rule:** code goes in `packages/engine/` only if this game uses it, the next game plausibly would, and its API has **zero game nouns**. If it says "gem" or "machine", it stays in `games/last-rune/`.
2. **Dependency direction:** `games/*` → `@thunderclap/engine`. Never the reverse. `games/last-rune/rules/` imports nothing from the engine or the DOM. It must run in Node for tests and the solver.
3. **Imports:** the game reaches the engine only through its exports map, `@thunderclap/engine/<module>` (e.g. `@thunderclap/engine/render`); there is no `@engine/*` alias any more. Inside the engine, modules import each other by relative path. `@game/*` is the game's alias (`tsconfig.json`, `vite.config.ts`). `pnpm check:boundaries` (`scripts/check-boundaries.mjs`, part of `pnpm check`) enforces all of this plus rule 2.
4. **Data-driven content:** machines, puzzles, lines and journal entries are JSON/TS data validated by tests, not hardcoded in scenes.
5. **No runtime frameworks** (D-008). Runtime deps need PM approval and a DECISIONS entry.

## Cross-workstream contracts

### C1 · Game vocabulary: `games/last-rune/rules/types.ts` (PM-owned)
`GemKind`, `Capability`, `MachineId` (the 16 ids), `AltarSize`, `StormStrength`, `Dir`, `Cell`. Only the PM changes this file.

### C2 · Rules API: `games/last-rune/rules/index.ts` (owned by rules-puzzles)
Must export at minimum:
- `PuzzleDef`: serialisable puzzle (altar size, blocked cells, storm cell position/direction/strength, machine target(s) with required charge, fixed/pre-placed gems, gem allowance).
- `Placement`: `{ gem: GemKind; cell: Cell; rot: 0|1|2|3 }`.
- `simulate(puzzle, placements): SimResult`. Deterministic and pure. `SimResult` includes `outcome: 'dead' | 'under' | 'exact' | 'over'` (per target and overall) and a **render trace**: ordered segments `{ from: Cell; to: Cell; charge: number; colour: GemKind; pulse: number; t0: number; t1: number }` so scenes can animate the bolt as a ribbon that takes each gem's colour.
- `solve(puzzle, opts?)`: finds solutions (used for tests, hints, and the automated playtest).
- `validatePlacement(puzzle, placements, cell, gem)`: legality for UI.

### C3 · Progression API: `games/last-rune/rules/progression.ts` (owned by progression-content)
- `MachineDef`: `{ id: MachineId; name; tier; requires: Capability[]; grants: Capability | null; puzzleId; alcove: { x; y } }`.
- `ProgressState`: `{ solved: MachineId[]; ... }` (serialisable, it goes into the save).
- `capabilitiesOf(state)`, `isUnlocked(machine, state)`, `missingFor(machine, state): Capability[]` (drives the "empty sockets" on locked doors), `availableMachines(state)`.
- Invariant (tested): from every reachable state before the end, **at least two machines are unlocked and unsolved** (pitch: "Always a choice"), except where the pitch forces otherwise (the finale).

### C4 · Content: `games/last-rune/content/` (owned by progression-content)
- `machines.json` (or `.ts`): the 16 `MachineDef`s.
- `lines.ts`: FUSE lines keyed by `{ machineId, kind: 'arrive' | 'solve' | 'locked' }` plus special beats (title, tarp, ending beats, post-credits). Text verbatim from the pitch where the pitch has it. Each line ≤ 20 words (tested). Count of "I" per tier must increase (tested).
- `journal.ts`: 16 Builder pages with `{ page; tier; unlockedBy: MachineId; text }`.
- `puzzles/`: owned by **rules-puzzles**: one `PuzzleDef` per machine, filename `<machineId>.ts`.

### C5 · Engine render API (owned by engine-render)
A small, documented surface in `packages/engine/src/render/README.md`: create renderer on a canvas, frame begin/end, draw sprites/quads/meshes with materials (custom WGSL allowed for game shaders), emissive channel for bloom, render-target management, post stack config (bloom, fog, god rays, vignette, grade), particle emitters. A game shader must be able to plug in as a material without touching engine code.

### C6 · Engine systems API (owned by engine-systems)
`@thunderclap/engine/input` (action map), `/audio` (buses, synth one-shots), `/ui` (overlay stack mounted over the canvas, theme tokens), `/save` (versioned slots, migrations, quota/blocked-storage safe); sources in `packages/engine/src/<module>/`. Each module has a README with usage.

### C7 · Scene contract (adopted, as built by engine-render)
`Scene<Ctx, Frame>` in `@thunderclap/engine/core`: `enter(ctx)`, `exit()`, `pause()`, `resume()`, `update(dt)` (fixed 60 Hz), `render(frame, alpha)`, `transparent` flag (overlays render over the scene below). `SceneStack` ops (`push/pop/replace/clear`) are deferred while updating/rendering. One shared game `Ctx` holds `renderer`, `post`, `surface`, `particles` + engine-systems' `input`, `audio`, `ui`, `save`. Template: `games/last-rune/scenes/_demo/render-demo.ts`. Draw order = submission order (no depth); scenes order their own draws.

## Runtime shape
- Logical design space **1920×1080**, letterboxed 16:9 into whatever the iframe gives us (itch embed 960×540 + fullscreen). Render at device pixel ratio, capped for perf.
- World is drawn in WebGPU; text and UI are DOM overlay (D-009).
- Fixed-step simulation, variable render. Respect `prefers-reduced-motion` (trim particles, shake, flicker).
