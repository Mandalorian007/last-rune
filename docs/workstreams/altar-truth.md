# Workstream: altar-truth (Phase 2, text and visuals match the rules; gates Gate 2)

Decisions: D-027 (intuitiveness: visuals and text must match the rules exactly), D-040 addenda 5–6.
Evidence: blind-review screenshots in the MAIN repo at `docs/design/screens/local/gate5/`.

## Scope
1. **Failure hints come from the room.** `scenes/altar/strike.ts:283` always says "Skip an Amplify, or halve it with a Split", even in Capacitor Bay, which has no Amplify. Build hints only from gems present on the board or in the tray, and name the real cause when the rules know it (e.g. the Capacitor letting out 8 + 8). Audit every hint string the same way. Add a product test: for every puzzle × outcome, the hint names no gem absent from that puzzle.
2. **Over-charge preview.** In `13-capacitor-bay-before` the preview says "Strike 2: 8 + 8 → 16" while the "Needs 8" gauge shows a calm lit lamp. Keep D-040 addendum 5's rule (no numbers on gauges before Strike) unless the preview already shows numbers; where it does, a value over the goal must read as a warning.
3. **Charge badges.** Numbers show on some lit paths (`12-intake-desk-held`) and not on others (`12-storm-cell-2-held`). Find the rule. Make it one rule a player can see, or remove the badges from pre-strike play. Log which and why.
4. **Fixed gems read as fixed.** The riveted bezel from addendum 5 is too faint on Channels and Bends (`10-control-booth`, `10-lift-shaft`, `10-the-last-rune`). Make fixed gems unmistakable at arm's length on a phone (a heavy bronze collar plus a lock pip, or similar), and keep the player's own gems free of it.
5. **Turn.**
   - The first time a turnable gem is held, a short teach line names Turn and what it rotates.
   - Make Turn's target visible: highlight what it will rotate, or show a rotate glyph on the held or last-placed gem.
   - Desktop key/pad behaviour is unchanged (D-026 press counts).
6. **Undo while holding.** It is greyed while a gem is held even after placements (`12-furnace-held`). Either enable it, or make it plain why it is off. Log the choice.
7. **Plain-verb copy.** Rewrite Gate, Split and "Fixed." in plain words a first-time player gets, e.g. "Gate: power both side inputs on the same strike; the total comes out the arrow." Keep the worked examples. Copy lives with the content, not in layout code.
8. **Result cards.** All verdicts have the same shape: a title line plus a body ("Breaker tripped" has a title, the relay fail doesn't). Use full sentences.

## Out of scope (another agent owns these)
- ws/port-altar-3 is moving the right column (tray, gem card, teach card, verdict card, FUSE lane) onto layout regions and deleting `ui/phone-styles.ts`. Don't edit layout, column CSS or phone-styles. Change copy, rules-facing text, board/gem rendering and strike logic only. If you must touch `altar-scene.ts`, keep the hunks small and isolated.
- ws/chrome-polish-3 owns the non-altar scenes.

## Acceptance
- Product tests for 1, 3 and 5. Full run 16/16 green; D-026 press counts unchanged.
- Shots before and after for the affected altars on all four phones and desktop in your worktree's `docs/design/screens/local/altar-truth/`. Look at them as a first-time player.

## Rules
- pnpm only. `games/last-rune/rules/` stays pure TS. Propose any change to `rules/types.ts` to the PM; don't make it yourself. Commit to `ws/altar-truth`; never merge.
- Gates: `pnpm check`, `pnpm build`, `pnpm baseline`, `pnpm test:e2e`, `pnpm test:e2e:engine`.

## Log
