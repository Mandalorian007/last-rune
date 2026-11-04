# Workstream: promote-ui (Phase 1, parallel with host, after workspace)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 1" → ws/promote-ui. Decision: D-041.

## Scope
Move what is already generic out of the game and into `@thunderclap/engine`, with no game nouns:
- `games/last-rune/ui/menu-nav.ts` → `engine/ui/menu-nav.ts`.
- `games/last-rune/ui/text-scale.ts` → engine tokens `--tc-text-scale` and `--tc-text-min`, plus a `scaleFontSizes()` helper. The game keeps `--lr-*` aliases only if removing them would touch layout. Say which.
- `ui/device-mode.ts` → `engine/platform/device-mode.ts` and `ui/phone-chrome.ts` → `engine/ui/rotate-card.ts`, as interim API (both retire in Phase 2). Copy is game content, so the engine takes strings as options.
- ~~`zoom.ts` → `camera2d.ts`~~: dropped. The phone altar zoom was removed (zoom-removal, D-041). Phase 3's Camera builds `fitRect` from scratch, and `zoom.ts` stays in git history for reference.
- Move or port the unit tests with each module. List every promoted module in `packages/engine/CHANGELOG.md`.

## Rules
- Pixel-identical: `pnpm baseline` shows no desktop change. The mobile e2e specs (mobile-chrome, mobile-zoom, mobile-budget) stay green on all four phones.
- No `@game` import inside `packages/engine`.
- Commit to `ws/promote-ui` and never merge.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` must be green.

## Log
- 2026-11-03: Promoted all four modules (zoom dropped).
  - `games/last-rune/ui/menu-nav.ts` → `packages/engine/src/ui/menu-nav.ts`. It is generic over the action names; the default names are `up`, `down`, `confirm`.
  - `games/last-rune/ui/text-scale.ts` → `packages/engine/src/ui/text-scale.ts`. Its tokens are `--tc-text-scale` and `--tc-text-min`. `applyTextScale` now takes a factor (1 = 100%). The game keeps `TEXT_SCALES` and `toTextScale` in a small `ui/text-scale.ts`.
  - `games/last-rune/ui/device-mode.ts` → `packages/engine/src/platform/device-mode.ts`. `--lr-tap` became `--tc-tap-min`.
  - The rotate card in `ui/phone-chrome.ts` → `packages/engine/src/ui/rotate-card.ts`. The game passes its copy and colours, so the card looks the same. `phone-chrome.ts` keeps only the fullscreen button.
  - Every `--lr-*` density, phone and crop variable was renamed to `--tc-*`. No aliases were kept: the values are the same, so no layout changes.
  - Unit tests moved with their modules. The "unknown saved values mean 100%" test stays in the game.
  - New engine e2e page `harness/ui.html` with `e2e/ui.spec.ts`. It covers the test-split promote-ui rows plus a11y focus return and Esc from a focused button. It runs on every top-level row; itch-iframe is skipped because the wrapper embeds the WebGPU page.
  - Trimmed from the game specs: the mobile rotate-card test, the mobile `data-touch`/`data-phone` assertions, the a11y Settings trap/restore and codex focus-home assertions, and the a11y journal Tab-to-slip check.

## Test ownership (D-041 addendum 2)
Platform assertions for the modules you move or create go in the engine suite: unit tests plus the engine e2e harness. Then trim the matching checks out of the game specs in this same branch. Follow `docs/engine/test-split.md`. Coverage must never drop between the two.
