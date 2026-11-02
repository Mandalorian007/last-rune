# scripts/perf: frame-time harness

Playwright drives the dev build through the scenes that matter for performance:

- the title;
- the hall at the start and with everything restored;
- the altar with the Last Rune loaded;
- a big strike;
- the ending flood.

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

How the numbers are measured:

- **GPU time** runs from submit to `queue.onSubmittedWorkDone()` (`renderer.timingEvery`). With
  vsync on, the queue is idle at submit, so this is close to the GPU work per frame.
- **CPU time** runs from `beginFrame` to the return of `endFrame`.

Other GPU work on the same machine inflates the GPU numbers. This includes other headless
browsers, so close them before you measure.
