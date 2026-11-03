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

### 2026-11-03: mobile-4-chrome pass

**Item 1 finding: a capture artefact, not a real-play bug.**
- Gate review 1's `02-hall-fuse` shot came from `scripts/playtest/mobile-2.spec.ts` and `mobile-3-chrome.spec.ts`. Both *forced* `fuse.say(hallLines('first-entry')…)` on a save seeded with three solved machines.
- In real play the welcome plays only while `flags.hallIntro` is false. `HallScene.enter()` sets that flag on the very first hall visit, and no machine can be solved without entering the hall first. Nothing reads the URL for a save outside DEV demos.
- The only way to reach it was an imported or hand-made save with progress and `hallIntro: false`. That case is now guarded as well: the welcome plays only while the Intake Desk is the suggested door (`welcomeFits` in `hall-scene.ts`).
- The welcome is now said on the first `update()`, not inside `enter()`. The flow's `onChange` (which clears FUSE's avoid regions outside puzzles) runs after `enter()`, so the regions set for the welcome were being wiped.
- Every hall line (welcome, door barks, ambient) now passes the suggested door and the named door (ring plus tag) as avoid regions. The card can't cover them. `exit()` and `pause()` clear the regions.
- The capture now shows a real new game (`02-hall-first`) and an ambient line on a save with progress (`02-hall-fuse`).

**What changed**
- **Settings (phones):**
  - Native scroll, with a drawn gold thumb on a rail (`.lr-settings-rail`/`-thumb`, since iOS hides its own).
  - The existing bottom fade shows only while more is below.
  - "More ▾" is now "Graphics & Save ▾". It smooth-scrolls to the Graphics/Save sections and hides once they are in view.
  - The Save box (Reset included) is always reachable by scrolling.
- **Codex (phones):**
  - The ✕ has its own gutter in the leather, right of the pages (`.lr-codex` padding-right), and is light-on-leather.
  - Page headers no longer reserve room for it.
  - The folio is hidden.
  - A page that still runs long scrolls, with a bottom fade while more is below (`data-more`, synced in `codex.ts`).
- **Journal (phones):**
  - Handwriting is `tpx(15.5)` bold in near-black ink, on the 54 px rule pitch (`max(54px, 1.15em)`).
  - Day list at `tpx(14.5–15)`. "New" is a red dot, so "Day 10,366" is never cut.
  - "Back to the hall" is hidden; the ✕ is the one exit.
  - Page 16's signature moves two rules down so the larger hand never runs into it. All 16 pages fit on every phone.
- **Title:**
  - "Full screen" is hidden where the Fullscreen API is off (already the case through `fullscreenAvailable`), on iPhone/iPod user agents, and after a press the browser refuses.
  - The gate shot was Chromium emulation, where the API exists.
- **Hangout (phones):**
  - The message bar is a flat, unfocusable "🔒 Read-only channel" strip until FUSE drafts in it. Nothing in the hangout is focusable.
  - The repeated `.lr-hg-start` "#introductions" block is hidden; the top bar names the channel.
- **End card (phones):**
  - The closing line sits on a solid dark plate: ≥4.5:1 against the brightest gold, and the test checks it.
  - The Copy buttons read "Copy invite link" and "Copy Ko-fi link". Desktop keeps "Copy link", and the aria-labels already named the target.
  - The clipboard was already `pointer-events: none` and clear of controls.
- **"Time on site"** is real (`stats.playSeconds`, ticked by `flow.tick`). The gate run had played about 1 minute. It is kept as is.
- Desktop and iPad are unchanged. Every rule is under the phone selector, and the Copy label switch needs `data-phone`.

**Tests**
- `tests/e2e/mobile-chrome.spec.ts`, new test "phone chrome polish" on se, iphone, promax and android:
  - no Full screen button with `fullscreenEnabled = false`;
  - the welcome plays on a new game, and its card misses the Start here ring and tag;
  - no welcome on a save with progress but `hallIntro: false`;
  - Settings shows the thumb and "Graphics & Save", and scrolls Reset into view;
  - on every Codex tab, no page box meets the tabs or the ✕, and a long page scrolls;
  - Journal body ≥15 px, one exit, and all 16 pages fit at 100% and 150% text.
- `tests/e2e/mobile-ending.spec.ts`:
  - the hangout has no focusable control;
  - the bar reads "Read-only channel";
  - no repeated start header;
  - the Copy labels name their links;
  - the footer contrast is ≥4.5:1.

**Captures** (git-ignored): `docs/design/screens/local/mobile-4-chrome/{before,after}-<vp>.png` and `…-<vp>-ending.png` for iphone, se, promax, android, desktop and ipad. The spec is `scripts/playtest/mobile-4-chrome.spec.ts`.
- Capture note: Vite's dev server reloads the page when a source file changes. Editing while the slow ending capture runs sends it back to the title, which is why the first "before" phone ending sheets showed the title. Don't edit during captures.

**Proposals (for the PM)**
- `scripts/playtest/mobile-2.spec.ts` and the gate-review capture still force the first-entry line on a save with progress. Retire that shot or point it at a new game, or a reviewer will flag it again.
