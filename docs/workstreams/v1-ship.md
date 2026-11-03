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
