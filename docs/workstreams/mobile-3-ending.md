# Workstream: mobile-3-ending (the payoff feels made for phones)

## Background
The PM's blind screenshot review of mobile-2 scored the ending 6/10:
- the ending caption sits on top of Skip;
- the hangout is "a desktop Discord window shrunk onto a phone";
- the end-card buttons are small.

Read D-038, D-039 and **D-040** in docs/DECISIONS.md, and docs/workstreams/mobile-2.md (budgets and viewports). The screens are in `docs/design/screens/local/mobile-2/pm-review/<viewport>/30-ending, 31-hangout, 32-end-card` (local; regenerate them with `M2_TAG=after pnpm exec playwright test -c scripts/playtest/playwright.config.ts mobile-2`).

## Scope
These are PM decisions. Phone only: the desktop and iPad output must be unchanged.

1. **Ending sequence.**
   - Skip gets its own lane that captions never cover, e.g. the right edge or top-right inside the safe area, ≥44 hit.
   - The caption is width-capped to end before that lane.
   - Add a faint "Tap to continue" cue where tapping advances.
   - Caption text is about 14 px on phones.
2. **Hangout: a phone-native chat (D-040).**
   - On phones, drop the channel sidebar. Show a single conversation view:
     - a header like "‹ # introductions · ThunderClap Gaming";
     - messages at full width, about 14 px;
     - messages anchored at the bottom, with no dead gap at the top;
     - the typing indicator above the composer, with padding.
   - The channel list may live behind the ‹ header as a sheet if a moment in the sequence needs it. Your call; keep D-038's content and constraints.
   - On promax and android, "Builder, then foreman" in the NEW ARRIVAL note must not wrap so that "foreman" falls off the baseline.
   - Escape/Skip still works.
3. **End card.**
   - Join, Back to the hall, Buy ThunderSoap a coffee and Copy link are ≥40 drawn / ≥44 hit.
   - Trim the Safety Record card's padding if needed.
   - On SE, the clipboard prop must not crowd the chips or look tappable.
   - Keep the hierarchy, which the reviewers liked.
   - Credits: if a one-line credit fits cleanly, add it. Otherwise leave it as it is.

**Out of scope:**
- the altars;
- the title, hall and menus (that's mobile-3-chrome);
- ending and hangout wording;
- D-038 content.

`ui/phone-styles.ts` is shared with the other two workstreams. Keep your edits inside one block marked `/* mobile-3-ending */`, or in `scenes/ending/*-styles.ts`.

## Tests
- Extend the e2e phone tests. At all 4 viewports:
  - Skip is visible and not covered by the caption;
  - hangout messages aren't clipped and use ≥80% of the window width;
  - end-card controls meet the sizes above.
- Keep `ending-model.test.ts` green.
- Compare desktop 1920 and iPad before/after for no change.

## Done when
- Before/after contact sheets are in `docs/design/screens/local/mobile-3-ending/`.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.
- Commit to your branch. The PM merges, then runs the blind review (D-040).

## Log
