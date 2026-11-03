# Workstream: mobile-6-integrate (the four mobile-6 pieces, working together)

## Background
mobile-6-zoom, -board, -moments and -chrome were built in parallel and merged on 2026-11-03. Each was checked on its own; nobody has seen them together. Before gate review 4, the PM wants one pass that makes them one product. Read the Log sections of `docs/workstreams/mobile-6-{zoom,board,moments,chrome}.md` first.

## Scope (phones unless noted)
1. **Zoom teaching.** Call `AltarScene.setHintLine('zoom', …)` (mobile-6-moments' API):
   - "Tap the board to zoom in" the first time a zoomable board is open, until the player first zooms;
   - when zoomed, optionally "Drag to look around".
   - Holding beats zoom in the hint slot, per the API.
2. **Pinned cards never cover sockets when zoomed.**
   - The mobile-6-zoom shots show the "Needs 20" and "Needs 4" cards pinned at the view's edge and sitting on sockets (`docs/design/screens/local/mobile-6-zoom/iphone/03-holding.png`).
   - When a gauge is off-view, shrink its card to a compact edge chip (arrow + number) in the margin.
   - When on-view, the card must not overlap any socket's tap circle.
   - Add an e2e assertion.
3. **The arbiter knows about zoom and the held state.**
   - With a board zoomed and the board sliding under the column, the right-column lane, tips, teach cards and verdicts still never overlap the tray, Strike or labels.
   - Re-run the mobile-moments "one owner" test with a zoomed board.
   - The "Holding: X" pill (mobile-6-board, in the title slot) and the hint slot must not say contradictory things.
4. **Old copy left behind.**
   - The gate captures still show "Turns the bolt 90°…" in the zoom shots. Make sure no player-facing string anywhere says bolt, fizzle, stem or arms.
   - Add a note to `docs/design/rules.md` that the player-facing noun is "charge".
   - Fix the `ui/codex-diagram.ts` header comment.
5. **Capture scripts.**
   - `scripts/playtest/mobile-4-chrome.spec.ts` "03-settings-end" should click the Graphics & Save tab.
   - `scripts/playtest/mobile-2.spec.ts` should add, for The Last Rune on each phone: zoomed with a gem held (`10-the-last-rune-zoomed`), and a fail verdict on a dense board.
6. **Your own newcomer pass.**
   - Run `M2_TAG=m6int` captures (the mobile-2, pm-review and mobile-4-chrome specs) on all four phones. Look at every shot as a first-time player.
   - Fix anything that overlaps, clips or contradicts within this scope.
   - List anything larger in your log for the PM; don't fix it.

## Out of scope
New features or restyles. This pass makes the existing pieces agree.

## Done when
- Everything above is done.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass, with flakes rerun and named in the log.
- The log lists your changes and the capture paths.

## Log
