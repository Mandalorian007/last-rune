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

### 2026-11-04: teach-8 done (branch ws/teach-8)
I rechecked the rule against sim.ts: each strike, an unwoken gauge reads that strike alone. Exactly its number wakes it, more trips it, less does nothing.

1. **One phrase.**
   - Gauge note: "Needs 8 on one strike" (`needNote`, no-wrap pair added). It fits `sideCardW2`, and dense-board is green.
   - The one plain rule is `ONE_STRIKE_RULE` (altar-defs): "Each strike is checked on its own. Exactly the gauge's number on one strike wakes it. Less does nothing; more trips it."
   - The rule shows on the multi-strike teach card and in the Strike ×2 briefing (a11y). The either/strikes codex rows and the FUSE story ("Each strike is checked on its own: strikes never add up.") use the same words. Hints drop "on the same strike" on one-strike altars.
2. **Per-strike labels (after Strike only).**
   - Verdict, on a trip: "Strike 2: 16. Needs 8 on one strike."
   - Verdict, otherwise: "Strike 1: 0 · 2: 4. Needs 8 on one strike."
   - Phone result card: "strike 1: 0 · 2: 16 ✕".
   - a11y: "strike 1: 0, strike 2: 16" (`readingsText`).
   - It reads at SE size. The trip-only verdict keeps the Try line on SE.
3. **Capacitor plan.**
   - Before Strike the lines carry no numbers: "Strike 1: stores, sends nothing." / "Strike 2: lets out both." / "Strike N: stores, never lets out." (`capBeatText(b, pulses, plan=true)`).
   - Live lines after Strike keep their numbers.
   - Marks: the strikes page now reads "○○ = your two strikes. One tap sends both. A miss resets for free."
4. **Every piece taught on first sight.**
   - The save gains an optional `codex.taught` (gem → the altar whose card showed it). It is marked when the arrival cards open.
   - `newGems(p, solved, taught)` treats a gem taught at another altar as seen. It adds a `remind` list: kinds on this altar that were never in the player's hand.
   - Remind pages are labelled "Again" ("Reminder" overflowed the head row on iPhone/promax). They get picture cards, the fixed gem's cell leader, and FIXED_NOTE only when the gem is fixed.
   - This is one code path for fixed and tray gems, whatever the play order.
   - Results: Splitter Mill now gets a Split card. Foundry gets the pictured Gate card if Relay Tower hasn't taught it. Conveyor A (fixed Amplify), Press Unit 4 (tray Amplify) and Roof Array (tray Capacitor) get reminder pages where the old logic showed nothing.
   - "Turns" pages carry no picture (they clipped).
5. **Gate by strike count.**
   - One-strike altars:
     - Rule: "Feed both round ports; their sum leaves by the arrow. One port alone: lost." The sides still come from `gateSides(rot, pulses)`, e.g. "…round ports, left and right; …".
     - Chip: "Feed both round ports: the sum leaves by the arrow."
   - Multi-strike altars keep "on the same strike". The codex keeps the general rule.
6. **Amplify.**
   - Rule: "Doubles the charge once. Charge that has already been doubled, even split since, passes through unchanged."
   - Chip: "Doubles the charge once. Already doubled: passes unchanged."
   - Teach page: "Doubles the charge once."
   - "path" is gone. rules.md and script.md are updated.
7. **Hint panel.** Every first-seen gem, fixed ones included, now gets an arrival card, and the cards already hold FUSE (`holdFuse`). So the rule shows before FUSE's flavour line on any altar that opens with an unplaced gem kind.

8. **Control Booth's Capacitor (PM add-on, from polish-10).**
   - Control Booth is the only one-strike room with a Capacitor in the tray. On a one-strike altar, `newGems` now always lists the Capacitor in `remind`, even for a player who has held one. So Control Booth opens with a pictured "Again" Capacitor card that reads: "One strike here: what a Capacitor stores never comes out." There is no strike strip, since there is no strike 2 and the strip made the card too wide on the SE.
   - The held or hovered chip reads: "Stores its first charge. One strike here: it never comes out."
   - The full info rule and the a11y briefing append the same line (`CAP_ONE_STRIKE` / `CAP_CHIP_ONE` in codex.ts). This is covered by a unit test, and altar-column is green on all phones.

**Gates**
- `pnpm check`: 609 unit tests passed, 2 skipped.
- check:boundaries and build are green.
- Targeted e2e is green: altar-column, mobile-strike, capacitor, mobile-teach, dense-board, strike-free(-2), a11y.
- Full `pnpm test:e2e`: 194 passed, 20 skipped, 1 failed. The failure was held-gem "an Amplify the bolt passes already doubled draws idle" (a waitForFunction timeout under load). Rerun alone it passed (4/4), so it is a load flake.

- After the Control Booth add-on:
  - `pnpm check`: 610 unit tests passed, 2 skipped.
  - Rerun is green: altar-column (12/12), dense-board, mobile-moments, glyph-truth, held-gem, full-run, mobile-teach, capacitor and a11y.
- Shots: `SHOTS=teach-8` (17 passed) wrote `docs/design/screens/local/teach-8/{se,iphone,android,promax,portrait}/` in this worktree. I reviewed them on the SE at real size:
  - Splitter Mill: "Again" Split card with its picture.
  - Relay Tower: pictured Gate card, "above and below; One port alone: lost."
  - Foundry: Gate in the tray, rule without "same strike". It has no picture because Relay Tower taught it first in the shot's play order.
  - Capacitor Bay before Strike: no numbers.
  - Capacitor Bay after Strike: "strike 1: 0 · 2: 16 ✕", "Strike 2: 16. Needs 8 on one strike."
  - Capacitor teach: "○○ = your two strikes".
  - The Last Rune: "Needs N on one strike".
  - Control Booth: one-strike Capacitor card.

**For the PM**
- (a) The new optional save field `codex.taught` is backward compatible: a missing value means nothing is taught yet. It is cross-cutting and needs a DECISIONS entry.
- (b) I kept the plan's planOver warning (red gauge and line before Strike). It is arguably a forecast under D-043. Your call.
- (c) The reminder pages add one card at Conveyor A, Press Unit 4 and Roof Array for players who never held that gem. Control Booth now always opens with its one-strike Capacitor card.
- (d) Baseline: not updated. Diffs above the 0.1% tolerance are the expected teach-card and copy changes:
  - Conveyor A, Press Unit 4, Relay Tower, Lift Shaft and Control Booth: about 2-3.5% (new or longer arrival cards).
  - Capacitor Bay, Roof Array and The Last Rune: 0.2-0.9% (plan and verdict copy).
  - Furnace, Crane, Boiler Room, Intake Desk, Foundry and Splitter Mill (720): 0.17-0.35%.
  - hall-mid (720): 0.34%.
  - desktop-1080 capacitor-bay-empty showed a one-off 79.6% (first try), then 0.29% on retry: a load glitch.
  - The baseline ran before the Control Booth card was added, so Control Booth will differ a little more.

### 2026-11-04: PM decisions applied (D-045; planOver cut)
- I merged main into ws/teach-8 (glyph-truth-4 and polish-10). There were no conflicts. codex.ts keeps both my copy and glyph-truth-4's diagram code.
- (a) `codex.taught` is approved as D-045. The PM writes the DECISIONS entry.
- (b) The pre-Strike forecast is removed (D-043):
  - `planOver` is deleted. Nothing sets `data-warn` any more, and its CSS is gone.
  - The "Red dot: this gauge will trip." line is gone (`LAMP_LINE.over`, `lampTeach.over`).
  - The dot legend's red row is gone. The legend now reads: "The dot on a gauge: No dot: no charge yet · Lit: charge reaches it".
  - Results after Strike are unchanged.
  - Updated tests: strike.test, teach.test, capacitor.spec (asserts no `[data-warn]` and no "trip" before Strike) and mobile-teach.spec (legend rows `['off','on']`).
- (c) The Again pages are approved.
