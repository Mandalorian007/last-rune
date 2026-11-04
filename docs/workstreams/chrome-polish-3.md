# Workstream: chrome-polish-3 (Phase 2, non-altar phone polish; gates Gate 2)

Decisions: D-027, D-040 addenda 5–6, D-041.
Evidence: blind-review screenshots in the MAIN repo at `docs/design/screens/local/gate5/` (chrome shots 01–06 and 30–32, plus `portrait/`).

## Scope (all reviewers flagged these as minors; fix every one)
1. **Title (`01-title`).**
   - FUSE's dialogue bar covers the orb.
   - The "Copy link" pill has a stray dark circle at its right end.
   - "Buy ThunderSoap a coffee" / "Copy link" are washed out by the candle glow.
   - Hide "Full screen" where the browser can't do it (iPhone Safari).
2. **Portrait title (`portrait/01-title`).** The picture is a thin letterboxed band with about 40% black above and below. Make it a full, balanced upright screen. The rotate screens (40, 41) should use the game's serif.
3. **Hall (`02-hall`, `02-hall-mid`).**
   - The "New page in journal" toast is salmon, jammed against the right edge under Menu, and styled unlike everything else. Use the game's own toast style, clear of the safe area.
   - Labels wrap awkwardly ("Conveyor / A") or spill ("Capacitor Bay") and sit over doorway art.
4. **Settings (`03-settings-*`).**
   - The dialog's height changes between tabs (title and ✕ jump).
   - It has both ✕ and Done: keep one clear close.
   - The Graphics tab is half empty.
5. **Codex (`04-codex`).** Gem thumbnails crop their own badges. FUSE quotes and "In 4 → out 4" are in a monospace face: use the game's serif.
6. **Journal (`05-journal`).**
   - It is pillarboxed.
   - The quill overlaps item 4.
   - The ‹ › buttons sit on the pages.
   - The caption box has a stray bullet.
7. **Hall menu vs in-altar menu.** Decide whether Journal belongs in both and make them consistent. The in-altar dropdown placement is owned by ws/port-altar-3; you own its items only.
8. **Ending (`30`, `31`, `32`).**
   - "Plays by itself" is ambiguous: show a clear skip/continue affordance or a clear "auto-plays" status.
   - The hangout parody switches to a system font. Keep the joke, but it must not read as a real external app or an ad (keep it in-world).
   - The end-card clipboard prop is cut off at the bottom-right.
   - Check that the climax rune matches the hall's bind-rune.

## Out of scope
- The altar scene (ws/port-altar-3 and ws/altar-truth own it).
- `ui/phone-styles.ts` is being deleted by port-altar-3. Put chrome fixes in each scene's own styles. If a rule you need lives only in phone-styles.ts, move it to the scene's styles and note it in the log so the PM can resolve the merge.

## Acceptance
- Product e2e for any layout claim you can assert (no overlap, close button position stable across tabs).
- `SHOTS=chrome3 SHOTS_ONLY=...` (see tests/e2e/shots.spec.ts) for every affected screen on all four phones and portrait, into your worktree. Look at them as a first-time player.
- Desktop and iPad baselines unchanged except intended diffs (list them).

## Rules
- pnpm only. Commit to `ws/chrome-polish-3`; never merge.
- Gates: `pnpm check`, `pnpm build`, `pnpm baseline`, `pnpm test:e2e`.

## Log

### 2026-11-04: all eight items done (agent)

**Per item**
1. **Title.**
   - FUSE's docked line starts at 41% of the width, right of the storm cell (design x ≤ 740), on phones in landscape (chrome-styles `${CL}:has(.lr-title-menu) .tc-caption[data-docked]`).
   - The link pills are solid, with no stray circle, and read clearly over the glow.
   - Full screen is not placed at all where it can't work: an iPhone user agent or no Fullscreen API (`fullscreenButton().possible`).
2. **Portrait title.**
   - The `fill` row takes everything the buttons, lane and links leave, and the title fills that frame's height, cropping its sides (`TITLE_UPRIGHT`, new engine fill options, below).
   - The emboss and windows are re-placed for upright.
   - The rotate card uses `defaultTheme.fontBody`, the game serif.
3. **Hall.**
   - The "New page in journal" badge is a small dark plate with a gold top rule (the game's toast look), under Menu and inside the rail.
   - A door name breaks only between words, and a short last word keeps to the word before it (a nowrap pair in hud.ts, so the text is unchanged).
   - The new `spreadPlates()` pushes touching plates apart along their row.
   - `min-width: min-content` stops a plate from spilling (`scenes/hall/door-plate-styles.ts`).
4. **Settings (phones).**
   - The scroll box is locked to the tallest page's height, so the ✕ and title hold still across tabs.
   - Done is gone on phones; the ✕ is the one close. Desktop keeps Done, since layout-fit checks it.
   - Reduce flashes moved to Graphics, which is now full.
5. **Codex.**
   - The maths line and FUSE's note use `--tc-font-body`; the note is italic.
   - On phones the plate badges are smaller, so none is cut.
6. **Journal (phones).**
   - The bars beside the desk are the desk's own dark wood (`DESK_BARS` on `#app` and body while the journal shows), and the band is `minVisible 1000, focusY 528`.
   - The quill stands straighter and shorter (`PHONE_QUILL`), clear of the list.
   - ‹ › flank FUSE's plate under the book, not on the leaves.
   - The plate's lamp dot (the "stray bullet") is gone on phones.
   - All of this is in `scenes/journal/journal-phone-styles.ts`.
7. **Menus (decision, for the PM to log).**
   - Journal stays hall-only. The journal is a room off the hall (the desk), so opening it from an altar would mean leaving the altar.
   - The altar menu is the hall menu minus Journal, in the same order and look: Codex, Settings. No code change was needed.
   - e2e: `chrome-polish.spec.ts` asserts this.
8. **Ending.**
   - "Plays by itself" now has a gold ▶ and a slow light running under it (a "now playing" cue). It is still bare text and takes no taps; reduced motion stills it.
   - The hangout uses the game serif. The mono and sans labels (NEW ARRIVAL, SAFETY RECORD, credits headings) use the display serif. Its slate greys are now the hall's dark wood and ink, so it reads as FUSE's in-world idea of a hangout, not a real app.
   - The clipboard rests further in (`PHONE_CLIP` 1735,780) with a 24 CSS px margin (was 12). It had been on screen but pressed into the corner and the canvas's dark edge, so it read as cut.
   - Rune: the climax disc's central mark was a different glyph (the "Builder's mark", a triangle and cross). It now draws the Last Rune stroke for stroke as the hall seal's `rune_glyph` (`last_rune_e` in ending-wgsl.ts), keeping three gem dots and the ring. It is gold there because the disc is lit gold; the hall's is purple because the seal glows.

**Rules moved from `ui/phone-styles.ts`**

These override phone-styles; nothing there was edited. Each new file is appended after PHONE_CSS in `ui/styles.ts`, so it wins. When port-altar-3 deletes phone-styles, keep these files.
- Journal page arrows (mobile-6-chrome put them on the leaves' outer corners) and the plate's `::before` lamp: now in `scenes/journal/journal-phone-styles.ts`.
- Door plate width rules: now in `scenes/hall/door-plate-styles.ts`.
- The New-page badge (`.lr-hud-menu-new`): this lives in `ui/chrome-styles.ts`, not phone-styles.

**Engine (proposed, additive):** `FillWidthOptions.minVisibleWidth` and `focusX` (height fill, side crop), with 4 new letterbox tests and a CHANGELOG line.

**Tests**
- New `tests/e2e/chrome-polish.spec.ts`, on 4 phones plus an iPhone user agent, checks:
  - title line vs storm cell and menu;
  - Settings ✕ stable across tabs, equal height, no Done;
  - plates break only between words and none overlap;
  - Codex badges uncut;
  - altar menu = hall menu minus Journal;
  - an iPhone user agent never shows Full screen.
- `mobile-chrome.spec.ts`: the journal-arrow check now asserts the new placement (by the plate's ends, off the leaves, off FUSE's line), and the quill clears the page list (`JournalScene.quillBox()`).
- `ending-layout.test.ts`: margin 24.

**Intended baseline diffs** (`pnpm baseline`: 9 fail, all intended; set not regenerated, PM's call):
- `codex` ×3 viewports (desktop-720 1.70%): the codex text is now the game serif, not monospace (scope 5).
- `ending-hangout` ×3 (desktop-720 62%): the in-world serif and the warm-wood palette replace the app greys; the auto-play cue (scope 8).
- `end-card` ×3 (desktop-720 0.12%): the SAFETY RECORD and credits small heads use the display serif (scope 8).
- The first run also failed `ipad/journal` (19%) because the desk-wood side bars were applied on all devices. Fixed: the bars now apply on phones only (`chrome?.active`). The rerun passed, as did `furnace, empty`, which had been a one-off flake.

Regenerate with `BASELINE_UPDATE=1 pnpm baseline -g "codex|hangout|end card"` after merge.
