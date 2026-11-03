# Workstream: finish-1

Leftovers from bug-bash (see the findings table in `docs/workstreams/bug-bash.md`). The PM is making the polish calls (D-037 context).

## Scope
1. **(#13) Fonts.**
   - Toasts and the ending's closing line ("This was the whole game…") use the sans UI font.
   - Decision: story text and toasts use the game's serif, like the rest of the UI chrome.
   - Keep the sans only where it is already deliberate (e.g. key caps), and audit for other stragglers.
2. **(#14) End-card prop.**
   - A tilted brown card prop near "Back to the hall" reads as clutter or an unclear object.
   - Find out what it is meant to be (e.g. a safety-record card or the Builder's mark), then make it read clearly or remove it. Prefer clarity (D-027).
3. **(#15) Tag flip.** Fix the pop-in so tags flipped below a cell animate from their own position.
4. **Fresh-eyes pass on the ending and end card** at 1920 and at 1280 with 150% text. Fix anything small that's unclear.

Out of scope:
- Engine loop and device loss (perf-low).
- Puzzles.
- Lighting.

## Done when
- Before/after screenshots in `docs/design/screens/local/finish-1/`. Don't commit them.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log

### 2026-11-02: done (branch `ws/finish-1`)

Screens: `docs/design/screens/local/finish-1/{before,after,after-ending}/` (gitignored). Captures: `scripts/playtest/finish-1.spec.ts` (hall toast, journal plate, replayed ending skipped to the end card, post-credits note; 1920 and 1280 at 150%), plus `ending-2.spec.ts` for the full ending.

| # | What | Change |
|---|---|---|
| 13 | Toasts and the closing line used the sans | Toasts (`.tc-toast`, game override, 26px), the closing line (`.lr-end-footer`, 27px), the Ko-fi links (end card and title) and the engine Copy link chips/fallback text now use the game serif. **Audit:** FUSE's journal plate (story text) was sans too and is now serif. It is capped at 38px so the longest plate (page 4) still fits in three lines at 150%. Sans kept on purpose: HUD key caps, the tiny release tag, and the tracked uppercase labels ("SAFETY RECORD", credit roles, journal "NEW"/blank-slip labels, caption speaker name). |
| 14 | Tilted brown card near "Back to the hall" | It is FUSE's clipboard, which he drops at the door. Under the gold flood it was a bare amber board with no page. At 1280/150% it also covered the end of the closing line, and the post-credits note overflowed the board and the bottom of the screen. **Fix:** the board now carries his form (a GPU parchment page while it falls, then the crisp lined DOM form from the title card on), so it reads as a clipboard. It rests bottom right at (1640, 905), larger (210×264) and less tilted, clear of the links, line and Back at every text size and wholly on screen. The post-credits flip is unchanged. The note's hand text grows with Text size only to 27px, so "Monitoring." fits. The new page's words are added only when it flips, so screen readers hear them then. |
| 15 | Below-cell tags popped in from the above-cell offset | `lr-altar-pop` starts from `var(--lr-tag-pop-from, -80%)`; below-tags set it to `calc(7px - 20%)`, so they emerge downward from their own cell (mirror of the above pop). Reduced motion is unchanged. |
| — | Fresh-eyes pass (ending + end card, 1920 and 1280/150%) | Nothing else blocking. Note for art: when FUSE drops the clipboard at the door, it now travels about 290px right of FUSE's clamp to its new spot; at fall speed it reads as a toss. |
