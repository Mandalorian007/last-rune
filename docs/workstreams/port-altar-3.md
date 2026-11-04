# Workstream: port-altar-3 (Phase 2, altar right column on regions; now gates Gate 2)

Read first: [port-altar-2.md](port-altar-2.md) (its log explains why the column was left over) and D-040 addendum 6 / D-041 addendum 4 in docs/DECISIONS.md.
Decisions: D-026, D-027, D-039, D-040 (+addenda), D-041 (+addenda).
Evidence: the Gate 2 blind-review screenshots are in the MAIN repo at `docs/design/screens/local/gate5/{se,iphone,promax,android,portrait}/`. Look at them before you start.

## Why
Blind review 5 scored 6.6/10. Every layout major is in the tray / gem card / hint lane, which is still a scaled overlay styled by `ui/phone-styles.ts`. Move it onto layout regions and fix the collisions structurally, not with more CSS exceptions.

## Scope
1. **The column on regions.** Tray, gem card, teach card, verdict card and the FUSE lane go in a right-column region on `ctx.chrome` / layout. That needs a canvas↔region hand-off for tray gems: draw and hit-test them in region space, or make them DOM. Pick one and log why.
   - Delete `ui/phone-styles.ts` (anything left that is genuinely hall/title/journal moves to its own scene's styles).
   - `altar-scene.ts` under 2,000 lines, zero `L.phone`.
2. **Cards that cannot collide.** One card component for gem, teach and verdict:
   - text at full card width;
   - "New here · n of m" plus Next/Got it on a footer row below the text, never beside it;
   - a capped height, scrolling or paging if needed;
   - never under or behind Strike, never over FUSE (FUSE yields when a card is up).
   - Fixes `se/10-foundry`, `*/10-storm-cell-2` and `*/10-furnace`.
3. **"all placed".** It has a reserved place inside the slot (a dimmed silhouette with a short badge, or a one-line label in reserved space). It can never be cut by the card or drawn over the next gem.
   - Fixes `12-*-held` and `13-capacitor-bay-*`.
   - Use the same used-up look in every room (no grey square in Capacitor Bay).
4. **Board labels.**
   - "Needs N / in one strike" and "Gives N / per strike" pills fit their text (two lines inside the pill), and the number never spills.
   - Labels and orbs never touch the left rail.
5. **Leader lines and teach anchors** never cross a gauge, a "Needs" label or another socket; reroute or re-anchor them (`10-capacitor-bay`, `10-relay-tower`, `10-conveyor-a`).
6. **The board fills its region.** Fit to the full free rect, both axes. Measure and log per-altar pitch before and after on all four phones. No altar may get smaller.
7. **In-altar menu (`06-menu-altar`).** The dropdown must not cover the altar title; give it a proper scrim.
8. **Text size.** Card body text is at least 14 CSS px on phones, in the game's serif. No system sans in cards or rails; one typeface family.

## Out of scope (another agent owns these, so don't edit them)
- ws/altar-truth: hint wording, strike preview, charge badges, Turn teaching, fixed-gem visuals, Undo.
- ws/chrome-polish-3: hall, title, settings, codex, journal, ending.
- If you must touch `scenes/altar/strike.ts` or the gem render code, keep the change minimal and say so in the log.

## Acceptance
- No visual overlap of card, tray, labels, Strike and FUSE on any of the 16 altars × 4 phones, as each opens, while holding, on teach and on verdict. Add a product e2e that asserts no overlap of their boxes (game test, not engine).
- Desktop and iPad unchanged (`pnpm baseline`); list any intended diff.
- Shots: `SHOTS=gate6 pnpm exec playwright test tests/e2e/shots.spec.ts` (writes into your worktree's `docs/design/screens/local/gate6/`). Look at every file as a first-time player would before you report.

## Rules
- pnpm only, `pnpm check:boundaries`. Engine changes are platform-only, with engine tests. Commit to `ws/port-altar-3`; never merge.
- Gates before reporting: `pnpm check`, `pnpm build`, `pnpm baseline`, `pnpm test:e2e`, `pnpm test:e2e:engine`, `pnpm test:e2e:desktop`.
- Log progress and decisions below.

## Log
