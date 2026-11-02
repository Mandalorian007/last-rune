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

### 2026-11-02 — shell landed (branch `worktree-agent-aaca8cac53ea8daeb`)
**Done:** all seven deliverables. `pnpm check` (186 tests) and `pnpm build` pass. A Playwright click-through passes: Title → Play → Hall → hover an alcove (name plate + FUSE caption) → C opens the codex, Esc closes it → the HUD codex button opens it, × closes it → click the Intake Desk → puzzle stub → Restore → solve stub → Continue → Hall with the desk solved and four doors open → settings → reload shows Continue. No console errors. `?demo=render` and `?nogpu` still work.

**Layout**
- `game/save.ts`: schema v1 (`SaveV1`), `MIGRATIONS` scaffold (empty), `repairSave`, `newGameData` (keeps settings).
- `game/flow.ts`: `GameFlow` owns every transition and progress write. The flow is unit-tested against a fake stack.
- `game/ctx.ts`: `createGameCtx` wiring. `game/actions.ts`: bindings. `game/settings.ts`: reduced motion and caption speed.
- `scenes/hall/hall-state.ts`: pure derivation (alcoves, missing sockets, conduits, hit-testing, FUSE line choice).
- `scenes/hall/hall-scene.ts`, `scenes/title/title-scene.ts`, `scenes/stubs/{puzzle,solve}-stub.ts`.
- `scenes/views.ts`: the `HallView`/`TitleView` seams. `scenes/placeholder/*` holds the SDF stand-ins.
- `ui/`: `fuse.ts` (caption glue plus the portrait swap point), `codex.ts` + `codex-data.ts`, `settings-panel.ts`, `hud.ts`, `styles.ts` (all CSS, procedural).

**Hook points**
- Altar: in `main.ts` `SCENES.puzzle = (id) => new AltarScene(id)`. Its contract is in the header of `scenes/stubs/puzzle-stub.ts`:
  - `flow.placementsFor` and `flow.savePlacements`
  - `flow.recordAttempt(id, outcome)` (`'over'` counts a tripped breaker)
  - `flow.completePuzzle(id)` (exact charge)
  - `flow.closePuzzle()`
- Solve moment: `SCENES.solve = (moment) => new SolveScene(moment)`. It gets a `SolveMoment {machine, grants, unlocked, pages, firstTime, complete}` and calls `flow.finishSolve()`. The hall view gets `onRestored(machine)` on return.
- Art:
  - The hall and title swap through `ctx.views.hall` / `ctx.views.title`, which are factories of `(ViewContext) => HallView | TitleView`. The scene keeps input, hit-testing and FUSE; the view only draws `HallViewFrame {model, hover, focus, time, reducedMotion}`.
  - The FUSE portrait swaps through `ctx.fuse.setPortrait(factory)`.

**Decisions**
- Volumes live in the `persistMixer` slot, not in the save, so a progress reset or import never touches audio.
- Puzzle and solve are transparent scenes pushed over the hall, so the hall keeps rendering underneath. Solve *replaces* the puzzle; popping it returns to the hall.
- The global keys are C for the codex and O for settings. Both are ignored while a modal is open, and FUSE hushes when either panel opens because the caption layer sits above panels.
- The HUD is stacked in the top-left corner, the only wall area the alcove layout leaves clear.
- Play time accumulates in the flow. It is committed on hide/pagehide and on each solve.

**Open issues / requests**
- **Content:** the codex rule and maths copy in `ui/codex-data.ts` is PROVISIONAL, taken from the pitch gem list. It needs an owner, probably `content/codex.ts` next to `codexNote`.
- **Engine gap:** `Input` ignores keys whose target is a focused button or input, so global shortcuts die after a panel restores focus to a button. Mitigated here by blurring HUD buttons after a click. A clean fix would be an opt-in `globalKeys` set in Input.
- **Engine gap (minor):** `SceneStack` takes its ctx only at construction, so the ctx object is built empty and filled with `Object.assign`. A `setContext` or a lazy getter would be cleaner.
- **Layout:** the bottom-right alcove sits under the FUSE caption card (bottom-right corner). Either the alcove layout in `content/machines.ts` moves, or the caption corner switches to bottom-left while in the hall.
- The ending scene is not built. The flow toasts on `complete`.
