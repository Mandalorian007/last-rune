# Difficulty curve

How hard each machine's puzzle is, how we measure it, and the curve the 16 puzzles are tuned
to. Code: `games/last-rune/rules/difficulty.ts` (metrics, novice bot, score),
`games/last-rune/content/puzzles/targets.ts` (the bands). Look at any puzzle with
`pnpm puzzle <machineId>`; `pnpm puzzle all` prints the table below.

## 1. What we measure

For each puzzle, `measure(p)` runs the exhaustive solver (keeping up to 1000 solutions) and
the novice bot, then reports:

| Metric | Meaning |
|---|---|
| solutions | Canonical solution count (every placed gem carries charge). Low is tight. |
| min gems | Fewest gems in any solution: how much there is to build. |
| slack | Tray gems beyond the smallest solution: room for wrong ideas. |
| search bits | log2(solver branch points per solution): how rare solutions are. |
| informative | Share of rejected finished boards that read under/over rather than nothing. |
| required ideas | Flow markers that **every** solution shows (see below). |
| bot tries | Median attempts the novice bot needs to solve (a give-up counts as 300). |

**Flow markers** come from the trace of one solution: `amp-then-split`, `split-then-amp`,
`amp-noop` (a second amber on a marked bolt), `gate`, `gate-unequal` (the two inputs differ),
`bank` (a Capacitor stores and releases), `late-wake` (a machine only wakes on a later strike),
`waste` (charge deliberately grounded or fizzled), `avoid-fixed` (a pre-set gem left out of the
circuit) and `detour` (circuit at least twice the straight-line distance). A marker is a
*required idea* when every canonical solution has it: the player cannot get round it.

**The novice bot** plays the way a first-time player does. It follows the bolt and, at each
empty socket the bolt reaches, picks a gem that heads toward the nearest unwoken machine and
nudges the charge toward that machine's need (Split if too much, Amplify if too little). It
looks one socket ahead (a distance field) and chooses with softmax noise. After a failed fire it
reads the gauges, keeps its best board so far (closest readings), and changes one decision of
it, keeping later sockets where they were; now and then it starts afresh. It gives up after 150
attempts. It knows a Gate is "for joining bolts" and a Capacitor "for later strikes", nothing
more. 12 seeded sessions, so results are deterministic.

## 2. The score

One number, calibrated so it reads as **estimated minutes for a first-time player** on our
by-hand scale:

```
score = 0.4
      + 0.15 · log2(bot tries)       how often sensible-but-naive tries work
      + 0.10 · search bits           how rare solutions are in the search tree
      + 0.35 · concepts              ideas every solution needs
      + 0.04 · min gems              sheer construction
      − 0.10 · log2(solutions)       a loose space forgives

concepts = Σ weight(required marker) + 0.5 per machine beyond the first + 0.5 if > 1 strike
weights: amp-then-split 1, split-then-amp 1, gate-unequal 1, bank 1, late-wake 1, waste 1,
         avoid-fixed 0.75, detour 0.75, gate 0.5, amp-noop 0.5
```

Est. minutes = score rounded to the half minute, at least 1.

**Calibration.** I estimated minutes by hand for the 16 pre-Phase-1 puzzles (1, 1.5, 2, 2, 2,
2.5, 2.5, 3.5, 3, 3.5, 3, 3, 4.5, 5, 5, 6), fitted the five weights by ridge least squares
(fit error under 0.4 min on all but control-booth, which I'd put 0.7 higher), then rounded them.
The concepts term carries most of the weight; the bot term separates puzzles with the same
ideas but different "first try works" odds (crane vs foundry). Each puzzle's own `minutes` field
stays on the pitch's scale, which runs about 1.25 × score (finale 8). Phase 2 playtests should
rescale this; until then **the shape of the curve is the contract, not the absolute minutes.**

Known limits: the bot can't plan a Gate meeting, so every Gate puzzle that needs both halves
to arrive at once pushes it to the 300 cap (crane, boiler, archive, lift, booth). Past that cap
the score leans on concepts and search bits. Canonical counting treats a second amber on a
marked bolt as "useful", so a spare Amplify inflates the solution count; tray decoys are chosen
with that in mind.

## 3. Target curve

Bands in `targets.ts`; the FULL=1 test (`content/puzzles/difficulty.test.ts`) checks every
puzzle measures inside its band and that the finale scores highest. The fast suite checks the
bands rise by tier.

| Tier | Machines | Score band | Feel |
|---|---|---|---|
| 1 | intake → conveyor | 0.5–3.1 | One gem each; the first try fails informatively. |
| 2 | press → foundry | 2.4–4.6 | One real "aha" each: order of amber and magenta, unequal merge, a tree. |
| 3 | capacitor-bay → booth | 3.5–6.1 | Two ideas combined, across strikes. |
| 4 | the-last-rune | 5.9–7.5 | Everything, one insight, tight space. |

## 4. Before / after

"Before" is the puzzle set at the start of Phase 1 measured with the final formula. Solutions
are canonical counts.

| # | Machine | Band | Before score | After score | Est. min (after) | Design min | Solutions before → after | Required ideas (after) |
|---|---|---|---|---|---|---|---|---|
| 1 | intake-desk | 0.5–1.5 | 0.8 | 0.8 | 1 | 1 | 1 → 1 | – |
| 2 | furnace | 1–2.2 | 0.9 | 1.6 | 1.5 | 2 | 4 → 3 | avoid-fixed |
| 3 | splitter-mill | 1.5–2.8 | 2.4 | 2.4 | 2.5 | 2 | 1 → 1 | – |
| 4 | relay-tower | 1.5–2.8 | 2.1 | 2.1 | 2 | 2 | 2 → 2 | gate |
| 5 | conveyor-a | 1.8–3.1 | 1.9 | 1.9 | 2 | 2 | 8 → 8 | amp-then-split, waste |
| 6 | press-unit-4 | 2.4–3.6 | 2.5 | 2.5 | 2.5 | 3 | 9 → 9 | amp-then-split |
| 7 | storm-cell-2 | 2.4–3.6 | 2.6 | 2.6 | 2.5 | 3 | 1 → 1 | – |
| 8 | crane | 3–4.2 | 3.7 | 3.7 | 3.5 | 4 | 2 → 2 | gate, gate-unequal, waste |
| 9 | boiler-room | 3–4.2 | 3.8 | 3.8 | 4 | 4 | 1 → 1 | – |
| 10 | archive | 3.4–4.6 | 4.1 | 4.1 | 4 | 5 | 3 → 3 | gate, gate-unequal |
| 11 | foundry | 3–4.2 | 3.5 | 3.5 | 3.5 | 4 | 2 → 2 | split-then-amp, gate, gate-unequal |
| 12 | capacitor-bay | 3.5–4.8 | 2.9 | 4.0 | 4 | 5 | 2 → 11 | bank, late-wake, waste |
| 13 | lift-shaft | 4.1–5.3 | 5.0 | 4.7 | 4.5 | 6 | 12 → 3 | gate, gate-unequal, bank, late-wake, waste, detour |
| 14 | roof-array | 4.5–5.7 | 5.2 | 5.2 | 5 | 6 | 5 → 5 | gate, gate-unequal, bank, late-wake, waste, detour |
| 15 | control-booth | 4.8–6.1 | 4.5 | 5.2 | 5 | 7 | 6 → 1 | split-then-amp, gate, gate-unequal, avoid-fixed, detour |
| 16 | the-last-rune | 5.9–7.5 | 5.9 | 6.0 | 6 | 8 | 72 → 4 | split-then-amp, gate, gate-unequal, bank, late-wake, waste, detour |

Total estimated play: **52 → 53.5 min** on the score scale (64 min on the design
scale). The total barely moves because the changes trade busywork (long channel runs) for
ideas: lift-shaft and the finale lose 9 and 7 placements but keep every required idea.

What changed and why:

- **furnace**: the short road now misses both ambers, so the first try reads 4 (under) and the
  fix is to bend through one. Before, the bot solved it first time with no idea needed.
- **capacitor-bay**: 8×6 altar; the pre-set ice sits on the straight road, so the first try
  banks the whole storm and reads 16 on the second strike (over). Halve it first, and halve the
  spare half again for the small machine. Was the easiest puzzle of its open set by a step.
- **lift-shaft**: the shaft's rails are pre-set. The 12 solutions were the Capacitor sliding
  along a 19-gem loop; now it's 3 sockets and the work is the idea (4 + 4 = 8 both strikes until
  one half is banked), not laying channel.
- **control-booth**: a pre-set amber on the straight road (amplify the whole storm and both
  halves are 16: over), and rails on the amplified arm. 6 → 1 solution.
- **the-last-rune**: both arms' rails are carved into the frame; the upper arm keeps two open
  sockets, which must hold the amber and the ice together (16 on the second strike + 4 = 20).
  Everything else is forced: 4 solutions (amber/ice order × the small machine's last turn),
  down from 72 variations of where the gems sat on long runs. Still the top of the curve.

**After D-031 (one-input Split).** Every Split now has a turn; fixed Splits were set to the
turn their intended route needs. Scores move by 0.2 at most, all inside their bands
(splitter-mill 2.2, relay-tower 2.0, conveyor-a 2.2, crane 3.5, boiler-room 3.6, foundry 3.3,
the-last-rune 6.1; the rest unchanged). conveyor-a drops from 8 to 4 solutions: the fixed
Split no longer takes its bolt from either side. Total: 52.5 min. The solver and bot only try
turns that accept the incoming bolt, so the cost of choosing a tray Split's turn is not scored.

## 5. Open issues

- Bands are on a by-hand minutes scale. Phase 2 playtests (time to solve, fires per solve,
  hint use) should refit the weights; `scoreOf` is the only place to change.
- conveyor-a (4 since D-031; was 8) and press-unit-4 (9) are still loose for Tier 1/2; the looseness is mostly
  where along a run the pre-set gems sit. Fine for now; candidates for rails if playtests say
  they feel aimless.
- capacitor-bay has 11 solutions because the 8×6 maze leaves several ways to the small machine.
  The idea is the same in all; tighten if playtests show players stumbling on routing.
- The bot fails most Gate puzzles outright (300). A bot that plans "bring both halves to the
  same Gate on the same strike" would separate crane/boiler/archive/lift better.
