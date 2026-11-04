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
