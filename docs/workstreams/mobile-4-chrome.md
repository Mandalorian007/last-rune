# Workstream: mobile-4-chrome (phone hall, menus and ending: the last clarity gaps)

## Background
The D-040 gate review (4 blind reviewers, 2026-11-03) scored 6–6.5/10, so the gate failed. These are the problems in the screens around the altar, checked by the PM. Screens are in `docs/design/screens/local/mobile-2/gate1/<vp>/`.

1. **The hall's first FUSE line points the wrong way (2 of 4, "close to a blocker").**
   - In `02-hall-fuse` FUSE says "Start with the intake desk: the gold doorway". But the save in the shot has progressed: a different door carries "Next", several doors glow gold, and FUSE's bubble covers the Intake Desk door.
   - Work out whether the line can fire on a progressed save in real play, or whether the capture seeded inconsistent state.
   - Either way, the welcome line must only play when the Intake Desk is the "Start here" door. FUSE's hall bubble must never cover the door it's talking about, or the Start here/Next door.
   - If it was a capture artefact, fix the capture so the shot shows a real first visit.
2. **Settings content is hidden behind a fade, and "More ▾" reads like a dropdown** (`03-settings` on se, iphone and android).
   - Make the body plainly scrollable: native scroll, a visible scroll thumb, and a fade at the bottom only while there is more below.
   - Replace "More ▾" with something that reads as "scroll down", e.g. a "Graphics & Save ▾" jump that scrolls, or drop it.
   - On promax and android everything should fit or scroll cleanly, and the Save box must never be cut mid-field without a scroll affordance.
3. **The Codex is clipped on SE.** The "out = in, turned 90°" line is cut by the tab bar, and the ✕ crowds the right page's header (`04-codex`, se and iphone).
   - The page body must end above the tabs, or scroll.
   - Give the ✕ its own space so it never touches page content.
4. **Journal** (`05-journal`, se and iphone).
   - The handwriting is too small and faint: make the body ≥15 px with stronger ink on phones, and make the Day list scannable.
   - Two exits: on phones, drop "Back to the hall" and keep the ✕, per the D-040 ✕ convention.
5. **Title.** "Full screen" does nothing on iPhone Safari, because the Fullscreen API isn't available for elements there. Hide it when `document.fullscreenEnabled` is false, or the API is missing.
6. **Hangout** (`31-hangout`).
   - The "Message #introductions" input looks typeable but isn't. On phones, either remove it or render it as a clearly inert read-only bar ("Read-only channel"). D-040 says no dead controls.
   - Remove the duplicated "#introductions" header on promax.
7. **End card** (`32-end-card`).
   - "This was the whole game. Thank you for finishing it." is thin white on bright gold: give it strong contrast (≥4.5:1).
   - The two "Copy link" buttons must say which link they copy.
   - The clipboard prop must not look tappable next to the buttons on SE.
   - Check whether "Time on site: 1m" is a real stat. If it is real, keep it.

**Out of scope:**
- the altar scene (that's mobile-4-board);
- rules and puzzles;
- wording, except the button labels in 7 and the hint labels in 2;
- desktop/iPad changes, except 1, which fixes the welcome line's trigger everywhere if it's a real bug.

Keep `ui/phone-styles.ts` edits in a `/* mobile-4-chrome */` block.

## Tests and capture
- Extend `tests/e2e/mobile-chrome.spec.ts` and `mobile-ending.spec.ts`:
  - Settings scrolls to Save on every phone viewport;
  - Codex body text doesn't overlap the tabs or the ✕;
  - the journal body text is ≥15 px on phones;
  - no "Full screen" button when fullscreen isn't supported;
  - the hangout has no focusable input on phones.
- Capture before/after contact sheets in `docs/design/screens/local/mobile-4-chrome/` for iphone, se, promax, android, desktop and ipad. Reuse the mobile-3-chrome and mobile-3-ending specs.
- Critique your own sheets as a first-time player before reporting.

## Done when
- Everything above is fixed.
- Desktop and iPad are unchanged, apart from noted exceptions.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- Log in this file.

## Log
