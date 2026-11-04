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

### 2026-11-04: port-altar-3 done (branch ws/port-altar-3)

**Canvas↔region hand-off: the tray gems stay on the canvas; the DOM follows them.** In phone landscape the altar sets its own tracks on `ctx.chrome` (`layout.setForms`, altar-chrome.ts). `phoneLayout` (layout.ts) fits the board to the free rect first. The right column gets what is left: the head (title, slot rings, counts) in `top`, the cards in `cardLane`, Strike in `bottom`. The tray gems are still drawn and hit-tested in design px from `AltarLayout.tray`. `placeHead` (altar-column.ts) then puts each DOM slot ring and count over its gem, in region px. I chose this over DOM gems because:
- the gems are shaded, lit, procedural art, which would have to be rebuilt in CSS;
- hit-testing and drag already run in canvas space;
- one source of geometry (`AltarLayout`) feeds both.

**What changed**
- **One card component** (altar-column-styles.ts). The lane holds tip, teach, verdict and cap.
  - Text runs the full card width, 14 px in the game serif.
  - "New here · n of m" and Next/Got it sit on a sticky footer row below the text.
  - Height is capped, with scrolling.
  - FUSE's caption docks into `cardLane` under the cards (`dockCaption`). He holds his line while a card is up (`holdFuse`).
  - Strike lives in its own `bottom` region, so a card can never sit under it.
- **"all placed"** is one dimmed text badge in every room, with no grey square. Counts are right-anchored on their own gem, so "×13" no longer runs onto the next gem.
- **Labels.** The Needs/Gives pills wrap to two lines inside the pill. Below-labels shift off sockets and away from the left rail (altar-place `placePhoneLabels`), and drop under a socket if one is still hit.
- **Leader lines** are polylines routed round gauges, labels and sockets.
- **Menu.** At the altar the open ☰ gets a full-screen scrim on the chrome overlay. The dropdown starts below the title strip, so the title stays visible. The scaled `.lr-hud-scrim` is transparent at the altar, because shots.spec still expects it present.
- **`ui/phone-styles.ts` is deleted, and so is `ui/teach-styles.ts`.** Every rule that targeted the column in the scaled overlay was dead and is gone: title, counts, slots, lane, tip, verdict, hint, cap, and the `--lr-cap/-col/-bub` caption rules. The live rules moved:
  - `ui/phone-base.ts`: the helpers (`cpx`, `tpx`, `P`, `T`, `CT`, `CB`), plus base touch/phone rules, the HUD, the caption base and the HUD scrim.
  - `scenes/altar/altar-phone-styles.ts`: labels, socket tag, turnmark, solve card and teach leader. It goes first in the altar sheet.
  - `scenes/{title,hall,journal}/*-phone-styles.ts`: these are appended to the phone sheet through `ensureGameStyles(doc, scenePhone)` from game/ctx.ts, in the old cascade order.
  - The hangout badge rule moved to `ending-phone-styles.ts`.
- `altar-scene.ts` is 649 lines with zero `L.phone`. Two `view.layout.phone` reads remain, and both are behaviour, not geometry: phones keep the intro card until Got it, and phones turn post-fx off.
- **Merge risk:** chrome-polish-3 (hall/title/journal/ending phone rules) and altar-truth (altar CSS) will conflict on the deleted `ui/phone-styles.ts`. Their hall/title/journal/ending edits belong in the new `scenes/*/…-phone-styles.ts` files.

**Pitch (CSS px per socket), before → after.** Order: intake-desk, furnace, splitter-mill, relay-tower, conveyor-a, press-unit-4, storm-cell-2, crane, boiler-room, archive, foundry, capacitor-bay, lift-shaft, roof-array, control-booth, the-last-rune.
- SE 667×320: unchanged, 53.8/44.1/44.1/44.1/44.1/53.5/44.1/44.1/44.1/33.3/44.1/35.1/35.1/40.6/33.3/26.4
- iPhone 844×340: unchanged, 66.4/61.3/61.3/61.3/61.3/57.8/57.8/61.3/57.8/45.7/61.3/37.9/37.9/44.9/43.4/28.9
- Pro Max 932×380: unchanged, 75.9/71.2/71.2/71.2/71.2/67.4/67.4/71.2/67.4/52.1/71.2/44.1/44.1/50.9/51.3/33.5
- Android 915×360: furnace, relay-tower, conveyor-a, crane and foundry grow from 76.2 to 79.5. The other 11 are unchanged: 71.1/–/71.1/–/–/62.8/62.8/–/62.8/49.0/–/41.0/41.0/47.7/49.0/31.4.
- No altar got smaller.

**Product e2e:** `tests/e2e/altar-column.spec.ts`. It covers 16 altars × 4 phones (SE, iPhone with 47 px insets, Pro Max with 59 px insets, Android) at teach, open, FUSE speaking, holding and verdict. It asserts that cards, FUSE, title/holding, tray gems and counts, labels, open sockets, Strike and the rail buttons have no box overlap, and that card text is at least 14 px and not system sans. Set `COLUMN_SHOTS=<dir>` to save what it saw.

**Follow-ups after the first full e2e run**
- The how-to hint keeps its own slot in the lane (D-040 addendum 3). It stays up with a gem's card and while FUSE speaks; only a teach card or the verdict replaces it.
- An empty tray count shows "×0", dimmed, with `aria-label="all placed"`. This is the brief's "dimmed silhouette with a short badge" option. It looks the same in every room.
- The card's Next button is now 36 px tall (it was 32), so it meets the phone hit-area floor.
- The holding pill no longer sets `overflow: hidden`, so its text is not clipped.
- Test updates:
  - `mobile-budget`: lane cards are CSS px (scale 1) and are checked only against the board. The 8 px "label clear of the board" rule is replaced by "a Gives/Needs card never covers an open socket". Blocked cells are skipped, since they are solid slab on phones.
  - `mobile-teach`: the fixed-gem marker can be a ring alone, re-anchored when no clear leader path exists. "All placed" is asserted as "×0" plus the aria-label.

**Merge of main (chrome-polish-3, altar-truth) into ws/port-altar-3 (03dbfc4)**
- `ui/phone-styles.ts` stays deleted. Chrome-polish-3's journal rules are appended to `scenes/journal/journal-phone-styles.ts`. Its door-plate sheet joins the phone sheet through `SCENE_PHONE_CSS` in `game/ctx.ts`.
- Altar-truth's changes are carried into the split modules:
  - previewChips, teachChips and FIXED/YOURS lines removed;
  - Turn taught via `turnTeachLine`;
  - the `planOver` warn;
  - `verdictParts` and `hintRoom`.
- `altar-scene.ts` is now 642 lines, still with zero `L.phone`.
- **More-below cue (from the gate6 review):** on the SE, a long Split card and a Capacitor read-out under a verdict were cut off with no sign of more text.
  - `arrangeColumn` sets `data-more` on any lane card that has more text below. The tip then shows a small ▾ above its footer; the verdict and cap fade out at the bottom. Both can be scrolled.
  - The verdict no longer shrinks (up to the whole region); a Capacitor read-out under it gives way first.
  - Note for content: SE's lane holds about 3 lines of card text; Split's how-to and Capacitor verdicts run longer.
- **Baselines (not regenerated, as the PM asked):** 84 altar shots differ: every altar scene, "empty" and "solved", at desktop-720, desktop-1080 and ipad. Main at 42a4e6f fails the same 84, and pre-merge ab3c7f3 passed all 96 altar baselines, so the diffs come from altar-truth's changes. The 44 non-altar baselines pass.

**PM review of gate6: two fixes**
- **The verdict shows its Try line in full.** While a verdict is up on a phone, the Capacitor read-out is hidden, since the verdict already gives what each strike delivered. The verdict uses a little less padding and spacing.
  - Copy is shortened, keeping altar-truth's plain wording.
  - The phone strikes line is now "Got 0, then 16; needs 8 in one strike." It used to be "Strike 1 gave it 0. Strike 2 gave it 16. It needs 8 in one strike."
  - The over-charge Try ends "A Split halves it."
  - Result: the headline, the cause and a two-line Try fit an SE's 103 px lane.
- **Teach cards fit the SE lane with no scrolling.** The card text gets three lines, using line-height 1.25 and a slimmer footer. Shorter copy:
  - Split: "Power the no-arrow end: half out each arrow, odd charge lost."
  - Gate: "Power both sides on one strike; the total leaves by the arrow."
  - The turn suffix is now "Turn to fit."
  - Also fixed: the Next button's 44 px hit area hung 5 px below the card, so every card scrolled by 3 px. It now grows upward from the button.
- **No ghosting.** Text cut off under a footer is hidden outright by an opaque strip; the ▾ alone says there is more. There is no fade.
- **New `altar-column.spec` checks:**
  - every gem, teach and how-to card and every verdict fits its lane, with no scroll and nothing outside the lane;
  - the Try line sits fully inside the verdict;
  - on every phone, Capacitor Bay's two-strike verdict shows its Try line and hides the read-out.
