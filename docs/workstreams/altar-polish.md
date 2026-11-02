# Workstream: altar-polish (wave 4, pre-alpha)

**Goal:** the altar is clear and comfortable on every board, including the big late ones, and FUSE never covers puzzle information. Fixes the altar findings from the full-run playtest.

**Owns:** `games/last-rune/scenes/altar/`, `games/last-rune/shaders/` used only by the altar, `tests/e2e/altar.spec.ts`. In `content/lines.ts`, only a new `nudge.channel` line (FUSE voice: dry, bureaucratic, no "I" in Tier 1; see `docs/design/script.md`). Add it to the script too.
**Don't touch:** `ui/` (caption-layout is changing the caption card), `scenes/hall/`, `art/hall/`, `scenes/ending/`, `art/props/` (engine-adoption), `engine/`, puzzle rules and content apart from the line above.

## Deliver
Fix these findings from `docs/design/playtest-report.md` (screenshots in `docs/design/screens/playtest/`):
1. **S1: caption covers puzzle info.** FUSE's caption covers tray slot 6 and its count on control-booth, and touches the "Needs 4 · got 0" label on intake-desk. Make the altar layout reserve room for the caption, or move the caption on the altar through whatever the caption currently exposes (CSS in `altar-styles.ts` is fine). Check every altar at 960×540 and 1280×720.
2. **S2: big boards.** Blocked sockets are hard to tell from open ones, and the whole board is very dark before the first strike (last-rune, capacitor-bay). Blocked must read as "nothing goes here" at a glance, and the board needs enough ambient light to read before any strike.
3. **S2: last rune labels.** The "Needs N" labels float far from the board, so it's unclear which requirement belongs to which machine. Tie each label visibly to its exit and machine.
4. **S3: Enter on a placed gem** rotates some gems and picks up others. Make it consistent with `docs/design/altar-ux.md` (or update the doc if a better rule is clearer), and show the rule in the key hints.
5. **S3: polish.**
   - The fizzle tag is drawn over the board.
   - The gem tooltip appears over FUSE.
   - The input cost on large boards (114 presses for 20 gems on archive): consider faster cursor travel, such as jumping to the next live socket or remembering the last cell per gem.
6. **Splitter-mill:** the storm's stand overlaps the west machine's roof. Offset the layout when two props share a side.
7. **Channel:** add `nudge.channel` so Channel gets a first-appearance FUSE line like the other gems.
8. **Engine adoption:** use `ParticleSystem.clear()` where the altar resets particles. Check the bolt against the engine's default trace timing: keep the current look via `duration`/`timeScale` if the default reads worse.

Keep the board-as-circuit look and the route preview (PM decision). Before/after screenshots of intake-desk, control-booth, splitter-mill, capacitor-bay, archive and the last rune at 960×540 and 1280×720.
`pnpm check`, `pnpm build` and `pnpm test:e2e` must pass (including `full-run.spec.ts`).

## Log

### 2026-11-02: altar-polish pass (branch `worktree-agent-a987b6405843b92d2`)

Screens: `docs/design/screens/altar-polish-{before,after}-*.png` (the last rune, control-booth at 960, splitter-mill, capacitor-bay after the tags fade).

1. **Caption (S1): fixed.** New `CAPTION_LANE` (x ≥ 1130, y ≥ 820) and `FUSE_LANE` (x ≤ 410) in `layout.ts`. Tray slot centres sit between x 470 and 1070, centred, and six slots close up to 120 px, so control-booth slot 6 sits clear of the caption. `traySlotAt` hit width follows the spacing. South need labels sit level with the cabinet top (y − 0.18 × size) instead of near y 800 (intake-desk). `clarity.test.ts` checks that no tray slot or label enters either lane. Only layout and `altar-styles.ts` changed. No `ui/` edits.
2. **Big boards (S2): fixed.**
   - Blocked sockets are now a pale, flush capstone with a deep X (`SOCKET_WGSL` state 1, which replaces the rubble and hairline bar).
   - The veil over quiet sockets stops inside the bowl rim, so open sockets still read as holes.
   - Light: ambient goes from 0.06 to 0.075. A work light sits over the slab (radius = board span), and each machine gets a lamp in the prop rig. Prop ambient goes from 0.16 to 0.19. Lower rows and cabinets read before the first strike.
3. **Last-rune labels (S2): fixed.** Each label carries a notch that points at its cabinet (CSS `::before`, which follows the outcome border colour). N/S labels moved in to 0.46 × size, and the cabinets are now lit.
4. **Enter (S3): fixed, doc unchanged in spirit.**
   - Enter and pad A on a placed gem always pick it up, keeping its turn. Bend and Gate included.
   - R and Q turn. A mouse click still turns a Bend or Gate.
   - The key hint now reads "keys: 1–6 take, arrows move, Enter picks up or places".
   - `altar-ux.md` controls are updated.
5. **S3 polish:**
   - Fizzle tags fade after 3.2 s; the red ring stays. With reduced motion they hide without the fade.
   - The tray tooltip is clamped between FUSE and the caption, and its pointer still marks the slot.
   - Faster cursor: after Enter fills a socket, taking the next gem by key moves the cursor to the nearest open end of the route. The cursor is exposed as `data-cursor` on `.lr-altar`, and both e2e builders read it.
   - Measured on the designers' `intended` order: 861 → 808 presses over all 16 boards (intake 15 → 10, storm-cell-2 46 → 30, press-unit-4 51 → 37). Archive (108 → 109), roof-array, lift-shaft and control-booth are flat or slightly worse, because their `intended` lists are not in route order. A player who follows the route gets the saving.
6. **Splitter-mill: fixed.** A machine on the storm's E/W side steps out by 0.3 × storm size, so the stand clears its roof. `clarity.test.ts` checks this.
7. **Channel: done.** `nudge.channel` reads "Plain blue. In one side, out the other. Like the paperwork." It is Tier 1 and has no "I". The `nudge` type now allows `channel`. It is in `script.md` and the tests are updated.
8. **Engine adoption: done.**
   - `ctx.particles.clear()` now runs on altar and solve exit, and the stale comments are removed.
   - Bolt timing: the altar's own timeline already uses 0.15 s per tick, which equals `TRACE_TICK_SECONDS`, so nothing changed.

Checks: `pnpm check` (572 tests), `pnpm build`, and `pnpm test:e2e` (16/16, including `full-run.spec.ts`) all pass after merging main at 244ab7b.
