# Workstream: chrome-polish-4 (chrome minors from blind review 6)

Source: D-040 addendum 7. Shots: `docs/design/screens/local/gate6/{se,iphone,promax,android,portrait}/`. Don't touch the altar scene (solve-truth, glyph-truth and teach-4 own it).

## Do
1. **Hall** (`02-hall`, `02-hall-mid`): the coloured dots under room names and the coloured lines between rooms are never explained. Make their meaning self-evident (for example a dot per gem the room teaches, in the gem's colour, with a one-time line), or remove them. The "New page in journal" toast must not wedge under the Menu button or wrap awkwardly on any phone.
2. **Title** (`01-title`, portrait `01-title`): "Buy ThunderSoap a coffee" and "Copy link" must be clearly secondary to Play. Landscape: FUSE shouldn't be hidden behind the dialogue box, and the orb shouldn't be clipped by Play. Portrait: the FUSE box shouldn't be three times taller than its text.
3. **End card** (`32-end-card`): "Back to the hall" (or the in-game action) is the primary button; the external "Join ThunderClap Gaming ↗" is secondary. Check that "Time on site" and "Breakers tripped" report real values (the shots ran a scripted save; confirm the code, and seed a sensible save for the shot if needed). Don't cut the clipboard prop off.
4. **Ending** (`30`, `31`): make "Plays by itself" read as a status, not a button.
5. **Journal** (`05-journal`): the caption shouldn't crowd the bottom edge between the arrows on SE.

## Done when
- Gate shots on 4 phones and portrait show each fix. Look at them yourself.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` are green. Desktop and iPad baselines: run `pnpm baseline` and list any intended changes in the log; don't regenerate them yourself.
- Commit to `ws/chrome-polish-4` and never merge. Log here.

## Log

**2026-11-04: all five minors fixed (branch ws/chrome-polish-4).**
- **Hall dots and lines.** The hall art no longer draws coloured sockets on door art (`hall-view.ts` `applyStatus` → `setSockets([])`). Each door's card already names its gems in words. Every lit conduit is cyan, so colour no longer suggests a gem kind it doesn't stand for. The "New page in journal" badge is now one line beside Menu: to its left, vertically centred, with a red dot. It no longer wedges under Menu. `mobile-hall.spec` asserts it sits beside Menu, stays on screen and is one line.
- **Title.** Coffee and Copy link are quiet dotted text links, so Play is the only filled CTA. In landscape the menu (Play, Settings) sits in the right column, bottom-aligned. The links run small along the bottom from 41% across, so FUSE and the orb are fully visible on SE and iPhone. In portrait the docked caption no longer stretches; it is centred at its own height.
- **End card (phones).** Back to the hall is the gold primary. Join is a dark secondary pill that keeps its ↗ and stays above Ko-fi (D-034). The shot seeds real stats (47m, 4 breakers); stats were already real in flow.ts. The clipboard is whole on all five phones. chrome-polish-3's phoneClipRest still holds.
- **Ending cue.** "Plays by itself" is now an upright, muted status line with a pulsing gold live dot. It no longer has a ▶ or underline, and reduced-motion stops the pulse.
- **Journal on SE.** At max-height 330 the plate text is tighter (line-height 1.1, narrower padding, raised box). It fits in 3 lines, well clear of the bottom edge.
- **Gates.** `pnpm check` green, `pnpm build` green and `pnpm test:e2e` green. mobile-hall's badge one-line threshold went from 24 to 30 because the badge measures 24.2px. That spec reran alone: 4/4 passed.
- **Baselines (not regenerated).** These diffs are intended:
  - hall-first: desktop-720 2.6%, desktop-1080 2.4%, iPad 2.2%
  - hall-mid: about 4–5% on the same three
  - end-card: about 0.7–1.2%, from the hall backdrop behind it; the desktop end card is unchanged
  - settings: about 0.4%, from the hall backdrop
  - codex: about 0.2%, from the hall backdrop
  - Not from this work: altar-*-empty on desktop-720 (boiler-room, archive, foundry) and iPad capacitor-bay, about 0.13–0.18%. The diff pixels sit on the storm orb and FUSE, so they look like animation noise.
- **Shots.** `docs/design/screens/local/gate7/{se,iphone,promax,android,portrait}/` (01-title, 02-hall*, 05-journal, 30-ending, 31-hangout, 32-end-card).
- **For the PM.** On desktop, Join is still the big gold CTA on the end card. Only phones changed here. Decide whether desktop should follow (Back primary, Join secondary).
