/**
 * The community hangout window (D-038), in the game's own style: slate stone panels with a
 * gold edge, cream text, gold for "you are here". Design px; the overlay scales it, and
 * `ensureEndingStyles` passes it through `scaleFontSizes` with the rest of the ending.
 * Emoji are system text glyphs on a colour-emoji font stack: no image or font files.
 */

/** Colour emoji on macOS/iOS, Windows, Chrome OS/Android and Linux, in that order. */
export const EMOJI_FONT =
  "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', 'Android Emoji', 'EmojiOne Color', sans-serif";

// chrome-polish-3 (Gate 2 review 5: "reads as a real app"): FUSE's idea of a hangout, drawn in
// the hall's own wood, ink and gold and the game's serif, not a chat app's slate and sans.
export const HANGOUT_CSS = /* css */ `
.tc-overlay .lr-hg {
  position: absolute; left: 200px; top: 92px; width: 1520px; height: 868px; display: flex;
  border-radius: 18px; overflow: hidden; color: #e8dcc0;
  font-family: var(--tc-font-body), ${EMOJI_FONT}; font-size: 25px; line-height: 1.35;
  background: linear-gradient(180deg, #3a2a1c 0%, #2a1e14 100%);
  border: 2px solid rgba(232,192,106,0.5);
  box-shadow: 0 30px 90px #2a1400b0, 0 0 0 6px #ffd98a22, inset 0 1px 0 #ffffff1a;
  opacity: 0; transform: translateY(26px) scale(0.98); transform-origin: 50% 55%;
  transition: opacity 900ms ease, transform 1100ms cubic-bezier(.2,.7,.2,1);
}
.tc-overlay .lr-hg[data-in] { opacity: 1; transform: none; }
.tc-overlay .lr-hg[data-out] { opacity: 0; transform: scale(0.9); transition-duration: 1400ms, 1600ms; }
.tc-overlay .lr-hg .lr-emo {
  font-family: ${EMOJI_FONT}; font-variant-emoji: emoji; font-style: normal; font-weight: 400;
  line-height: 1; letter-spacing: 0;
}

/* Rail: the server's badge, selected. */
.tc-overlay .lr-hg-rail {
  flex: none; width: 96px; padding-top: 22px; display: flex; flex-direction: column; align-items: center;
  background: #1a120b; border-right: 1px solid #00000055; position: relative;
}
.tc-overlay .lr-hg-rail::before {
  content: ''; position: absolute; left: 0; top: 34px; width: 6px; height: 44px; border-radius: 0 6px 6px 0; background: #fff0b8;
}
.tc-overlay .lr-hg-badge {
  width: 66px; height: 66px; border-radius: 20px; display: grid; place-items: center; font-size: 34px;
  background: radial-gradient(circle at 40% 32%, #fff0b8, #e8c06a 45%, #8a6324 100%);
  box-shadow: 0 0 22px #e8c06a66, inset 0 -3px 0 #5a3c1288;
}

/* Sidebar: the star. */
.tc-overlay .lr-hg-side { flex: none; width: 400px; display: flex; flex-direction: column; background: #241910; }
.tc-overlay .lr-hg-server {
  flex: none; height: 76px; display: flex; align-items: center; padding: 0 24px;
  font-family: var(--tc-font-display); font-weight: 700; font-size: 29px; color: #fff0b8; letter-spacing: 0.5px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border-bottom: 1px solid #00000066; box-shadow: 0 1px 0 #ffffff0d;
}
.tc-overlay .lr-hg-list { position: relative; flex: 1; padding: 14px 12px 0 14px; overflow: hidden; }
.tc-overlay .lr-hg-cat {
  margin: 4px 0 6px 2px; font-size: 17px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #a39a88;
}
.tc-overlay .lr-hg-caret { display: inline-block; width: 20px; font-size: 15px; }
.tc-overlay .lr-hg-ch {
  position: relative; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 60px 0 12px; margin: 1px 0;
  border-radius: 8px; font-size: 23px; color: #8f887b; white-space: nowrap;
  transition: background 300ms ease, color 300ms ease;
}
.tc-overlay .lr-hg-ch .lr-emo { flex: none; min-width: 30px; text-align: center; font-size: 22px; }
.tc-overlay .lr-hg-name { overflow: hidden; text-overflow: ellipsis; }
.tc-overlay .lr-hg-hash { flex: none; color: #6e6a62; font-size: 22px; min-width: 14px; }
.tc-overlay .lr-hg-ch[data-unread] { color: #fbf3e0; font-weight: 600; }
.tc-overlay .lr-hg-ch[data-on] { background: #e8c06a26; color: #fff0b8; font-weight: 600; box-shadow: inset 0 0 0 1px #e8c06a40; }
/* Unread pip: the little pill on the left edge, lit when a channel has new messages. */
.tc-overlay .lr-hg-pip {
  position: absolute; left: -14px; top: 50%; width: 8px; height: 0; margin-top: 0; border-radius: 0 6px 6px 0;
  background: #fff0b8; box-shadow: 0 0 10px #ffd98a; transition: height 260ms ease, margin-top 260ms ease;
}
.tc-overlay .lr-hg-ch[data-unread] .lr-hg-pip { height: 12px; margin-top: -6px; }
.tc-overlay .lr-hg-ch[data-ping] .lr-hg-pip { animation: lr-hg-ping 900ms ease-out; }
@keyframes lr-hg-ping { 0% { height: 0; margin-top: 0; } 35% { height: 26px; margin-top: -13px; } 100% { height: 12px; margin-top: -6px; } }
/* FUSE's face beside the channel he is in. */
.tc-overlay .lr-hg-here {
  position: absolute; right: 20px; top: 0; width: 44px; height: 44px; margin-top: -22px; border-radius: 50%;
  overflow: hidden; background: radial-gradient(circle at 50% 40%, #3a3328, #15130f);
  box-shadow: 0 0 0 2px #ffb03f, 0 0 16px #ffb03f88;
  transition: top 520ms cubic-bezier(.3,.7,.2,1);
}
.tc-overlay .lr-hg-here .lr-hg-face { width: 100% !important; height: 100% !important; }

/* Main pane. */
.tc-overlay .lr-hg-main { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #2f2217; }
.tc-overlay .lr-hg-top {
  flex: none; height: 76px; display: flex; align-items: center; gap: 10px; padding: 0 30px;
  font-weight: 700; font-size: 26px; color: #fbf3e0; border-bottom: 1px solid #00000066; box-shadow: 0 1px 0 #ffffff0d;
}
.tc-overlay .lr-hg-top .lr-hg-hash { font-size: 28px; width: auto; }
/* Phone-only parts (ending-phone-styles.ts): the header's server name and unread count, a channel's start. */
.tc-overlay .lr-hg-badge-count, .tc-overlay .lr-hg-top-server, .tc-overlay .lr-hg-start { display: none; }
.tc-overlay .lr-hg-logs { flex: 1; min-height: 0; position: relative; }
.tc-overlay .lr-hg-log {
  position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end;
  padding: 0 34px 14px; overflow: hidden;
  /* Older messages fade out under the channel bar instead of being cut in half. */
  -webkit-mask-image: linear-gradient(#0000 0, #000 90px); mask-image: linear-gradient(#0000 0, #000 90px);
}
.tc-overlay .lr-hg-msg { display: flex; gap: 20px; align-items: flex-start; padding: 12px 10px; border-radius: 10px; flex: none; }
.tc-overlay .lr-hg-msg:not([data-old]), .tc-overlay .lr-hg-sys { animation: lr-hg-in 380ms ease-out both; }
@keyframes lr-hg-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.tc-overlay .lr-hg-msg[data-pinned] { background: #e8c06a1c; box-shadow: inset 4px 0 0 #e8c06a; }
.tc-overlay .lr-hg-av {
  flex: none; width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; font-size: 32px;
  background: radial-gradient(circle at 38% 30%, hsl(var(--hue) 60% 72%), hsl(var(--hue) 45% 42%) 70%, hsl(var(--hue) 40% 28%));
  box-shadow: inset 0 -3px 0 #0003;
}
.tc-overlay .lr-hg-av-fuse { overflow: hidden; background: radial-gradient(circle at 50% 40%, #3a3328, #15130f); box-shadow: 0 0 0 2px #ffb03f88; }
.tc-overlay .lr-hg-av-fuse .lr-hg-face { width: 100%; height: 100%; display: block; }
.tc-overlay .lr-hg-body { min-width: 0; flex: 1; }
.tc-overlay .lr-hg-meta b { font-weight: 700; color: #fbf3e0; }
.tc-overlay .lr-hg-msg[data-who="fuse"] .lr-hg-meta b { color: #ffb03f; }
.tc-overlay .lr-hg-msg[data-who="thundersoap"] .lr-hg-meta b { color: #e8c06a; }
.tc-overlay .lr-hg-meta small { margin-left: 12px; font-size: 17px; color: #8f887b; }
.tc-overlay .lr-hg-text { margin: 2px 0 0; color: #e8dcc0; overflow-wrap: anywhere; }
.tc-overlay .lr-hg-text .lr-emo { font-size: 1.12em; vertical-align: -0.08em; }
/* FUSE's paper form, clipped to his introduction. */
.tc-overlay .lr-hg-form {
  margin: 10px 0 0; width: 420px; padding: 12px 22px 14px; border-radius: 4px; transform: rotate(-0.6deg);
  font-family: var(--lr-hand); font-size: 25px; line-height: 1.3; color: #2b1a08;
  background: repeating-linear-gradient(#0000 0 31px, #5a412833 31px 33px), linear-gradient(#f6e7c4, #e6cf9c);
  box-shadow: 0 6px 16px #0007, inset 4px 0 0 #c9533a88;
}
.tc-overlay .lr-hg-form small {
  display: block; font-family: var(--tc-font-display); font-size: 15px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #7a5a30;
}
.tc-overlay .lr-hg-form p { margin: 0; }
.tc-overlay .lr-hg-form span { color: #7a5a30; }
/* Reactions: real emoji, counts ticking up. */
.tc-overlay .lr-hg-reacts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.tc-overlay .lr-hg-reacts:empty { display: none; }
.tc-overlay .lr-hg-react {
  display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px 0 10px; border-radius: 20px;
  background: #e8c06a1f; border: 1px solid #e8c06a80; font-size: 20px; font-weight: 700; color: #fff0b8;
  animation: lr-hg-pop 420ms cubic-bezier(.3,1.6,.5,1) both;
}
.tc-overlay .lr-hg-react .lr-emo { font-size: 24px; }
.tc-overlay .lr-hg-count { min-width: 1.2em; font-variant-numeric: tabular-nums; }
@keyframes lr-hg-pop { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: none; } }
/* System lines: his arrival, a pin. */
.tc-overlay .lr-hg-sys { flex: none; padding: 12px 10px 12px 30px; color: #a39a88; font-size: 23px; }
.tc-overlay .lr-hg-sys b { color: #fbf3e0; }
.tc-overlay .lr-hg-sys .lr-hg-reacts { margin-left: 50px; }
.tc-overlay .lr-hg-arrow { display: inline-block; width: 50px; margin-left: -10px; color: #3fe89a; font-weight: 700; }
/* Message bar: FUSE types here, then sends. */
.tc-overlay .lr-hg-compose {
  flex: none; margin: 0 34px; height: 66px; border-radius: 12px; display: flex; align-items: center; padding: 0 24px;
  background: #45321f; border: 1px solid #ffffff12; color: #fbf3e0; white-space: nowrap; overflow: hidden;
}
.tc-overlay .lr-hg-placeholder { color: #7d776c; }
.tc-overlay .lr-hg-compose[data-typing] .lr-hg-placeholder { display: none; }
.tc-overlay .lr-hg-compose[data-typing] { border-color: #ffb03f66; }
.tc-overlay .lr-hg-caret-bar { display: none; width: 3px; height: 1.1em; margin-left: 2px; background: #ffb03f; animation: lr-hg-blink 1s steps(1) infinite; }
.tc-overlay .lr-hg-compose[data-typing] .lr-hg-caret-bar { display: inline-block; }
@keyframes lr-hg-blink { 50% { opacity: 0; } }
.tc-overlay .lr-hg-typing { flex: none; height: 40px; margin: 0 34px; padding-top: 6px; font-size: 18px; color: #a39a88; display: flex; align-items: center; gap: 6px; }
.tc-overlay .lr-hg-typing b { color: #e8dcc0; }
.tc-overlay .lr-hg-dots { display: inline-flex; gap: 4px; margin-right: 6px; }
.tc-overlay .lr-hg-dots i { width: 7px; height: 7px; border-radius: 50%; background: #e8dcc0; animation: lr-hg-dot 1.1s ease-in-out infinite; }
.tc-overlay .lr-hg-dots i:nth-child(2) { animation-delay: 0.15s; }
.tc-overlay .lr-hg-dots i:nth-child(3) { animation-delay: 0.3s; }
@keyframes lr-hg-dot { 0%, 60%, 100% { opacity: 0.35; transform: none; } 30% { opacity: 1; transform: translateY(-4px); } }

/* Bigger text: a wider sidebar and tighter rows, so every channel still fits. */
.tc-overlay[data-text-scale] .lr-hg { left: 120px; width: 1680px; top: 70px; height: 920px; }
.tc-overlay[data-text-scale] .lr-hg-rail { width: 84px; }
.tc-overlay[data-text-scale] .lr-hg-side { width: 560px; }
.tc-overlay[data-text-scale] .lr-hg-server { font-size: 25px; padding: 0 20px; }
.tc-overlay[data-text-scale] .lr-hg-ch { height: auto; min-height: 44px; padding: 1px 54px 1px 10px; margin: 0; gap: 8px; }
.tc-overlay[data-text-scale] .lr-hg-ch .lr-emo { margin-right: 2px; }
.tc-overlay[data-text-scale] .lr-hg-log { padding: 0 24px 10px; }
.tc-overlay[data-text-scale] .lr-hg-compose, .tc-overlay[data-text-scale] .lr-hg-typing { margin: 0 24px; }
.tc-overlay[data-text-scale] .lr-hg-server, .tc-overlay[data-text-scale] .lr-hg-top { height: 70px; }
.tc-overlay[data-text-scale] .lr-hg-form { width: 520px; }

/* Reduced motion: things appear; nothing bounces, slides or blinks. */
.tc-overlay .lr-hg[data-still], .tc-overlay .lr-hg[data-still] * { animation: none !important; }
.tc-overlay .lr-hg[data-still], .tc-overlay .lr-hg[data-still] .lr-hg-here { transform: none; transition-property: opacity; }
.tc-overlay .lr-hg[data-still] .lr-hg-here { transition: none; }
`;
