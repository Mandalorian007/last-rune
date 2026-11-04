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

### 2026-11-03: port done (ready for PM merge)

**Design: two overlays.** `createGame({ overlay })` with a layout spec builds the CSS-px overlay
(`createCssChrome`, `ctx.chrome`; `data-units="css"`, `data-form-factor`) next to the legacy
scaled 1920×1080 overlay (`ctx.ui`). `chrome.active` is true only for phone forms. The game's
`CHROME_LAYOUT.classify` calls it a phone exactly where `device.phone` does
(`min(w/1920, h/1080) < PHONE_SCALE`), so desktop and iPad never see it and stay byte-identical
to v1.0. While it is active, the engine moves the legacy panels and toasts layers into it, so
settings, the codex, pause and toasts lay out in CSS px. World-anchored pieces (door plates, the
Next ring, the altar, the journal spread, the ending stage) stay on the scaled overlay.
`Surface.setFrame(rect|null)` frames the canvas in `fill` for the upright title.
`WidgetHandle.remove()` returns an element to its old home.

**Region map (phones).**
- Title: Full screen and the release label in `top`. Landscape: Play, Settings, Ko-fi and Copy
  link in one centred `bottom` row. Portrait: the menu in `cardLane`, the links in `bottom`.
  FUSE is docked in `captionLane`; the picture is framed in `fill`.
- Hall, altar (puzzle) and solve card: the HUD ☰ at the top of the `right` rail. The caption is
  the legacy card (avoid(), tail, FUSE prefix; the rules come back from the deleted
  phone-hall-styles into phone-styles `HALL`). Portrait shows the rotate card.
- Journal: ✕ in the `right` rail, the caption docked in `captionLane`, the rotate card in portrait.
- Ending: legacy (the caption bottom left, Skip top right), the rotate card in portrait.
- Settings, codex, pause and toasts: in the CSS overlay. Portrait settings are one column, with
  the tabs inline (the `CP` rules in chrome-styles).

**Deleted.**
- `games/last-rune/ui/phone-chrome.ts` (107 lines)
- `games/last-rune/ui/phone-hall-styles.ts` (106 lines)
- The chrome half of `phone-styles.ts` (1022 → 772 lines, including the restored hall tail rules)
- The game's device-mode and token copies (it uses the engine's `PHONE_SCALE` and `createRotateCard`)

**Tests.**
- Engine: added "panel-stack spam leaves at most one panel" (`e2e/layout.spec.ts`; real taps or
  clicks assert ≤1 after every tap, then `spamOptions(20)` leaves exactly one, then Escape
  leaves none). Added harness `spamOptions`/`panels`.
- Game: overlay and caption selectors scoped to the legacy overlay or the docked caption in 12
  specs. mobile.spec `fitProblems` and the mobile-hall menu note measure each element at its own
  overlay's scale.
- Trimmed: nothing (no duplicates found worth removing; the phone-chrome checks already lived in
  mobile-chrome).

**Gates (after `git merge main`).**
- `pnpm check`: green (563 unit tests).
- `pnpm build`: green.
- `pnpm baseline`: 129/129, every scene 0.0000% (no intended desktop diffs).
- `pnpm test:e2e:engine`: 261 passed, 27 skipped.
- `pnpm test:e2e`: 118 passed, 12 skipped, no reruns needed. This covers full-run (16 machines),
  a11y axe plus the keyboard path, mobile-chrome and mobile-ending on all devices.
- `pnpm test:e2e:desktop`: 5 + 2 passed.

**Screenshots** are in `docs/design/screens/local/port-chrome/` (not committed): every scene for
SE, iPhone, Android and a fourth phone in landscape and portrait, plus desktop and iPad.
