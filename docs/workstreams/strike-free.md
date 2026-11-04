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
