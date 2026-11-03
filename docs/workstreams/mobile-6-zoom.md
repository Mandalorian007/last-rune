# Workstream: mobile-6-zoom (dense boards on phones: tap at ≥44 px)

## Background
Gate review 3 (4 blind reviewers, 2026-11-03) scored 6 / 6 / 6 / 6.5 and failed. All four reviewers named the same top problem, and one called it a blocker: **dense boards are too small to tap.** PM calls are in D-040 addendum 4.
- The Last Rune (10×8): sockets are 24–29 px on every phone (`docs/design/screens/local/mobile-2/gate3/*/10-the-last-rune.png`, `pm-review-altars/se/16-the-last-rune.png`).
- Lift Shaft, Control Booth and other 8×6 boards: about 30–36 px.
- Eight rows plus gauges cannot reach 44 px in 320–380 px of height. Three rounds of trimming chrome have not fixed this, so the fix is structural: **zoom.**

## Scope (phones only; desktop and iPad must stay pixel-identical)
1. **When it applies.** Use a zoomed view when the phone's fitted pitch is under 40 px. Measure it per viewport and puzzle, don't hard-code board sizes. Boards that already fit at ≥40 px behave exactly as today.
2. **Placing a gem happens at an effective pitch ≥44 px.** The interaction is your call. Prototype, screenshot and pick the one a newcomer gets without being told. The candidates:
   - **(a) Focus zoom:** tapping the board at fit view zooms about 2× around the tap; tapping a socket then places; a clear "Whole board" control returns to fit.
   - **(b) Always zoomed with one-finger pan:** a drag pans, a tap places (with a movement threshold), and a minimap or "Whole board" control goes back to fit.
   - **(c) Pinch-zoom plus pan:** at fit, a tap places only if the target is ≥40 px; otherwise the first tap zooms.
   - Whatever you pick: no gem is ever placed by a tap the player meant as a pan or zoom; holding a gem survives zooming; undo, clear and turn work at any zoom.
3. **The whole board is always one tap away**, with a visible control. The player always knows where they are: the source, gauges and edges that are off-screen are indicated, or a minimap shows the view rectangle.
4. **Strike shows the whole circuit.** Tapping Strike animates to the fit view, so the strike run, the verdict and the solve are seen whole. After a fail, the view may return to zoom.
5. **Hit-testing and render agree at every zoom.** The renderer, the overlay labels (Gives/Needs plates, verdict tag, socket ring hints) and the touch mapping use one transform. Labels stay ≥13 px on screen and don't scale with the board.
6. **Motion:** zoom transitions take ≤250 ms and are instant when reduced motion is on.
7. **Teach the gesture once**, on the first dense board, in a single line through the existing hint slot (e.g. "Tap the board to zoom in"). Coordinate the wording with mobile-6-moments through the PM: say it in your log, and don't edit `moments.ts`.

## Out of scope
- Socket, slab, gauge and tray looks, and the held-gem cue: that's mobile-6-board.
- Tips, FUSE, teach cards, verdict copy and the right-column arbitration: that's mobile-6-moments.
- Hall, menus and ending: that's mobile-6-chrome.

## File ownership
- **You own:** the view transform and camera for the altar on phones; the touch mapping in `altar-scene.ts` / `cursor.ts`; `layout.ts` changes needed for the zoomed pitch; a new module such as `scenes/altar/zoom.ts` (pure, unit-tested).
- **mobile-6-board** edits `socket-looks.ts`, the stone shader and the tray look. Keep your `altar-scene.ts` edits minimal and well delimited, because others merge into it.

## Done when
- On iphone, se, promax and android, every socket on every altar is placed at an effective pitch ≥44 px. An e2e test proves it per viewport: tap-place a gem on The Last Rune's farthest socket and assert placement.
- Captures: `M2_TAG=m6zoom` runs of `scripts/playtest/mobile-2.spec.ts` plus new shots of the zoomed view (zoomed, holding a gem, after Strike at fit) on all four phones, in `docs/design/screens/local/mobile-6-zoom/`.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- The log in this file records the interaction you chose and why, the pitch table, and the changes made.

## Log

### 2026-11-03: zoomed view (ws/mobile-6-zoom)

**Interaction chosen: tap to zoom in, drag to pan, one button for the whole board.** Boards whose fitted socket pitch is under 44 CSS px (measured live per viewport and puzzle) open at the whole board as before.
- **Tap.** A tap anywhere on the board zooms in around that point, so sockets become 52 CSS px. Nothing is placed or picked up at the small size, and a gem in hand stays in hand.
- **Drag.** Zoomed, a drag of more than 10 CSS px pans. A pan never places, picks up or moves a gem, and any press it began is let go. A still tap acts exactly as on a roomy board (place, pick up, swap, deny).
- **Button.** The left rail gains a **Zoom / Whole board** button between Back and Undo, showing an icon plus a word. At the whole board it goes back to the last zoomed view, or to the storm the first time.
- **Strike.** Strike while zoomed eases back to the whole board (≤220 ms, instant with reduced motion) and only then strikes. The bolt, verdict and solve are always seen whole.
- **Tray drag.** A gem dragged from the tray and let go over the whole board zooms there and keeps the gem in hand.
- **Orientation.**
  - Gold shaded edges with a chevron mark each side where the board runs on past the view.
  - Gives/Needs cards ride with their gauges. A card whose gauge is off screen waits at that edge of the view with an arrow pointing toward it.
  - The tray column covers the board, using the wall texture and a thin dark rule, so the column never moves.
- **Why.**
  - Pinch has no discoverable affordance and fights the browser.
  - A minimap would cost the column space mobile-5 fought for.
  - Tap-to-zoom needs no teaching beyond one hint line. The first tap on a small board does something visible (it zooms) and never something wrong (no misplaced gem).
  - Any target is two taps from the whole board: zoom, then place.
- **Threshold.** The brief called boards under 40 px "dense". At 40 px, 40–44 px boards (iphone control-booth at 43.4, se roof-array at 40.6) would still be placed under 44 px, so the line is 44 px (`ZOOM_BELOW_CSS`).

**Pitch table, CSS px** (`tests/e2e/mobile-zoom.spec.ts`, fit pitch rendered; "→" = zoomed pitch, where every placement happens):

| altar | se 667×320 | iphone 844×340 | promax 932×380 | android 915×360 |
|---|---|---|---|---|
| 6×4 altars (11) | 44.1–53.8 | 57.8–66.4 | 67.4–75.9 | 71.5–86.7 |
| archive 8×6 | 33.3 → 52 | 45.7 | 52.1 | 55.8 |
| capacitor-bay 8×6 | 35.1 → 52 | 37.9 → 52 | 44.1 | 46.7 |
| lift-shaft 8×6 | 35.1 → 52 | 37.9 → 52 | 44.1 | 46.7 |
| roof-array 8×6 | 40.6 → 52 | 44.9 | 50.9 | 54.3 |
| control-booth 8×6 | 33.3 → 52 | 43.4 → 52 | 51.3 | 55.8 |
| the-last-rune 10×8 | 26.4 → 52 | 28.9 → 52 | 33.5 → 52 | 35.7 → 59 |

The fit pitch depends on how the overlay is scaled at that moment, so the gate reads the live layout; e.g. android capacitor-bay measured 41 px in one cropped state. Every altar on every phone places at ≥44 px; the e2e asserts it.

**Changes**
- `scenes/altar/zoom.ts` (new, pure) holds:
  - the camera math (`screen = o + z·world`): the threshold, zoom level, clamping that keeps the slab and gauges covering the view, zoom-at, pan, and the transformed screen layout;
  - off-edge flags, the renderer-camera mapping, and an eased `ZoomCamera`.
- `zoom.test.ts` (new) has 14 tests:
  - hit tests through the transform, so `cellAt`/`snapCell` hit what is drawn;
  - clamping, the renderer equivalence, and the animation with reduced motion.
- `scenes/altar/zoom-ui.ts` (new) holds the rail button, the edge cues, the card tracking and pinning, and its CSS. It is phone-only and shown only under `[data-zoomable]`.
- `altar-view.ts` (shared):
  - `layout` is now the screen layout and `world` the fitted one; `setZoom(cam)` updates both.
  - Zoomed, the renderer camera draws the world through the zoom. Wall, tray, FUSE, the eye light, the tray light and the held gem are drawn back through the inverse so they stay put, and the wall masks the board's overflow under the column.
  - At z = 1 the path is unchanged, apart from `cam.zoom = 1` each frame. Desktop and iPad never zoom.
- `altar-scene.ts` (shared, delimited):
  - one `── mobile-6-zoom ──` block (`zoomGate`, `zoomTick`, `zoomTap`, setup, reset, strike defer, label tracking);
  - one-line hooks in `update`, `strike`, `teardownView`, `buildDom` and `placePhoneLabels`, the loupe condition, `hoverCell` (nothing aimed at the whole board), and two DOM cache keys;
  - `window.__altarLayout` is now a live getter (dev only).
- `tests/e2e/mobile-zoom.spec.ts` (new): on all 4 phones it:
  - measures every altar's fit and zoomed pitch;
  - on The Last Rune, takes a gem, taps the farthest socket at the whole board (zooms; the gem stays held, nothing placed), drags (pans; nothing placed), taps the socket at its live position, and asserts the placement;
  - checks Strike while zoomed returns to the whole board.
- `tests/e2e/mobile-budget.spec.ts`: on a zoomed board its tap-placement loop taps the socket where it now is, then returns to the whole board, which is the view the budgets measure.
- `scripts/playtest/mobile-6-zoom.spec.ts` (new) takes the zoom captures.
- `tests/e2e/mobile.spec.ts`: the 667×375 Last Rune loupe test now checks the zoom flow. A tray drag let go at the whole board zooms with no loupe and the gem held; a tap then places on the meant socket. With the 44 px gate the loupe (also 44 px) no longer shows on any phone board, because zoom replaces it; it stays in the code for the edge case where the scale changes without a relayout.

**Captures** (git-ignored):
- `docs/design/screens/local/mobile-2/m6zoom/<phone>/` and the `m6zoom-<phone>.png` sheets;
- `docs/design/screens/local/mobile-6-zoom/<phone>/`: `01-whole-board`, `02-zoomed`, `03-holding`, `04-placed`, `05-panned`, `06-strike-at-fit`.

**Hint-slot proposal for the PM / mobile-6-moments** (not edited here): on the first dense board at the whole board, show "Tap the board to zoom in" once, the first time the board is zoomable. When zoomed, optionally show "Drag to look around · Whole board shows it all".

**Known weaknesses**
- The slab texture is baked at the fitted pitch, so it is softer when zoomed. Gems and sockets are drawn at full size.
- No pinch gesture.
- No zoom mid-drag: a tray drag dropped at the whole board zooms, and the player taps again.
- A pinned Gives/Needs card can sit over edge sockets of the zoomed view until the player pans.
- `data-zoomable` is set at layout time. A scale change without a relayout would leave the button state stale until the next relayout (the gate itself reads the live layout).
