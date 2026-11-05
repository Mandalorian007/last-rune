# Workstream: polish-11 (D-040 add. 12, regression A + small items from C)

Read D-040 add. 12, D-043, D-045 and the logs in `teach-8.md` and `dense-board-4.md` first. Shots: `docs/design/screens/local/gate11/<phone>/` in the main checkout.

## Do
1. **Card overflow (regression, SE).** teach-8's "Again" pictured cards overflow on the SE: `10-roof-array` (the Capacitor strip line runs off the right edge, "sends nothin") and `10-press-unit-4` (the Amplify card's last line is clipped at the bottom). Make every arrival card fit on all four phones: wrap, drop the strip on narrow cards, or shrink to the 14 px floor, never below. Then make the spec catch it: altar-column (or a new check) must fail when any card text's scroll size exceeds its client box or its rect leaves the card, on every altar's arrival cards on all four phones.
2. **"Again" label.** All four reviewers read it as a replay button. Drop it, or use wording that can't read as an action (e.g. no label, the same "New here" slot left empty). Keep it off the button row.
3. **"○○ ○○ = your two strikes"** reads as four strikes (3 of 4). Show the marks once, e.g. "Strike ×2 ○○: your two strikes, one tap sends both."
4. **Amplify line on the card.** "A second Amplify doesn't double again" leaves "second where?" and "does it pass the charge?" open (3 of 4). Use the rule's words on the card too: "Doubles the charge once. Charge already doubled passes through unchanged." If it fits, the picture shows 4 → 8 → 8 across two Amplifies.
5. **Capacitor card numbers.** The teach card's fixed "stores 8 … 8 + 8 = 16" reads as if a Capacitor always sends 16 (Roof Array, The Last Rune). Say it generally ("Strike 1: stores what comes in, sends nothing. Strike 2: sends what it stored plus what comes in.") or tie the example clearly to Capacitor Bay. No forecast about this board before Strike (D-043).
6. **Decoy gold ring.** Control Booth opens with the Capacitor selected (gold ring) in the tray, so the decoy looks recommended. Opening a card must not select or highlight a tray gem; nothing is held until the player taps.
7. **Capacitor orientation.** Pro Max saw the tray Capacitor with vertical leads and the board one horizontal. Make the tray, board, codex and card agree, or make clear it doesn't need turning (it's two-way).

Don't touch the gauge note wording ("on one strike"), the camera, or the dense-board layout. Copy in content/ is yours for the items above only.

## Done when
- `pnpm check`, `pnpm check:boundaries` and `pnpm build` are green. Run altar-column, mobile-teach, dense-board, capacitor, strike-free-2, held-gem and glyph-truth-2, then a full `pnpm test:e2e` (unique `E2E_PORT_OFFSET`; rerun load flakes alone and name them).
- `SHOTS=polish-11` on four phones. At real size, look at 10-roof-array, 10-press-unit-4, 10-splitter-mill, 10-control-booth, 10-capacitor-bay, 15-capacitor-teach* on every phone.
- Don't run `BASELINE_UPDATE`; list the diffs. Commit to `ws/polish-11`, never merge. Log below.

## Log

**2026-11-04, done (ws/polish-11).**
1. Card overflow fixed with staged fit in `arrangeColumn`: `data-tight` (fig 0.62), then the name falls back into the text if the head slot is too narrow, then the new `data-tighter` (fig 0.5, chips and no-go marks hidden, less top padding). Text stays at its normal size, never below 14 px. The Capacitor strip wraps, and on tight cards the two strikes run on in one paragraph. Spec: altar-column `check()` now fails when a card scrolls, when a clipping box's scroll size exceeds its client size, or when a text rect leaves the card. A new per-phone test walks every arrival card page in play order (fresh `codex.taught`) on all four phones (>15 pages each).
2. "Again" dropped. Reminder pages show the gem name in the head slot ("New here" stays for first sight); no label on the button row.
3. Strikes page: "Strike ×2 ○○: your two strikes, one tap sends both. A miss resets for free." The marks appear once.
4. Amplify card: "Doubles the charge once." + "Charge already doubled passes through unchanged." The 4→8→8 two-Amplify picture doesn't fit the SE card, so it was skipped.
5. Capacitor card, no numbers: "Strike 1: stores, sends nothing." / "Strike 2: sends stored + new." (The brief's longer wording won't fit the SE in 3 lines.)
6. Tray teach ring removed. Opening a card no longer marks any tray gem (`data-teach` toggle gone). mobile-teach asserts that no tray tile is ringed before a tap.
7. Capacitor is stated as two-way. Codex rule: "Stores the first charge it gets; nothing comes out. Next strike, the new charge pushes both out, straight on. Works any way round." Chip: "Stores its first charge; next strike, lets out both. Any way round." Turn already says no turn is needed.
Also: the "On one strike" arrival card uses a short form, "Exactly the gauge's number wakes it. Less does nothing; more trips it." (`ONE_STRIKE_CARD`). The codex and a11y keep `ONE_STRIKE_RULE`. The script.md rows are updated.

Gates:
- `pnpm check` green (611 unit tests); `check:boundaries` ok; `build` ok.
- Targeted specs green (altar-column 16/16 after the dot-legend false-positive fix).
- Full `pnpm test:e2e` (offset 641): 201 passed, 20 skipped, 0 failed, no flakes.

Shots: `docs/design/screens/local/polish-11/<phone>/`. I checked the named shots on all phones; every card fits and Control Booth has no gold ring.

Baseline, not updated: 18 diffs, all the same cause. The new Capacitor codex rule text ("…straight on. Works any way round.") in the rule strip on capacitor-bay, lift-shaft and control-booth (empty and solved) × desktop-720, desktop-1080 and ipad. Nothing else changed.
