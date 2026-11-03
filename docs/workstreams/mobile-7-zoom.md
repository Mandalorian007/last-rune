# Workstream: mobile-7-zoom (zoom keeps context)

Gate review 4 failed at 6.4 (D-040 addendum 5). All three altar reviewers say dense boards are too small at the fit view, and that zoom loses context. Zoom stays: the board is limited by height. Your job is to make zoom feel like a feature. Evidence: `docs/design/screens/local/mobile-2/gate4/*/10-the-last-rune-zoomed.png`, `13-the-last-rune-verdict.png` and `15-capacitor-teach.png` (android vs promax).

## Scope
1. **Minimap while zoomed.** Show a small whole-board overview in a corner that's free on every phone (take it from the right column's spare space; don't cover sockets). It shows the viewport rectangle, the source, the gauges and the placed gems. Tapping it jumps there. It is hidden at the fit view.
2. **Edge chips in a gutter.** When zoomed, off-view Gives/Needs chips sit in a reserved edge gutter outside the cell area, never over cells. The same goes for on-view cards: no cell is covered (extend the existing e2e).
3. **No half-cropped source or gauges.** Pan clamping keeps them either fully in view or fully out (and shown as a chip).
4. **Edge arrows** are ≥28 px, high contrast and tappable (each pans one step).
5. **The Holding pill never touches Menu**, on any phone (`03-splitter-mill-held` on iphone). Add an e2e gap check (≥8 px).
6. **Consistency.** The Zoom button and hint follow one rule across phones. Explain why Capacitor Bay showed Zoom on android but not promax, and make it consistent (offer zoom whenever the fit pitch is under 44 px).
7. **The zoom hint points at the board.** "Tap the board to zoom in" should visually connect to the board, e.g. a small magnifier badge on the board corner.

## Ownership
`zoom.ts`, `zoom-ui.ts`, the zoom transform in `altar-view.ts`, and tests/e2e/mobile-zoom.spec.ts. Keep `altar-scene.ts` edits small: mobile-7-teach and mobile-7-strike also touch it.

## Rules
- Phones first: iphone 844×340 (47 px insets), se 667×320, promax 932×380 (59 px insets), android 915×360. Desktop and iPad may not regress; show a 1920 before/after if you touch them.
- `engine/` has no game nouns, and `rules/` stays pure. Use pnpm only. Propose changes to `types.ts`, the save schema or DECISIONS to the PM; do not edit them.
- Captures go to `docs/design/screens/local/` (git-ignored, never committed). Use the existing specs: `M2_TAG=<tag> M4_TAG=<tag> pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2 pm-review mobile-4-chrome`.
- Review your own captures as a first-time player asking "is this a highly polished, intuitive, mobile-supported interface?" before you report.
- Commit to your own branch `ws/<name>`. Never merge to main. Log what you did, and any larger issues left open, in this file.

## Done when
- Every scope item is fixed on all four phones, verified in your captures, and covered by an e2e or unit assertion where it can be measured.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` are green.
- The log lists what you changed and gives capture paths.

## Log

