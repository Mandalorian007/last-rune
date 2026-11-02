# Accessibility audit (wave 5)

Audited against alpha-1 (`a4d6825`) in Chromium with WebGPU at 1280×720, keyboard only, with
axe-core 4.x (`wcag2a`, `wcag2aa`, `wcag21aa`, `best-practice`). DOM text contrast was measured
against the rendered pixels, because axe reports contrast over a canvas as "incomplete". The
measurement hides the text, screenshots, and takes the median, 10th and 90th percentile of the
pixels behind each text run. A short screen-reader pass checked what each live region says.

Severity: **S1** blocks or misleads. **S2** hurts clarity. **S3** is polish.
Status: **fixed** on this branch, **open** (proposed or left), or **ok** (checked, no change).

Regression guard: `tests/e2e/a11y.spec.ts` (axe on every screen, focus order, focus after a HUD
panel, Esc from focused buttons, and the altar's live-region text).

## Findings

| # | Area | Finding | Sev | Status |
|---|------|---------|-----|--------|
| 1 | Title | Menu had `role="menu"` with plain buttons as children (axe *critical* `aria-required-children`), so screen readers expected menu items and arrow-key menu behaviour. | S1 | fixed: `role="group"` |
| 2 | Gamepad | Opening Settings (Start) or the Codex (Y) with a pad trapped the player. Game input is blocked while a modal is up, and nothing else read the pad, so B could not close it and the d-pad could not reach the controls. | S1 | fixed: engine `PadNav` |
| 3 | HUD focus | After you click a HUD button (Journal, Codex, Settings) and close the panel, focus went back to the button. Arrows and Enter then went to the button, not the hall. `hud.ts` worked around this by blurring on click. | S2 | fixed in engine; workaround removed |
| 4 | Journal | With a slip or Back focused (Tab), Esc and the arrows did nothing, because the input map ignores keys aimed at buttons. | S2 | fixed: engine `buttonKeys` |
| 5 | Altar | The verdict region was unhidden in the same frame its text changed, so the verdict was often not announced. It was also only the headline, with nothing per machine or per strike. | S2 | fixed: persistent announcer |
| 6 | Altar | Nothing was spoken when the altar opened: no name, storm count or need. The need was drawn on the canvas only. | S2 | fixed: briefing on enter |
| 7 | Hall | A locked door showed what it needed only as coloured socket rings, so the requirement was colour-only. | S2 | fixed: plate reads "Locked · needs Bend, Storm ×2" |
| 8 | Contrast | Altar key hint 3.3:1 over the board glow. | S2 | fixed: brighter text and a soft scrim, now ≥ 6:1 |
| 9 | Contrast | Journal blank slips 2.3:1 and slip numbers 3.3:1. | S2 | fixed: ≥ 5:1 |
| 10 | Contrast | Ending title over the bloom 1.1 to 1.8:1. End-card footer 3.2:1. | S2 | fixed: radial scrim behind the title and a stronger footer gradient, now ≥ 4.5:1 |
| 11 | Contrast | Codex FUSE margin label 3.55:1. Codex and journal folios 3.1 to 4.4:1. | S2 | fixed: ≥ 4.5:1 |
| 12 | Landmarks | No landmark around the game (axe `region`, moderate). | S3 | fixed: `#app` is `<main>` |
| 13 | Journal | `role="listitem"` sat on `<button>`s, overriding the button role (axe minor). | S3 | fixed: group of buttons |
| 14 | Text size | Overlay text is scaled with the 1920×1080 design canvas, so browser zoom doesn't enlarge it. At 1280×720, 18 design-px body text is about 12 CSS px. | S2 | **open**: proposal below |
| 15 | Board | The altar board (gems, lanes, bolt path) exists only on the canvas. A screen-reader user gets the briefing and verdict but can't inspect the board. | S3 | open, out of scope for alpha |
| 16 | Altar | Altar toolbar buttons blur themselves on click so keys keep driving the board. Focus returns to the canvas, which is acceptable, but it isn't visible where focus went. | S3 | open (acceptable) |
| 17 | Codex | A locked page's title reads "— — —" with no accessible name. | S3 | open |
| 18 | Title | The `h1` is gradient `background-clip: text`, so automated contrast can't measure it. By eye it is light gold on near-black. | S3 | ok |
| 19 | Disabled | Undo and Clear at 2.6:1 when disabled. | — | ok (WCAG exempts disabled controls) |

## Keyboard-only path (after fixes)

- **Title**: the canvas has focus at boot, and Enter plays. Tab order is Play, then Settings. Focus is visible (theme ring).
- **Settings**: focus moves into the dialog, Tab is trapped, and Esc closes. Focus returns to the opener: the title's Settings button, or the canvas if the HUD opened it.
- **Hall**: the arrows move between doors, and the name plate shows status and needs. Enter opens a door. J, C and O open the journal, codex and settings.
- **Altar**: as documented in `altar-ux.md`. Esc on a focused toolbar button still means Back.
- **Solve card**: Continue takes focus. Enter continues.
- **Journal**: arrows and Esc work with or without a focused slip.
- **Codex**: Tab cycles nav, pages and close. Esc closes.
- **Ending**: Esc skips on a replay. On the end card, the Tab order is canvas, Join link, "Back to the hall".

## Screen reader (after fixes)

- FUSE lines go through the caption card's sr-only live region.
- Altar open: "Intake Desk altar. Storm ×1 gives 4. The machine needs exactly 4." With several machines or several strikes, the storm part becomes "Storm ×2 gives 8, 2 strikes" and the need becomes "3 machines need exactly 2, 4 and 6."
- After a strike: the verdict headline, then per machine "Machine 2: needs 4, got 6, too much", any fizzled tags, then "Change anything to try again." The region is polite and atomic, and is cleared and refilled so a repeated verdict is spoken again.
- Solve card: a polite status region (unchanged).

## Reduced motion and Reduce flashes: ok

The settings controller carries both through to the bolt, storm, hall lightning, candles, altar
shake, journal page turns, the ending CSS and the solve card. Reduce flashes defaults to the
reduced-motion preference. I found no flash that ignores it.

## Gamepad

Bindings (`game/actions.ts`): A confirm, B cancel, d-pad and left stick move, Y codex, Start
settings, RB rotate, LT undo, X remove, RT strike, Back clear, LB tray. Finding 2 covered the
panels. Outside panels the pad was already complete.

## Colour-only signals

Gems carry glyph shapes as well as colours. The verdict and need text use numbers and words.
Door requirements now use words too (finding 7).

## Proposals for the PM

1. **Text size setting (finding 14).** Add a Settings option "Text size: 100% / 125% / 150%". It
   would set a root CSS variable that the overlay's caption, panel and plate font sizes multiply
   by. I didn't add it here because `ui/settings-panel.ts` is being edited by perf-tiers this
   wave, and the new option would need a save-schema field (`settings.textScale`), which is
   cross-cutting.
2. **Board readout (finding 15).** Later, an optional "describe board" key could put lanes and
   gems into the live region.
