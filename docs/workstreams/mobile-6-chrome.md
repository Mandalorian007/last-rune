# Workstream: mobile-6-chrome (title, hall, menus and end card that read as made for phones)

## Background
Gate review 3 failed (6 / 6 / 6 / 6.5; D-040 addendum 4). The chrome issues the PM verified in `docs/design/screens/local/mobile-2/gate3/` and `mobile-4-chrome/after-*.png`:
1. **The title's FUSE bubble covers "Rune"** (`android/01-title.png`) and only just misses on promax. This is a regression and the first thing a player sees.
2. **Locked doors are cryptic.**
   - A lock plus 1–6 coloured pips and "+11" or "+14": what do they mean?
   - On SE the "+11" collides with the next badge.
   - About 20 identical caged doors bury "Start here" on a first visit (`02-hall`, `02-hall-first`).
3. **The locked tap card is jargon.** "Locked · needs Gate (from Relay Tower)". It covers labels, wraps badly, and **stays open when the Menu opens** (`02-hall-tap-locked`, `02-hall-menu`).
4. **The hall's top row is cropped** (the arch tops) on iPhone and SE. The "Next" chip touches the top edge and overlaps the Relay Tower frame. The ✓ on Splitter Mill sits outside its plate. Three plate styles compete.
5. **Settings.**
   - The first view ends on GRAPHICS and SAVE headers with nothing under them.
   - "Graphics & Save ▾" looks like a dropdown but just scrolls.
   - At the end, the left column is a lone row, cut in half on SE.
6. **The Codex clips on SE.** FUSE's quote is cut mid-line and there's no scroll cue (`se/04-codex.png`, `after-se.png`).
7. **The Journal on SE:** "›" and ✕ are cut by the screen edge, and the subtitle sits under the first tab. The "‹" sits on the quill art.
8. **The end card looks unfinished** (`*/32-end-card.png`).
   - Content sits off-centre to dodge the clipboard, which nearly touches "Copy Ko-fi link" on SE.
   - White subtitles sit on bright gold.
   - The button rows are ragged.
   - "Back to the hall" is a grey slab.
9. **Minor:**
   - the 30-ending and 32-end-card scenes have side bands while the hangout is full width;
   - the hangout opens with an 80 px empty band;
   - the title's coffee and copy-link pills sit on the candle art;
   - the "New pages" pill looks like a sticker.

## Scope (phones; desktop untouched unless it's a clear fix, called out)
1. **Title:** FUSE's bubble never intersects the logo on any phone (add an e2e box check). Tidy the bottom pills so they sit on a clean band.
2. **Hall doors.**
   - A locked door's plate says what opens it in plain words on tap, e.g. "Locked: solve Relay Tower first".
   - On the map, drop the pip strip and "+N" on phones, or replace them with something that explains itself. The PM's lean: a lock and the name only, with gem needs shown in the tap card as named gem icons.
   - The first visit makes "Start here" the single brightest thing.
   - One plate style family: open, solved ✓ and locked variants of the same plate, with the ✓ inside the plate.
3. **Tap card:** plain words, no wrapping mid-name, never covers the tapped door's own plate, and it closes when the Menu or any panel opens.
4. **Hall framing:** no cropped arches on any phone; the Next chip is clear of the edge and the frame.
5. **Settings:** two tabs ("Sound & Comfort", "Graphics & Save") or an equivalent where every view is whole. No orphan headers and no fake dropdown. Every row is whole on SE.
6. **Codex (SE):** no text clipped mid-line. If the page scrolls, show a clear cue (fade plus chevron); better still, fit.
7. **Journal (SE):** arrows and ✕ are fully on screen and off the art; the subtitle is clear of the tabs.
8. **End card.**
   - Centred and balanced on all phones, with the clipboard clear of every button (move or shrink it).
   - Subtitles on a darkened band or plate at ≥4.5:1.
   - Buttons on a tidy grid (Join first, per D-034).
   - "Back to the hall" is a clear secondary button. "This was the whole game…" is plain text, not a pill.
9. **The ending scenes** use consistent framing with the hangout. Remove the hangout's empty top band, and add a small "plays by itself · Skip" cue.

## Out of scope
- Everything on the altar (mobile-6-zoom, mobile-6-board, mobile-6-moments).
- Codex *copy* (mobile-6-moments rewrites the rule text). You own the Codex layout only.

## File ownership
- **You own:** `scenes/title/`, `scenes/hall/`, `scenes/journal/`, `scenes/ending/`, the Settings, Codex and menu UI, and their phone styles.

## Done when
- Everything above is fixed.
- Captures: `M2_TAG=m6chrome` plus `M4_TAG=m6chrome` `mobile-4-chrome` sheets on all four phones, reviewed by you as a newcomer.
- The e2e tests in `mobile-chrome.spec.ts` / `mobile-ending.spec.ts` are extended (logo vs bubble, tap card closes on Menu, end-card centring).
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log

### mobile-6-chrome agent, 2026-11-03

What changed, by goal (phones unless noted):

1. **Title.** FUSE's card measures the logo (`.lr-title`) as a region to avoid, and its top
   corners drop to just under the subtitle (`--lr-title-cap-top`), so it never covers the logo
   or the menu. The release label and Ko-fi pill sit on a clean dark band.
2. **Hall doors.** One plate family: padlock + name (dimmed) for locked, name in gold for open,
   ✓ inside the plate for restored. No pips, no "+N". "Start here" stays the brightest thing.
3. **Tap card.** `lockedNote` says it in plain words ("Locked: solve 14 more machines first",
   "Locked: solve The Furnace and The Crane first", "Locked: earn these gems first"), with
   non-breaking spaces inside names; the needed gems are shown as named icons on the card. The
   card is placed clear of its own plate and closes when the Menu or a panel opens.
4. **Hall framing.** The phone hall band moved up 24 px (`HALL_BAND` top −24) so the top arches
   are whole; the Next tag sits clear. hall-frame tests now use 720-tall views.
5. **Settings.** Two tabs, "Sound & Comfort" and "Graphics & Save" (role=tablist/tab/tabpanel),
   each a whole view; the "Graphics & Save ›" jump and its fake-dropdown look are gone. Reset
   keeps its own "Start over" group on Graphics & Save. Whole on SE at 100% text.
6. **Codex (SE).** Tighter type at ≤330 px tall so every page fits; where one still runs long it
   fades and shows a ⌄ cue (hidden on desktop). Layout only, no copy.
7. **Journal (SE).** ‹ and › sit in the side lanes, off the art and off the quill; the subtitle
   is clear of the tabs.
8. **End card.** Centred plate, two-column grid: Join | Copy invite link, Buy a coffee | Copy
   Ko-fi link (Join first, D-034); the closing line is plain cream text on the plate; "Back to
   the hall" is an outlined secondary button across both columns. The title's lines sit on a
   dark band. The clipboard rests at a phone spot (`PHONE_CLIP`, x 1760, y 790) right of the
   plate, clear of every button on all four phones.
9. **Ending scenes.** The ending now fills the width like its hangout (`FILL_BANDS.ending`), so
   30-ending and the end card have no side bands; Skip, caption, hangout and the end column move
   in by the crop. The hangout's messages start under its header (no empty top band). A "Plays
   by itself" chip sits beside Skip (alone in Skip's place on a first ending).

e2e added: FUSE's card vs logo and menu (mobile-chrome), tap card never on its plate and closes
on Menu, both Settings tabs fold on whole rows and Reset reachable on Graphics & Save, locked
plates show no pips/"+N", end card centred with the grid order checked, title dark band, closing
line ≥4.5:1 on the plate (mobile-ending).

Shared / desktop changes (called out):
- `game/ctx.ts` FILL_BANDS gains `ending` (phones only; desktop is never cropped).
- `ui/settings-panel.ts`: the desktop path was refactored (sections built once) but renders the
  same two columns, so nothing on desktop looks different.
- `ui/codex.ts`: adds a ⌄ cue element per page, hidden on desktop by CSS.
- `scenes/ending/ending-scene.ts`: `clipPage()` takes the rest pose; desktop keeps
  `ENDING_LAYOUT.clip`. Removed the mobile-4 SE-only "move the column left" rule.

Remaining weaknesses (honest):
- On SE, locked plates with long names wrap onto two lines.
- At 150% text a Settings tab can still run past its view; it scrolls with the drawn thumb.
- On SE the end card is tight: Back to the hall ends ~10 px above the bottom edge.
- The "Plays by itself" chip shows through the credits too, not just the cinematic.
