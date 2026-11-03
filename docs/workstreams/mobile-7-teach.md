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

