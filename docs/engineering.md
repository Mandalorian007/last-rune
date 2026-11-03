# Engineering

## Tooling (D-006)
- **pnpm** (version pinned in `package.json#packageManager`). Never use npm or yarn, and never commit `package-lock.json`.
- **pnpm workspace** (D-041, `pnpm-workspace.yaml`). The root package (`last-rune`) is the game plus all tooling (Vite, Playwright, scripts, `dist/`). The engine is `packages/engine` (`@thunderclap/engine`), which the root depends on as `workspace:*`. The game imports it only through the package's exports map (`@thunderclap/engine/render`, `/ui`, …); `pnpm check:boundaries` fails on anything else. The engine has its own `tsconfig.json`, `vitest.config.ts` and scripts; run them with `pnpm --filter @thunderclap/engine <script>`.
- **TypeScript 7**, strict, `noEmit` (Vite bundles). Three projects: `packages/engine/tsconfig.json` (the engine alone), `tsconfig.json` (browser: games and unit tests, plus the engine sources they import) and `tsconfig.node.json` (configs, scripts, e2e).
- **Vite 8** dev server and build (`base: './'` for itch).
- **Vitest 5** for unit tests, colocated as `*.test.ts`.
- **Playwright** for browser/e2e smoke and the automated playtest (`tests/e2e/`).
- **Biome** for lint and format (2-space indent, single quotes, width 100). Auto-format is on (D-024): a checked-in Claude Code hook (`.claude/settings.json`) runs `biome check --write` on every file an agent edits, and `pnpm fix` does the whole repo. CI stays strict (`pnpm check` fails on unformatted code), so run `pnpm fix` before committing anything edited outside an agent.

## Commands
```
pnpm install
pnpm dev            # local dev server
pnpm check          # check:engine + check:game  ← must pass before any merge
pnpm check:engine   # engine only: typecheck + lint + unit tests (packages/engine)
pnpm check:game     # game: typecheck + lint (whole repo) + check:boundaries + game unit tests
pnpm check:boundaries  # import-boundary check (scripts/check-boundaries.mjs)
pnpm fix            # format + safe lint fixes + organize imports, whole repo
pnpm build          # typecheck + production build to dist/
pnpm test:e2e       # Playwright (ports in tests/e2e/ports.ts; worktrees auto-offset, or E2E_PORT_OFFSET)
pnpm package:itch   # build + zip for itch upload
```

## Branching and worktrees
- `main` is always green (`pnpm check` and `pnpm build` pass).
- Each workstream agent works in its **own git worktree** on branch `ws/<workstream>`. It commits there and does **not** merge to main. The PM merges back to local `main` and pushes.
- Commit messages: imperative subject ≤ 72 chars, prefixed with the area, e.g. `engine/render: add bloom pass` (the engine area keeps the `engine/` prefix), `rules: capacitor pulse semantics`, `docs: ...`.
- Stay inside your workstream's owned paths (see the brief). If you must touch a shared file (`package.json`, `tsconfig.json`, `vite.config.ts`, `rules/types.ts`), keep the change minimal and **call it out in your final report**.
- New dependencies: devDeps are fine if justified. Runtime deps need PM approval (D-008).

## Definition of done (per task)
1. `pnpm check` and `pnpm build` pass in the worktree.
2. Tests cover the logic (rules and content get thorough tests; rendering gets a smoke test or demo route).
3. Module README or doc updated; the workstream log in `docs/workstreams/<ws>.md` is updated with what was done, decisions, and open issues.
4. No secrets, no personal data, no external network calls at runtime (except the Join ThunderClap Gaming and Ko-fi links, which open only on click; D-013, D-034).

## Performance budget
- 60 fps on an integrated GPU (M1/M2 MacBook Air, Intel Iris Xe) at 1080p fullscreen.
- Initial download < 5 MB zipped (everything is procedural, so it should be far less).
- Time to first frame < 2 s on broadband.
- No per-frame allocations in hot paths (render/sim loops); pool buffers.

### Where the time goes
The game is **fill-bound**. CPU encode is about 0.1–0.2 ms per frame (under 1 ms p95 even
at 4× CPU throttle); almost all GPU time is the scene pass (lit full-screen materials), then
the output-resolution composite. The scene pass is 75–85% of the frame, at ~3.6–4.7 ms per
megapixel on an M4. Measure with the harness in `scripts/perf/` (see its README) before and
after any visual change that adds full-screen work.

**GPU timing.** When the adapter has `timestamp-query`, the renderer samples per-pass GPU
time every `timingEvery` frames (`packages/engine/src/render/gpu-timer.ts`; `renderer.timing.source ===
'timestamp'`). Otherwise it falls back to submit→`onSubmittedWorkDone` latency (`'queue'`).
That latency includes waiting behind the compositor and other GPU clients, so it can read
several times the real cost. Quote timestamp numbers.

### Budgets per scene
GPU ms are timestamp p50 on an Apple M4 (10-core GPU), 1920×1080 CSS viewport (perf-low, after
candle-light). The target for every cell is ≤ 14 ms.

| Scene | Draw calls | Instances | Point lights | GPU High 1× | GPU High 2× | GPU Low 2× | Notes |
|---|---|---|---|---|---|---|---|
| Title | 10 | ~20 | ≤ 16 | 4–5 | 8–10 | 3 | storm sim + orb |
| Hall (start / all restored) | 14–15 | ~145 | ≤ 16 | 8.5–9.7 | 15–20 (over; Auto's dynamic resolution brings it to ~10–11) | 6.5–7 | restored-alcove glows are added last |
| Altar / big strike | 15–16 | ~190 | ≤ 16 | 4.5–6 | 7–9 | 2.5–3.3 | energised gems add lights |
| Ending door / flood | 19 | ~150 | ≤ 16 | 7.6–9 | 10.7–12.2 (scene capped at DPR 1) | 5.6–7.6 | heaviest scene per pixel; particles |

Estimated for weaker GPUs from throughput ratios (see `docs/workstreams/perf-low.md`):
- **Intel Iris Xe:** ~2.5–3× the M4. Holds 60 fps at 1080p on Auto, with the scene at ~0.6–0.7 scale, or on Low.
- **AMD 680M:** ~1.3–1.6×. Runs High at 1080p.

Time to first title frame is ~0.1–0.16 s (production build). The audio pre-render after the
first click takes ~1–1.9 s and yields every 8 ms, so the title keeps animating. Input is never
blocked for more than ~90 ms, the length of the longest single-sound synthesis task.

- **Draws:** keep each scene ≤ 24 draw calls (merge by material; see `packages/engine/src/render`).
- **Lights:** `MAX_LIGHTS = 16` per light set. `lightBudget.max` (in `art/materials/lights.ts`)
  can cap it lower; no tier does today.
- **Particles:** 32768 capacity per system. Spawning scales by `spawnScale`
  (reduced motion × tier).
- **Passes per frame:** storm sim compute (256², fixed), scene (2 HDR targets), bloom
  prefilter, bloom down/up (≤ 8 levels), god rays, composite. Bloom and rays run at half the
  scene resolution. The composite runs at output resolution, except on Low
  (`PostQuality.compositeAtScene`): when the scene is smaller than the backbuffer, Low
  composites at scene resolution and a 1-tap bilinear `upscale` pass fills the output.
- **Ending cap:** the ending caps scene pixels at the CSS pixel count (DPR 1) for its whole
  run (`GraphicsController.capPixels`). This is a no-op at 1× and halves the fill at DPR 2.
- **GPU target:** 14 ms per frame (headroom under 16.7 ms), which dynamic resolution steers to.

### Graphics quality tiers (`game/graphics.ts`, Settings → Graphics)
| | High | Low | Auto (default) |
|---|---|---|---|
| Scene pixel budget | 2560×1440 | 1280×720 | High's |
| Dynamic resolution | off (fixed) | on, floor 0.6 | on, floor 0.6 |
| Bloom levels | 8 | 5 | High's |
| God-ray samples | 64 | 32 | High's |
| Mist fbm octaves | 5 | 3 | High's |
| Point lights | 16 | 16 | 16 |
| Particle spawn | 1× | 0.5× | 1× |
| Composite resolution | output | scene (+ upscale) | output |

Auto switches to Low for the session when the adapter is a software fallback
(`GPUAdapter.info.isFallbackAdapter`), when the first ~4 s of GPU time predict that even the
0.6 floor would be over budget, or when dynamic resolution sits at its floor over budget
for 4 s. It reads nothing else about the adapter. The DOM UI is always native resolution.

**Phones (D-039, mobile-perf).** On a handheld (coarse pointer and a screen whose short side
is ≤ 600 CSS px; `deviceTraits()` in `packages/engine/src/platform/environment.ts`) Auto starts on Low
(`autoReason` `handheld`). Tablets and desktops are unchanged. On Low with dynamic resolution
(Auto→Low, or Low), if the scale sits at its 0.6 floor over budget **and** the median frame
interval is over 20 ms for 4 s, the game caps itself at a steady 30 fps for the session
(`GameLoop.maxFps`) and doubles the GPU budget, so resolution can climb back. Changing the
Graphics setting lifts the cap. Desktop High and Auto never reach this rule at 1080p on any
GPU that holds Low at 60. Details, sources and the real-device checklist:
`docs/design/mobile.md`.

## Dev-only routes
`?scene=<name>` or `?demo=<name>` query params may open dev demos and debug overlays in dev builds (`import.meta.env.DEV`). They must be stripped or inert in production.
