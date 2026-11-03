/**
 * Phone and touch overrides (D-039, mobile-2; flags from ui/device-mode.ts).
 *
 * - `[data-touch]`: key caps hide (a finger has no keys).
 * - `[data-phone]`: the design is drawn at 0.30–0.35 CSS px per design px. A phone gets its own
 *   layout, board first: chrome is compact icon buttons in the letterbox bars beside the 16:9
 *   canvas (`--lr-bar`), the HUD folds behind one ☰, and every transient card (gem chip, hint,
 *   verdict, FUSE's bubble) keeps to a margin of the screen, never over the board. Text is
 *   12–13 CSS px (`--lr-text-min` floors every scaled size at 12). Controls keep a 44 CSS px
 *   hit area (`--lr-tap`) through an invisible `::before`; drawn boxes stay compact.
 *
 * Sizes here are written in CSS px through `cpx(n)` (n CSS px in design px) or `tpx(n)` (the
 * same, following Settings → Text size), so they hold on every phone. Overrides use `P`, which
 * outranks any scene stylesheet whatever the load order.
 */

/** n CSS px, as a design-px length (phones only; the variable is unset elsewhere). */
export const cpx = (n: number) => `calc(var(--lr-css-px, 1px) * ${n})`;
/** n CSS px of text, grown by Settings → Text size. */
export const tpx = (n: number) => `calc(var(--lr-css-px, 1px) * ${n} * var(--lr-text-scale, 1))`;
/** Phone root selector, ranked above every `.tc-overlay .class` rule. */
export const P = '.tc-overlay[data-phone]:not(#lr-none)';
/** Touch root selector, same rank. */
export const T = '.tc-overlay[data-touch]:not(#lr-none)';

/** Left edge of the left bar column / right edge of the right one, 3 CSS px in from the bar's edge. */
const BAR_IN = `calc(-1 * var(--lr-bar, 0px) + ${cpx(3)})`;
/** An edge-column button: 44 CSS px square. */
const COL = cpx(44);

/* mobile-3-chrome */
/** The visible band's top and bottom edges when the art fills the width (D-040; 0 otherwise). */
const CT = 'var(--lr-crop-t, 0px)';
const CB = 'var(--lr-crop-b, 0px)';
const CHROME_CSS = /* css */ `
/* ── mobile-3-chrome: title, hall and menus (D-040) ─────────────────────────
   Title and hall fill the width (game/ctx.ts FILL_BANDS); the canvas overflows top and bottom by
   --lr-crop-t/-b design px, so chrome anchored to the design's edges moves in by the crop. */
${P} .lr-hud { top: calc(${CT} + ${cpx(4)}); }
${P} .tc-caption[data-corner^="bottom"] { bottom: calc(${CB} + var(--tc-caption-margin)); }
${P} .tc-caption[data-corner^="top"] { top: calc(${CT} + var(--tc-caption-margin)); }
${P} .tc-layer[data-layer="panels"], ${P} .tc-layer[data-layer="toasts"] { top: ${CT}; bottom: ${CB}; }
/* FUSE's lines break evenly, never one word alone on the last line. */
${P} .tc-caption-text { text-wrap: balance; }

/* Title: Play is the one big gold button; the rest are a full thumb tall. The menu sits just
   under the subtitle so three buttons fit above the bottom edge on every phone. */
${P} .lr-title-menu { top: 450px; gap: ${cpx(8)}; }
${P} .lr-title-menu .lr-gold-button {
  min-width: ${cpx(150)}; min-height: ${cpx(48)}; padding: 0 ${cpx(20)}; border-radius: ${cpx(9)};
  font-size: ${tpx(19)}; letter-spacing: 1px; border-width: 2px;
}
${P} .lr-title-menu .lr-stone-button { min-width: ${cpx(150)}; min-height: ${cpx(44)}; font-size: ${tpx(15)}; border-radius: ${cpx(8)}; }
${P} .lr-fullscreen { left: ${cpx(8)}; top: calc(${CT} + ${cpx(6)}); min-height: ${cpx(36)}; padding: 0 ${cpx(12)}; font-size: ${tpx(13)}; }
${P} .lr-release { top: calc(${CT} + ${cpx(8)}); right: ${cpx(10)}; }
${P} .tc-link.lr-title-links { right: ${cpx(8)}; bottom: calc(${CB} + ${cpx(6)}); }
${P} .lr-title-links .tc-link-row { gap: ${cpx(8)}; }
/* Hall: the suggested door, unmistakable at phone size: a pulsing gold outline and a tag on
   its top edge (kept inside the visible band). Off phones neither shows. */
.tc-overlay:not([data-phone]) :is(.lr-hall-next, .lr-hall-next-tag, .lr-hud-note) { display: none !important; }
${P} .lr-hall-next {
  position: absolute; box-sizing: border-box; pointer-events: none;
  border: ${cpx(2)} solid #ffd77a; border-radius: 46% 46% ${cpx(8)} ${cpx(8)} / 30% 30% ${cpx(8)} ${cpx(8)};
  box-shadow: 0 0 ${cpx(6)} rgb(255 205 110 / 0.8), inset 0 0 ${cpx(6)} rgb(255 205 110 / 0.5);
  animation: lr-next-pulse 1.6s ease-in-out infinite;
}
${P} .lr-hall-next[data-round] { border-radius: 50%; }
${P} .lr-hall-next-tag {
  position: absolute; top: max(calc(var(--lr-next-top, 0px) - ${cpx(10)}), calc(${CT} + ${cpx(3)})); transform: translateX(-50%);
  pointer-events: none; white-space: nowrap; padding: ${cpx(2)} ${cpx(8)}; border-radius: ${cpx(9)};
  font: 700 ${tpx(12)}/1.2 var(--tc-font-display, serif); letter-spacing: 0.5px; color: #2a1906;
  background: linear-gradient(180deg, #fff1b5, #e8c06a 60%, #b98a34); border: 1px solid #5a3d12;
  box-shadow: 0 ${cpx(1)} ${cpx(5)} rgb(0 0 0 / 0.7);
}
${P} .lr-hall-next-tag::after { content: ' ▾'; }
@keyframes lr-next-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
@media (prefers-reduced-motion: reduce) { ${P} .lr-hall-next { animation: none; } }
[data-reduced-motion] ${P} .lr-hall-next { animation: none; }
/* The ☰ list says what its dot means. */
${P} .lr-hud[data-open] > button[data-action="journal"] { flex-direction: column; align-items: flex-end; justify-content: center; line-height: 1.15; }
${P} .lr-hud-note { display: block; font: italic ${tpx(11)}/1.1 var(--tc-font-body, serif); color: #ffb27a; letter-spacing: 0; }
${P} .lr-hud-note[hidden] { display: none; }
/* Nothing of the hall's chrome shows through an open panel (Settings, Codex). */
${P}:has(.tc-panel-host[data-modal="true"]) :is(.lr-hud, .lr-hall-next, .lr-hall-next-tag) { visibility: hidden; }

/* Codex: the book fits the visible band; a readable header; tabs a thumb tall (the strip
   scrolls sideways if every gem is met); bigger text that uses the whole page; FUSE's note in
   dark ink; the × matches the other panels' ✕. */
${P} .lr-codex {
  height: calc(1080px - ${CT} - ${CB} - ${cpx(6)}); padding: ${cpx(22)} ${cpx(6)} ${cpx(46)};
}
${P} .lr-codex-head { top: ${cpx(3)}; font-size: ${tpx(13)}; letter-spacing: 0.5px; color: #f8e6b8; }
${P} .lr-codex-nav {
  bottom: ${cpx(5)}; gap: ${cpx(5)}; justify-content: safe center; overflow-x: auto; scrollbar-width: none;
  padding: 0 ${cpx(10)};
}
${P} .lr-codex-nav button {
  flex: none; min-height: ${cpx(36)}; height: ${cpx(36)}; padding: 0 ${cpx(11)}; border-radius: ${cpx(18)};
  font-size: ${tpx(13)};
}
${P} .lr-codex-nav .lr-dot { width: ${cpx(9)}; height: ${cpx(9)}; margin-right: ${cpx(4)}; }
${P} .lr-codex-page {
  padding: ${cpx(8)} ${cpx(14)} ${cpx(4)}; grid-template-columns: ${cpx(88)} 1fr; column-gap: ${cpx(12)};
  font-size: ${tpx(14)}; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none;
}
/* The shortest phones (SE, 320 tall): a touch smaller so a page's rule and maths fit above the tabs. */
@media (max-height: 330px) {
  ${P} .lr-codex-page { font-size: ${tpx(13)}; grid-template-columns: ${cpx(76)} 1fr; }
  ${P} .lr-plate { width: ${cpx(76)}; height: ${cpx(76)}; }
  ${P} .lr-niche { width: ${cpx(72)}; height: ${cpx(72)}; }
  ${P} .lr-margin { font-size: ${tpx(12)}; line-height: 1.3; }
  ${P} .lr-codex-rule { margin-top: ${cpx(5)}; font-size: ${tpx(13)}; line-height: 1.3; }
  ${P} .lr-codex-maths { margin-top: ${cpx(4)}; padding: ${cpx(2)} ${cpx(6)}; font-size: ${tpx(12)}; }
}
${P} .lr-codex-page h3 { font-size: ${tpx(18)}; padding-bottom: ${cpx(3)}; padding-right: ${cpx(40)}; gap: ${cpx(3)} ${cpx(6)}; }
${P} .lr-codex-page .lr-status, ${P} .lr-codex-page .lr-new { font-size: ${tpx(11)}; padding: 0 ${cpx(6)}; letter-spacing: 1px; vertical-align: 0; margin: 0; }
${P} .lr-codex-status { font-size: ${tpx(12)}; margin: ${cpx(3)} 0 ${cpx(6)}; }
${P} .lr-plate { width: ${cpx(88)}; height: ${cpx(88)}; }
${P} .lr-niche { width: ${cpx(84)}; height: ${cpx(84)}; }
${P} .lr-margin {
  align-self: center; padding: ${cpx(2)} 0 ${cpx(2)} ${cpx(8)}; font-size: ${tpx(13)}; line-height: 1.35;
  color: #3e2208; border-left: ${cpx(2)} dashed rgb(110 60 15 / 0.6);
}
${P} .lr-margin b { font-size: ${tpx(11)}; letter-spacing: 1px; margin-bottom: ${cpx(2)}; color: #6a3a0c; }
${P} .lr-codex-rule { margin-top: ${cpx(8)}; font-size: ${tpx(14)}; line-height: 1.35; }
${P} .lr-codex-maths { margin-top: ${cpx(6)}; padding: ${cpx(4)} ${cpx(8)}; font-size: ${tpx(13)}; }
${P} .lr-codex-folio { font-size: ${tpx(12)}; }
${P} .lr-codex-close {
  top: ${cpx(28)}; right: ${cpx(14)}; width: ${cpx(36)}; height: ${cpx(36)}; font-size: ${tpx(18)};
  border-width: 1px; color: #3b2414; background: rgb(255 255 255 / 0.4);
}

/* Journal: the found pages as paper rows a thumb tall, one row for the rest ("12 more pages to
   find"), scrolling if there are many; solid page arrows; ✕ in the right bar. */
.tc-overlay:not([data-phone]) .lr-j-more { display: none; }
${P} .lr-j-stack {
  position: absolute; left: 28px; top: 150px; width: 470px; height: 800px; box-sizing: border-box;
  display: flex; flex-direction: column; gap: ${cpx(4)}; overflow-y: auto; overscroll-behavior: contain;
  pointer-events: auto; scrollbar-width: none; padding: ${cpx(2)} ${cpx(2)} ${cpx(2)} 0;
}
${P} .lr-journal .lr-j-slip {
  position: relative !important; left: auto !important; top: auto !important; width: auto !important;
  height: auto !important; transform: none !important; flex: none; min-height: ${cpx(36)};
  padding: 0 ${cpx(6)}; gap: ${cpx(4)}; font-size: ${tpx(13)}; line-height: 1.1; color: #2e1d0e;
  border-radius: ${cpx(3)}; border-left: ${cpx(3)} solid transparent;
  background: linear-gradient(180deg, #f0e2c0, #d9c091); box-shadow: 0 ${cpx(1)} ${cpx(3)} rgb(0 0 0 / 0.6);
}
${P} .lr-journal .lr-j-slip[aria-current="page"] { border-left-color: #b8322a; background: linear-gradient(180deg, #fff4d6, #ead39e); }
${P} .lr-journal .lr-j-slip[data-blank] { display: none; }
${P} .lr-j-slip b { font-size: ${tpx(14)}; min-width: 1.1em; }
${P} .lr-j-slip .lr-j-new { flex: none; font-size: ${tpx(9.5)}; letter-spacing: 0.3px; padding: ${cpx(1)} ${cpx(3)}; }
${P} .lr-j-slip span { overflow: hidden; text-overflow: clip; }
${P} .lr-j-more {
  flex: none; display: flex; align-items: center; min-height: ${cpx(36)}; padding: 0 ${cpx(8)}; box-sizing: border-box;
  font: italic ${tpx(12.5)}/1.2 var(--tc-font-body, serif); color: #d9c49a;
  border: 1px dashed rgb(201 173 130 / 0.6); border-radius: ${cpx(3)};
}
${P} .lr-journal .lr-j-turn {
  width: ${cpx(44)}; height: ${cpx(44)}; line-height: ${cpx(40)}; font-size: ${tpx(28)}; color: #f6dc94;
  background: radial-gradient(circle at 40% 35%, #5a3a1e, #2a1709); border: 1px solid #c9a052;
  box-shadow: 0 ${cpx(2)} ${cpx(6)} rgb(0 0 0 / 0.7); transform: translate(${cpx(-6)}, ${cpx(-4)});
}
${P} .lr-journal .lr-j-back { top: auto; bottom: calc(${CB} + ${cpx(6)}); }
${P} .lr-journal .lr-j-x { position: absolute; top: ${cpx(6)}; left: auto; right: calc(-1 * var(--lr-bar, 0px) + ${cpx(4)}); pointer-events: auto; }
${P} .lr-journal .lr-panel-x { display: grid; background: rgb(255 255 255 / 0.1); border: 1px solid rgb(232 192 106 / 0.5); border-radius: 50%; }

/* Close ✕ (D-040: Settings, Codex and Journal all close from the top-right corner, plus Esc/Back).
   Phones only; desktop keeps its Done / × / Back. */
.tc-overlay:not([data-phone]) :is(.lr-seg, .lr-panel-x) { display: none !important; }
${P} .lr-panel-x {
  position: absolute; top: ${cpx(4)}; right: ${cpx(4)}; z-index: 2; display: grid; place-items: center;
  width: ${cpx(36)}; height: ${cpx(36)}; min-height: 0; padding: 0; border-radius: 50%; cursor: pointer;
  font: 600 ${tpx(16)}/1 var(--tc-font-ui, system-ui, sans-serif); color: #f3e6c8;
  background: rgb(255 255 255 / 0.1); border: 1px solid rgb(232 192 106 / 0.5);
}
${P} .lr-panel-x:active { background: rgb(232 192 106 / 0.3); }

/* Settings: a fixed header (title, ✕) and footer (Done) with the two columns scrolling between,
   so nothing is ever cut off; every row is a thumb tall; choices are segmented toggles. */
${P} .tc-panel.lr-settings-host {
  display: flex; flex-direction: column; overflow: hidden; width: 1840px; max-height: 98%;
  padding: ${cpx(6)} ${cpx(6)} 0 ${cpx(14)}; box-sizing: border-box;
}
${P} .lr-settings-host .tc-panel-title { flex: none; margin: 0; font-size: ${tpx(16)}; line-height: ${cpx(36)}; }
${P} .lr-settings { width: auto; flex: 1 1 auto; min-height: 0; gap: 0; outline: none; }
${P} .lr-settings-cols {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-right: ${cpx(8)};
  gap: 0 ${cpx(22)}; scrollbar-width: thin; padding-bottom: ${cpx(14)};
  /* A soft bottom edge says "more below" instead of a half-cut row. */
}
${P} .lr-settings-cols[data-more] { mask-image: linear-gradient(#000 calc(100% - ${cpx(22)}), transparent); }
.tc-overlay:not([data-phone]) .lr-settings-more { display: none; }
${P} .lr-settings-more {
  margin-right: auto; min-height: ${cpx(32)}; padding: 0 ${cpx(12)}; font-size: ${tpx(13)};
  color: #f2d89a; background: rgb(232 192 106 / 0.12); border: 1px solid rgb(232 192 106 / 0.45);
  border-radius: ${cpx(16)};
}
${P} .lr-settings-more[hidden] { display: none; }
${P} .lr-settings-col, ${P} .lr-settings section { gap: 0; }
${P} .lr-settings h3 { margin: ${cpx(6)} 0 0; font-size: ${tpx(12)}; line-height: 1.4; }
${P} .lr-settings .tc-field, ${P} .lr-choice { min-height: ${cpx(44)}; }
${P} .lr-choice { display: flex; align-items: center; justify-content: space-between; gap: ${cpx(8)}; }
${P} .lr-choice label.lr-field { flex: 0 1 auto; min-width: 0; font-size: ${tpx(12.5)}; }
${P} .lr-choice select { display: none; }
${P} .lr-seg {
  display: inline-flex; flex: none; border: 1px solid var(--tc-color-border); border-radius: ${cpx(8)};
  overflow: hidden; background: var(--tc-color-surface-alt);
}
${P} .lr-seg button {
  min-height: ${cpx(34)}; padding: 0 ${cpx(9)}; border: 0; margin: 0; cursor: pointer;
  font: ${tpx(12)}/1.1 var(--tc-font-body, serif); color: var(--tc-color-text); background: transparent;
}
${P} .lr-seg button + button { border-left: 1px solid var(--tc-color-border); }
${P} .lr-seg button[aria-checked="true"] { color: #2a1906; background: linear-gradient(180deg, #f3d488, #c99a45); font-weight: 600; }
${P} .lr-settings .tc-field { font-size: ${tpx(12.5)}; }
${P} .lr-settings .tc-field > span { flex: 0 0 7.5em; }
${P} .lr-settings input[type="range"] {
  -webkit-appearance: none; appearance: none; height: ${cpx(44)}; min-height: 0; margin: 0; background: transparent;
}
${P} .lr-settings input[type="range"]::-webkit-slider-runnable-track { height: ${cpx(6)}; border-radius: ${cpx(3)}; background: rgb(232 192 106 / 0.35); }
${P} .lr-settings input[type="range"]::-moz-range-track { height: ${cpx(6)}; border-radius: ${cpx(3)}; background: rgb(232 192 106 / 0.35); }
${P} .lr-settings input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: ${cpx(22)}; height: ${cpx(22)}; margin-top: ${cpx(-8)}; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff1b5, #e8c06a 55%, #9a6d2a); border: 1px solid #5a3d12;
}
${P} .lr-settings input[type="range"]::-moz-range-thumb {
  width: ${cpx(22)}; height: ${cpx(22)}; border-radius: 50%; background: #e8c06a; border: 1px solid #5a3d12;
}
${P} .lr-settings textarea { height: ${cpx(40)}; margin: ${cpx(4)} 0; }
${P} .lr-settings .lr-row { gap: ${cpx(8)}; }
${P} .lr-settings .lr-row .tc-button { min-height: ${cpx(36)}; margin: ${cpx(4)} 0; }
${P} .lr-settings-danger { margin-top: ${cpx(6)}; padding-top: ${cpx(4)}; border-top: 1px solid rgb(255 120 100 / 0.25); }
${P} .lr-settings .lr-danger { color: #ffe3dc; background: linear-gradient(180deg, #a3341f, #6e1d12); border-color: #e0664c; }
${P} .lr-settings .lr-settings-done { flex: none; position: static; padding: ${cpx(4)} ${cpx(8)} ${cpx(6)} 0; margin: 0; }
${P} .lr-settings .lr-settings-done .tc-button { min-height: ${cpx(40)}; min-width: ${cpx(88)}; }

${P} .lr-title-coffee, ${P} .lr-title-links .tc-link-copy {
  min-height: ${cpx(36)}; padding: 0 ${cpx(12)}; font-size: ${tpx(12.5)}; box-sizing: border-box;
}
`;
/* end mobile-3-chrome */

export const PHONE_CSS = /* css */ `
/* The edge columns live in the letterbox bars, outside the 16:9 box (#app still clips). */
${P} { overflow: visible; }
/* ── Touch: no key caps anywhere ────────────────────────────────────────── */
${T} kbd, ${T} .lr-keys-only { display: none !important; }
.tc-overlay:not([data-touch]) .lr-touch-only { display: none !important; }
.tc-overlay:not([data-phone]) .lr-ph-ico, .tc-overlay:not([data-phone]) .lr-hud-menu { display: none !important; }
${P} kbd { display: none !important; }

/* ── Phone hit areas ───────────────────────────────────────────────────────
   Every button and link gets an invisible target at least 44 CSS px each way, centred on it.
   :where() keeps this rule weaker than any scene rule that positions the control itself. */
:where(.tc-overlay[data-phone]) :where(button, a[href], [role="button"], summary) { position: relative; }
:where(.tc-overlay[data-phone]) :where(button, a[href], [role="button"], summary)::before {
  content: ''; position: absolute; pointer-events: auto;
  top: min(0px, calc(50% - var(--lr-tap) / 2)); bottom: min(0px, calc(50% - var(--lr-tap) / 2));
  left: min(0px, calc(50% - var(--lr-tap) / 2)); right: min(0px, calc(50% - var(--lr-tap) / 2));
}
${P} input[type="checkbox"] { width: ${cpx(18)}; height: ${cpx(18)}; }

/* ── Compact controls ───────────────────────────────────────────────────── */
${P} .tc-button, ${P} .lr-stone-button, ${P} .lr-gold-button {
  min-width: 0; min-height: ${cpx(28)}; padding: 0 ${cpx(10)}; font-size: ${tpx(13)};
  border-radius: ${cpx(7)}; border-width: 1px;
}
${P} .lr-gold-button { padding: 0 ${cpx(14)}; }

/* ── HUD: one ☰ in the top-right corner of the right bar ──────────────────
   Tapped, it lists Journal, Codex and Settings below it; the ☰ carries the journal's dot. */
${P} .lr-hud { left: auto; right: ${BAR_IN}; top: ${cpx(4)}; gap: ${cpx(4)}; align-items: flex-end; }
${P} .lr-hud > button:not(.lr-hud-menu) { display: none; }
${P} .lr-hud[data-open] > button:not(.lr-hud-menu):not([hidden]) {
  display: inline-flex; align-items: center; min-height: ${cpx(32)}; padding: 0 ${cpx(12)}; font-size: ${tpx(13)};
  box-shadow: 0 ${cpx(2)} ${cpx(8)} rgba(0,0,0,0.7);
}
${P} .lr-hud .lr-hud-menu {
  display: flex; align-items: center; justify-content: center; width: ${COL}; height: ${cpx(36)}; min-height: 0;
  padding: 0; font-size: ${cpx(20)}; line-height: 1;
}
${P} .lr-hud .lr-hud-menu[data-unread]::after {
  content: ''; position: absolute; right: ${cpx(4)}; top: ${cpx(4)}; width: ${cpx(8)}; height: ${cpx(8)};
  border-radius: 50%; background: #ff8a3c; box-shadow: 0 0 ${cpx(4)} #ff8a3c;
}
${P} .lr-hud[data-scene="solve"] { display: none; }
${P} .lr-nameplate { padding: ${cpx(2)} ${cpx(8)}; font-size: ${tpx(12)}; border-radius: ${cpx(6)}; }

/* ── FUSE's caption: a slim bubble, paged by tap (ui/fuse.ts pages it at 12 words) ───────── */
${P} { --tc-caption-margin: ${cpx(6)}; --tc-caption-max-width: min(${cpx(280)}, var(--lr-third, 100vw)); }
${P} .tc-caption {
  gap: ${cpx(6)}; padding: ${cpx(4)} ${cpx(9)}; border-radius: ${cpx(8)}; border-width: 1px;
}
${P} .tc-caption-side { display: none; }
${P} .tc-caption-text { font-size: ${tpx(12.5)}; line-height: 1.3; }
/* At an altar: beside FUSE in the bottom band, left of the tray (altar-scene phoneCaption). */
${P}:has(.lr-altar[data-phone]) .tc-caption {
  left: var(--lr-cap-l) !important; right: auto !important; top: auto !important;
  bottom: ${cpx(3)} !important; max-width: min(var(--lr-cap-w), var(--lr-third)) !important;
}

/* ── Panels ─────────────────────────────────────────────────────────────── */
${P} .tc-panel { max-width: 99%; max-height: 98%; }
${P} .tc-card { padding: ${cpx(8)} ${cpx(12)}; border-radius: ${cpx(10)}; }

/* Settings: two columns, nearly full width; Done stays pinned while it scrolls. */
${P} .lr-settings { width: 1820px; gap: ${cpx(2)}; font-size: ${tpx(12)}; }
${P} .lr-settings h2 { font-size: ${tpx(14)}; margin: 0; }
${P} .lr-settings h3 { font-size: ${tpx(12)}; margin: ${cpx(4)} 0 0; }
${P} .lr-settings-cols { gap: 0 ${cpx(20)}; }
${P} .lr-settings-col, ${P} .lr-settings section { gap: ${cpx(2)}; }
${P} .lr-settings .tc-field { min-height: ${cpx(28)}; font-size: ${tpx(12)}; }
${P} .lr-settings .tc-field > span { flex: 0 0 8em; }
${P} .lr-settings select { min-height: ${cpx(26)}; padding: 0 ${cpx(6)}; font-size: ${tpx(12)}; }
${P} .lr-settings input[type="range"] { min-height: ${cpx(24)}; }
${P} .lr-settings textarea { height: ${cpx(34)}; font-size: ${tpx(11)}; }
${P} .lr-settings .lr-row { gap: ${cpx(6)}; }
${P} .lr-settings .lr-settings-done { padding: ${cpx(4)} 0 0; }
${P} .lr-confirm { width: 1300px; }

/* Codex: the tome fills the screen; each page keeps its plate with FUSE's note beside it and
   scrolls if it has to; the tabs sit in a strip under the pages. */
${P} .lr-codex { width: 1900px; height: 1056px; padding: ${cpx(15)} ${cpx(6)} ${cpx(38)}; border-radius: ${cpx(10)}; }
${P} .lr-codex-page { padding: ${cpx(8)} ${cpx(12)} ${cpx(6)}; grid-template-columns: ${cpx(76)} 1fr; column-gap: ${cpx(10)}; font-size: ${tpx(12)}; }
${P} .lr-codex-page h3 { padding-bottom: ${cpx(2)}; font-size: ${tpx(15)}; }
${P} .lr-codex-status { margin: ${cpx(2)} 0 ${cpx(4)}; font-size: ${tpx(11)}; }
${P} .lr-plate { width: ${cpx(76)}; height: ${cpx(76)}; border-radius: ${cpx(8)}; }
${P} .lr-niche { width: ${cpx(64)}; height: ${cpx(64)}; }
${P} .lr-niche--locked::before, ${P} .lr-niche--locked::after { width: ${cpx(76)}; left: ${cpx(-6)}; }
${P} .lr-margin { grid-column: 2; transform: none; padding: ${cpx(2)} ${cpx(6)}; align-self: start; font-size: ${tpx(11.5)}; line-height: 1.3; }
${P} .lr-codex-rule { margin-top: ${cpx(6)}; line-height: 1.3; font-size: ${tpx(12)}; }
${P} .lr-codex-maths { margin-top: ${cpx(4)}; padding: ${cpx(3)} ${cpx(6)}; font-size: ${tpx(11)}; }
${P} .lr-codex-head { top: ${cpx(1)}; font-size: ${tpx(11)}; letter-spacing: 1px; }
${P} .lr-codex-nav { bottom: ${cpx(5)}; gap: ${cpx(4)}; }
${P} .lr-codex-nav button { min-height: ${cpx(26)}; height: auto; padding: 0 ${cpx(8)}; border-radius: ${cpx(13)}; font-size: ${tpx(12)}; }
${P} .lr-codex-nav .lr-dot { width: ${cpx(7)}; height: ${cpx(7)}; margin-right: ${cpx(3)}; }
${P} .lr-codex-close { width: ${cpx(30)}; height: ${cpx(30)}; right: ${cpx(10)}; top: ${cpx(10)}; font-size: ${tpx(16)}; }

/* Journal: the slips are an index 16 CSS px apart, so they keep their exact size (no grown hit
   area to steal the neighbour's tap); the page arrows and a swipe on the book turn pages. */
${P} .lr-journal .lr-j-slip { line-height: 1; padding: 0 ${cpx(4)} 0 ${cpx(6)}; gap: ${cpx(4)}; font-size: ${tpx(11.5)}; }
${P} .lr-journal .lr-j-slip[data-blank] { font-size: ${tpx(11)}; letter-spacing: 0; border-width: 1px; }
${P} .lr-j-slip b, ${P} .lr-j-slip[data-blank] b { font-size: ${tpx(11.5)}; }
${P} .lr-j-slip .lr-j-new { font-size: ${tpx(11)}; letter-spacing: 0.5px; padding: 0 ${cpx(4)}; border-radius: ${cpx(6)}; line-height: 1.1; }
${P} .lr-j-head h1 { font-size: ${tpx(16)}; letter-spacing: 1px; }
${P} .lr-j-head p { font-size: ${tpx(11)}; letter-spacing: 0.5px; margin: 0; }
${P} .lr-journal .lr-j-slip::before { display: none; }
${P} .lr-j-slip b { min-width: 1.4em; }
${P} .lr-journal .lr-j-turn { width: ${cpx(36)}; height: ${cpx(36)}; line-height: ${cpx(32)}; font-size: ${cpx(26)}; background: #ffffff1c; }
${P} .lr-j-plate { font-size: var(--lr-text-min); padding: 0 ${cpx(10)}; }

/* Hangout: the window fills the screen and the sidebar is wide enough for every channel's
   whole name (no ellipsis on phones); Skip keeps the strip on the right. */
${P} .lr-hg { left: 30px; top: 30px; width: 1640px; height: 1020px; }
${P} .lr-hg-rail { width: ${cpx(30)}; padding-top: ${cpx(6)}; }
${P} .lr-hg-badge { width: ${cpx(22)}; height: ${cpx(22)}; border-radius: ${cpx(6)}; font-size: ${tpx(12)}; }
${P} .lr-hg-rail::before { top: ${cpx(8)}; height: ${cpx(14)}; }
${P} .lr-hg-side { width: 660px; }
${P} .lr-hg-server { height: ${cpx(24)}; padding: 0 ${cpx(8)}; font-size: ${tpx(13)}; text-overflow: clip; overflow: visible; }
${P} .lr-hg-list { padding: ${cpx(4)} ${cpx(4)} 0 ${cpx(6)}; }
${P} .lr-hg-ch { height: auto; min-height: ${cpx(13)}; margin: 0; padding: 0 ${cpx(18)} 0 ${cpx(4)}; gap: ${cpx(3)}; font-size: ${tpx(11)}; line-height: 1.15; }
${P} .lr-hg-ch .lr-emo { min-width: ${cpx(12)}; font-size: ${tpx(11)}; }
${P} .lr-hg-hash { min-width: ${cpx(5)}; font-size: ${tpx(11)}; }
${P} .lr-hg-name { overflow: visible; text-overflow: clip; }
${P} .lr-hg-cat { margin: ${cpx(1)} 0 ${cpx(2)}; font-size: ${tpx(11)}; letter-spacing: 1px; }

/* ── Altar: board first ────────────────────────────────────────────────────
   Left bar: Back (top), Undo and Clear. Right bar: ☰ (top, the HUD), ↻ Turn, Strike (bottom).
   Bottom band (layout.ts PhoneBand): FUSE and his bubble, the tray, then the info lane where
   the gem chip, the verdict or the hint shows, one at a time. The title is one line on top. */
${P} .lr-altar-actions { inset: 0; display: block; pointer-events: none; }
${P} .lr-altar-actions button {
  position: absolute; width: ${COL}; height: ${COL}; min-height: 0; padding: 0; border-radius: ${cpx(8)};
  display: flex; align-items: center; justify-content: center; font-family: var(--tc-font-ui); font-size: ${tpx(11)};
  line-height: 1.1; letter-spacing: 0; pointer-events: auto;
}
${P} .lr-altar-actions button > span { display: flex; flex-direction: column; align-items: center; gap: 0; }
${P} .lr-altar-actions .lr-ph-ico { font-style: normal; font-size: ${cpx(17)}; line-height: 1; color: var(--lr-gold); }
${P} .lr-altar-actions [data-action="back"] { left: ${BAR_IN}; top: ${cpx(4)}; }
${P} .lr-altar-actions [data-action="undo"] { left: ${BAR_IN}; top: 34%; }
${P} .lr-altar-actions [data-action="clear"] { left: ${BAR_IN}; top: calc(34% + ${cpx(52)}); }
${P} .lr-altar-actions [data-action="strike"] {
  right: ${BAR_IN}; bottom: ${cpx(6)}; height: ${cpx(58)}; font-family: var(--tc-font-display); font-size: ${tpx(12)};
}
${P} .lr-altar-actions .lr-gold-button .lr-strike-pips { margin: ${cpx(3)} 0 0; vertical-align: 0; }
${P} .lr-altar .lr-altar-turnbtn {
  left: auto !important; right: ${BAR_IN}; top: 50% !important; width: ${COL}; height: ${cpx(52)}; min-height: 0;
  padding: 0; border-radius: ${cpx(10)}; border-width: 1px; font-family: var(--tc-font-ui); font-size: ${tpx(11)}; line-height: 1.1;
}
${P} .lr-altar .lr-altar-turnbtn > span { display: flex; flex-direction: column; align-items: center; }
${P} .lr-altar .lr-altar-turnbtn b { font-size: ${cpx(20)}; }

${P} .lr-altar-title { top: ${cpx(1)}; max-width: none !important; line-height: 1.1; }
${P} .lr-altar-title h2 { font-size: ${tpx(13)}; letter-spacing: 0.5px; white-space: nowrap; }
/* The storm's Gives card already says what the subtitle says. */
${P} .lr-altar-title small { display: none; }

${P} .lr-altar-need { padding: ${cpx(1)} ${cpx(6)} ${cpx(2)}; border-width: 1px; border-radius: ${cpx(6)}; font-size: ${tpx(11)}; line-height: 1.1; }
${P} .lr-altar-need[data-align="below"] { transform: translate(-50%, ${cpx(4)}); }
${P} .lr-altar-need[data-align="right"] { transform: translate(${cpx(5)}, -50%); }
${P} .lr-altar-need b { font-size: ${tpx(14)}; margin-left: ${cpx(2)}; }
${P} .lr-altar-need .lr-need-got { font-size: ${tpx(11)}; }
${P} .lr-altar-need .lr-need-got b { font-size: ${tpx(12)}; }
${P} .lr-altar-need .lr-need-note { font-size: ${tpx(11)}; margin-top: 0; }
${P} .lr-altar-need .lr-need-strikes { font-size: ${tpx(11)}; gap: ${cpx(2)}; }

${P} .lr-altar-count { padding: 0 ${cpx(5)}; min-width: 0; border-radius: ${cpx(6)}; font-size: ${tpx(11)}; gap: ${cpx(2)}; line-height: 1.2; }

/* The info lane: gem chip, verdict and hint share it, bottom-aligned; the chip wins, then the
   verdict. Each is one to three short lines; a tap anywhere clears the chip and the verdict. */
${P} .lr-altar-tip, ${P} .lr-altar-verdict, ${P} .lr-altar-hint {
  top: auto !important; bottom: ${cpx(3)}; transform: none; text-align: left; box-sizing: border-box;
  font-family: var(--tc-font-body, serif); font-size: ${tpx(12)}; line-height: 1.3; letter-spacing: 0;
  border-radius: ${cpx(7)}; border-width: 1px; box-shadow: 0 ${cpx(2)} ${cpx(8)} rgba(0,0,0,0.6);
}
${P} .lr-altar-tip { width: max-content; padding: ${cpx(3)} ${cpx(8)}; }
${P} .lr-altar-tip::after { display: none; }
${P} .lr-altar-tip .lr-info-row { white-space: normal; }
${P} .lr-altar-tip .lr-info-tag { display: none; }
${P} .lr-altar-tip b { margin-right: ${cpx(2)}; }
/* Long-pressed: the whole card, growing upward from the lane. */
${P} .lr-altar-tip[data-full] .lr-info-row { white-space: normal; }
${P} .lr-altar-tip[data-full] .lr-info-tag { display: inline-block; font-size: ${tpx(11)}; padding: 0 ${cpx(4)}; margin-right: ${cpx(3)}; border-radius: ${cpx(4)}; }
${P} .lr-altar-verdict { width: max-content; padding: ${cpx(3)} ${cpx(8)}; animation: none; }
/* One run of text: the verdict, then its story or next step on the same line, so it wraps to
   at most three lines in the lane. */
${P} .lr-altar-verdict { font-family: var(--tc-font-display); font-size: ${tpx(12)}; line-height: 1.25; }
${P} .lr-altar-verdict .lr-verdict-story, ${P} .lr-altar-verdict .lr-verdict-hint {
  display: inline; margin: 0; max-width: none; font-size: ${tpx(11.5)}; line-height: 1.25;
}
/* The verdict has no full stop of its own: a dot keeps it from running into what follows. */
${P} .lr-altar-verdict .lr-verdict-story::before, ${P} .lr-altar-verdict .lr-verdict-hint::before { content: ' · '; }
${P} .lr-altar-hint {
  left: var(--lr-info-l) !important; right: auto; width: auto; max-width: min(var(--lr-info-w), var(--lr-third)) !important; min-width: 0;
  padding: ${cpx(2)} ${cpx(6)}; white-space: normal; background: rgba(16,13,10,0.7); border: 0; box-shadow: none;
}
${P} .lr-altar-hint:empty { display: none; }
${P} .lr-altar-hint .lr-nowrap { white-space: nowrap; }
${P} .lr-altar[data-phone]:has(.lr-altar-tip:not([hidden])) :is(.lr-altar-verdict, .lr-altar-hint) { visibility: hidden; }
${P} .lr-altar[data-phone]:has(.lr-altar-verdict:not([hidden])) .lr-altar-hint { visibility: hidden; }
/* The tray card covers the gem in hand for its first moments; its ↻ mark waits too. */
${T} .lr-altar:not([data-phone]):has(.lr-altar-tip[data-source="tray"]:not([hidden])) .lr-altar-turnmark { visibility: hidden; }
${P} .lr-altar-tag { font-size: ${tpx(11)}; padding: ${cpx(1)} ${cpx(5)}; border-radius: ${cpx(5)}; }

/* ── Title ──────────────────────────────────────────────────────────────── */
${P} .tc-link-copy, ${P} .tc-link-message { font-size: ${tpx(11)}; padding: ${cpx(2)} ${cpx(8)}; }
${P} .lr-title-links { right: ${cpx(6)}; bottom: ${cpx(4)}; gap: ${cpx(6)}; }
${P} .lr-title-coffee { min-height: ${cpx(24)}; padding: 0 ${cpx(8)}; font-size: ${tpx(11)}; }
${P} .lr-release { font-size: ${tpx(11)}; }
${CHROME_CSS}`;
