# Workstream: newcomer-2

PM judgement (2026-11-02), following the user's "focus on polishing things up". Intuitiveness matters most (D-027). Play the first session exactly as a new player would: title → hall → intake-desk → furnace → splitter-mill → relay-tower → conveyor-a. Fix whatever would make a first-timer hesitate, misread or get stuck.

## Method
- Fresh eyes only: don't read the altar code before playing. Take a screenshot every time you have to make a decision, and write down what you think the screen is telling you before you check whether it's right.
- Use mouse first, then keyboard. 1920×1080 and 1280×720.
- For every hesitation, write one line in the log: where it was, what was confusing, and the fix.

## Scope
- Hall:
  - is the next machine obvious?
  - do locked doors say why?
  - is the way back obvious?
- Altar:
  - goal (Gives/Needs), which gems can be placed or turned, what the preview means, when to Strike;
  - what the verdict means and what to try next after a fail.
- Wording:
  - FUSE lines, hints and verdicts;
  - keep FUSE's dry voice;
  - shorten anything a first-timer skips.
- Visual hierarchy: the one thing to do next should always be the most prominent.
- Fix small things directly. Anything big goes in the log as a proposal.

Out of scope:
- Puzzle layouts (D-037 just retuned them).
- Lighting intensities.
- Engine internals.

## Done when
- A log of the hesitations, each marked fixed or proposed.
- Before/after screenshots in `docs/design/screens/local/newcomer-2/`. Don't commit them.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log
