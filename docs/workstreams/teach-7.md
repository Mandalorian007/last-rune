# Workstream: teach-7 (D-040 add. 10, majors B and D)

Read `teach-6.md` and `fit-9.md` (logs) and D-043 first. Shots: `docs/design/screens/local/gate9/<phone>/` in the main checkout.

## Findings (blind review 9)
- **B (all four reviewers).** "Needs 8 in either strike" reads as "in each strike" or "in one of them". This is the second wording to fail (after "in one strike"). The fail card "Got 0, then 16; needs 8 in either strike" doesn't settle it. In `13-capacitor-bay-multi` only strike 2 shows on the board; strike 1 ("keeps 8, sends nothing") is text only. A second failing gauge (top, "Needs 2 got 0") goes unmentioned.
- **D (all four).** The Gate is explained two ways: Relay Tower's card ("from above and below… sum leaves to the right. From the left: lost.") vs Foundry's chip ("Feed both sides beside the arrow at once; sum goes out.").
- Minors: "keeps 8" is jargon, so say "stores 8". "Try again" replaces Strike after a miss and makes players fear it wipes the board.

## Rule (from the sim; check it)
A gauge wakes when any one strike brings exactly its number. A strike that brings more trips it.

## Do
1. **Gauge note.** Use "on strike 1 or 2" ("on any strike" with 3 or more strikes), or something clearer, tested against the rule. Keep the card width within `PH.sideCardW2` (95 px, fit-9) or update that constant and prove `dense-board.spec` stays green on all four phones. Update the verdict, the strikes and "Either strike" teach pages, the codex and FUSE to match, so the game uses one phrase.
2. **Per-strike result.** After Strike, on multi-strike altars, each gauge's result card shows what it got on each strike, e.g. "Needs 8 · 0, 16" with the matching strike marked ✓/✗, or two small slots that echo the ○○ on Strike. Choose whichever reads at SE size and say why in the log. This is a result, not a forecast; nothing appears before Strike (D-043).
3. **Verdict.** Name every gauge that missed, not just the first, and keep the "Try:" line for the main one.
4. **Strike 1 visible.** On the multi-strike result, the player can see strike 1 happen as well as strike 2: a toggle, a two-step replay, or the Capacitor showing "stores 8". Pick one and keep it within the column.
5. **Gate in one sentence** across the teach card, chip, codex and FUSE, matched to held-gem's new look (inputs as ports, arrow out), e.g. "Two ports in on the same strike; the sum leaves by the arrow." If it names sides, they must match the turned picture (`gateSides`).
6. "keeps" → "stores" everywhere. Replace "Try again" with something that says nothing is lost (e.g. keep "Strike"), consistent with D-043's free-strike stance.

ws/held-gem is redrawing gem glyphs in parallel. Don't touch shaders or gem art; coordinate copy only.

## Done when
- `pnpm check` (content tests), `pnpm check:boundaries` and `pnpm build` are green. Run mobile-teach, altar-column, dense-board and any verdict/strike specs, plus a full `pnpm test:e2e` (rerun load flakes alone and name them). Use a unique `E2E_PORT_OFFSET`.
- `SHOTS=teach-7` on four phones. Look at 10-/13-capacitor-bay*, 15-capacitor-teach*, 10-the-last-rune, 10-relay-tower and 10-foundry at real size.
- Don't run `BASELINE_UPDATE`; list the diffs. Commit to `ws/teach-7`, never merge. Log below.

## Log
