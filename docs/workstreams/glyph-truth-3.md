# Workstream: glyph-truth-3 (Gate 2, blind review 8: D-040 add. 9 d)

Screens: /Users/matthewfontana/repos/last-rune/docs/design/screens/local/gate8/{se,iphone,promax,android}/ (git-ignored; read from the main repo). D-027: the picture must match the rule exactly.

## Findings
1. **Major: a lit Bend reads as a T.** In iphone/20-solve.png (Furnace solved), the purple Bends at row 1 col 1 and row 3 col 4 show a glowing elbow fitting or stub past the turn. They read as three-armed (┬ / T), but a Bend has exactly two arms. Also seen in 12-furnace-held, 12-relay-tower-held and 12-crane-held. Redraw it so the Bend is unmistakably two-armed in every state (idle, held, placed, lit, solved, tray, codex), with nothing on the two dead sides. Check the lit/solved bloom path especially (solved-board.ts / solvedLook).
2. **Minor: Split at small size.** The top facet reads as a third arrowhead, so the "plain end" is hard to spot (10-storm-cell-2 tray, 12-boiler-room-held, The Last Rune row 1). Make the input end read at tray size and at about 28 px sockets.
3. **Minor: built-in gems at small pitch.** On The Last Rune, Archive and Lift Shaft the direction of locked Split/Gate is hard to read. Raise contrast of the direction marks at small sizes.
4. **Minor: carved (blocked) cells look like glitches.** Torn, irregular edges; Furnace's top notch pokes past the board edge; Lift Shaft has a stub right of row 4 (10-furnace, 20-solve, 10-lift-shaft, 10-archive, 10-roof-array). Make them read as deliberate stone.

Stay in gem/socket/slab art (art/, shaders/, solved-board, rest-turn). ws/teach-6 (copy, cards), ws/dense-board-3 (layout.ts, loupe) and ws/polish-8 run in parallel.

## Done when
check, check:boundaries, build and test:e2e green. Add or extend a unit/e2e check that a Bend's lit glyph has no arm on its dead sides if feasible. `pnpm baseline`: list intended diffs (don't update). `SHOTS=glyph-truth-3`; look at 20-solve, 12-furnace-held, 10-the-last-rune and 10-furnace at real size on SE and iPhone. Commit to ws/glyph-truth-3 and never merge. Log here.

## Log

- 2026-11-04, branch ws/glyph-truth-3.
  - **Bend reads as a T (major):** the T came from the two door bars across the arm ends, which look like a crossbar under the solve bloom, plus a round centre core and body glow spreading past the off-centre elbow. In `shaders/gem-wgsl.ts` the Bend is now exactly two longer, thicker arms with no end bars. When lit, its hot core follows the glyph instead of a round blob. The body, edge line and spec dim on the two dead sides (`deadSide`/`bodyK`), so the bloom has nothing there to pick up. The solve now shows clean ┐ and └ shapes.
  - **Split's top facet (minor):** the octagon cut now puts a corner on each side (phase 0), so no star facet sits on N as a third arrowhead. The S inlet notch is unchanged, and glyph-truth-2's inlet counts still hold.
  - **Small-pitch direction marks (minor):** a `small` factor from `fwidth(local)` (render px across the gem, ramping between 84 and 44 px) cuts the glyph's soft glow and emissive spread and darkens the halo behind the glyph more. Direction marks on small locked gems (The Last Rune, Archive) stay crisp against the body.
  - **Carved cells (minor):** in `shaders/stone-wgsl.ts` (`altar_surf`, phone hugged slab only), the silhouette chips no longer reach inside the slab where it meets a recess. The recess has a straight, clean edge (no fbm). The slab and its recesses share one outline that is chipped once, so a recess at the edge ends at the board's outline. Furnace's top notch and Lift Shaft's row-4 stub are now plain square carved stone. Desktop slab: unchanged.
  - **Test:** `tests/e2e/glyph-truth-3.spec.ts` plays the real Furnace solve on a 915×360 phone and checks every lit Bend. On each dead side, the luma at 0.3 and 0.55 of the radius must stay below 0.75 and 0.6 of the dimmer lit arm. The old shader fails this: dead sides read 200–226 near the centre against arms of about 200. A second check confirms the Bend WGSL has no end bar.
  - **Shots:** docs/design/screens/local/glyph-truth-3/{se,iphone,promax,android}.
  - **Gates:** `pnpm check` (345 + 24 + 597 tests), `check:boundaries` and `build` all pass. Full `pnpm test:e2e` (offset 863): 178 passed, 4 timed out under load. Each of the 4 passed alone with `--workers=1`: mobile.spec "finger drag from the tray…" and solve-truth intake-desk, press-unit-4 and the-last-rune.
  - **Baseline, not updated:** 90 diffs, all intended. Every altar's empty and solved scenes changed on desktop-720, desktop-1080 and iPad (new built-in gem glyphs: Split cut, small-gem contrast; and lit Bends), plus the solve card. The hall first-visit scenes on both desktops and desktop-1080 intake-desk empty were flaky and passed on retry.
