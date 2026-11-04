# Workstream: glyph-truth-2 (Gate 2, blind review 7 orientation)

Source: D-040 addendum 8; D-027 (visuals match the rules exactly). Shots: `docs/design/screens/local/gate7/` in the main repo. Key files: 10-crane, 10-foundry, 10-archive, 10-the-last-rune, 10-relay-tower, 12-boiler-room-held, 12-control-booth-held, 10-splitter-mill, 12-splitter-mill-held, 12-lift-shaft-held, 10-capacitor-bay, 14-intake-desk-teach-2, 15-capacitor-teach-2.

## Do
1. **Split and Gate inputs survive at board size.** The Split's plain (input) end and the Gate's two input sides get a distinct inlet mark (a notch or coloured inlet) that still reads at a 26 px pitch under the glow; Split and Gate must not look alike. Tray icons the same.
2. **Channels are drawn along the run.** First check rules vs render: are the locked Channels at Splitter Mill r2c1 and the Lift Shaft top/bottom rows drawn across the wire they sit on? If the render is wrong, fix it (a render bug, like solve-truth). If the rules are right and the picture is right, write down why it looked wrong and make it unambiguous.
3. **The tray Channel icon has one orientation** on every level (or matches the orientation it will be placed in, and says so). Same for the Codex and teaching diagrams vs the board (the Capacitor card flows vertically while the board gem is horizontal).
4. **Disabled states.** Turn, Undo and Clear show disabled when they would do nothing (nothing placed, nothing to undo, held gem cannot turn). Turn makes clear what it acts on (the held gem; label or highlight).
5. **Lock badge is one icon.** The teach callout's leader line routes around the lock badge, and a highlighted fixed gem keeps the padlock (no ⊘ look).

ws/dense-board (column/board sizing, badge placement relative to neighbours) and ws/teach-5 (copy, cards, strike button) run in parallel: stay in glyphs, gem/tray rendering, the lock badge icon, leader lines and the Turn/Undo/Clear states.

## Done when
- check, check:boundaries, build, test:e2e green; extend glyph-truth.spec (or add one) for the inlet marks, disabled states, and Channel orientation on the named altars.
- `SHOTS=glyph-truth-2` regenerated; you looked at the named altars on SE and Android at real size.
- `pnpm baseline`: list intended desktop/iPad diffs; don't regenerate.
- Commit to ws/glyph-truth-2, never merge. Log here.

## Log
