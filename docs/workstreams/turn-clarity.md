# Workstream: turn-clarity (wave 5, top priority, D-027)

## User feedback (verbatim, 2026-11-02, after onboarding-2)
> the first level is great and clear and intuitive. I think there might be some bugs on rotating vs selecting or something, but not bad. The second stage is confusing as all hell with the layout and rotating desired and at one point I thought I would rotate the splitter, but then the rotate looked like the piece I was placing??? Super confused.

After intake-desk, four altars unlock at once (furnace, splitter-mill, relay-tower, conveyor-a), so "second stage" could be any of them. The splitter mention points to **splitter-mill**: fixed Split at (2,1), storm on the W edge row 0, machines on the E *and* W edges row 1, tray Channel ×8 + Bend ×4. Fix all four second-stage altars, not just one.

## What the PM found in `scenes/altar/altar-scene.ts` (confirm, don't trust)
1. **Three verbs on one click.** With an empty hand, clicking a placed Bend/Gate *turns* it and clicking any other gem *picks it up* (`actOnGem`). Enter/A always picks up. With a gem in hand, clicking a placed gem of the same kind *re-turns the board gem* to match the hand (`placeHand`). That is the likely "rotating vs selecting" bug.
2. **R/scroll target depends on hidden state.** With a gem in hand, R/scroll turns the *hand* even when the pointer is over a board gem. With an empty hand it turns the hovered board gem. Fixed gems (and Split, Amplify, Channel) can't turn, so R over the fixed Split with a Bend in hand turned the Bend. That is exactly what the user hit.
3. **The held gem isn't clearly where you are aiming.** Check whether the held gem is drawn at the hovered socket. If the turning piece is in the tray or floating somewhere else, a turn reads as something else moving.
4. **The splitter-mill layout:** the storm and a machine are on the same (W) edge, the Split can't be turned, and "feed it from above" is only in `insight`. A player who sees a fixed Split facing the wrong way wants to turn it.

## Goal
One rule the player never has to think about, plus a readable second stage.
- **One input model** (propose it in your log, then build it). Suggested:
  - Click (or Enter/A) picks up and puts down. A click never turns a gem.
  - R/Q/scroll turns *the gem under the cursor*: the held gem, drawn as a ghost in the hovered socket, or a placed turnable gem.
  - Turning anything that can't turn gives clear feedback: a small "Fixed in place" or "Splits don't turn: they fork to their sides" tag at that gem, with a deny sound. It never silently turns something else.
  - Mouse-only players can still turn: scroll does, and say so on the hover card.
- **The held gem is visible where it will land:** a ghost in the hovered socket, at its real rotation, with the route preview already wired (onboarding-2). Over a socket that won't take it, show the reason.
- **Split must be readable without turning it:** its glyph shows the input side and both output sides relative to the actual feed, or shows "in" when unfed. The card says what it does in one line. Re-check that the first-altar Split glyph matches `docs/design/rules.md`.
- **Second-stage layouts:** fresh-eyes screenshots of all four altars (furnace, splitter-mill, relay-tower, conveyor-a). If a layout is inherently confusing (for example, a storm and a machine on the same edge with no visual separation), propose a small layout or label fix that keeps the solver happy (`pnpm puzzle <id>`, difficulty tests). Puzzle changes need solver-check green, and you must note any change in solution count.
- Keyboard, gamepad and a11y announcements follow the same rule.

## Done means
- `pnpm check`, `pnpm build`, `pnpm test:e2e` all green.
- An e2e covers: R over a fixed gem with a Bend in hand does not turn the hand and shows the tag; click on a placed Bend picks it up; scroll over a placed Bend turns it.
- Screenshot sequences (1920×1080 and 1280×720 at 150% text) for each second-stage altar as a newcomer, in your scratchpad, listed in your report.
- `docs/design/altar-ux.md` documents the input model. Update the hint lane copy ("Click a gem, then a socket · Scroll or R turns · Right-click removes") if the model changes.
- Log progress here. Propose decisions to the PM; don't edit DECISIONS.md.
