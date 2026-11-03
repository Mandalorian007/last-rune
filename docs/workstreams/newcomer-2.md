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

Played fresh at 1280×720 and 1920×1080, mouse first and then keyboard: title → hall → intake → furnace → splitter mill → relay → conveyor A. Screens are in `docs/design/screens/local/newcomer-2/`: `before-*` for the first run, `after-*` for the fixed build.

- **Fixed: hall, after the intake.** Four doors open at once and look identical, and FUSE's return line doesn't point anywhere, so I picked one at random. Now the next open door in story order gets a soft breathing gold ring, dimmer than the hover ring. Its plate reads `Open · try this one next`, and the first arrow key lands on it. The other open doors still read `Open · click or Enter to restore`. Changed `hall-state.ts` (`suggested`, `firstFocus`), `hall-view.ts` and `hall-scene.ts`.
- **Fixed: hall, locked doors.** `Locked · needs Bend` didn't say where to earn Bend. Now it reads `Locked · needs Bend (from Intake Desk)`, via `SocketModel.from`.
- **Fixed: hall, plates on doors at the edge of the wall.** The Lift Shaft plate ran off the right edge. `hud.plate` now keeps the plate on screen.
- **Fixed: intake desk, FUSE's instruction.** He said "rune from the tray" while the UI says "gem". Now he says "gem from the tray" (`lines.ts`, and `script.md` to match).
- **Fixed: every altar, before the route reaches a machine.** Strike was the brightest thing on screen, so it looked like the first thing to do. Now it is desaturated until `data-ready`, then glows as before. Hover and focus still show it at full strength.
- **Fixed: every altar, a failed verdict.** There was no visible next step. "Change anything to try again" sat in a hidden subtitle, and the fizzle tags fade after a few seconds. Now one gold `Try: …` line sits under the headline (`nextStep` in `strike.ts`). It names the root cause first (facing, then empty, ground, blocked, odd split, gate alone, spent), so the relay with one arm missing says "put a gem in the socket at the red mark", not "Gate needs both". Too much charge says "Skip an Amplify, or halve it with a Split". The hint is also read out through the live region. Multi-strike altars keep their strike story in its place.
- **Fixed: splitter mill, one branch broken.** "Not enough: needs 2, got 0" made me add charge, when the real fault was a dead path. A machine that gets 0 now reads `No charge reached this machine: needs 2, got 0`.
- **Fixed: relay tower, the Gate info card.** Fixed gems show only the first sentence, "Two side inputs, one output.", which hides that both inputs must arrive in the same strike. The Gate now shows its whole rule.
- **Fixed: furnace, Bend becomes yours.** The card read "Yours to place now. Turn it to face the way you need." with no reminder of what a Bend does. Now it reads "Turns the bolt 90° between its two joined sides. Yours to place now; turn it to fit."
- **Fixed: relay tower, fizzle tags covering the verdict.** A tag for a bolt that ran off the top edge was hung "below the cell", which sits right under the verdict, and covered the new hint. It now hangs below the verdict.
- **Proposed: furnace solve line.** FUSE's "Amber rune doubles the charge" should say "Amber gem". The line is pitch-verbatim (the content test checks it against `pitch-v0.3.md`), so it needs a PM pitch edit.
- **Proposed: relay arrive line.** "Needs two full signals" suggests full strength matters. It doesn't: both inputs must arrive at once. Suggested wording: "two signals at once". Also pitch-verbatim. The Gate card now states the rule, so this is lower risk.
- **Proposed (art): Amplify's chevrons.** The `>>` chevrons suggest a direction, but Amplify ignores rotation. Use a symmetric mark.
- **Proposed (UI): tray count chip.** `1 ×6` can read as a single number, "16". Separate the hotkey from the count more clearly, or move the hotkey onto the gem.
- **Proposed: live-socket rings.** The coloured rings around live sockets are never explained. They are learnable, but one line in the first altar's tray hint would help.
- **Proposed: hall hover on the intake.** Hovering the intake desk door plays the altar's "Step one: gem from the tray" line before you are at the altar. Use a hall-specific line for the unopened intake.
- **No change needed:** the title, the gold intake doorway, the win card ("Opens: …"), conveyor A, the Back/Esc route to the hall, and the keyboard (arrows and Enter in the hall, R, F, Delete and Esc on the altar all behave as labelled).
