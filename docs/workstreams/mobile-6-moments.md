# Workstream: mobile-6-moments (one voice at a time, in words the game teaches)

## Background
Gate review 3 failed (6 / 6 / 6 / 6.5; D-040 addendum 4). The moment and copy issues the PM verified in `docs/design/screens/local/mobile-2/gate3/`:
1. **The right column collides with itself (3 of 4).**
   - `iphone/15-capacitor-teach.png`: the Capacitor tip, FUSE's bubble, the tray and Strike are stacked with no gap, and the tip runs into "Needs 8 in one strike".
   - `pm-review-altars/*/16-the-last-rune.png`: the Capacitor tooltip touches "Needs 20 in one strike".
   - `11-the-last-rune-fuse.png`: FUSE's bubble presses against Strike.
2. **The verdict tag covers sockets.** In `13-relay-tower-verdict.png`, "Empty socket: the bolt fizzled" sits on the board's top row. An unexplained "4" chip appears by the source. The hint panel crowds the "got 0" label.
3. **Teach cards have no visible way forward.** "New here · 1 of 3" (about 9 px) has no Next or Got it (`11-intake-desk-fuse`, `14-relay-tower-teach`).
4. **The copy uses untaught words (2 of 4).**
   - Bend: "Turns the bolt 90° between its two joined sides. Other sides fizzle."
   - Split: "Stem in, both arms out, half each. Odd charge or other side fizzles."
   - A newcomer can't map bolt, fizzle, stem, arms or joined sides to anything on screen. Is "bolt" the same as "charge"?
5. **Small text:** the tray counts and the solve card's italic lore are about 10–11 px.

## Scope (phones; copy changes apply on all platforms)
1. **The right column has one owner at a time.**
   - Define priority: verdict > teach card > tip > FUSE.
   - Lower-priority items wait or shrink to a single line; they never overlap each other, the tray, Strike or any board label.
   - Add a unit test of the arbiter in `moments.ts`, plus an e2e check on four phones that the boxes of the visible tip, bubble, teach card, tray, Strike and board labels don't intersect on `15-capacitor-teach` and `16-the-last-rune`.
2. **The verdict sits off the board.** It goes in the column or under the board, never over sockets. The red mark on the socket stays. Explain or remove the unexplained number chip by the source.
3. **Teach cards:** a visible "Next ›" / "Got it" tap target ≥44 px tall, and the counter ≥12 px.
4. **Words the game teaches.**
   - "Charge" is the one noun for what flows. Rewrite the gem tips, teach cards, verdict lines and the Codex rule text in plain, visible terms. For example, Bend: "Turns the charge a quarter-turn. Use Turn to aim it." Split: "Charge in one side, half out each of the other two. Odd charge is lost."
   - Check every line against `docs/design/rules.md` so the copy matches the rules exactly.
   - FUSE's flavour lines may keep his voice, but no rule text depends on them.
   - Content tests must stay green; update `docs/design/script.md` entries you touch.
5. **Text floors:** tray counts ≥13 px, and solve-card lore ≥12 px on phones.
6. **Hint slot hand-offs.** mobile-6-board may propose a "Holding: …" line and mobile-6-zoom a "Tap the board to zoom" line. The PM will relay them; leave a slot or API for them in the arbiter.

## Out of scope
- Board looks and the held cue art (mobile-6-board).
- Zoom (mobile-6-zoom).
- The Codex layout, hall, menus and ending (mobile-6-chrome). You own the Codex *text* only.

## File ownership
- **You own:** `moments.ts`, `teach.ts`, `hints.ts`, `solve-scene.ts`, the FUSE/verdict overlays in `altar-view.ts`, and gem/rule copy in `games/last-rune/content/`.

## Done when
- Everything above is fixed. Captures: `M2_TAG=m6moments` on four phones, with 11-, 13-, 14- and 15- reviewed by you as a newcomer.
- A before/after copy table in the log.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log
