# Workstream: mobile-ui (phones: layout and touch)

User (2026-11-03): "Ah I forgot to mention mobile phone support I know ipad is great, but do some due diligence to support the mobile phone as well it's fine if it's horizontal only, but both would be cool". This is now **D-039**; read it first.

## Goal
A first-time player on a phone in landscape can play the whole game by touch alone, from title to end card, and finds it as clear as desktop (D-027). Portrait is a stretch goal.

## Scope
1. **Audit first.**
   - Use Playwright mobile emulation (`hasTouch`, `isMobile`, DPR 3) on the WebGPU Chromium project.
   - Landscape sizes: 667×375 (iPhone SE), 844×390 (iPhone 14), 932×430 (Pro Max), 915×412 (Android).
   - Portrait sizes: the same, rotated.
   - Walk every scene: title, Settings, Codex, journal, hall, all altars (big boards such as archive, control-booth and the last rune), solve card, ending hangout, end card.
   - Note everything that's clipped, too small to read or tap, or keyboard- or hover-dependent.
   - Put the findings table in the log before you fix anything.
2. **Landscape phone layout (must).**
   - Everything fits with no page scroll, and text stays readable (aim for ≥14 CSS px for body text).
   - Big altar boards still read. If a board is too small to tap, choose a clear approach: board zoom/pan, a larger board area with the HUD collapsed, or bigger hit areas than the drawn sockets. Pick the simplest one that is clear to a new player.
   - FUSE's caption, the tray, the verdict, labels and the Strike button must not collide.
   - Reuse the existing layout and avoid systems. Don't fork the scenes.
3. **Touch input (must).**
   - Every action works by touch alone: pick up and place, **turn a gem** (today it's R/Q/scroll/RB, so touch needs a clear on-screen way), remove, undo, clear, Strike, Back, and opening the Codex, journal and Settings.
   - Touch targets are ≥44 CSS px.
   - Hints show touch wording instead of key caps when `lastDevice` is touch. Don't break the mouse, keyboard or gamepad paths.
   - Nothing may depend on hover. Tap-and-hold can show the gem info card.
4. **Phone chrome.**
   - Add `viewport-fit=cover` and respect safe-area insets (notch, home bar).
   - Prevent accidental zoom, pull-to-refresh and text selection.
   - Re-layout on orientation change mid-scene.
   - Add an optional fullscreen button when the Fullscreen API is available (it isn't on iPhone Safari, so hide it there).
   - Inside the itch iframe on mobile, the game must still fit.
5. **Portrait (stretch).**
   - Do it if a scene can be made clear in portrait: e.g. the board on top, tray and HUD below; the hall and title are probably easy.
   - Where it can't be done well, show a friendly in-world "turn your phone sideways" card (FUSE, in his voice) that goes away when the phone is rotated. Never show a squeezed, unreadable layout.
   - Log which scenes support portrait.

## Constraints
- **Out of scope:** perf, DPR and audio. mobile-perf owns those; coordinate through the PM.
- Don't change puzzles or rules.
- New engine code must have no game nouns: touch helpers and safe-area helpers go in engine; wording goes in the game.
- Desktop at 1280×720 and 1920×1080, 100–150% text, must look exactly as before or better. Existing e2e tests must stay green.

## Done when
- The findings table, then what was fixed.
- Screenshots in `docs/design/screens/local/mobile-ui/`, not committed: every scene at 844×390 and 667×375 landscape, plus portrait results.
- A new e2e spec: a touch-only playthrough of intake-desk and one multi-gem altar (with a turn) on an emulated phone, plus a layout-fit check at the phone sizes.
- A short real-device checklist for the user (iPhone Safari, Android Chrome).
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log

### 2026-11-03 · Audit (before any fix)

How: `scripts/playtest/mobile-ui.spec.ts` (Playwright, `isMobile` + `hasTouch`, DPR 3, reduced motion) walks title, hall, Settings, Codex, journal, six altars (intake-desk, relay-tower + a failed strike, archive, capacitor-bay, control-booth, the-last-rune), the solve card, the ending, the hangout and the end card. It saves a screenshot and a DOM audit per scene (text under 14 CSS px, tap targets under 44 CSS px, page scroll, off-screen elements). Screens in `docs/design/screens/local/mobile-ui/<size>/` (not committed). Sizes: 844×390, 667×375 and 390×844.

The root cause of most rows: the game is a fixed 1920×1080 design letterboxed into the screen. On a 375–430 px tall landscape phone, one design px is 0.35–0.40 CSS px, so a 24 px label becomes 8–10 CSS px and a 64 px button becomes 22 CSS px.

| # | Where | Finding | Severity |
|---|---|---|---|
| A1 | Every scene | Overlay text is 5–11 CSS px (body 8–11, labels, kbd caps, chips 5–7). Unreadable at arm's length. | Blocker |
| A2 | HUD (hall, altar, solve) | Codex/Settings/Journal buttons are 63–72×20 CSS px. | Blocker |
| A3 | Altar actions | Undo 49×20, Clear 57×20, Back 54×20, Strike 77×25 CSS px. | Blocker |
| A4 | Altar board | Socket pitch at 375 px tall: 6×4 boards 31–41 CSS px, 8×6 boards (archive, capacitor-bay, lift-shaft, roof-array, control-booth) 25–27, the Last Rune (10×8) 18. A fingertip covers two Last Rune sockets. Tray slots ~32 px. | Blocker |
| A5 | Altar input | Turning is R/Q/scroll/RB only: no touch way to turn a gem. Remove is right-click (dragging off the altar works, but nothing says so). Gem info card shows on hover only. | Blocker |
| A6 | Altar hints | Key caps on every button (C, O, Z, Del, Esc, F), keycaps 1–6 on tray counts, hint line "Click … R or scroll … Right-click", verdict "Try: turn the gem at the red mark (R or scroll)", info card "R or scroll to turn · Click to pick up", turn badge keys. All wrong on a phone. | Major |
| A7 | Touch hover | Touch pointers never "leave", so after a tap the game still thinks the finger hovers there: the held gem's ghost and route preview stay on the last tapped socket. | Major |
| A8 | Settings | Selects and sliders 17 CSS px tall, buttons 23 px, labels 9 px. | Major |
| A9 | Codex | Tabs 14 px tall, Close 20×20, margin notes 7 px, body 10 px. Page turns by swipe don't exist (tabs/arrows only). | Major |
| A10 | Journal | Page list rows 16 px tall, prev/next 23×23, list labels 6–8 px; Back has an "Esc" cap. | Major |
| A11 | Title | Play 130×30, Settings 108×25, coffee link 120×17, Copy link 49×13 CSS px. | Major |
| A12 | Solve card | Continue 130×30; subline and codex note 8–9 px. | Major |
| A13 | Ending / hangout | Skip 108×25 with an Esc cap; chat text 9 px, channel list 6–8 px (it is scenery, but FUSE's posts are the story). | Major |
| A14 | End card | Copy-link buttons 50×14, coffee 136×21, Back 114×25, footer 10 px. | Major |
| A15 | Portrait | The whole game is a 390×219 strip in the middle of the screen. Nothing is readable or tappable. | Blocker (portrait) |
| A16 | Phone chrome | No `viewport-fit=cover`/safe-area handling: on iPhone landscape the home bar (21 px) sits on the tray hint line. No `-webkit-text-size-adjust`, so iOS may inflate text on rotate. No fullscreen option. | Major |
| A17 | Wide phones | 844–932 px wide phones show 75–91 px black bars left and right (the game is 16:9). Not a bug: it keeps the notch clear. Noted only. | Info |
| A18 | Page | No page scroll, no element off screen (apart from sr-only text) at any size. Pinch/double-tap zoom and text selection are already blocked in index.html. | OK |
| A19 | Hall | Alcoves are ~65 CSS px: tappable. A tap opens at once, so the hover name plate is never seen; FUSE still speaks for a locked door. Acceptable. | OK |

### 2026-11-03 · Fixes

Two flags on the overlay root, recomputed live (`ui/device-mode.ts`):
- `data-phone`: set when the overlay scale is under 0.45, which means a phone in landscape. Tablets and desktop never get it. It sets `--lr-text-min` (14 CSS px), `--lr-tap` (44 CSS px) and `--lr-css-px`.
- `data-touch`: set when the last input was a finger. It comes from the engine's `watchPointerKind`; a mouse press or a key turns it off.

All phone CSS is in `ui/phone-styles.ts`, scoped to those flags. Desktop is unchanged.

| # | Fix |
|---|---|
| A1 | Every scaled font size floors at `--lr-text-min` (text-scale.ts), so overlay text is never under 14 CSS px on a phone. |
| A2, A3, A8–A14 | Phone sizes for HUD, altar actions, Settings, Codex, journal, title links, solve card and end card. Every button and link gets an invisible hit area of at least 44 CSS px (a `::before`). The journal slips are the exception: they keep their exact 16 px rows so neighbours don't steal taps, and the big page arrows turn pages instead. In the hall, the HUD moves to the bare floor bottom-left; on the solve card it hides. |
| A4 | Board zoom was not built (open item). Instead, a finger drag aims 56 CSS px above the fingertip, so you can see the socket you're aiming at, and the gem places on release (lift your finger anywhere else and it stays in hand). Tray slots and 6×4 boards are tappable; 8×6 boards are tight; the Last Rune is fiddly. |
| A5 | **Turning by touch:** a docked **↻ Turn** button sits right of the tray, with a small ↻ mark on the gem it will turn. Its target is the turning gem you last placed, or one you long-pressed; otherwise the turning gem in your hand. The mark doesn't take taps, and tapping a gem only ever picks it up (D-029). **Removing:** drag a placed gem off the altar, or use Undo or Clear. **Info card:** a long press (0.45 s) on a placed gem shows its card and selects it for ↻. The held gem's card shows for 2.5 s after you pick it up, then steps aside. |
| A6 | With touch on, key caps hide and the wording changes. Hint: "Tap a gem, then a socket · ↻ turns it". Card tags: "tap ↻ to turn" / "drag off the altar to remove". FUSE and verdict lines say "the ↻ button" instead of "R or Q". The old R/Scroll badge hides. |
| A7 | A finger that has lifted no longer counts as hovering: no ghost or route preview stays behind. |
| A15 | Portrait: a full-screen card in FUSE's voice: "Turn your phone sideways … The building was. Regulation 1." It shows only on a handheld (mobile-perf's `deviceTraits().handheld`) or a touch phone held upright, and goes the moment the phone turns. **No scene supports portrait; every scene shows the card.** |
| A16 | `viewport-fit=cover` with safe-area padding on `#app`, `-webkit-text-size-adjust: 100%`, and tap highlight off. On phones the title has a **Full screen** button. It is hidden where the browser can't go full screen (iPhone Safari; an itch iframe without `allowfullscreen`). Where it can, it also tries to lock landscape. The layout follows resize and orientation changes through the surface's existing resize path. |
| — | In the altar title, the subtitle hides on phones; the storm's Gives card already says it. |

Engine additions (no game nouns): `engine/platform/device.ts` provides `isTouchOnly`, `watchPointerKind`, `isPortrait`, `fullscreenAvailable`, `isFullscreen`, `toggleFullscreen({lockLandscape})` and `watchFullscreen`.

Tests: `tests/e2e/mobile.spec.ts` runs at 844×390 with `isMobile`, `hasTouch` and DPR 2:
- Intake desk by touch only, including Undo.
- Furnace with four Bends turned by ↻.
- A gem in hand turned before placing, plus drag-off removal.
- A fit check at 844×390 and 667×375: no page scroll, text 14 px and up, targets 44 px and up, across hall, Settings, Codex and every altar.
- The rotate card appears when the phone is upright and goes when it turns back.

Screens (local, not committed): `docs/design/screens/local/mobile-ui/{844x390,667x375,390x844}/`. Touch states: `12-altar-relay-tower-touch-held.png` and `12-altar-relay-tower-touch-placed.png`.

### Real-device checklist (for the user)

**iPhone Safari** (landscape, and once from the itch page):
1. Title text reads easily at arm's length. There is no Full screen button (expected on iPhone).
2. Hold the phone upright: the "Turn your phone sideways" card appears. Turn it: the card goes and the title fits with no scroll.
3. The home bar and notch don't cover the tray hint or the buttons.
4. Intake desk: tap a gem, tap a socket, tap Strike, tap Continue.
5. Furnace: place a Bend, tap ↻ Turn, and watch it turn. Long-press a placed gem to see its card. Drag a gem off the altar to remove it.
6. Double-tap and pinch don't zoom. Pull-down doesn't reload. A long press doesn't select text or open a callout.
7. Codex: tabs and Close work. Journal: the arrows turn pages. Settings: the sliders drag.
8. Archive (8×6): you can land a gem on the socket you mean. Note how the Last Rune feels.

**Android Chrome**: all of the above, plus:
9. The Full screen button shows on the title. Tapping it fills the screen and stays landscape. Back exits it.
10. Rotate while in an altar: the layout re-fits with nothing lost.

### Open items
- **Board zoom** for 8×6 boards (25–27 CSS px pitch) and the Last Rune (18 CSS px). Aim-with-lift helps, but a pinch or tap-to-zoom board would be the real fix. This touches altar layout and needs a PM call.
- Text exactly 14 px passes the fit check. Some FUSE captions in the altar are long, so a shorter phone line set could help.
- Nothing is needed from mobile-perf. Their `handheld` trait is reused for the rotate card.
