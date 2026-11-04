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
