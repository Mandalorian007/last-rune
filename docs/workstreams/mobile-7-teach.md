# Workstream: mobile-7-teach (every word and look matches what's on screen)

Gate review 4 failed at 6.4 (D-040 addendum 5). Evidence is in `docs/design/screens/local/mobile-2/{gate4,pm-review-altars}/*/`.

## Scope
1. **Blocker: the tip matches the held gem.** `se/16-the-last-rune-held.png` shows "Holding Channel" next to a Capacitor tip. Find the cause. The tray tip must describe the held gem, or be absent; never another gem. Add a unit or e2e assertion across all gem kinds.
2. **Teach cards point at what they teach.** On the Intake Desk first visit (`gate4/*/11-intake-desk-fuse.png`) the card teaches Bend, the fixed board gem, while the tray holds only Channel, and nothing links them. While a card is up, the gem it teaches pulses, joined by a leader line or a matching outline. Tray-gem cards highlight the tray tile. Re-check the teach order so the first lesson makes sense: "this one's fixed and turns the charge; you place Channels".
3. **Fixed gems look fixed.** The puzzle's pre-placed gems get a distinct riveted or bolted bezel and no lift on hover/tap. Your own placed gems don't have it. A tap on a fixed gem says, in the tip slot: "Fixed: part of the machine".
4. **Rule copy with worked examples**, on teach cards, tray tips and the Codex. Every gem gets a Capacitor-style worked line, e.g. Split: "In 4 → out 2 and 2. Odd charge is lost." Add a mini inline diagram where it helps. Keep "charge" as the noun, and update content tests.
5. **No "✓ placed" circles.** A ×0 gem stays in its slot as a dimmed silhouette labelled "all placed" (one line, UI font). It never reads as a button.
6. **One panel while teaching.** The teach card owns the right column: no FUSE joke bubble and no loose "Tap a gem, then a socket" tab beside it (`promax/14-relay-tower-teach`, `15-capacitor-teach`). "Next ›" sits fully inside the card.
7. **Keep the puzzle name** visible when holding a gem. The "Holding X" pill should sit under the title, or the title should shrink, rather than the pill replacing the title.

## Ownership
`moments.ts`, teach and tip copy (`content/`), the tray look and tile states, and the fixed-gem art in `socket-looks.ts` and the shaders. Coordinate small `altar-scene.ts` edits; mobile-7-strike owns the verdict and Strike, and mobile-7-zoom owns zoom.

## Rules
- Phones first: iphone 844×340 (47 px insets), se 667×320, promax 932×380 (59 px insets), android 915×360. Desktop and iPad may not regress; show a 1920 before/after if you touch them.
- `engine/` has no game nouns, and `rules/` stays pure. Use pnpm only. Propose changes to `types.ts`, the save schema or DECISIONS to the PM; do not edit them.
- Captures go to `docs/design/screens/local/` (git-ignored, never committed). Use the existing specs: `M2_TAG=<tag> M4_TAG=<tag> pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2 pm-review mobile-4-chrome`.
- Review your own captures as a first-time player asking "is this a highly polished, intuitive, mobile-supported interface?" before you report.
- Commit to your own branch `ws/<name>`. Never merge to main. Log what you did, and any larger issues left open, in this file.

## Done when
- Every scope item is fixed on all four phones, verified in your captures, and covered by an e2e or unit assertion where it can be measured.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` are green.
- The log lists what you changed and gives capture paths.

## Log


**2026-11-03: wrapped up early on PM request (D-041: v1.0 ships for desktop and iPad; phones wait for the engine rewrite).** Every change below is phone-only unless marked otherwise. Desktop and iPad should look the same as before, except for the Codex maths line.
1. **Blocker fixed: the tip names the gem in hand.** `pickInfo` (moments.ts) picks the card's source. With a gem in hand, the card names that gem or nothing. A Capacitor plan read-out steps aside while a gem is held, which was the se/16 cause. Covered by e2e over every altar and every tray gem.
2. **The teach card points at what it teaches.**
   - A fixed gem's page draws a gold line from the card to the gem, plus a ring around the gem (`updateTeachPointer`, `.lr-teach-leader`). The gem's existing pulse stays.
   - A tray gem's page rings its tray tile (`.lr-altar-slot[data-teach]`).
   - The copy says which kind a gem is: "Fixed: part of the machine. …" or "Yours to place. …". At the Intake Desk, the lesson now reads "Bend: fixed, turns the charge" and then "Channel: yours to place".
3. **Fixed gems look fixed.**
   - Fixed and hint-locked gems keep the existing riveted iron collar (stone-wgsl state 6); placed gems have none.
   - A tap on a fixed gem no longer bounces or flashes red. Instead its card shows in the tip slot for 2.5 s: "Fixed: part of the machine." Covered by e2e: the card text is right, there is no settle or lift, and nothing gets picked up.
4. **Worked examples.**
   - Every gem's codex `maths` line is now a worked example with real numbers, e.g. "In 4 → out 2 and 2. Odd charge is lost." The Codex shows it on every platform.
   - On phones it shows only on a long-press card. Chips and the teach card stay within their line budgets: with it, an SE teach card covered FUSE and the Strike button (mobile-moments), and chips ran to 5 to 8 lines (mobile-budget).
   - Covered by a content test.
5. **No ✓ circles.** A used-up gem stays as a dimmed, smaller silhouette with one quiet "all placed" line under it. Covered by e2e.
6. **One panel while teaching.** While the teach card is up, the arbiter holds back the how-to line and FUSE's bubble. "Next ›" stays inside the card because the page label wraps. Covered by e2e over every altar and every page, which also checks the pointing.
7. **The puzzle name stays while holding.** The title shrinks and the "Holding X" pill sits under it. Covered by e2e for overlap and clipping.

Wrap-up (D-041: the phone round ends here):
- On the teach card, a fixed gem's page opens with "Fixed." (the gold line shows which gem). A tap on the gem still says "Fixed: part of the machine."
- "Yours to place." shows only on a card that also teaches a fixed gem (Intake Desk).
- The Capacitor's phone chip is now "Holds its first charge; next strike, lets out both." That keeps the SE teach card at 4 lines, clear of FUSE and Strike.
- The "all placed" label is 13 px (the label floor) and wraps.
- Desktop and iPad: the tray lift and size and the tip's worked example are unchanged (all phone-gated). Only the Codex `maths` lines changed, as content.

Captures (git-ignored): `docs/design/screens/local/teach7-before/`, `teach7-before6/` (before) and `teach7-after/` and `teach7-final/` (after; `teach7-final` is the SE teach cards at wrap-up, from `TEACH_SHOTS=… pnpm exec playwright test tests/e2e/mobile-teach.spec.ts`).

Open:
- Mini inline diagrams for the worked examples were not done.
- The collar was not made more visible on phones.
- Leader lines were only checked in captures on the four phones. Their ends are not checked against the cell positions while zoomed.
