# Decisions

Format: `D-NNN · date · decision · why · who`.

- **D-001** · 2026-11-02 · Art is **fully procedural** (shaders, SDF, generated textures). No hand-painted or third-party art. · Agents can't paint; keeps licensing clean; fits the week. · User
- **D-002** · 2026-11-02 · **WebGPU only**, no WebGL2 fallback. Unsupported browsers get a clear message screen. · Simpler engine; matches pitch. · User
- **D-003** · 2026-11-02 · Repo `Mandalorian007/last-rune` (public). Single repo containing `engine/` + `games/last-rune/` per pitch §6. · User
- **D-004** · 2026-11-02 · Storage is **browser-only** (`localStorage`). The pitch's "Fly volume / Fly boot" is dropped for now. · Public repo, no secrets, static itch hosting. · User
- **D-005** · 2026-11-02 · Discord: **in-game ending only.** FUSE "living in the Discord" is lore. There is no bot. The invite URL is a single config constant, placeholder until provided. · User
- **D-006** · 2026-11-02 · Tooling: **pnpm** (pinned via `packageManager`), TypeScript 7 strict, Vite 8, Vitest 5, Playwright, Biome (lint + format). No npm lockfiles. · Speed, professional grade. · User
- **D-007** · 2026-11-02 · Commits in this repo use the GitHub noreply email, so no personal email appears in public history. · Privacy. · PM
- **D-008** · 2026-11-02 · Minimal runtime deps: **no 3D/game frameworks** (no three.js, pixi, etc.). The engine is our own code on raw WebGPU, per pitch §6. Small pure utilities are allowed with PM approval. · Pitch intent: this week seeds the ThunderClap engine. · PM
- **D-009** · 2026-11-02 · Logical resolution **1920×1080 design space, 16:9 letterboxed**; itch embed 960×540 with fullscreen button. UI text is DOM overlay (crisp, accessible); world is the WebGPU canvas. · PM
- **D-010** · 2026-11-02 · **GitHub Pages is the first release location** (alpha), at `mandalorian007.github.io/last-rune/`, deployed from `main` by GitHub Actions once the alpha is playable. itch.io remains the launch target (M5). Pages saves are separate from itch saves (different origins). · Free HTTPS static hosting; top-level page avoids iframe WebGPU risk; live playtest link. · User
- **D-011** · 2026-11-02 · **No ship date.** Work proceeds milestone by milestone until the goal is met; the pitch's one-week schedule is no longer a constraint. · User direction. · User
- **D-012** · 2026-11-02 · **PM's finish line is the GitHub Pages release (M5).** The itch.io launch is done manually by the user with the PM, using the prepared zip and runbook. · User direction. · User
- **D-013** · 2026-11-02 · Discord invite URL: `https://discord.gg/thunderclap` (single constant in content). · User
- **D-014** · 2026-11-02 · "Always a choice" is enforced in its achievable form: no softlocks, never two consecutive single-door states before the finale, earliest single door after 7 solves, ≥ 90% of states with 2+ doors (tested exhaustively over 293 states). The strict form is provably impossible with single-source capabilities (`docs/design/progression.md` §3). · PM accepted progression-content's proof. · PM
- **D-015** · 2026-11-02 · Pitch lines over 20 words are kept verbatim and shown as multiple caption cards instead of being reworded. `TIP_JAR_URL` stays blank (button hidden) until there's an itch page; on Pages it may later point to itch. · PM
