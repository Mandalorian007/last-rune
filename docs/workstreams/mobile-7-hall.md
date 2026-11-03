# Workstream: mobile-7-hall (the hall and menus look finished)

Gate review 4 failed at 6.4 (D-040 addendum 5). The menus reviewer scored 6.5. Evidence is in `docs/design/screens/local/mobile-4-chrome/gate4-{se,iphone,android,promax}.png` and `mobile-2/gate4/*/0[1-5]-*`.

## Scope
1. **First visit.** The gold Intake Desk label is fully on screen (it reads "ntake Desk" on se). The "Start here" pill never sits on another label (The Last Rune).
2. **The Next ring** goes around the door art, not through its label ("Relay Tower"). The "Next" pill is clear of the top edge.
3. **The open menu** has a backing panel and/or a dim scrim, so no hall labels show through. The "New journal page" note is ≥11 px.
4. **Locked popover.**
   - It says "Locked: solve Relay Tower first", and FUSE's reason sits inside the same card. Remove "● Gate".
   - It never covers a neighbouring door label.
5. **"New pages"** is a badge attached to the Menu button (one signal, not two).
6. **FUSE bubbles** (title and hall) get a tail toward FUSE, and in the hall they never cover playable doors or their labels.
7. **SE hall density.**
   - Raise label contrast and size where it fits.
   - Give "Splitter Mill" and "Storm Cell II" space.
   - Make locked labels quieter, but keep them legible.
   - Add an e2e test that no two hall labels or pills intersect on any phone.
8. **Title.** The coffee and Copy link pills get less visual weight than Settings.
9. **Small fixes.**
   - Settings segmented buttons are ≥36 px tall.
   - The default FUSE text speed is not "Instant", unless that was a saved choice; check it.
   - Journal red dots get a legend or go.

## Ownership
Hall scene, the menu, title, Settings, Journal tabs. Don't touch altar files.

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

