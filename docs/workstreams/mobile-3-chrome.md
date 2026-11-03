# Workstream: mobile-3-chrome (title, hall and menus feel phone-native)

## Background
The PM's blind screenshot review of mobile-2 scored the title, hall and menus 6/10: "a desktop UI shrunk down: chip-sized controls, cramped lists, three different ways to close a screen".

Read D-039 and **D-040** in docs/DECISIONS.md, and docs/workstreams/mobile-2.md (budgets and realistic viewports). The screens are in `docs/design/screens/local/mobile-2/pm-review*/` (local; regenerate them with `M2_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2`).

## Scope
These are PM decisions. Phone only: the desktop and iPad output must be unchanged.

1. **Title.**
   - Play is ≥140×48 and the clear primary action. Settings sits under it at ≥44 tall.
   - Full screen, Buy ThunderSoap a coffee, and Copy link are ≥36 drawn / 44 hit, or Ko-fi and Copy move into Settings. Your call, but keep them reachable.
   - FUSE title lines don't leave an orphan word (balance the breaks).
2. **Art fills the width.**
   - On the title and in the hall, the art fills the width up to the safe-area insets, cropping the top and bottom instead.
   - Today there are about 100–128 px of dead bar per side on iphone and promax, and about 48 px on SE, which has no insets.
   - Doorways must stay fully tappable, and ☰ stays clear.
3. **Hall: "the gold doorway".**
   - When FUSE points at the next doorway, it must be unmistakable: a pulsing ring or chevron plus a small "Start here" or "Next" tag on phones.
   - Don't brighten candles. The selection highlight stays brighter than the candles.
   - Remove the stray dot at the right edge (iphone about 716,137).
   - Explain the ☰ unread dot, e.g. "New journal page" in the menu row.
4. **Settings.**
   - Rows ≥44 px tall, slider thumbs ≥20 px.
   - Segmented toggles where there are ≤4 options; selects otherwise.
   - No stray focus box on first open.
   - On SE, **Reset progress is clipped**. The body must scroll or reflow so nothing is cut at any viewport.
   - Reset is styled as dangerous (red) and is not adjacent to Import.
5. **Journal.**
   - The list shows the found pages plus one summary row ("12 more pages to find"), not 12 "NOT FOUND" rows. Rows ≥36 px tall, text ≥12 px.
   - The prev/next page arrows are solid and ≥44 px.
6. **Codex.**
   - Tabs ≥36 px tall.
   - Readable header.
   - Use the empty lower page for larger body text.
   - The FUSE aside has enough contrast.
   - ☰ hides while an overlay is open.
7. **One close convention (D-040).** Every overlay (Settings, Codex, Journal) has a ✕ top-right at ≥44 hit, plus the existing Esc/Back. Keep "Back to the hall" and "Done" only if they don't conflict; prefer the ✕.

**Out of scope:**
- the altars and solve card (that's mobile-3-board);
- the ending, hangout and end card (mobile-3-ending);
- rules;
- FUSE's wording.

`ui/phone-styles.ts` is shared with the other two workstreams. Keep your edits inside one block marked `/* mobile-3-chrome */` to keep merges clean.

## Tests
- Extend `tests/e2e/mobile-budget.spec.ts`, or add a sibling test:
  - at all 4 viewports, nothing is clipped in Settings, Journal or Codex;
  - the title, menu and overlay controls meet the D-040 sizes;
  - the title and hall art reach the safe-area edges.
- Compare desktop 1920 and iPad before/after for no change.

## Done when
- Before/after contact sheets are in `docs/design/screens/local/mobile-3-chrome/`.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- Commit to your branch. The PM merges, then runs the blind review (D-040).

## Log

### 2026-11-03: done, ready for PM review
Contact sheets (git-ignored): `docs/design/screens/local/mobile-3-chrome/{before,after}-{se,iphone,promax,android,desktop,ipad,ipad-mini}.png`. Capture: `M3_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-3-chrome`. The full mobile-2 phone flow after this change: `docs/design/screens/local/mobile-3-chrome/flow/after-<phone>.png`.

**Before → after (phones):**
- **Title.**
  - Before: art letterboxed with wide side bars; small Play; tiny links.
  - After:
    - The art fills the width to the safe areas, cropping top and bottom (`computeFillWidth`, FILL_BANDS title 760/520).
    - Play is ≥140×48 and gold; Settings is under it at ≥44.
    - Full screen, Ko-fi and Copy link are ≥36 drawn with a 44 hit.
    - Captions use `text-wrap: balance`.
- **Hall.**
  - Art fills the width on SE, iPhone and Pro Max. 20:9 Android keeps about 65 CSS soft-edged bars (canvas edge mask) so the floor door stays whole (FILL_BANDS hall 880/540).
  - The suggested door gets a pulsing gold ring plus a "Start here ▾" / "Next ▾" tag. The tag is clamped below the crop and the pulse stops under reduced motion. The candles are untouched.
  - The stray right-edge dot was the right riser's gauge flag. It is turned off on phones (`HallFloor.edgeGauge`); desktop is unchanged.
  - The ☰ menu's Journal row says "New journal page" / "N new journal pages", explaining the dot.
- **Settings.**
  - Options with ≤4 choices are segmented toggles; selects remain off-phone.
  - Rows are ≥44; slider thumbs are 22.
  - The body scrolls with a soft bottom fade, so nothing is clipped on SE.
  - The panel body takes the initial focus, so there is no focus ring on open.
  - Reset progress is red and on its own row below the note, away from Import.
  - ✕ top-right.
- **Journal.**
  - Found pages are paper rows (≥36, text ≥13) with the current page marked. They are followed by one dashed "12 more pages to find" row.
  - Solid 44 prev/next arrows.
  - ✕ sits in the right bar.
  - "Back to the hall" now sits inside the screen on SE; it was clipped before.
- **Codex.**
  - Tabs are 36; the header is brighter and larger.
  - Body text is larger and uses the page; the page scrolls if needed, and a tighter variant applies at ≤330 tall.
  - The FUSE aside is in dark ink.
  - The × is 36 drawn with a 44 hit.
  - ☰ and the hall marker hide while any modal is open.

**Desktop and iPad (1920, 1180, 1024):** visually identical before/after (sheets compared side by side).

**Tests:**
- New file `tests/e2e/mobile-chrome.spec.ts` covers 4 phones. It checks:
  - D-040 sizes for Play, Settings, links, ✕, Codex tabs, settings rows/segments/sliders, journal rows/arrows;
  - no control off-screen in Settings (after scrolling), Codex and Journal;
  - no focus ring on Settings open;
  - Reset is red and alone;
  - the title art has ≤4 px bars and the hall ≤8% of the width;
  - the Next tag is not cut.

**Proposals for PM:**
1. **Phone hall layout (D-040 follow-up).** A full fill on 20:9 Android needs the hall's doors packed into a shorter band, e.g. the floor door moved up beside the centre. Until then, the slim soft bars are the trade-off for keeping every doorway whole and tappable.
2. **Close convention (D-040).**
   - ✕ top-right (`.lr-panel-x`, 36 drawn / 44 hit) on every phone overlay.
   - Destructive actions are red and sit on their own row.
   - Worth a line in DECISIONS.
3. **`ViewContext.phone?: () => boolean`** (scenes/views.ts) lets art views adapt to phones (used for the hall gauge). It is cross-cutting, so flagging it.
4. **Engine `computeFillWidth` / `Surface.setFill`** (letterbox.ts, surface.ts) is generic, with no game nouns.
