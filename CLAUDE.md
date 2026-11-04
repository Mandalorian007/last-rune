# CLAUDE.md: working on The Last Rune

Start here: `docs/README.md` → `docs/PLAN.md`, `docs/STATUS.md`, `docs/architecture.md`, `docs/engineering.md`. If you are a workstream agent, your brief is `docs/workstreams/<name>.md`.

Non-negotiables:
- **Intuitiveness matters (D-027).** New players must get the goal, the target and each piece without a manual. Visuals must match the rules exactly. Clear, clean, intuitive UI/UX beats features. Screenshot your work as a first-time player would see it. Save screenshots to `docs/design/screens/local/`, which git ignores; don't commit images (see docs/design/screens/README.md).
- **pnpm only** (never npm/yarn). `pnpm check` and `pnpm build` must pass before you report done.
- TypeScript strict. Biome formats and lints (`pnpm format`).
- `packages/engine/` (`@thunderclap/engine`) has zero game nouns and never imports the game (`pnpm check:boundaries`). The engine tests platform capability; the game tests product only (D-041 addendum 2); `games/last-rune/rules/` is pure TS (no DOM/GPU).
- Public repo: no secrets, tokens, personal emails, or external runtime network calls. Storage is `localStorage` only.
- All art and audio are procedural. No third-party asset files without a PM-approved DECISIONS entry.
- Worktree agents commit to their own branch and never merge to `main`; the PM merges.
- Log progress and decisions in your workstream file; propose cross-cutting decisions to the PM rather than editing `docs/DECISIONS.md` or `games/last-rune/rules/types.ts` yourself.
