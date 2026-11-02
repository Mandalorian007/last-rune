# Engineering

## Tooling (D-006)
- **pnpm** (version pinned in `package.json#packageManager`). Never use npm or yarn, and never commit `package-lock.json`.
- **TypeScript 7**, strict, `noEmit` (Vite bundles). Two projects: `tsconfig.json` (browser: engine, games, unit tests) and `tsconfig.node.json` (configs, scripts, e2e).
- **Vite 8** dev server and build (`base: './'` for itch).
- **Vitest 5** for unit tests, colocated as `*.test.ts`.
- **Playwright** for browser/e2e smoke and the automated playtest (`tests/e2e/`).
- **Biome** for lint and format (2-space indent, single quotes, width 100).

## Commands
```
pnpm install
pnpm dev            # local dev server
pnpm check          # typecheck + lint + unit tests  ← must pass before any merge
pnpm build          # typecheck + production build to dist/
pnpm test:e2e       # Playwright
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
4. No secrets, no personal data, no external network calls at runtime (except the Discord link the user clicks).

## Performance budget
- 60 fps on an integrated GPU (M1/M2 MacBook Air, Intel Iris Xe) at 1080p fullscreen.
- Initial download < 5 MB zipped (everything is procedural, so it should be far less).
- Time to first frame < 2 s on broadband.
- No per-frame allocations in hot paths (render/sim loops); pool buffers.

## Dev-only routes
`?scene=<name>` or `?demo=<name>` query params may open dev demos and debug overlays in dev builds (`import.meta.env.DEV`). They must be stripped or inert in production.
