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
- 2026-11-03: zoom removed.
  - **Deleted:** `scenes/altar/zoom.ts` (474), `zoom-ui.ts` (720), `zoom.test.ts` (218), `tests/e2e/mobile-zoom.spec.ts` (558), `scripts/playtest/mobile-6-zoom.spec.ts` (159) and `mobile-7-zoom.spec.ts` (209). That is about 2,340 lines.
  - **Altar code:** about 560 more lines came out of `altar-scene.ts` and `altar-view.ts`.
    - `altar-view.ts` has one layout again (`view.layout`; `world`, `setZoom` and `zoom` are gone), with no masks, gutter or inverse-zoom draws.
    - `altar-scene.ts` loses the camera, the button/badge/minimap/arrows/chips (ZoomUi), tap-to-zoom, pan, drag-from-tray zoom-in, settle, Strike-zooms-out-first, map crowding in the column arbiter, the hint lines and their `zoomKey` cache busting.
    - Finger aim and the loupe now work at the whole board on dense boards (the loupe was suppressed while zoom owned the taps).
  - **Moved, not removed:** `keepClearOfMenu` (the Holding pill never touches Menu) moved into `altar-scene.ts`. It belongs to the pill, not the zoom.
  - **moments.ts:** `HINT_SLOTS` is `['holding', 'howto']`.
  - **Tests:**
    - `mobile.spec.ts` gets back its pre-zoom loupe test ("a finger drag from the tray shows the loupe and lands on the meant socket", 667×375).
    - `mobile-budget` drops the zoom-in/out steps.
    - `mobile-moments` swaps the zoomed block for a whole-board "holding" check: Holding pill shown, hint not contradicting it, pill gone when the gem goes back.
    - `mobile-2` capture shoots `10-the-last-rune-holding` in place of `-zoomed`.
    - `mobile-chrome`/`mobile-hall`/`mobile-4-chrome` only had the hall camera's `f.zoom` (kept).
  - **Kept zoom-named code:**
    - in the altar: `LOUPE_MAG` passed as the engine Loupe's `zoom` option (the loupe stays);
    - `cam.zoom = 1` resets of the renderer camera in `altar-view.ts` (the hall leaves its camera zoomed out on phones);
    - the hall camera (`hall-frame.ts`), the FUSE portrait's `zoom` option, the engine camera/loupe, and the browser-zoom guards.
  - **1.1 item (Phase 2 layout):** dense boards on phones place below 44 CSS px pitch at the whole board. No test asserts ≥44 px sockets any more; the loupe plus snap carries aiming. See captures for pitches.
  - **Captures:** `scripts/playtest/zoom-removal.spec.ts` → `docs/design/screens/local/zoom-removal/<phone>/` (the-last-rune, capacitor-bay, lift-shaft: arrival, rest, holding, tap-placed, half-built; `pitch.json`).
  - **Socket pitch at the whole board (CSS px), the-last-rune / capacitor-bay / lift-shaft:** se 26.4 / 35.1 / 35.1; iphone 28.9 / 37.9 / 37.9; promax 33.5 / 44.1 / 44.1; android 31.4 / 41 / 41.
  - **Capture review (first-time player):**
    - The left rail reads Back / Undo / Clear / Turn with no gap where Zoom was.
    - The Holding pill sits left of Menu without touching it, and the tray tip sits under the tray.
    - All three boards fit whole with every gauge and label visible. A tap at the whole board places the held gem on all 4 phones (the capture checks the save).
    - Concern: on SE, the-last-rune's 26 px pitch is small for a finger. It works with the loupe and snap but is tight. This is the main 1.1 dense-board item.
  - **Tests:** `pnpm check` (766 unit tests) and `pnpm build` are green. `pnpm test:e2e`: 114 passed, 2 skipped, 0 flaky.
