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
