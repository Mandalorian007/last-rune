# Workstream: port-altar-2 (Phase 2, altar layout + camera)

Follows port-altar (part 1, merged). Read its log in [port-altar.md](port-altar.md) first: magnify in the engine, altar touch input on Gestures, portrait decision (rotate card stays, D-040 pitch numbers) and the proposal this brief adopts.
Decisions: D-026, D-027, D-039, D-040 (+addenda), D-041 (+addenda 1–3).

## Scope
- **Phone altar as a `LayoutSpec` behind a flag** (`?layout=1` or a dev setting, off by default until the gates pass, then on and the flag removed):
  - board in `fill` with a camera fit to `freeRect`;
  - tray, gem card and hint lane in `cardLane`;
  - Back / Undo / Clear / Turn / ☰ / Strike as rail widgets on `ctx.chrome`.
- Keep teach, moments, hints, strike, cursor and board and their tests; adapt seams only.
- Once the layout path is on: delete `ui/phone-styles.ts`, `phoneFrameFor` and the `L.phone` branches in `altar-scene.ts`. Targets: under 2,000 lines, zero `L.phone`. If the last few branches are genuinely product (not layout), say which and why.
- **Fix two issues from the PM's port-altar review** (`docs/design/screens/local/port-altar/` in the main repo):
  1. **iPhone, The Last Rune altar:** the altar title is clipped at the top edge and the "Holding Bend" pill sits on it. The header must be fully on screen and readable, with the pill clear of it, on every phone.
  2. **Upright title:** the picture and menu now sit high with a large empty bottom half. Centre the picture + menu group vertically (or grow the picture) so it reads as one balanced screen.

## Acceptance (Gate 2 inputs)
- `mobile-budget.spec`, `altar-labels.spec`, `altar-keys` and the full run (16/16) green; D-026 press counts unchanged.
- Socket pitch at or above the D-040 floors on all four phones in landscape, and no smaller than part 1 on any altar (list per-altar before/after).
- Desktop and iPad match v1.0 (`pnpm baseline`); list any intended diff.
- Screenshots of every altar on every phone, as it opens and holding a gem, into `docs/design/screens/local/port-altar-2/` (use `SHOTS=<dir> pnpm exec playwright test tests/e2e/shots.spec.ts`).

## Rules
- Product tests stay in the game; platform tests in the engine.
- pnpm only; `pnpm check:boundaries`. Commit to `ws/port-altar-2`; never merge.
- Gates before reporting: `pnpm check`, `pnpm build`, `pnpm baseline`, `pnpm test:e2e`, `pnpm test:e2e:engine`, `pnpm test:e2e:desktop`.

## Log

- **Review fixes (1b64a30).** iPhone Last Rune header with the Holding pill: the held header
  stacks the 12 px name over the pill, 3 px in from the top, 2 px apart; the tray's first row
  starts under both (`layout.ts` titleH 22 → 30). Probe on all four phones: header 3–35 px,
  held slot from ~43 px. Upright title: portrait rows `fill` / picture / menu / FUSE / links,
  so the picture and the buttons stand mid-screen (390×844: ~219 px over, ~118 under).
- **Engine `layout.setForms` (16b6617).** A scene's own tracks per form factor over the spec,
  cleared with `null`; unit test in `layout.test.ts`, one line in ARCHITECTURE.md.
- **Rails on the chrome (a3c8ee8).** `scenes/altar/altar-chrome.ts`: in phone landscape the altar
  sets `[50, fill, 58]` × `[fill]` (`left fill right`, pad 3) on `ctx.chrome`. Back, Undo, Clear
  and Turn are widgets in `left` (Back top, Undo/Clear at 34 %, Turn at the foot); Strike sits at
  the foot of `right` under the HUD's ☰, 12 px in from the edge. Rail CSS is CSS px
  (`ALTAR_CHROME_CSS`). The board's `PhoneFrame` is read off the engine-resolved regions of that
  form (`altarFrame`, also used by the solve moment), so `phoneFrameFor` and its constants are
  gone. Pitch: mobile-budget identical to part 1 on all 64 altar×phone rows (worst: SE 26.4,
  iPhone 28.9, Pro Max 33.5, Android 31.4 CSS px, all The Last Rune). Legacy phone rail rules
  removed from phone-styles.ts and strike-styles.ts. No flag left: the port measured equal
  (budget, screenshots) before it was committed, so it went in on.
- **Not done, and why.** The tray, gem card and hint lane stay on the scaled overlay beside the
  board: the tray's gems are drawn and hit-tested on the canvas in design px and the lane hangs
  under them; moving them to `cardLane` means a canvas-to-region hand-off for the tray, which
  is its own piece of work. So `phone-styles.ts` (hall, journal, title and the altar's
  world-anchored labels, all still live on the scaled overlay) and the `L.phone` branches in
  altar-scene.ts (the board-first column: tray, lane, FUSE's bubble, labels) stay; they are
  the phone product layout, not dead code. altar-scene.ts is 4,251 lines (was 4,231); the
  2,000-line target needs the column extracted as a module, proposed as port-altar-3.
- **SE: arrival card against Strike.** The full e2e run caught it (mobile-moments, SE,
  capacitor-bay page 1). The review fix's lower tray (titleH 30) pushed the lane down, so the
  teach card under a two-row tray ended 0.7 px above Strike (needs 8). Fix: titleH 30 → 26
  (the header ends at 35 px, the held gem now starts ~39, 4 px clear), and on phones at most
  330 px tall Turn and Strike sit 4 px off the bottom with Strike 56 px tall (D-040's floor;
  a first try at 50 px broke mobile-strike). Screenshot
  `docs/design/screens/local/port-altar-2/se-capacitor-bay-arrival.png`. Pitch table identical
  on all 64 rows.
- **e2e-flakes follow-up (PM).** Merged main (ws/e2e-flakes). No altar spec still presses F
  then Enter (the four F sites wait on state or use `strikeToVerdict`). New `settled(page,
  selector)` in helpers.ts: waits until the matched boxes are unchanged for 2 frames.
  altar-labels: the 1 s wall-clock wait is gone; it waits for FUSE's arrival caption where the
  altar has an arrival line (`machineLine(id, 'arrive')`; the final altar has none), then
  `settled` on the audited boxes; the 200 ms after closing waits for the altar to go. Runs in
  ~7 s, was ~20. mobile-budget:430: no wall-clock waits, no F/Enter, no finger held before a
  drag (taps only); its frame-count waits before each `measure` are now `settled`.
- **Gates.** Final, on the branch with main merged: `pnpm check` and `pnpm build` pass;
  `pnpm baseline` 129 passed, twice (render noise of a few px at most, varying between runs and
  including the untouched title; an earlier run on a3c8ee8 was 0 px everywhere);
  `pnpm test:e2e` 116 passed, 0 failed (full-run 16/16 with its keyboard press counts);
  `pnpm test:e2e:engine` 274 passed; `pnpm test:e2e:desktop` 7 passed. Before the SE fix, a full
  run had caught the SE moments pair (fixed above); the full-run 13-16 and two engine gesture
  failures in that run were load flakes that pass alone.
