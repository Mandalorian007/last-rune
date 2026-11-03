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

/** mobile-3-board: the phone altar root, ranked above the mobile-2 altar rules. */
const A = `${P} .lr-altar[data-phone]`;

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

/* mobile-4-chrome */
const CHROME4_CSS = /* css */ `
/* ── mobile-4-chrome: the last clarity gaps in the menus (D-040 addendum 2) ───────────── */
/* Settings: the columns scroll natively beside a drawn thumb (iOS hides its own until you
   scroll); the bottom fade shows only while there is more below; "Graphics & Save ▾" jumps. */
${P} .lr-settings-scroll { position: relative; display: flex; flex: 1 1 auto; min-height: 0; }
${P} .lr-settings-scroll > .lr-settings-cols {
  position: relative; flex: 1 1 auto; min-width: 0; scrollbar-width: none; padding-right: ${cpx(16)};
}
${P} .lr-settings-scroll > .lr-settings-cols::-webkit-scrollbar { display: none; }
${P} .lr-settings-rail {
  position: absolute; right: ${cpx(3)}; top: ${cpx(4)}; bottom: ${cpx(8)}; width: ${cpx(5)};
  border-radius: ${cpx(3)}; background: rgb(232 192 106 / 0.16); pointer-events: none;
}
${P} .lr-settings-rail[hidden] { display: none; }
${P} .lr-settings-thumb {
  position: absolute; left: 0; right: 0; min-height: ${cpx(24)}; border-radius: ${cpx(3)};
  background: rgb(240 205 125 / 0.85);
}
${P} .lr-settings-more { min-height: ${cpx(40)}; padding: 0 ${cpx(14)}; border-radius: ${cpx(20)}; }

/* Codex: the ✕ gets a gutter of its own in the leather, right of the pages, so it never
   touches a header; the page number goes (it cost a line on the shortest phones); a page that
   still runs long scrolls with a fade at its foot while more is below. */
${P} .lr-codex { padding-right: ${cpx(50)}; }
${P} .lr-codex-close { top: ${cpx(32)}; right: ${cpx(7)}; background: rgb(255 240 200 / 0.14); color: #f8e6b8; border-color: rgb(232 192 106 / 0.6); }
${P} .lr-codex-page h3 { padding-right: 0; }
${P} .lr-codex-folio { display: none; }
${P} .lr-codex-page[data-more] { mask-image: linear-gradient(#000 calc(100% - ${cpx(20)}), rgb(0 0 0 / 0.15)); }

/* Journal: the handwriting at a readable size in dark ink; the Day list in larger print with a
   quiet "new" marker so the dates scan; one exit, the ✕ (D-040). */
${P} .lr-j-body, ${P} .lr-j-body[data-long] {
  /* The paper's rule pitch (54, desk-wgsl), unless larger text needs more. */
  font-size: ${tpx(15.5)}; line-height: max(54px, 1.15em); color: #140b05; font-weight: 700;
  text-shadow: 0 0 1px #140b0599;
}
${P} .lr-j-date { font-size: ${tpx(15)}; color: #24160b; }
/* The larger hand runs page 16 two rules further down its right leaf: the signature follows. */
${P} .lr-j-sign { transform: translateY(108px); }
${P} .lr-journal .lr-j-back { display: none; }
${P} .lr-journal .lr-j-slip { font-size: ${tpx(14.5)}; min-height: ${cpx(38)}; }
${P} .lr-j-slip b { font-size: ${tpx(15)}; }
${P} .lr-j-slip span { font-weight: 700; }
/* "New" is a red dot after the date (the head says "1 new"), so the day number is never cut. */
${P} .lr-j-slip .lr-j-new {
  flex: none; margin-left: auto; width: ${cpx(9)}; height: ${cpx(9)}; padding: 0; border-radius: 50%;
  font-size: 0; color: transparent; box-shadow: none;
}
`;
/* end mobile-4-chrome */

/* mobile-5-chrome */
const CHROME5_CSS = /* css */ `
/* ── mobile-5-chrome: the hall explains itself; menus fold cleanly (D-040 addendum 3) ───── */
/* Every door wears a plate (hall-scene doorPlates): an open door's name in gold, a restored
   one's with a ✓, a locked one's padlock and the gem colours it still needs. Phones only. */
.tc-overlay:not([data-phone]) :is(.lr-doors, .lr-hud-menu-label, .lr-hud-menu-new) { display: none !important; }
${P} .lr-doors { position: absolute; inset: 0; pointer-events: none; }
${P} .lr-doors[hidden] { display: none; }
${P} .lr-door {
  position: absolute; transform: translateX(-50%); box-sizing: border-box; width: max-content;
  max-width: var(--lr-door-max); display: flex; align-items: center; justify-content: center;
  gap: ${cpx(3)}; padding: ${cpx(1)} ${cpx(4)}; border-radius: ${cpx(6)};
  font: 600 ${tpx(12)}/1.1 var(--tc-font-display, serif); letter-spacing: 0.2px; text-align: center;
  text-wrap: balance; color: #f4e6c4; background: rgb(16 11 7 / 0.86);
  border: 1px solid rgb(232 192 106 / 0.4); box-shadow: 0 ${cpx(1)} ${cpx(4)} rgb(0 0 0 / 0.7);
}
${P} .lr-door[data-status="unlocked"] { color: #ffd77a; border-color: rgb(255 215 122 / 0.8); }
${P} .lr-door[data-status="solved"] { color: #e9f4e4; border-color: rgb(110 220 160 / 0.6); }
${P} .lr-door-tick { color: #6ee0a0; font-weight: 700; }
${P} .lr-door[data-status="locked"] { color: #c9bea8; gap: ${cpx(4)}; padding: ${cpx(2)} ${cpx(6)}; background: rgb(10 8 6 / 0.88); border-color: rgb(200 190 170 / 0.3); }
${P} .lr-door-lock { width: ${cpx(10)}; height: ${cpx(12)}; flex: none; }
${P} .lr-door-gem {
  width: ${cpx(10)}; height: ${cpx(10)}; flex: none; border-radius: 50%; background: var(--gem);
  box-shadow: 0 0 ${cpx(3)} var(--gem); border: 1px solid rgb(0 0 0 / 0.6);
}
${P} .lr-door b { font: 700 ${tpx(12)}/1 var(--tc-font-display, serif); }
/* The suggested door's tag sits on its top edge, never closer than 5 px to the band's top. */
${P} .lr-hall-next-tag { top: max(calc(var(--lr-next-top, 0px) - ${cpx(10)}), calc(${CT} + ${cpx(5)})); }
/* A tapped door's card: name, then what it is waiting for, in words. */
${P} .lr-nameplate {
  z-index: 2; white-space: normal; width: max-content; max-width: ${cpx(230)}; text-align: center;
  padding: ${cpx(4)} ${cpx(10)}; font-size: ${tpx(13)}; line-height: 1.2; border-radius: ${cpx(8)}; border-width: 1px;
}
${P} .lr-nameplate small { font-size: ${tpx(12)}; line-height: 1.25; margin-top: ${cpx(1)}; color: #d9c9a4; }
/* The ☰ says "Menu" under it; when the journal has new pages, a tag under it says so. */
${P} .lr-hud .lr-hud-menu { position: relative; flex-direction: column; gap: 0; height: ${cpx(44)}; }
${P} .lr-hud .lr-hud-menu > span { font-size: ${cpx(18)}; line-height: 1; }
${P} .lr-hud-menu-label { display: block; font: 600 ${tpx(12)}/1 var(--tc-font-display, serif); letter-spacing: 0.3px; margin-top: ${cpx(1)}; }
${P} .lr-hud-menu-new {
  position: absolute; top: calc(100% + ${cpx(3)}); right: 0; width: ${cpx(44)}; box-sizing: border-box;
  padding: ${cpx(2)} 0; border-radius: ${cpx(6)}; text-align: center;
  font: italic 700 ${tpx(12)}/1.05 var(--tc-font-body, serif); color: #2a1206; background: #ffb27a;
  box-shadow: 0 ${cpx(1)} ${cpx(4)} rgb(0 0 0 / 0.7);
}
${P} .lr-hud-menu-new[hidden], ${P} .lr-hud[data-open] .lr-hud-menu-new { display: none; }
/* FUSE's card carries his name (his portrait is hidden on phones), except at an altar, where
   he sits right beside it. */
${P}:not(:has(.lr-altar[data-phone])) .tc-caption-text::before {
  content: 'FUSE '; font: 700 ${tpx(12)}/1 var(--tc-font-display, serif); letter-spacing: 0.6px; color: #e8c06a;
}
/* Settings: the fold ends on a whole row (settings-panel fold()), so no fade is needed; the
   save code sits in a labelled box; Start over is a group of its own, ruled off in red. */
${P} .lr-settings-scroll > .lr-settings-cols { box-sizing: border-box; mask-image: none; }
${P} .lr-save-box {
  display: flex; flex-direction: column; gap: ${cpx(2)}; margin: ${cpx(4)} 0 0; padding: ${cpx(4)} ${cpx(8)} ${cpx(6)};
  border: 1px solid rgb(232 192 106 / 0.45); border-radius: ${cpx(8)}; background: rgb(232 192 106 / 0.06);
}
${P} .lr-save-box > span { font: 600 ${tpx(12)}/1.2 var(--tc-font-display, serif); color: #e8c06a; letter-spacing: 0.3px; }
${P} .lr-settings .lr-save-box textarea {
  height: ${cpx(38)}; margin: 0; padding: ${cpx(4)} ${cpx(6)}; resize: none; box-sizing: border-box;
  font: ${tpx(12)}/1.3 var(--tc-font-body, serif); color: #f4e6c4; background: rgb(10 7 4 / 0.55);
  border: 1px solid rgb(232 192 106 / 0.25); border-radius: ${cpx(5)};
}
${P} .lr-settings .lr-save-box textarea::placeholder { color: rgb(244 230 196 / 0.6); font-style: italic; }
${P} .lr-settings-danger {
  margin: ${cpx(10)} 0 ${cpx(4)}; padding: ${cpx(4)} ${cpx(8)} ${cpx(2)}; border: 1px solid rgb(224 102 76 / 0.45);
  border-radius: ${cpx(8)}; background: rgb(110 29 18 / 0.18);
}
${P} .lr-settings-danger h4 { margin: 0; font: 600 ${tpx(12)}/1.3 var(--tc-font-display, serif); letter-spacing: 1px; text-transform: uppercase; color: #ff9c86; }
${P} .lr-settings-danger p { margin: ${cpx(1)} 0 0; font-size: ${tpx(12)}; line-height: 1.3; color: #e7d3c8; }
${P} .lr-settings-danger .tc-button { min-height: ${cpx(36)}; margin: ${cpx(4)} 0; }
${P} .lr-settings h3 { font-size: ${tpx(12.5)}; }
/* Codex on the shortest phones: the rule and its formula sit beside the gem, FUSE's note
   under them, so the whole rule shows without scrolling. */
@media (max-height: 330px) {
  ${P} .lr-plate, ${P} .lr-niche { grid-row: 3 / span 2; align-self: start; }
  ${P} .lr-codex-rule { grid-column: 2; grid-row: 3; margin-top: 0; }
  ${P} .lr-codex-maths { grid-column: 2; grid-row: 4; align-self: start; }
  ${P} .lr-margin { grid-column: 1 / -1; grid-row: 5; align-self: start; margin-top: ${cpx(6)}; }
}
${P} .lr-codex-status { font-size: ${tpx(12)}; }
/* Chrome text floor 12 px: the Yours / Not met yet / NEW tags and FUSE's margin label. */
${P} .lr-codex-page .lr-status, ${P} .lr-codex-page .lr-new, ${P} .lr-margin b {
  font-size: ${tpx(12)}; letter-spacing: 0.6px;
}
/* Journal: the page number at 13 px ink, and the page arrows beside the book, not over its
   edges: ‹ left of the book, › in the right lane under the ✕. */
${P} .lr-j-folio { display: flex; justify-content: center; white-space: nowrap; font-size: ${tpx(13)}; font-weight: 700; color: #3d2818; }
${P} .lr-j-folio[hidden] { display: none; }
${P} .lr-journal .lr-j-turn[aria-label="Previous page"] { transform: translate(calc(-26px - ${cpx(54)}), ${cpx(-4)}); }
${P} .lr-journal .lr-j-turn[aria-label="Next page"] { left: auto !important; right: calc(-1 * var(--lr-bar, 0px)); transform: translateY(${cpx(-4)}); }
${P} .lr-j-head p { font-size: ${tpx(12)}; }
/* Hangout: no "unread" count; nothing there is for the player to open (D-027). */
${P} .lr-hg-badge-count { display: none !important; }
/* End card on the narrowest phones (SE): the column moves further left, so the dropped
   clipboard on the right stays clear of "Copy Ko-fi link". Order unchanged (D-034). */
@media (max-width: 700px) {
  ${P} :is(.lr-end-title, .lr-end-credits, .lr-end-card):not(#lr-none) { right: 600px; }
  ${P} .lr-end-safety:not(#lr-none) { left: calc(50% - 300px); }
}
`;
/* end mobile-5-chrome */

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

/* mobile-3-ending: the ending, hangout and end card on phones live in
   scenes/ending/ending-phone-styles.ts (injected with the ending's own styles). */

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

/* mobile-3-board ─ Altar: the board on the left, a column on the right ──────────────────
   layout.ts phoneLayout: the board and its gauges fill the height on the left; the column
   (--lr-col-l/-w) holds the title, the tray (counts under the gems), the lane (gem chip,
   verdict, Capacitor read-outs; top-down from --lr-lane-t), then FUSE's bubble or the hint
   (bottom-up from --lr-bub-b, reaching into the right bar), and FUSE. Gives/Needs cards sit
   beside their gauges, 8 CSS px clear of the board (altar-scene placePhoneLabels). */
${A} .lr-altar-title { top: ${cpx(3)}; width: max-content; }
${A} .lr-altar-title h2 { font-size: ${tpx(13)}; }

/* Tray: counts under the gems; a used-up gem is struck through, slot and count. */
${A} .lr-altar-count { font-size: ${tpx(12)}; padding: 0 ${cpx(5)}; line-height: 1.2; }
${A} .lr-altar-count[data-empty] { opacity: 0.75; color: #9c8f78; text-decoration: line-through; border-color: rgba(156,143,120,0.4); }
${A} .lr-altar-slot { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; display: none; }
${A} .lr-altar-slot[data-empty] {
  display: block;
  background: linear-gradient(to top right, transparent calc(50% - ${cpx(1.2)}), rgba(214,196,164,0.85) calc(50% - ${cpx(1.2)}),
    rgba(214,196,164,0.85) calc(50% + ${cpx(1.2)}), transparent calc(50% + ${cpx(1.2)}));
}
/* First altar, until the first gem is taken: the tray breathes, so the eye finds it. */
${A}[data-first]:not([data-picked]) .lr-altar-slot:not([data-empty]) {
  display: block; box-shadow: 0 0 0 ${cpx(2)} rgba(232,192,106,0.85), 0 0 ${cpx(12)} ${cpx(2)} rgba(232,192,106,0.55);
  animation: lr-m3-tray-pulse 1.6s ease-in-out infinite;
}
@keyframes lr-m3-tray-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
[data-reduced-motion] ${A}[data-first]:not([data-picked]) .lr-altar-slot { animation: none; }

/* The lane: one card under another, never over the board. The gem chip outranks the verdict. */
${A} .lr-altar-lane {
  position: absolute; left: var(--lr-col-l); top: var(--lr-lane-t); width: var(--lr-col-w);
  display: flex; flex-direction: column; align-items: flex-start; gap: ${cpx(4)}; pointer-events: none;
}
${A} .lr-altar-lane > * {
  position: relative !important; left: auto !important; top: auto !important; bottom: auto !important;
  transform: none !important; margin: 0; max-width: none !important; box-sizing: border-box;
}
/* The chip and the verdict may run on into the right bar (Turn stands in the left bar). */
${A} .lr-altar-lane :is(.lr-altar-tip, .lr-altar-verdict) { width: min(calc(var(--lr-col-w) + var(--lr-bar, 0px) - ${cpx(3)}), var(--lr-third)); }
${A}:has(.lr-altar-tip:not([hidden])) .lr-altar-lane .lr-altar-verdict { display: none; }
${A} .lr-altar-lane .lr-altar-cap {
  white-space: normal; gap: 0; padding: ${cpx(2)} ${cpx(7)} ${cpx(3)}; border-width: 1px; border-radius: ${cpx(7)};
  font-size: ${tpx(12)}; line-height: 1.25; animation: none;
}
${A} .lr-cap-head { font-family: var(--tc-font-ui); font-size: ${tpx(11)}; letter-spacing: 0.5px; color: #9fc8ff; }

/* The hint: one line where FUSE's bubble goes, while he is quiet. */
${A} .lr-altar-hint {
  left: var(--lr-bub-l) !important; bottom: var(--lr-bub-b) !important; white-space: nowrap;
  max-width: min(calc(var(--lr-col-w) + var(--lr-bar, 0px) - ${cpx(3)}), var(--lr-third)) !important;
}
${P}:has(.tc-caption:not([hidden]):not([data-suspended])) .lr-altar[data-phone] .lr-altar-hint { visibility: hidden; }
${P}:has(.lr-altar[data-phone]) .tc-caption {
  bottom: var(--lr-cap-b) !important;
  max-width: min(calc(var(--lr-cap-w) + var(--lr-bar, 0px) - ${cpx(3)}), var(--lr-third)) !important;
}
${P}:has(.lr-altar[data-crowd]) .tc-caption { visibility: hidden; }

/* Turn: in the left bar under Clear, so the right bar between ☰ and Strike stays free for the
   gem chip and FUSE's bubble. */
${A} .lr-altar-turnbtn { left: ${BAR_IN} !important; right: auto; top: auto !important; bottom: ${cpx(6)}; }

/* Gives / Needs: under a west/east gauge (wrapping to its gutter), beside a north/south one. */
${A} .lr-altar-need { white-space: normal; text-align: center; }
${A} .lr-altar-need[data-align="above"] { transform: translate(-50%, calc(-100% - ${cpx(4)})); }
${A} .lr-altar-need[data-align="above"]::before { top: auto; bottom: -9px; transform: translateX(-50%) rotate(225deg); left: 50%; border-left-width: 2px; border-top-width: 2px; }
${A} .lr-altar-need:is([data-align="up"], [data-align="down"]) {
  flex-direction: row; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 0 ${cpx(4)};
  max-width: ${cpx(118)}; white-space: nowrap;
}
${A} .lr-altar-need[data-align="up"] { transform: translate(0, -100%); }
${A} .lr-altar-need[data-align="down"] { transform: none; }
${A} .lr-altar-need[data-align="up"][data-left] { transform: translate(-100%, -100%); }
${A} .lr-altar-need[data-align="down"][data-left] { transform: translate(-100%, 0); }
${A} .lr-altar-need:is([data-align="up"], [data-align="down"])::before {
  left: -9px; top: 50%; transform: translateY(-50%) rotate(45deg); border-left-width: 2px; border-bottom-width: 2px;
}
${A} .lr-altar-need:is([data-align="up"], [data-align="down"])[data-left]::before {
  left: auto; right: -9px; transform: translateY(-50%) rotate(225deg);
}
${A} .lr-altar-need:is([data-align="up"], [data-align="down"]) .lr-need-strikes { margin-top: 0; }
${A} .lr-altar-storm .lr-strike-pips { display: none; }

/* Strike: full gold whenever it can fire (it glows once the route reaches a machine); a
   multi-strike altar says "×2", then "1/2", in words not pips. */
${A} .lr-altar-actions .lr-gold-button:not([data-ready]):not(:disabled) { filter: none; }
${A} .lr-altar-actions .lr-gold-button .lr-strike-pips { display: none; }
.tc-overlay .lr-strike-n { display: none; }
${A} .lr-altar-actions .lr-strike-n { display: block; font-family: var(--tc-font-ui); font-size: ${tpx(12)}; line-height: 1.1; }

/* Solve moment: card, journal page and Continue fill the altar's column and the free right
   bar (solve-scene); FUSE speaks beside himself at the column's foot. */
${P} .lr-solve[data-phone] {
  left: var(--lr-col-l); top: ${cpx(4)}; width: calc(var(--lr-col-w) + var(--lr-bar, 0px) - ${cpx(3)}); gap: ${cpx(5)};
}
${P} .lr-solve[data-phone] .lr-solve-card { padding: ${cpx(5)} ${cpx(9)} ${cpx(6)}; }
${P} .lr-solve[data-phone] .lr-page-note { margin: 0 ${cpx(6)}; padding: ${cpx(4)} ${cpx(9)}; }
${P} .lr-solve[data-phone] .lr-page-note b { white-space: nowrap; margin-bottom: ${cpx(1)}; }
${P}:has(.lr-solve[data-phone]) .tc-caption {
  left: var(--lr-scap-l) !important; right: auto !important; top: auto !important; bottom: ${cpx(3)} !important;
  max-width: min(calc(var(--lr-scap-w) + var(--lr-bar, 0px) - ${cpx(3)}), var(--lr-third)) !important;
}
/* mobile-3-board end */

/* mobile-4-board ─ Altar polish (D-040 gate review 1) ────────────────────────────────────
   Tray: bigger gems (layout.ts), counts 13 px; a used-up type is dimmed, never struck out.
   The ↻ badge on a held gem is small and sits on its corner, under the title. The hint stays
   inside the column (altar-scene drops its ↻ clause if it would not fit). Gives/Needs: the
   same two-line card everywhere: "Gives N" / "×K strikes", "Needs N" / "in one strike". */
${A} .lr-altar-count { font-size: ${tpx(13)}; line-height: 1.2; }
${A} .lr-altar-count[data-empty] { opacity: 0.4; color: inherit; text-decoration: none; border-color: rgba(232,192,106,0.45); }
${A} .lr-altar-slot[data-empty] { display: none; }
${A} .lr-altar-turnmark {
  width: ${cpx(26)}; height: ${cpx(26)}; font-size: ${tpx(17)}; border-width: 1px; transform: translate(-50%, -50%);
  box-shadow: 0 ${cpx(1)} ${cpx(4)} rgba(0,0,0,0.7);
}
${A} .lr-altar-hint {
  max-width: var(--lr-col-w) !important; overflow: hidden; font-size: ${tpx(11)}; padding: ${cpx(2)} ${cpx(4)};
}
${A} .lr-altar-need { padding: ${cpx(1)} ${cpx(4)}; }
${A} .lr-altar-need .lr-need-row { white-space: nowrap; }
${A} .lr-altar-need:is([data-align="up"], [data-align="down"]) {
  flex-direction: column; flex-wrap: nowrap; align-items: center; gap: 0; max-width: none;
}
${A} .lr-altar-need :is(.lr-need-note, .lr-storm-row) { display: block; white-space: nowrap; line-height: 1.05; margin-top: 0; font-size: ${tpx(11)}; }
${A} .lr-altar-need .lr-need-row { line-height: 1.05; }
/* After a multi-strike, a north/south card stays two lines: each strike's reading stands in
   for "got" (the last strike's), so the card fits the room the layout gave it. */
${A} .lr-altar-need:is([data-align="up"], [data-align="down"]):has(.lr-need-strikes) .lr-need-got { display: none; }
${A} .lr-altar-need .lr-need-strikes { line-height: 1.05; margin-top: ${cpx(1)}; }
${A} .lr-altar-need .lr-need-strikes span { padding: 0 ${cpx(3)}; border-radius: ${cpx(4)}; }
/* mobile-4-board end */

/* mobile-5-moments ─ Hint, FUSE, verdict and solve, one at a time (D-040 addendum 3) ──────
   The how-to line heads the lane under the tray (altar-scene), its own slot: FUSE's bubble
   never covers or replaces it. The bubble sits over FUSE's head with a tail pointing at him. A
   fail shows the socket's tag and one verdict card ("Try: …" on its own line); FUSE's quip
   waits until the player acts. The solve moment is one card in the column, Continue full width. */
${A} .lr-altar-lane > .lr-altar-hint {
  position: relative !important; left: auto !important; top: auto !important; bottom: auto !important;
  white-space: nowrap; width: max-content; max-width: var(--lr-col-w) !important; overflow: hidden;
  padding: ${cpx(1)} ${cpx(5)}; font-size: ${tpx(12)}; line-height: 1.3; border-radius: ${cpx(6)};
  visibility: visible !important;
}
${A}:has(.lr-altar-verdict:not([hidden])) .lr-altar-lane > .lr-altar-hint { display: none; }
${P}:has(.lr-altar[data-phone]) .tc-caption { overflow: visible; }
${P}:has(.lr-altar[data-phone]) .tc-caption::after {
  content: ''; position: absolute; left: calc(var(--lr-cap-tail, ${cpx(22)}) - ${cpx(5)}); bottom: ${cpx(-5)};
  width: ${cpx(8)}; height: ${cpx(8)}; background: inherit; border: 1px solid var(--tc-color-border);
  border-width: 0 1px 1px 0; transform: rotate(45deg); pointer-events: none;
}
/* The arrival card, paged: one new piece at a time, with its place in the run. */
${A} .lr-altar-tip .lr-info-page {
  margin-top: ${cpx(1)}; font-family: var(--tc-font-ui); font-size: ${tpx(10.5)}; letter-spacing: 0.5px; color: #b9a98a;
}
/* The verdict: its line, then the next step on a line of its own (no run-on "·"). */
${A} .lr-altar-verdict .lr-verdict-story, ${A} .lr-altar-verdict .lr-verdict-hint {
  display: block; margin-top: ${cpx(2)}; font-family: var(--tc-font-body, serif); font-size: ${tpx(12)}; line-height: 1.3;
}
${A} .lr-altar-verdict .lr-verdict-story::before, ${A} .lr-altar-verdict .lr-verdict-hint::before { content: none; }

/* Solve: one card, ≥12 CSS px inside the play area; Continue 44 px tall across the card. */
${P} .lr-solve[data-phone] {
  top: ${cpx(8)}; width: calc(var(--lr-col-w) + var(--lr-bar, 0px) - ${cpx(12)}); gap: 0;
}
${P} .lr-solve[data-phone] .lr-solve-card {
  display: flex; flex-direction: column; gap: ${cpx(4)}; padding: ${cpx(7)} ${cpx(10)} ${cpx(9)};
  border-width: 1px; border-radius: ${cpx(10)}; box-shadow: 0 ${cpx(3)} ${cpx(12)} rgba(0,0,0,0.6);
}
${P} .lr-solve[data-phone] .lr-solve-card h2 { font-size: ${tpx(16)}; letter-spacing: 0.5px; }
${P} .lr-solve[data-phone] .lr-solve-card .lr-solve-sub { margin: 0; font-size: ${tpx(12.5)}; line-height: 1.3; opacity: 0.85; }
${P} .lr-solve[data-phone] .lr-solve-grant { margin: ${cpx(2)} 0 0; gap: ${cpx(7)}; font-size: ${tpx(14)}; line-height: 1.2; }
${P} .lr-solve[data-phone] .lr-solve-grant .lr-gem-dot { width: ${cpx(16)}; height: ${cpx(16)}; box-shadow: 0 0 ${cpx(5)} currentColor; }
${P} .lr-solve[data-phone] .lr-solve-gem {
  flex: none; width: ${cpx(30)}; height: ${cpx(30)}; border-radius: 50%;
  border: 1px solid #5a3d12; box-shadow: inset 0 0 ${cpx(3)} rgba(0,0,0,0.8);
}
${P} .lr-solve[data-phone] .lr-solve-codex { margin: 0; font-size: ${tpx(12)}; line-height: 1.3; }
${P} .lr-solve[data-phone] .lr-solve-opens { margin: 0; font-size: ${tpx(12)}; line-height: 1.3; }
${P} .lr-solve[data-phone] .lr-page-note {
  margin: ${cpx(2)} 0 0; padding: ${cpx(4)} ${cpx(8)}; transform: none; border-radius: ${cpx(4)};
  font-size: ${tpx(12)}; line-height: 1.25; box-shadow: inset 0 0 0 1px rgba(90,61,18,0.45);
}
${P} .lr-solve[data-phone] .lr-page-note b { font-size: ${tpx(11.5)}; letter-spacing: 1px; margin-bottom: 0; white-space: nowrap; }
${P} .lr-solve[data-phone] .lr-solve-continue {
  align-self: stretch; width: 100%; min-width: 0; min-height: ${cpx(44)}; height: ${cpx(44)}; margin-top: ${cpx(3)};
  padding: 0; font-size: ${tpx(15)}; border-radius: ${cpx(8)}; border-width: 1px;
}
/* FUSE's line: beside him, fully on screen, its tail at his face; it steps out rather than
   touch the card (solve-scene updateCrowd). */
${P}:has(.lr-solve[data-phone]) .tc-caption {
  bottom: ${cpx(8)} !important; overflow: visible;
  max-width: min(calc(var(--lr-scap-w) + var(--lr-bar, 0px) - ${cpx(12)}), var(--lr-third)) !important;
}
${P}:has(.lr-solve[data-phone]) .tc-caption::after {
  content: ''; position: absolute; left: ${cpx(-5)}; bottom: calc(var(--lr-scap-face, ${cpx(40)}) - ${cpx(8)} - ${cpx(4)});
  width: ${cpx(8)}; height: ${cpx(8)}; background: inherit; border: 1px solid var(--tc-color-border);
  border-width: 0 0 1px 1px; transform: rotate(45deg); pointer-events: none;
}
${P}:has(.lr-solve[data-phone][data-crowd]) .tc-caption { visibility: hidden; }
/* mobile-5-moments end */

/* mobile-5-board ─ The altar fills a wide phone (D-040 gate review 2) ────────────────────
   The canvas fills the width on the altar and the solve moment too (game/ctx.ts FILL_BANDS),
   cropping --lr-crop-t/-b design px off the top and bottom: the rail buttons, the title and
   the solve card move in by the crop (the board and column lay out in the visible band).
   Strike stands 12 CSS px in from the screen's edge. Text: Gives/Needs numbers 15 px, every
   other board label, gem count and the hint 13 px. One rotate control: Turn on the rail, dim
   until there is a gem to turn, then lit; no ↻ chip on the gem. */
${P} .lr-altar-actions [data-action="back"] { top: calc(${CT} + ${cpx(4)}); }
${P} .lr-altar-actions [data-action="undo"] { top: calc(${CT} + (1080px - ${CT} - ${CB}) * 0.34); }
${P} .lr-altar-actions [data-action="clear"] { top: calc(${CT} + (1080px - ${CT} - ${CB}) * 0.34 + ${cpx(52)}); }
${P} .lr-altar-actions [data-action="strike"] { right: calc(-1 * var(--lr-bar, 0px) + ${cpx(12)}); bottom: calc(${CB} + ${cpx(6)}); }
${A} .lr-altar-turnbtn { bottom: calc(${CB} + ${cpx(6)}); }
${A} .lr-altar-title { top: calc(${CT} + ${cpx(3)}); }
/* The solve card reaches from the column to 12 px inside the screen's edge (the canvas fills
   the width, so there is no free right bar; Strike and the menu are gone while it shows). */
${P} .lr-solve[data-phone] {
  top: calc(${CT} + ${cpx(12)});
  width: calc(1920px - var(--lr-col-l) + var(--lr-bar, 0px) - ${cpx(12)});
}
${P}:has(.lr-solve[data-phone]) .tc-caption { bottom: calc(${CB} + ${cpx(8)}) !important; }

${A} .lr-altar-turnmark { display: none !important; }
${A} .lr-altar-turnbtn:disabled { opacity: 0.45; filter: saturate(0.3); cursor: default; }
${A} .lr-altar-turnbtn:disabled b { color: #bfae8a; }
${A} .lr-altar-turnbtn[data-active] {
  color: #fff6dd; background: rgba(66,50,22,0.96); border-color: var(--lr-gold);
  box-shadow: 0 0 0 ${cpx(1)} rgba(232,192,106,0.6), 0 0 ${cpx(12)} rgba(232,192,106,0.55);
}

${A} .lr-altar-need { font-size: ${tpx(13)}; color: #f4e6c4; }
${A} .lr-altar-need .lr-need-row b { font-size: ${tpx(15)}; }
${A} .lr-altar-need :is(.lr-need-note, .lr-storm-row, .lr-need-got, .lr-need-got b, .lr-need-strikes) { font-size: ${tpx(13)}; opacity: 1; }
${A} .lr-altar-need .lr-need-note { color: #e6d6b2; }
${A} .lr-altar-need .lr-need-strikes .lr-need-strike-lead { font-style: normal; align-self: center; color: #e6d6b2; }
/* A one-strike north/south card keeps one line after a strike: "Needs 4  got 0" side by side
   (the layout gives it one line of room, and the board fills the height). */
${A} .lr-altar-need:is([data-align="up"], [data-align="down"]):not(:has(.lr-need-note, .lr-need-strikes)) {
  flex-direction: row; align-items: baseline; gap: ${cpx(6)};
}
${A} .lr-altar-count { font-size: ${tpx(13)}; }
${A} .lr-altar-count[data-empty] { opacity: 1; color: #a89a80; }
${A} .lr-altar-hint, ${A} .lr-altar-lane > .lr-altar-hint { font-size: ${tpx(13)}; background: rgba(12,10,8,0.86); white-space: normal; text-wrap: balance; line-height: 1.25; }
${A} .lr-altar-lane .lr-altar-cap, ${A} .lr-cap-head { font-size: ${tpx(13)}; }
/* mobile-5-board end */

/* mobile-6-moments ─ One owner of the column; teach cards paged by tap (D-040 addendum 4) ──
   altar-scene arrangeColumn asks moments.ts arbitrate who gets the room under the tray:
   verdict > teach card > gem tip > how-to line > FUSE. A tip that does not fit shrinks to its
   name line (data-arb="line"); anything else waits (data-arb="wait", FUSE's caption frozen).
   The lane steps right of any Gives/Needs card (--lr-lane-l/-w), so nothing touches a label. */
${A} .lr-altar-lane { left: var(--lr-lane-l, var(--lr-col-l)); width: var(--lr-lane-w, var(--lr-col-w)); }
${A} .lr-altar-lane > [data-arb="wait"] { visibility: hidden !important; position: absolute !important; }
${A} .lr-altar-lane > .lr-altar-tip[data-arb="line"] > :not(:first-child) { display: none; }
${A} .lr-altar-lane > .lr-altar-tip[data-arb="line"] > :first-child {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* The verdict outranks a gem's tip: both may show, the verdict first (the old rule hid it). */
${A}:has(.lr-altar-tip:not([hidden])) .lr-altar-lane .lr-altar-verdict:not([hidden]) { display: block; }
/* The verdict's cause, then its next step, each on a line of its own. */
${A} .lr-altar-verdict .lr-verdict-cause {
  display: block; margin-top: ${cpx(2)}; font-family: var(--tc-font-ui); font-size: ${tpx(12.5)}; line-height: 1.3;
  letter-spacing: 0; color: #ffb3a0;
}
/* The teach card's footer: its place in the run, and a button to turn the page. */
${A} .lr-altar-tip .lr-info-foot {
  display: flex; align-items: center; justify-content: space-between; gap: ${cpx(8)}; margin-top: ${cpx(4)};
}
${A} .lr-altar-tip .lr-info-page { margin: 0; font-size: ${tpx(12)}; }
${A} .lr-altar-tip .lr-info-next {
  position: relative; flex: none; pointer-events: auto; min-height: ${cpx(36)}; min-width: ${cpx(72)};
  padding: 0 ${cpx(12)}; font-size: ${tpx(13)}; line-height: 1; border-radius: ${cpx(8)}; border-width: 1px;
}
/* A 44 px finger target around the 36 px button. */
${A} .lr-altar-tip .lr-info-next::before {
  content: ''; position: absolute; left: 50%; top: 50%; width: max(100%, ${cpx(44)}); height: ${cpx(44)};
  transform: translate(-50%, -50%);
}
${A} .lr-altar-tip:has(.lr-info-next) { pointer-events: auto; }
/* Text floors: tray counts 13 px (keycap and count), solve-card lore 12 px. */
${A} .lr-altar-count .lr-n { font-size: ${tpx(13)}; }
${A} .lr-altar-count kbd.lr-k { font-size: ${tpx(13)}; line-height: 1.2; min-width: 0; }
${P} .lr-solve[data-phone] .lr-page-note, ${P} .lr-solve[data-phone] .lr-page-note b { font-size: ${tpx(12)}; }
/* mobile-6-moments end */

/* ── Title ──────────────────────────────────────────────────────────────── */
${P} .tc-link-copy, ${P} .tc-link-message { font-size: ${tpx(11)}; padding: ${cpx(2)} ${cpx(8)}; }
${P} .lr-title-links { right: ${cpx(6)}; bottom: ${cpx(4)}; gap: ${cpx(6)}; }
${P} .lr-title-coffee { min-height: ${cpx(24)}; padding: 0 ${cpx(8)}; font-size: ${tpx(11)}; }
${P} .lr-release { font-size: ${tpx(11)}; }
${CHROME_CSS}${CHROME4_CSS}${CHROME5_CSS}`;
