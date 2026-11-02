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
