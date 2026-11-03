# Workstream: ending-3 (community hangout, D-038)

User (2026-11-03), after playing alpha-1's old mock-chat ending: "Our discord is actually more of a community hangout… you can do something a bit more fun. Also for emoji reactions don't just use colored circles should have actual emojis lol. The side bar in particular is the most interesting." The user picked bringing the chat back, made fun, with the **real channel names**. Read D-038 (it amends D-032), `docs/design/ending.md`, and the old chat implementation in git (`git show alpha-1:games/last-rune/scenes/ending/ending-scene.ts`, plus its styles and content) for a starting point.

## The scene
- After the door/light beat, FUSE arrives in a lively community server window drawn in the game's own style. It should read as a Discord-like hangout without copying Discord's branding or exact UI chrome.
- **The sidebar is the star.** Server header "ThunderClap Gaming" with a "Community" category, and the real channels with their emoji, in order:
  👋 welcome, 🧑 introductions, 💬 the-hangout, 👀 supporter-sneak-peeks, 💬 supporter-chat, 🏆 events-and-contests, 🐈 furry-friends, 🍔 omg-food, 🎶 jammin-out, 🍜 otaku-oasis, 📚 book-worms, 🌱 watch-me-grow, ⚽ sports-ball, 🚗 gearhead.
  - Make it alive: unread dots and pips light up on several channels as FUSE arrives, and his presence moves through a few channels.
  - Examples: posting his incident form in #introductions, filing a safety concern in #omg-food or #gearhead, finding #jammin-out too loud. You pick the beats; keep it short.
- **Real emoji reactions** (🙏 🥰 💜 👍 🍕 ⚡ 🔧 😂 etc.) that pop in with counts ticking up, not coloured circles. Render them as system emoji text. Pick a font stack that shows colour emoji on Windows, macOS and Chrome OS.
- **Messages:**
  - FUSE's three closing lines (`beat.beyond-*`) are the anchor; keep them, and rework them only if a line clearly fits the chat better.
  - Add warm, funny replies from clearly **invented** community members (make up handles; no real people except ThunderSoap, the author, who may welcome him).
  - A typing indicator is fine. No member counts.
- **FUSE stays a game character:** no BOT tag, his avatar is his procedural face, and he's in the community, not running it.
- **Tone:** a welcoming hangout. FUSE's dry safety-officer voice meets a friendly, chaotic crowd. Keep it brief, with a total ending length close to today's (the first viewing is unskippable).
- **Lead-out:** the end card (title, Join ThunderClap Gaming, Ko-fi, the clipboard, the safety record) stays as it is and follows the scene.

## Constraints
- **Text and rendering:** all text lives in `content/ending.ts` and script.md. Update the content test that bans chat words (D-032) to D-038's rules: it should check that no real member handles appear other than ThunderSoap, and that there's no BOT tag.
- **Procedural only:** CSS/DOM/WGSL. Emoji are text glyphs. No image or font files, no network calls.
- **Accessibility:**
  - Reduced motion: no bouncing reactions, just appearing.
  - Screen readers: the chat is announced as a short summary, not every message.
  - Text size: it must fit at 1280×720 with 150% text and at 1920×1080.
- **Audio:** keep the crowd murmur; small pops for reactions are optional, and must stay gentle.
- **Out of scope:** the hall, the altars, lighting elsewhere and the engine. Engine changes are allowed only if they're generic.

## Done when
- Screenshots at 1920 and at 1280/150%: sidebar close-up, a reaction burst, and the full scene. Put them in `docs/design/screens/local/ending-3/` and don't commit them.
- The `ending-2` playtest spec, or a new one, captures the scene.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log
