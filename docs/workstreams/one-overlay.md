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
