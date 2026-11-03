# Workstream: mobile-5-board (phone altar: a big, legible board whose looks match the rules)

## Background
Gate review 2 (4 blind reviewers, 2026-11-03) scored 6 / 6 / 6.5 / 6.5, a fail. The PM checked each point below against the screens in `docs/design/screens/local/mobile-2/gate2/` and `.../pm-review-altars/`. The calls are recorded in D-040 addendum 3.

1. **Fixed gems still look like player gems (3 of 4 reviewers).** mobile-4-board's iron collar (overlay state 6) can't be seen at phone size. Compare the pink and green gems in `gate2/android/10-relay-tower.png` with a placed gem.
2. **The stone slab doesn't enclose the sockets.**
   - In `pm-review-altars/se/13-lift-shaft.png` and `12-capacitor-bay.png`, a socket by the source hangs below or outside the slab.
   - The slab also covers large blank areas, so players read blank slab as playable.
   - It is worse on 15-control-booth and 16-the-last-rune.
3. **The board is small on phones while the right column is mostly empty.**
   - Android 6×4: the board is about 320×215 of a 915×360 screen (`gate2/android/10-relay-tower.png`).
   - The Last Rune on SE has 27.6 px sockets, the main tap-accuracy worry.
4. **Text is too small: about 10–12 px** for the Gives/Needs plates, counts, "in one strike", the hint and "got N" (4 of 4).
5. **Two rotate controls.** The ↻ chip sits over the placed gem and the board edge, while Turn is in the left rail (3 of 4).
6. **Purple "valid socket" rings stay after the gem is placed**, so it's unclear whether you are still holding one.
7. **Multi-strike is unparseable (4 of 4).** From "Gives 8 ×2 strikes", "Needs 8 in one strike" and "Strike ×2", a newcomer can't tell whether one tap fires twice or whether 8 is per strike.
8. **On Android, Strike is flush with the right screen edge.**

## Scope (phones only; desktop and iPad must stay pixel-identical except where noted)
1. **Fixed means fixed at arm's length, on all platforms.** Make the collar unmistakable at 30 px sockets:
   - a thicker dark-iron ring with a lighter bevel;
   - rivets large enough to see (radius ≥0.14 pitch-relative, or whatever reads);
   - or add a small lock pip on the rim if a ring alone doesn't read.
   - It must not look like selection or hover.
   - Check at 1920 too: the desktop change is allowed for this item only.
2. **The slab hugs the sockets.**
   - The stone panel is the union or hull of the socket cells plus a margin. No socket, source or gauge stub hangs off it.
   - Large blank areas inside it should read as plain wall, not as playable slab.
   - Choose between a tight rectangle around the used cells and per-region panels. The rule: a newcomer sees "the slab is where the holes are".
   - Applies on phones. Fine on desktop too if it's a clear win, but call it out.
3. **The board fills the height.**
   - On every phone and every altar, the board plus its gauges and labels should use at least 85% of the play-area height.
   - On wide phones (promax, android), take width from the right column. The tray and Strike column can be narrower when the tray has few types.
   - Re-measure pitch and raise the e2e floors to whatever you reach. Targets:
     - The Last Rune on SE ≥30 px;
     - 6×4 on android and promax ≥60 px.
   - If a floor can't be reached, say why in the log.
4. **Text floors on phones:**
   - Gives/Needs numbers ≥15 px;
   - every other board label, gem count and the hint ≥13 px;
   - captions on dark plates at ≥4.5:1 contrast.
5. **One rotate control on phones.**
   - Remove the ↻ chip on the placed gem. The rail's Turn button stays.
   - When a turning gem is selected, Turn shows its icon or highlights, so the link is obvious.
   - Keep keyboard and desktop behaviour.
6. **Valid-socket rings show only while a gem is held.** Once a gem is placed or released, they clear.
7. **Multi-strike copy.**
   - Make the source plate, the gauges and Strike answer two questions: "one tap fires K bolts" and "N is per bolt".
   - Example (your call, check it against `docs/design/rules.md` and the capacitor rule): Strike reads "Strike" with a sub-line "fires 2×"; the source reads "Gives 8 per bolt"; the gauges read "Needs 8 from one bolt".
   - Keep it to two lines. Update any teaching or verdict copy that uses the old phrases so the wording is consistent.
   - Propose rule-text changes, but don't edit `rules/` semantics.
8. **Strike sits ≥12 px from the screen edge on every phone** (curved-edge Android).

**Out of scope:**
- the hint and FUSE placement, the verdict stacking and the solve screen (that's mobile-5-moments, which owns `solve-scene.ts` and the FUSE and verdict overlays);
- the hall, menus, ending and hangout (mobile-5-chrome).

**File ownership:**
- You own `layout.ts`, `socket-looks.ts`, the stone/slab shaders and art, and the board and label parts of `altar-scene.ts` and `altar-styles.ts`.
- Keep `altar-scene.ts` edits small and local. Merge `main` before you report.
- Keep `ui/phone-styles.ts` edits in a `/* mobile-5-board */` block.

## Tests and capture
- `tests/e2e/mobile-budget.spec.ts`, on four phones:
  - board-height share ≥85%;
  - every socket inside the slab;
  - text floors (computed font-size of the board labels, counts and hint);
  - the new pitch floors;
  - no ↻ chip on phones;
  - Strike ≥12 px from the edge;
  - no valid-socket rings after placement.
- Unit test (`socket-looks` or `layout`): every puzzle's sockets lie inside its slab rect(s).
- Capture:
  - `M2_TAG=m5board pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2 pm-review`;
  - before and after sheets in `docs/design/screens/local/mobile-5-board/`, including desktop and iPad.
  - Critique your own sheets as a first-time player before reporting.

## Done when
- Everything above is fixed.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- The log in this file has the pitch table and a list of changes.

## Log

### 2026-11-03: mobile-5-board done (branch `ws/mobile-5-board`)

**Changes**
1. **Fixed-gem collar, every platform** (`shaders/stone-wgsl.ts` SOCKET_WGSL, `art/materials/stone.ts`):
   - a thicker dark-iron band out to 1.38 R, with a pale bevel just inside its rim;
   - four rivets of radius 0.15 with a glint; the quad reaches 1.42 R so nothing clips.
   - It reads as bolted iron, not a hover or selection ring (checked at 1920 and on iPad, before/after in `desk/`).
2. **The hugged slab, phones** (`AltarOptions.hug`, `altar_surf` hug branch):
   - the top face is a union of rounded blocks, one per open cell, so blocked cells and blank areas are wall.
   - Interior depth comes from the holes, so no seams show; there is a contact shadow, and albedo is ×1.3 against the wall.
   - Pure mirror: `huggedSlabDistance` (`socket-looks.ts`).
   - Unit test: every socket, wire end and fixed gem of every puzzle sits on the stone on all four phones; every blocked centre is off it.
3. **The board fills the height** (`game/ctx.ts` FILL_BANDS puzzle/solve; `ui/device-mode.ts` `--lr-crop-t/-b`; `layout.ts` band-relative layout):
   - on the altar and the solve moment the canvas fills the phone's width, and the board lays out in the visible band;
   - maxPitch is 76;
   - trays of up to four kinds go two to a row, so the column can shrink to 116 CSS px;
   - a phone narrower than 720 CSS px (the SE) keeps the column at ≥140 px so the chip and verdict stay readable.
4. **Text on phones** (`phone-styles.ts` mobile-5-board block):
   - Gives/Needs numbers are 15 px; notes, got, strike read-outs, gem counts, lane captions and the hint are 13 px.
   - The hint may wrap to two balanced lines.
   - Captions are near-opaque and lighter ink (≥4.5:1).
   - A one-strike N/S card after a strike reads "Needs 4 got 0" on one line.
   - Multi-strike N/S cards read "Needs 10 / Strike [1: 0] [2: 0]", so two cards side by side stay clear.
5. **One rotate control:**
   - no ↻ chip on phones;
   - the rail's Turn is dim until a Bend, Gate or Split is in hand or was just placed, then lit gold.
6. **Rings only while held:** on phones, placing a gem ends the hold, so the valid-socket rings clear and Turn turns the gem just placed.
7. **Multi-strike copy, phones:**
   - the storm card reads "Gives 16 / per strike";
   - Strike reads "Strike / twice", then "1 of 2", "2 of 2" during the run;
   - aria: "one tap strikes twice".
8. **Strike** sits 12 CSS px in from the app's right edge (`PHONE_STRIKE_CSS` 58).

**Tests**
- `tests/e2e/mobile-budget.spec.ts`, items 10–15 on four phones:
  - height share (`HSHARE_MIN`);
  - sockets in the slab;
  - rendered text floors;
  - raised pitch floors;
  - no ↻ chip;
  - Strike ≥12 px from the edge;
  - rings while held, none after placing;
  - Turn lit.
- Unit: `socket-looks.test.ts` "hugged slab".

**Pitch (CSS px) and board share of height, after**

| Altar | SE 667×320 | iPhone 844×340 | Pro Max 932×380 | Android 915×360 |
|---|---|---|---|---|
| intake (6×4) | 53.8 · 86% | 66.4 · 97% | 75.9 · 98% | 71.1 · 97% |
| furnace, relay, conveyor, crane, foundry (6×4, W/E) | 44.1 · 60–67% | 61.3 · 79–80% | 71.2 · 82% | 76.2 · 93% |
| splitter (6×4) | 44.1 · 74% | 61.3 · 94% | 71.2 · 91% | 71.1 · 100% |
| press (6×4) | 53.5 · 97% | 57.8 · 97% | 67.4 · 98% | 62.8 · 98% |
| storm-cell, boiler (6×4) | 44.1 · 84% | 57.8 · 97% | 67.4 · 98% | 62.8 · 98% |
| archive, control (8×6) | 33.3 · 76% | 43.4–45.7 | 51.3–52.1 | 49.0 · 98% |
| capacitor, lift (8×6) | 35.1 · 96% | 37.9 · 96% | 44.1 · 99% | 41.0 · 98% |
| roof (8×6) | 40.6 · 93% | 44.9 · 96% | 50.9 · 96% | 47.7 · 96% |
| The Last Rune (10×8) | 26.4 · 94% | 28.9 · 95% | 33.5 · 95% | 31.4 · 96% |

- Main's floors were 44/38/30 on iPhone, Pro Max and Android, and 39.6/34.2/27 on the SE.
- New floors (`PITCH_MIN`):
  - iPhone 57/37/28.5
  - SE 43/32.5/25
  - Pro Max 66/43/32.5
  - Android 62/40/30.5

**Floors not reached**
- **85% of height on W/E 6×4 boards** (iPhone 79–80%, Pro Max 82%, SE 60–67%). These boards are width-bound: two 66 px gauge gutters plus the column. The SE also keeps a 140 px column so a gem chip stays ≤5 lines and the verdict ≤6. Floors: iPhone 0.78, SE 0.58, Pro Max 0.8, Android 0.85.
- **The Last Rune ≥30 px on the SE:** 26.4. It is height-bound by its N and S gauges, and the 13/15 px label floors cost height. iPhone 28.9 is also below main's 30 floor, for the same reason.
- **8×6 Capacitor/Lift on iPhone:** 37.9 vs main's 38, for the same reason (two-line multi-strike cards at 13 px).
- **Lane line counts:** in a lane narrower than 150 px a gem chip may take 5 lines and the verdict 6. Both have the lane's height to themselves (budget item 3 relaxed there). Shorter verdict copy (mobile-5-moments) would win this back.
- **6×4 ≥60 px on Android and Pro Max:** met. The lowest is 62.8.

**Proposals to the PM**
- **D-040 change:** on phones a placed gem leaves the hand (rings clear, Turn turns the placed gem). Desktop still keeps the gem in hand.
- **Desktop copy:** align with the phone copy: the storm card "per strike", Strike's aria "one tap strikes twice".
- **Rule text:** suggested codex/rules wording: "Strike fires the storm N times. Each machine reads each strike on its own; Needs is per strike." No `rules/` semantics were changed.
- **Fill-width on the solve moment** (FILL_BANDS solve) crops its top and bottom. Its CSS moves in by `--lr-crop-t/-b` (one rule in the block); mobile-5-moments should check its card.
- **Hint:** now 13 px and may wrap to two lines (the hint slot is mobile-5-moments').

**Captures** (`docs/design/screens/local/mobile-5-board/`, git-ignored):
- `before-*.png` / `after-*.png` sheets;
- `after/altars/{iphone,se}`;
- desktop and iPad collars in `before/desk`, `after/desk`.
