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
