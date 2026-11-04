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

- **A paused fake clock.** `page.clock.install()` then `pauseAt()`: `Date`, timers and
  `requestAnimationFrame` only move when the spec says so. `performance.now` is derived from
  the fake `Date` (the clock's own carried a few real ms of page-load offset, which shifted
  the fixed-step phase between runs). The game loop steps a fixed 1/60 s.
- **Game time is spent one frame at a time.** `advance()` runs the clock one frame per round
  trip to the page. `until()` gives its condition real time first (boot, the GPU and other
  async work the fake clock does not drive) and only then steps one frame, so the game time
  spent does not depend on machine load. Boot is awaited in real time with the clock still,
  so the loop always starts at the same fake instant.
- **No realtime audio.** `AudioContext` is removed before boot and the engine plays silently
  ("unavailable"). Unlocking audio starts real-time work (context resume, the sound
  pre-render) that interleaved with frames differently on every run.
- **A seeded `Math.random`** (mulberry32) on every page load: lightning, particles, FUSE's
  strolls and chatter repeat.
- **A seeded save** in `localStorage` before boot: graphics **High** (fixed resolution; no
  dynamic resolution or auto-tier decisions taken from GPU timings), full motion, instant
  captions, text 100%, and the progress the scene needs.
- **Shots between lightning strikes** on the title and in the hall, so a frame of jitter can't
  land on a flash that relights the whole room.
- **CSS**: screenshots use `animations: 'disabled'` and hide the caret.
- **Stable page context**: locale en-US, time zone UTC, dark colour scheme, no release label.

What is left is GPU noise. Two renders of the same frame differ by one or two levels on a few
percent of the pixels (fog grain, glows). Now and then a shot also comes out a frame apart in a
small animated part (FUSE's idle pose, a storm orb). The compare absorbs the first with
band-edge slack; the tolerance and one retry absorb the second (see Tolerance).

Baselines are specific to the GPU, driver and browser that made them (the set in v1.0 was
made on Apple Silicon with Metal; BASELINE.md records the machine). Another machine renders
fog, bloom and text antialiasing slightly differently. Compare on the machine that made the
set, or regenerate the set on the new machine from a known-good commit first.

## Format and compare (png.ts, compare.ts)

The set is stored as 8-bit **palette PNGs** (≤256 colours, median cut plus k-means, no
dithering): about a quarter of the size of RGB screenshots.

Playwright's `toHaveScreenshot` can't compare a quantized baseline, so `compare.ts` does it:
the new screenshot is mapped onto the baseline's own palette with the same nearest-colour rule
the update used, and the palette indices are compared. Any visible change (a moved widget, other text, a different
shader or tone) moves pixels to other palette entries and is counted. A change smaller than one
palette step inside a flat area is not seen; that is the cost of the 8-bit set.

On failure, `test-results/baseline/<project>/` gets `<scene>-actual.png` (the raw screenshot)
and `<scene>-diff.png` (changed pixels red over the dimmed baseline); both are also attached
to the test report.

## Tolerance

Three allowances, all measured on repeat runs of an unchanged tree. The numbers are in
docs/design/screens/v1.0/BASELINE.md and the v1-ship log (docs/workstreams/v1-ship.md).

- **Band-edge slack** (`EDGE_SLACK = 8`, an RGB distance; override with `BASELINE_EDGE_SLACK`).
  Sometimes a pixel maps to a different palette entry than the baseline but is within 8 of
  being as close to the baseline's entry. It still counts as unchanged: it sat on the edge
  between two bands and the GPU moved it a level or two. Raw renders of the same hall frame
  differed on 3–6% of their pixels, almost all by 2 levels or less. After palette mapping
  that was 6,000–12,000 changed indices; with the slack it was 1–6. A real change moves
  colours by much more than 8, so it is still counted.
- **Changed-pixel limit** (`MAX_DIFF_RATIO = 0.001`, which is 0.1%; override with
  `BASELINE_MAX_DIFF`). That is about 920 px at 1280×720, 970 px on iPad and 2,070 px at
  1920×1080. Most shots repeat at 0–50 px. A few come out a frame apart in a small animated
  part, at 300–1,600 px. Anything that matters changes tens of thousands of pixels: a moved or
  resized widget, a new panel, another font, a shader or tone change. A single changed short
  word of UI text (about 1,000–1,500 px) may pass at 1080p. So read the per-shot numbers each
  run prints, and use `BASELINE_MAX_DIFF=0` for an exact check.
- **verdict-fail has its own limit of 1%.** Repeat runs differ by up to about 0.5%, in the
  failed strike's smoke over the source and in FUSE's idle pose. This happens even with the
  same game time, frame count and random draws, and the cause wasn't found. 1% still catches
  a changed verdict box, board or layout.
- **One retry** in compare mode. A real change fails twice; a one-off outlier does not.
