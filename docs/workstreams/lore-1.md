# Workstream: lore-1 (make the twist land)

User (2026-11-02), after playing: the FUSE twist isn't obvious. "I didn't even pick up on that twist and we talked about it 😂". The user chose to keep the lore and make it easier to catch.

**The lore is unchanged:** FUSE is the Builder, uploaded into the foreman unit 40 years ago, and he doesn't know it. "Management" is the committee that told the Builder to stop. Sources: `docs/design/pitch-v0.3.md` §3–4 and `docs/design/script.md` (the clue table near the top, Tier 3, and The Last Rune).

**Today the clues are too subtle:**
- "I… the week Management left"
- the adjusted chair
- page 16's signature, which trails into the incident-report hand
- "it was mine"

A player who reads quickly and skips the journal misses all of them, and nothing ever says it outright.

## Target (PM judgement)
- **Attentive players** work it out about two machines before FUSE does, which is the pitch's intent.
- **Everyone else** still gets it unmistakably by the end, because FUSE says it plainly once.
- No cutscene and no exposition dump. Keep it in FUSE's voice: dry, funny, never mean to the player. The reveal should land as a joke and a gut-punch at once.

## Scope
1. **Say it once, plainly.** FUSE realises it in words at the end of the run: at control-booth solve (after page 16), and/or in `beat.rune-final-report`.
   - An example of the register only: "The drawers were mine. The chair's my height. I'm the Builder. Regulation 8 did not cover this."
   - Pick the beat that reads best, and keep the existing word budgets roughly (script.md shows word counts).
2. **Make page 16's payoff visible.** The signature that "trails into the same hand as every incident report" should be readable as FUSE's sign-off at a glance, e.g. it ends in his incident-report stamp or his "Monitoring." sign-off.
   - `scenes/journal/journal-sketch.ts` `trailingSignature`, `journal-scene.ts`.
   - Page 16's FUSE plate is blank today. Decide whether a short realisation there helps.
3. **Ramp the clues** so they're catchable without the journal:
   - In Tiers 2–3, a few FUSE lines echo the Builder's journal phrasing nearly verbatim (the drawers, the count, hating heights, the cot, "Monitoring"), and his slips ("I… the Builder") get slightly more noticeable as the game goes on.
   - Change existing lines rather than adding lots of new ones.
   - Tier 1 stays light.
4. **Optional, if it's cheap and clear:**
   - After the reveal, one hall echo or Codex/journal touch acknowledges it, e.g. the journal cover now reads as his.
   - Your call. Skip it if it's clutter.

## Constraints
- **Don't touch** `games/last-rune/content/ending.ts` or `games/last-rune/scenes/ending/`. ending-3 is working there right now.
  - You may reword the existing `beat.*` lines in `content/lines.ts`.
  - If you think the ending sequence itself needs a change (a new step or a new caption), write the exact proposal in your log and the PM will apply it after ending-3 merges.
- In `docs/design/script.md`, edit only the entries for lines you change. Leave the ending/door section alone, since ending-3 edits it.
- **Content tests:** lines.ts, journal.ts and altar-lines.test.ts must stay green. Update the clue table in script.md if clues move.
- **Don't change** puzzles, rules, UI layout or the lore itself.

## Done when
- A before/after table in the log: line id, old text, new text, and which clue it carries.
- A short "reveal path" walkthrough: what a fast, journal-skipping player sees, in order, that tells them.
- Screenshots of page 16 and the reveal beat at 1920 and 1280/150% in `docs/design/screens/local/lore-1/`. Don't commit them.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log
