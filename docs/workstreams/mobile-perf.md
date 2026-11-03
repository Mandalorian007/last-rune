# Workstream: mobile-perf (phones: GPU, memory, audio, platform)

User (2026-11-03) wants phones supported, landscape at least (**D-039**; read it first). mobile-ui owns layout and touch. This workstream owns making phones *run* well and fail gracefully.

## Scope
1. **WebGPU on phones.**
   - Check, with sources, which phones and browsers have WebGPU on by default today: iOS/iPadOS Safari versions, Android Chrome versions and GPU requirements.
   - Make sure the "no WebGPU" screen is friendly and readable on a phone, and says what to try.
   - Record the support matrix in `docs/shipping-itch.md` or a new `docs/design/mobile.md`.
2. **GPU budget.**
   - Phones have high DPR (3), small batteries, thermal throttling and tiled GPUs.
   - Make Auto choose a phone-appropriate tier on first run: cap DPR (e.g. ≤2, or scene-res scaling), prefer Low-ish post on coarse-pointer or small-screen devices, and let DynamicResolution react to thermal slowdown.
   - Use the existing perf-tiers / DynamicResolution / GPU timers. Don't build a new system.
   - Measure with `scripts/perf` under mobile emulation plus CPU/GPU throttling, and log the numbers. Target 60 fps where possible, and a steady 30 rather than a jittery 45.
3. **Memory.**
   - Decoded audio is about 52 MiB, plus GPU textures. iOS kills tabs that use too much.
   - Measure the total footprint. If it's risky for phones, reduce it on phones only, e.g. a lower sample rate or mono for ambience/pads, or rendering some sounds lazily. The desktop sound must stay identical.
   - Log the before and after.
4. **Audio on phones.**
   - iOS: the AudioContext unlocks on the first touch (check `touchend` and `pointerup`). Audio resumes after the app is backgrounded or after an interruption such as a call or Siri. Mention the silent switch in the log.
   - Android: resumes after the tab is backgrounded.
5. **Lifecycle.**
   - Pause cleanly on `visibilitychange` and `pagehide`, and resume.
   - Saves flush before the page is backgrounded or frozen, since iOS can kill the tab without warning.
   - Survive device loss and restore (mobile GPUs lose devices more often).
   - Survive orientation changes without leaking resources.

## Constraints
- **Out of scope:** layout, touch input and wording (mobile-ui). Settings UI layout changes go through mobile-ui. You may add a setting value if needed and tell the PM.
- Engine changes must have no game nouns.
- Desktop perf, image quality and sound must stay identical on High and Auto at 1080p. Re-run the desktop baseline to prove it.

## Done when
- The support matrix, with sources.
- Mobile-emulation perf and memory numbers, before and after.
- Lifecycle e2e coverage: hide/show and pagehide flush the save; audio resumes.
- A short real-device checklist for the user covering perf, audio, backgrounding and battery/thermal over 10 minutes.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log
