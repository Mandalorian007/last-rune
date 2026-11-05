# The Last Rune

> Runes are gemstones that carry lightning. Set them into a carved stone altar so a captured bolt flows from the storm cell to a dead machine at exactly full charge.

A short (~1 hour) gem-circuit puzzle game for the browser, built on raw **WebGPU**. Sixteen machines, six gems, one forty-year-old foreman robot named FUSE. Free to play at https://mandalorian007.github.io/last-rune/. First game on the [ThunderClap engine](https://github.com/Mandalorian007/thunderclap-engine), and the game that started it.

## Run locally
Requires Node ≥ 22, pnpm (version pinned in `package.json`), and a WebGPU browser (Chrome/Edge 113+, Safari 26+).

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm check      # typecheck + lint + tests
pnpm build      # production build → dist/
```

## Layout
- `packages/engine/`: the ThunderClap engine, `@thunderclap/engine` (no game-specific code; see its `ARCHITECTURE.md`)
- `games/last-rune/`: the game: rules, content, scenes, procedural art, shaders
- `docs/`: plan, status, decisions, design specs, architecture

All art and audio are generated procedurally in code.

## License
MIT. See [LICENSE](LICENSE).
