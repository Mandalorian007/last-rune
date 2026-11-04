# Workstream: dense-board (Gate 2, blind review 7 blocker)

Source: D-040 addendum 8. Shots: `docs/design/screens/local/gate7/{se,iphone,promax,android}/` in the main repo (git-ignored). Key files: 10-the-last-rune, 12-the-last-rune-held, 10-lift-shaft, 12-lift-shaft-held, 10-capacitor-bay, 10-archive, 10-control-booth, 10-splitter-mill.

## Problem
On phones, dense boards are small while the right ~40% of the screen holds only the tray, one card and FUSE. Measured pitch: The Last Rune about 26–31 px, Lift Shaft and Capacitor Bay about 30–33, Archive and Control Booth about 33–39. Lock badges overlap the next socket, and the source orb overlaps a socket (Splitter Mill, Lift Shaft). The magnify loupe exists, but no still shows it, so reviewers think there is no answer.

## Do
1. **The board takes the space.** On phone forms the board gets full height, and the right column shrinks to what it needs on dense boards: the tray at its smallest readable size, the card lane narrower, FUSE's lane folded into the space under the tray. Use `layout.setForms` and `surface.setFrame` (what the altar uses today); do not add a camera (that is ws/camera, D-044). Aim for the largest pitch the height allows: 10×8 on a 320 px-high SE caps near 38–40. Report before/after pitch per dense altar on all four phones.
2. **Hit areas bigger than the drawn ring.** Each socket's hit area is its full cell (at least the pitch), with no dead gaps between neighbours. Lock badges and the source orb sit inside their own cell and never overlap a neighbour.
3. **Show the answer.** Add `12-<altar>-aim` shots to `tests/e2e/shots.spec.ts` for The Last Rune and Lift Shaft: a touch held over a socket with the loupe showing. If the loupe does not trigger at the new pitch, set its `below` threshold so it does on these boards.
4. Desktop and iPad must not change (`pnpm baseline`, no update; explain any diff).

## Done when
- check, check:boundaries, build, test:e2e green; an e2e asserting the minimum pitch per phone for The Last Rune and that no badge or orb rect overlaps a neighbouring cell.
- `SHOTS=dense-board` regenerated; you looked at the dense altars on SE and Android at real size as a first-time player.
- Commit to ws/dense-board, never merge. Log here.

## Log

### 2026-11-04 (dense-board agent)
**Board takes the space** (`scenes/altar/layout.ts`, phones only). `phoneLayout` fits each board twice: as before, and, for a board of 48+ cells (`PH.denseCells`) whose base pitch is under `PH.dense` = 46 CSS px, a dense fit. The base fit is kept unless the dense fit is bigger. In the dense fit:
- on a wide phone, a tray of up to four kinds (two a row) takes a column of only `PH.colDense` (104 CSS px); five or six kinds stay three a row at `colMin`;
- on an SE, the column keeps `PH.laneDense` (186 CSS px), so Capacitor Bay's long two-strike verdict still shows its Try line (altar-column);
- a north/south gauge's Gives/Needs card may sink over the board's edge row when every cell it would cover there is carved stone (`sinkSides`; never past the board's sides), so the card no longer adds its height to the board's reach.

`reach` is now per prop, so a W/E gutter is only paid where a W/E gauge stands. Non-dense layouts are unchanged, apart from the orb fix below.

A first cut (column 104 everywhere, two gems a row up to six kinds, applied to any board under 46) bought SE The Last Rune 30.2. But it starved the card lane: verdicts and the teach card overflowed on SE and iPhone (altar-column), and the tip overlapped Strike (mobile-moments). The column rule above is what passes those specs.

Pitch before → after, in CSS px:

| Altar | SE | iPhone | Pro Max | Android |
|---|---|---|---|---|
| The Last Rune | 26.4 (same) | 28.9 → 32.8 | 33.5 → 36.9 | 31.4 → 34.7 |
| Lift Shaft | 35.1 → 36.1 | 37.9 → 39.1 | 44.1 → 44.5 | 41.0 → 41.9 |
| Capacitor Bay | 35.1 (same) | 37.9 → 40.2 | 44.1 → 45.4 | 41.0 → 42.7 |
| Archive | 33.3 (same) | 45.7 (same) | 52.1 (same) | 49.0 (same) |
| Control Booth | 33.3 (same) | 43.4 (same) | 51.3 (same) | 49.0 (same) |
| Roof Array | 40.6 (same) | 44.9 → 45.7 | 50.9 (same) | 47.7 (same) |

Splitter Mill on Android goes 71.1 → 68.6 because its south orb now clears the edge row; every other board is unchanged.

38–40 for a 10×8 on an SE is not reachable without a camera. On an SE the column is the card lane: a verdict with a cause and a two-line Try needs about 186 CSS px of width, and The Last Rune is width-bound (W/E gauge gutters plus that column). On the other phones it is height-bound (the N/S gauges are about 30 CSS px each).

Proposals, not taken:
- let the SE verdict take the rail's height (or scroll) so its column could narrow;
- trim fully blocked edge rows and columns (this would help Roof Array).

**Hit areas.** These were already the whole cell (`cellAt`; `snapCell` reaches half a pitch further). The new spec checks every cell's corners and a real tap 0.44 pitch off-centre.

**Placement.**
- *Lock pip.* On phones (`hug` slabs), the collar's lock pip centre moves from 1.0 to 0.94 socket radii (`LOCK_PIP` in `shaders/stone-wgsl.ts`; the slab signs the collar's reach param negative to ask for it), so pip + radius stays at 0.49 pitch, inside its cell. Desktop keeps 1.0: moving it there too diffed the Lift Shaft baselines. The pip icon itself is untouched; that is glyph-truth-2's.
- *Source orb.* An N/S source orb now stands far enough out (`orbOut`) that its glass, halo and shell (0.33 of its size) clear the edge row's cells. This fixes Lift Shaft and Splitter Mill, at a cost of about 0.4–1 px of pitch where the orb sits at S.

**Loupe.** `magnify.below` is now `LOUPE_BELOW` = 48 (layout.ts), so it shows on every dense board on every phone (Lift Shaft on a Pro Max is 44.5).

**Tests.**
- `tests/e2e/dense-board.spec.ts`, per phone:
  - the minimum pitch for The Last Rune (SE ≥ 26, iPhone ≥ 32.5, Pro Max ≥ 36.5, Android ≥ 34.5);
  - The Last Rune and Lift Shaft are under `LOUPE_BELOW`;
  - every open cell's corners hit that cell;
  - the lock pip's reach is ≤ half a pitch;
  - the orb disc covers no board cell, on seven boards;
  - a real tap near a socket's corner places the held gem there.
- `shots.spec.ts` adds the `12-the-last-rune-aim` and `12-lift-shaft-aim` shots: a finger held over a socket, with the loupe up.

**Gates.** `pnpm check`, `check:boundaries` and `build` pass. Full `pnpm test:e2e`: 171 passed, 20 skipped. That run came before the phone-only pip change; dense-board and shots were rerun after it and pass. `pnpm baseline` with no update: 129 passed. The first run diffed only Lift Shaft on desktop-720 and desktop-1080 (the lock pips), so the pip move is now phone-only.
