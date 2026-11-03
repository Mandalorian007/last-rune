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

**2026-11-03 (mobile-5-chrome agent).** Branch `ws/mobile-5-chrome`, main merged (72cdadf).

What changed (phones only; desktop and iPad keep `IDENTITY_FRAME` and unchanged CSS):
- **Door plates** (`ui/hud.ts` `doors()`, built in `hall-scene.ts` `doorPlates()`):
  - every door has a plate under it;
  - an open door shows its name; a solved door shows ✓ and its name, with a green edge;
  - a locked door shows a lock, a ≥10 px gem pip for each missing gem, and "+N" for any machines still needed;
  - each plate's width is capped at the gap to the next door in its row, so plates never overlap;
  - the Intake Desk plate is clamped above the screen's bottom edge.

  Tapping a door still gives the named card (e.g. "Crane · Locked · needs Gate (from Relay Tower)"). Tapping an open door a second time opens it, as before.
- **The hall fills the width.** This is new code in `scenes/hall/hall-frame.ts`, which is pure and has unit tests.
  - On a short view the camera zooms out about the doorway band, never below 2/3, and centres it in the visible view.
  - The wall and floor are baked wider (`HALL_WIDE`).
  - The door columns spread outward (up to 1.6×) to use the width, clear of the ☰ column.
  - Props, candles, lamps and slots follow the spread.

  Side bars are now ≤3% on all four phones (previously ~11.5% on Android), and the Intake Desk is whole on SE.
- **FUSE's card** reads "FUSE" before the line and stays off the doors. On the title screen, FUSE's caption avoids FUSE himself (`FUSE_ZONE`). The title's top margin is now ≥8 px (`FILL_BANDS.title.focusY` 505).
- **Settings:**
  - the fold falls exactly on a whole row that no row in either column straddles, so no header is cut under the footer;
  - the save code sits in a labelled "Save code" box;
  - Reset sits in a red "Start over" group with a one-line warning;
  - Reduce flashes reads Auto / On / Off.
- **SE Codex** (`max-height: 330px`): the rule and the formula sit beside the gem art; FUSE's note runs full-width below and fades at the bottom. The Yours, NEW and Not met yet tags, and the FUSE label, are now 12 px.
- **Menu:** the button is labelled "Menu", with a peach "New page"/"New pages" pill under it when there is something new.
- **Journal:** the page number is a 13 px bold folio. The arrows sit off the pages: the left one left of the book, the right one in the right lane under the ✕ on SE.
- **Leftovers:**
  - no hangout unread count;
  - on SE the end-card column moves left, so the clipboard prop clears "Copy Ko-fi link"; the button order is unchanged (D-034).
- **Bug found in captures and fixed:** on touch, a door card stayed on screen over Settings and the Codex after a tap. The hall now drops the hover while any UI panel is open, and doesn't hit-test doors under one.

Tests:
- `tests/e2e/mobile-chrome.spec.ts`:
  - door checks now use the scene's own model and frame;
  - `HALL_BAR` is 0.03, and the ring, tag and plates must sit 4 px inside the screen;
  - a new "plates and floors" test per phone checks:
    - plate content, no overlaps and pips ≥10 px;
    - the Menu label and the New page pill;
    - a locked-door tap card that goes when Settings opens;
    - no row cut at the Settings fold, plus the save box, the Start over group and Auto;
    - rule and formula wholly on screen on every Codex tab;
    - a 12 px drawn-text floor on the hall chrome, Settings, Codex and Journal.
- `tests/e2e/mobile-ending.spec.ts`: the hangout unread count is hidden.
- `scenes/hall/hall-frame.test.ts`: the hall framing.
- `scripts/playtest/mobile-4-chrome.spec.ts` gains:
  - `M4_OUT`;
  - phone shots of a locked-door tap card, the open menu and a third Codex page.

Sheets: `docs/design/screens/local/mobile-5-chrome/` (`m5chrome-<vp>.png`, `m5chrome-<vp>-ending.png`, and `mobile-2/m5chrome-<vp>.png`).

Softness:
- On SE, two-word door names ("Press Unit 4", "Storm Cell II") wrap onto two lines to stay inside the gap between doors.
- On SE, the brief tap card can cover a neighbouring plate while it shows.
- The "+11" after a long row of gems is tight against its pips on SE.
