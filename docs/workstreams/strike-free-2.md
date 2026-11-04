# Workstream: strike-free-2 (two leftovers before blind review 7)

Source: strike-free report (D-043).

## Do
1. **Capacitor Bay arrival card on SE.** If Capacitor Bay opens at first meeting with gems already on the board, the SE lane draws the Capacitor plan read-out over the arrival card. The card shows only "New here · 1 of 2" with its body hidden. Fresh boards are fine. Make the arrival card and the plan read-out never collide on any phone (the card wins while it shows; the plan can wait or sit elsewhere). Check every multi-strike altar (capacitor-bay, roof-array, lift-shaft, the-last-rune) on all four phones, both on a fresh board and on a pre-filled one.
2. **End card: no miss count (PM call under D-043).** "Breakers tripped: N. Generous." counts misses, which contradicts "a miss costs nothing". Replace it with a FUSE line in the same dry voice that counts nothing. Keep `attempts` and the breaker count in the save.

## Done when
- An e2e test: pre-filled multi-strike altars at first meeting on the SE and Android, where the arrival card body is visible and doesn't overlap the plan read-out.
- Shots under `SHOTS=strike-free-2`, checked at real size.
- `pnpm check`, `pnpm build`, `pnpm test:e2e` green (rerun timeouts alone with `--workers=1`). Commit to `ws/strike-free-2`, never merge. Log here.

## Log
- 2026-11-04: **Arrival card vs plan.** Reproduced on the SE only: Capacitor Bay at first meeting with its first try on the board (charge reaches the Capacitor) squeezed the card to its "New here · 1 of 2" footer under the dashed plan. Fix (altar-column-styles.ts): while the arrival card is up, the Capacitor's plan read-out waits (`display: none`), like it already does for a gem in hand or FUSE speaking; it comes back once the card closes. A live (post-Strike) read-out is untouched. Roof Array, Lift Shaft and The Last Rune bring no new piece, so they show no arrival card; the test still opens them fresh and pre-filled.
- **End card.** `safetyRecordLine` counts nothing: "Visitor #4,211. Time on site: 1h 2m. Breakers reset at no charge. Monitoring continues." `PlayStats` is now just `playSeconds`; `breakersTripped` and `attempts` stay in the save (stats only).
- **Test.** `tests/e2e/strike-free-2.spec.ts`: SE, iPhone, Pro Max, Android; the four multi-strike altars fresh and pre-filled (all intended gems but the last), plus Capacitor Bay's first try. The card body shows whole, no read-out meets the card, and after the card closes the plan is back. Fails on the SE before the fix ("card body runs out of the card").
- Shots: `SHOTS=strike-free-2` (and `strike-free-2-before` for the bug), checked at real size.
