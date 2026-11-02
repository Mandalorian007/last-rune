# Workstream: first-altar (wave 5, top priority)

**Why:** first user playtest of alpha-1, at the intake desk (the very first puzzle):
> "The goal of get the power to the target was unclear as I didn't know what the target was, how to place and then the purple indicator had a shape on it I followed, but the lighting actually went the other way. The flow was confusing for a new user and we should address this first."

The PM fixed the glyph mismatch in 811f25c: the Bend glyph was a quarter-turn off from the rules and had a one-way arrow. The rest is yours.

**Goal:** a brand-new player at the intake desk understands, without reading a manual:
1. **The goal:** the storm makes power, the machine needs power, and you connect them with gems.
2. **Which thing is the target,** and what "Needs 4" means.
3. **How to place:** pick a gem from the tray, put it in a socket, and see it is part of the wire.
4. **What the purple Bend does:** it turns the bolt, and its drawing shows which way.

Then they strike and succeed, and the next altars build on that understanding.

**Owns:** `games/last-rune/scenes/altar/` (first-time flow, hints, layout, previews, labels), the altar parts of `games/last-rune/ui/`, the gem glyphs in `games/last-rune/shaders/gem-wgsl.ts` (legibility only; they must match `docs/design/rules.md`), the intake-desk FUSE lines in `content/lines.ts` (keep FUSE's voice and keep `docs/design/script.md` and `pitch-v0.3.md` in sync; tests enforce this), and `tests/e2e/` for what you change.
**Don't touch:** puzzle rules or data (intake-desk's layout is fixed), the hall, perf and post, the ending.

## Deliver
1. **Diagnose.**
   - Play intake-desk fresh, as a new player, by mouse and by keyboard, at 1280×720 and 1920×1080.
   - Screenshot every step and write down every moment a newcomer would not know what to do.
   - Look at what the tutorial already does (`hints.ts`, the teach and nudge lines, the lit sockets, the "Needs" labels).
2. **Design** a short first-time flow, at most 3 or 4 beats. It must stay light, with no wall of text, and FUSE stays dry. Ideas to consider, not requirements:
   - The storm and the machine are labelled and linked the first time ("Storm → power", "Machine: needs 4").
   - A ghost wire or dotted path shows that the bolt has to reach the machine.
   - The first socket to fill pulses, and the tray gem pulses until it's picked.
   - Each placed gem lights the wire as far as it reaches (a live preview).
   - The Bend's turn is shown by the bolt preview, not only by the glyph.
   - Strike is highlighted only when the wire reaches the machine.
3. **Glyph legibility:** gem glyphs, the Bend above all, must be readable at 1280×720. Today the Bend's glyph is small and faint. Gem identity and direction must not rely on colour alone (see the a11y audit).
4. **Check the other gems' glyphs** against `rules.md` on screen: Gate (crane), Split, Amplify, Capacitor. Fix any mismatch.
5. **Measure:** play intake-desk with the novice bot or the full-run harness and confirm it still passes. Also take a "fresh eyes" screenshot sequence, step by step, and put it in your log.

The UI must stay clear, clean and intuitive. `pnpm check`, `pnpm build` and `pnpm test:e2e` must pass, including `full-run`, `a11y` and `altar`.

## Log
