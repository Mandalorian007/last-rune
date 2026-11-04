# The Last Rune v1.0: desktop baseline

This is the pixel and timing record of 1.0 on desktop and iPad (D-041 Phase 0). It is the
reference for Gate 1 ("no pixel change on desktop"). The tooling, the determinism rules and the
tolerance are described in [scripts/baseline/README.md](../../../../scripts/baseline/README.md).

Made on 2026-11-03 from `ws/v1-baselines` after the content freeze merge. That tree includes
mobile-7-teach and zoom-removal; the engine is still at `engine/`.

## Machine and browser

| | |
|---|---|
| Machine | Apple M4 (10 cores), 24 GB, macOS 27.0.1 |
| GPU path | WebGPU on Metal (`--enable-unsafe-webgpu --use-angle=metal`), headless |
| Browser | Chromium 156.0.8078.4 (Playwright 1.64.1) |
| Node / pnpm | 25.2.1 / 10.27.0 |
| Settings seeded | graphics High (fixed resolution), full motion, instant captions, text 100% |

The set only compares cleanly against the same GPU, driver and browser. On a new machine,
regenerate it from a known-good commit first.

## The set

There are 129 palette PNGs (8-bit, 256 colours or fewer, at 1× pixels), 43 shots per viewport.
Together they total 34.1 MiB (35,787,835 bytes).

| Folder | Viewport | Files | Size |
|---|---|---|---|
| `desktop-720/` | 1280×720 | 43 | 9.1 MiB |
| `desktop-1080/` | 1920×1080 | 43 | 17.0 MiB |
| `ipad/` | 1180×820 landscape, touch | 43 | 8.2 MiB |

The 43 shots in each folder:
- `title` and `title-continue`
- `hall-first` and `hall-mid`
- `settings`, `journal` and `codex`
- `altar-<machine>-empty` and `altar-<machine>-solved` for all 16 machines
- `verdict-fail` and `solve-card`
- `ending-hangout` and `end-card`

## Repeatability (unchanged tree, same machine)

| Run | Result | Shots at 0 px | Largest change |
|---|---|---|---|
| Regenerate (`BASELINE_UPDATE=1`) | 129 passed (3.9 min) | | |
| Compare 1 | 128 passed, 1 flaky (passed on retry) | 92 | verdict-fail 1,318 px (0.14%); others 147 px or less |
| Compare 2 | 126 passed, 3 flaky (passed on retry) | 88 | verdict-fail 3,361 px (0.16%); others 62 px or less |
| Compare 3, final settings | **129 passed** (3.9 min) | 79 | verdict-fail 4,446 px (0.48% of 1%); others 617 px or less (0.03%) |

In every compare, every shot apart from verdict-fail and solve-card changed by 0–61 px.
verdict-fail now has its own 1% limit (see the README for why). Compares 1 and 2 ran before
that limit was set.

## Full-run e2e (`pnpm test:e2e tests/e2e/full-run.spec.ts`)

A production build, keyboard only, solves all 16 machines: 6 passed in 3.1 min.

| Test | Time |
|---|---|
| machines 1–4 (intake-desk, furnace, conveyor-a, splitter-mill) | 35.9 s |
| machines 5–8 (storm-cell-2, press-unit-4, boiler-room, relay-tower) | 39.1 s |
| machines 9–12 (foundry, crane, capacitor-bay, archive) | 48.0 s |
| machines 13–16 (roof-array, lift-shaft, control-booth, the-last-rune) | 58.1 s |
| all 16 end solved, save survives a reload | 0.9 s |

## Perf harness

The command was
`PERF_LABEL=v1 PERF_TIER=high PERF_DPR=1 pnpm exec playwright test -c scripts/perf/playwright.config.ts perf.spec`.
It ran at 1920×1080 CSS px, DPR 1, tier High, with vsync on. Times are in ms.

| Scene | frame p50 / p95 | GPU p50 / p95 | timestamp p50 / p95 | CPU p50 / p95 | draws |
|---|---|---|---|---|---|
| title | 16.7 / 16.7 | 8.1 / 10.5 | 6.36 / 8.38 | 0.1 / 0.2 | 10 |
| hall-start | 16.7 / 16.7 | 11.2 / 12.1 | 10.12 / 10.73 | 0.1 / 0.2 | 15 |
| hall-end | 16.7 / 16.8 | 10.4 / 12.0 | 9.28 / 11.01 | 0.1 / 0.2 | 14 |
| altar | 16.7 / 16.7 | 8.1 / 12.1 | 5.71 / 7.10 | 0.2 / 0.3 | 15 |
| strike | 16.7 / 16.7 | 7.9 / 17.1 | 6.03 / 7.81 | 0.2 / 0.3 | 17 |
| ending-door | 16.7 / 16.7 | 12.6 / 13.2 | 10.41 / 11.68 | 0.2 / 0.3 | 20 |
| ending-flood | 16.7 / 16.7 | 10.8 / 11.4 | 9.33 / 9.99 | 0.2 / 0.3 | 20 |

Every scene holds 60 fps at p95. This was a shared machine with other agents' headless
browsers running, so treat the GPU numbers as an upper bound.
