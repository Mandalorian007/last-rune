/**
 * Game-specific overlay CSS (design px; the overlay scales it). Procedural only:
 * gradients and shadows, no images or fonts fetched. Scoped under `.tc-overlay`.
 */

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
.tc-overlay .lr-title p {
  margin: 18px 0 0; font-size: 30px; color: #c9b9e6; letter-spacing: 8px; text-transform: uppercase;
  text-shadow: 0 2px 8px #000;
}
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
.tc-overlay .lr-hud kbd { font-family: var(--tc-font-mono); font-size: 20px; opacity: 0.7; margin-left: 10px; }

.tc-overlay .lr-nameplate {
  position: absolute; transform: translate(-50%, 0); padding: 8px 22px; border-radius: 10px;
  font-family: var(--tc-font-display); font-size: 26px; letter-spacing: 1px; white-space: nowrap;
  color: #f4e6c4; background: linear-gradient(180deg, rgba(40,32,22,0.92), rgba(20,16,12,0.92));
  border: 2px solid rgba(232,192,106,0.55); box-shadow: 0 6px 18px rgba(0,0,0,0.6);
  pointer-events: none;
}
.tc-overlay .lr-nameplate[hidden] { display: none; }
.tc-overlay .lr-nameplate small { display: block; font-size: 20px; color: #bfae8a; letter-spacing: 0; }

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
  position: relative; padding: 52px 64px 40px; color: var(--lr-ink);
  background:
    radial-gradient(ellipse at 50% 45%, #f4e9cf 0%, #e6d4ad 70%, #c9ad7c 100%);
  display: grid; grid-template-columns: 1fr 230px; grid-template-rows: auto auto 1fr auto; column-gap: 28px;
}
.tc-overlay .lr-codex-page h3 {
  grid-column: 1 / -1; margin: 0 0 18px; font-family: var(--tc-font-display); font-size: 52px; letter-spacing: 2px;
  color: #3b2414; border-bottom: 2px solid rgba(59,36,20,0.3); padding-bottom: 10px;
}
.tc-overlay .lr-codex-page h3 small { font-size: 24px; letter-spacing: 1px; color: #7a5a3a; margin-left: 14px; }
.tc-overlay .lr-niche {
  grid-column: 1; justify-self: center; width: 250px; height: 250px; border-radius: 50%; position: relative;
  background: radial-gradient(circle at 50% 40%, #59606e, #2c313b 60%, #161920 100%);
  box-shadow: inset 0 10px 24px rgba(0,0,0,0.75), inset 0 -4px 8px rgba(255,255,255,0.08), 0 2px 0 rgba(255,255,255,0.4);
}
.tc-overlay .lr-niche .lr-gem {
  position: absolute; left: 50%; top: 50%; width: 140px; height: 140px; transform: translate(-50%, -50%) rotate(45deg);
  border-radius: 18px; background: radial-gradient(circle at 35% 30%, #fff 0%, var(--gem) 30%, color-mix(in srgb, var(--gem) 45%, #000) 100%);
  box-shadow: 0 0 40px 8px color-mix(in srgb, var(--gem) 60%, transparent), inset 0 0 18px rgba(255,255,255,0.4);
  animation: lr-gem-glow 3s ease-in-out infinite;
}
@keyframes lr-gem-glow { 50% { box-shadow: 0 0 64px 16px color-mix(in srgb, var(--gem) 70%, transparent), inset 0 0 22px rgba(255,255,255,0.55); } }
.tc-overlay .lr-niche--locked { filter: saturate(0.4); }
.tc-overlay .lr-niche--locked::before, .tc-overlay .lr-niche--locked::after {
  content: ''; position: absolute; left: -20px; top: 50%; width: 290px; height: 28px; border-radius: 14px;
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
.tc-overlay .lr-codex-rule { grid-column: 1; margin: 26px 0 0; font-size: 30px; line-height: 1.4; }
.tc-overlay .lr-codex-maths {
  grid-column: 1; margin: 18px 0 0; font-family: var(--tc-font-mono); font-size: 24px; color: #5a3d22;
  padding: 12px 16px; border-left: 4px solid rgba(90,61,34,0.4); background: rgba(90,61,34,0.07);
}
.tc-overlay .lr-codex-locked { grid-column: 1; margin: 26px 0 0; font-size: 28px; font-style: italic; color: #5d4630; }
.tc-overlay .lr-margin {
  grid-column: 2; grid-row: 2 / 5; align-self: start; margin-top: 10px; padding: 16px 14px;
  font-family: var(--tc-font-mono); font-size: 20px; line-height: 1.4; color: #6b3b10;
  transform: rotate(2deg); border-left: 3px dashed rgba(140,80,20,0.45);
}
.tc-overlay .lr-margin b { display: block; font-size: 16px; letter-spacing: 2px; opacity: 0.7; margin-bottom: 6px; }
.tc-overlay .lr-codex-folio { grid-column: 1 / -1; align-self: end; text-align: center; font-size: 22px; color: #7a5a3a; }
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
.tc-overlay .lr-codex-nav .lr-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; margin-right: 8px; vertical-align: 0; }
.tc-overlay .lr-codex-close {
  position: absolute; right: 46px; top: 46px; z-index: 4; width: 56px; height: 56px; min-height: 0; padding: 0;
  border-radius: 50%; font-size: 30px; line-height: 1; cursor: pointer; color: #3b2414;
  background: rgba(59,36,20,0.1); border: 2px solid rgba(59,36,20,0.4);
}
.tc-overlay .lr-new { display: inline-block; margin-left: 12px; padding: 2px 10px; border-radius: 10px; font-size: 18px; vertical-align: 8px; color: #fff; background: #a3341f; letter-spacing: 1px; }

/* ── Settings ──────────────────────────────────────────────────────────── */
.tc-overlay .lr-settings { width: 860px; display: flex; flex-direction: column; gap: 12px; }
.tc-overlay .lr-settings section { display: flex; flex-direction: column; gap: 6px; }
.tc-overlay .lr-settings h3 { margin: 6px 0 0; font-size: 26px; letter-spacing: 2px; text-transform: uppercase; color: var(--tc-color-accent); }
.tc-overlay .lr-settings label.lr-field { display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 26px; }
.tc-overlay .lr-settings select {
  font: inherit; font-size: 24px; min-height: 46px; padding: 0 14px; border-radius: 8px; color: var(--tc-color-text);
  background: var(--tc-color-surface-alt); border: 2px solid var(--tc-color-border);
}
.tc-overlay .lr-settings textarea {
  width: 100%; box-sizing: border-box; height: 64px; font-family: var(--tc-font-mono); font-size: 18px;
  color: var(--tc-color-text); background: rgba(0,0,0,0.35); border: 2px solid var(--tc-color-border); border-radius: 8px; padding: 10px;
}
.tc-overlay .lr-settings .lr-row { display: flex; flex-wrap: wrap; gap: 14px; }
.tc-overlay .lr-settings .lr-note { font-size: 22px; color: var(--tc-color-warn); margin: 0; }
.tc-overlay .lr-confirm { width: 720px; font-size: 28px; }
.tc-overlay .lr-confirm .lr-row { display: flex; gap: 16px; justify-content: flex-end; margin-top: 24px; }
`;

let injected: WeakSet<Document> | null = null;

export function ensureGameStyles(doc: Document = document): void {
  injected ??= new WeakSet();
  if (injected.has(doc)) return;
  injected.add(doc);
  const el = doc.createElement('style');
  el.dataset.lr = 'game';
  el.textContent = CSS;
  doc.head.append(el);
}
