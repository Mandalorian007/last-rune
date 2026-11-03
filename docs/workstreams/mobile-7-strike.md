# Workstream: mobile-7-strike (Strike and the verdict read at a glance)

Gate review 4 failed at 6.4 (D-040 addendum 5). Evidence is in `docs/design/screens/local/mobile-2/gate4/*/13-the-last-rune-verdict.png`, `13-relay-tower-verdict.png` and `20-solve.png`.

## Scope
1. **Multi-strike verdict.** No "Strike 1:0 2:0" notation, and no chip that grows into a tower. Gauge chips stay compact: "Needs 20 · got 0". Put per-strike detail in the right-column verdict in plain words, e.g. "Strike 1: 0 · Strike 2: 0. Needs 20 in one strike." Use one format for every gauge.
2. **The Strike button says what will happen.** It is ≥56 px tall, inset from the screen edge on every phone, and its label stays on one line. For multi-strike altars use "Strike (2 left)" → "Strike again" → "Try again" after a fail. Avoid ambiguous "2 of 2". Show a ready glow when every gauge is reached (see 3).
3. **Pre-strike reach lamp.** Each gauge shows only whether the charge path currently reaches it: a lamp lit or unlit, never numbers. It must agree with the existing path preview. Add a unit test that the lamp state equals path reachability. This must not reveal amounts.
4. **The red mark** is a thick ring (≥3 px) with a slow pulse, high contrast on navy.
5. **The solve card** doesn't cover the gauges or the finished circuit; move or shrink it on phones. FUSE's bubble doesn't crowd Continue.
6. **"Empty socket: charge lost"** gets a plainer headline, e.g. "The charge hit an empty socket", with the cause and the fix together.

## Ownership
Verdict layout, Strike button, gauge chips and lamps, and the solve card. Keep `altar-scene.ts` edits scoped; mobile-7-teach owns tips and teach cards, and mobile-7-zoom owns zoom.

## Rules
- Phones first: iphone 844×340 (47 px insets), se 667×320, promax 932×380 (59 px insets), android 915×360. Desktop and iPad may not regress; show a 1920 before/after if you touch them.
- `engine/` has no game nouns, and `rules/` stays pure. Use pnpm only. Propose changes to `types.ts`, the save schema or DECISIONS to the PM; do not edit them.
- Captures go to `docs/design/screens/local/` (git-ignored, never committed). Use the existing specs: `M2_TAG=<tag> M4_TAG=<tag> pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2 pm-review mobile-4-chrome`.
- Review your own captures as a first-time player asking "is this a highly polished, intuitive, mobile-supported interface?" before you report.
- Commit to your own branch `ws/<name>`. Never merge to main. Log what you did, and any larger issues left open, in this file.

## Done when
- Every scope item is fixed on all four phones, verified in your captures, and covered by an e2e or unit assertion where it can be measured.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` are green.
- The log lists what you changed and gives capture paths.

## Log

