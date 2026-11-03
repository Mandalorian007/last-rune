# scripts/perf: frame-time harness

Playwright drives the dev build through the scenes that matter for performance:

- the title;
- the hall at the start and with everything restored;
- the altar with the Last Rune loaded;
- a big strike;
- the ending at the opening door (`ending-door`) and over the full gold flood with credits
  (`ending-flood`).

It records per-scene frame interval, GPU time and CPU time, then writes JSON. It is not part
of `pnpm test:e2e`.

```sh
PERF_LABEL=high PERF_TIER=high PERF_DPR=2 pnpm exec playwright test -c scripts/perf/playwright.config.ts
```

| Env | Meaning |
|---|---|
| `PERF_LABEL` | Name used in the output file (`<label>-dpr<D>-cpu<C>[-<tier>].json`). |
| `PERF_DPR` | Device pixel ratio (1 or 2). The viewport is 1920×1080 CSS px (`PERF_W`, `PERF_H`). |
| `PERF_CPU` | Chromium CPU throttle rate (for example, 4). |
| `PERF_TIER` | `auto`, `high` or `low`, seeded into the save before boot. |
| `PERF_MS` | Measurement window per scene, in ms (default 3000). |
| `PERF_BREAKDOWN` | Also time each scene with fog, rays and bloom off, and at half resolution. |
| `PERF_SHOTS` | Directory for one screenshot per scene. |
| `PERF_OUT` | Output directory (default `test-results/perf`). |
| `PERF_UNCAPPED` | Turn vsync off. Frame intervals then reflect throughput, not what a player sees. |
| `PERF_TS_EVERY` | Take a timestamp-query sample every N frames (default 4; 0 turns it off). |
| `PERF_BASELINE` | Undo the perf-low changes in the page (no ending pixel cap, Low composites at output resolution) for back-to-back A/B runs. |
| `PERF_LOAD` | Run `load.spec.ts` against a production preview instead (see below). |
| `PERF_RUNS` | Load runs to average (default 3). |
| `PERF_MOBILE` | Phone emulation: 852×393 CSS px at DPR 3, touch, coarse pointer (an iPhone 15-class landscape screen). Emulation changes pixels, DPR, input and media queries; it does **not** make the GPU slower. |
| `PERF_MEM` | Run `mem.spec.ts` instead: decoded audio per sound, live GPU textures and buffers, JS heap, and ten landscape↔portrait flips (fails on a texture leak). Dev server. |

Each scene line reads `frame | gpu | ts | cpu [passes] | scene WxH tier@scale budget MP`.

How the numbers are measured:

- **ts** is GPU time from timestamp queries (`packages/engine/src/render/gpu-timer.ts`), when the adapter
  has `timestamp-query`. The bracket splits it per pass (`scene`, `bloom`, `rays`,
  `composite`, `upscale`, `pre` = compute before the scene). Passes overlap on tile-based
  GPUs, so each pass gets its *marginal* time (end minus the later of its start and the
  previous pass's end); the parts sum to the frame. **Use this column.**
- **gpu** runs from submit to `queue.onSubmittedWorkDone()`. It is a latency, not a cost: it
  includes waiting behind the compositor and any other GPU client. Under contention it reads
  3–8× the `ts` value while frames still land every 16.7 ms. It is kept as the fallback the
  game uses when timestamps are missing.
- **CPU time** runs from `beginFrame` to the return of `endFrame`.

Other GPU work on the same machine inflates every GPU number, including `ts` (the GPU is
time-sliced). Close other headless browsers before you measure, and compare A/B runs taken
back to back.

## Load timing

```sh
pnpm build
PERF_LOAD=1 pnpm exec playwright test -c scripts/perf/playwright.config.ts
```

This serves `dist/` with `vite preview` and reports, per run: time to `lr:gpu-ready` and
`lr:first-frame` (performance marks set in `main.ts` and `game/ctx.ts`), the longest boot task,
then after the first click the audio pre-render time (`lr:audio-ready`), long tasks, the
longest gap between title frames, and the delay of arrow-key presses sent during the
pre-render.
