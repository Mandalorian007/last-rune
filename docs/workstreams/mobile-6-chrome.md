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
