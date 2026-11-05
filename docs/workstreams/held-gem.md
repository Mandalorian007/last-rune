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
- **2026-11-04, held-gem agent.**
  - **A, held tray gem.** The pale wash came from paint laid over the canvas gem: the held slot's DOM ring and its gold radial fill sat inside the gem's own outline (on press-unit-4 at 667×320 the slot box is 28 css px against a ~40 css px gem). The DOM slot now paints nothing. The canvas draws the ring instead (`GemState` 'ring', shader state 7): the gem's own cut outline, turned with it, drawn *under* the gem and hugging its corners (`drawHeldRing` in altar-view.ts, sized from `art/gem-cut.ts`). Resting in its slot, the held gem is the tray's own copy, flat and turned to the hand's turn, so Turn turns the glyph and the octagon ring together. Tray gems not in hand reset to upright every frame.
  - **Ghost.** Over a socket it would land in, the held gem is drawn as a ghost (shader state 6): faint and flat, glyph readable, at its turn, in the socket. The loupe copies those pixels. A calm turned copy stays in the tray slot. A socket that already holds a gem is never snapped, so it gets no ghost.
  - **C, one arrow language.** On the gem, an arrowhead (`g_outlet`) always means out and an input is a round port (`g_inlet`). Split is 1 port and 2 arrows; Gate is 2 ports and 1 arrow, with no ring at its centre. The Codex and teach-card bolt diagrams (`ui/codex-diagram.ts`) now end an incoming bolt at a round port, not an arrowhead. Tray, board, loupe and portraits all use the same shader. At SE board size (~33 css px), Split and Gate read apart by their arrow count and their cut, so no bloom cut was needed.
  - **E, idle Amplify.** `scenes/altar/amp-idle.ts` reads the sim's own trace: an Amplify whose hop out carries the same charge as the hop in is idle. It is drawn unlit and dim (glow 0.45, never 'energised'), with no burst and no number, both in the live strike (altar-run.ts) and on the solve scene. `rules/` is unchanged. Unit tests check a two-Amplify Control Booth board and confirm that no shipped intended solution has an idle Amplify.
  - **Blocked cells.** On phones, a blocked cell inside the slab (`alt_inner`) is now filled flush with the slab's own stone (it joins `alt_hug`). Before, it was a sunk square with a front-face step, which read as a square socket. Blocked cells at the edge still show the wall. `huggedSlabDistance` mirrors this, and socket-looks.test was updated to match.
  - **Wall marks.** There were two causes on the wall blocks: `st_hewn`'s hatched tool-mark patches, and the wall's big edge bites landing deep inside a block as dark mortar holes. The wall now takes no tool marks (`st_hewn` has a new `tool` argument, set to 0 for the wall), and the big bites keep to the block edges.
  - **Tests.**
    - New `tests/e2e/held-gem.spec.ts`:
      - phone: the held Split is as saturated as at rest, and Turn changes >8% of the slot's pixels while still frames change <3%;
      - phone: the ghost sits at the aimed socket at the held turn, and a placed gem gets none;
      - desktop: the hover ghost turns with R;
      - desktop: an idle vs a working Amplify mid-strike.
    - glyph-truth-2 is extended: outlet counts are Split 2, Gate 1, and 0 for Channel, Bend and Amplify; a port is round.
    - codex-diagram.test: arrowheads = outs, ports = ins.
    - `amp-idle.test.ts` is new.
  - **For the PM / teach-7.** The Split card copy "Charge in at the plain end" no longer matches the glyph, which now has a round port on its input side. Suggest "Charge in at the round port".
  - **Merged main (57f16cf, teach-7 + polish-9).** It merged cleanly. The new Gate copy ("Both ports, same strike: the sum leaves by the arrow." / "Ports: ...") matches the Gate glyph: 2 round ports and 1 out-arrow. The Split copy in `content/codex.ts` (rule and chip) still says "plain end", which is still open for teach-7. The loupe ghost still works with polish-9's `spare`: the SE aim shots for lift-shaft and the-last-rune show the ghost in the loupe. A straight gem's ghost lies along the socket's run (`heldFace`), as it lands.
  - **Gates (after the merge).**
    - `pnpm check` is green (vitest 607 passed, 2 skipped), and so are `check:boundaries` and `build`.
    - Targeted e2e is 42/42: held-gem, glyph-truth 1/2/3, altar-column, dense-board and gauge-needle.
    - The full `pnpm test:e2e` is 195 passed, 20 skipped, 0 failed.
    - `SHOTS=held-gem` is 17/17.
    - Flakes before the merge, both passed alone with `--workers=1` or on rerun: `dense-board.spec.ts › se › dense boards se`, and `shots.spec.ts › android › ending android` (a trace ENOENT under a concurrent run).
  - **Baseline (no update run).** 125 of 129 differ, all pixel diffs between 0.11% and 2.6%. That is expected: the wall stone (no tool marks, bites kept to the block edges) sits behind every screen, which covers title, hall, settings, codex and ending. The altars also change through flush blocked cells, the port and arrow glyphs and the Codex ports. The largest diffs are crane and relay-tower at 2.6%. The PM should regenerate after review.
