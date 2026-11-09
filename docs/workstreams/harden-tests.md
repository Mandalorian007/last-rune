# Workstream: harden-tests (first-release hardening, D-053)

Branch `ws/harden-tests`. PM merges. Scope: test-suite truth and dev-console noise after the engine 1.2.1 move.

## Do
1. **Layout overflow warnings.** `pnpm test:e2e` / `pnpm dev` print many "[layout] … overflows its region" warnings (dev-only engine check).
   For each distinct warning: is the game's content really overflowing (fix it in the game: copy, sizes, regions) or is the engine's check wrong (false positive)?
   Goal: zero warnings on every profile in tests/e2e/phones.ts plus desktop 1280×720 / 1920×1080 and iPad. Add an e2e assertion that fails on any `[layout]` warning so it stays at zero.
   Engine false positives: don't suppress locally; write a minimal repro into the Log under **Upstream asks** (title, steps, expected vs actual, engine version).
2. **Flake:** `tests/e2e/altar-column.spec.ts:349` failed once post-migration, passes alone. Run it `--repeat-each=20` and in the full suite; find the race and fix it (wait on real state, not timeouts).
3. **Stale shot script:** opt-in `moments iphone` in `tests/e2e/shots.spec.ts` times out waiting for the hand to empty after the first gem tap (hand keeps "Channel ×5", which is correct chain-placement behaviour, D-048). Update the script to the current rules.
4. Run the whole suite 3× in a row; any other flake gets the same treatment.

## Gates
`pnpm check`, `pnpm build`, `pnpm test:e2e` green 3× consecutive with 0 flaky, `pnpm baseline` 129/129 (regenerate only with a first-time-player judgement, noted here).
D-046: fix, don't gold-plate. Never patch node_modules.

## Log
