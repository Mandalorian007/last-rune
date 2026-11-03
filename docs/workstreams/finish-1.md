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
