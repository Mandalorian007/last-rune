# Workstream: perf-tiers (wave 5)

**Goal:** the game holds 60 fps (or a steady 30 with no hitches) on modest hardware: integrated laptop GPUs and high-DPI screens. Today we have only measured an Apple M-series GPU, and a 4K backing store (DPR 2) already sits at ~33 ms.

**Owns:** `engine/render/` and `engine/post/` (quality and resolution controls, generic only), `games/last-rune/game/ctx.ts` (wiring), the settings "Graphics quality" option in `games/last-rune/ui/settings-panel.ts`, and per-scene quality hooks in `art/` (light counts, particle counts, post passes). Coordinate any visual change with screenshots.
**Don't touch:** puzzle rules, `content/`, altar UX or layout, story copy.

## Deliver
1. **Measure.**
   - Frame-time harness across title, hall (start and end), a big altar strike (last rune), and the ending flood.
   - Run at DPR 1, at DPR 2, and under CPU/GPU throttling (Chromium CPU throttle, a lower internal resolution).
   - Find the top costs per scene: fill rate, post passes, lights, particles.
2. **Dynamic resolution.**
   - Render scale capped by a pixel budget (for example, no more than ~2.1 MP internally by default).
   - Optional automatic drop and recover based on frame time, with hysteresis and no visible pumping.
   - The UI overlay stays crisp because it is DOM.
3. **Quality tiers** (Auto / High / Low) in Settings, saved in `localStorage` through the existing settings.
   - Low trims the expensive things: bloom levels, god rays, fog, light count, particle caps and the storm sim resolution.
   - It must still look intentional.
   - Auto picks a tier from the measured frame time in the first seconds and from adapter info. Don't sniff vendors beyond what WebGPU exposes.
4. **No regressions** on High: screenshots before and after for title, hall, altar and ending.
5. Document the budgets in `docs/engineering.md` (a perf section): draws, lights, particles and passes per scene.

`pnpm check`, `pnpm build` and `pnpm test:e2e` must pass. Report a before/after frame-time table.

## Log
