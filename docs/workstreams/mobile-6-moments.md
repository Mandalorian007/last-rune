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

### 2026-11-03: done (branch `ws/mobile-6-moments`)

**One owner of the column.** `moments.ts` `arbitrate(asks, room, gap)` ranks verdict > teach >
tip > how-to line > FUSE. The first voice owns the column and always shows. Each lower voice
gets its full height if it fits. Otherwise a gem's tip shrinks to its name line
(`data-arb="line"`) and anything else waits (`data-arb="wait"`). A waiting FUSE line is frozen
with `caption.suspend`, not dropped, and is released when there is room (unless a modal holds
it). The verdict is never held back. `altar-scene.ts` `arrangeColumn` runs every frame on
phones and does three things:
- measures the room from under the tray down to FUSE's bubble;
- puts the bubble over FUSE's head, at least 10 px above Strike;
- steps the lane right of any Gives/Needs card whose words reach the column, plus 8 px
  (`--lr-lane-l/-w`; on the SE, "in one strike" ran under the card).

The old `data-crowd` hide is gone, and so is the rule that hid the verdict whenever a tip
showed. There are unit tests for the arbiter. A new e2e test on se, iphone, promax and android
(`mobile-moments.spec.ts`, "the right column has one owner at a time") runs Capacitor Bay
(15-capacitor-teach) and the Last Rune at first meeting. It goes through each teach page, a
gem tip, a fail, and FUSE talking over each. No two of tip, bubble, how-to line, verdict, tray
counts, Strike and board labels may intersect.

**Verdict off the board (phones).**
- The red ring on the socket stays.
- The cause tag over the top row is gone; the root cause is now in the verdict. When nothing
  arrived it is the headline ("Empty socket: charge lost", then the "Try:" line). On an
  over/under it is a small line (`.lr-verdict-cause`), unless the strike's story already fills
  the verdict. This keeps the verdict inside mobile-budget's line caps.
- The storm's tick-0 "4" chip is not drawn on phones, because the `Gives 4` card already says
  it. Changes and arrivals keep their chips. Big screens are unchanged.
- The verdict lives in the lane, right of the Needs/got card, so the "got 0" label is never
  crowded.

**Teach cards.**
- The cards never page themselves on phones. "Next ›" and then "Got it" turn the pages. The
  button is drawn at least 36 px tall, with a 44 px `::before` hit area.
- The "New here · 1 of 3" counter is 12 px.
- Where the column is short (the SE under a two-row tray), the card goes compact
  (`data-compact`): the counter and button stand top-right and the rule wraps round them. On
  the SE the Capacitor card is 69 px tall and clears FUSE.
- Desktop keeps the timed card.

**Hint slot API.** `AltarScene.setHintLine('holding' | 'zoom', text | null)`. The slot shows one
line, in the order holding, zoom, then the how-to line. The strike's "Tap to skip" always wins.
Off phones the API is ignored. This is for mobile-6-board ("Holding: X") and mobile-6-zoom ("Tap
the board to zoom").

**Text floors.**
- Tray keycap and count: 13 px.
- Solve card's page note (italic lore) and its heading: 12 px.

**Copy: "charge" is the one noun.** The full table is in `docs/design/script.md`, "Rule and
verdict copy". Content tests now forbid bolt, fizzle, stem, arm, joined, sparks and amber in
Codex rule, chip and maths text and in the cause and Try lines.

| Where | Before | After |
|---|---|---|
| Codex footer | 1 bolt = 4 sparks. A 2× storm fires 8, a 4× storm 16. | The numbers are charge. A storm gives 4 a strike; 2× gives 8, 4× 16. |
| Channel rule | Carries the bolt straight on, whichever way it enters. Charge unchanged. | Carries the charge straight through, whichever way it enters. The charge is unchanged. |
| Bend rule | Turns the bolt 90° between its two joined sides. Hit it from any other side and the bolt fizzles. | Turns the charge round the corner along its bent line, either way. Charge entering any other side is lost. |
| Bend chip | Turns the bolt 90° between its two joined sides. Other sides fizzle. | Turns the charge along its bent line. Other sides lose it. |
| Split rule | Takes the bolt in at its stem and sends it out both arms, half charge each. Any other side, or an odd charge, fizzles. | Charge enters at the plain end and leaves by both arrows, half each. Odd charge, or charge from any other side, is lost. |
| Split chip | Stem in, both arms out, half each. Odd charge or other side fizzles. | In at the plain end, half out each arrow. Odd or wrong side: lost. |
| Amplify rule | … A bolt that already passed an amber goes through unchanged. | … Charge that has already passed an Amplify, even split since, goes through unchanged. |
| Gate rule | Two side inputs, one output. Fires only when both inputs arrive in the same strike, and sends their sum. | Takes charge in on both side lines. If both arrive in the same strike, their sum leaves by the arrow. Otherwise it is lost. |
| Capacitor rule | Stores the first bolt it gets. The next strike, it releases the stored charge plus the new one. | Keeps the first charge it gets; nothing comes out. Next strike, the new charge pushes both out together, straight on. |
| Ring | A socket the bolt's route must reach. Set a gem there. | A socket the charge must reach. Set a gem there. |
| Can't turn | Can't turn: the bolt goes straight through | Can't turn: charge goes straight through |
| Causes | Empty socket: the bolt fizzled · Carved stone: the bolt fizzled · Ran off the altar · Faces the wrong way · Odd charge cannot split · Gate needs both inputs · Gem already spent this strike | Empty socket: charge lost · Carved stone: charge lost · Charge ran off the altar · Turned the wrong way: charge lost · Odd charge can't split: lost · Gate needs charge on both sides · Gem already used this strike |
| Try lines | steer the bolt to the machine… · bring a second bolt into the Gate's other side. · give each bolt its own gems. A gem carries one bolt per strike. · (touch) turn the gem at the red mark (R or scroll). | lead the charge to the machine… · bring charge into the Gate's other side line too. · give each path its own gems. A gem carries charge once per strike. · (touch) turn the gem at the red mark (↻ Turn). |
| Announcer | Fizzled: … | Where it went wrong: … |

The Codex diagram alt texts now say "Charge of 4 enters…" and "…is lost". `docs/design/altar-ux.md`
quotes the new copy.

**Shared files touched:**
- `scenes/altar/strike.ts`: `CAUSE_TEXT`, `CAUSE_HINT`, and the `touch` parameter on `nextStep`.
- `scenes/altar/altar-scene.ts`: `arrangeColumn`/`holdFuse`/`overlayTop` replace the crowd
  toggle; `setHintLine`; teach paging; the verdict cause line; the phone chip filter; tags
  skipped on phones; copy constants.
- `ui/phone-styles.ts`: one `/* mobile-6-moments */` block, after the mobile-5-board block.

**For the PM:**
- `docs/design/rules.md` still uses "bolt" as its model term. I did not edit it. Consider a
  sentence there saying the player-facing noun is "charge".
- `ui/codex-diagram.ts`'s header comment still says bolt/fizzle. It is internal only, and the
  layout belongs to another workstream.
