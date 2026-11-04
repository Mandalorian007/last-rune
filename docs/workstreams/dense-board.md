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
