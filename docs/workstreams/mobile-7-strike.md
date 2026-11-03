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


### 2026-11-03: all six items, phones only (desktop and iPad untouched)
1. **Multi-strike verdict.** On phones a gauge card is always "Needs N · got M" (one line N/S, two lines in an E/W gutter). The per-strike chips and the "Strike 1: 2:" lead are gone. The verdict is a plain headline ("Breaker tripped", "Not enough charge"), then a line from `strikesLine` in `strike.ts`: "Strike 1: 0 · Strike 2: 16. Needs 8 in one strike.", then the Try line. On phones the Capacitor story is dropped from the verdict because the lane's Capacitor read-out already tells it. Under a verdict, that read-out now waits for room.
2. **Strike** is one line from `strikeLabel`. Before the strike it reads "Strike (2 left)", "Strike (1 left)" mid-run, "Strike again" on the last strike and "Try again" after a fail. A single-strike altar reads "Strike". It is 58 CSS px tall and 12 CSS px inside the right edge. The "×2 / 1 of 2" sub-label is hidden. A stronger glow (`data-ready`) shows when every lamp is lit. Wider Strike plus a tall verdict meant they collided on the SE, so when the verdict reaches Strike, Strike now steps out (`data-yield`) until the verdict clears with any tap.
3. **Reach lamps.** `scenes/altar/reach.ts` has `gaugeReach` (preview hops or any strike's trace reaching the gauge) and `allReached`. `updateCircuit` and Strike's ready glow use them. Before Strike each phone gauge card leads with a lamp: dark and hollow, or lit cyan. `reach.test.ts` checks that lamp state equals the rules' reachability for every prefix of every intended solution, and that a preview hop onto a gauge always lights its lamp.
4. **Red mark.** A new socket state `fault` (id 8, `stone.ts` and `stone-wgsl.ts`). It is a solid red band from 0.9 to 1.24 radii with dark keylines either side and a halo that breathes over about 3 s. On phones the root socket the Try line names gets it; other fizzles keep the thin ring.
5. **Solve card.** Measured: it covers no gauge and no gem on furnace, capacitor-bay or the-last-rune, on all four phones. FUSE's line now steps out unless it is ≥12 px below the card (was 4 px, `solve-scene.ts` `updateCrowd`).
6. **Empty socket.** The phone cause headline comes from `causeHeadline`: "The charge hit an empty socket", "…carved stone", "…ran off the altar", and so on, with the Try line right under it.

Files: `scenes/altar/{reach.ts, reach.test.ts, strike.ts, strike-styles.ts (new phone sheet, appended to the altar sheet), altar-scene.ts, altar-styles.ts, solve-scene.ts}`, `art/materials/stone.ts`, `shaders/stone-wgsl.ts`, `tests/e2e/mobile-strike.spec.ts`, `scripts/playtest/mobile-7-strike.spec.ts`.

E2E: `tests/e2e/mobile-strike.spec.ts` runs on all four phones. It checks:
- Strike's label, one line, ≥56 px tall and ≥12 px from the edge;
- lamps against `machineLinked`, with no digits in them;
- the glow only when every lamp is reached;
- compact cards after a two-strike fail, the strikes line in the verdict, and "Try again";
- the empty-socket headline;
- the solve card clear of gauges and gems, and FUSE ≥12 px clear of it.

Captures (git-ignored):
- `docs/design/screens/local/mobile-7-strike/after/<phone>/` covers lamps off / one / all with the glow, mid-strike, the two-strike verdict, the Last Rune verdict, the empty socket with the red mark, and three solve cards.
- `docs/design/screens/local/mobile-2/strike7/<phone>/` is the standard suite.

Open:
- On the SE the two-strike verdict covers FUSE's figure. Strike yields to it until a tap.
- The unlit lamp is a small hollow ring. It reads fine next to the lit one, but on a board where every gauge is unlit it is quiet.
- On the SE, FUSE's solve line usually steps out now, because there is under 12 px below the card.
