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

### 2026-11-04: done (teach-7 agent)
- **Sim confirmed** (rules/sim.ts ~446-466): each strike, an unwoken gauge reads that strike alone; == need wakes it (later strikes unrecorded), > need trips it. No sim change.
- **1. Gauge note:** "on strike 1 or 2" ("on any strike" at 3+), `needNote`. Same phrase on the verdict ("Got 0, then 16; needs 8 on strike 1 or 2."), the teach "either" page (title "Strike 1 or 2"; rule "A gauge wakes when strike 1 or strike 2 brings exactly its number; one is enough. A strike that brings more trips it."). `keepTogether` keeps the phrase on one line. The note is set a touch tighter on phones (letter-spacing -0.1px, word-spacing -0.1em) so the Last Rune's east card stays within `PH.sideCardW2` 95 (at 95 untightened, and at 99, the card dropped under its gauge on iPhone/Pro Max in dense-board); sideCardW2 unchanged.
- **2. Per-strike result (phones, multi-strike, after charge lands):** the card's second line is "got 0, then 16 ✕": each number in its outcome colour, ✓ on the waking strike, ✕ on the tripping one; a strike still landing shows uncoloured with no mark. Never before Strike (D-043). Desktop keeps its "Strike 1: 0" chips. Result cards run ~100 CSS px wide on Capacitor Bay (east gauge, room to spare); pre-Strike fit is unchanged.
- **3. Verdict:** new line under the strikes line, `alsoMissed`: "Also missed: Needs 2, got nothing." (or the readings). The Try line still names the main gauge.
- **4. Strike 1 visible:** phones keep an ice-blue "stores 8" chip on the Capacitor (half a pitch above, below on the top row) from the moment strike 1's charge lands through the result; cleared on edit.
- **5. Gate sentence:** `GATE_RULE` = "Both ports, same strike: the sum leaves by the arrow." It is the codex chip, starts the codex rule (+ "One port alone, or charge at the back, is lost."), and the fixed-Gate teach card adds "Ports: above and below." / "left and right." from `gateSides(rot)`. Cause: "Gate needs both ports fed on the same strike"; Try: "feed the Gate's other port on the same strike." The longer "Feed both ports on the same strike; ..." and naming the arrow's side both clipped the SE's Crane/Relay Tower cards (altar-column).
- **6.** "keeps" → "stores" everywhere (codex, strip "Strike 1: stores 8, sends nothing.", plan read-out, story, FUSE line "Stores a charge for later. Ice stores things. That's what ice is for." in lines.ts and script.md). Strike no longer reads "Try again": it stays "Strike ×2" with its marks unlit; subtitle/announcer "Change anything and strike again."
- **Flag for PM:** the pre-Strike Capacitor plan still says "Strike 2 sends 16; needs 8." (teach-5/altar-truth); forecast-like under D-043, untouched here.
- **Gates:** `pnpm check` (598 game unit tests + engine), `check:boundaries`, `build` green. Full `pnpm test:e2e` (E2E_PORT_OFFSET=853): 189 passed, 20 skipped, 0 failed, no flakes. Targeted runs (mobile-teach, altar-column, dense-board, mobile-strike, capacitor, strike-free, a11y) green.
- **Baseline (not updated):** 30 diffs, all expected copy changes, in desktop-720, desktop-1080 and ipad, empty + solved: relay-tower and crane (the Gate chip/teach sentence), and capacitor-bay, roof-array and the-last-rune (the gauge note "on strike 1 or 2"). 3 flaky retries passed (desktop-720 intake-desk, press-unit-4, storm-cell-2, empty).
- **Shots:** docs/design/screens/local/teach-7/{se,iphone,promax,android}/ (git-ignored). SE checked at real size: 13-capacitor-bay-multi (per-strike card, "stores 8" chip, Also missed line, full Try line), 10-the-last-rune, 10-relay-tower, 10-foundry, 15-capacitor-teach.
