# Workstream: bug-bash

User (2026-11-02): "make judgements for quality and focus on polishing things up". Play the whole game as a first-time player (D-027). Find what's broken, ugly, confusing or inconsistent, and fix it.

## Scope
- **Sweep:**
  - title → Settings → Codex → journal → hall → every altar → ending → end card;
  - at 1920×1080, 1280×720, and 1280×720 at 150% text;
  - mouse, keyboard and gamepad (Playwright gamepad stubs are fine).
  - Watch for:
    - clipping, overlaps, focus traps or lost focus;
    - console errors/warnings;
    - stale or misleading text;
    - inconsistent wording (Strike vs Fire, gem names, key hints);
    - z-order fights with FUSE's caption;
    - layout jumps;
    - sounds that don't fit an action.
- **Robustness:**
  - resize and devicePixelRatio changes mid-scene;
  - tab hidden/visible;
  - WebGPU device lost (should show the friendly message, not a blank page);
  - corrupt or old localStorage saves;
  - rapid input spam on Strike and Back;
  - reload mid-strike.
- **Known items:**
  - Settings and Codex panels need scrolling at every text size. Make them fit at 1280×720 at 100% and degrade gracefully at 150%, or make the scroll obvious.
  - The lint warning: `any` in `scripts/playtest/glyphs.spec.ts:89`.
  - The caption vs the bottom key-hint line on the altar: verify it is fully resolved.
  - Refresh the Keys column in `docs/design/playtest-report.md`.
- **Triage:**
  - Fix S1 and S2 issues.
  - Fix S3 issues when the fix is small.
  - List everything else, with severity, in the log for the PM.
- **Out of scope:**
  - Puzzle data, solver or FUSE lines (difficulty-2 owns them).
  - Candle/hall lighting (candle-light).
  - Perf internals (perf-low).
  - Firefox (not a target).

## Done when
- A findings table in the log: severity, where, what, fixed/deferred.
- Before/after screenshots for each visual fix.
- Each fixed bug that can regress gets a unit or e2e test.
- Zero console errors on a full run.
- `pnpm check` (lint warnings included), `pnpm build` and `pnpm test:e2e` pass.

## Log
