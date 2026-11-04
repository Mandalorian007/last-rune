# Workstream: layout (Phase 2, parallel with gestures and host-electron, after Gate 1)

Plan: [../engine/refactor-plan.md](../engine/refactor-plan.md), "Phase 2" → ws/layout. Decisions: D-041 (portrait phones are a Phase 2 form factor, user-confirmed; addendum 1 removes phone zoom; addendum 2 makes the engine own platform tests), D-040 (phone budgets).

## Scope
- `packages/engine/src/ui/layout.ts`: `LayoutSpec` and `createLayout(overlay, spec)`.
  - Form factors come from `deviceTraits` plus orientation: `phone-landscape`, `phone-portrait`, `tablet` and `desktop`.
  - The regions are `top`, `left`, `right`, `bottom`, `cardLane`, `captionLane`, `modal` and `fill`. Each one is a CSS grid area with a minimum size and safe-area padding.
  - A widget registers once, naming a region per form factor, and the layout moves it when the form factor changes.
  - There is an escape hatch, `region: 'free'`, which takes an explicit CSS-px rect. Log every use.
- `createOverlay` gains a CSS-px mode, in which the root is the surface rect in CSS px.
  - The current scaled 1920×1080 behaviour stays as `legacyScale: true` and remains the default until the ports land. Every game scene uses it unchanged in this workstream.
- `layout.freeRect` (CSS px) reports the space the UI leaves, for the scene's camera.
- The caption card can be placed in `captionLane` by region. Keep the old `avoid()` path working for legacy scenes. The ports delete it.
- Density tokens on the overlay root: `--tc-text-min`, `--tc-tap-min` (44 on touch form factors) and `--tc-text-scale`. These are already promoted. The base widgets (button, slider, toggle, panel chrome) honour them in CSS-px mode.
- Document it in ARCHITECTURE.md ("Layout") and CHANGELOG.md under `0.2.0-dev (unreleased)`. If the top section is dated, add a new `## 0.2.0-dev (unreleased)` heading.

## Tests
- Unit tests: region assignment per form factor, safe-area padding, `freeRect` maths, and moving widgets on an orientation change.
- An engine e2e harness page has a CSS-px overlay with a widget in each region, across every matrix row including portrait phones.
  - Assert that nothing overlaps, that everything stays inside the safe area, and that tap targets are at least 44 px on touch.
  - Emulate safe-area insets if you can; the workspace log noted this was missing.

## Rules
- Game behaviour is identical: `pnpm baseline` 129/129 (every scene stays on `legacyScale`).
- No game nouns in the engine. pnpm only. Commit to `ws/layout` and never merge.
- The gates are `pnpm check`, `pnpm build`, `pnpm baseline`, `pnpm test:e2e` and `pnpm test:e2e:engine`. All must be green; the CI engine e2e job blocks merges.

## Log
