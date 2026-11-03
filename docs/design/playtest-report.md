# Playtest report: full run, title to the last rune

Owner: full-run workstream. Build: this worktree's `pnpm build` (`dist/`), served by `vite preview`.
Browser: Playwright Chromium with WebGPU (Metal, Apple GPU), 1280x720, plus 960x540 re-shoots.
Date: 2026-11-02.

## Summary

- **A player can finish the game.** The test goes from the title through all 16 machines with real keyboard input only (no dev handles, no save seeding). Each machine is solved on its first strike, and the save records all 16 as solved with one attempt each. Reloading and pressing Continue lands back in the hall.
- **No dead ends, no console warnings or errors, no page errors.** Performance was steady at 60 fps during every strike (p95 frame 16.8 ms, zero frames over 33 ms). This was measured on an Apple GPU only, so low-end hardware is untested.
- **The biggest player-facing problem is the FUSE caption card.** It covers altar readouts and tray counts, and it truncates its own text at 960x540. Board readability (dark sockets, carved and open sockets that look alike on big boards) comes second.

## Findings, ranked by player impact

Each finding gives severity (S1 blocks or misleads, S2 hurts clarity, S3 polish), where it shows, and a screenshot.

### 1. S1: The FUSE caption covers puzzle information

The caption card sits bottom-right and is drawn over the altar. On wider boards and smaller windows it hides information the player needs to solve:

- On control-booth, at both 1280x720 and 960x540, it covers tray slot 6 and its count ("6 ×1" is cut off). The DOM audit flagged `.lr-altar-count` × `.tc-caption` on both the open and placed beats. See `screens/playtest/control-booth-caption-over-tray-960.jpg`.
- On intake-desk at 1280x720, the caption's left edge touches the east machine's "Needs 4 · got 0" label after a strike. See `screens/playtest/intake-empty-strike.jpg` and `screens/playtest/intake-partial-strike.jpg`.

Suggested fix (owner: altar-scene or FUSE UI): reserve a caption lane that the altar layout avoids, or dock the caption above the tray. Hiding it isn't the answer, because its lines are part of the story.

### 2. S2: The FUSE caption truncates mid-word at 960x540

On the archive solve card, the line ends "They say nothing on this floor runs hot en", clipped by the card's height. The audit's clip check didn't catch it, because the overflow is in a nested element. See `screens/playtest/archive-solve-caption-cut-960.jpg`. The same caption also covers the right-hand alcoves in the hall (`screens/playtest/hall-after-storm-cell-2-960.jpg`).

### 3. S2: Big boards: blocked ("carved") sockets look too much like open ones

On the 8x6 and 10x8 boards, carved sockets (a diagonal slash) and open sockets (a thin dark ring) are both near-black and differ only by a hairline. In the last rune you have to look hard to see where gems can go. See `screens/playtest/last-rune-placed-960.jpg` and `screens/playtest/capacitor-bay-open-960.jpg`. The board as a whole is very dark before the first strike. On intake-desk the lower rows nearly disappear into the backdrop (`screens/playtest/intake-empty-strike.jpg`).

### 4. S2: Machine gauges and "Needs N" labels float away from the board

On the last rune, the north gauge is small and its "Needs 4" label sits well above and to the side of its socket edge. The south "Needs 2" floats well below the board. Matching a requirement to its machine takes a moment (`screens/playtest/last-rune-bolt.jpg`). It's fine on 6x4 boards.

### 5. S2: Hall: locked alcoves are almost black, and the one open door doesn't stand out on first entry

On first entry only the intake desk is open, but at 960x540 nothing marks it as the place to go until it gets focus or hover (`screens/playtest/hall-first-entry-960.jpg`). Hover works (`screens/playtest/hall-hover-front.jpg`). The plate reads "Open · click to restore", and the locked-door line plays correctly (`screens/playtest/hall-locked-door.jpg`). The completed hall reads well (`screens/playtest/hall-complete.jpg`).

### 6. S2: The settings dialog opens with the FUSE caption over it

Pressing Esc in the hall opens settings while a FUSE line is still showing, and the caption overlaps the lower part of the dialog, near "Reset progress". See `screens/playtest/hall-settings-over-caption.jpg`. The caption should hide, or sit under the modal layer, while a dialog is open.

### 7. S3: The Settings key hint reads like "0"

The HUD shows "Settings 0". The binding is the letter O (`KeyO` in `game/actions.ts`), but in the HUD's `kbd` font it reads as zero. Consider a different key or a glyph that is clearly a letter.

### 8. S3: Enter on a placed gem does different things

With a gem in hand, Enter on an occupied socket rotates the gem if it is rotational, and picks it up if it isn't. `altar-ux.md` says "Enter on a gem = pick up". This is easy to learn, but it should match the doc, or the doc should be updated.

### 9. S3: The fizzle tag sits on the board during a failed strike

On an inexact strike, the verdict, the "Empty socket: the bolt fizzled" tag, and FUSE's line all show at once. The tag is drawn over sockets near the fizzle. It reads fine, but it is busy (`screens/playtest/intake-partial-strike.jpg`).

### 10. S3: A rule tooltip pops up over FUSE's sprite

Hovering the tray shows the gem rule tooltip (for example "Channel: carries charge straight through") over FUSE's sprite in the lower left (`screens/playtest/last-rune-placed-960.jpg`). It's harmless, but the tooltip would read better anchored above the tray slot.

### What went well

- Progression unlocks every machine in a reachable order. Keyboard focus in the hall survives trips to the altar, so a keyboard player never loses their place.
- Strikes are short (1.5 to 5.5 s at normal speed) and the solve card is quick (Continue appears 1.3 to 1.8 s after the wake). The new-gem and "Opens: …" lines on the card are clear (`screens/playtest/intake-solve-card.jpg`).
- Journal pages land on the solve card and in the save (now asserted by the test for every machine).
- Leaving a puzzle half-done, going idle for about 12 s, and coming back produced no errors. The idle nudge plays.

## Per-puzzle numbers

These come from the scripted keyboard run. "Place" is the time the script took to key in the known solution (a lower bound on hands time, not a human solve time). "Design" is the target minutes from `puzzles.md`. "Card" is the wake-to-Continue time. Every strike ran at 60 fps, with zero frames over 33 ms.

| # | Machine | Board | Gems | Keys | Place (s) | Strike (s) | Wake (s) | Card (s) | Design (min) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | intake-desk | 6x4 | 5 | 13 | 1.5 | 1.5 | 1.8 | 1.3 | 1 |
| 2 | furnace | 6x4 | 8 | 23 | 2.8 | 2.0 | 1.3 | 1.8 | 2 |
| 3 | conveyor-a | 6x4 | 6 | 20 | 2.3 | 2.0 | 1.3 | 1.8 | 2 |
| 4 | splitter-mill | 6x4 | 8 | 22 | 2.8 | 2.0 | 1.3 | 1.8 | 2 |
| 5 | storm-cell-2 | 6x4 | 11 | 30 | 4.6 | 2.0 | 1.3 | 1.8 | 3 |
| 6 | press-unit-4 | 6x4 | 11 | 30 | 5.1 | 2.5 | 1.3 | 1.3 | 3 |
| 7 | boiler-room | 6x4 | 13 | 35 | 5.1 | 2.0 | 1.3 | 1.8 | 4 |
| 8 | relay-tower | 6x4 | 9 | 26 | 4.2 | 2.0 | 1.3 | 1.8 | 2 |
| 9 | foundry | 6x4 | 10 | 39 | 4.9 | 2.0 | 1.3 | 1.8 | 4 |
| 10 | crane | 6x4 | 11 | 35 | 5.3 | 2.0 | 1.3 | 1.8 | 4 |
| 11 | capacitor-bay | 8x6 | 13 | 56 | 6.2 | 4.5 | 1.3 | 1.8 | 5 |
| 12 | archive | 8x6 | 20 | 55 | 10.8 | 2.5 | 1.3 | 1.8 | 5 |
| 13 | roof-array | 8x6 | 18 | 50 | 8.7 | 4.5 | 1.3 | 1.8 | 6 |
| 14 | lift-shaft | 8x6 | 10 | 31 | 6.5 | 5.5 | 1.3 | 1.3 | 6 |
| 15 | control-booth | 8x6 | 16 | 55 | 8.2 | 2.5 | 1.3 | 1.8 | 7 |
| 16 | the-last-rune | 10x8 | 15 | 59 | 7.1 | 5.5 | 1.3 | 1.8 | 8 |

Keyboard cost now runs about 2.5 to 4 presses per gem: pick, turn, move, then Enter. (Keys refreshed by bug-bash on 2026-11-02 from a new keyboard-only full run. The other columns are from the earlier run.) The script places gems in solution order rather than by the shortest path, so a careful player can do a little better. Archive dropped from 114 presses to 55 for 20 gems. The biggest totals are now the-last-rune (59), capacitor-bay (56), archive (55) and control-booth (55). None of those are a burden on a keyboard. The run logged zero console warnings or errors.

## Ending

In this build, solving the last rune returns to the hall with "Every machine restored." The ending scene belongs to story-scenes. The full-run spec has a marked `ENDING HOOK (story-scenes)` block and a `test.fixme('ending plays after the last rune (story-scenes)')`. For the last rune, the spec already accepts either the hall HUD or a region named "Ending", so it survives that merge.

## Harness notes

- **Parallel worktrees shared a server.** With fixed ports and `reuseExistingServer`, one worktree's e2e run silently tested another worktree's build (an earlier run saw an Ending scene that this branch doesn't have). `playwright.config.ts` now reads `E2E_PREVIEW_PORT` and `E2E_ITCH_PORT`, with the defaults unchanged. **Recommendation:** have each worktree agent set unique ports.
- **A known false positive in the DOM audit.** The title × verdict "overlap" on every verdict beat is not a visible problem. The title's box includes a hidden "Restored" subtitle slot.
- **A capture race, now fixed.** The first run under-counted journal pages, because pages appear on the card 2.4 s after the wake, after Continue (1.6 s). The spec now waits for the page note and asserts `journal.found` from the save.
- **Reliability.** The full `pnpm test:e2e` ran 3 times in a row with 0 flakes (14 passed and 1 fixme each, about 3.9 m per run).
- **No testability hook was needed.** Everything is driven by keyboard and asserted from the DOM and `localStorage`.

## How to rerun

```sh
pnpm build
E2E_PREVIEW_PORT=4573 E2E_ITCH_PORT=8990 pnpm exec playwright test tests/e2e/full-run.spec.ts
# Playtest mode: screenshots at every beat (1280x720 and 960x540), DOM audit, metrics.json
PLAYTEST_OUT=/some/dir E2E_PREVIEW_PORT=4573 E2E_ITCH_PORT=8990 pnpm exec playwright test tests/e2e/full-run.spec.ts
node scripts/playtest/summarize.mjs /some/dir/metrics.json
# Off-script beats (locked door, settings, empty or partial strikes, idle)
PLAYTEST_OUT=/some/dir pnpm exec playwright test -c scripts/playtest/playwright.config.ts
```
