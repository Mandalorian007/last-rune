# Workstream: mobile-6-board (the board reads at a glance: held, legal, wall, target)

## Background
Gate review 3 failed (6 / 6 / 6 / 6.5; D-040 addendum 4). The board-look issues the PM verified in `docs/design/screens/local/mobile-2/gate3/` and `.../pm-review-altars/`:
1. **Holding a gem barely registers (3 of 4 reviewers).** The tray tile is only slightly brighter, and the faint purple rings on navy are weak. The lit Turn button is the loudest cue, and it's on the far side (`*/12-relay-tower-held.png`).
2. **The rings mark a scattered subset of sockets** (`promax/12-relay-tower-held.png`, `se/12-relay-tower-held.png`). With a Bend held, every empty socket is legal, but only some are ringed. Visuals must match the rules (D-027). Find out why: a pulse phase, a ring-colour clash, or a real filter. Then fix it.
3. **Empty sockets vs slab.** Navy holes on a navy slab: it's hard to tell which cells exist (`10-archive`, `10-control-booth`, `06-press-unit-4`).
4. **Wall cut-outs look like glitches.** Black clipped rectangles inside the hugged slab (`android/10-archive.png`, `10-furnace`, `10-control-booth`, `20-solve`) read as rendering errors or dead sockets.
5. **Gauges are tiny.** The dial is 14–16 px and reads as a clock, the wire is 1 px, and the Needs plate changes side and crowds the top edge on SE (`pm-review-altars/se/07-storm-cell-2`, `09-boiler-room`, `12-capacitor-bay`, `16-the-last-rune`).
6. **×0 tray gems look broken or locked** (`06-press-unit-4`, `13-lift-shaft`, `16-the-last-rune`).
7. **Disabled Undo, Clear and Turn are so faint they look like glitches** (minor).

## Scope (phones first; desktop changes allowed only where they're a clear win, and called out with before/after at 1920)
1. **Held is unmistakable.**
   - The held tray tile lifts: it scales, gets a gold outline and a shadow.
   - A short "Holding: Bend" label (or the gem's icon) sits near the board or in the hint slot. Coordinate the slot with mobile-6-moments via the PM; propose, don't edit `moments.ts`.
   - Releasing is obvious: tap the tile again, or tap off the board.
2. **Rings = legal, exactly.**
   - Every socket where the held gem may go is ringed the same way: steady, high-contrast, not purple-on-navy.
   - Add a unit test that asserts ringed set == legal set for each gem kind on a few puzzles.
3. **Empty sockets read as holes**: a lighter rim or bevel, ≥3:1 against the slab.
4. **Walls read as wall.** Inside the slab, blocked areas are the same stone texture raised or recessed, with soft edges. No hard black rectangles or clipped corners. Check every altar on every phone.
5. **Gauges.**
   - The dial is ≥24 px on phones and reads as a meter, not a clock.
   - The wire to the board is ≥2 px and visible.
   - The Needs plate sits on a consistent side (outside the board, away from the screen edge) and never sits at y<8 px or touches another label.
6. **×0 tray gems** collapse into a clear "all placed" state (dimmed with a ✓, or removed if a placed count shows elsewhere). Your call; it must not look locked.
7. **Disabled rail buttons** read as disabled, not missing: ≥3:1 outline contrast with a dimmed label.

## Out of scope
- Zoom, the camera and touch mapping (mobile-6-zoom owns `zoom.ts`, the transform and the `cursor.ts` mapping).
- Tips, FUSE, teach cards and verdict layout (mobile-6-moments).
- Hall, menus and ending (mobile-6-chrome).

## File ownership
- **You own:** `socket-looks.ts`, the stone/socket shaders, gauge art, the tray look and the board-label styles in `altar-styles.ts` / `phone-styles.ts`.
- Keep `altar-scene.ts` edits small; mobile-6-zoom also edits it.

## Done when
- Everything above is fixed on all four phones, with `M2_TAG=m6board` captures plus `pm-review-altars` checked by you as a newcomer.
- Unit tests cover ringed == legal and the slab/wall mirror.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- Your log lists the changes and before/after file names.

## Log

### 2026-11-03: mobile-6-board done (agent)

**Ring subset cause.** `buildMarks` drew valid sockets as `'highlighted'` in the held gem's own HUM colour (purple for Bend). The intensity was 0.45 only when `isLive` (storm entry, machine exits, next to a placed gem or an open end), and 0.1 otherwise, which is invisible. They also shimmered (pulse). The result was low-contrast purple, and only near the circuit, so the ringed set looked like a random subset of the legal set.

**Changes**
1. **Legal = ringed, exactly (all platforms).**
   - New socket state `legal` (stone.ts id 7; stone-wgsl state 7) draws a steady pale-gold band with a dark key ring inside and out. It doesn't pulse, and its bloom is low (emissive 0.1).
   - `buildMarks` rings every cell in `legalSockets()` (socket-looks.ts, which wraps `validatePlacement`).
   - Unit tests (socket-looks.test.ts) check ringed == legal on every puzzle. mobile-budget item 15 now asserts that the first held measure rings every open socket.
2. **Held is unmistakable (phones).**
   - The held tray tile gets `data-held`: scale 1.22, a 2.5 px gold ring over a dark ring, a drop shadow and glow. The held gem is drawn at 1.16× size.
   - A "● Holding Channel" pill replaces the altar title while you hold a tray gem. It sits in the title slot, so moments.ts is untouched.
   - **Release:** tap the held tile again (new `press.again` path). Tapping off the board was already supported. pm-review asserts the second tap releases.
3. **×0 tray gems** show a dark disc with a pale ring and ✓, and the count reads "placed" (13 px, the budget minimum). The 3D gem is hidden (size 0) so it doesn't read as locked.
4. **Disabled rail buttons** (Undo / Clear / Turn): opacity 1, a 1 px #8f826b outline and label on the dark slab (about 4:1). The label is dimmed but legible.
5. **Empty-socket rim** (stone state 4): a pale lip at r 0.86–1.08, (0.74, 0.7, 0.62) × light, alpha 0.92. On the navy slab it measures well above 3:1 by eye (light grey on about #1a2030). There's no numeric probe; see the weaknesses.
6. **Walls inside the slab (phones).**
   - A solid cell with open cells on both sides in its row or column (`alt_inner`, mirrored by `recessCells()` and unit-tested) is now drawn as sunk slab stone: the same slate albedo, an fbm-wobbled soft edge, ao 0.9, and no front face.
   - It used to be a black rectangle. Outer blocked cells still let the slab hug the open cells, as in mobile-5.
7. **Gauges (phones).**
   - The machine dial switches to meter mode (negative seed): a larger face (R 0.6), no clock ticks, and a fill arc from 0 to the needle (amber under, cyan exact, red over).
   - A gold notch marks 100%, the needle is thicker, and the nameplate is dropped. It is about 24 CSS px on SE.
   - The conduit wire is the bright mode (≥2 px, brass ×3.2).
   - **Needs/Gives card:** the side is still picked by the cost search. The card top is clamped to ≥8 px below the visible top. A max-content width for below/above cards (to stop "in one strike" wrapping) was tried and reverted: it pushed the card within 8 px of the slab and broke the mobile-budget clearance check.

**Before/after (local, git-ignored)**
- **Phones before:** `docs/design/screens/local/mobile-2/pm-review-altars/{se,iphone}/NN-<id>.png` and `docs/design/screens/local/mobile-2/gate3/`.
- **Phones after:**
  - `docs/design/screens/local/m6board/pmr-6/{se,iphone}/NN-<id>.png` and `NN-<id>-held.png` (every altar, idle and holding);
  - `docs/design/screens/local/mobile-2/m6board/{se,iphone,promax,android}/`.
- **Desktop 1920 (rings only, the one desktop change):**
  - `docs/design/screens/local/m6board/desktop-before/relay-tower-held.png`: faint purple rings on about 8 of the 18 legal sockets, the rest bare.
  - `docs/design/screens/local/m6board/desktop-after/relay-tower-held.png`: a gold ring on all 18.
  - This is a clear win: desktop players couldn't tell where a gem may go either.
  - Desktop also gets the rim lip and the tap-again release (click the held tray gem to put it back). Gauges, walls, the held pill and ×0 are phone-only.

**Proposal to PM (moments.ts, not edited):** while a tray gem is held on phones, the hint slot could read "Tap a ringed socket · tap the gem again to put it back". For now the cue lives in the title-slot pill.

**Remaining weaknesses**
- **Sunk interior walls** still read somewhat as rounded boxes, not carved stone. The solve-scene furnace view shows the same.
- **The meter is only seen at empty fill** in the captures; partial, exact and over fill are not screenshotted.
- **The 'below' Needs card** can touch the bottom of the meter bezel on SE.
- **Rim contrast (≥3:1)** is judged by eye, not measured numerically.
- **The rings are bright gold on every legal socket.** On a nearly empty 6×4 board that's a lot of rings, which is intended but busy.

**Verification:**
- `pnpm check` passes (742 tests), and so does `pnpm build`.
- `pnpm test:e2e`: everything passes, including mobile-budget on all 4 phones.
- In one full run, `full-run.spec` machines 5–8 timed out waiting for `.lr-altar-verdict` after Relay Tower had already shown "restored". That's a timing flake: the spec passed 6/6 on rerun.
