# Workstream: mobile-7-ending (the ending feels finished on phones)

Gate review 4 failed at 6.4 (D-040 addendum 5). Evidence is in `docs/design/screens/local/mobile-2/gate4/*/3[0-2]-*` and `mobile-4-chrome/gate4-*-ending.png`.

## Scope
1. **One instruction.** Resolve the clash between the "Plays by itself" pill and the "Tap to continue" caption: pick one model and make the copy match it. Nothing that looks like a button may do nothing.
2. **The hangout fills the phone.** Remove the empty bottom 40–50%. Scale the chat to the height, show more history, or anchor messages to the bottom like a real chat app. Each beat should feel alive.
3. **End card.**
   - Tone down the washed-out yellow background so the panels sit in the scene.
   - The title panel has breathing room from the top edge.
   - The "Safety record" slip doesn't touch the title on se.
   - The clipboard isn't cropped.
   - Check the real copy with a realistic play time, not "1m".
4. **The Journal page arrows** sit near the book, not at the screen edges (android).

## Ownership
`scenes/ending/`, `content/ending.ts` (layout only), the end card, and the Journal arrows' position. Don't touch the hall or altars.

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

- 2026-11-03: done on `ws/mobile-7-ending`. Phones only; desktop and iPad keep their look.
  The 1920 end card is unchanged, and the iPad doesn't get `data-phone`.
  1. **One instruction.**
     - The caption's "Tap to continue" `::after` is gone.
     - "Plays by itself" is bare text with a soft shadow: no pill, no border, `pointer-events: none`.
     - Skip is the only control.
  2. **The hangout fills the phone.**
     - The chat is bottom-anchored. mobile-6's `::after` spacer is gone, so the newest message always sits at the foot. Before, the bottom 40–50% was empty.
     - Bigger type: 16 px messages, 38 px avatars.
     - Each channel opens on a chat-app start block right above its first message: a 60 px emoji disc, "Welcome to #x!" and "This is the start of the #x channel."
     - When the start block won't fit, it shrinks to one line, and it hides only if even that won't fit (`fitStart`, `data-compact`).
     - New copy is in `HANGOUT_COPY.channelWelcome` / `channelStart` (PM: please OK the wording).
  3. **End card.**
     - Gold: on phones the flood post look is held lower (bloom 0.5 / threshold 1.6, god rays 0.25, exposure 0.74), and the wash and glow under the card run at 0.45×. The panels now sit on a deep amber, not lemon.
     - Column: the title band is 10 px from the top, then 8 px to the slip and 8 px to the card.
     - On SE (≤330 px tall) the title is smaller, and the gaps are 7 px and 5 px.
     - Clipboard: `phoneClipRest()` moves the rotated board inward, never outward, so it sits ≥12 CSS px inside the visible band on every phone. Unit test: `ending-layout.test.ts`.
     - The copy reads correctly with a real play time: 1h 29m, 7 breakers.
  4. **Journal arrows.** On phones they sit on the book's outer bottom corners, centred on the leaves' outer edges (design px 669 / 1835). They're clear of the quill and candle, and no longer out at the screen edges.
  - **Tests.**
    - `mobile-ending.spec.ts`:
      - No caption cue, and the "Plays by itself" cue is bare text.
      - Newest message within 12 px of the log's foot.
      - At most one start block, and it sits directly above the first message.
      - Title band ≥8 px from the top; slip and card don't touch.
      - Clipboard inside the screen.
    - `mobile-chrome.spec.ts`: the journal arrows are within 6 px of the book's edges.
  - **Captures** (`docs/design/screens/local/`):
    - `mobile-7-ending/{a1,a2,after}/<vp>/` plus contact sheets `mobile-7-ending/after-<vp>.png`, each with `measure.json`. Spec: `scripts/playtest/mobile-7-ending.spec.ts`, run with `M7E_TAG`.
    - Desktop: `mobile-7-ending/after/desktop/33-end-card.png`, unchanged from a1.
    - Before: `mobile-3-ending/m7-before-<vp>.png`.
    - Journal: `mobile-2/m7e/<vp>/05-journal.png`.
  - **Open.**
    - Channels with one message (jammin-out, gearhead) still show ~35–45% dark above the start block on promax and android. That's the chat-app look, but a PM call.
    - `ui/phone-styles.ts` (Journal arrows) is a shared file. I replaced mobile-6's arrow rule in place.
