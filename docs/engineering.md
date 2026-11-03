# Engineering

## Tooling (D-006)
- **pnpm** (version pinned in `package.json#packageManager`). Never use npm or yarn, and never commit `package-lock.json`.
- **TypeScript 7**, strict, `noEmit` (Vite bundles). Two projects: `tsconfig.json` (browser: engine, games, unit tests) and `tsconfig.node.json` (configs, scripts, e2e).
- **Vite 8** dev server and build (`base: './'` for itch).
- **Vitest 5** for unit tests, colocated as `*.test.ts`.
- **Playwright** for browser/e2e smoke and the automated playtest (`tests/e2e/`).
- **Biome** for lint and format (2-space indent, single quotes, width 100). Auto-format is on (D-024): a checked-in Claude Code hook (`.claude/settings.json`) runs `biome check --write` on every file an agent edits, and `pnpm fix` does the whole repo. CI stays strict (`pnpm check` fails on unformatted code), so run `pnpm fix` before committing anything edited outside an agent.

## Commands
```
pnpm install
pnpm dev            # local dev server
pnpm check          # typecheck + lint + unit tests  ← must pass before any merge
pnpm fix            # format + safe lint fixes + organize imports, whole repo
pnpm build          # typecheck + production build to dist/
pnpm test:e2e       # Playwright (ports in tests/e2e/ports.ts; worktrees auto-offset, or E2E_PORT_OFFSET)
pnpm package:itch   # build + zip for itch upload
```

## Branching and worktrees
- `main` is always green (`pnpm check` and `pnpm build` pass).
- Each workstream agent works in its **own git worktree** on branch `ws/<workstream>`. It commits there and does **not** merge to main. The PM merges back to local `main` and pushes.
- Commit messages: imperative subject ≤ 72 chars, prefixed with the area, e.g. `engine/render: add bloom pass`, `rules: capacitor pulse semantics`, `docs: ...`.
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
the output-resolution composite. Measure with the harness in `scripts/perf/` (see its
README) before and after any visual change that adds full-screen work.

### Budgets per scene
| Scene | Draw calls | Instances | Point lights | Notes |
|---|---|---|---|---|
| Title | 10 | ~20 | ≤ 16 | storm sim + orb |
| Hall (start / all restored) | 14–15 | ~145 | ≤ 16 | restored-alcove glows are added last |
| Altar / big strike | 15–16 | ~190 | ≤ 16 | energised gems add lights |
| Ending flood | 19 | ~150 | ≤ 16 | heaviest particle load |

- **Draws:** keep each scene ≤ 24 draw calls (merge by material; see `engine/render`).
- **Lights:** `MAX_LIGHTS = 16` per light set. `lightBudget.max` (in `art/materials/lights.ts`)
  can cap it lower; no tier does today.
- **Particles:** 32768 capacity per system. Spawning scales by `spawnScale`
  (reduced motion × tier).
- **Passes per frame:** storm sim compute (256², fixed), scene (2 HDR targets), bloom
  prefilter, bloom down/up (≤ 8 levels), god rays, composite. Bloom and rays run at half the
  scene resolution; the composite runs at output resolution.
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

Auto switches to Low for the session when the adapter is a software fallback
(`GPUAdapter.info.isFallbackAdapter`), when the first ~4 s of GPU time predict that even the
0.6 floor would be over budget, or when dynamic resolution sits at its floor over budget
for 4 s. It reads nothing else about the adapter. The DOM UI is always native resolution.

## Dev-only routes
`?scene=<name>` or `?demo=<name>` query params may open dev demos and debug overlays in dev builds (`import.meta.env.DEV`). They must be stripped or inert in production.
