# Workstream: one-overlay (Phase 3 entry condition)

Source: D-044, the external architecture review (`docs/engine/review-2026-11-04.md`, debt 1 and the first call). Read `packages/engine/ARCHITECTURE.md` ("Layout", "Two overlays", "Scene and Ctx") and `docs/engine/refactor-plan.md` Phase 2–3 first.

## Problem
Two overlays, two coordinate systems. `ctx.ui` is the legacy overlay, a 1920×1080 design canvas shrunk by one CSS `scale()` (`createOverlay` default `legacyScale: true`). `ctx.chrome` (`createCssChrome`, `ui/css-chrome.ts`) is a second, CSS-px overlay that is active on phones only, and the legacy `panels` and `toasts` layers are physically moved between the two roots when `active` flips. Desktop and iPad still lay out in design px. Measured on main: 36 `ctx.ui.` references in 12 game files, 12 `ctx.chrome` references.

## Goal
One overlay, in CSS px, on every form factor. `ctx.ui` *is* the CSS-px overlay with the layout on it (phone, tablet, desktop). Delete `createCssChrome`, `CssChrome`, `PHONE_FORMS`, `ctx.chrome`, `legacyScale`, the scaled-root path in `ui/overlay.ts`, and the caption's legacy `avoid()` path. Nothing moves between roots any more.

## Do
1. **Engine.** `createOverlay` builds only the CSS-px overlay; `createGame` gives `ctx.ui` the layout (`ctx.ui.layout` or `ctx.layout`; pick one and say why in the log) on every form factor. One `PanelStack`, `Toaster` and `CaptionCard`, all in CSS px; pad nav, input blocking under a modal and caption suspension keep working. Desktop and tablet get real `LayoutSpec` forms (the defaults exist in `defaultForms`).
2. **World-anchored DOM.** Anything that followed the canvas transform (labels over the world, the hall's alcove labels, any design-px absolute positioning) is positioned through `surface.logicalToClient` (or the layout's `free` escape hatch with a reason). List each one in the log.
3. **Game.** Port every scene's DOM from design px to CSS px with the layout regions: title, hall, altar, settings, journal, codex, ending, and any phone-only branches that now apply everywhere. Desktop and iPad must **look the same as today**: the design sizes become CSS-px tokens scaled for the viewport (use the layout's density tokens and `--tc-text-scale`; a desktop at 1920×1080 should land within a pixel or two of today).
4. **Tests.** Move or rewrite the engine e2e for "two overlays" (`e2e/layout.spec.ts` and any css-chrome spec) to prove the single overlay on the whole matrix: regions, safe area, 44 px taps on touch, modal at 150% text, no element moving roots. Game e2e stays product-only (D-041 add. 2). Delete tests for deleted API.
5. **Docs.** `packages/engine/ARCHITECTURE.md`: remove "Two overlays", rewrite "Layout" today/planned; `packages/engine/CHANGELOG.md` under Next: Removed (`createCssChrome`, `legacyScale`, `avoid()`, `EngineCtx.chrome`) and Changed. Do not touch `device`, `setFill` or `fillBands`; ws/camera deletes those (D-044).

## Done when
- `grep -rn "legacyScale\|createCssChrome\|ctx\.chrome\|avoid(" packages games` finds nothing (except the CHANGELOG).
- `pnpm check`, `pnpm check:boundaries`, `pnpm build` green; `pnpm test:e2e`, `pnpm test:e2e:engine` and `pnpm test:e2e:desktop` green (rerun flakes alone with `--workers=1` and say which).
- `pnpm baseline` passes against the committed v1.0 baselines with **no** `BASELINE_UPDATE`. If a shot differs, look at it, fix it, or explain each remaining diff in the log with before/after paths in `docs/design/screens/local/one-overlay/`. Phones (`SHOTS=one-overlay pnpm exec playwright test tests/e2e/shots.spec.ts`) must look no worse than main.
- Commit to `ws/one-overlay` and never merge. The PM holds it from main until blind review 7 is compiled (D-044). Log here.

## Log

### 2026-11-04: the port (one-overlay agent)

**What changed (engine API).**
- *Removed:* `createCssChrome`, `CssChrome`, `CssChromeOptions`, `PHONE_FORMS` (`ui/css-chrome.ts` deleted); `EngineCtx.chrome`, `CreateGameOptions.overlay`; `createOverlay({ legacyScale })`, `overlay.legacyScale`, `setRect`, `onRect` (the scaled root); `caption.avoid()` and `CaptionOptions.minWidth`; `createLayout` from `./ui` (the overlay builds its own); `PHONE_TAP_MIN` / `PHONE_TEXT_MIN` from `./platform`.
- *Added:* `overlay.layout`, `overlay.units` (`Units`), `overlay.frame`, `setFrame`, `onResize`, a `layout` layer, `FormSpec.units`, `LayoutState.units`, `LayoutHost`, `toFrameUnits`, `UNIT_VAR` (`--tc-unit`), root vars `--tc-frame-x/y/w/h`, `--tc-dpx`, `--tc-zoom`; `caption.onPlace(fn)` and `caption.relayout()`; `CreateGameOptions.layout`.
- One `.tc-overlay` root over the whole container, no transform. `hud` and `captions` sit on the frame (the canvas rect) and clip to it; `layout` covers the root; `panels`/`toasts` sit on the frame in `frame` units (desktop, tablet) and cover the root in `css` units (phones). Every element stays in its layer whatever the form factor (engine e2e "one overlay ..." on the whole matrix proves it).

**ctx.ui.layout, not ctx.layout.** The layout is built by and belongs to the overlay: it owns the layers it draws into, it picks the overlay's units per form, and the overlay re-lays it on `setFrame`. Hanging it off `ui` keeps one owner and one lifecycle, keeps `EngineCtx` from growing a second UI field (the thing D-044 removes with `chrome`), and the engine's own harnesses use the overlay alone without a ctx.

**How desktop and iPad stay the same.** `FormSpec.units = 'frame'` on desktop and tablet: every game sheet (design px) goes through `designSheet` = `toFrameUnits(scaleFontSizes(css))`, so `Npx` becomes `N * var(--tc-unit)`, and `--tc-unit` is `--tc-dpx` (CSS px per design px of the 1920x1080 frame) on the frame's layers. Theme tokens are written the same way in `frame` units. So every box is the old design-px box times the old transform scale, laid out in CSS px instead of transformed. At 1920x1080 (scale 1) this is exactly today (desktop-1080 baseline passes). Native controls whose parts are CSS px (range thumbs/tracks, select arrows) are zoomed by `--tc-zoom` on the frame's layers, with their own px read as design px and the focus ring un-zoomed. Phones (`css` units) keep their CSS-px sheets (`PHONE_ROOT_CSS`, `ALTAR_CHROME_CSS`, `ALTAR_COLUMN_CSS` are not rewritten; the phone base and scene phone sheets are design px on the frame layers and go through `designSheet`).

**World-anchored DOM** (the brief asks for `surface.logicalToClient` or `free`). All of it sits in `ui.layers.hud` (or `captions`), which *is* the frame, so a design point (x, y) is at `dpx(x), dpx(y)` (`ui/frame-units.ts`: `calc(x * var(--tc-unit))`), the same point `surface.logicalToClient` gives, and it follows every resize without JS. JS that measures divides `offset*`/`getBoundingClientRect` by `ui.scale` and takes origins from `ui.layers.hud.getBoundingClientRect()`; inline values are read back with `dpxOf`. No `free` region is used.
- Hall (`ui/hud.ts`): door plates, the next ring and its tag, the nameplate, the hall card.
- Title: the menu regions (origin now the hud layer).
- Altar (`altar-dom`, `altar-place`, `altar-info`, `altar-readout`, `altar-circuit`, `altar-defs`): title, verdict, need and storm labels, gives/needs tags, the tray counts, the turn button, the info tip, circuit charge chips (font via `toFrameUnits(scalePxCss(...))`).
- Altar phone column (`altar-column`): tip, turn badge and turn mark (`dpx`); the head and the caption tail are written in CSS px into layout-layer elements from hud-layer origins (they live in regions, not on the frame).
- Solve scene and solve stub: column vars.
- Journal: the spread and the slips' pull (`translateX(dpx(...))`).
- Ending: the page.
- FUSE (`ui/fuse.ts`, `art/props/fuse-portrait.ts`): the portrait and the caption steering (below).

**FUSE caption: `avoid()` → `Fuse.keepClear`.** The corner/width search moved from the engine's caption into the game's `Fuse` (via `caption.onPlace` + `caption.relayout()`), same order (stay, narrow to 480 design px in ~15% steps, mirrored corner, opposite edge, least overlap). Renamed `keepClear` because the done-when grep forbids `avoid(` anywhere in `games`.

**Commits.** The engine removal (`ctx.chrome`, `setRect`, `avoid`) and every scene's port are coupled: no engine-only or scene-by-scene cut keeps `pnpm check` green (typecheck fails on the first missing API). So the port is one engine+game commit; docs and this log follow in a second.

**Layers are stacking contexts.** With two roots, the CSS-px chrome (panels, toasts) always painted over the scaled root, whatever z-index the hall's phone sheet gives its door plates and nameplate (1 to 3). In one root those z-indexes competed with the panels layer and the plates showed through Settings on phones (first phone shot run). `.tc-layer` now has `isolation: isolate`, so layers paint in DOM order (hud, captions, layout, panels, toasts) and a z-index only orders things inside its own layer. The engine e2e "one overlay ..." puts a `z-index: 99999` element in the HUD and hit-tests the open panel's centre (lifting the HUD's modal `inert` for the look); it fails without the rule.

**Game e2e selectors.** 16 specs found "the scaled overlay" as `.tc-overlay:not([data-units="css"])` and FUSE's card as `... .tc-caption, .tc-caption[data-docked]`. On phones the one root *is* `data-units="css"`, so those found nothing (the first phone shot run failed on them). Now: the frame is `.tc-layer[data-layer="hud"]` (same box as the old scaled root: frame origin, width / 1920 is the scale), the card is `.tc-caption`, `data-phone` is read on `.tc-overlay`, "in a lane" is `closest('.tc-layer[data-layer="layout"]')`, and text sizes are the computed size (CSS px everywhere, no transform to multiply by).

**Fixes found by the baseline run.** The tray counts' `top` was a raw `calc(Npx ...)` (left was frame px, top CSS px: off-screen at 720p and on iPad); circuit chip font and line-height; the journal slip pull; the settings sliders and selects (native parts in CSS px, now `--tc-zoom`).

**Thin borders and small text in CSS px (the two fixes from the e2e run).** Laid out in design px and then scaled, a 1 px border drew at the scale (0.35 CSS px on an SE) and a 13 px line was 37 px snapped and shrunk. Laid out in CSS px, Chrome rounds a border under 1 px up to 1 px, snaps an outline down to whole pixels, and snaps small text's line boxes. Most of that is invisible. It mattered twice:
- *The focus ring* (3 design px, 1.8 CSS px on iPad under the transform) drew at 1 px. In `frame` units the token is now `round(up, …, 1px)` (2 px on iPad and at 720p, 3 px at 1080p, unchanged). The zoomed range/select controls un-zoom it with a hair over, so it does not snap back down.
- *The phone hall's door card* came out 2 px taller (40 vs 37.9 CSS px on an SE). For Roof Array it then missed the gap between the door rows by about a pixel and fell to the bottom strip, under FUSE's caption: `mobile-hall` SE failed "roof-array: FUSE's caption covers the card", every run, and passed on main (checked in a scratch worktree of main). The caption was never told about the card; on main the card was never there. Now `hud.plateBox()` goes into `HallScene.say`'s keep-clear regions on phones, weighted over any door, so the caption keeps off the open card wherever it lands.

**Engine and game e2e that measured the scaled root.** `e2e/surface.spec.ts` compared the canvas with `.tc-overlay` (the old scaled root); the frame is now the HUD layer, so it measures that. `mobile-ending.spec.ts` multiplied `::before` sizes by the old transform scale (the Skip button's 44 px finger target read as 36); computed sizes are CSS px now.

### Baseline (`pnpm baseline`, no BASELINE_UPDATE)

- **desktop-1080: passes** (42 passed). One flaky shot, `altar-splitter-mill-empty` (0.19% on the first try, passed on retry: the animated arc).
- **desktop-720 and iPad: every shot fails at 0.19% to 4.94% of pixels** (86 shots, both tries; the threshold is 0.1%). I looked at the diffs and they are all one kind. Text glyph edges and 1 px borders are rasterized at the scale instead of scaled after layout, plus a 0 to 1 px shift where a box's edge now rounds to a whole CSS px. Layout, sizes, colours and positions match. The largest, `desktop-720/codex` (4.9%) and `journal` (3.2%), are the pages with the most text. Two visible changes:
  - Focus ring: 2 px crisp where it was a soft 1.8 px (above).
  - Native selects: about 3 px wider with a slightly larger arrow. Their text and arrow are drawn by the control in CSS px and zoomed, not transformed.
  
  Re-baselining is the PM's call. Before is `docs/design/screens/v1.0/<project>/<shot>.png`; after and diff are `docs/design/screens/local/one-overlay/<project>/<shot>-actual.png` and `<shot>-diff.png`, for `<project>` in `desktop-720` and `ipad`.

### Phone shots (`SHOTS=one-overlay`, vs main)

17 passed, 1 skipped (desktop altars, skipped by design). Shots are in `docs/design/screens/local/one-overlay/{se,iphone,promax,android,portrait}/`. Each was compared pixel by pixel with the same shots taken on main before the port (`docs/design/screens/local/main-before/`); the diffs are `*.diff-vs-main.png` next to each shot.
- 8 shots are identical: codex on all four, Settings on iPhone, both rotate cards.
- The rest differ by 1 to 3% (hangout on Android: 7%). That is the animated 3D (title portal and orb, door glows, the arc), text antialiasing, and the hangout chat's scroll position at capture time.
- One visible change: the journal's "12 more pages to find" box. Its `1px dashed` border was a blurred 0.4 px line through the scaled root; now it is a crisp 1 device px dashed line, as written.
- Every scene was also checked by eye against `gate7/`: nothing lost or moved.

### Gates (final tree)

- `pnpm check`: green (vitest 346 + 24 + 587 passed, 2 skipped). `pnpm check:boundaries`: ok. `pnpm build`: ok.
- `pnpm test:e2e:engine`: 283 passed, 31 skipped.
- `pnpm test:e2e`: 162 passed, 20 skipped, 1 failed. The failure was `solve-truth` intake-desk solved: the 5-minute test timeout in `waitForFunction`, with other agents' Playwright running at the same time. Rerun alone with `--workers=1`: 17/17 passed. `mobile-hall` and `mobile-ending` were also rerun alone after their fixes: 7/7 passed.
- `pnpm test:e2e:desktop`: 5 + 2 passed.
- `pnpm baseline`: desktop-1080 passes; desktop-720 and iPad fail on rasterization only (above, left for the PM to judge or re-baseline).

**Not done.** The v1.0 baselines are not regenerated (the brief says explain, not update). ws/camera items (`EngineCtx.device`, `setFill`, `fillBands`, `device-mode.ts`, the Camera) are untouched and still work.

### 2026-11-04: merge with main (one-overlay agent)

`git merge main` (merge, not rebase): 133518b. Both sides' behaviour is kept in every conflict.
- `altar-circuit.ts`: both import sets kept. Main's teach-7 "stores N" chips are ported to `dpx()` positions, with `toFrameUnits(scalePxCss(px))` for the font and line height.
- `altar-column.ts`, `altar-readout.ts`: imports conflicted only. The `dpx` import is kept alongside main's altar-defs imports (`ONE_STRIKE_RULE`).
- `altar-phone-styles.ts`: uses main's polish-8 `clamp()` caption tail, under `${ph(':has(.lr-solve[data-phone])')} .tc-caption::after`.
- `altar-place.ts`: main's dense-board-3 `rings()` up/down placement is kept. Its top and margin values are now `dpx()`.
- `chrome-styles.ts`: the `.lr-hud` hide rule and polish-10's title-menu/links hide rule both use `ch(':has(.tc-panel-host[data-modal="true"])')`.
- `mobile-strike.spec.ts`: main's teach-5 pips checks are kept, using the `.tc-overlay[data-phone]` assertion.

Main code that still used the old model, now ported:
- `title-scene.ts` `compact()` read `ctx.chrome`. It now reads `ctx.ui.layout.formFactor`.
- Seven specs found the scaled root as `.tc-overlay:not([data-units="css"])`. They now use `.tc-layer[data-layer="hud"]`: held-gem, shots, dense-board, altar-column, glyph-truth-2, glyph-truth-3 and mobile-teach. dense-board's 14 px floor check reads the computed size directly.

Nothing else needed porting. That covers the Loupe and its dense-board-4 leader (`position: fixed` client px in `body`), hud `data-under-menu` (client rects) and the held ring `--lr-held-d` (layout-layer CSS px).

The grep for `legacyScale|createCssChrome|ctx.chrome|avoid(` finds nothing outside the CHANGELOG. Engine ARCHITECTURE.md now notes that the loupe sits outside the overlay units. A duplicated CHANGELOG line is removed.

Gates:
- `install --frozen-lockfile`, `check` (611 vitest), `check:boundaries` and `build`: all ok.
- `test:e2e:engine`: 283 passed, 31 skipped.
- `test:e2e`: 201 passed, 20 skipped, no flakes.
- `test:e2e:desktop`: 5 + 2 passed.

Baseline (no update): 37 passed, 92 failed.
- desktop-1080 fails on 6 shots (capacitor-bay, control-booth and lift-shaft, each empty and solved, at 0.27–1.40%). The cause is main's own polish-11 Capacitor card copy (8ed49ca). It landed after main's last regeneration (8e5c110), so main fails these too. Cropped cards confirm the only change is the text.
- desktop-720 (0.19–4.94%) and iPad (0.19–3.15%) fail on rasterization only, as logged before the merge.

Diffs are in `docs/design/screens/local/one-overlay/baseline/`.

Phone shots: `SHOTS=one-overlay` gave 17 passed and 1 skipped. I looked at the SE and Android shots at real size: the-last-rune, its aim shot, archive, the archive held shot, roof-array, capacitor-bay and menu. There are no overlaps, clipping or regressions. The shots are in `docs/design/screens/local/one-overlay/`.
