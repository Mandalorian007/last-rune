# Workstream: glyph-truth-4 (D-040 add. 11, majors B and E)

Read D-040 add. 10–11 and the logs in `held-gem.md` and `glyph-truth-3.md` first. Shots: `docs/design/screens/local/gate10/<phone>/` in the main checkout.

## Findings (blind review 10)
- **B (regression from held-gem, 2 of 4).** In the codex (`04-codex`), the Channel and Bend diagrams (`ui/codex-diagram.ts`) end incoming bolts at a round port and outgoing bolts at an arrow. The language "round port = in, arrow = out" is right for Split and Gate. On two-way gems it says "one-way", which contradicts "whichever way it enters" and "either way". The board Channel has no arrows, so the codex and the board disagree.
- **E (Pro Max, plus Android's Capacitor note).**
  - At board size, the Split's round port reads as a soft white blob, the same weight as the facet highlight.
  - Split and Gate share a bulb-plus-arrow silhouette, told apart mainly by colour.
  - The Capacitor (pale blue) and Channel (cyan) are close. The Capacitor shows no straight-through line, so players can't tell which way it passes charge. Rule: it lets charge out "straight on", so it is two-way and straight like a Channel.

## Do
1. **Codex and teach diagrams.** Round port and arrow appear only on one-way gems (Split, Gate). Two-way gems (Channel, Bend, Amplify, Capacitor) show plain bolt ends, or matching ends on both sides, with the numbers. Update `codex-diagram.test.ts` so this is enforced per gem.
2. **Split port at board size.** Draw it as a hollow ring with a dark rim, clearly not a highlight, readable at SE pitch (~32 px). Same shader on tray, board, loupe and portraits.
3. **Split vs Gate.** Make the silhouettes differ at a glance, not just the hue: Split has 1 port and 2 arrows; Gate has 2 ports and 1 arrow. Say in the log what makes them read apart at 32 px.
4. **Capacitor.** Give it a visible straight-through line (like a Channel's run) and a shape or outline that sets it apart from the Channel by more than hue.
5. Keep glyph-truth 1/2/3 and held-gem specs green, and extend glyph-truth-2's per-gem checks with the codex rule from step 1.

Copy is teach-8's (don't edit content/), and the right column layout is dense-board-4's. Art and shaders only.

## Done when
- `pnpm check`, `pnpm check:boundaries` and `pnpm build` are green. Run glyph-truth*, held-gem, altar-column and dense-board, then a full `pnpm test:e2e` (unique `E2E_PORT_OFFSET`; rerun load flakes alone and name them).
- `SHOTS=glyph-truth-4` on four phones. At real size, look at 04-codex, 10-splitter-mill, 10-relay-tower, 10-foundry, 10-capacitor-bay, 10-control-booth and 12-press-unit-4-held-split(-turned).
- Don't run `BASELINE_UPDATE`; list the diffs. Commit to `ws/glyph-truth-4`, never merge. Log below.

## Log

**2026-11-04: done (ws/glyph-truth-4).**
- **B, codex rule:**
  - `GemDiagram.oneWay` (Split, Gate) is derived from the simulator: a gem is one-way when `acceptMask` at rot 0 refuses its own outs.
  - `diagramSvg` draws round ports (a hollow ring, `fill="none"`) and arrowheads only on one-way gems.
  - Channel, Bend, Amplify and Capacitor get plain bolts.
  - The plate CSS gives circles their own hollow rule.
  - codex-diagram.test checks `oneWay` against the simulator and counts ports and arrows per gem.
  - glyph-truth-2's per-gem loop checks that each glyph's `g_inlet`/`g_outlet` count matches its diagram (zero on two-way gems).
- **E, ports:**
  - `g_inlet` is a hollow ring: `abs(length - PORT_R)`, with r 0.2 set 0.32 in from the rim.
  - `g_port_hole` darkens the hole (×0.15 colour, ×0.05 bloom), so at about 32 px the port reads as an open ring with a dark rim, not a white blob.
  - The Split stem and the Gate bar stop at the ring.
  - In the ghost state the hole is see-through.
- **E, Split vs Gate at about 32 px:**
  - They differ by silhouette first:
    - Split: a wide hexagon, `sides 6, phase 0, scale (1.08, 1.0)`, pointed at both outs.
    - Gate: a pentagon shield, pointed at its one out.
  - Then by glyph:
    - Split: a ↔ double arrow over one ring.
    - Gate: an o–o ring-to-ring bar under one arrow.
  - Hue is the third cue.
- **E, Capacitor:**
  - A squat bar cut: `sides 4, phase TAU/8, scale (1.2, 0.86)`.
  - Glyph ‡: one straight line along its run through two plates.
  - Unlike the Channel's narrow pointed hexagon.
- **Kept in step:** GEM_CUT (gem-cut.test), plus the altar-ux, art-direction and materials README docs.
- **Merged main (polish-10, d0defc8).**
  - Its ghost block (~36%/58% with a dashed rim) and spent block (×0.68, 12% grey, bloom ×0.35) are intact.
  - held-gem's new ghost-vs-placed check failed after the merge (ghost luma 0.834 of placed, limit 0.8): my smaller Split hexagon (0.98) dimmed the placed gem.
  - Fixed in my lane: the Split hexagon was widened to (1.08, 1.0) and the port hole is open in the ghost. The threshold is untouched.
- **Gates:**
  - `pnpm check` green: engine 348, host 24, game 608 + 2 skipped.
  - `check:boundaries` ok; `build` ok.
  - After the merge: held-gem, mobile-teach, glyph-truth 1/2/3, altar-column and dense-board 63/63.
  - Full `pnpm test:e2e` before the merge (offset 883): 194 passed, 20 skipped, 1 failed. That one failure is `solve-truth › furnace, solved` (5 min timeout under load), which passed alone in 5.3 s.
  - Earlier load flakes that passed alone:
    - `dense-board › promax › loupe never covers the aimed socket`
    - `held-gem › desktop › Amplify … draws idle`
- **Baseline (not updated):**
  - 79 failed, 2 flaky, 48 passed.
  - Diffs are every altar empty/solved that shows a Split, Gate or Capacitor (archive, boiler-room, capacitor-bay, control-booth, conveyor-a, crane, foundry, lift-shaft, press-unit-4, relay-tower, roof-array, splitter-mill, storm-cell-2, the-last-rune) and the codex.
  - All are expected (new cuts, ports and plates). The PM regenerates after merging.
- **Shots:** `docs/design/screens/local/glyph-truth-4/{se,iphone,promax,android}/`. SE altars were reshot after the final cut.
- **PM notes:**
  - The teach card's `.lr-fig-bolt` has no circle CSS; it relies on the SVG's inline `fill="none"`/stroke.
  - Under placed-state bloom the Split's hole tints slightly pink at SE size, but it still reads open.
