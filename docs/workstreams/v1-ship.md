# Workstream: v1-ship (Phase 0: v1.0 for desktop and iPad, plus regression baselines)

D-041 adopted the ThunderClap engine refactor ([../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 0"). Last Rune v1.0 ships for desktop and iPad on the current code before any engine change. That gives every later phase a known-good baseline to regress against. Phones become 1.1 (Phase 2). Leave the phone build as it is.

## Scope
1. **Version.** Bump `package.json` to `1.0.0`. Drop the alpha `VITE_RELEASE_LABEL` from the title if the release build would show it; check how alpha-1 set it (D-023 / ship-ops).
2. **Baselines.** Commit them to `docs/design/screens/v1.0/`. D-041 makes this an exception to the "no committed images" rule, for this folder only.
   - **Scenes:** every scene at 1280×720, 1920×1080 and iPad (1180×820 landscape, the viewport the mobile specs use):
     - title, hall (first visit and mid-run), settings, journal, codex;
     - each of the 16 altars, empty and solved;
     - a fail verdict, the solve card;
     - the ending sequence and the end card.
   - **Determinism:** the shots must be repeatable. Seed or stub animation time where the game allows it, and pause particles if a hook exists. If a scene can't be made deterministic, document its tolerance.
   - **Diff script:** add `scripts/baseline/` with a Playwright config and specs that (a) regenerate the set (`BASELINE_UPDATE=1`) and (b) diff against it. Use Playwright's `toHaveScreenshot` with the baseline dir as the snapshot path, or an equivalent. Add a `pnpm baseline` script. This diff is the Gate 1 check: "Playwright screenshot diff against the v1.0 set shows no pixel change on desktop". Pick a tolerance and justify it in the log.
   - **Size:** keep the set small, with 8-bit PNGs and no retina doubling. Report the total MB.
   - **Numbers:** record `docs/design/screens/v1.0/BASELINE.md` with:
     - the full-run e2e timings (`tests/e2e/full-run.spec.ts`);
     - the perf harness numbers (`scripts/perf/`, see its README);
     - machine and browser info, with no personal data.
3. **itch kit.** `pnpm package:itch` produces `build/last-rune-itch-1.0.0.zip`. Run `pnpm itch:sim` checks headlessly where possible (boot, audio, storage, reload), and do the checklist in docs/shipping-itch.md §0–2.
   - Draft the itch page copy and a short devlog in `docs/release/v1.0.md` if `shipping-itch.md` doesn't already hold them.
   - Note that phones are coming in 1.1.
   - Never upload anything. The itch upload is manual, done with the user (D-012).
4. **Release notes** for the GitHub Release go in `docs/release/v1.0.md`: what's in v1.0 and the known limits (phones are 1.1, Firefox is not a target, WebGPU is required). The PM creates the tag and the release.

## Rules
- **Out of scope:** no gameplay, layout, rules, content or art changes. If a baseline exposes a desktop bug, log it and tell the PM; don't fix it here unless it's one line and obviously safe.
- **Commit** to `ws/v1-baselines` and never merge.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` must be green. If something is flaky under load, rerun it alone and say so.
- Report back with:
  - commits;
  - the size of the baseline set;
  - the diff tolerance and its reason;
  - the zip path and size;
  - any open issues.

## Log

### 2026-11-03: v1-ship agent

**Version and label.** `package.json` is at 1.0.0. The itch build has no release label, and the Pages workflow's manual label default is `v1.0.0` instead of `alpha` (6f479a6).

**Baselines (`pnpm baseline`, scripts/baseline/).**
- **Set.** 129 shots: 43 per viewport at 1280×720, 1920×1080 and iPad 1180×820, all at 1×. Stored as 256-colour palette PNGs, 34.1 MiB in total (720: 9.1, 1080: 17.0, iPad: 8.2). Regenerated after merging main at the content freeze, which includes mobile-7-teach and zoom-removal.
- **Compare.** Playwright's `toHaveScreenshot` can't diff a quantised baseline. `compare.ts` maps each capture onto the baseline's palette and counts the indices that changed. On failure it writes an actual image and a diff image.
- **Determinism, measured rather than assumed.** The first full compare against a fresh set failed 21 of 129 shots, and one hall shot at 1080 was off by 18.6% (a lightning flash). Fixes, all on the test side:
  - `performance.now` comes from the fake `Date`. The fake clock's own carried a few ms of real page-load offset.
  - Boot is awaited in real time with the clock still.
  - `advance()` steps one frame per round trip. `until()` gives its condition real time before stepping one frame.
  - Realtime audio is removed before boot. The engine reports it "unavailable" and plays silently. Unlocking audio started real-time pre-render work that interleaved with frames.
  - Title and hall shots are timed between lightning strikes.
  - Key presses get real time to arrive.
- **Tolerance.**
  - **Band-edge slack of 8 RGB.** Raw GPU renders of the same frame differ by 1–2 levels on 3–6% of pixels; after palette mapping that was 6–12k changed indices. With the slack it was 1–6.
  - **0.1% changed pixels, plus one retry.** In 3 compares of an unchanged tree, most shots changed 0–61 px and the worst outlier outside verdict-fail was 617 px (solve-card at 1080). Real changes run to tens of thousands of px. A single changed short word may slip under the limit at 1080, so the per-shot numbers are printed, and `BASELINE_MAX_DIFF=0` is exact.
  - **verdict-fail has its own 1% limit.** At identical game time, frame count and random draws it still varies by up to 0.5%, in the failed strike's smoke and FUSE's idle pose. I didn't find the cause.
- **Unchanged-tree result.** `pnpm baseline` passed 129 of 129 in 3.9 min, with no retries needed.
- **BASELINE.md** has the machine and browser, the full-run timings (6 passed in 3.1 min) and the perf harness (60 fps at p95 in every scene at High, DPR 1).

**itch kit.**
- `pnpm package:itch` writes `build/last-rune-itch-1.0.0.zip`: 271,748 B (265.4 KB) zipped, 855 KB unpacked, 2 files (index.html and one script).
- **itch:sim.**
  - `smoke.spec` already covers boot in the itch iframe, storage and `fullscreenEnabled`.
  - The new `tests/e2e/itch-release.spec.ts` covers audio and reload. It checks that no AudioContext runs before the click and one is running after Play, that a save lands in the frame's localStorage, and that Continue appears after a reload. It passed on two runs (8.8 s and 6.4 s).
- **shipping-itch.md §0–2.**
  - Saves use only `thunderclap:last-rune:` keys, there are no `localStorage.clear` calls, and the store falls back to memory.
  - Still manual: itch's own fullscreen button, `?sandbox=1`, and live Safari checks.
- **Release notes, itch copy and devlog** are in docs/release/v1.0.md, which says phones arrive in 1.1. Nothing was uploaded (D-012).

**Open issues for the PM.**
- **Repo history.** The set adds ~34 MB of PNGs. Each future regenerate adds another ~34 MB to git history, so regenerate only at gates.
- **Machine-specific set.** It matches this M4/Metal/Chromium 156 setup. Another machine needs its own regenerate from a known-good commit.
- **verdict-fail residual noise.** The cause is unknown (see Tolerance). It is a candidate to investigate in the engine refactor: particles or an animation not on the fixed step.
- **Desktop bugs.** None found in the 129 shots.
- **Ending emoji.** The colour emoji in the ending rely on a system emoji font, which is present on macOS. Worth checking on Windows.

**Gates on the final tree.** `pnpm check` passes (61 files, 772 tests passed, 2 skipped). `pnpm build` passes. `pnpm test:e2e` passed 135 with 2 skipped in 7.3 min, under load from other agents, with no flaky tests and no reruns needed.
