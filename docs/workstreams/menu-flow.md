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

### 2026-11-04: audit (before any code)

Walked title → Settings → hall → ☰ / Codex / Esc / Journal → altar → ☰ / Settings / Esc → solve card → end card on SE 667×320, Android 915×360, iPad 1180×820 and desktop 1280×720 (`scripts/playtest/menu-flow.spec.ts`, `SHOTS=menu-flow-before`). Focus and Esc results are logged by the spec.

| # | Where | Finding | Severity | Action |
|---|---|---|---|---|
| 1 | Phone ☰ list (hall, altar) | Esc does not close the open list. The key falls through to the scene: in the hall it opens Settings on top of the open list, and at an altar it would go Back to the hall with the list still open. | Bug | **Fix**: Esc closes the list and nothing else, and focus goes back to the ☰. |
| 2 | Altar menu | No Journal at the altar: the ☰ (phones) and corner buttons (desktop) show Codex and Settings only, and J works only in the hall. Pages land at the solve, so players who want to reread one have to leave the altar. | Gap (brief item 3) | **Fix**: Journal in the altar menu, and J at the altar. It opens over the altar and closes back to the same board. |
| 3 | SE altar ☰ room | The hall's ☰ already holds 3 rows on the SE (Journal plus its note, Codex, Settings) without crowding, so 3 rows fit at the altar too. | Check | Fits: 3 rows end at y≈155 of 320 (after-shot `se/09-altar-menu`). |
| 4 | Title → Settings → Esc | Desktop and iPad: focus goes back to the Settings button. Phones: focus goes to the canvas (touch has no visible focus). | OK | Keep. |
| 5 | HUD → Codex/Settings → Esc | Focus goes to the canvas, not the HUD button. This is deliberate (`NO_RESTORE_FOCUS_ATTR` on the HUD, an a11y decision tested in a11y.spec): keys drive the game again straight away. | By design | Keep. Covered by the new e2e. |
| 6 | Hall Esc | Esc in the hall opens Settings as the pause menu, and Esc again closes it. This is tested (robustness.spec) and stops Esc spam chaining back to the title. | By design | Keep. |
| 7 | Altar Esc | Esc drops a held gem, otherwise goes Back to the hall. Codex and Settings opened at the altar close to the altar, never out of it. | OK | Keep. |
| 8 | Close labels | Phones use the same ✕ top-right everywhere. Desktop has Settings "Done", Codex ×, Journal "Back to the hall Esc" and altar "Back Esc". Each is clear where it sits, and Settings' Done is tested (layout-fit). | Minor | Keep. The Journal's desktop button now names where it goes ("Back to the altar" when opened over one). |
| 9 | No in-game path to the title | `flow.toTitle()` is unused, and Settings has no "Quit to title". The title only offers Continue and Settings, so there is nothing to go back to it for. | OK | Keep: fewer choices. |
| 10 | End card Esc | Esc does nothing on the end card. On a replay Esc skips the ending (ending.spec), so a second Esc leaving the card would risk Esc spam skipping past it. Back to the hall is focused and is the gold button. | By design | Keep. |
| 11 | Pad B with the ☰ list open | Same as #1 for a pad. The ☰ exists only on phones, and a pad with a phone is rare. | Minor | Not changed: the scene reads `cancel` in the same tick, and blocking it would need an engine hook. Noted for the PM. |

### 2026-11-04: fixes

- **☰ list + Esc** (`ui/hud.ts` `menu()`): while the list is open, a document capture-phase keydown closes it on Esc, stops the key reaching the game, and refocuses the ☰.
- **Journal at the altar**:
  - `game/flow.ts` `openJournal()` works from `'puzzle'` as well as `'hall'`; the altar stays on the stack underneath. `journalFrom` records which; `closeJournal()` returns to the same puzzle (setting the state before the pop so the chrome is the altar's again before the altar rebuilds its rails).
  - `game/ctx.ts`: Journal shown in the HUD at the altar; J opens it there; `openJournal` refuses with the deny sound while an altar is mid-strike or on a verdict (`canPause()`), so a bolt always plays out.
  - The phones' "New page in journal" tag beside the ☰ stays hall-only (`journalShown(..., tag)`); at the altar it would sit over the board's column. The Journal row's own note still says it.
  - `scenes/altar/altar-scene.ts`: `pause()` drops a held gem back where it came from, stops the hum, unlinks gestures and tears down the view, labels and rails, so the desk has the camera and chrome to itself. `resume()` rebuilds them over the same in-memory board (`rebuildView`, shared with `relayout`) and reapplies the altar's post and mood.
  - `scenes/journal/journal-scene.ts`: the desktop button says "Back to the altar" when opened over one. The phone ✕ is unchanged.
- Tests:
  - `flow.test.ts`: journal over an altar returns to it.
  - `chrome-polish.spec`: the altar's menu now equals the hall's.
  - New `tests/e2e/menu-flow.spec.ts` (4 tests): Esc from title Settings, hall Codex/Settings/Journal and altar Codex/Settings returns to the opener with focus restored. Journal from the altar (button, J, Esc, Back) returns to the identical board, which is then saved as it was. On the SE, Esc closes the ☰ list without opening Settings or leaving the altar, and the altar ☰'s 3 rows fit and its Journal ✕ returns to the same board.

After-shots (`SHOTS=menu-flow`, SE / Android / iPad / desktop) reviewed: altar ☰ with three rows on the SE and Android, the journal over the altar (SE ✕, desktop "Back to the altar Esc"), and the altar after the journal identical to before.
