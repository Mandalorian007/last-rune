# Workstream: tidy-2

Small leftovers from wave 5 (PM judgement).

## Scope
1. **Device lost:** stop the game loop, audio and timers while the "lights went out" dialog is up (bug-bash #16). Engine-side; no game nouns. Add a unit or e2e test.
2. **FUSE's clipboard drop on the ending:** it now travels ~290px right of his clamp to its resting spot (finish-1), and at fall speed it reads as a toss. Make the fall arc look natural: release nearer, a slight drift, or FUSE moves toward the spot first. Keep the resting position.
3. **Audio synth in a Worker (optional; do it only if it's clean):** the longest load tasks are 40–80 ms single-sound syntheses (perf-low). If synthesis can move to a Worker without restructuring the bank API, do it, and measure with `PERF_LOAD=1`. Otherwise leave a short written proposal.
4. **Lone flakes:** look into the rare unit-test flake in `pnpm check` (bug-bash) and the link-copy "gamepad A on Ko-fi with the new tab blocked" e2e flake (candle-light run). Fix the root cause if you can find it.

Out of scope:
- UI wording and layout (newcomer-2).
- Puzzles.
- Lighting.

## Done when
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass, and the full e2e suite passes 3 times in a row.

## Log
