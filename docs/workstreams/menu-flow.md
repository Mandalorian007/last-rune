# Workstream: menu-flow (clean, obvious menus end to end)

Source: D-043 (user left menu flow to the PM). Goal: a first-time player on a phone or desktop always knows where they are, how to go back, and how to reach Settings, Codex and Journal. Fewer, clearer choices beat more.

## Do
1. **Audit first.** Walk title → hall → altar → altar menu → solve → hall → ending → end card, plus Settings, Codex, Journal from each place they open, on desktop 1280×720, iPad and SE/Android. Note every dead end, duplicate path, inconsistent label ("Back"/"Close"/"Resume"), inconsistent placement or key (Esc, B on pad, browser back), and focus that lands somewhere odd. Write the findings in the log before changing code.
2. **Fix what the audit finds.** One back/close pattern everywhere; Esc and pad B always go one level up; focus returns to the button that opened a panel; the altar menu lists only what you need mid-puzzle.
3. **Journal in the altar menu** if it fits SE without crowding (PM wants it: pages land at the solve and players reread them). Opening it from the altar returns to the same board state.
4. Stay out of gem rendering (glyph-truth) and strike/verdict copy (strike-free).

## Done when
- Audit table + fixes logged here; before/after shots (`SHOTS=menu-flow`) on SE, Android, desktop.
- e2e covers: Esc/back from every panel returns to its opener with focus restored; Journal from the altar menu returns to the unchanged board.
- `pnpm check`, `pnpm build`, `pnpm test:e2e` green; run `pnpm baseline` and list intended diffs (PM regenerates).
- Commit to `ws/menu-flow`, never merge. Log here.

## Log
