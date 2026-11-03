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

### 2026-11-02: the twist lands at the booth (ws/lore-1)

**The reveal, said once and plainly** (`control-booth.solve`, right after page 16 is granted; 19 words, so it is one caption card and is fully on screen before Continue appears):

> Page sixteen. Day 1. My handwriting. My drawers. My chair. Oh. I'm the Builder. Regulation 8 does not cover this.

`beat.rune-final-report` stays verbatim (pitch). Its "it was mine" now pays off a reveal the player has already heard, rather than carrying it alone.

#### Before / after

| Line id | Tier | Old | New | Clue carried |
|---|---|---|---|---|
| `boiler-room.solve` | 2 | Warm. First time it's been warm in here since… the cot's facing the wrong wall. It always was. Why would that be known. | Warm again. The cot faces the big one. My… the Builder's idea. In case it wakes up at night. | Rhyme 12 (the cot, close to verbatim). Clue 5, a first "My… the Builder" slip (no "I", so Tier 2's rule holds) |
| `archive.arrive` | 2 | The archive. Drawers. Nothing but drawers. Can't open a single one. Had a long time to resent drawers. Regulation 14 is about drawers. | The archive. Drawers. Can't open one. Regulation 14: drawers open only for their owner. So, not this unit. Presumably. | Rhyme 10 (the drawers). Sets up page 16's "the drawers were mine" and the booth's "My drawers" |
| `capacitor-bay.solve` | 3 | Ice gem. The last one I… the last one that was cut. Didn't get to use it. Someone didn't. Monitoring self. | Ice gem. Cut it last. I… the Builder cut it last. Ran the sums on later. Later was short. | Rhyme 13 (page 13, nearly verbatim). Clue 5, an explicit swap |
| `lift-shaft.solve` | 3 | Going up. I don't like heights. This unit doesn't have a setting for heights. So where did that come from. | Going up. Hate heights. Went anyway. I… the Builder wrote that. This unit has no setting for heights. | Rhyme 14 (page 14 verbatim, said *before* the page appears). Clue 5, the loudest swap |
| `control-booth.solve` | 3 | Page sixteen. Last page. Dated the day the count started. I haven't read it. I know what it says. I know what it says. | Page sixteen. Day 1. My handwriting. My drawers. My chair. Oh. I'm the Builder. Regulation 8 does not cover this. | **The reveal.** Clues 1 (chair), 2 (handwriting), 4 (Day 1), rhyme 16 (drawers). Regulation 8 rhyme |
| Journal p14 plate | 3 | Hates heights. Went anyway. I would have… the Builder did. The Builder went anyway. | Said it before reading it. Hates heights. Went anyway. I would have… the Builder did. | Ties the plate back to the lift slip, so FUSE notices he quoted a page he hadn't read |
| Journal p16 signature | n/a | Scribble zigzag (meaningless at a glance) | Loops tighten and flatten into the legible handwritten word **"Monitoring."**, FUSE's report sign-off, in the page's hand | Clue 2 (`clues: [2, 4]`); new optional `signOff` field on `JournalPage` |

Tier 1 is unchanged. Hall echoes, reactions and every other line keep their pitch text. The content tests (pitch verbatim, ≤20 words, I-ramp, Tier 2 has no "I") are green.

**Page 16's plate stays blank.** The test requires it and so does the pitch. It also reads right in play: FUSE has already said it at the booth, the page ends in his own word, and the empty plate reads as silence. It is the only blank plate in the book.

**Optional post-reveal hall or journal touch: skipped.** The booth line, the signature and the final report already cover the reveal. A fourth beat would be clutter.

#### Reveal path: a fast player who skips the journal
1. **Tier 1:** no slips. FUSE is a dry auditor ("Monitoring").
2. **Tier 2:** at the archive, "drawers open only for their owner. So, not this unit. Presumably." At the boiler solve, "My… the Builder's idea." This is the first wobble, easy to miss.
3. **Tier 3, capacitor solve:** "I… the Builder cut it last." The swap is now said out loud.
4. **Tier 3, lift solve:** "Hate heights. Went anyway. I… the Builder wrote that." He quotes a page the player hasn't been given yet.
5. **Control booth solve:** the toast shows "Journal · Page 16, Day 1", and FUSE says "My handwriting. My drawers. My chair. Oh. I'm the Builder." This is the twist, stated outright.
6. **The Last Rune ending:** `beat.rune-final-report` ("…it was mine") now lands as confirmation, not as a riddle.
7. **If they open the journal:** page 16 says "tell it the drawers were mine", and the signature runs into "Monitoring."

At 1920 and at 1280/150% the booth line is fully typed and readable by 5.2 s, alongside the Continue button. The old two-card line had not shown its second card by then.

#### Ending-sequence proposal (for the PM after ending-3 merges; not applied)
`beat.door-key` → "You'll want the forms. They're in the drawers. My drawers. Turns out I had a key the whole time." (18 words). This echoes the booth reveal and Regulation 14. It also needs the matching script.md door-section entry, which I left alone as instructed. It's optional: the twist lands without it.

#### Files touched
- `games/last-rune/content/lines.ts`: the five lines above.
- `games/last-rune/content/journal.ts`: p14 rebuttal; page 16 `clues: [2, 4]` and `signOff: 'Monitoring.'`; optional `signOff` on `JournalPage`.
- `games/last-rune/scenes/journal/journal-sketch.ts`: `trailingSignature(width, height, baseline)` loops tighten into the baseline.
- `games/last-rune/scenes/journal/journal-scene.ts`: signature SVG adds a `<text>` sign-off; the aria-label includes it.
- `games/last-rune/scenes/journal/journal-styles.ts`: `.lr-j-sign text` in the hand font.
- `docs/design/script.md`: the changed line entries, p14 plate, p16 direction, clue ladder rungs 2 and 5 plus a "Said" row, rhymes 10/12/13/14/16, Regulation 8. Door section untouched.
- `scripts/playtest/lore-1.spec.ts`: capture script.
- Screenshots (not committed): `docs/design/screens/local/lore-1/{before,after}/{1920,1280-text150}/`.
