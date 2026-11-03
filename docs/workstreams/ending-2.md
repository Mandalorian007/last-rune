# Workstream: ending-2 (wave 5, D-032)

## User feedback (verbatim, 2026-11-02)
> don't give details about the discord just note that he found friends there or something. The discord could be fun and antics ridden or something, but he isn't a bot on the server. Just a game character. We are just having the game ending be "he went to thunderclap gaming". Also I am "ThunderSoap" the author and owner of ThunderClap Gaming (discord community)

## Goal (D-032)
The ending says FUSE **went to ThunderClap Gaming and found friends**. Nothing implies he is a bot or a member of a real chat server.

## Changes
1. **Remove the mock chat beat.** Remove the chat window, the server name, the channel list, `#this-will-break`, the six reactor handles, the reaction pills, "… are typing…" and "Message #…". Delete `CHAT`, `CHAT_CHANNEL`, the chat CSS and the chat cue code; don't leave dead code behind.
2. **Replace it.** The white fades to warm gold and light, not a UI screen. FUSE's three lines play as normal captions (`ctx.fuse.say`), in sentence case, as his voice from beyond the door:
   - "Hello. This unit has arrived somewhere with a great many people in it."
   - "You appear to be arguing about a game."
   - "Day 1."
   Optionally add a soft procedural murmur of a lively crowd (warm and fun, with a bit of laughter-like chatter, quiet). Use the audio recipes; the level must be checked.
   Keep Reduce flashes and reduced motion behaviour. The flood and title then follow as today.
3. **Title card:**
   - "FUSE went to ThunderClap Gaming."
   - "He made friends. Loud ones."
   - "He still has questions about your safety record."
   The no-invite variant drops nothing; the card is lore either way.
4. **Credits:**
   - The Last Rune / A ThunderClap Gaming game
   - Made by / ThunderSoap
   - Every stone, gem, candle and spark / Drawn in code, on your GPU
   - Every sound / Synthesised as you play
   - FUSE / As himself
5. **End card:** the button label becomes "Join ThunderClap Gaming". It keeps the same URL and the same click-only, noopener behaviour. Keep the footer. The safety-record slip and the post-credits clipboard ("Day 1. Hobby: people. Monitoring.") stay.
6. **Update** `content/ending.ts` directions, the `lines.ts` chat kind (rename or convert to beat lines), `ending-model.ts` beats and tests, `docs/design/ending.md` (the copy section now says "confirmed by user, D-032"), and `docs/design/script.md` if it has the chat.
7. **Grep** for any other Discord/bot/chat-window wording in the game, docs/design and the README/pitch copy that players see. Fix what players see; list the rest in your report.

## Done means
- `pnpm check`, `pnpm build` and `pnpm test:e2e` green. Update `tests/e2e/ending.spec.ts`: no chat window, new title copy, ThunderSoap in the credits, and the link is still click-only.
- Fresh-eyes screenshots of the door → white → gold with captions → title card → credits → end card, at 1920 and at 1280 with 150% text, plus one with Reduce flashes. Put them in your scratchpad and list them in your report.

## Added scope: Ko-fi link (D-034)
- `KOFI_URL = 'https://ko-fi.com/thundersoap'` in `content/ending.ts` beside DISCORD_INVITE_URL.
- End card: secondary button under "Join ThunderClap Gaming", e.g. "Buy ThunderSoap a coffee". Optional FUSE quip: "This unit runs on lightning. ThunderSoap runs on coffee."
- Title menu: small, warm secondary link (not a menu item that competes with Play), e.g. a corner "☕ Buy ThunderSoap a coffee". Must not collide with FUSE's title stroll/caption or the release label.
- Click-only, new tab, noopener noreferrer, no widget/script/iframe/remote image. Procedural cup icon. Keyboard + gamepad reachable, axe clean.
- e2e: the link exists on both screens with the right href/rel and nothing opens without a click. Screenshots at 1920 and 1280/150%.

## Progress log (agent, 2026-11-02)
- **D-032 done.**
  - The mock chat (window, server/channel names, handles, reactions, typing, message bar) is gone, along with its CSS, cue code and lines.
  - FUSE now speaks the three beyond lines (`beat.beyond-*`) as ordinary captions over warm gold light (BEYOND_POST).
  - The crowd murmur is `amb.crowd`, procedural and optional.
  - Reduce flashes and reduced motion are kept.
  - The new title card, credits and "Join ThunderClap Gaming" label are in place; the Join link is created only at the end card.
  - ending.md (copy section "confirmed by user, D-032") and script.md are updated.
- **D-034 done.**
  - `KOFI_URL` lives in content/ending.ts and is https-only; a blank or other URL hides it.
  - `ui/coffee.ts` builds the link: an `<a>` with an inline-SVG cup, a new tab and `rel="noopener noreferrer"`.
  - Title: a pill in the bottom-right corner, inside FUSE's avoid regions.
  - End card: a smaller pill under Join.
  - `ui/menu-nav.ts` lets up/down (keys and pad) reach every control on the title and the end card; pad A clicks the focused control.
- **Audio.** `amb.crowd` first failed the loop-seam check at 5.8 dB because every talker's tremolo was in phase at the wrap. Alternating the sign of the tremolo rates, plus a sixth talker, fixed it: 0.80 dB, 0 problems.
- **Layout.** The three-line title card overlapped the safety slip. Moving the title up and tightening the second and third lines fixed it; verified at 1920 and at 1280/150%.
- **Tests.**
  - ending.spec: no chat, the new copy, Join and Ko-fi href/rel, no popups.
  - title.spec: a new Ko-fi test.
  - a11y.spec: the end-card Tab order is join → coffee → back.
  - New content and model unit tests.
- **Screenshots:** `scripts/playtest/ending-2.spec.ts`, in three runs (1920, 1280-text150, 1920-reduce-flashes).
- **Open:** a pad A press calls `.click()` on the link, and browsers may not count a gamepad press as user activation, so the new tab could be popup-blocked. Mouse and keyboard work.
