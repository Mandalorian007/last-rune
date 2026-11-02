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

### 2026-11-02: diagnosis, flow, glyphs (first-altar agent)

**Diagnosis** (fresh play, mouse and keys, 1280 and 1920; `scripts/playtest/first-altar.spec.ts`):
1. The storm had no label. "Storm ×1" sat beside "Needs 4", so the units did not match and nothing said the storm *gives* 4.
2. Nothing marked the machine as the target, and nothing linked the storm to it.
3. The how-to arrived late in a FUSE line; the controls line is tiny.
4. The route preview was off while teaching, so placing gems drew no wire. The Bend card's "two joined sides" did not say *which* sides.
5. The Bend glyph was tiny and faint, and its cushion cut read as a cube, not a turn.
6. Strike was always gold, so it gave no sign of when the wire was ready.
7. The Channel in hand was vertical while placed Channels lay horizontal.
8. The fizzle verdict already worked well and is unchanged.

**Glyph/rules mismatches found and fixed** (checked in `scripts/playtest/glyphs.spec.ts` with zoomed crops):
- The Split's cut apex pointed along the flow, and the tip clipped at the cell edge. It now points at the input and sits inside the cell.
- `orientAlong` turned direction-free gems by the *outgoing* hop, so a Split looked fed from the wrong side. It now uses the incoming hop (`faceAlong`).
- In edit mode, Channel, Amplify and Split faced the storm, not the real flow. They now face the previewed route; unreached gems rest.
- Bend: was a corner-hugging arc; now a centred L with door ticks on its two joined sides (rot 0 N–E, as rules §4 says). Lines are thicker (lw 0.13), with a dark halo, and facet edges no longer cross a glyph.
- Gate (W/E in, N out with an arrowhead), Amplify (chevrons), Channel and Capacitor match rules.md; their legibility is improved by the same halo and line weight.

**Flow (intake-desk only, while unsolved):**
1. *Goal.* A "Gives 4" card on the storm twins the machine's "Needs 4". The storm and machine conduits breathe in storm blue, and the entry socket and the machine's exit socket glow gold.
2. *Take.* The tray Channel bobs. The FUSE arrive line gives the how-to ("Take a rune from the tray, set it on a lit socket.").
3. *Place.* From the first gem on, the live route preview and open-end marks show the wire's reach. Violet stubs show the Bend's two joined sides (S and W), from the first look until the first strike. Glyphs turn to face the real flow.
4. *Strike.* The Strike button pulses only once the route reaches the machine (static glow under reduced motion).

Every altar now reads `Storm ×N gives M` (subtitle and screen-reader briefing). FUSE lines are unchanged.

**Screens:** before: `scratchpad/before/{mouse,keys}-{1280,1920}/`; after: `scratchpad/after/...` (frames 04 arrive → 08 held → 12 placed-3 → 14 placed-5, strike ready → 17 verdict → 18 solve); glyph crops: `scratchpad/glyphs-{before,after}/crops/`. These are session-scratch paths; re-run the two playtest specs with `PLAYTEST_OUT=<dir>` to regenerate.

**Measured:** `pnpm check` (620 tests), `pnpm build`, and `pnpm test:e2e` (18/18: full-run, a11y, altar, ending) all pass. The fresh-play spec solves intake-desk by mouse and by keys at both sizes.

**For the PM:**
- Extend the storm "Gives N" card to every altar? It needs a label-collision audit, first on east/west storms.
- Strike-ready pulse on every altar, not just the first?
- The codex/tray Bend wording "two joined sides" could name the sides visually; that is a content change outside my scope.
