# Workstream: zoom-removal (remove the phone altar zoom)

User (2026-11-03): "You can probably fully remove zoom features." PM call: remove the phone altar zoom completely. Phones become Last Rune 1.1 on the engine's layout and camera model (D-041 Phase 2), so the zoom patch on the scaled overlay is dead weight. Desktop and iPad never zoom, so the v1.0 baselines are unaffected.

## Remove
- `games/last-rune/scenes/altar/zoom.ts`, `zoom-ui.ts`, `zoom.test.ts`.
- **Zoom UI:** the Zoom / Whole board button; the zoom badge; the minimap; the edge arrows and the gutter frame; the edge chips for off-view gauges; the settled-camera logic.
- **Copy:** the "Tap the board to zoom in" and "Drag to look around" hint lines and their copy in content.
- **Altar code:** the zoom transform and masks in `altar-view.ts`, and every zoom branch and hook in `altar-scene.ts` (tap-to-zoom, pan, finger-drag-from-tray zooms in, map crowding, Holding-pill zoom offsets). Also any zoom state in `moments.ts`.
- **Tests:** `tests/e2e/mobile-zoom.spec.ts`. Remove zoom cases from `mobile.spec.ts` (e.g. "a finger drag from the tray zooms in…"), `mobile-budget`, `mobile-moments`, `mobile-chrome` and `mobile-hall`.
  - Keep each spec's other checks.
  - Where a phone test asserted ≥44 px sockets via zoom, relax it to "fits and is tappable" for dense boards, and note it as a 1.1 item.
- **Capture scripts:** `scripts/playtest/mobile-6-zoom.spec.ts`, `mobile-7-zoom.spec.ts`, and the zoom shots in `mobile-2` and `mobile-4-chrome`.

## Keep (not "zoom features")
- Browser zoom blocking (viewport no-scale, dblclick/gesture/ctrl-wheel guards).
- Hall and ending camera moves.
- The loupe and snap for small targets (a Phase 2 Gestures option).
- The phone layout itself.

## Done when
- `grep -rni "zoom" games/last-rune/scenes/altar tests/e2e` finds only the kept items or nothing. List what remains and why.
- Every altar on every phone still fits and is playable at the whole-board view, with no dead controls. Take whole-board captures of the-last-rune, capacitor-bay and lift-shaft on the 4 phones, saved to `docs/design/screens/local/zoom-removal/`.
- Desktop and iPad behave identically.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` are green.
- Commit to `ws/zoom-removal` and never merge. Log here.

## Log
