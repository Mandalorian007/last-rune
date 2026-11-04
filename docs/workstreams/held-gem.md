# Workstream: held-gem (D-040 add. 10, majors A, C, E)

Read `glyph-truth-2.md`, `glyph-truth-3.md` and `dense-board-3.md` (logs) first. Shots from blind review 9: `docs/design/screens/local/gate9/<phone>/` (in the main checkout; copy what you need).

## Findings (blind review 9)
- **A (all four reviewers).** The held Split's tray icon washes to a pale disc inside a round ring that doesn't fit the octagon. `12-press-unit-4-held-split` vs `-turned` look the same at 3× zoom, so Turn seems to do nothing. The Bend is readable but also washed. Nothing shows the gem's orientation on the aimed socket before you drop it.
- **C (3/4).** At board size, Split and Gate read as the same cross of arrowheads, and the Gate's two input sides look like outward arrows. A player who learned "arrow = out" wires the Gate backwards (`10-relay-tower`, `10-foundry`, `10-crane`, `10-storm-cell-2`). The SE reviewer also blames bloom and facets washing the glyph.
- **E (iPhone).** "A second Amplify doesn't double again" is text only. On a lit path, a second Amplify glows like the first.
- Minors: blocked cells (Furnace r0c3, r1c1, r2c4; Control Booth) read as square sockets next to the square Bend. Dark marks on wall blocks (Lift Shaft, Control Booth, Roof Array, Archive) look like render glitches.

## Do
1. The held tray gem keeps its glyph at full contrast: put the selection glow behind it and make the ring match the gem's shape. Turn must make an obvious change at a glance, on all four phones and on desktop.
2. **Ghost.** While a gem is held and aimed (touch: the loupe; mouse: hover), draw it at its current turn on the target socket, faint but with its glyph readable, and show the same thing in the loupe. A real gem already on the socket does not get a ghost. Turn updates the ghost.
3. **One arrow language across every gem.** Arrows always mean "out". An input side is an inward port or notch, never an arrowhead. That gives Split = one port and two arrows, and Gate = two ports and one arrow, and the two must be tellable apart at 32 px on the SE. Cut bloom on their glyphs at small size if that's what washes them. Codex, teach-card pictures, tray, board and loupe must all match. Keep glyph-truth-2's and glyph-truth-3's inlet and arm tests green, and extend them.
4. **Idle Amplify.** On the live lit path (no numbers, D-043), an Amplify that won't double because this path already doubled is drawn idle: dim, no burst. Check against the sim; `rules/` stays pure and unchanged.
5. Blocked cells stop reading as sockets: they should read as stone or filled, not as square holes. Find what the dark marks on the wall blocks are and remove them.

## Done when
- `pnpm check`, `pnpm check:boundaries` and `pnpm build` are green. Run the specs you touch plus glyph-truth*, altar-column and dense-board, and a full `pnpm test:e2e` (rerun load flakes alone and name them). Use a unique `E2E_PORT_OFFSET`.
- New e2e: the held tray glyph differs clearly before and after Turn (a pixel or DOM measure); a ghost shows on the aimed socket at the held turn; an idle Amplify draws differently from an active one on a board with two on one path.
- `pnpm baseline` diffs are expected (glyphs). Don't run `BASELINE_UPDATE`; list the diffs in the log.
- `SHOTS=held-gem` on four phones. At real size, look at 12-press-unit-4-held-split/-turned, 12-*-aim, 10-relay-tower, 10-foundry and 10-furnace.
- Commit to `ws/held-gem`, never merge. Log below.

## Log
