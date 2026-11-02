# Workstream: altar-scene (wave 3, M2 critical path)

**Goal:** the core loop becomes *playable and satisfying*: walk up to a machine, solve its altar puzzle with real gems and real lightning, and get a solve moment worth the effort.

**Owns:** `games/last-rune/scenes/altar/`, `games/last-rune/scenes/solve/`, wiring in `main.ts` (`SCENES.puzzle`, `SCENES.solve` only), `docs/design/altar-ux.md`.
**Uses:** `rules/` (simulate + render trace, validatePlacement, PUZZLES/puzzleFor), `art/materials` (AltarSlab, GemRenderer, LightSet, candles, emboss, POST_PRESETS), `engine/*`, the game-shell flow contract (`scenes/stubs/puzzle-stub.ts` header), and the audio API from audio-design once merged (call through `ctx.sfx` until then).
**Coming soon (art-props, in flight):** storm cell, bolt ribbon, machine gauge, FUSE portrait. Build simple placeholder versions behind small interfaces so the real props drop in.

## Deliver
1. **Altar scene:** board on the AltarSlab, tray of gems the player owns (per the puzzle's tray), pre-set gems fixed and visibly locked. Interactions: drag or click-to-place, rotate (click/scroll/R), pick up, clear board, undo. Keyboard and gamepad are playable through the input action map (cursor over sockets). Illegal sockets give feedback (validatePlacement).
2. **Strike:** a "Strike" action fires the storm. Animate the render trace as a lightning ribbon that takes each gem's colour, travelling in time order (t0/t1); gems energise as the bolt passes. Multi-strike puzzles show strike count and capacitor charge. Machine gauge shows charge vs need and the outcome: under (sputter, gauge short), exact (wake), over (breaker trips: dramatic, funny, never punishing), dead (fizzle where the circuit broke, which is shown on the board). Fast-forward/skip for repeat strikes.
3. **Feedback that teaches:** after a failed strike the player can see *where* it went wrong (the fizzle cell, the over-charged machine). FUSE reacts with existing lines where available (`content/lines.ts`); report any line gaps to the PM rather than writing story text.
4. **Flow hooks:** persist placements (`flow.savePlacements`) so leaving and returning keeps the board; `recordAttempt(id, outcome)` every strike; `completePuzzle` on exact; back to hall (`closePuzzle`). Expose a dev-only, local-only event hook (`onPuzzleEvent`) for difficulty-fun's Phase 2 metrics (time, attempts, resets, outcomes).
5. **Solve moment** (`SCENES.solve`): the machine wakes (light floods the alcove, particles, bloom swell, chime stack), the granted gem/capability is presented ("New gem: Split" with its codex line), and journal pages found are announced. Short (~4–6 s), skippable, `prefers-reduced-motion` aware. `firstTime` vs replay variations.
6. **Juice:** gem lift/settle easing, subtle camera shake on strike (off in reduced motion), sockets hum when the right gem hovers. Stay at 60fps on the stress budget (see `art/materials/README.md`).
7. **Tests:** unit tests for the board state model (place/rotate/undo/serialise, pure TS where possible) and a Playwright e2e that solves `intake-desk` and `furnace` end to end in the production build using solver solutions, asserting the save updates.

## Log

- **2026-11-02: playable altar and solve moment** (`8665963`, `d723bd4`, and this commit).
  - `SCENES.puzzle` is now `AltarScene` and `SCENES.solve` is now `SolveScene`, replacing the stubs.
  - All 16 puzzles open, build and solve through the altar (scripted check on the dev build).
  - The e2e `tests/e2e/altar.spec.ts` solves intake-desk and then furnace by keyboard on the production build and asserts the save.
- **First-time clarity pass (PM priority):**
  - While a gem is held, every socket that will take it hums.
  - Hovering or holding a tray gem shows its rule, taken from the codex.
  - On the first altar the teach socket pulses, the tray gem bobs, and FUSE nudges once if the player is idle.
  - Need labels sit next to their gauges, and the verdict names the machine and both numbers.
  - The title and verdict move aside when a north gauge would sit under them.
  - The FUSE caption keeps the bottom-right corner, below the board.
  - UX notes are in `docs/design/altar-ux.md`; screens are `docs/design/screens/altar-*.png`.
- **Line gaps for the PM:**
  - No FUSE line covers an exact solve on the altar itself (the solve scene shows the codex line).
  - No teaching or idle-nudge line exists. `TEACH_NUDGE` in `altar-scene.ts` is placeholder instruction text.
- **Engine issue:** `ParticleSystem.clear()` writes to a buffer created without COPY_DST, so the altar does not call it.
