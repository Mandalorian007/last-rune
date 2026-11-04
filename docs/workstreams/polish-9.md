# Workstream: polish-9 (D-040 add. 10, F and minors)

Read `dense-board-3.md` (the loupe rule, `MagnifyOptions.clear`) and `polish-8.md` first. Shots: `docs/design/screens/local/gate9/<phone>/` in the main checkout.

## Do
1. **Gauge needle (three reviewers).** The dial's needle sits at the same red-zone angle on every gauge in every state, so it reads as a meter that lies. Before Strike it rests at zero. After Strike it swings to what arrived, relative to Needs: exact sits on the mark, over goes into the red, and on multi-strike altars it shows the last strike. It must never move before Strike (D-043). Desktop and phone.
2. **Loupe clear of labels and cards.** In `12-the-last-rune-aim` the loupe covers "Needs 20" and the hint card. Add the gauge result/needs cards and the open hint card to the loupe's keep-clear set, at a lower priority than the aimed 3×3 and the finger. Add a check to dense-board.spec's loupe test.
3. **Hangout header.** `31-hangout` shows "# 👱 introductions"; the stray emoji looks like a glitch. Fix it or render it as a deliberate avatar.
4. If time allows: in the hall, make the locked altar labels more readable (`02-hall`).

ws/held-gem (glyphs, tray, ghost) and ws/teach-7 (gauge cards' copy) run in parallel. Don't touch gem shaders or gauge-card copy.

## Done when
- `pnpm check`, `pnpm check:boundaries` and `pnpm build` are green. Run dense-board, altar-column, the ending specs, and a full `pnpm test:e2e` (rerun load flakes alone and name them). Use a unique `E2E_PORT_OFFSET`.
- New e2e: the needle doesn't move before Strike, and after Strike it differs between an exact, an under and an over gauge.
- Don't run `BASELINE_UPDATE`; list the diffs (needle at zero will change the empty-board shots). `SHOTS=polish-9` on four phones. Commit to `ws/polish-9`, never merge. Log below.

## Log
