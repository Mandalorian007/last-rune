# Workstream: teach-4 (teach the advanced gems so a newcomer can read them)

Source: D-040 addendum 7, blind review 6 (shots: `docs/design/screens/local/gate6/`). All four reviewers found that the Gate, Split and Capacitor are taught in compressed one-liners, and that a player learns multi-strike by failing.

## Do
1. **Gem cards with a picture.** The first-time card for the Gate, Split and Capacitor shows a small in→out diagram beside or under the text, the way the codex does (for example "4 in → 2 + 2 out"), drawn with the real gem glyph and arrows marking the input and output sides. The card must still fit the SE lane with no scrolling; `altar-column.spec` proves it. Text may shrink as the picture takes over.
2. **Gate copy names the inputs relative to the arrow.** For example: "Feed the two sides beside the arrow in one strike; their sum leaves by the arrow." Reviewers read "both sides" as left and right.
3. **Capacitor two-strike strip.** "Strike 1: stores 8 → Strike 2: lets out 8 + 8." Before the FUSE joke, not instead of it. Explain the Strike counter ("Strike (2 left)") and "in one strike" the first time a multi-strike room opens.
4. **Gauge dot.** The first time a gauge's marker changes from an empty ring (cyan = charge will reach it; red = it will trip), one teach line says what it means. Check the real semantics in code; don't guess.
5. **Channels lie along their run.** Channels aren't rotational, so Turn stays dim while you hold one. Add one line the first time a Channel is held after Turn has been taught (or on the Channel card) so a dim Turn doesn't read as broken. For example: "Channels lie along the run on their own."
6. **Strike named** in the first teach sequence (Intake Desk): what it does ("Strike sends the charge; see what each gauge gets"). Put the goal before the pieces if the card order allows.
7. **No mid-expression wraps.** Sums ("8 + 8 = 16", "8 + 8 → 16") and value phrases ("Needs 20", "in one strike", "1 of 2") never break inside. Use non-breaking joins wherever this copy is rendered: verdicts, preview, pills, teach count.

## Don't
- Touch gem rendering on the board or tray (solve-truth and glyph-truth own it).
- Add a live "will get N" on gauges. It's an open product question for the user.

## Done when
- SE, iPhone, Pro Max and Android gate shots (`SHOTS=gate7 pnpm exec playwright test tests/e2e/shots.spec.ts`) show the diagrams, and no card scrolls or overflows. Look at them yourself as a first-time player.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` are green. Hint and copy unit tests are updated.
- Commit to `ws/teach-4` and never merge. Log here.

## Log

- 2026-11-04: work done, ready for merge.
  - **Pictures.** The phone arrival card is now built from pages (`teach.ts` `teachPages`). In order they are: goal (first altar), strikes (first multi-strike altar), each new gem, ring.
    - A Gate, Split or Capacitor page shows the gem as the codex draws it (`createGemPortraits`, the real gem material). It sits beside the rule, turned the way it sits on this altar (`turnSide`, unit-tested against `acceptMask`), with in and out chips and the ✕ for a side that loses the charge.
    - Gate and Split are 72 px. The Capacitor is 46 px with no chips, because its numbers are the strip.
    - **Compromise:** the pictures appear only where each gem is first met, fixed on the board (splitter-mill, relay-tower, capacitor-bay). Later "turns" pages, such as crane's Gate, sit in ~103 px lanes and overflowed with a picture.
  - **Gate copy.**
    - Rule: "Feed the two sides beside the arrow in one strike; their sum leaves by the arrow. Feed only one and it is lost."
    - Chip: "Feed both sides of the arrow in one strike; the sum leaves by it." I kept it at 68 chars or fewer: a 72-char chip pushed crane's card past an SE lane.
    - Fizzle cause: "Gate needs charge on both sides of its arrow".
  - **Capacitor.** Its page reads "Built in." plus "Strike 1: stores 8 → / Strike 2: lets out 8 + 8", with this altar's own charge. FUSE's joke is unchanged and still comes after. A "Strike (2 left)" page comes first: "One tap fires both. Each gauge needs its amount in one strike."
  - **Gauge dot.** A new `lamp` hint slot sits between holding and howto. Each line shows when the dot actually changes and starts with the dot itself:
    - Lit: "the charge reaches this gauge. Strike to see how much." Shown on the first altar until its first strike.
    - Red: "the Capacitor lets out more than this gauge needs. It will trip." Shown on the first Capacitor altar.
  - **Channel.** Where Turn is first taught (the furnace, Bend in the tray), holding a Channel says "A Channel lies along the run on its own: no turning." Showing it on every turn-teach altar overflowed crane's and press-unit-4's lanes.
  - **Intake Desk.** The goal page comes first: "Bring the storm's charge to the gauge: exactly what it Needs. Strike sends the charge; see what each gauge gets." The pointer line shows only on gem pages.
  - **NBSP.** `nowrap.ts` `keepTogether` is used in verdicts (headline, strikes, cause, story, Try), Capacitor readouts, the Strike label and count, teach rules, "1 of N", "Gives 8" and "in one strike".
    - **Compromise:** "Needs N" on the pills keeps its normal space. With NBSP, splitter-mill's pill grew into a socket.
  - **Held gems.** While a goal, strikes or ring page is up, a gem in hand takes the card, so it still names the gem in hand.
  - **E2E specs.** Specs that read `textContent` now treat a no-break space as a space: mobile-strike, mobile-moments' page count, and capacitor.
  - **Gates.** All green: `pnpm check`, `pnpm build`, and `pnpm test:e2e` (130 passed).
  - **Shots.** In `docs/design/screens/local/gate7/` and `docs/design/screens/local/teach4-col/`.
