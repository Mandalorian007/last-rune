# Workstream: strike-free (Strike is a free test)

Source: D-043. No live "will get N" readout (user call). Instead the player must know that striking is a free, safe experiment.

## Do
1. **Teach it once, early.** The goal/strikes arrival page (teach-4) says in one short line that Strike is how you test: strike any time, a miss costs nothing. On the first miss ever, the verdict adds the same idea once ("Nothing lost. Change anything and strike again." or better).
2. **Verdict reads as information.** Over/under verdicts lead with what happened ("Got 6 · needed 8" and where the charge went), not with failure words. Keep today's clarity; don't add length on SE.
3. **No visible attempt counting.** Remove "Attempt N" (`altar-run.ts` ~386) and "· try N" (`altar-dom.ts` ~380). Keep `attempts` in the save (flow.ts) for internal stats; don't show it as a score anywhere (check the end card and journal).
4. Button label after a miss: "Strike again" rather than "Try again" if it reads better; your call, keep it short.
5. Don't touch gem rendering (glyph-truth owns it) or the altar menu (menu-flow owns it).

## Done when
- Phone shots (`SHOTS=strike-free`) of a first miss, a later miss and the strikes page on SE and Android, checked at real size.
- Unit or e2e test: the first-miss line shows once and never again; no "Attempt"/"try N" text on the altar.
- `pnpm check`, `pnpm build`, `pnpm test:e2e` green; run `pnpm baseline` and list intended diffs (PM regenerates).
- Commit to `ws/strike-free`, never merge. Log here.

## Log
- 2026-11-04 (strike-free agent): done on `ws/strike-free`.
  - Goal page (phones, first altar): "Bring the storm's charge to the gauge: exactly what it Needs. Strike any time to see what it gets; a miss costs nothing." (`GOAL_RULE`, altar-defs.ts).
  - First miss ever (any device, once per game): a line under the verdict, "A miss costs nothing. Strike as often as you like." (`FIRST_MISS_LINE`, class `lr-verdict-free`, pale cyan). Spoken too. Tracked by a new optional save flag `flags.missTold` (missing = not yet said, so old saves validate); `flow.firstMissDue()` / `flow.tellFirstMiss()`. The line is added only where the verdict still fits with it (phone: whole inside the lane; big screen: in its usual place, not docked, clear of the red mark); otherwise it waits for the next miss (e.g. Capacitor Bay on an SE, relay at 150% text). New Game resets it, like the goal page.
  - Verdict headline leads with what happened (`failText`): "Got 2, needs 4: 2 short", "Got 8, needs 4: breaker tripped", "Got 16 on strike 2, needs 8: breaker tripped", "Got 8 each strike, needs 12: 4 short", "Got 0, needs 2: no charge reached this machine". Same length as before. Phone multi-strike headlines (`failHead`) and the dead-path cause headline were already plain facts; unchanged.
  - Counters gone: "Attempt N · change anything to try again" (result subtitle, hidden under the verdict but in the DOM) is now "Change anything and try again"; the edit subtitle's "· try N" is dropped. `attempts` stays in the save for stats. The ending's "Breakers tripped: N. Generous." line stays (a joke on the safety record, not an attempt score); the journal shows no counts.
  - Button after a miss stays "Try again": "Strike again" already means the last strike of a multi-strike run on phones.
  - Tests: flow.test (first miss once, again after New Game), failText/GOAL_RULE unit tests updated, a11y.spec (announce), capacitor.spec (new headline), new tests/e2e/strike-free.spec.ts (SE, Android, desktop: goal line, first-miss line once then never, no "Attempt"/"try N" text anywhere on the altar). `SHOTS=strike-free` saves shots.
  - Noted for the PM (not this workstream): reopening Capacitor Bay at first meeting with gems already placed, the SE lane shows the Capacitor plan read-out over the arrival card (card body hidden, "New here · 1 of 2" only). Fresh boards are fine.
