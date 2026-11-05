# Workstream: camera (Phase 3, PLAN row 10; D-044; brought forward by D-040 add. 12)

Starts only after ws/one-overlay is merged (D-044 entry condition). Read D-041, D-044, D-040 add. 11–12, `packages/engine/ARCHITECTURE.md` (Surface, Camera, Layout, Input), and the logs in `dense-board-3.md`, `dense-board-4.md` and `one-overlay.md` first.

## Why now
Three blind reviews in a row scored 7/7/7/7. The one major every reviewer still raises is the dense boards: The Last Rune, Lift Shaft, Archive and Capacitor Bay. Their pieces are too small to read port direction, sockets are 26–31 px on 35–41 px pitch, and the loupe covers the neighbours. The Last Rune is height-bound on every phone (iPhone ceiling ~39.6 px pitch, SE ~33), so no column layout can fix it. The world has to be able to be bigger than the screen.

## Engine (platform only, no game nouns)
1. **Matrix `Camera`** as ARCHITECTURE.md plans it: `mat4` in `core/math.ts`, view-projection, `worldToScreen` / `screenToWorld`, presets `ortho2d(designW, designH)` and `fitRect(rect, viewport)`, and the camera uniform block. The old 2D `renderer.camera` (`x`, `y`, `zoom`, `rotation`) becomes a thin adapter or is removed. Every existing caller is ported.
2. **`fitRect` fed by `layout.freeRect`.** The world frames into what the UI leaves. `surface.setFrame` letterboxing is replaced by the camera where it overlaps.
3. **Deletions (D-044):** `EngineCtx.device` (`DeviceMode`), `fillBands`, `setFill(key)` and `platform/device-mode.ts`. Port every game use.
4. **View control as a platform feature:** an optional `CameraControl` that turns `Gestures` pinch, two-finger pan and double-tap into zoom and pan on a camera. It is clamped to world bounds, with min zoom = fit and a max zoom set by the game. It has inertia off and reduced-motion respected, and is exposed as `zoom`, `pan`, `zoomTo(worldRect)`, `reset()` and `onChange`. One-finger drag must stay free for the game (aim and place). Unit tests plus engine e2e. CHANGELOG and ARCHITECTURE.md are updated in this branch.
5. World-anchored DOM (labels on gauges and orbs) follows the camera through `worldToScreen` on every change.

## Game (The Last Rune)
1. **Board fit.** On every form, the camera fits the board's content rect (sockets + orbs + gauges + their labels), not a fixed design canvas. Desktop and iPad must look the same as today (baseline within threshold).
2. **Dense boards on phones.** When fitted pitch < 44 CSS px, the player can zoom in:
   - by pinch or double-tap;
   - also by a visible on-screen control (a "+ / −" or "Zoom" button in the left rail, 44 px tap target, labelled), because gestures are not discoverable.
   
   At zoom, pitch is ≥ 44, so the loupe stops appearing (its `below` threshold), and pieces' ports and arrows read at a glance. Pan follows two fingers. A small "fit" button returns to the whole board. Gauges, orbs and their labels stay attached to the board.
3. **Never lose the goal.** While zoomed, off-screen gauges and the source show a small edge marker (arrow + "Needs N") so the target is never hidden. Strike results (per-strike chips, verdict) still read; on Strike the view may zoom out to fit to show the whole result.
4. **Teaching.** The first time a dense board opens on a phone, one short card teaches zoom ("Pinch or tap + to zoom in"). Keep D-043 (no forecast) and D-027 (visuals match rules).
5. Remove the dense-board-4 slim-column mode only if the camera makes it redundant (log the call and the pitch numbers either way).

## Done when
- `pnpm check`, `pnpm check:boundaries` and `pnpm build` are green. Run `pnpm test:e2e`, `pnpm test:e2e:engine` and `pnpm test:e2e:desktop` with a unique `E2E_PORT_OFFSET`. Rerun load flakes alone and name them.
- A spec proves, on all four phones, for The Last Rune, Lift Shaft, Archive and Capacitor Bay:
  - after zoom in, pitch is ≥ 44 CSS px and a gem can be placed by tap;
  - the gauges stay visible or edge-marked;
  - fit restores the whole board.
- Report fitted and zoomed pitch per phone for those four altars.
- `pnpm baseline`: desktop and iPad within threshold; explain any diff.
- `SHOTS=camera` on four phones plus portrait. Add shots for each dense altar zoomed (`11-<id>-zoom`) and the zoom teach card. At real size, look at The Last Rune and Lift Shaft fitted, zoomed and aim.
- Don't run `BASELINE_UPDATE`. Commit to `ws/camera`, never merge. Log below.

## Log
