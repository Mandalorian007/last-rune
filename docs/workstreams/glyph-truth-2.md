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

**2026-11-04: done (branch ws/glyph-truth-2).**

1. **Inlets.** gem-wgsl: new `g_inlet`, a solid half-disc port on the rim. The Split has one (south) and a heavy stem. The Gate has two (west and east), with leads into its ring. These replace glyph-truth's thin door bars. They are not arrows, so the Codex's "the end with no arrow" still holds. The tray uses the same shader. On an SE the Split reads as one dome and two arrows, the Gate as two domes, a ring and one arrow.
2. **Channel finding: not a rules bug, a render bug.** Straight gems are direction-free in the sim, but a straight gem the bolt hadn't reached rested facing the storm's axis. The picture drew it across its run on:
   - Lift Shaft's top and bottom rows;
   - Capacitor Bay's ice;
   - The Last Rune (7,1);
   - a player Channel by Splitter Mill's gauge.

   New `scenes/altar/rest-turn.ts` (pure, unit-tested) scores each axis by what its sides lead to: storm or machine, a turned gem's open side, a straight gem, an open socket. Unreached straight gems, placed or fixed, lie along the winning axis. Reached ones still face the hop. The held gem previews the turn it will sit at.
3. **One orientation.** Tray gems are always drawn at rot 0, upright as the Codex draws them. A built-in gem's teach-card figure is turned as the board shows it (the Capacitor card is now horizontal, like the ice).
4. **Disabled states.** Undo and Clear already set `disabled`; the look was the bug (gate 7 couldn't tell them from live buttons). Phone rail disabled is now an unfilled plate with a dashed edge and a muted label. Turn names its gem under the word (e.g. "Bend"), with a matching aria-label. The label is empty while Turn is disabled.
5. **Lock badge.** The teach leader tries the grid line nearer the card first. If a leg would cross any fixed gem's lock pip (it sits on the grid line below its socket), it takes the other line (`leaderPath(..., avoid)`, `lockPipBox`). The gold ring round the taught gem is now an arc that stops short of the pip, so no line or ring runs through the padlock.

Tests:
- vitest `rest-turn.test.ts` (6) and `leader.test.ts` (3);
- e2e `glyph-truth-2.spec.ts`, which checks:
  - Lift Shaft and Capacitor Bay axes, and tray rot 0 on all 16 altars;
  - Undo, Clear and Turn disabled, with a dashed look, and Turn's label;
  - inlet marks per kind in the WGSL.

Gates:
- check, check:boundaries and build: green.
- test:e2e: 166 passed, 20 skipped. Later reruns of mobile-teach, glyph-truth and glyph-truth-2 after the ring change: 28 passed.

`pnpm baseline` (not regenerated):
- Every altar scene differs, by 0.3–0.8% on desktop-720, desktop-1080 and iPad. The causes are the Split and Gate glyphs (board and tray), tray straight gems now upright, and straight gems now along their runs (largest: control-booth, the-last-rune, lift-shaft, roof-array).
- Title, hall, settings, journal and codex are unchanged.

Shots: `docs/design/screens/local/glyph-truth-2/{se,iphone,promax,android}`. SE and Android were re-shot after the ring change.
