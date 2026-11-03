# Workstream: mobile-6-integrate (the four mobile-6 pieces, working together)

## Background
mobile-6-zoom, -board, -moments and -chrome were built in parallel and merged on 2026-11-03. Each was checked on its own; nobody has seen them together. Before gate review 4, the PM wants one pass that makes them one product. Read the Log sections of `docs/workstreams/mobile-6-{zoom,board,moments,chrome}.md` first.

## Scope (phones unless noted)
1. **Zoom teaching.** Call `AltarScene.setHintLine('zoom', …)` (mobile-6-moments' API):
   - "Tap the board to zoom in" the first time a zoomable board is open, until the player first zooms;
   - when zoomed, optionally "Drag to look around".
   - Holding beats zoom in the hint slot, per the API.
2. **Pinned cards never cover sockets when zoomed.**
   - The mobile-6-zoom shots show the "Needs 20" and "Needs 4" cards pinned at the view's edge and sitting on sockets (`docs/design/screens/local/mobile-6-zoom/iphone/03-holding.png`).
   - When a gauge is off-view, shrink its card to a compact edge chip (arrow + number) in the margin.
   - When on-view, the card must not overlap any socket's tap circle.
   - Add an e2e assertion.
3. **The arbiter knows about zoom and the held state.**
   - With a board zoomed and the board sliding under the column, the right-column lane, tips, teach cards and verdicts still never overlap the tray, Strike or labels.
   - Re-run the mobile-moments "one owner" test with a zoomed board.
   - The "Holding: X" pill (mobile-6-board, in the title slot) and the hint slot must not say contradictory things.
4. **Old copy left behind.**
   - The gate captures still show "Turns the bolt 90°…" in the zoom shots. Make sure no player-facing string anywhere says bolt, fizzle, stem or arms.
   - Add a note to `docs/design/rules.md` that the player-facing noun is "charge".
   - Fix the `ui/codex-diagram.ts` header comment.
5. **Capture scripts.**
   - `scripts/playtest/mobile-4-chrome.spec.ts` "03-settings-end" should click the Graphics & Save tab.
   - `scripts/playtest/mobile-2.spec.ts` should add, for The Last Rune on each phone: zoomed with a gem held (`10-the-last-rune-zoomed`), and a fail verdict on a dense board.
6. **Your own newcomer pass.**
   - Run `M2_TAG=m6int` captures (the mobile-2, pm-review and mobile-4-chrome specs) on all four phones. Look at every shot as a first-time player.
   - Fix anything that overlaps, clips or contradicts within this scope.
   - List anything larger in your log for the PM; don't fix it.

## Out of scope
New features or restyles. This pass makes the existing pieces agree.

## Done when
- Everything above is done.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass, with flakes rerun and named in the log.
- The log lists your changes and the capture paths.

## Log

### 2026-11-03: mobile-6-integrate done (agent)

**Changes**
1. **Zoom teaching** (`scenes/altar/altar-scene.ts`, `updateZoomHint`). This uses `setHintLine('zoom', …)` and only applies on dense boards on phones in edit mode.
   - At the whole board it shows "Tap the board to zoom in" until the player first zooms. It also shows while a gem is in hand and the how-to line is not yet retired, because a tap at the fitted view zooms and places nothing, so "Now tap a socket" would be wrong there.
   - Zoomed, it shows "Drag to look around" until the player first pans.
   - A gem in hand beats the pan line. The how-to line then says "Now tap a socket", which agrees with the "Holding" pill.
   - The "taught" flags are per session (module state), not saved. Save flags are a fixed schema, so a new flag would be a `types.ts`/save change for the PM.
2. **Zoomed cards never cover a socket** (`scenes/altar/zoom.ts`: `socketHits`, `rectHitsCircle`, `clearSpot`; `scenes/altar/zoom-ui.ts`: `placeLabels`).
   - Each socket's tap circle has a radius of 0.42 pitch; the drawn rim is about 0.39. Each card, including every word in it, is measured.
   - A card whose gauge is in view takes the nearest spot (in 4 CSS px steps) that clears every open socket, every gauge, the edge chevrons and the cards already placed. It drops its notch when it has slid off its gauge (`data-free`).
   - A card whose gauge is off the view becomes a one-line chip, for example "Needs 20 →" or "← Gives 16". It sits at that edge and slides along it to a clear spot. Its sub-rows (note, got, strikes, storm row) are hidden.
   - Fallbacks: if no spot clears everything, sockets alone are cleared; failing that, the card is only clamped.
   - `tests/e2e/mobile-zoom.spec.ts` gained "zoomed cards never cover a socket; the zoom's hint lines" on the 4 phones. It covers every dense board at 9 zoom points, the-last-rune holding and after a pan, and the hint lines.
3. **The arbiter, zoomed and holding** (`tests/e2e/mobile-moments.spec.ts`).
   - The "one owner" test now also runs on the-last-rune zoomed against the column's corner. It checks four states: FUSE talking; a gem in hand with tip and FUSE; a fail after zooming; and zoomed again on top of the verdict.
   - `columnProblems` now includes the Holding pill.
   - The test asserts that the Holding pill shows while a gem is held, that the hint never says zoom, pan or "take a gem" under it, and that the pill goes once the gem is put back. No product change was needed: nothing overlapped.
4. **Old copy.**
   - Player-facing "bolt" became "charge" in the journal, the FUSE lines (`content/lines.ts`, with `docs/design/script.md` kept in sync) and the puzzle insights.
   - The "Turns the bolt 90°" tip text had already gone with mobile-6-moments.
   - `docs/design/rules.md` has a "Words the player sees" note: the player-facing noun is "charge".
   - The `ui/codex-diagram.ts` header and the `fizzle` field doc now say charge and lost.
5. **Capture scripts.**
   - `mobile-4-chrome.spec.ts` "03-settings-end" now clicks the Graphics & Save tab.
   - `mobile-2.spec.ts` adds `10-the-last-rune-zoomed` (gem held, zoomed) and `13-the-last-rune-verdict` (a fail on the dense board).
   - `pm-review.spec.ts` now runs on all four phones (promax and android added).
6. **Newcomer-pass fixes.**
   - Phone strike chips in a narrow Needs card broke as "1:" over "0". They now never break; they drop under "Strike" inside the card (`altar-styles.ts`, phone only).
   - Two used-up tray slots read "placedplaced" on SE. The "placed" label now uses the UI face, not mono (`ui/phone-styles.ts`).

**Captures** (M2_TAG=m6int; all four phones; under `docs/design/screens/local/m6int/`, git-ignored):
- `mobile-2/m6int/<phone>/*.png`, with sheets in `mobile-2/m6int-<phone>.png`;
- `pm-review/<phone>/*.png`;
- `mobile-4-chrome/m6int/<phone>/*.png`, with sheets in `mobile-4-chrome/m6int-<phone>.png`.

**For the PM (seen, not fixed: larger than this pass)**
- **FUSE pitch lines still say "bolt".** Four lines are verbatim from `docs/design/pitch-v0.3.md`, and `content.test.ts` enforces that:
  - boiler-room locked: "Needs a double bolt…";
  - storm-cell-2 arrive and solve: "Double the bolt…" and "Two bolts…";
  - capacitor-bay arrive: "Stores a bolt for later…".

  Changing them means editing the pitch, which is the owner's call.
- **Needs cards in the east gutter are narrow.** After a strike, the-last-rune's "Needs 20" card now stacks "Strike / 1:0 / 2:0" into a tall card (SE, android). It's legible, but the gutter card width (`PHONE_GUTTER_CARD`) could allow one row of strike chips.
- **At the whole board, a few fit-layout cards sit close to a ring.** The zoomed view is asserted clear, but the fitted view (mobile-6-board's `placePhoneLabels`) is not. For example, SE the-last-rune verdict: the "Needs 20 … Strike" card sits just right of the east socket.
- **A west off-view chip can sit inboard.** When the edge column is solid sockets (SE the-last-rune zoomed), the "← Gives 16" chip lands a socket's width in from the edge, because the edge spot is taken. It still points the right way.
- **Hall first visit on SE.** FUSE's welcome bubble sits over the bottom of the "Intake Desk" doorway label, and the label is clipped at the screen bottom (`mobile-4-chrome/m6int/se/02-hall-first.png`).
- **The column can drop the zoom line.** With a long gem tip (the Capacitor's two lines), the zoom line yields its slot, so a player holding a gem at the whole board sees only the tip. That is by design of the arbiter; flagging it in case the PM wants the zoom line to outrank tips.

**Checks:** `pnpm check` ✓, `pnpm build` ✓, `pnpm test:e2e` ✓ (114 passed, 2 skipped; no flakes on the final run. During development, the first version of the new mobile-zoom test failed on android because it measured the overlay once and the box shifts per altar; it is now measured at each tap).
