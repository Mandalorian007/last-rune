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
- 2026-11-04 (altar-truth agent): all eight items done on `ws/altar-truth`.
  1. **Hints come from the room.** `strike.ts` builds a `HintRoom` (gems in the room, gems on the charged path, Capacitor beats, the machine in question). `nextStep` only names a gem that is in the room: an over-charge points at the Capacitor release (with its sum), then an Amplify on the path, then a Gate, else "less charge"; Split is offered only if the room has one. An under-charge to a machine that got nothing says "lead a path of gems to this machine too". Without a room, it names no gem. Product test: every puzzle × outcome × cause × touch, plus real prefixes of each intended answer, names no absent gem (`strike.test.ts`).
  2. **Over-charge preview.** A Capacitor plan line whose release goes over the need now reads "Strike 2: 8 + 8 → 16, over the 8 needed" in warning red, its read-out gets a red border, and that machine's gauge goes red (red lamp too). The gauges still show no numbers before Strike (D-040 add. 5). `planOver` lives in `circuit-model.ts`; `capacitor.spec.ts` asserts it.
  3. **Charge badges: removed.** The badges appeared on some altars and not others. The one rule now is "no charge numbers on the route before Strike, on any altar"; numbers on paths appear only once charge runs. This matches D-040 add. 5, and the only pre-strike numbers left are the Capacitor plan (item 2). Product test: `tests/e2e/altar-truth.spec.ts` (every altar with most of the intended answer placed shows zero visible `.lr-altar-chip`).
  4. **Fixed gems.** Socket state 6 in `stone-wgsl.ts` now has a heavy bronze collar with brass rivets and a padlock pip at the lower-right. The player's own gems never get state 6. Gems placed by a hint also get it, because they are locked too.
  5. **Turn.** Phones: when a turnable gem is held, a gold ↻ mark sits on its turn target (`.lr-turn-target`), and the holding hint slot says "↻ Turn rotates the Bend in your hand / you just placed." the first time on any altar that first hands out that turnable gem (`turnTeaches`/`turnTeachLine`). The desktop R/Scroll badge and keys are unchanged; D-026 press counts are untouched. Product test: `moments.test.ts` checks that every altar that first hands a turnable gem teaches Turn.
  6. **Undo: enabled.** The cause wasn't the held gem. `BoardState.restore` wiped the undo history, so a resumed altar (12-furnace-held reopens a saved board) had nothing to undo. `restore` now pushes one undo step per restored gem. `board.test.ts` and `altar-truth.spec.ts` assert it.
  7. **Plain-verb copy.** Split: "Power the end with no arrow; half the charge comes out of each arrow…". Gate: "Power both side inputs on the same strike; the total comes out the arrow…". The worked examples are kept. The Gate hint now reads "power the Gate's other side input on the same strike". "Fixed." / "Fixed: part of the machine." are now `FIXED_NOTE` "Built in." / `FIXED_NOTE_FULL` "Built in: you can't move or turn it." (the short form keeps Capacitor Bay's arrival card off Strike on an SE), and with `YOURS_NOTE` they live in `content/codex.ts`, not in the scene.
  8. **Result cards.** Every verdict is a title plus a body in full sentences: `verdictParts` splits the exact line, the dead verdict on a phone is titled with its cause ("The charge hit an empty socket") with the fix below; desktop says "No charge reached the machine" (a third line overflows the phone line budget), cause heads end with full stops, and the strike story reads "Strike 1 gave it 0. Strike 2 gave it 16. It needs 8 in one strike."
  - Layout and column CSS and `ui/phone-styles.ts` are untouched. The altar-scene.ts hunks are small (imports, showResult, renderCaps warn, the preview-chip removal, the turn mark on phones).
  - Shots: `docs/design/screens/local/altar-truth/{before,after}/{se,iphone,promax,android,desktop}/` in this worktree (git-ignored).
