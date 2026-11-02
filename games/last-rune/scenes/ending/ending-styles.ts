/**
 * Ending DOM styles (design px; the overlay scales). Injected once.
 * The chat mock is deliberately "a very different kind of screen": flat, dark,
 * system UI type. Everything after it returns to the game's gold.
 */
import { HAND_FONT } from '../journal/journal-styles';

const CSS = /* css */ `
.tc-overlay { --lr-hand: ${HAND_FONT}; }
.tc-overlay .lr-ending { position: absolute; inset: 0; pointer-events: none; }
.tc-overlay .lr-ending a, .tc-overlay .lr-ending button { pointer-events: auto; }
/* Class rules set display; keep the hidden attribute authoritative (the end card stays unclickable until shown). */
.tc-overlay .lr-ending [hidden] { display: none !important; }

/* ── Chat mock ─────────────────────────────────────────────────────────── */
.tc-overlay .lr-chat {
  position: absolute; left: 260px; top: 150px; width: 1400px; height: 780px; display: flex;
  border-radius: 14px; overflow: hidden; background: #313338; color: #dbdee1;
  font: 400 26px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  box-shadow: 0 30px 90px #000c, 0 0 0 1px #ffffff10;
  opacity: 0; transform-origin: 50% 50%;
  transition: opacity 900ms ease, transform 1400ms cubic-bezier(.6,0,.2,1), border-radius 1400ms ease;
}
.tc-overlay .lr-chat[data-in] { opacity: 1; }
.tc-overlay .lr-chat[data-shrink] { transform: scale(0.06); opacity: 0; border-radius: 80px; transition-duration: 1600ms, 1600ms, 1600ms; }
.tc-overlay .lr-chat-servers { width: 92px; background: #1e1f22; display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 18px; }
.tc-overlay .lr-chat-servers i { width: 58px; height: 58px; border-radius: 50%; background: #2b2d31; display: block; }
.tc-overlay .lr-chat-servers i[data-on] { border-radius: 18px; background: radial-gradient(circle at 40% 35%, #ffe39a, #d79a2b 60%, #6b4210); box-shadow: 0 0 18px #d79a2b88; }
.tc-overlay .lr-chat-side { width: 300px; background: #2b2d31; padding: 22px 0; }
.tc-overlay .lr-chat-side h3 { margin: 0 20px 18px; font-size: 26px; font-weight: 700; color: #f2f3f5; }
.tc-overlay .lr-chat-side p { margin: 2px 12px; padding: 6px 12px; border-radius: 6px; font-size: 24px; color: #949ba4; }
.tc-overlay .lr-chat-side p[data-on] { background: #404249; color: #f2f3f5; }
.tc-overlay .lr-chat-main { flex: 1; display: flex; flex-direction: column; }
.tc-overlay .lr-chat-top { height: 70px; display: flex; align-items: center; padding: 0 26px; border-bottom: 1px solid #1f2023; font-weight: 700; color: #f2f3f5; }
.tc-overlay .lr-chat-log { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 30px 20px; gap: 8px; }
.tc-overlay .lr-chat-msg { display: flex; gap: 20px; align-items: flex-start; margin-top: 18px; }
.tc-overlay .lr-chat-av {
  flex: none; width: 64px; height: 64px; border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, #ffcf6a 0 9px, #b8741c 10px 12px, #2a2622 13px 100%);
  box-shadow: inset 0 0 0 3px #4a4038;
}
.tc-overlay .lr-chat-msg b { color: #f0b232; font-weight: 600; }
.tc-overlay .lr-chat-msg small { color: #949ba4; font-size: 18px; margin-left: 10px; }
.tc-overlay .lr-chat-msg .lr-chat-tag { font-size: 15px; background: #5865f2; color: #fff; border-radius: 4px; padding: 1px 6px; margin-left: 8px; vertical-align: 3px; }
.tc-overlay .lr-chat-text { margin: 2px 0 0; min-height: 36px; white-space: pre-wrap; }
.tc-overlay .lr-chat-line { margin: 4px 0 0; }
.tc-overlay .lr-chat-caret { display: inline-block; width: 3px; height: 1.05em; margin-left: 2px; background: #dbdee1; vertical-align: -0.15em; animation: lr-blink 1s steps(1) infinite; }
@keyframes lr-blink { 50% { opacity: 0; } }
.tc-overlay .lr-chat-input { margin: 0 30px 26px; height: 64px; border-radius: 10px; background: #383a40; display: flex; align-items: center; padding: 0 22px; color: #6d6f78; }
.tc-overlay .lr-chat-react { display: flex; gap: 10px; margin: 14px 0 0 84px; flex-wrap: wrap; }
.tc-overlay .lr-chat-react span {
  display: flex; align-items: center; gap: 10px; padding: 4px 12px 4px 6px; border-radius: 20px;
  background: #2b2d31; border: 1px solid #3f4147; font-size: 20px; color: #b5bac1;
  opacity: 0; transform: translateY(8px) scale(0.9); transition: opacity 400ms ease, transform 400ms ease;
}
.tc-overlay .lr-chat-react span[data-in] { opacity: 1; transform: none; border-color: #5865f2aa; background: #5865f222; }
.tc-overlay .lr-chat-react i { width: 30px; height: 30px; border-radius: 50%; display: block; }
.tc-overlay .lr-chat-typing { margin: 6px 0 0 84px; font-size: 18px; color: #949ba4; height: 24px; }

/* ── Title card, safety record, credits ─────────────────────────────────── */
.tc-overlay .lr-end-title {
  position: absolute; left: 0; right: 0; top: 150px; text-align: center; opacity: 0; transition: opacity 1600ms ease;
}
.tc-overlay .lr-end-title[data-in] { opacity: 1; }
.tc-overlay .lr-end-title h2 {
  margin: 0; font-family: var(--tc-font-display); font-weight: 700; font-size: 62px; letter-spacing: 1px;
  color: #fff6dc; text-shadow: 0 2px 4px #3a1e00, 0 4px 24px #2a1400cc;
}
.tc-overlay .lr-end-title h2 + h2 { font-size: 44px; margin-top: 18px; color: #ffe7b0; }
.tc-overlay .lr-end-safety {
  position: absolute; left: 50%; top: 380px; width: 980px; margin-left: -490px; text-align: center;
  font-family: var(--lr-hand); font-size: 38px; line-height: 1.35; color: #2b1a08;
  padding: 26px 40px; box-sizing: border-box; border-radius: 6px;
  background: linear-gradient(#f6e7c4, #ead3a0); box-shadow: 0 16px 40px #3a200066, inset 0 0 40px #b0884a55;
  transform: rotate(-1.2deg) translateY(10px); opacity: 0; transition: opacity 1200ms ease, transform 1200ms ease;
}
.tc-overlay .lr-end-safety[data-in] { opacity: 1; transform: rotate(-1.2deg); }
.tc-overlay .lr-end-safety small { display: block; font-family: var(--tc-font-ui); font-size: 18px; letter-spacing: 3px; text-transform: uppercase; color: #7a5a30; margin-bottom: 6px; }
.tc-overlay .lr-end-credits { position: absolute; z-index: 0; left: 0; right: 0; top: 650px; text-align: center; color: #fff4d8; text-shadow: 0 1px 3px #2a1400, 0 2px 14px #2a1400aa; }
/* A soft dark backing so the credits read over the gold flood (fades in with the credits). */
.tc-overlay .lr-end-credits::before {
  content: ''; position: absolute; z-index: -1; left: 50%; top: -64px; width: 1240px; height: 220px; margin-left: -620px;
  background: radial-gradient(closest-side, #1c0d02c4, #1c0d0290 45%, #1c0d0200);
  opacity: 0; transition: opacity 1400ms ease; pointer-events: none;
}
.tc-overlay .lr-end-credits[data-in]::before { opacity: 1; }
.tc-overlay .lr-end-credits div { opacity: 0; transform: translateY(14px); transition: opacity 1000ms ease, transform 1000ms ease; margin-bottom: 26px; }
.tc-overlay .lr-end-credits div[data-in] { opacity: 1; transform: none; }
.tc-overlay .lr-end-credits div[data-out] { opacity: 0; transform: translateY(-14px); }
.tc-overlay .lr-end-credits small { display: block; font-family: var(--tc-font-ui); font-size: 20px; letter-spacing: 4px; text-transform: uppercase; color: #ffe2a0; opacity: 0.85; }
.tc-overlay .lr-end-credits span { font-family: var(--tc-font-display); font-size: 40px; }

/* ── End card ──────────────────────────────────────────────────────────── */
.tc-overlay .lr-end-card { position: absolute; left: 0; right: 0; top: 610px; display: flex; flex-direction: column; align-items: center; gap: 22px; opacity: 0; transition: opacity 1200ms ease; }
.tc-overlay .lr-end-card[data-in] { opacity: 1; }
.tc-overlay .lr-end-row { display: flex; gap: 28px; }
.tc-overlay .lr-end-card a.lr-end-join {
  display: inline-flex; align-items: center; gap: 16px; padding: 22px 48px; border-radius: 14px; text-decoration: none;
  font-family: var(--tc-font-display); font-size: 36px; font-weight: 700; color: #2a1600;
  background: linear-gradient(#ffe8a8, #e9b04a 55%, #b9761f); box-shadow: 0 10px 34px #ffb43a88, inset 0 2px 0 #fff8, inset 0 -3px 0 #7a4a1088;
}
.tc-overlay .lr-end-card a.lr-end-join:hover { filter: brightness(1.08); }
.tc-overlay .lr-end-card a.lr-end-join:focus-visible { outline: 4px solid #fff; outline-offset: 5px; }
.tc-overlay .lr-end-card a.lr-end-join::after { content: '\\2197'; font-size: 26px; opacity: 0.7; }
.tc-overlay .lr-end-card a.lr-end-tip {
  display: inline-flex; align-items: center; padding: 22px 40px; border-radius: 14px; text-decoration: none;
  font-family: var(--tc-font-display); font-size: 32px; color: #fff1cc; border: 2px solid #ffe3a066; background: #3a2408aa;
}
.tc-overlay .lr-end-footer {
  margin: 0; padding: 16px 90px; font-family: var(--tc-font-ui); font-size: 24px; color: #fff4dc;
  text-shadow: 0 1px 3px #2a1400, 0 2px 12px #2a1400aa;
  background: radial-gradient(closest-side, #1c0d02a8, #1c0d0270 50%, #1c0d0200);
}
.tc-overlay .lr-end-back { margin-top: 8px; }

/* ── Skip, clipboard note ─────────────────────────────────────────────── */
.tc-overlay .lr-end-skip { position: absolute; right: 60px; bottom: 50px; }
.tc-overlay .lr-end-skip kbd { font-family: var(--tc-font-mono); font-size: 18px; opacity: 0.7; margin-left: 10px; }
.tc-overlay .lr-clip-note {
  position: absolute; width: 150px; height: 186px; perspective: 900px; transform-origin: 50% 50%;
  opacity: 0; transition: opacity 900ms ease;
}
.tc-overlay .lr-clip-note[data-in] { opacity: 1; }
.tc-overlay .lr-clip-note p {
  position: absolute; inset: 0; margin: 0; padding: 30px 12px 0; box-sizing: border-box;
  font-family: var(--lr-hand); font-size: 21px; line-height: 1.3; color: #24170f;
  background: linear-gradient(#f3e4c0, #e4cd98); border-radius: 2px; box-shadow: 0 1px 2px #0006;
  backface-visibility: hidden;
}
.tc-overlay .lr-clip-note p.lr-clip-form { background-image: repeating-linear-gradient(#0000 0 24px, #5a412840 24px 26px), linear-gradient(#f3e4c0, #e4cd98); transform-origin: 50% 0; transition: transform 1100ms cubic-bezier(.5,0,.3,1); }
.tc-overlay .lr-clip-note[data-flip] p.lr-clip-form { transform: rotateX(178deg); }
.tc-overlay .lr-clip-note p.lr-clip-day { opacity: 0; transition: opacity 400ms ease 500ms; }
.tc-overlay .lr-clip-note[data-flip] p.lr-clip-day { opacity: 1; }

[data-reduced-motion] .lr-chat, [data-reduced-motion] .lr-end-safety,
[data-reduced-motion] .lr-end-credits div, [data-reduced-motion] .lr-chat-react span,
[data-reduced-motion] .lr-clip-note p.lr-clip-form { transition-property: opacity; transform: none !important; }
[data-reduced-motion] .lr-chat-caret { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .tc-overlay .lr-chat, .tc-overlay .lr-end-credits div, .tc-overlay .lr-clip-note p.lr-clip-form { transition-property: opacity; }
}
`;

export function ensureEndingStyles(doc: Document): void {
  if (doc.getElementById('lr-ending-styles')) return;
  const el = doc.createElement('style');
  el.id = 'lr-ending-styles';
  el.textContent = CSS;
  doc.head.append(el);
}
