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

### 2026-11-02: measured, resolution scale, tiers (branch `worktree-agent-ae0a79b4f9d7e8b50`)

**What was done:**
- **Harness:** `scripts/perf/` (Playwright with vsync on). It reports frame interval, GPU time (submit → `onSubmittedWorkDone`) and CPU encode per scene, at DPR 1 and 2, optionally under CPU ×4 throttle. Usage is in the README there.
- **Finding:** the game is **fill-bound**. CPU encode is 0.1–0.2 ms, under 1 ms p95 at CPU ×4. GPU time is the scene pass plus the output-resolution composite. At DPR 2, hall and flood sat at 13–17 ms GPU (flood p95 26 ms), which is right at the 60 fps edge.
- **`engine/render`:**
  - **Resolution:** scene targets are decoupled from the output. `setResolution({maxPixels, scale})` and the pure `sceneSize()` set the scene size; post upscales by UV and the DOM overlay is unaffected.
  - **GPU timing:** `timingEvery` / `onGpuTime`, with no timestamp-query.
  - **`DynamicResolution`:** EMA, drop after 1 s over budget, raise after 3 s under 85% of budget, 1.5 s cooldown, a 20 s burn on a level that bounced, and a `saturated` flag.
- **`engine/post`:**
  - **Quality caps:** `setQuality({maxBloomLevels, raySamples, fogOctaves})`. Ray and fog are energy-compensated so Low keeps the same shaft reach and mist density.
  - **Bug fixed:** the bloom mip chain was reallocated every frame whenever the size clamped the levels.
- **Game:**
  - `game/graphics.ts` `GraphicsController` (unit-tested).
  - Settings → Graphics: Auto / High / Low. It is persisted as optional `settings.graphics` (missing = auto, so old saves load).
  - The `lightBudget` hook lives in `art/materials/lights.ts` and `art/props/lighting.ts`.
  - Tiers, budgets and per-scene draws are documented in `docs/engineering.md` → Performance budget.

**Decisions for the PM:**
1. **Shared files:** `game/save.ts` and `game/settings.ts` were touched (an additive optional field only).
2. **Lights:** Low keeps 16 lights. A cap of 12 measured as noise, and it drops gameplay-significant lights that are added last: energised gems and restored-alcove glows. The hook stays for a future tier.
3. **Storm sim:** stays at 256². It is about 65k px of compute, negligible next to scene fill, and resizing it changes the storm's look.
4. **Auto:** keeps High effects at native resolution with dynamic resolution (floor 0.6). It drops to Low only on a fallback adapter, a bad probe, or 4 s saturated. High is fixed resolution, so "High" means exactly today's image.
5. **Measurement noise:** another agent's headless Chrome shared the GPU during some runs. DPR 2 High was rerun uncontended and matches before: hall-start 14.8 vs 14.7 ms, altar 8.0 vs 7.9 ms. The ending flood at DPR 2 High is GPU-saturated in **both** builds, with about 17–20 ms of work per frame:
   - the submit→done probe then reads queue latency (before 17/26 ms p50/p95, after 68 ms);
   - frames still present at 16.8 ms p95;
   - Auto settles the flood at scale 0.7 (about 10 ms), and Low runs it at 8.8 ms.

**Open:** no timestamp-query timing (`engine/platform/gpu.ts` does not request the feature). The composite still runs at output resolution, which is a floor of about 3.5–4 ms on Low at DPR 1.
