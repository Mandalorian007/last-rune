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

### 2026-11-04 (polish-9 agent)
- **Needle.** It already rested at zero before Strike: `gauge_angle(0)` is the lower-left stop, and `startPulse` resets every gauge that hasn't woken. The lie was after Strike:
  - `breaker()` dropped every tripped gauge back to 0 after 1.1 s, so an over read as "nothing";
  - the solve scene replayed the swing from 0, so its shots caught the needle mid-swing.
- The new `scenes/altar/needle.ts` `needleFor(got, need)` gives where the needle ends up:
  - 0 when nothing arrived;
  - 1 on the mark when exact;
  - capped at 0.9 when under, so it never sits in the cyan "exact" band;
  - at least 1.1 when over, so it's in the red.
- `onArrival` and `endPulse` (altar-run.ts) use `needleFor`. `breaker(rest)` now rests the needle at its over reading instead of 0. On multi-strike altars the last strike sets the reading.
- `Machine.settle()` puts the needle straight on its gauge, so the solve scene shows it on the mark from the first frame.
- Before Strike nothing changes (D-043).
- **Loupe.** Engine `MagnifyOptions.clear` can now return `spare` rects. These rank below `keep` (the aimed 3×3 and the finger) and above `avoid` (1e6 per spared rect covered, against 1e4 for avoid). When some are given, `loupeClear` also tries a coarse grid of spots. This is logged in the engine CHANGELOG with a unit test.
- On phones, altar-edit spares the needs/result cards, the storm label, the hint card and the tip. `dense-board.spec`'s loupe test now checks the loupe disc is clear of `.lr-altar-need`, `.lr-altar-hint` and `.lr-altar-tip`. It passes on all 4 phones and fails with `spare` emptied.
- **Hangout header.** Dropped the emoji span from the header. The emoji avatars in the messages stay. Removed the dead CSS that went with it.
- **Hall.** Locked labels are brighter (#d8cdb4) on a near-opaque plate, and the lock icon is at 0.8 opacity.
- **Tests.**
  - `needle.test.ts` covers `needleFor`.
  - `tests/e2e/gauge-needle.spec.ts` runs on desktop and on iphone with touch. It plays an under (furnace, 4 of 8), an over (capacitor bay) and an exact (furnace solution). It checks:
    - every needle stays at 0 for 24 frames before each Strike;
    - after Strike: under in (0.3, 0.95), exact within 0.03 of 1, over above 1.05, and all three distinct.
- **Shots.** `SHOTS=polish-9` on se/iphone/promax/android (17 passed). I checked these at real size:
  - 12-the-last-rune-aim: the loupe is clear of Needs 20 and the hint;
  - 13-capacitor-bay-multi: the needle is in the red;
  - 20-solve: the needle is on the mark;
  - 31-hangout: the header is clean;
  - 02-hall: the locked labels are readable.
- **Gates.**
  - `pnpm check` (603 passed, 2 skipped), `check:boundaries` and `build` are green.
  - Full `pnpm test:e2e` with `E2E_PORT_OFFSET=897`: 191 passed, 20 skipped, no flakes. This includes dense-board, altar-column, ending, mobile-ending and gauge-needle.
- **Baseline (no update).** Real diffs:
  - `ending-hangout` on desktop-720 (0.14%), desktop-1080 (0.12%) and ipad: the channel title shifts left now the header emoji is gone.
  - Under the 0.1% limit: desktop-720 `verdict-fail` (0.49%, FUSE/arc animation) and `solve-card` (0.02%).
  - Flaky under load: desktop-1080 `altar-lift-shaft-empty` and `altar-archive-empty` (FUSE idle and storm arc). Rerun alone, lift-shaft was 0 px; archive passed on retry.
  - Empty-board needles: no change, since they already rested at 0.
