# Workstream: port-chrome (Phase 2, after gestures and layout)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 2" → ws/port-chrome.
Decisions:
- D-027: intuitiveness first.
- D-039 and D-040: phone budgets. D-040 is the gate at Phase 2's end.
- D-041 addenda:
  - 1: no phone zoom.
  - 2: the engine owns platform tests.
  - Portrait phones are a form factor.

## Scope
- **`createGame` option.** Add an overlay option, `legacyScale` or `overlay: { legacyScale }`, so scenes can use the CSS-px overlay and `createLayout`. The altar stays on legacy until ws/port-altar. Both paths have to coexist in one run, so decide how that works:
  - one overlay per mode, or
  - a per-scene root.

  Document the choice in ARCHITECTURE.md.
- **Port to layout regions, with taps through `Gestures` where touch matters:**
  - title, hall, settings, journal, codex and the ending;
  - the HUD and the caption card. The caption card moves to `captionLane` with `dockCaption()` on ported scenes.
- **Delete:**
  - `games/last-rune/ui/phone-chrome.ts`;
  - the chrome half of `ui/phone-styles.ts` and `ui/phone-hall-styles.ts`;
  - any game copy of what device-mode or the layout tokens now do.

  Each scene's phone CSS shrinks to region-specific styling. The altar half of `phone-styles.ts` stays until port-altar.
- **Portrait phones:** chrome scenes must read cleanly upright as well as in landscape. The engine's rotate card covers only the altar until port-altar decides.
- **Panel-stack spam:** add the layout gap from test-split, "panel-stack spam leaves at most one panel", as an engine e2e check.

## Acceptance
- `mobile-chrome.spec.ts` and `mobile-ending.spec.ts` pass on all four phone viewports, desktop and iPad.
- Desktop screenshots match v1.0 (`pnpm baseline`) within tolerance. Any deliberate desktop change must be listed and justified in the log.
- D-027: screenshot every ported scene on the phone rows, landscape and portrait, as a first-time player would see it. Save them to `docs/design/screens/local/` and don't commit them. Nothing may be clipped, overlapping or unreachable, taps must be at least 44 px and text at least 12 px.
- The PM runs a D-040-style screenshot review of the chrome scenes before merging.
- Keyboard and gamepad menu navigation is unchanged (`menuNav`). Run the axe a11y suite.

## Rules
- Keep the game's product tests in the game and the platform checks in the engine. Trim duplicates in the same branch (`docs/engine/test-split.md`).
- No engine imports of the game (`pnpm check:boundaries`). pnpm only.
- Commit to `ws/port-chrome` and never merge.
- Before reporting, run `pnpm check`, `pnpm build`, `pnpm baseline`, `pnpm test:e2e` (full-run 16/16) and `pnpm test:e2e:engine`.

## Log
