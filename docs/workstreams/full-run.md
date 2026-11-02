# Workstream: full-run (wave 4)

**Goal:** prove the whole game can be played start to finish, and give the PM a real defect list from the player's point of view before the alpha.

**Owns:** `tests/e2e/full-run.spec.ts`, `tests/e2e/helpers.ts` (additive), `scripts/playtest/` (new), `docs/design/playtest-report.md` (new).
**Don't touch:** game code. You report bugs; you don't fix them. The exception is a one-line testability hook, which you propose to the PM first.

## Deliver
1. **Full-run e2e:** production build, real input only (keyboard and mouse, no dev handles, no save seeding). Go title → hall, then for each machine in the progression order the hall unlocks, open its altar, place the solver's intended solution, strike, and pass through the solve moment. Assert the save after each puzzle and assert that all 16 end solved. Each test must stay under about 5 minutes, so split it into several tests if needed. The ending belongs to story-scenes, which is still in flight: stop at the last solve and leave a clearly marked hook for the ending.
2. **Reliability:** wait on game state (frames, DOM, save), not wall-clock sleeps. Input collapses repeat taps of a key within one tick, so see the `press()` helper in `altar.spec.ts`. Run the suite 3 times in a row and report any flakes.
3. **Player-eye report** (`docs/design/playtest-report.md`): screenshots at key beats, and for each puzzle the time to solve it by hand from intended placements, strike duration, any confusing moment, overlapping UI, text that's cut off or covered, console warnings, fps drops, and progression dead ends. Rank the findings by player impact. This is the input for the alpha.
4. `pnpm check`, `pnpm build` and `pnpm test:e2e` must pass.

## Log

**2026-11-02: done.**
- `tests/e2e/full-run.spec.ts`: a serial run in one page.
  - It goes from the title (Enter on Play) to the hall. For each machine it presses ArrowRight until the nameplate names the machine, then Enter. It keys in the intended solution (Digit1-6 picks, R turns, arrows move, Enter places) and polls the save until all the placements are there. Then F to strike, assert the verdict ("Exactly right"), wait for the solve card and Continue, and assert the save: solved order, attempts == 1, and journal pages.
  - The play order is the greedy front-first open machine, derived from `progression.ts`. It's split into 4 chunk tests, each about 45-75 s. A final test checks all 16 machines are solved and that the save survives a reload plus Continue.
  - The ending is a marked `ENDING HOOK (story-scenes)` and a `test.fixme`. For the last rune the spec accepts either the hall HUD or a region named "Ending".
- Waits are on rAF frames, the DOM and `localStorage` only. No sleeps. Every key press waits 3 frames, so input never collapses repeat taps.
- Playtest mode (`PLAYTEST_OUT=<dir>`) takes screenshots at each beat at 1280x720 and 960x540, runs a DOM overlap/clip audit, records frame times during the strike, and writes `metrics.json`.
  - `scripts/playtest/summarize.mjs` turns that into tables.
  - `scripts/playtest/explore.spec.ts` (with its own config) covers off-script beats: locked door, settings, empty and partial strikes, idle.
- **Shared file touched:** `playwright.config.ts`. The ports are now env-overridable (`E2E_PREVIEW_PORT`, `E2E_ITCH_PORT`), with the defaults unchanged. Fixed ports plus `reuseExistingServer` had my run testing another worktree's build. I recommend each parallel agent sets unique ports.
- `tests/e2e/helpers.ts` (additive): port env vars, `SAVE_KEY`, `readSave`, `waitFrames`, `pressKey`.
- **Testability hook:** none needed.
- **Reliability:** I ran the full `pnpm test:e2e` 3 times in a row on private ports. All 3 passed with 0 flakes: 14 passed and 1 fixme each, wall time 234 s, 236 s and 228 s including the build. The full-run chunks took about 44 s, 48 s, 66 s and 72 s.
- **Report:** `docs/design/playtest-report.md`, with screenshots in `docs/design/screens/playtest/`. The top issues are the FUSE caption covering altar readouts and truncating its own text, and carved and open sockets being hard to tell apart on the big boards.
