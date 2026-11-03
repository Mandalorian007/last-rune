# Workstream: mobile-7-ending (the ending feels finished on phones)

Gate review 4 failed at 6.4 (D-040 addendum 5). Evidence is in `docs/design/screens/local/mobile-2/gate4/*/3[0-2]-*` and `mobile-4-chrome/gate4-*-ending.png`.

## Scope
1. **One instruction.** Resolve the clash between the "Plays by itself" pill and the "Tap to continue" caption: pick one model and make the copy match it. Nothing that looks like a button may do nothing.
2. **The hangout fills the phone.** Remove the empty bottom 40–50%. Scale the chat to the height, show more history, or anchor messages to the bottom like a real chat app. Each beat should feel alive.
3. **End card.**
   - Tone down the washed-out yellow background so the panels sit in the scene.
   - The title panel has breathing room from the top edge.
   - The "Safety record" slip doesn't touch the title on se.
   - The clipboard isn't cropped.
   - Check the real copy with a realistic play time, not "1m".
4. **The Journal page arrows** sit near the book, not at the screen edges (android).

## Ownership
`scenes/ending/`, `content/ending.ts` (layout only), the end card, and the Journal arrows' position. Don't touch the hall or altars.

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

