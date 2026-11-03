# Workstream: difficulty-2 (difficulty-fun phase 2, PM judgement)

User (2026-11-02): "make judgements for quality and focus on polishing things up". The user will playtest when they have time. Until then, the PM's judgement stands in for playtest data. Background: `docs/workstreams/difficulty-fun.md` (phase 1), D-020, D-021, D-022, D-026, D-031, D-033, `docs/design/rules.md`.

## Goals
The 16 puzzles should feel like a curve:
1. Each early puzzle teaches exactly one idea with no mystery.
2. Each mid puzzle has one "aha".
3. Late puzzles combine ideas.
4. No puzzle is loose enough to be solved by flailing.
5. No puzzle is a tedious grind.

## Scope
1. **Solver scores turn choice** (open follow-up from split-rotate/turn-clarity). Since D-031, Bend/Gate/Split rotation is part of the answer. Count orientation decisions in the difficulty/score model, and in the novice bot where cheap. Re-run metrics for all 16.
2. **Tighten the loose puzzles.** conveyor-a, press-unit-4 and capacitor-bay have 8–11 canonical solutions. Aim for ≤4 unless a puzzle is deliberately an open sandbox (justify it in the log). Use blocked sockets, fixed gems and tray counts, and keep each puzzle's teaching intent.
3. **Curve review.** Order the puzzles by the new scores and flag:
   - spikes;
   - flat stretches;
   - any puzzle where a new gem appears in the same puzzle as a hard combination.
   Then fix them with small edits. Keep the 16-machine graph, the story, and machine `need`s unless needed.
4. **Intake-desk chattiness.** FUSE says 4 lines on the first visit. Trim to what a newcomer needs, without losing teaching that first-altar/onboarding-2 rely on.
5. **Gate puzzles.** The novice bot can't plan gate merges. If cheap, give it that, so the gate puzzles have a real signal.

## Constraints
- Every puzzle is solvable, and fixed gems match the rules.
- The keyboard-only full-run e2e (`scripts/playtest/`, tests/e2e full run) must still go title → all 16 → ending. Update its plans or solutions to match.
- Don't touch lighting/candles (candle-light) or UI layout (bug-bash).
- Changing `rules/types.ts` or the rules spec: propose it to the PM first.

## Done when
- A table with, per puzzle: solutions before and after, score before and after, est. minutes, and a one-line teaching intent.
- Screenshots of every changed board as a first-time player sees them.
- `pnpm puzzle <id>` output for the changed puzzles in the log.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log

### 2026-11-02, difficulty-2 agent (branch `ws/difficulty-2`)

**1. Turn choice in the score (D-031).** The altar's route preview marks a side that refuses the
bolt with ✕ before Strike, so a wrong turn costs thought, not a fire. The solver and bot keep
trying only turns that accept the bolt; the cost goes into the score instead.
`rules/difficulty.ts` gained `TURN_WEIGHT` (Bend 0.5, Split 1, Gate 1; fixed gems 0),
`turnLoadOf(placements)` and `DifficultyMetrics.turnLoad` (the lightest-turning solution).
`scoreOf` adds `+ 0.08 · turnLoad` and its intercept drops 0.4 → 0.2 so the scale holds.
`pnpm puzzle` prints the turn load and a Turns column. Formula and rationale:
`docs/design/difficulty-curve.md` §2. Tests: `turnLoadOf` weights, `scoreOf` grows with turn load.

**2. Loose puzzles.**
- *press-unit-4*, 9 → 2: carved stone at (3,1) turns the storm's row down into the one junction.
  Tray unchanged. The 2 solutions differ only in the last bend.
- *capacitor-bay*, 11 → 1: re-laid. Storm comes up one lane (S, column 4) into the ice's row;
  tray `channel 8, bend 1, split 2, gate 1`. First try is still "through the ice" (the one Bend
  turns east: keeps 8, lets out 16, over: same read-outs as before). Fix: Split where the lane
  meets the row, Split again for the small machine, spare quarter fizzles on stone. I tried 6
  variants that kept the old W-row storm; the readable ones stayed at 5 solutions, the tight ones
  needed S-curls. The capacitor-clarity tests (`capacitor.test.ts`, e2e `capacitor.spec.ts`,
  playtest `capacitor.spec.ts`) used the old straight row as the first try; their placements now
  follow the new first try (up the lane, one Bend east). Expected texts unchanged.
- *conveyor-a*, kept at 4 (justified): all four use the doubled bolt through the fixed Split and
  take either half. On a teaching altar, "either half works" is the lesson, not looseness.

**3. Curve review** (full table in difficulty-curve.md §4). No band misses; FULL=1 passes.
Flags: roof-array = control-booth = 5.4 (flat; no small edit moves the booth: it is 1 solution
and bot-capped, the model's ceiling; order is forced so no branch spike; left open).
conveyor-a meets amber and magenta together in an amp-then-split (both fixed, preview chips read
4 → 8 → 4; accepted, flagged for playtest). relay → crane (1.9 → 3.6) is the largest step, the
first tray Gate; in band.

**4. Intake-desk.** First visit: 4 cards → 1. Arrive line is now one card, source N: "Day 14,610.
A visitor. There's a form for that. Step one: rune from the tray, onto a lit socket." (19w; keeps
the day count for journal clue 4 and the forms rhyme for page 1; script.md synced). Arrival gem
nudges are not queued on the teaching altar (`arrivalNudges(news, teaching)` in `teach.ts`,
tested in `clarity.test.ts`); the gem info card, lit socket and idle teach nudge still teach.
Dropped "You can't break anything. Others have tried.": the hall welcome already says mistakes
cost nothing.

**5. Gate-planning bot.** Skipped: not cheap. The bot builds by following one bolt; a Gate plan
needs two timed routes plus a weight refit. Left for Phase 2.

**Screenshots** (local only, `docs/design/screens/local/difficulty-2/`, not committed):
- intake-desk arrive: one FUSE card, gem info card for Bend (fixed) and Channel, lit socket.
- press-unit-4 route: storm → amber → bend down at the stone → split → both machines read 4.
- capacitor-bay settled: one lane up from the storm, the cross at the ice's row, ice, two
  machines. Wrong try: "Breaker tripped on strike 2: needs 8, got 16" with the ice read-out
  "keeps 8 / 8 + 8 → 16". Right try: ice "keeps 4 / 4 + 4 → 8", both machines lit.
- All boards read as the rules say.

**`pnpm puzzle` output (changed puzzles):**

```
press-unit-4  (6x4, storm 1×)
                    M4
    ▓   ▓   ▓   ·   ·   ▓
⚡1→ ·   ·   ·   ▓   ·   ·
    ▓   ·   ·   ·   ·   ▓
    ▓   ·   ▓   ▓   ▓   ▓
        M4
tray: channel ×7, bend ×3, amplify ×1, split ×1
score 2.7 (target 2.4–3.6)   est. 2.5 min (design 3)
solutions 2   min gems 10   tray 12 (slack 2)   decoy kinds -
solver nodes 1098   search bits 7.2   informative fails 14%
novice bot: solved 10/12 sessions, median 40.5 tries; fails dead 190 / under 183 / over 358
required ideas: amp-then-split   (concepts 1.5)   turn load 2.5
intended solution (10 gems, exact; readings 4, 4):
    ▓   ▓   ▓   ·   ═   ▓
⚡1→ A   ═   ┐   ▓   ═   ·
    ▓   ┌   S   ═   ┘   ▓
    ▓   ═   ▓   ▓   ▓   ▓

capacitor-bay  (8x6, storm 2×, 2 strikes)
                M2
    ▓   ▓   ▓   ·   ▓   ▓   ▓   ▓
    ▓   ▓   ▓   ·   ·   ▓   ▓   ▓
    ▓   ▓   ▓   ·   ·   C*  ·   ·   M8
    ▓   ▓   ▓   ▓   ·   ▓   ▓   ▓
    ▓   ▓   ▓   ▓   ·   ▓   ▓   ▓
    ▓   ▓   ▓   ▓   ·   ▓   ▓   ▓
                    ⚡2↑
tray: channel ×8, bend ×1, split ×2, gate ×1
score 4 (target 3.5–4.8)   est. 4 min (design 5)
solutions 1   min gems 9   tray 12 (slack 3)   decoy kinds bend, gate
solver nodes 410   search bits 6.5   informative fails 16%
novice bot: solved 0/12 sessions, median 300 tries; fails dead 1410 / under 52 / over 338
required ideas: bank, late-wake, waste   (concepts 4)   turn load 2
intended solution (9 gems, exact; readings 2, 0/8):
    ▓   ▓   ▓   ═   ▓   ▓   ▓   ▓
    ▓   ▓   ▓   ═   ·   ▓   ▓   ▓
    ▓   ▓   ▓   S   S   C*  ═   ═   M8
    ▓   ▓   ▓   ▓   ═   ▓   ▓   ▓
    ▓   ▓   ▓   ▓   ═   ▓   ▓   ▓
    ▓   ▓   ▓   ▓   ═   ▓   ▓   ▓
```

**For the PM:** no `rules/types.ts` or DECISIONS changes needed. Possible DECISIONS entry: "turn
choice is scored (turn load), not simulated in the bot, because the preview shows refusals".
Seen in passing (bug-bash's area, not checked further): in a mid-strike-2 capture of the
capacitor-bay win, the small machine's tag read "got 4" beside only a "Strike 1: 2" chip. It may be
the capture's timing; the old layout fed that machine the same way.
