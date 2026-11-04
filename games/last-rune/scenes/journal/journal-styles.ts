/**
 * Journal desk DOM styles (design px; the overlay scales). Injected once.
 *
 * `--lr-hand` is the Builder's hand, which is also FUSE's incident-report face
 * (clue 2): the journal pages, the ending's incident report, and the
 * post-credits clipboard all use it. System fonts only, nothing fetched.
 */
import { scaleFontSizes } from '@thunderclap/engine/ui';

export const HAND_FONT =
  "'Bradley Hand', 'Segoe Print', 'Ink Free', 'Snell Roundhand', 'Apple Chancery', 'URW Chancery L', 'Comic Neue', cursive";

const CSS = /* css */ `
.tc-overlay { --lr-hand: ${HAND_FONT}; --lr-ink-brown: #2a1d14; }
.tc-overlay .lr-hud button[hidden] { display: none; }
.tc-overlay .lr-hud button[data-unread]::after {
  content: ''; width: 12px; height: 12px; border-radius: 50%; margin-left: 10px;
  background: radial-gradient(circle at 35% 35%, #fff0b8, #e8b64a 60%, #7a4c10);
  box-shadow: 0 0 12px #e8b64a;
}

.tc-overlay .lr-journal { position: absolute; inset: 0; pointer-events: none; color: var(--lr-ink-brown); }
.tc-overlay .lr-journal button:not(.lr-stone-button) { pointer-events: auto; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; min-width: 0; min-height: 0; }
.tc-overlay .lr-journal button:focus-visible { outline: 3px solid var(--tc-color-focus, #ffd36b); outline-offset: 4px; border-radius: 6px; }

.tc-overlay .lr-j-head { position: absolute; left: 76px; top: 34px; color: #e8dcc0; text-shadow: 0 2px 8px #000a; }
.tc-overlay .lr-j-head h1 { margin: 0; font-family: var(--tc-font-display); font-size: 54px; letter-spacing: 3px; color: #f0d79a; font-weight: 700; }
.tc-overlay .lr-j-head p { margin: 2px 0 0; font-size: 22px; letter-spacing: 2px; color: #bfa77c; text-transform: uppercase; }

.tc-overlay .lr-journal .lr-j-slip {
  color: var(--lr-ink-brown);   position: absolute; display: flex; align-items: center; gap: 16px; box-sizing: border-box;
  padding: 0 18px 0 22px; font-family: var(--lr-hand); font-size: 25px; white-space: nowrap;
  transition: transform 220ms ease, opacity 220ms ease;
}
.tc-overlay .lr-j-slip b { font-size: 30px; min-width: 38px; font-weight: 700; }
.tc-overlay .lr-j-slip span { opacity: 1; }
.tc-overlay .lr-journal .lr-j-slip[data-blank] { cursor: default; color: #c9ad82; border: 2px dashed #a8875a66; border-radius: 4px; font-family: var(--tc-font-ui); font-size: 18px; letter-spacing: 2px; text-transform: uppercase; }
.tc-overlay .lr-j-slip[data-blank] b { font-family: var(--lr-hand); font-size: 26px; letter-spacing: 0; text-transform: none; opacity: 0.9; }
.tc-overlay .lr-j-slip[data-blank] span { opacity: 0.9; }
.tc-overlay .lr-j-key i { display: none; }
.tc-overlay .lr-j-slip .lr-j-new {
  margin-left: auto; font-family: var(--tc-font-ui); font-size: 15px; letter-spacing: 2px; text-transform: uppercase;
  color: #fff3d0; background: radial-gradient(circle at 40% 35%, #b8322a, #6e120e); border-radius: 14px; padding: 4px 10px;
  box-shadow: 0 1px 3px #0008, inset 0 1px 1px #ffffff40;
}

.tc-overlay .lr-j-spread { position: absolute; transition: opacity 260ms ease; }
.tc-overlay .lr-j-spread[data-turning] { opacity: 0; }
.tc-overlay .lr-j-date { position: absolute; white-space: nowrap; font-family: var(--lr-hand); font-size: 34px; font-weight: 700; color: #3a2614; }
.tc-overlay .lr-j-body {
  position: absolute; margin: 0; font-family: var(--lr-hand); font-size: 35px; line-height: 54px; color: #24170f;
  column-count: 2; column-fill: auto; text-wrap: pretty; text-shadow: 0 0 1px #24170f55;
}
.tc-overlay .lr-j-body[data-long] { font-size: 31px; }
.tc-overlay .lr-j-folio { position: absolute; font-family: var(--lr-hand); font-size: 26px; color: #3d2818; width: 120px; text-align: center; }
.tc-overlay .lr-j-sketch { position: absolute; overflow: visible; }
.tc-overlay .lr-j-sketch path { fill: none; stroke: #2a1d14; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; opacity: 0.78; }
.tc-overlay .lr-j-sketch circle { fill: none; stroke: #5a3a1c; stroke-width: 5; opacity: 0.16; }
.tc-overlay .lr-j-sign { position: absolute; overflow: visible; }
.tc-overlay .lr-j-sign path { fill: none; stroke: #24170f; stroke-width: 2.4; stroke-linecap: round; opacity: 0.85; }
.tc-overlay .lr-j-sign text { font-family: var(--lr-hand); fill: #24170f; opacity: 0.9; }
.tc-overlay .lr-j-empty { position: absolute; font-family: var(--lr-hand); font-size: 34px; color: #4a3520; text-align: center; }

.tc-overlay .lr-journal .lr-j-turn { position: absolute; width: 64px; height: 64px; font-size: 44px; line-height: 60px; text-align: center; color: #3a2614; font-family: var(--lr-hand); border-radius: 50%; }
.tc-overlay .lr-journal .lr-j-turn:hover { color: #000; background: #ffffff22; }
.tc-overlay .lr-journal .lr-j-turn[hidden] { display: none; }

.tc-overlay .lr-j-plate {
  position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; box-sizing: border-box;
  /* FUSE's voice in the game serif. It grows with Text size only as far as three lines still fit the plate. */
  padding: 0 70px; font-family: var(--tc-font-body); font-size: min(calc(29px * var(--tc-text-scale, 1)), 38px);
  line-height: 1.2; color: #e9d9b4; letter-spacing: 0.2px;
  text-shadow: 0 -1px 0 #000, 0 1px 0 #ffffff1a;
}
.tc-overlay .lr-j-plate::before {
  content: ''; flex: none; width: 14px; height: 14px; border-radius: 50%; margin-right: 18px;
  background: radial-gradient(circle at 40% 40%, #fff1c9, #ffb03f 55%, #7a4c10); box-shadow: 0 0 14px #ffb03f;
}
.tc-overlay .lr-j-plate[data-blank]::before { opacity: 0.25; box-shadow: none; }

.tc-overlay .lr-j-back { position: absolute; left: 76px; top: 994px; pointer-events: auto; }
.tc-overlay .lr-j-back kbd { font-family: var(--tc-font-mono); font-size: 18px; opacity: 0.7; margin-left: 10px; }

@media (prefers-reduced-motion: reduce) {
  .tc-overlay .lr-j-slip, .tc-overlay .lr-j-spread { transition: none; }
}
.tc-overlay[data-reduced-motion] .lr-j-slip, [data-reduced-motion] .lr-j-slip,
[data-reduced-motion] .lr-j-spread { transition: none; }
`;

export function ensureJournalStyles(doc: Document): void {
  if (doc.getElementById('lr-journal-styles')) return;
  const el = doc.createElement('style');
  el.id = 'lr-journal-styles';
  el.textContent = scaleFontSizes(CSS);
  doc.head.append(el);
}
