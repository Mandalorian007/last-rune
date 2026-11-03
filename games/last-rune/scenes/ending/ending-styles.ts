/**
 * Ending DOM styles (design px; the overlay scales). Injected once.
 * The hangout window (hangout-styles.ts), title card, safety record, credits, end card
 * and the post-credits clipboard.
 */
import { scaleFontSizes } from '../../ui/text-scale';
import { HAND_FONT } from '../journal/journal-styles';
import { HANGOUT_CSS } from './hangout-styles';

const CSS = /* css */ `
.tc-overlay { --lr-hand: ${HAND_FONT}; }
.tc-overlay .lr-ending { position: absolute; inset: 0; pointer-events: none; }
.tc-overlay .lr-ending a, .tc-overlay .lr-ending button { pointer-events: auto; }
/* Class rules set display; keep the hidden attribute authoritative (the end card stays unclickable until shown). */
.tc-overlay .lr-ending [hidden] { display: none !important; }

/* ── Title card, safety record, credits ─────────────────────────────────── */
.tc-overlay .lr-end-title {
  position: absolute; left: 0; right: 0; top: 92px; text-align: center; opacity: 0; transition: opacity 1600ms ease;
  isolation: isolate;
}
/* A scrim so the lines stay readable over the ending's bright bloom. */
.tc-overlay .lr-end-title::before {
  content: ''; position: absolute; z-index: -1; left: 12%; right: 12%; top: -50px; bottom: -50px;
  background: radial-gradient(closest-side, #1c0d02c8, #1c0d0290 55%, #1c0d0200);
}
.tc-overlay .lr-end-title[data-in] { opacity: 1; }
.tc-overlay .lr-end-title h2 {
  margin: 0; font-family: var(--tc-font-display); font-weight: 700; font-size: 62px; letter-spacing: 1px;
  color: #fff6dc; text-shadow: 0 2px 4px #3a1e00, 0 4px 24px #2a1400cc;
}
/* Three lines (D-032): the two follow-ups are smaller and tight, so the card clears the safety slip. */
.tc-overlay .lr-end-title h2 + h2 { font-size: 40px; line-height: 1.25; margin-top: 10px; color: #ffe7b0; }
.tc-overlay .lr-end-safety {
  position: absolute; left: 50%; top: 372px; width: 980px; margin-left: -490px; text-align: center;
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
/* Bigger text: a wider safety record (fewer lines) and the card a little lower, so they never meet. */
.tc-overlay[data-text-scale] .lr-end-safety { width: 1240px; margin-left: -620px; padding: 20px 40px; }
.tc-overlay[data-text-scale] .lr-end-card { top: 660px; gap: 16px; }
.tc-overlay .lr-end-card { position: absolute; left: 0; right: 0; top: 610px; display: flex; flex-direction: column; align-items: center; gap: 22px; opacity: 0; transition: opacity 1200ms ease; }
.tc-overlay .lr-end-card[data-in] { opacity: 1; }
.tc-overlay .lr-end-card a.lr-end-join {
  display: inline-flex; align-items: center; gap: 16px; padding: 22px 48px; border-radius: 14px; text-decoration: none;
  font-family: var(--tc-font-display); font-size: 36px; font-weight: 700; color: #2a1600;
  background: linear-gradient(#ffe8a8, #e9b04a 55%, #b9761f); box-shadow: 0 10px 34px #ffb43a88, inset 0 2px 0 #fff8, inset 0 -3px 0 #7a4a1088;
}
.tc-overlay .lr-end-card a.lr-end-join:hover { filter: brightness(1.08); }
.tc-overlay .lr-end-card a.lr-end-join:focus-visible { outline: 4px solid #fff; outline-offset: 5px; }
.tc-overlay .lr-end-card a.lr-end-join::after { content: '\\2197'; font-size: 26px; opacity: 0.7; }
.tc-overlay .lr-end-card a.lr-end-coffee {
  display: inline-flex; align-items: center; gap: 12px; padding: 10px 26px; border-radius: 999px; text-decoration: none;
  font-family: var(--tc-font-body); font-size: 24px; color: #fff1cc; border: 2px solid #ffe3a055; background: #2a1606c0;
}
.tc-overlay .lr-end-card a.lr-end-coffee:hover { background: #3c220bd8; border-color: #ffe3a0aa; }
.tc-overlay .lr-end-card a.lr-end-coffee:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
.tc-overlay .lr-coffee-icon { width: 1.25em; height: 1.25em; flex: none; }
/* Each link with its Copy link (engine widget, D-036): the button hangs off the link's right side so the link stays centred. */
.tc-overlay .lr-end-links .tc-link-row { position: relative; }
.tc-overlay .lr-end-links .tc-link-copy {
  position: absolute; left: 100%; margin-left: 18px; color: #fff1cc; background: #2a1606c0; border: 2px solid #ffe3a055;
}
.tc-overlay .lr-end-links .tc-link-copy:hover { background: #3c220bd8; border-color: #ffe3a0aa; }
.tc-overlay .lr-end-links .tc-link-copy:focus-visible { outline: 3px solid #fff; outline-offset: 4px; }
.tc-overlay .lr-end-links .tc-link-copy[data-copied] { color: #d8ffd8; border-color: #a8e8a8cc; }
.tc-overlay .lr-end-footer {
  margin: 0; padding: 16px 90px; font-family: var(--tc-font-body); font-size: 27px; color: #fff4dc;
  text-shadow: 0 1px 3px #2a1400, 0 2px 12px #2a1400aa;
  background: radial-gradient(closest-side, #1c0d02d8, #1c0d02a0 55%, #1c0d0200);
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
  position: absolute; inset: 0; margin: 0; padding: 30px 10px 0; box-sizing: border-box;
  /* A page on a prop: it grows with Text size only as far as it still fits the clipboard. */
  font-family: var(--lr-hand); font-size: min(calc(24px * var(--lr-text-scale, 1)), 27px); line-height: 1.3; color: #24170f;
  background: linear-gradient(#f3e4c0, #e4cd98); border-radius: 2px; box-shadow: 0 1px 2px #0006;
  backface-visibility: hidden;
}
.tc-overlay .lr-clip-note p.lr-clip-form { background-image: repeating-linear-gradient(#0000 0 24px, #5a412840 24px 26px), linear-gradient(#f3e4c0, #e4cd98); transform-origin: 50% 0; transition: transform 1100ms cubic-bezier(.5,0,.3,1); }
.tc-overlay .lr-clip-note[data-flip] p.lr-clip-form { transform: rotateX(178deg); }
.tc-overlay .lr-clip-note p.lr-clip-day { opacity: 0; transition: opacity 400ms ease 500ms; }
.tc-overlay .lr-clip-note[data-flip] p.lr-clip-day { opacity: 1; }

[data-reduced-motion] .lr-end-safety, [data-reduced-motion] .lr-end-credits div,
[data-reduced-motion] .lr-clip-note p.lr-clip-form { transition-property: opacity; transform: none !important; }
@media (prefers-reduced-motion: reduce) {
  .tc-overlay .lr-end-credits div, .tc-overlay .lr-clip-note p.lr-clip-form { transition-property: opacity; }
}
`;

export function ensureEndingStyles(doc: Document): void {
  if (doc.getElementById('lr-ending-styles')) return;
  const el = doc.createElement('style');
  el.id = 'lr-ending-styles';
  el.textContent = scaleFontSizes(HANGOUT_CSS + CSS);
  doc.head.append(el);
}
