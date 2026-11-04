# Workstream: solve-truth (the solve moment shows the board the player built; D-027)

Evidence: gate-6 blind review, `20-solve` vs `12-furnace-held`, and `13-capacitor-bay-multi`.

## Goal
On the Furnace, `20-solve` contradicted `12-furnace-held`:
- the Channel at col 1 / row 2 drew horizontal, and the bends looked rotated;
- the fixed Amplify at col 5 / row 2 glowed although the bolt never touched it;
- the fixed gems lost their collar and padlock (socket state 6).

The fix must keep the same rotations, light only the powered gems and keep the collar. It must also tone the solve/fail bloom down so every glyph and its direction stay readable (`13-capacitor-bay-multi` and `20-solve` whited out).

## Root cause: (b) render bug in `SolveScene`
- **Not (a), the rules.** Channel, Amplify and Capacitor are non-rotational: the sim ignores their `rot`, and the Furnace intended board simulates `exact` whatever the Channel's turn. `solved-board.test.ts` proves this.
- **Not (c), the shots harness.** It seeds the intended placements correctly; the altar's own verdict shows them correctly.
- **The bug (b).** `SolveScene` builds a fresh `AltarView` and only called `syncBoard`. That had three effects:
  1. Straight-through gems sat at their rest turn (facing the storm) instead of facing the hop that reaches them, which `faceAlong` does during play. That is why the Channel looked horizontal.
  2. It set `energy = 1` on every gem, fixed or not, on the route or not.
  3. It never built socket marks, so there was no collar or padlock and no phone rim.

## Fix
- `scenes/altar/solved-board.ts` (new, pure): `solvedLook(puzzle, placements, locked)` simulates the board and returns:
  - the bolt hops;
  - the lit set (gems a segment ends on as gem, store or wait);
  - the collar cells (fixed plus hint-locked).
- `solve-scene.ts` uses it:
  - it calls `view.faceAlong(look.hops, true)` and snaps `g.rot` to the target;
  - it lights only `look.lit`;
  - it builds the marks with `socketLooks(...)`, the same rim, blocked and collar marks as play.
- Bloom toned down so the glyphs read:
  - The solve scene's gem glow is `view.energyGlow = 0.25` (a new `AltarView` field; the default 0.6 is unchanged in play).
  - Phone bloom is `0.55 + 0.35·swell` (was `0.7 + 0.25·swell`); desktop drops its constant `+0.25`.
  - At the verdict, the bolt ribbons dim with a new `BoltRibbon.dimTo(level, s)`: to 0.5 on exact and 0.25 otherwise. This lives in game art (`art/props/bolt.ts`); the engine is untouched.
  - In `AltarView`, a gem reads `energised` only above energy 0.45 (was 0.15). Gems the bolt has passed and left cool to their placed look under the verdict, so the glyph and its turn read plainly.

## Evidence
- Unit (`solved-board.test.ts`, 6 tests):
  - the Furnace board is exact;
  - the lit set is exactly the 9-gem route, and the fixed Amplify (4,1) is dark;
  - the Channel at (0,1) is entered from above;
  - the collars are the two fixed gems;
  - the Channel's rot is irrelevant to the sim, but turning a Bend breaks it;
  - for every puzzle, lit gems were reached by a hop, unreached fixed gems stay dark, and collars equal the fixed cells.
- E2E (`tests/e2e/solve-truth.spec.ts`): for every altar in play order (desktop) and the Furnace on a 915×360 phone, it strikes the intended board for real. It reads the view at the verdict and again on the solve. It asserts:
  - the same gems and turns;
  - lit equals `solvedLook` lit;
  - the fixed flags are unchanged;
  - collar marks equal the fixed cells.
  It fails on the old `solve-scene.ts` in many altars, e.g. "furnace 4,1 amplify: lit off the route", "furnace 0,1 channel: turn 2 → 1", and missing collars.
- Shots: `SHOTS=gate6` were regenerated. I compared `20-solve` and `13-capacitor-bay-multi` on android and se with `12-furnace-held`.
  - The Channel is vertical and the Bends match.
  - The Amplify at (4,1) is unlit, with its collar and padlock.
  - The phone rims are back.
  - The Capacitor Bay verdict no longer whites out: the glyphs and arrows read under the red verdict.

## Note for the PM (out of scope)
In edit mode, a straight gem that the *preview* does not reach rests facing the storm, even where the real strike trace later reaches it (Capacitor-release paths in capacitor-bay, roof-array, lift-shaft and the-last-rune). The verdict and the solve both use the trace, so they agree. The pre-strike board can still show such a Channel turned differently from how it shows after Strike.

## Log
- 2026-11-04 (solve-truth agent): done on `ws/solve-truth`. Root cause (b); fix, tests and shots as above.
