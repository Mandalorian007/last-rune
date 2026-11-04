# Workstream: glyph-truth (gem glyphs show the rule at phone size)

Source: D-040 addendum 7. Starts after solve-truth merges, because both touch gem rendering. Shots: `docs/design/screens/local/gate6/`.

## Do
1. **Split and Gate inputs are legible at phone size, lit or unlit.** The Split's no-arrow (input) end and the Gate's two input sides must read at about 30 CSS px sockets without the text. Draw them into the glyph itself (an inbound notch or stem with contrast), not as 1–2 px stubs that vanish under glow. Applies to tray icons, placed gems and built-in gems.
2. **Tray ×N badge off the gem.** The badge must not cover any side of the glyph (it currently hides the Split's input end and the Gate's bottom input). Put it beside or below the gem.
3. **×0 is a dimmed copy of the real icon,** the same treatment for every gem kind (today Bend becomes a grey square and others become dark faceted blobs).
4. **Capacitor at ×1 or more looks available,** not pale like the empty look.
5. **Calmer holding state.** While holding, legal sockets are marked, but softer than a full-cream ring on every socket, so the circuit and built-in gems stay readable (`12-archive-held`, `12-the-last-rune-held`).
6. **A straight gem never turns when you press Strike** (left over from solve-truth, see `solve-truth.md`). Before Strike, a straight gem (Channel, Amplify, Capacitor) that the preview doesn't reach rests facing the storm. On Capacitor-release paths (capacitor-bay, roof-array, lift-shaft, the-last-rune), the real strike then reaches it and it turns. Rest it along the run it will carry, from the same rule data `solvedLook` uses, so the board never changes shape at Strike. Add an e2e check: on those altars, the turns before Strike equal the turns at the verdict.
7. **Built-in lock** stays readable at phone size (it's about 6 px on SE today); grow it or strengthen the collar.

## Done when
- A visual check on all four phones (fresh `SHOTS=gate7`) covers Storm Cell II, Foundry, Relay Tower, Control Booth, Archive, The Last Rune and Capacitor Bay. Look at them yourself, zoomed to real size.
- A test asserts that the badge's rect doesn't overlap the icon's glyph box on any phone.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` are green. Run `pnpm baseline` and list intended changes; the PM regenerates.
- Commit to `ws/glyph-truth` and never merge. Log here.

## Log
