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
