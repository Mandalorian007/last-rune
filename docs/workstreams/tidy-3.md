# Workstream: tidy-3

User (2026-11-02): "fix the minor issues now". These are the last minor items before the playtest and v1.0. PM judgement applies (D-027: intuitiveness first, and visuals match the rules).

## Scope
1. **FUSE's caption covers his body.**
   - At 1280×720 with 150% text, when a fail verdict is docked on the altar, FUSE's caption covers his body on the left (newcomer-3 log).
   - Fix it so the caption, FUSE's body, the verdict and the red mark are all visible together. Use the existing avoid/lane system (`fuse.avoid(rects)` and the caption lane) rather than special cases.
   - Check 1280×720 at 100/125/150% and 1920×1080, with and without a docked verdict.
   - Add or extend a layout-fit e2e test.
2. **Amplify's doubled diamond blurs together in the Codex** under bloom (newcomer-3 doubled the mark in `shaders/gem-wgsl.ts`).
   - Make the two diamonds read as two at Codex portrait size, without bloom haloes merging them.
   - Options: more gap or a thinner stroke at small sizes, or less bloom on the portrait bake. Your call.
   - The altar must still read clearly. Check both.
3. **The hall's open alcove doorway reads white-gold**, not gold (candle-light log).
   - Make the available doorway read clearly gold/warm while it stays the brightest, most inviting thing nearby. Don't brighten the candles.
   - Small change only.
4. **The ~52 ms audio-load long task.**
   - Attribute it first, following the tidy-2 proposal (`docs/workstreams/tidy-2.md` §3): use a performance trace around `lr:audio-ready` with `PERF_LOAD=1`.
   - If one sound or one step causes it, split or slice that work so no task in the pre-render window is over ~50 ms.
   - Don't add a Worker. Log before/after numbers.

Out of scope:
- The ending scene and its files. ending-3 is running there; don't touch `scenes/ending/`.
- Puzzles and rules.
- Wording.

## Done when
- Before/after screenshots for 1–3 in `docs/design/screens/local/tidy-3/`. Don't commit them.
- Trace numbers for 4 in the log.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log
