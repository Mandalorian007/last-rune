# Workstream: cover-final (keep #8, take the page down)

Source: D-043 addendum (user, 2026-11-04): the itch cover is #8 **fuse-portrait** (FUSE by candlelight, with the tagline). Remove the other seven and the hosted `/cover-image/` page.

## Do
1. **Pages no longer serves `/cover-image/`.** Remove `vite build -c vite.cover.config.ts` from the `build` script. Pages uploads `dist/` fresh on every deploy, so the next push takes the URL down. Drop the `cover-image` exclusion and its comment in `scripts/package-itch.mjs`.
2. **Keep only fuse-portrait** in `games/last-rune/cover/covers.ts`. Delete the other seven definitions and every helper, import and constant only they used. Keep the cover's pixels exactly as they are: no changes to its framing, title, tagline or lighting.
3. **`pnpm cover` renders the PNG locally.** Add a `scripts/cover/playwright.config.ts`, modelled on `scripts/baseline/playwright.config.ts`, that reuses the e2e WebGPU launch args. It builds the cover page with `vite.cover.config.ts` into `build/cover-image/` (git-ignored; point `outDir` there) and serves it on its own port. A spec there waits until the cover paints, checks it is 630×500 and not blank, and writes `build/last-rune-itch-cover.png`. Also write a 315×250 copy, `build/last-rune-itch-cover-thumb.png`. Move the smoke checks from `tests/e2e/cover-image.spec.ts` into it, then delete that e2e file; the page is no longer in `dist/`.
4. **Simplify the page to one cover:** in `cover/index.html` and `main.ts`, change the title and copy from "eight candidates" to "itch cover", and update the file header comments. Keep it usable in dev (`pnpm exec vite -c vite.cover.config.ts`).
5. Update the docs that mention the page: `docs/workstreams/cover-art.md` log (one line) and any README or ship docs that point at `/cover-image/`. Don't touch DECISIONS, PLAN or STATUS; the PM does.

## Done when
- `pnpm cover` writes both PNGs. Look at them yourself and confirm the full-size cover matches the old #8.
- `pnpm build` leaves no `dist/cover-image/`.
- `pnpm check` and `pnpm build` are green.
- `pnpm test:e2e` no longer runs a cover test; run `--list` to confirm. You don't need a full e2e run.
- Commit to `ws/cover-final` and never merge. Log here.

## Log

### 2026-11-04: one cover, local only
- `covers.ts` holds only fuse-portrait (`COVER`): the still-life helper is cut down to what it draws (gem, three candles, FUSE, amber wash). The other seven covers, the altar/hall/title scenes, storm and bolt paths and their imports are gone. Same lights, draw order, post, shot, title and tagline.
- The page (`index.html`, `main.ts`) shows one cover, its 315×250 copy and Download PNG. It draws one still frame after the warmup. `Math.random` is seeded (mulberry32, seed 8) on this page only. Without it, FUSE picked a random idle sway and eye-flicker phase on each load, so the old page never drew the same #8 twice. Two loads of the old code differed only around FUSE, by as much as old vs new does. Everything else (title, tagline, gem, candles, wall, fog) matches the old #8 code at the same frame. Two `pnpm cover` runs now give byte-identical PNGs.
- `pnpm cover` uses `scripts/cover/playwright.config.ts` and `cover.spec.ts`. It builds with `vite.cover.config.ts` into `build/cover-image/` and serves on `COVER_PORT` (6290 + the worktree offset, in `tests/e2e/ports.ts`). It checks that the canvas is 630×500 and not blank, that the thumb is 315×250, that Download saves 630×500 and that there are no console errors. Then it writes `build/last-rune-itch-cover.png` and `build/last-rune-itch-cover-thumb.png`.
- `pnpm build` no longer builds the cover page, so there is no `dist/cover-image/` and the next Pages deploy drops `/cover-image/`. The package-itch exclusion is gone and `tests/e2e/cover-image.spec.ts` is deleted (`playwright test --list` shows no cover test). `docs/shipping-itch.md` checklist points at `pnpm cover`.
- `pnpm check` and `pnpm build` are green.
