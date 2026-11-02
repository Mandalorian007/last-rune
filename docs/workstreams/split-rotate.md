# Workstream: split-rotate (wave 5, top priority, D-031, D-027)

## User decision (verbatim, 2026-11-02)
> not intuitive. I would rather it be one input and rotate like everything else … or even multi directional, but able to be rotated. weird we can't rotate

The PM chose **one input, rotatable** (D-031). A Split that takes any side can't meaningfully turn, so "rotate like everything else" means it has one input side.

## You are authorised (PM) to change the rules
This means `games/last-rune/rules/` (model, sim, solver, `isRotational`, `types.ts`) and `docs/design/rules.md` §4. Keep `rules/` pure TS.

## Goal
1. **Rules.**
   - A Split has `rot`. Its input side is S/W/N/E for rot 0/1/2/3, the same convention as Gate (rot 0: inputs W and E, output N). The Split is the inverse of a Gate: rot 0 takes input from S and outputs W and E.
   - A bolt entering from any other side fizzles, as at a Bend.
   - Halving and odd-charge rules are unchanged.
   - Update rules.md §4, including the "left side first" ordering note in §5/§6.
   - Update tests.
2. **Puzzles.** Every puzzle with a fixed or tray Split:
   - Fixed Splits get the rotation the intended solution needs. Check whether the puzzle board notation (`*S`, `S`) needs rotation syntax.
   - Tray Splits now cost a turn decision, so re-run the solver and difficulty checks (`pnpm puzzle <id>`, `difficulty.test.ts`, `solve.test.ts`, `finale.test.ts`).
   - Keep the curve (D-022): if a puzzle gets too hard or its solution count changes a lot, retune it lightly.
   - List every puzzle with old → new solution count and score.
3. **Visuals match the rules exactly.**
   - New Split glyph (`shaders/gem-wgsl.ts`): one clear input stub and two output arrows (a T), readable at a glance like the Bend's door ticks.
   - Turning a Split shows the same as turning a Bend: turn badge on first tray appearance, preview swings, "R or scroll to turn".
   - Remove the "in" tag and the "Can't turn: the bolt splits left and right" tag; Split now turns.
   - Card, Codex (`content/codex.ts`) and announcement text: e.g. "Split: the bolt comes in the open end and leaves by both arms at half charge each."
   - The tray Split shows rot 0, as Bend and Gate do.
   - Check `ghost` / route preview / `turnAt` / `isRotational` callers and the FUSE altar lines that describe Splits (`content/lines.ts`, `docs/design/script.md`).
4. **splitter-mill:** with the fixed Split now one-way, make sure the layout still teaches cleanly (storm on N, machines W and E).

## Done means
- `pnpm check`, `pnpm build` and `pnpm test:e2e` all green, including full-run (all 16 machines solvable by keyboard).
- Fresh-eyes screenshots of splitter-mill, storm-cell-2, conveyor-a and press-unit-4, plus any other Split puzzle you changed: arrive, Split in hand turning, wired route. Put them in your scratchpad and list them.
- Log progress here. Report the rule diff, the puzzle table and any text changes.

## Progress log
- **Rules.** The Split is rotational (`isRotational`). `acceptMask` = `1 << ((rot+2)&3)`: input from S/W/N/E for rot 0/1/2/3, outputs `rot+3` then `rot+1`. Any other side fizzles as `facing`. ASCII tokens are now `S0`–`S3`; a bare `S` is a parse error. Solver, difficulty bot, sim tests and strike tests are updated. New tests cover the one-input rule and the rot-0 halves going W then E.
- **Puzzles.** All 14 Split puzzles are rotated using the old-rules trace, so every intended route is unchanged. Only conveyor-a's solution count moved (8 → 4). Every score is inside its band, so nothing was retuned. Total time is 52.5 min (was 53.5). There is a note in `design/difficulty-curve.md`.
- **UI.** The Split glyph is now a T: a stem with a door bar, and two arms with outward arrowheads. The gem's apex points at the input. Turning shows the turn badge, the "R or scroll to turn" chip and the swinging preview. Removed the "in" pill and SPLIT_CARD. A fixed Split says "Can't turn: fixed in place". The announcer says "in from X, out Y and Z". `guideHops` draws stubs for Split input and outputs. The Codex rule is rewritten.
- **Docs.** Updated `design/rules.md` §4/§6 and `design/altar-ux.md`.
- **Playtest.** New spec `scripts/playtest/split-rotate.spec.ts` covers every Split altar: arrive, fixed hover and R, the tray Split in hand at rot 0–3, placed, route, strike. The glyph sheet adds the-last-rune.
- **Checks.** `pnpm check`, `pnpm build` and `pnpm test:e2e` all pass (25, full-run included).
- **PM review (D-027).** The trillion cut was the dominant shape and its apex pointed back at the input, so a fed Split read like an arrow against the flow. Fixes:
  - The Split is now an octagon with flat sides on all four sides, so the cut points nowhere.
  - The T is bold, heavier than the other glyphs: a stem from the input rim to the centre, a rim-to-rim crossbar and wide outward arrowheads. Nothing points at the input.
  - The route preview now puts a small red ✕ where it stops at a wrong-facing Bend, Gate or Split, on the side the bolt meets (`updateNoGo`, `.lr-altar-nogo`).
  - Updated the docs (`altar-ux.md` and the materials README).
