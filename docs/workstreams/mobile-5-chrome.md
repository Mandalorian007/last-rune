# Workstream: mobile-5-chrome (phone hall and menus that explain themselves)

## Background
Gate review 2 (2026-11-03) scored 6 / 6 / 6.5 / 6.5, a fail. The PM checked these points against `docs/design/screens/local/mobile-2/gate2/*` and `.../mobile-4-chrome/after-*.png`. The calls are in D-040 addendum 3.

1. **The hall doors can't be told apart (2 of 2 reviewers who saw it).**
   - There are about 17 near-identical arches with no names.
   - Locked, open and solved differ only by a cage, a glow and pips about 6 px across.
   - Files: `gate2/*/02-hall.png`.
2. **The hall wastes width on wide phones.** On promax and android, black vignette bands on both sides leave a map about 700 of 932 px wide. The bottom door is cut by the screen edge, and on android the Next chip touches the top edge.
3. **FUSE's hall bubble sits bottom-right with no tail or name** while FUSE is at the far left. It reads like system text.
4. **Settings looks broken at the fold** (`gate2/se/03-settings.png`, android). The GRAPHICS and SAVE headers are clipped mid-letter behind the footer, and a control is half visible under it.
5. **The Codex hides rule text on SE.** On the Bend card the formula `out = in, turned 90°` is cut off with no cue that more is below (`gate2/se/04-codex.png`). This breaks D-027.
6. **The Codex and Journal are hard to find:** the only route is the unlabelled ≡ button.
7. **Leftovers:**
   - On android the title text touches the top edge, and the title FUSE is clipped by the caption box.
   - The end of Settings: the raw monospace save textarea, "Reset progress" right under Import with no separation, and the confusing "Reduce flashes: With reduced motion" label.
   - The hangout's "3 unread" badge implies interaction.
   - On SE the end-card clipboard prop crowds "Copy Ko-fi link".
   - Journal: the "—1—" counter is tiny and the arrows overlap the page edges.
   - Chrome text below 12 px: Codex italic source lines, "12 more pages to find", Settings section caps.

## Scope (phones; desktop and iPad unchanged unless noted)
1. **Hall doors explain themselves.**
   - Each open or solved door gets a short name plate (the machine name, ≥12 px, on a dark plate).
   - Solved shows a clear ✓ or lit state. Locked shows a lock and a legible requirement, either inline ≥11 px or on tap.
   - If 17 plates are too busy, show names on open and solved doors and only a lock on locked ones. Tapping any door shows a small card with its name, status and requirement.
   - Make the pips legible (≥10 px) or replace them.
   - The newcomer test: "what is done, what can I play, what is next".
2. **The hall fills the usable width** on every phone. No dark side band wider than about 3% of the usable width (scale or crop the scene, keeping the doors on screen). The bottom door is fully visible, and the Next and Start here chips are ≥4 px inside the play area.
3. **FUSE's hall bubble** is anchored to FUSE with a tail, or carries his name. It must not cover a door.
4. **Settings fold.**
   - The visible area ends on a whole row or under a soft fade. Section headers are never clipped mid-letter.
   - The save area is styled to match the game: a labelled box, not a raw developer placeholder.
   - "Reset progress" goes in a separated danger group.
   - Reword "Reduce flashes" so the options read naturally, e.g. "Auto / On / Off".
5. **The Codex shows the whole rule on SE.** Put the formula above the FUSE note, or narrow or hide the FUSE column on small phones, or both. The rule text and formula are always visible without hidden overflow. If anything must scroll, show a clear fade or "more" cue.
6. **Discoverable Codex and Journal.** The hall menu control is labelled ("Menu"), or the hall gets a labelled Codex (book) button. The new dot says what's new (e.g. "New gem page").
7. **Leftovers:**
   - title top margin ≥8 px, and the title FUSE not clipped;
   - no "unread" badge in the hangout;
   - the end-card prop clear of the buttons on SE;
   - the journal counter ≥12 px, with arrows off the page edge;
   - chrome text ≥12 px on phones.
   - Leave the end card's button order as it is (user decision D-034).

**Out of scope:** the altar (mobile-5-board and mobile-5-moments). Keep `ui/phone-styles.ts` edits in a `/* mobile-5-chrome */` block. Merge `main` before you report.

## Tests and capture
- e2e on four phones:
  - hall: door name plates visible and inside the viewport; no side band over the threshold; chips inside;
  - Settings: no section header partially visible at the fold;
  - Codex SE: the formula element is visible in the viewport for every unlocked page;
  - text floors;
  - no hangout unread badge.
- Capture `M2_TAG=m5chrome ...mobile-2 mobile-4-chrome`, with sheets in `docs/design/screens/local/mobile-5-chrome/`.
- Critique your own sheets as a newcomer.

## Done when
- Everything above is fixed.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- The log in this file is updated.

## Log
