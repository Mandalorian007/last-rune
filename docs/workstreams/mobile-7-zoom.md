# Workstream: mobile-7-zoom (zoom keeps context)

Gate review 4 failed at 6.4 (D-040 addendum 5). All three altar reviewers say dense boards are too small at the fit view, and that zoom loses context. Zoom stays: the board is limited by height. Your job is to make zoom feel like a feature. Evidence: `docs/design/screens/local/mobile-2/gate4/*/10-the-last-rune-zoomed.png`, `13-the-last-rune-verdict.png` and `15-capacitor-teach.png` (android vs promax).

## Scope
1. **Minimap while zoomed.** Show a small whole-board overview in a corner that's free on every phone (take it from the right column's spare space; don't cover sockets). It shows the viewport rectangle, the source, the gauges and the placed gems. Tapping it jumps there. It is hidden at the fit view.
2. **Edge chips in a gutter.** When zoomed, off-view Gives/Needs chips sit in a reserved edge gutter outside the cell area, never over cells. The same goes for on-view cards: no cell is covered (extend the existing e2e).
3. **No half-cropped source or gauges.** Pan clamping keeps them either fully in view or fully out (and shown as a chip).
4. **Edge arrows** are ≥28 px, high contrast and tappable (each pans one step).
5. **The Holding pill never touches Menu**, on any phone (`03-splitter-mill-held` on iphone). Add an e2e gap check (≥8 px).
6. **Consistency.** The Zoom button and hint follow one rule across phones. Explain why Capacitor Bay showed Zoom on android but not promax, and make it consistent (offer zoom whenever the fit pitch is under 44 px).
7. **The zoom hint points at the board.** "Tap the board to zoom in" should visually connect to the board, e.g. a small magnifier badge on the board corner.

## Ownership
`zoom.ts`, `zoom-ui.ts`, the zoom transform in `altar-view.ts`, and tests/e2e/mobile-zoom.spec.ts. Keep `altar-scene.ts` edits small: mobile-7-teach and mobile-7-strike also touch it.

## Rules
- Phones first: iphone 844×340 (47 px insets), se 667×320, promax 932×380 (59 px insets), android 915×360. Desktop and iPad may not regress; show a 1920 before/after if you touch them.
- `engine/` has no game nouns, and `rules/` stays pure. Use pnpm only. Propose changes to `types.ts`, the save schema or DECISIONS to the PM; do not edit them.
- Captures go to `docs/design/screens/local/` (git-ignored, never committed). Use the existing specs: `M2_TAG=<tag> M4_TAG=<tag> pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2 pm-review mobile-4-chrome`.
- Review your own captures as a first-time player asking "is this a highly polished, intuitive, mobile-supported interface?" before you report.
- Commit to your own branch `ws/<name>`. Never merge to main. Log what you did, and any larger issues left open, in this file.

## Done when
- Every scope item is fixed on all four phones, verified in your captures, and covered by an e2e or unit assertion where it can be measured.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` are green.
- The log lists what you changed and gives capture paths.

## Log


### 2026-11-03: all seven items (branch `ws/mobile-7-zoom`)

Changes (zoom.ts, zoom-ui.ts, altar-view.ts `drawMasks`, small hooks in altar-scene.ts):

1. **Minimap.** While zoomed, a minimap (`.lr-zoom-map`) sits at the foot of the right column, left of Strike and right of FUSE. It is at most 104 CSS px tall and 56 px at the smallest, and is never over the board. It draws the slab, sockets, source (blue), gauges (gold), placed and fixed gems in their colours, and the viewport, a gold rectangle. Tapping or dragging on it moves the view there (instantly while dragging, then it settles). It is hidden at the whole board. `arrangeColumn` treats its top as the column's floor, and it steps aside if a card too long for the column would run onto it.
2. **Gutter.** Zoomed, a 34 CSS px gutter (`GUTTER_CSS`, `cellRect`) frames the cells. It is drawn as darkened wall with a faint gold rule. When a gauge leaves the cell area, its card shrinks to a one-line chip in the gutter with an arrow (↑ ↓ ← →): north and south chips sit under their gauge, east and west chips at that end of the nearer gutter. Chips avoid the arrows. On-view cards avoid only the sockets the cells show. A press or tap in the gutter never places a gem.
3. **No half-cropped props.** Clamping is now against the cell area. `settleCam` makes the smallest move that leaves the source and every gauge wholly in or wholly out of the cells. It runs on zoom-in, after a pan (on release; the finger itself is followed exactly), after arrow steps and after minimap taps. Unit test: a 13×9 grid of zoom-in points never crops a prop.
4. **Edge arrows** are now 32 CSS px `<button>`s, gold on a dark disc, centred in the gutter. Each tap pans 60 % of the cell area (`stepCam`, settled). The e2e checks ≥28 px, the direction and that they sit off the cells.
5. **Holding pill vs Menu.** `keepClearOfMenu` (zoom-ui.ts, called from `refreshHud`) slides the pill left until it is 8 CSS px clear of Menu. In the e2e, every tray gem is held on Splitter Mill and The Last Rune with a gap ≥8 px; iphone splitter-mill measured exactly 8 (it was touching before).
6. **Consistency, and why Capacitor Bay differs.** The rule (zoom when the fitted pitch is under 44 CSS px) was already applied the same way on every phone. Capacitor Bay fits at 44.1 px on promax (380 px tall) and 41.0 px on android (360 px tall), so only android gets Zoom. Lift Shaft is the same; Control Booth zooms only on iphone (43.4 px). The old e2e table was misleading because it measured the overlay scale once, at the hall. It now measures it per altar and asserts `zoomable ⇔ fit < 44` on every altar and phone. Fit pitches are logged by `scripts/playtest/mobile-7-zoom.spec.ts`. The zoomed pitch is now 48 CSS px (was 52), for more context; it is still ≥44.
7. **Zoom hint points at the board.** At the whole board a 32 px magnifier badge (`.lr-zoom-badge`) sits just outside a free corner of the slab, clear of gauges and cards. It pulses while "Tap the board to zoom in" shows (a static ring under reduced motion), and tapping it zooms. The hint line carries the same magnifier icon.

Tests: `zoom.test.ts` covers the gutter, settle (no crop), arrow steps, and tolerance on the tapped point. `tests/e2e/mobile-zoom.spec.ts` covers per-altar k with the zoom rule, sockets checked only in the cells, chips off the cells, no crop at the nine zoom points, and a new test for the arrows, minimap, badge and Holding pill on all four phones.

Captures (`M7_TAG=<tag> pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-7-zoom`): `docs/design/screens/local/mobile-7-zoom/before/<phone>/00–05`, `…/after/<phone>/00–09`.

Desktop and iPad: no change by construction. Every change is behind `L.phone` or `zoomable` (`cellRect` equals `viewRect` off phones; the minimap, badge and pill shift exist only on phones), and the full e2e suite runs the desktop specs.

Open issues:
- The minimap on se is small (about 90×60 CSS px) because of the room between FUSE and Strike. It is readable, but a PM should judge it on a real device.
- An east chip and a south chip can share the bottom gutter side by side ("Needs 20→ ↓ Needs 2" on se). They are separate pills and do not overlap, but they read close together.
- The badge sits at the slab's bounding-box corner. On cross-shaped boards (Capacitor Bay) that corner can be some way from the nearest socket.
