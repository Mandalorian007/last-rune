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

### 2026-11-09: done (rebased on main after harden-app, D-053)

**Changes**
- **`[layout]` guard.** New `tests/e2e/fixtures.ts`: an auto Playwright fixture listens on the whole browser context and fails the test on any `[layout]` console warning, giving the viewport width and the message. All 38 e2e specs (hardening.spec included) and `scripts/baseline/scenes.spec.ts` import `test`/`expect` from it, so the guard also covers baseline's desktop 1280×720 / 1920×1080 and iPad. `full-run.spec.ts` opens its own context, so its console listener now also counts `[layout]` warnings as problems. I checked that a synthetic warning makes the guard fail.
- **Warnings found: two, both on the phone altar (`phone-landscape` form), both now at zero:**
  1. `lr-altar-strike overflows its "bottom" region … 74.48x58 px in 52x58 px` (also 131×58 in 52×58). This was a real overflow, but only for one moment. `placeAltarChrome` added the rails and Strike before the column widgets. Each engine `add()` lays out and measures at once, so while the column track was still empty it collapsed and Strike was measured in the narrow rail-wide `bottom`. Fix (`altar-chrome.ts`): add the column head and card first, then rails and Strike. The settled layout is unchanged.
  2. `lr-altar-head overflows its "top" region … 146x141 px in 140x135 px` (always exactly 2×pad = 6 px over). Cause: the game's CSS set `padding: 0` on the `top` region holding the head, so the head filled the whole region while the engine measures against region minus `2*form.pad`. Fix (`altar-column-styles.ts`): keep the engine's region padding and pull only the title band out by `--lr-head-out: calc(-1 * var(--tc-region-pad))`. Slots and counts are placed from the head's own rect, so the look is the same (checked in screenshots, `docs/design/screens/local/harden-tests/`, not committed).
- **PM point (3), production bundle at 844×390 and 667×320.** These are the same two warnings: the check runs in prod too, and the code path is the same. `FULL_RUN_DEVICE=phone` full-run on the prod preview (844×390) gave 6/6 passed with 0 `[layout]` warnings. altar-column/dense-board/mobile-* at se 667×320 and short gave 0 warnings under the guard.
- **altar-column.spec.ts:349 flake ("overlaps at", short phone)** was a real product glitch that lasted a few frames. On short lanes (gem chip folded behind the Rule tab) the finger still pressing a tray gem counted as a hover, so the folded lane squeezed the card to about 6 px for a few frames. Fix (`altar-info.ts`): when the lane is folded on touch (not keyboard), a press doesn't open the hover card. Before: 3/20 fails on short. After: 100/100 (5 phones × 20, 8 workers).
- **dense-board.spec.ts:293 flake (se, the-last-rune 0,0: aimed)** was a test race. Under load the loupe turned on a tick before the aim snapped to the socket. The test now waits for `.lr-altar[data-loupe]` to hold a real cell before reading it. 80/80 with `--repeat-each 8 --workers 8`.
- **Stale `moments iphone` shot script** (`shots.spec.ts`): it waited for the hand to empty, but under D-048 chain placement the gem stays in hand. It now waits for `flow.placementsFor('intake-desk').length === 1`. `SHOTS_ONLY=iphone,se,moments,altars`: 4/4.

**Gates** (on top of main dc997b1)
- `pnpm check`: green (vitest 611 passed, 2 skipped; boundaries/lint/types clean).
- `pnpm build`: green.
- `pnpm test:e2e` 3× back to back: 223 passed, 20 skipped (opt-in shots), 0 failed, 0 flaky, 0 `[layout]` warnings each time (9.7m / 9.6m / 9.7m). All three runs include hardening.spec.
- `pnpm baseline`: 129/129 under the `[layout]` guard. Not regenerated (the head/Strike fixes don't change pixels at baseline tolerance).

**Upstream asks** (engine `@thunderclap-engine/engine` 1.2.1, `dist/ui/layout.js`)
1. **Overflow check runs inside every synchronous `add()`, so a batch of adds is judged on half-built layouts.**
   Steps: form with `columns: [fill, 100, 58]`, areas `'fill top right' / 'fill bottom bottom'`, `pad: 3`. `layout.add({ id: 'b', el: <74px-wide div>, place: 'bottom' })`, then `layout.add({ id: 't', el: <div>, place: 'top' })`.
   Expected: no warning, because the settled layout gives `bottom` 158 px.
   Actual: on the first `add`, the `top` track is empty and collapses, so `bottom` is 52 px wide and you get `[layout] b overflows its "bottom" region … 74x58 px in 52x58 px`. That entry's `warnedOverflow` latch then hides any later real overflow.
   Ask: a batch API (`layout.batch(fn)` / `addAll`) or do the overflow pass after a microtask or frame instead of inside each `apply()`. The Last Rune works around it by ordering its adds.
2. **The check measures against `region - 2*form.pad`, not the region element's real content box.** A game that restyles a region's padding (e.g. `padding: 0` on one `.tc-region`) gets a 2×pad false positive (e.g. `146x141 px in 140x135 px`), or a false negative if padding grows.
   Ask: measure the `.tc-region` element's content box (`clientWidth/Height - computed padding`), or support per-region `pad` in FormSpec. The game now keeps the engine padding, so this no longer fires here.
3. **Gate the console warning to dev builds (PM point 3).** `layout.js:665` runs `console.warn` with no condition, so `[layout] …` strings ship in production bundles and print in players' consoles (harden-app saw this at 844×390 / 667×320). Recommendation: **yes, gate it.** Warn only under a dev flag (`import.meta.env.DEV` at the game's build, or a `debug`/`warnOverflow` option in `createLayout`). Keep `layout.overflows()` available in all builds so tests and tools can still assert on it. Since the game's e2e guard listens for the console text, the engine should keep the warning on in dev / vite preview test builds, or the game guard would have to switch to `overflows()`.

**PM decisions needed:** none blocking. Optional: if upstream gates the warning to dev (ask 3), the e2e guard (`tests/e2e/fixtures.ts`) runs against the prod preview and would go quiet. When that engine version lands, switch the guard to polling `layout.overflows()` through a test hook.
