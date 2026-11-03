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
