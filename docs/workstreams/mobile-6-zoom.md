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
