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

### 2026-11-03: mobile-3-ending done (branch `ws/mobile-3-ending`)

**Before** (`docs/design/screens/local/mobile-3-ending/before-<vp>.png`, plus mobile-2's run in `before/mobile-2/`):
- FUSE's caption sat bottom-right of the 16:9 box, right on top of Skip.
- The hangout was the desktop Discord window shrunk down: a 660-px sidebar and about 11 px text. "Last post: Builder, then foreman" wrapped.
- End-card links were about 26 px tall. On SE the clipboard sat against the coffee "Copy link" and the footer.

**After** (`after-<vp>.png`; per-shot PNGs in `after/<vp>/`; capture script `scripts/playtest/mobile-3-ending.spec.ts`, `M3E_TAG`/`M3E_ONLY`):
- **Ending.**
  - Skip has its own lane in the top-right letterbox bar (44×36 drawn, 44 hit, z-index above the caption).
  - The caption is pinned bottom-left, clear of FUSE, Skip and the rune, and width-capped at about 330 CSS px. Text is about 14 px.
  - A faint "Tap to continue" cue sits under the text (CSS `::after`, so no new string in the script).
- **Hangout (D-040).** One phone-native conversation:
  - The window runs full width into the bars, with no sidebar or rail.
  - Header: "‹ (unread badge) # 👋 welcome · ThunderClap Gaming", with Skip at its right end.
  - Each channel opens with a Discord-style start block ("👋 #welcome"). It shows only while the whole conversation fits under it (`fitStart()`, so nothing is ever half-cut at the top), and messages stay anchored at the bottom.
  - Message text is 14 px; avatars are 32 px. The form keeps every line on one line (`nowrap`, inline-block).
  - The typing line sits above a rounded composer with padding.
  - Escape and Skip work as before.
- **End card.**
  - Join, coffee, both Copy links and Back the hall are each at least 40 CSS px drawn and 44 hit.
  - The whole title/safety/card stack moved 260 design px left of centre, so on SE the clipboard keeps clear of every control. It is `pointer-events: none` and reads as a prop.
  - The safety card is compact (padding 5/14/6). The hierarchy is unchanged: gold Join, then dark coffee, then the footer line, then Back.
- **Desktop and iPad: unchanged.** Sheets match before/after. The phone rules live in `scenes/ending/ending-phone-styles.ts`, all under the `data-phone` selector. The new DOM parts (‹, server name, start block) are `display: none` off-phone.
- Nothing in the D-038 script or wording changed. The one-line credit was **not** added: SE has no clean room for it under Back.
- **Tests.** `tests/e2e/mobile-ending.spec.ts` runs on all 4 realistic viewports (with notch insets) and checks:
  - Skip is on screen, at least 44 hit, not covered by the caption, and on top at its centre.
  - Caption text is at least 13.5 px, with the cue.
  - Hangout: no sidebar; messages at least 80% of the usable width; no cut text; nothing cut at the bottom; text at least 13.5 px; form lines on one line; typing above the composer; Skip in the header.
  - Tapping Skip goes to the end card. Its controls are at least 40 drawn / 44 hit, on screen, not overlapping each other, and at least 12 px clear of the clipboard; no scroll.
- **Moved code.** The old hangout block in `ui/phone-styles.ts` is replaced by a `/* mobile-3-ending */` pointer comment.
- **Capture note.** Run the desktop and iPad captures with `--workers=1`. Under parallel GPU load, frames slow enough that the end screen's idle timeout returns to the title before the 32/33 shots.

**Proposals for the PM.**
- (a) A phone one-line credit under Back would need either dropping the footer line or a second column; I left it out.
- (b) The ‹ chevron is decorative, as in the real app's header. Tapping it does nothing, and Skip remains the only exit. If the review reads it as a button, make it a no-op channel-list peek or remove it.
