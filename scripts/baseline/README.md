# scripts/baseline: v1.0 desktop baselines

The pixel record of The Last Rune 1.0 on desktop and iPad (D-041 Phase 0). The committed set
lives in [docs/design/screens/v1.0/](../../docs/design/screens/v1.0/), one folder per viewport.
This is the Gate 1 check of the engine refactor: "no pixel change on desktop".

```sh
pnpm baseline                                   # compare every scene with the committed set
pnpm baseline --project=desktop-1080 -g altar   # a subset
BASELINE_UPDATE=1 pnpm baseline                 # regenerate the set, then commit it
BASELINE_MAX_DIFF=0 pnpm baseline               # exact: fail on any changed pixel
```

It is not part of `pnpm test:e2e`. It runs on the dev server (the scenes are reached through
the DEV-only `window.__game` handle).

## What it captures

`scenes.spec.ts`, at 1280×720, 1920×1080 and iPad 1180×820 landscape (touch), all at 1× pixels:

- the title (first visit and returning), the hall (first visit and mid-run), Settings, the
  journal and the codex;
- every altar, empty and with its intended solution placed (not yet struck);
- a fail verdict (Intake Desk struck with nothing placed) and the Furnace solve card;
- the ending's hangout beat (first viewing, after FUSE's "Day 1.") and the end card.

## Determinism (stage.ts)

Each shot boots a fresh page and is set up the same way every time:

- **A paused fake clock.** `page.clock.install()` then `pauseAt()`: `performance.now`,
  `Date`, timers and `requestAnimationFrame` only move when the spec calls `advance()`. The
  game loop steps a fixed 1/60 s, so every shader time, caption timer and fade is the same at
  the moment of the shot. (Without `pauseAt` the installed clock still follows real time.)
- **A seeded `Math.random`** (mulberry32) on every page load: lightning, particles, FUSE's
  strolls and chatter repeat.
- **A seeded save** in `localStorage` before boot: graphics **High** (fixed resolution; no
  dynamic resolution or auto-tier decisions taken from GPU timings), full motion, instant
  captions, text 100%, and the progress the scene needs.
- **CSS**: screenshots use `animations: 'disabled'` and hide the caret.
- **Stable page context**: locale en-US, time zone UTC, dark colour scheme, no release label.

On an unchanged tree on the same machine this gives identical pixels; the compare reports 0
changed pixels.

Baselines are specific to the GPU, driver and browser that made them (the set in v1.0 was
made on Apple Silicon with Metal; BASELINE.md records the machine). Another machine renders
fog, bloom and text antialiasing slightly differently. Compare on the machine that made the
set, or regenerate the set on the new machine from a known-good commit first.

## Format and compare (png.ts, compare.ts)

The set is stored as 8-bit **palette PNGs** (≤256 colours, median cut plus k-means, no
dithering): about a quarter of the size of RGB screenshots.

Playwright's `toHaveScreenshot` can't compare a quantized baseline, so `compare.ts` does it:
the new screenshot is mapped onto the baseline's own palette with the same nearest-colour rule
the update used, and the palette indices are compared. An unchanged render maps to the same
indices, so it diffs at exactly 0. Any visible change (a moved widget, other text, a different
shader or tone) moves pixels to other palette entries and is counted. A change smaller than one
palette step inside a flat area is not seen; that is the cost of the 8-bit set.

On failure, `test-results/baseline/<project>/` gets `<scene>-actual.png` (the raw screenshot)
and `<scene>-diff.png` (changed pixels red over the dimmed baseline); both are also attached
to the test report.

## Tolerance

A shot fails when more than **0.05%** of its pixels changed (`MAX_DIFF_RATIO = 0.0005`, about
460 px at 1280×720 and 1,040 px at 1920×1080). The reasoning, with the measurements, is in the
v1-ship log (docs/workstreams/v1-ship.md):

- Repeat runs on an unchanged tree measured 0 changed pixels, so any tolerance only absorbs
  noise that was not seen in testing (for example a GPU under heavy load from other headless
  browsers).
- It is still well under the smallest change that matters: one changed word of UI text is
  around 1,000–1,500 px of glyph edges, and any layout, colour or shader change is far more.

Use `BASELINE_MAX_DIFF=0` for an exact check.
