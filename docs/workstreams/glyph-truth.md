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

### 2026-11-04 (glyph-truth agent)
- **1 Inputs in the glyph** (`shaders/gem-wgsl.ts`). One glyph language: a door bar marks a side the bolt comes *in*, and an arrowhead marks *out*. The Split's stem now ends in a wide door bar (a T-foot) at its no-arrow end. The Gate has heavy leads ending in door bars on both input sides, a smaller ring and a longer output stem with its arrowhead. The same SDF draws tray icons, placed gems and built-in gems.
- **2 Badge under the gem** (`altar-column.ts` `placeHead`, `altar-column-styles.ts`, `layout.ts`, `altar-hand.ts`, `altar-view.ts`). The ×N badge is a 13 px pill (13 px type, the phone label floor) centred under its gem, with its top at the glyph's lower edge (`TRAY_COUNT_DROP` = `TRAY_GLYPH_HALF` = 0.38 of the drawn size). To fit with no lost height, the held gem on a phone now rests flat in its slot at slot size, inside its gold ring (`HeldGem.lift` = 0, `TRAY_HELD_SCALE` = 1). It was 1.16× and lifted, which pushed its glyph under the badge above it. The cards' `laneTop` matches main's to within 0.2 px. My first try added ~17 px of tray height, and that overflowed teach-4's cards on SE and iPhone (altar-column spec). The row pitch keeps main's `slot + 8` minimum.
- **Merged main** (teach-4, chrome-polish-4). The only conflict was the `altar-column.ts` imports. `mobile-teach.spec.ts` "used-up gem" now expects the `spent` state (a dimmed copy), not `dim`.
- **3 ×0 = dimmed copy.** There is a new gem state, `spent` (shader state 5): the real icon, desaturated and darkened, with low emissive and no pool or light. It is the same for every kind. Tray gems at ×0 use it (`altar-hand.ts`).
- **4 Capacitor in stock.** The body is less milky and a cooler blue, and the glyph is tinted ice. It reads as available ice, not used-up.
- **5 Calmer holding** (`stone-wgsl.ts` state 7; `LEGAL_RING` is now warm gold). Legal sockets get a thin gold line over the rim with a faint inner keyline, instead of a full cream band. The emissive is cut to 0.04.
- **6 No turn at Strike** (`altar-circuit.ts` `updateGhost`). The board now rests straight gems along the whole `sim.trace` (every strike, including the Capacitor's release), not just pulse-0 hops. This is the same trace as the verdict's `orientAlong` and `solvedLook().hops`.
- **7 Lock** (`stone-wgsl.ts` state 6, `stone.ts`). The padlock pip grew from 0.27 to 0.42 radii. It sits on the collar's lower-right shoulder past the gem edge (centre at (1,1) radii). The collar quad reaches 1.6 radii.
- **Tests:** `tests/e2e/glyph-truth.spec.ts`:
  - On se, iphone, promax and android, Control Booth and Storm Cell II are checked idle and then holding each tray gem in turn. No badge rect may meet any tray gem's glyph box.
  - On capacitor-bay, roof-array, lift-shaft and the-last-rune (intended board, real Strike), the turns before Strike must equal the turns at the verdict. With the old `faceAlong(hops)` this check fails with 8 turns, so it catches the bug.
