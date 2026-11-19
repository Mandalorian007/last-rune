# Workstream: bug-bash

User (2026-11-02): "make judgements for quality and focus on polishing things up". Play the whole game as a first-time player (D-027). Find what's broken, ugly, confusing or inconsistent, and fix it.

## Scope
- **Sweep:**
  - title → Settings → Codex → journal → hall → every altar → ending → end card;
  - at 1920×1080, 1280×720, and 1280×720 at 150% text;
  - mouse, keyboard and gamepad (Playwright gamepad stubs are fine).
  - Watch for:
    - clipping, overlaps, focus traps or lost focus;
    - console errors/warnings;
    - stale or misleading text;
    - inconsistent wording (Strike vs Fire, gem names, key hints);
    - z-order fights with FUSE's caption;
    - layout jumps;
    - sounds that don't fit an action.
- **Robustness:**
  - resize and devicePixelRatio changes mid-scene;
  - tab hidden/visible;
  - WebGPU device lost (should show the friendly message, not a blank page);
  - corrupt or old localStorage saves;
  - rapid input spam on Strike and Back;
  - reload mid-strike.
- **Known items:**
  - Settings and Codex panels need scrolling at every text size. Make them fit at 1280×720 at 100% and degrade gracefully at 150%, or make the scroll obvious.
  - The lint warning: `any` in `scripts/playtest/glyphs.spec.ts:89`.
  - The caption vs the bottom key-hint line on the altar: verify it is fully resolved.
  - Refresh the Keys column in `docs/design/playtest-report.md`.
- **Triage:**
  - Fix S1 and S2 issues.
  - Fix S3 issues when the fix is small.
  - List everything else, with severity, in the log for the PM.
- **Out of scope:**
  - Puzzle data, solver or FUSE lines (difficulty-2 owns them).
  - Candle/hall lighting (candle-light).
  - Perf internals (perf-low).
  - Firefox (not a target).

## Done when
- A findings table in the log: severity, where, what, fixed/deferred.
- Before/after screenshots for each visual fix.
- Each fixed bug that can regress gets a unit or e2e test.
- Zero console errors on a full run.
- `pnpm check` (lint warnings included), `pnpm build` and `pnpm test:e2e` pass.

## Log

### 2026-11-02: sweep, fixes, findings

**Route covered:** title → Settings → Codex → journal → hall → all 16 altars → ending → end card.
- Viewports: 1920×1080, 1280×720, and 1280×720 at 125% and 150% text.
- Inputs: mouse, keyboard, and a stubbed standard gamepad.
- Screenshots are in `docs/design/screens/local/` (gitignored, not committed), under `before/`, `before2/`, `after/`, `after-polish/`, `robust/` and `fullrun/`.

**Robustness:**
- Resize and DPR changes mid-play, including mid-strike: OK.
- Hidden or frozen tab: OK.
- WebGPU device lost: a friendly "The lights went out" dialog appears, with focus on Reload.
- Corrupt saves (5 kinds) and an old v1 save: handled; corrupt saves are now reported to the player (fix below).
- Strike, Enter/Esc, O and Back spam: OK.
- Reload mid-strike: OK.

All of these are covered in `tests/e2e/robustness.spec.ts` (12 tests, including a gamepad-only pass).

| # | Sev | Where | What | Status | Evidence / test |
|---|---|---|---|---|---|
| 1 | S2 | Settings, 1280×720 | Panel needed scrolling at every text size; Done was below the fold. | **Fixed**: two-column layout (Sound + Graphics / Comfort + Save), Done row sticky at the bottom. No scroll at 100/125/150% (Done bottom 591/613/648 px of 720). | before/settings-* vs after/settings-1280-*; `layout-fit.spec.ts` |
| 2 | S3 | Settings | Slider labels used the sans UI font while the rest of the panel is serif. | **Fixed**: `.tc-field` inherits the serif at 26px. | after/settings-* |
| 3 | S2 | Codex, 150% text | Gate page overflowed by 81 px; the folio sat under the tab row. | **Fixed**: taller book and tighter rule leading at text scale. All spreads fit at 100/125/150%. | before2/codex-150-spread3 vs after/codex-150-spread3; `layout-fit.spec.ts` |
| 4 | S3 | Codex host | Corner ornaments overflowed the panel by 6 px, which could show scrollbars. | **Fixed**: the host panel's overflow is now visible; panel scrollbars use the accent colour so scrolling is obvious when it does happen. | `layout-fit.spec.ts` |
| 5 | S2 | Altar verdict (Archive, 150%) | A fizzle tag covered the verdict line. | **Fixed**: a tag that would overlap the verdict flips below its cell, with an up arrow. | before vs after-polish/altar-archive-verdict-1280-150; `layout-fit.spec.ts` |
| 6 | S2 | The Last Rune altar | The "Storm ×4 gives 16" label covered the column-0 sockets. | **Fixed**: the storm label shifts off the board on W/E storms, and its notch still points at the storm. | after-polish/altar-the-last-rune-*; `layout-fit.spec.ts` |
| 7 | S3 | Altar subtitle at 150% | "2 strikes" wrapped as an orphaned "strikes". | **Fixed**: the subtitle wraps only between segments. | after-polish/altar-*-150 |
| 8 | S3 | Ending | A leftover hall toast covered the ending headline. | **Fixed**: toasts clear when the ending starts. | after-polish/end-* |
| 9 | S2 | Boot with a corrupt save | The save was reset silently, so the player lost progress with no explanation. | **Fixed**: warn toast "Your saved game couldn't be read, so a new one begins. A backup was kept." | robust/corrupt-not-JSON; `robustness.spec.ts` (5 cases) |
| 10 | S3 | `scripts/playtest/glyphs.spec.ts:89` | Lint warning (`any`). | **Fixed** | `pnpm check` clean |
| 11 | — | Altar caption vs key hint | The caption overlapped the bottom key-hint line. | **Verified resolved** at 1280/1920 at 100/150%. | after-polish/altar-*-caption-* |
| 12 | — | Playtest report | Keys column was stale. | **Refreshed** from a new full run. | `docs/design/playtest-report.md` |
| 13 | S3 | Toasts; the ending's "This was the whole game…" line | These use the sans UI font rather than the serif. | Deferred (style choice for art/ui) | after-polish/end-* |
| 14 | S3 | End card | A tilted brown card prop near "Back to the hall" reads as clutter or an unclear object. | Deferred (art-props) | after-polish/end-* |
| 15 | S4 | Altar tags below a cell | The pop-in animation starts from the above-cell offset, so there is a small jump. | Deferred (cosmetic) | — |
| 16 | S4 | Device lost | The game loop keeps ticking under the fatal dialog. No errors, but wasted work. | Deferred (perf-low / engine) | `robustness.spec.ts` |
| 17 | S4 | Settings in the hall | The modal covers the HUD buttons. | Deferred: acceptable for a modal | after/settings-* |
| 18 | S2 | Multi-strike altars (capacitor-bay), mid-strike 2 | The machine label's "got N" is the live reading of the strike in progress, but the chip list only showed finished strikes. A machine could show "got 4" beside only "Strike 1: 2", which reads as strike 1 getting 4. It is a display mismatch, not lag; the sim values are right. | **Fixed**: the strike in progress shows as a dashed "live" chip ("Strike 2: 4"), so "got" always equals the newest chip. When the strike settles, the chip takes its exact/under/over colour. | `capacitor.spec.ts`: a per-frame check that "got N" matches the newest chip (would have caught "got 16 \| Strike 1: 0") |
| 19 | — | `robustness.spec.ts` spam test | Flaky: O-spam toggle parity isn't deterministic when presses land during the panel transition. | **Fixed** (test): Esc spam, then deliberate Esc until it is closed, still asserting ≤1 panel throughout | — |

**Shared files touched:**
- `games/last-rune/ui/styles.ts`: Settings layout, Codex text-scale sizing, `.tc-panel` scrollbar colour (game CSS only; engine untouched).
- `games/last-rune/main.ts`: corrupt-save toast.
- `games/last-rune/scenes/ending/ending-scene.ts`: clears toasts on enter.
- `games/last-rune/scenes/altar/altar-scene.ts`, `altar-styles.ts`: tag flip, storm label offset, subtitle segments.
- `games/last-rune/ui/settings-panel.ts`: two-column layout.
- New tests: `tests/e2e/robustness.spec.ts`, `tests/e2e/layout-fit.spec.ts`.

**Full run:** the keyboard-only `full-run.spec.ts` covers all 16 machines at 1280×720 against the prod build. It logged zero console warnings or errors, zero audit problems, and every strike ran at about 60 fps. The run's data is in `screens/local/fullrun/metrics.json`, which refreshed the Keys column.

**Open for the PM:** items 13–17 above. None of them blocks release.

## 2026-11-18: phone end-card Join / Ko-fi links don't open

- **Report:** on a phone (landscape), the end card's Join ThunderClap Gaming and Buy ThunderSoap a coffee did nothing; the Copy buttons worked. The title-page Ko-fi link was fine.
- **Cause:** `ending-phone-styles.ts` lays the card out as a 2-column grid with the `.tc-link` wrappers as `display: contents` and set the Copy buttons to `position: static`. In that combination the last Copy button (Ko-fi) won hit-testing at every point on the card (`elementFromPoint` at each link's centre returned it). So link taps never reached the anchors, and "Copy invite link" actually copied the Ko-fi URL.
- **Fix:** Copy is `position: relative; left: auto` on phones (`left: auto` cancels the desktop `left: 100%`). The layout is pixel-identical.
- **Test:** `link-copy.spec.ts` › `phone end card: tapping Join and Ko-fi opens them` (956×440). It hit-tests all four controls and taps both links, with the external hosts stubbed. It fails on the old CSS.

## 2026-11-18: Codex gem portraits black on Safari / iPad

- **Report:** on the user's iPad (Brave on iOS, so WebKit), the top half of every Codex gem portrait was solid black. The gem was cut off at about 51% down the cell.
- **Cause:** the engine's `SnapshotRenderer.capture()` calls `OffscreenCanvas.transferToImageBitmap()` in the same task as the WebGPU submit. On WebKit that bitmap comes back incomplete: all black on macOS Safari 27, top ~half black on iPad. Reproduced in Safari with a probe page. Playwright's WebKit has no WebGPU, so CI can't see this.
- **Strategies tested in Safari 27:** sync `transferToImageBitmap` gave a blank image. Three alternatives gave a complete one: `onSubmittedWorkDone()` before the transfer, `createImageBitmap(canvas)`, and a same-task `drawImage(canvas)` into a 2D canvas.
- **Interim fix (`fa2f587`):** a game-side bake with a same-task `drawImage` copy.
- **Proper fix:** engine 2.0.2 (`ws/snapshot-webkit`) makes `SnapshotRenderer.capture()` copy the frame into a 2D `OffscreenCanvas` with `drawImage` in the same task and return that canvas's bitmap. The signature is unchanged; in Safari the old path got 0% of the frame and the fixed one 100%, repeat captures included. The game moves to engine `^2.0.2` (host-electron `^0.3.1`), and `gem-portraits.ts` is back on `SnapshotRenderer`. The 2.x migration needed only particles: `withParticles(...)` plus `KitParticleFields` on `LastRuneEngine`.
- **2.x regression found and fixed upstream (engine 2.0.3, `ws/warm-live`):** on 2.0.2, 8 e2e tests (ending ×3, a11y:139, dense-board iphone, hardening phone, layout-fit:78, link-copy:231) logged `[Buffer "pass:storm-sim-uniforms"] used in submit while destroyed`. Since 2.0, each `FullscreenPass` queues a pipeline warm that binds its uniform buffer. A storm cell made and disposed in one task (an altar opened and closed by a test, before any frame) left that warm naming a destroyed buffer. Engine 2.0.3 adds `WarmTarget.live` and `FullscreenPass` drops its warm on `destroy()`. With 2.0.3 all 54 tests in those 6 specs pass, with no game change. The game is on `^2.0.3`.

## 2026-11-18: iPad crash card after coming back to a background tab

- **Report:** on iPad (a WebKit browser), coming back to the game's tab almost always shows "Something went wrong" with Reload / Keep playing.
- **Cause:** WebKit can leave the page's WebGPU canvas unconfigured while the page runs. The engine's `Renderer.endFrame` then threw `InvalidStateError: GPUCanvasContextCocoa::getCurrentTexture: canvas is not configured` from the frame loop, and the crash screen caught it. Calling `unconfigure()` on Playwright WebKit gives the same card (non-fatal, Keep playing). These did not reproduce it: simulated hide/show events, `device.destroy()` (only validation warnings) and a 0×0 canvas. The exact WebKit trigger on iPad is inferred, not observed.
- **Fix:** upstream in engine 2.0.4 (the renderer configures the context again with its device, format and alpha mode, and presents). The game's FUSE caption portrait has its own WebGPU canvas, so it got the same guard (`art/props/fuse-portrait.ts`).
- **Test:** `hardening.spec.ts` › `a canvas left unconfigured (iPad back from the background) keeps playing, no crash card` unconfigures every WebGPU canvas under a running game. It fails on 2.0.3.
