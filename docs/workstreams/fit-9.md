# Workstream: fit-9 (last fixes before blind review 9)

Read `docs/workstreams/dense-board-3.md` and `docs/workstreams/teach-6.md` (both logs) first.

## 1. The Last Rune's east card vs "in either strike" (blocker for review 9)
teach-6 changed gauge cards from "in one strike" to "in either strike". The card is wider, so on iPhone and Pro Max The Last Rune's "Needs 20" east card no longer fits the gutter dense-board-3 chose and drops below column 9's rings: 34 px (iPhone) and 41.5 px (Pro Max) from its gauge, over the one-card limit (~32). `tests/e2e/dense-board.spec.ts:140` fails on main for iphone and promax.
- Fix it in layout (`placePhoneLabels`, `layout.ts` gutter choice), not by loosening the test. Allowed trade: a pitch cost of ≤ 0.5 px on The Last Rune, or a two-line card that is narrower. Pitch floors in dense-board.spec stay (iPhone 35, Pro Max 40, Android 38, SE 32).
- Check every multi-strike altar (capacitor-bay, roof-array, the-last-rune) on all four phones.

## 2. FUSE says gem names, not colours (PM call)
FUSE still says amber, magenta, emerald in 17 lines; 10 are verbatim pitch lines pinned by `content.test`. PM decision: amend the pitch's FUSE lines in `docs/design/pitch-v0.3.md` to gem names (Amplify, Split, Gate…), then change `lines.ts` and `script.md` to match, keeping voice and length. Log the amendment in the pitch doc's changelog line.

## Done when
- `pnpm check`, `pnpm check:boundaries`, `pnpm build` green; `dense-board`, `altar-column`, `mobile-teach`, `content` specs green (rerun load flakes alone and name them).
- `SHOTS=fit-9 pnpm exec playwright test tests/e2e/shots.spec.ts` for the four phones; look at 10-/12-/13-the-last-rune and 10-capacitor-bay at real size.
- Do not run `BASELINE_UPDATE`; the PM regenerates after merge. Commit to `ws/fit-9`, never merge. Log below.

## Log
