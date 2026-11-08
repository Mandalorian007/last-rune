/**
 * Game-specific overlay CSS (design px: `toFrameUnits` scales it with the canvas frame).
 * Procedural only: gradients and shadows, no images or fonts fetched. Scoped under `.tc-overlay`.
 */

import { scaleFontSizes, toFrameUnits } from '@thunderclap-engine/engine/ui';
import { CHROME_CSS } from './chrome-styles';
import { PHONE_BASE_CSS, PHONE_ROOT_CSS } from './phone-base';

/**
 * A design-px game stylesheet as injected: fonts follow Settings → Text size, then every px is
 * one design px of the frame (`toFrameUnits`).
 */
export const designSheet = (css: string): string => toFrameUnits(scaleFontSizes(css));

/** Palette names from the pitch, as CSS colours for DOM UI. */
export const CSS_PALETTE = {
  cyan: '#3fe0ff',
  amethyst: '#a66bff',
  magenta: '#ff4fbf',
  amber: '#ffb03f',
  emerald: '#3fe89a',
  ice: '#a8dcff',
  slate: '#6c7488',
  gold: '#e8c06a',
  parchment: '#eadcbc',
  ink: '#2a1d14',
} as const;

const CSS = /* css */ `
.tc-overlay {
  --lr-gold: ${CSS_PALETTE.gold};
  --lr-gold-hi: #fff0b8;
  --lr-gold-lo: #8a6324;
  --lr-amethyst: ${CSS_PALETTE.amethyst};
  --lr-parchment: ${CSS_PALETTE.parchment};
  --lr-ink: ${CSS_PALETTE.ink};
  --lr-leather: #4a2717;
}

/* ── Title ─────────────────────────────────────────────────────────────── */
.tc-overlay .lr-title {
  position: absolute; left: 0; top: 150px; width: 1920px; text-align: center;
  pointer-events: none;
}
.tc-overlay .lr-title h1 {
  margin: 0; font-family: var(--tc-font-display); font-size: 150px; font-weight: 700;
  letter-spacing: 6px; line-height: 1;
  background: linear-gradient(180deg, var(--lr-gold-hi) 0%, var(--lr-gold) 45%, var(--lr-gold-lo) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 4px 0 #3b1d5e) drop-shadow(0 10px 18px rgba(120, 60, 200, 0.55));
}
/* The title view embosses the name in the canvas; keep the heading for screen readers. */
.tc-overlay .lr-title[data-canvas] h1 {
  position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);
  white-space: nowrap;
}
.tc-overlay .lr-title[data-canvas] p { margin-top: 196px; }
/* Upright phones (chrome-polish-3): the picture is a slice centred on x 560 (TITLE_UPRIGHT) and
   the view draws the name smaller there; the subtitle follows it, a size up so it still reads. */
.tc-overlay .lr-title[data-upright] { left: -400px; top: 60px; }
.tc-overlay .lr-title[data-canvas][data-upright] p { margin-top: 170px; font-size: 36px; letter-spacing: 5px; }
/* Phones on their side (polish-8): the view draws the name at y 330, scale 0.8 (title-view
   COMPACT_TITLE), so the band can hold FUSE whole; the subtitle sits just under it. */
.tc-overlay .lr-title[data-compact] { top: 270px; }
.tc-overlay .lr-title[data-canvas][data-compact] p { margin-top: 136px; font-size: 34px; }
.tc-overlay .lr-title p {
  margin: 18px 0 0; font-size: 30px; color: #c9b9e6; letter-spacing: 8px; text-transform: uppercase;
  text-shadow: 0 2px 8px #000;
}
.tc-overlay .lr-release {
  position: absolute; right: 24px; top: 20px; margin: 0;
  font: 500 14px/1 var(--tc-font-ui, system-ui, sans-serif); letter-spacing: 0.08em;
  color: rgb(255 255 255 / 0.45); text-transform: uppercase; pointer-events: none;
}
/* Ko-fi and its Copy link, bottom right; a blocked copy or tab opens a field just above them. */
.tc-overlay .tc-link.lr-title-links { position: absolute; right: 28px; bottom: 26px; align-items: flex-end; }
.tc-overlay .lr-title-links .tc-link-row { gap: 10px; }
.tc-overlay .lr-title-coffee {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 8px 18px; border-radius: 999px; text-decoration: none; pointer-events: auto;
  font: 22px/1.2 var(--tc-font-body); color: #e8d6b0;
  background: rgb(20 12 30 / 0.55); border: 1px solid rgb(232 192 106 / 0.35);
}
.tc-overlay .lr-title-coffee:hover { color: #fff3d6; border-color: rgb(232 192 106 / 0.8); }
.tc-overlay .lr-title-coffee:focus-visible { outline: var(--tc-focus-ring) solid var(--tc-color-focus); outline-offset: 4px; }
.tc-overlay .lr-title-coffee .lr-coffee-icon { width: 1.3em; height: 1.3em; flex: none; color: #e8c06a; }
/* The engine link widget's Copy link and fallback (D-036), in the title's warm colours and the game serif. */
.tc-overlay .tc-link-copy, .tc-overlay .tc-link-message, .tc-overlay .tc-link-close { font-family: var(--tc-font-body); }
.tc-overlay .tc-link-copy { color: #e8d6b0; background: rgb(20 12 30 / 0.55); border-color: rgb(232 192 106 / 0.3); }
.tc-overlay .tc-link-copy:hover { color: #fff3d6; border-color: rgb(232 192 106 / 0.8); }
.tc-overlay .tc-link-copy[data-copied] { color: #c8f5cc; border-color: rgb(150 225 160 / 0.8); }
.tc-overlay .tc-link-fallback { background: rgb(16 10 24 / 0.96); border-color: rgb(232 192 106 / 0.6); }
.tc-overlay .tc-link-message { color: #f3e6c8; }
.tc-overlay .tc-link-field { color: #fff; background: #0c0814; border-color: rgb(232 192 106 / 0.6); }
.tc-overlay .lr-title-menu {
  position: absolute; left: 50%; top: 610px; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 22px; pointer-events: auto;
}

/* Gold plate buttons (title, solve stub, puzzle stub). */
.tc-overlay .lr-gold-button {
  min-width: 360px; min-height: 84px; padding: 0 48px; border-radius: 14px; cursor: pointer;
  font-family: var(--tc-font-display); font-size: 40px; font-weight: 700; letter-spacing: 3px;
  color: #2a1906;
  background: linear-gradient(180deg, #fff1b5 0%, #e8c06a 38%, #b98a34 70%, #8a6324 100%);
  border: 3px solid #5a3d12;
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.7), inset 0 -4px 0 rgba(0,0,0,0.25),
    0 8px 24px rgba(0,0,0,0.6), 0 0 32px rgba(232,192,106,0.35);
  text-shadow: 0 1px 0 rgba(255,255,255,0.6);
}
.tc-overlay .lr-gold-button:hover { filter: brightness(1.08); box-shadow: inset 0 2px 0 rgba(255,255,255,0.7), inset 0 -4px 0 rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.6), 0 0 56px rgba(255,214,120,0.6); }
.tc-overlay .lr-gold-button:focus-visible { outline: var(--tc-focus-ring) solid var(--tc-color-focus); outline-offset: 6px; }
.tc-overlay .lr-stone-button {
  min-width: 300px; min-height: 68px; padding: 0 36px; border-radius: 12px; cursor: pointer;
  font-family: var(--tc-font-display); font-size: 30px; letter-spacing: 2px; color: #e8dcc0;
  background: linear-gradient(180deg, #4b5162 0%, #2c303b 100%);
  border: 2px solid rgba(232,192,106,0.45);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 6px 18px rgba(0,0,0,0.55);
}
.tc-overlay .lr-stone-button:hover { border-color: var(--lr-gold); color: #fff6dd; }
.tc-overlay .lr-stone-button:focus-visible { outline: var(--tc-focus-ring) solid var(--tc-color-focus); outline-offset: 4px; }

/* ── HUD ───────────────────────────────────────────────────────────────── */
/* Top-left corner is the one patch of wall the hall layout leaves clear. */
.tc-overlay .lr-hud { position: absolute; left: 28px; top: 24px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; pointer-events: auto; }
.tc-overlay .lr-hud[hidden] { display: none; }
.tc-overlay .lr-hud button { min-width: 0; min-height: 56px; font-size: 24px; padding: 0 22px; }
/* Key hints are keycaps in the UI sans, so a letter never reads as a digit ("O" vs "0"). */
.tc-overlay .lr-hud kbd {
  display: inline-block; min-width: 34px; margin-left: 14px; padding: 0 8px; box-sizing: border-box;
  font-family: var(--tc-font-ui); font-size: 19px; font-weight: 600; line-height: 28px; text-align: center;
  font-variant-numeric: slashed-zero; letter-spacing: 0; color: #f4e6c4;
  background: linear-gradient(180deg, #5d6375 0%, #3a3f4d 100%);
  border: 1px solid rgba(232,192,106,0.5); border-bottom-width: 3px; border-radius: 7px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
}

.tc-overlay .lr-nameplate {
  position: absolute; transform: translate(-50%, 0); padding: 8px 22px; border-radius: 10px;
  font-family: var(--tc-font-display); font-size: 26px; letter-spacing: 1px; white-space: nowrap;
  color: #f4e6c4; background: linear-gradient(180deg, rgba(40,32,22,0.92), rgba(20,16,12,0.92));
  border: 2px solid rgba(232,192,106,0.55); box-shadow: 0 6px 18px rgba(0,0,0,0.6);
  pointer-events: none;
}
.tc-overlay .lr-nameplate[hidden] { display: none; }
.tc-overlay .lr-nameplate small { display: block; font-size: 20px; color: #bfae8a; letter-spacing: 0; }

/* ── FUSE caption card ─────────────────────────────────────────────────────
   Docked low in its corner and wide enough that the longest card (127 chars) takes three
   lines, so it stays under FUSE's wheel line in the hall (y 866) and below the alcoves. The
   speaker's name sits under the portrait. Scenes move it off things with fuse.keepClear(). */
.tc-overlay { --tc-caption-max-width: 800px; --tc-caption-margin: 24px; }
.tc-overlay .tc-caption { gap: 16px; padding: 14px 22px; }
.tc-overlay .tc-caption-side .tc-caption-speaker { font-size: 19px; }

/* Toasts speak in the game serif like the rest of the UI chrome (finish-1). */
.tc-overlay .tc-toast { font-family: var(--tc-font-body); font-size: 26px; }

/* ── FUSE portrait placeholder (art-props replaces it) ─────────────────── */
.tc-overlay .lr-fuse-portrait {
  position: relative; width: 96px; height: 96px; border-radius: 22px;
  background: radial-gradient(circle at 35% 30%, #d9a75a, #8b5a22 55%, #3c2410 100%);
  border: 3px solid #2b1a0b; box-shadow: inset 0 -6px 12px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.6);
}
.tc-overlay .lr-fuse-eye { position: absolute; top: 34px; width: 22px; height: 22px; border-radius: 50%; }
.tc-overlay .lr-fuse-eye--live { left: 18px; background: radial-gradient(circle, #fff3c0, #ffb03f 45%, #b8560f); box-shadow: 0 0 16px 4px rgba(255,170,60,0.8); }
.tc-overlay .lr-fuse-eye--dead { right: 18px; background: radial-gradient(circle, #3a3a3a, #111); }

/* ── Puzzle / solve stubs ──────────────────────────────────────────────── */
.tc-overlay .lr-stub-card {
  position: absolute; left: 50%; top: 360px; transform: translateX(-50%); width: 980px;
  padding: 40px 56px; border-radius: 18px; text-align: center; pointer-events: auto;
  color: #efe4c8; background: rgba(16,18,26,0.9); border: 2px solid rgba(232,192,106,0.5);
  box-shadow: 0 16px 60px rgba(0,0,0,0.7);
}
.tc-overlay .lr-stub-card h2 { margin: 0 0 8px; font-family: var(--tc-font-display); font-size: 56px; color: var(--lr-gold); }
.tc-overlay .lr-stub-card p { margin: 8px 0 28px; font-size: 26px; color: #b9ae96; }
.tc-overlay .lr-stub-card .lr-row { display: flex; gap: 20px; justify-content: center; }
.tc-overlay .lr-badge {
  position: absolute; left: 50%; top: 160px; transform: translateX(-50%); min-width: 620px;
  padding: 26px 48px; border-radius: 16px; text-align: center; pointer-events: none;
  background: linear-gradient(180deg, #fff1b5 0%, #e8c06a 40%, #a87a2c 100%);
  border: 3px solid #5a3d12; color: #2a1906; box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 60px rgba(255,214,120,0.4);
  animation: lr-slide-in 600ms var(--tc-easing) both;
}
.tc-overlay .lr-badge h2 { margin: 0; font-family: var(--tc-font-display); font-size: 52px; }
.tc-overlay .lr-badge p { margin: 6px 0 0; font-size: 26px; }
.tc-overlay .lr-badge .lr-gem-dot { display: inline-block; width: 34px; height: 34px; border-radius: 50%; vertical-align: -4px; margin-right: 14px; box-shadow: 0 0 18px currentColor; background: currentColor; }
@keyframes lr-slide-in { from { opacity: 0; transform: translate(-50%, -40px); } to { opacity: 1; transform: translate(-50%, 0); } }
.tc-overlay .lr-page-note {
  position: absolute; left: 60px; bottom: 60px; width: 520px; padding: 28px 32px; pointer-events: none;
  color: var(--lr-ink); font-size: 24px; font-style: italic; line-height: 1.45;
  background: radial-gradient(ellipse at 50% 40%, #f3e8cc, #d8c39a 80%, #b99c6a);
  box-shadow: 0 10px 30px rgba(0,0,0,0.6); transform: rotate(-3deg);
}
.tc-overlay .lr-page-note b { display: block; font-style: normal; font-size: 20px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.7; margin-bottom: 8px; }

/* ── Codex: leather tome ───────────────────────────────────────────────── */
.tc-overlay .lr-codex {
  position: relative; width: 1560px; height: 900px; padding: 34px; box-sizing: border-box;
  border-radius: 26px;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255,200,140,0.10), transparent 60%),
    repeating-radial-gradient(circle at 70% 60%, rgba(0,0,0,0.05) 0 2px, transparent 2px 5px),
    linear-gradient(160deg, #5a3020 0%, var(--lr-leather) 45%, #2a140b 100%);
  box-shadow: inset 0 0 0 4px #2a140b, inset 0 0 40px rgba(0,0,0,0.6), 0 30px 80px rgba(0,0,0,0.8);
}
.tc-overlay .lr-codex::before, .tc-overlay .lr-codex::after,
.tc-overlay .lr-codex .lr-corner-bl, .tc-overlay .lr-codex .lr-corner-br {
  content: ''; position: absolute; width: 90px; height: 90px; z-index: 2; pointer-events: none;
  background: linear-gradient(135deg, #fff0b8 0%, #d6a94e 35%, #8a6324 75%, #5a3d12 100%);
  box-shadow: 0 3px 6px rgba(0,0,0,0.6);
}
.tc-overlay .lr-codex::before { left: -6px; top: -6px; clip-path: polygon(0 0, 100% 0, 0 100%); border-top-left-radius: 26px; }
.tc-overlay .lr-codex::after { right: -6px; top: -6px; clip-path: polygon(0 0, 100% 0, 100% 100%); border-top-right-radius: 26px; }
.tc-overlay .lr-codex .lr-corner-bl { left: -6px; bottom: -6px; clip-path: polygon(0 0, 100% 100%, 0 100%); border-bottom-left-radius: 26px; }
.tc-overlay .lr-codex .lr-corner-br { right: -6px; bottom: -6px; clip-path: polygon(100% 0, 100% 100%, 0 100%); border-bottom-right-radius: 26px; }
.tc-overlay .lr-codex-spread {
  position: relative; display: grid; grid-template-columns: 1fr 1fr; height: 100%;
  border-radius: 8px; overflow: hidden;
  box-shadow: 0 0 0 3px #1c0d06, 0 8px 20px rgba(0,0,0,0.5);
}
.tc-overlay .lr-codex-spread::after {
  content: ''; position: absolute; left: calc(50% - 40px); top: 0; width: 80px; height: 100%; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(60,35,10,0.35) 45%, rgba(30,15,5,0.55) 50%, rgba(60,35,10,0.35) 55%, transparent);
}
.tc-overlay .lr-codex-page {
  position: relative; padding: 44px 60px 34px; color: var(--lr-ink);
  background:
    radial-gradient(ellipse at 50% 45%, #f4e9cf 0%, #e6d4ad 70%, #c9ad7c 100%);
  display: grid; grid-template-columns: 1fr 230px; grid-template-rows: auto auto auto auto auto 1fr auto; column-gap: 28px;
  overflow-y: auto; overscroll-behavior: contain;
}
.tc-overlay .lr-codex-page h3 {
  grid-column: 1 / -1; margin: 0; font-family: var(--tc-font-display); font-size: 52px; letter-spacing: 2px;
  color: #3b2414; border-bottom: 2px solid rgba(59,36,20,0.3); padding-bottom: 8px;
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px;
}
/* Where you stand with the gem: Yours (filled), Seen (outlined), Not met yet (grey). */
.tc-overlay .lr-status {
  font-size: 20px; letter-spacing: 2px; text-transform: uppercase;
  padding: 3px 14px; border-radius: 999px; border: 2px solid currentColor; line-height: 1.3;
}
.tc-overlay .lr-status[data-status='yours'] { color: #fff7e0; background: #5f4316; border-color: #5f4316; }
.tc-overlay .lr-status[data-status='seen'] { color: #5f4316; background: rgba(255,255,255,0.35); border-style: dashed; }
.tc-overlay .lr-status[data-status='unknown'] { color: #5d5650; }
.tc-overlay .lr-codex-status { grid-column: 1 / -1; margin: 10px 0 14px; font-size: 22px; font-style: italic; color: #5d4630; }
.tc-overlay .lr-codex-status[data-status='seen'] { color: #6a3f12; }
/* The gem on a square of altar stone, with the bolt going in and out of it. */
.tc-overlay .lr-plate {
  grid-column: 1; grid-row: 3; justify-self: center; position: relative; width: 270px; height: 270px;
  border-radius: 20px; overflow: hidden; background: #22262f;
  box-shadow: 0 0 0 3px #3b2414, 0 0 0 6px rgba(214,169,78,0.55), 0 8px 18px rgba(0,0,0,0.45);
}
.tc-overlay .lr-plate-gem { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.tc-overlay .lr-plate-gem--css::after {
  content: ''; position: absolute; left: 50%; top: 50%; width: 46%; height: 46%; transform: translate(-50%, -50%) rotate(45deg);
  border-radius: 14%; background: radial-gradient(circle at 35% 30%, #fff 0%, var(--gem) 30%, color-mix(in srgb, var(--gem) 45%, #000) 100%);
  box-shadow: 0 0 40px 8px color-mix(in srgb, var(--gem) 60%, transparent);
}
.tc-overlay .lr-plate-bolt { position: absolute; inset: 0; pointer-events: none; }
.tc-overlay .lr-plate-bolt svg { width: 100%; height: 100%; display: block; overflow: visible; filter: drop-shadow(0 0 3px rgba(80,200,255,0.9)); }
.tc-overlay .lr-plate-bolt line { stroke: #9cf0ff; stroke-width: 3.2; stroke-linecap: round; }
.tc-overlay .lr-plate-bolt polygon { fill: #9cf0ff; stroke: #9cf0ff; stroke-width: 1; stroke-linejoin: round; }
/* glyph-truth-4: a one-way gem's port is a hollow ring, as on the gem. */
.tc-overlay .lr-plate-bolt circle { fill: none; stroke: #9cf0ff; stroke-width: 2.6; }
/* Charge chips and fizzle marks: the altar's own look (scenes/altar/altar-styles.ts). */
.tc-overlay .lr-plate-chip {
  position: absolute; transform: translate(-50%, -50%); min-width: 1.5em; padding: 0 0.35em; box-sizing: border-box; border-radius: 999px; white-space: nowrap;
  font-family: var(--tc-font-display); font-size: 20px; line-height: 1.25; text-align: center; color: #eaf8ff;
  background: rgba(10,18,26,0.88); border: 2px solid rgba(120,200,255,0.75); box-shadow: 0 0 10px rgba(80,180,255,0.45);
}
.tc-overlay .lr-plate-chip[data-kind='out'] { border-color: #3fe0ff; color: #dff9ff; }
.tc-overlay .lr-plate-nogo {
  position: absolute; width: 24px; height: 24px; transform: translate(-50%, -50%); border-radius: 50%;
  background: rgba(30,6,4,0.9); border: 2px solid #ff5a3c; box-shadow: 0 0 8px rgba(255,90,60,0.7);
}
.tc-overlay .lr-plate-nogo::before, .tc-overlay .lr-plate-nogo::after {
  content: ''; position: absolute; left: 50%; top: 50%; width: 13px; height: 3px; background: #ffb4a4;
  border-radius: 2px; transform: translate(-50%, -50%) rotate(45deg);
}
.tc-overlay .lr-plate-nogo::after { transform: translate(-50%, -50%) rotate(-45deg); }
.tc-overlay .lr-niche {
  grid-column: 1; grid-row: 3; justify-self: center; width: 230px; height: 230px; border-radius: 50%; position: relative;
  background: radial-gradient(circle at 50% 40%, #59606e, #2c313b 60%, #161920 100%);
  box-shadow: inset 0 10px 24px rgba(0,0,0,0.75), inset 0 -4px 8px rgba(255,255,255,0.08), 0 2px 0 rgba(255,255,255,0.4);
}
.tc-overlay .lr-niche--locked { filter: saturate(0.4); }
.tc-overlay .lr-niche--locked::before, .tc-overlay .lr-niche--locked::after {
  content: ''; position: absolute; left: -20px; top: 50%; width: 270px; height: 28px; border-radius: 14px;
  background: repeating-linear-gradient(90deg, #8d8f96 0 22px, #3e4048 22px 26px, #b5b7bd 26px 44px, #3e4048 44px 48px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.6);
}
.tc-overlay .lr-niche--locked::before { transform: rotate(35deg); }
.tc-overlay .lr-niche--locked::after { transform: rotate(-35deg); }
.tc-overlay .lr-padlock {
  position: absolute; left: 50%; top: 50%; width: 64px; height: 52px; transform: translate(-50%, -10%); z-index: 1;
  border-radius: 8px; background: linear-gradient(180deg, #e3c06e, #8a6324); box-shadow: 0 4px 8px rgba(0,0,0,0.6);
}
.tc-overlay .lr-padlock::before {
  content: ''; position: absolute; left: 12px; top: -30px; width: 40px; height: 40px; box-sizing: border-box;
  border: 8px solid #a8a9ae; border-bottom: none; border-radius: 20px 20px 0 0;
}
.tc-overlay .lr-codex-rule { grid-column: 1 / -1; grid-row: 4; margin: 22px 0 0; font-size: 28px; line-height: 1.4; }
.tc-overlay .lr-codex-maths {
  grid-column: 1 / -1; grid-row: 5; justify-self: start; margin: 14px 0 0; font-family: var(--tc-font-body); font-size: 24px; color: #5a3d22;
  padding: 10px 16px; border-left: 4px solid rgba(90,61,34,0.4); background: rgba(90,61,34,0.07);
}
.tc-overlay .lr-margin {
  grid-column: 2; grid-row: 3; align-self: center; padding: 16px 14px;
  font-family: var(--tc-font-body); font-style: italic; font-size: 20px; line-height: 1.4; color: #6b3b10;
  transform: rotate(2deg); border-left: 3px dashed rgba(140,80,20,0.45);
}
.tc-overlay .lr-margin:empty { border: none; }
.tc-overlay .lr-margin b { display: block; font-style: normal; font-size: 16px; letter-spacing: 2px; margin-bottom: 6px; }
.tc-overlay .lr-codex-folio { grid-column: 1 / -1; grid-row: 7; align-self: end; text-align: center; font-size: 22px; color: #5e4329; }
/* Bigger text: the plate keeps its size and FUSE's note takes the rest of the row, so the
   note stays short and the page still fits the spread (it scrolls if it ever doesn't). */
/* The book also grows to the full panel height (90% of the screen) so the late pages
   (Gate, Capacitor) fit at 150% without scrolling or running under the tab row. */
.tc-overlay[data-text-scale] .lr-codex { height: 972px; padding-bottom: 40px; }
.tc-overlay[data-text-scale] .lr-codex-rule { line-height: 1.3; }
.tc-overlay[data-text-scale] .lr-codex-page { padding: 32px 48px 22px; column-gap: 26px; grid-template-columns: 240px 1fr; }
.tc-overlay[data-text-scale] .lr-plate { width: 240px; height: 240px; }
.tc-overlay[data-text-scale] .lr-niche { width: 180px; height: 180px; }
.tc-overlay[data-text-scale] .lr-niche--locked::before, .tc-overlay[data-text-scale] .lr-niche--locked::after { width: 220px; }
.tc-overlay[data-text-scale] .lr-margin { transform: none; }
.tc-overlay[data-text-scale] .lr-codex-status { margin: 6px 0 12px; }
.tc-overlay[data-text-scale] .lr-codex-rule { margin-top: 14px; }
.tc-overlay[data-text-scale] .lr-codex-maths { margin-top: 10px; }
.tc-overlay .lr-codex-head {
  position: absolute; left: 0; right: 0; top: -2px; z-index: 3; text-align: center; pointer-events: none;
  font-size: 22px; letter-spacing: 2px; color: #f0d79c; text-shadow: 0 1px 2px #000;
}
.tc-overlay .lr-codex-nav {
  position: absolute; left: 0; right: 0; bottom: -4px; z-index: 3; display: flex; justify-content: center; gap: 14px;
}
.tc-overlay .lr-codex-nav button {
  min-width: 0; min-height: 40px; height: 40px; padding: 0 18px; border-radius: 20px; cursor: pointer;
  font-family: var(--tc-font-display); font-size: 20px; color: #2a1906; border: 2px solid #5a3d12;
  background: linear-gradient(180deg, #f6dc94, #b98a34);
}
.tc-overlay .lr-codex-nav button[aria-current='true'] { background: linear-gradient(180deg, #fff6d0, #e8c06a); box-shadow: 0 0 14px rgba(255,214,120,0.7); }
.tc-overlay .lr-codex-nav button:focus-visible { outline: var(--tc-focus-ring) solid var(--tc-color-focus); outline-offset: 3px; }
.tc-overlay .lr-codex-nav .lr-dot { display: inline-block; width: 14px; height: 14px; box-sizing: border-box; border-radius: 50%; margin-right: 8px; vertical-align: 0; background: var(--gem); }
.tc-overlay .lr-codex-nav [data-status='seen'] .lr-dot { background: transparent; border: 3px solid var(--gem); }
.tc-overlay .lr-codex-nav [data-status='unknown'] .lr-dot { background: #6c7488; }
.tc-overlay .lr-codex-close {
  position: absolute; right: 46px; top: 46px; z-index: 4; width: 56px; height: 56px; min-height: 0; padding: 0;
  border-radius: 50%; font-size: 30px; line-height: 1; cursor: pointer; color: #3b2414;
  background: rgba(59,36,20,0.1); border: 2px solid rgba(59,36,20,0.4);
}
.tc-overlay .lr-new { display: inline-block; margin-left: 12px; padding: 2px 10px; border-radius: 10px; font-size: 18px; vertical-align: 8px; color: #fff; background: #a3341f; letter-spacing: 1px; }

/* ── Settings ──────────────────────────────────────────────────────────── */
.tc-overlay .lr-settings { width: 1440px; display: flex; flex-direction: column; gap: 12px; }
.tc-overlay .lr-settings-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 64px; align-items: start; }
.tc-overlay .lr-settings-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
/* Volume sliders read like the other fields (same face and size) and line up in a column. */
.tc-overlay .lr-settings .tc-field { font-family: inherit; font-size: 26px; gap: 20px; }
.tc-overlay .lr-settings .tc-field > span { flex: 0 0 8.5em; }
/* Done stays in reach: pinned to the bottom of the panel while the rest scrolls (large text). */
.tc-overlay .lr-settings .lr-settings-done {
  position: sticky; bottom: -1px; justify-content: flex-end; padding: 14px 0 4px; margin-top: 4px;
  background: linear-gradient(to bottom, transparent, var(--tc-color-surface) 14px); border-top: 1px solid var(--tc-color-border);
}
/* The book is sized to fit; only its brass corners poke 6px out, which must not scroll. */
.tc-overlay .tc-panel.lr-codex-host { overflow: visible; }
/* Any panel that still has to scroll shows a scrollbar in the theme, never a hidden one. */
.tc-overlay .tc-panel { scrollbar-width: auto; scrollbar-color: var(--tc-color-accent) rgba(0,0,0,0.3); }
.tc-overlay .lr-settings section { display: flex; flex-direction: column; gap: 6px; }
.tc-overlay .lr-settings h3 { margin: 6px 0 0; font-size: 26px; letter-spacing: 2px; text-transform: uppercase; color: var(--tc-color-accent); }
.tc-overlay .lr-settings label.lr-field { display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 26px; }
.tc-overlay .lr-settings select {
  font: inherit; font-size: 24px; min-height: 46px; padding: 0 14px; border-radius: 8px; color: var(--tc-color-text);
  background: var(--tc-color-surface-alt); border: 2px solid var(--tc-color-border);
}
.tc-overlay .lr-settings textarea {
  width: 100%; box-sizing: border-box; height: calc(64px + (var(--tc-text-scale, 1) - 1) * 72px); font-family: var(--tc-font-mono); font-size: 18px;
  color: var(--tc-color-text); background: rgba(0,0,0,0.35); border: 2px solid var(--tc-color-border); border-radius: 8px; padding: 10px;
}
.tc-overlay .lr-settings .lr-row { display: flex; flex-wrap: wrap; gap: 14px; }
/* Desktop only (settings-panel.ts): Quit sits at the far left of the Done row, away from Done. */
.tc-overlay .lr-settings .lr-settings-done .lr-quit { margin-right: auto; }
.tc-overlay .lr-settings .lr-note { font-size: 22px; color: var(--tc-color-warn); margin: 0; }
.tc-overlay .lr-confirm { width: 720px; font-size: 28px; }
.tc-overlay .lr-confirm .lr-row { display: flex; gap: 16px; justify-content: flex-end; margin-top: 24px; }
`;

let injected: WeakSet<Document> | null = null;

/**
 * Injects the game sheet, the phone sheet (the base rules, then `scenePhone`: each scene's own
 * phone rules, handed in by game/ctx.ts) and the phone chrome sheet.
 */
export function ensureGameStyles(doc: Document = document, scenePhone = ''): void {
  injected ??= new WeakSet();
  if (injected.has(doc)) return;
  injected.add(doc);
  const el = doc.createElement('style');
  el.dataset.lr = 'game';
  el.textContent = designSheet(CSS);
  // Phone overrides outrank scene sheets by specificity, so their load order doesn't matter.
  const phone = doc.createElement('style');
  phone.dataset.lr = 'phone';
  phone.textContent = designSheet(PHONE_BASE_CSS + scenePhone);
  // Phone chrome in CSS px (ui/chrome.ts): menus, panels, HUD, FUSE's lane. Not rewritten.
  const chrome = doc.createElement('style');
  chrome.dataset.lr = 'chrome';
  chrome.textContent = PHONE_ROOT_CSS + scaleFontSizes(CHROME_CSS);
  doc.head.append(el, phone, chrome);
}
