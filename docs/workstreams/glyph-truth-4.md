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
