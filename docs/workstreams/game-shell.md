# Workstream: game-shell (wave 2)

**Owns:** `games/last-rune/main.ts` (boot wiring), `games/last-rune/game/` (ctx, state, save schema, flow, settings), `games/last-rune/scenes/title/`, `scenes/hall/`, `games/last-rune/ui/` (game-specific DOM panels: codex shell, settings, FUSE caption glue).
**Depends on:** merged engine (platform/core/render/post/fx + input/audio/ui/save), `rules/progression.ts`, `content/*`.

## Deliver
1. **Ctx + boot**: one `GameCtx` (C7) wiring renderer, post, surface, particles, input (bindings for the game's actions), audio (attach + unlock + persisted mixer), ui overlay (`setRect` on resize, input blocked under modals), save store. `main.ts` boots into the Title scene. Keep `?demo=*` dev routes working.
2. **Save schema v1** (engine/save): `ProgressState` from progression.ts plus journal pages found, codex entries seen, settings, stats for the ending (`safetyRecordLine()` in `content/ending.ts` needs play time, breakers tripped, …), per-puzzle in-progress placements. Toast if `persistent === false`. Settings panel: volumes, reduced motion, export/import save, reset progress (confirm).
3. **Flow**: Title → Hall → (Altar puzzle scene: stub; rules-puzzles is still landing the sim, so leave a clean `openPuzzle(machineId)` hook) → Solve moment (stub) → Hall. Continue/new game on the title. Codex reachable from every puzzle (pitch: always), so add a global key/button.
4. **Hall scene (functional, placeholder art)**: alcoves positioned from `content/machines.ts`; states solved / unlocked / locked, with the missing capabilities shown as coloured sockets (`missingFor`). Hover/click → FUSE line (arrive / locked lines from `content/lines.ts`) via the caption card. Conduits between woken machines. Use simple engine sprites/materials. The art agents are building the real gem/stone/FUSE/alcove art in parallel; keep visuals behind a thin `HallView` interface so the art swaps in.
5. **Title scene**: placeholder visuals plus the title line from content, Play/Continue, Settings.
6. **Codex shell** (DOM panel): one page per gem, locked entries show "chained niche + machine that teaches it", FUSE margin notes from `content/lines.ts` (`codex.*`). Styled as a leather tome with CSS only (procedural, no images).
7. **Tests**: save schema and migrations scaffold, flow/state transitions, hall state derivation. Playwright screenshot pass of Title and Hall to verify (see `docs/workstreams/engine-render.md` for the headless WebGPU setup).

## Log
