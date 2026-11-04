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
