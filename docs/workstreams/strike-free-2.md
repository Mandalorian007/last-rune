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
