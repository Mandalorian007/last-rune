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

- 2026-11-03: all nine items done on the four phones (iphone, se, promax, android).
  - **Placement.** New pure helpers in `ui/place.ts` (unit-tested). The Next tag (`hud placeTag`) and the tapped door's card (`hud placeCard`) both pick the spot with the least weighted overlap of the plates, the ring, Menu and the tag, inside the visible band.
  - **First visit.** The tag stands above the ring, or beside it with an arrow, never on a plate. The ring hugs the door's arch and stops above its plate. The plates draw over the ring.
  - **Locked card.** It is one card beside the door and the door's plate lights up. It reads "Name · Locked: solve A and B first". `lockedNote` names up to three doors; only the Last Rune keeps the "earn these gems" chips. "● Gate" is gone. FUSE's reason joins the card as "FUSE …". Where his reason would push the card over another plate (the long notes on se), it is left off and he says it in his own caption.
  - **Menu.** The menu has a panel (`.lr-hud[data-open]::before`) over a scrim. The note is 12 px.
  - **New pages.** One badge, on the Menu button's lower edge; the dot is gone.
  - **FUSE's captions.** Title and hall captions have a tail toward FUSE (`fuse.pointAt`, `view.fuseAt`). In the hall the caption avoids every door, with playable doors weighted four times, the suggested door's tag zone and FUSE himself.
  - **SE density.** Open and solved plates are 13 px and brighter. Locked plates are quieter but at least 7:1. Floor door rects are taller, so Splitter Mill and Storm Cell II get room.
  - **Title.** The coffee and Copy link are quiet text links, still 36 px taps.
  - **Small fixes.** Settings segments are at least 36 px. The capture script no longer leaves caption speed at Instant; the save default was already `normal`. The Journal head keys the red dot ("· ● 1 new"); desktop hides the dot.
  - **Tests.** `tests/e2e/mobile-hall.spec.ts`, on four phones, checks:
    - no two hall labels or pills intersect, on first visit and mid-game;
    - every label is on band and the tag is clear of the top;
    - there is one badge on Menu;
    - each locked door's card covers no label, holds its words, and FUSE's reason is in the card or the caption, exactly one;
    - the caption has a tail and covers no playable plate;
    - the menu has its panel and scrim, and the note is ≥11 px;
    - Settings segments are ≥36 px;
    - the default speed is `normal`.

    `hall-state.test.ts` covers the locked-note wording.
  - **Captures.** `docs/design/screens/local/mobile-4-chrome/after/` and `docs/design/screens/local/mobile-2/after/`.
  - **Open issues.**
    - FUSE's word inside the card has no voice blip.
    - On se, long locked notes fall back to the caption.
    - The Last Rune still shows gem chips such as "Gate". Its words point at them, so that is by design.
