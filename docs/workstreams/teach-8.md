# Workstream: teach-8 (D-040 add. 11, majors A and C)

Read D-043, D-040 add. 10–11, and the logs in `teach-7.md` and `teach-6.md` first. Shots: `docs/design/screens/local/gate10/<phone>/` in the main checkout.

## Findings (blind review 10)
- **A (3 of 4).** "Needs 8 on strike 1 or 2" still reads as "on both" or "on either", and players can't tell whether the other strike can be anything. This is the third phrase to fail ("in one strike", "in either strike", "on strike 1 or 2"). "got 0, then 16 ✕" doesn't say which strike failed. The pre-Strike Capacitor plan "Strike 2 sends 16; needs 8" nearly solves the puzzle and is a forecast (D-043). "each lighting a mark" doesn't say what a mark is.
- **C (3 of 4).**
  - Splitter Mill's fixed Split appears with only FUSE's joke: no card, no "halves", no input side.
  - Foundry's Gate card has no picture.
  - "same strike" in the Gate sentence confuses players in single-strike rooms (Relay Tower, Foundry), and nothing says what one port alone does.
  - "Doubles the charge, once per path" never defines "path"; Furnace has two built-in Amplifies.
  - Hint panels on later altars show FUSE flavour instead of a rule.

## Rule (from the sim, rules/sim.ts ~446-466; recheck it)
Each strike, a gauge that hasn't woken reads that strike alone. Exactly its number wakes it, and later strikes don't count. More trips it. Less does nothing.

## Do
1. **One phrase.** Gauge note: "Needs 8 on one strike" ("on one strike" for any multi-strike count). On the multi-strike teach page and the Strike ×2 card, state the rule once in plain words, e.g. "Each strike is checked on its own. Exactly 8 on one strike wakes it. Less does nothing; more trips it." The verdict, codex, FUSE and a11y text use the same words. The note must stay within `PH.sideCardW2` (95), which should be easier since it is shorter. Keep `dense-board.spec` green on all four phones.
2. **Per-strike labels.** The result line names strikes, e.g. "1: 0 · 2: 16 ✕" (or "strike 1: 0, strike 2: 16 ✕" if it fits). It must read at SE size. Results only, after Strike.
3. **Capacitor plan.** Drop the pre-Strike numbers about this board ("Strike 2 sends 16; needs 8"). Keep the rule ("Strike 1: stores, sends nothing. Strike 2: lets out both.") with the strip picture. The marks: say "○○ = your 2 strikes" or equivalent where Strike ×2 is taught.
4. **Every piece taught on first sight.** The first time a gem type appears in an altar, whether fixed or in the tray, it gets its picture card. Splitter Mill gets a Split card even though the Split is fixed. Foundry's Gate gets the Relay Tower-style picture if the Gate first appears there in play order (check the hall order players actually take: Splitter Mill can be solved before Conveyor A). Prefer one code path: "not yet taught" flag per gem type in the save, not per altar.
5. **Gate sentence by strike count.** On single-strike altars: "Feed both round ports; their sum leaves by the arrow. One port alone: lost." On multi-strike altars, keep "on the same strike". The codex shows the general rule. Sides still come from `gateSides(rot)`.
6. **Amplify.** Define "path" plainly, e.g. "Doubles the charge once. Charge that has already been doubled passes through unchanged." Drop "path" unless it's defined.
7. **Hint panel.** When an altar opens with a gem type the player hasn't placed yet, the rule shows before FUSE flavour. Otherwise FUSE's line is fine.

Don't touch gem art or shaders (glyph-truth-4 is redrawing in parallel), and don't change the right column layout (dense-board-4 owns it). Copy and teach logic only.

## Done when
- `pnpm check`, `pnpm check:boundaries` and `pnpm build` are green. Run mobile-teach, altar-column, dense-board, mobile-strike, capacitor, strike-free and a11y, then a full `pnpm test:e2e` (rerun load flakes alone and name them). Use a unique `E2E_PORT_OFFSET`.
- `SHOTS=teach-8` on four phones. At real size, look at 10-splitter-mill, 10-foundry, 10-relay-tower, 10-furnace, 10-/13-capacitor-bay*, 15-capacitor-teach* and 10-the-last-rune.
- Don't run `BASELINE_UPDATE`; list the diffs. Commit to `ws/teach-8`, never merge. Log below.

## Log
