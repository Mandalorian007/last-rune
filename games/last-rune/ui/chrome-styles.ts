/**
 * Phone chrome in CSS px (ws/port-chrome, D-041 Phase 2). On phones the menus, panels, HUD
 * and FUSE's docked caption live in the engine's CSS-px overlay (`ctx.chrome`, ui/chrome.ts),
 * laid out by regions; these rules style them there. Plain px are CSS px; every `font-size`
 * follows Settings → Text size and floors at 12 px (`scaleFontSizes`, styles.ts).
 *
 * World-anchored phone rules (the altar, the hall's door plates and Next ring, the journal's
 * book, the ending) stay on the scaled overlay in ui/phone-base.ts and the scenes' *-phone-styles.ts.
 */

/** The CSS-px overlay on a phone, ranked above every `.tc-overlay .class` rule. */
export const C = '.tc-overlay[data-units="css"][data-form-factor^="phone"]:not(#lr-none)';
/** Either overlay off phones: phone-only controls (✕, segmented toggles) hide there. */
const CP = '.tc-overlay[data-units="css"][data-form-factor="phone-portrait"]:not(#lr-none)';
export const CL = '.tc-overlay[data-units="css"][data-form-factor="phone-landscape"]:not(#lr-none)';
const OFF = '.tc-overlay:not([data-phone]):not([data-form-factor^="phone"])';

export const CHROME_CSS = /* css */ `
/* ── Compact controls ───────────────────────────────────────────────────── */
${C} .tc-button, ${C} .lr-stone-button, ${C} .lr-gold-button {
  min-width: 0; min-height: 28px; padding: 0 10px; font-size: 13px;
  border-radius: 7px; border-width: 1px;
}
${C} .lr-gold-button { padding: 0 14px; }

/* ── HUD: one ☰ in the top-right corner of the right bar ──────────────────
   Tapped, it lists Journal, Codex and Settings below it; the ☰ carries the journal's dot. */
${C} .lr-hud { position: relative; inset: auto; gap: 4px; align-items: flex-end; }
${C} .lr-hud > button:not(.lr-hud-menu) { display: none; }
${C} .lr-hud[data-open] > button:not(.lr-hud-menu):not([hidden]) {
  display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px; font-size: 13px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.7);
}
${C} .lr-hud .lr-hud-menu {
  display: flex; align-items: center; justify-content: center; width: 44px; height: 36px; min-height: 0;
  padding: 0; font-size: 20px; line-height: 1;
}
${C} .lr-hud .lr-hud-menu[data-unread]::after {
  content: ''; position: absolute; right: 4px; top: 4px; width: 8px; height: 8px;
  border-radius: 50%; background: #ff8a3c; box-shadow: 0 0 4px #ff8a3c;
}
${C} .lr-hud[data-scene="solve"] { display: none; }
/* ── FUSE's caption: a slim bubble, paged by tap (ui/fuse.ts pages it at 12 words) ───────── */
${C} { --tc-caption-margin: 6px; --tc-caption-max-width: min(280px, var(--tc-third, 100vw)); }
${C} .tc-caption {
  gap: 6px; padding: 4px 9px; border-radius: 8px; border-width: 1px;
}
${C} .tc-caption-side { display: none; }
${C} .tc-caption-text { font-size: 12.5px; line-height: 1.3; }
/* ── Panels ─────────────────────────────────────────────────────────────── */
${C} .tc-panel { max-width: 100%; max-height: 100%; }
${C} .tc-panel:has(> .lr-codex) { width: 100%; height: 100%; padding: 0; overflow: visible; }
${C} .tc-card { padding: 8px 12px; border-radius: 10px; }

/* Settings: two columns, nearly full width; Done stays pinned while it scrolls. */
${C} .lr-settings { width: 100%; gap: 2px; font-size: 12px; }
${C} .lr-settings h2 { font-size: 14px; margin: 0; }
${C} .lr-settings h3 { font-size: 12px; margin: 4px 0 0; }
${C} .lr-settings-cols { gap: 0 20px; }
${C} .lr-settings-col, ${C} .lr-settings section { gap: 2px; }
${C} .lr-settings .tc-field { min-height: 28px; font-size: 12px; }
${C} .lr-settings .tc-field > span { flex: 0 0 8em; }
${C} .lr-settings select { min-height: 26px; padding: 0 6px; font-size: 12px; }
${C} .lr-settings input[type="range"] { min-height: 24px; }
${C} .lr-settings textarea { height: 34px; font-size: 11px; }
${C} .lr-settings .lr-row { gap: 6px; }
${C} .lr-settings .lr-settings-done { padding: 4px 0 0; }
${C} .lr-confirm { width: min(100%, 440px); }

/* Codex: the tome fills the screen; each page keeps its plate with FUSE's note beside it and
   scrolls if it has to; the tabs sit in a strip under the pages. */
${C} .lr-codex { width: 100%; height: 100%; padding: 15px 6px 38px; border-radius: 10px; }
${C} .lr-codex-page { padding: 8px 12px 6px; grid-template-columns: 76px 1fr; column-gap: 10px; font-size: 12px; }
${C} .lr-codex-page h3 { padding-bottom: 2px; font-size: 15px; }
${C} .lr-codex-status { margin: 2px 0 4px; font-size: 11px; }
${C} .lr-plate { width: 76px; height: 76px; border-radius: 8px; }
${C} .lr-niche { width: 64px; height: 64px; }
${C} .lr-niche--locked::before, ${C} .lr-niche--locked::after { width: 76px; left: -6px; }
${C} .lr-margin { grid-column: 2; transform: none; padding: 2px 6px; align-self: start; font-size: 11.5px; line-height: 1.3; }
${C} .lr-codex-rule { margin-top: 6px; line-height: 1.3; font-size: 12px; }
${C} .lr-codex-maths { margin-top: 4px; padding: 3px 6px; font-size: 11px; }
${C} .lr-codex-head { top: 1px; font-size: 11px; letter-spacing: 1px; }
${C} .lr-codex-nav { bottom: 5px; gap: 4px; }
${C} .lr-codex-nav button { min-height: 26px; height: auto; padding: 0 8px; border-radius: 13px; font-size: 12px; }
${C} .lr-codex-nav .lr-dot { width: 7px; height: 7px; margin-right: 3px; }
${C} .lr-codex-close { width: 30px; height: 30px; right: 10px; top: 10px; font-size: 16px; }

/* FUSE's lines break evenly, never one word alone on the last line. */
${C} .tc-caption-text { text-wrap: balance; }

/* The ☰ list says what its dot means. */
${C} .lr-hud[data-open] > button[data-action="journal"] { flex-direction: column; align-items: flex-end; justify-content: center; line-height: 1.15; }
${C} .lr-hud-note { display: block; font: italic 11px/1.1 var(--tc-font-body, serif); color: #ffb27a; letter-spacing: 0; }
${C} .lr-hud-note[hidden] { display: none; }
/* Codex: the book fits the visible band; a readable header; tabs a thumb tall (the strip
   scrolls sideways if every gem is met); bigger text that uses the whole page; FUSE's note in
   dark ink; the × matches the other panels' ✕. */
${C} .lr-codex {
  height: 100%; padding: 22px 6px 46px;
}
${C} .lr-codex-head { top: 3px; font-size: 13px; letter-spacing: 0.5px; color: #f8e6b8; }
${C} .lr-codex-nav {
  bottom: 5px; gap: 5px; justify-content: safe center; overflow-x: auto; scrollbar-width: none;
  padding: 0 10px;
}
${C} .lr-codex-nav button {
  flex: none; min-height: 36px; height: 36px; padding: 0 11px; border-radius: 18px;
  font-size: 13px;
}
${C} .lr-codex-nav .lr-dot { width: 9px; height: 9px; margin-right: 4px; }
${C} .lr-codex-page {
  padding: 8px 14px 4px; grid-template-columns: 88px 1fr; column-gap: 12px;
  font-size: 14px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none;
}
/* The shortest phones (SE, 320 tall): a touch smaller so a page's rule and maths fit above the tabs. */
@media (max-height: 330px) {
  ${C} .lr-codex-page { font-size: 13px; grid-template-columns: 76px 1fr; }
  ${C} .lr-plate { width: 76px; height: 76px; }
  ${C} .lr-niche { width: 72px; height: 72px; }
  ${C} .lr-margin { font-size: 12px; line-height: 1.3; }
  ${C} .lr-codex-rule { margin-top: 5px; font-size: 13px; line-height: 1.3; }
  ${C} .lr-codex-maths { margin-top: 4px; padding: 2px 6px; font-size: 12px; }
}
${C} .lr-codex-page h3 { font-size: 18px; padding-bottom: 3px; padding-right: 40px; gap: 3px 6px; }
${C} .lr-codex-page .lr-status, ${C} .lr-codex-page .lr-new { font-size: 11px; padding: 0 6px; letter-spacing: 1px; vertical-align: 0; margin: 0; }
${C} .lr-codex-status { font-size: 12px; margin: 3px 0 6px; }
${C} .lr-plate { width: 88px; height: 88px; }
/* chrome-polish-3: the charge chips and ✕ marks sized to the small plate, so none is cropped
   by its edge. */
${C} .lr-plate-chip { font-size: 12px; line-height: 1.1; border-width: 1.5px; padding: 0 0.3em; box-shadow: 0 0 5px rgb(80 180 255 / 0.45); }
${C} .lr-plate-nogo { width: 15px; height: 15px; border-width: 1.5px; }
${C} .lr-plate-nogo::before, ${C} .lr-plate-nogo::after { width: 8px; height: 2px; }
${C} .lr-niche { width: 84px; height: 84px; }
${C} .lr-margin {
  align-self: center; padding: 2px 0 2px 8px; font-size: 13px; line-height: 1.35;
  color: #3e2208; border-left: 2px dashed rgb(110 60 15 / 0.6);
}
${C} .lr-margin b { font-size: 11px; letter-spacing: 1px; margin-bottom: 2px; color: #6a3a0c; }
${C} .lr-codex-rule { margin-top: 8px; font-size: 14px; line-height: 1.35; }
${C} .lr-codex-maths { margin-top: 6px; padding: 4px 8px; font-size: 13px; }
${C} .lr-codex-folio { font-size: 12px; }
${C} .lr-codex-close {
  top: 28px; right: 14px; width: 36px; height: 36px; font-size: 18px;
  border-width: 1px; color: #3b2414; background: rgb(255 255 255 / 0.4);
}

/* Close ✕ (D-040: Settings, Codex and Journal all close from the top-right corner, plus Esc/Back).
   Phones only; desktop keeps its Done / × / Back. */
${OFF} :is(.lr-seg, .lr-panel-x) { display: none !important; }
${C} .lr-panel-x {
  position: absolute; top: 4px; right: 4px; z-index: 2; display: grid; place-items: center;
  width: 36px; height: 36px; min-height: 0; padding: 0; border-radius: 50%; cursor: pointer;
  font: 600 16px/1 var(--tc-font-ui, system-ui, sans-serif); color: #f3e6c8;
  background: rgb(255 255 255 / 0.1); border: 1px solid rgb(232 192 106 / 0.5);
}
${C} .lr-panel-x:active { background: rgb(232 192 106 / 0.3); }

/* Settings: a fixed header (title, ✕) and footer (Done) with the two columns scrolling between,
   so nothing is ever cut off; every row is a thumb tall; choices are segmented toggles. */
${C} .tc-panel.lr-settings-host {
  display: flex; flex-direction: column; overflow: hidden; width: 100%; max-height: 100%;
  padding: 6px 6px 10px 14px; box-sizing: border-box;
}
${C} .lr-settings-host .tc-panel-title { flex: none; margin: 0; font-size: 16px; line-height: 36px; }
${C} .lr-settings { width: auto; flex: 1 1 auto; min-height: 0; gap: 0; outline: none; }
${C} .lr-settings-cols {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-right: 8px;
  gap: 0 22px; scrollbar-width: thin; padding-bottom: 14px;
  /* A soft bottom edge says "more below" instead of a half-cut row. */
}
${C} .lr-settings-cols[data-more] { mask-image: linear-gradient(#000 calc(100% - 22px), transparent); }
${OFF} .lr-settings-more { display: none; }
${C} .lr-settings-more {
  margin-right: auto; min-height: 32px; padding: 0 12px; font-size: 13px;
  color: #f2d89a; background: rgb(232 192 106 / 0.12); border: 1px solid rgb(232 192 106 / 0.45);
  border-radius: 16px;
}
${C} .lr-settings-more[hidden] { display: none; }
${C} .lr-settings-col, ${C} .lr-settings section { gap: 0; }
${C} .lr-settings h3 { margin: 6px 0 0; font-size: 12px; line-height: 1.4; }
${C} .lr-settings .tc-field, ${C} .lr-choice { min-height: 44px; }
${C} .lr-choice { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
${C} .lr-choice label.lr-field { flex: 0 1 auto; min-width: 0; font-size: 12.5px; }
${C} .lr-choice select { display: none; }
${C} .lr-seg {
  display: inline-flex; flex: none; border: 1px solid var(--tc-color-border); border-radius: 8px;
  overflow: hidden; background: var(--tc-color-surface-alt);
}
${C} .lr-seg button {
  min-height: 34px; padding: 0 9px; border: 0; margin: 0; cursor: pointer;
  font: 12px/1.1 var(--tc-font-body, serif); color: var(--tc-color-text); background: transparent;
}
${C} .lr-seg button + button { border-left: 1px solid var(--tc-color-border); }
${C} .lr-seg button[aria-checked="true"] { color: #2a1906; background: linear-gradient(180deg, #f3d488, #c99a45); font-weight: 600; }
${C} .lr-settings .tc-field { font-size: 12.5px; }
${C} .lr-settings .tc-field > span { flex: 0 0 7.5em; }
${C} .lr-settings input[type="range"] {
  -webkit-appearance: none; appearance: none; height: 44px; min-height: 0; margin: 0; background: transparent;
}
${C} .lr-settings input[type="range"]::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: rgb(232 192 106 / 0.35); }
${C} .lr-settings input[type="range"]::-moz-range-track { height: 6px; border-radius: 3px; background: rgb(232 192 106 / 0.35); }
${C} .lr-settings input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 22px; height: 22px; margin-top: -8px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff1b5, #e8c06a 55%, #9a6d2a); border: 1px solid #5a3d12;
}
${C} .lr-settings input[type="range"]::-moz-range-thumb {
  width: 22px; height: 22px; border-radius: 50%; background: #e8c06a; border: 1px solid #5a3d12;
}
${C} .lr-settings textarea { height: 40px; margin: 4px 0; }
${C} .lr-settings .lr-row { gap: 8px; }
${C} .lr-settings .lr-row .tc-button { min-height: 36px; margin: 4px 0; }
${C} .lr-settings-danger { margin-top: 6px; padding-top: 4px; border-top: 1px solid rgb(255 120 100 / 0.25); }
${C} .lr-settings .lr-danger { color: #ffe3dc; background: linear-gradient(180deg, #a3341f, #6e1d12); border-color: #e0664c; }
${C} .lr-settings .lr-settings-done { flex: none; position: static; padding: 4px 8px 6px 0; margin: 0; }
${C} .lr-settings .lr-settings-done .tc-button { min-height: 40px; min-width: 88px; }

${C} .lr-title-coffee, ${C} .lr-title-links .tc-link-copy {
  min-height: 36px; padding: 0 12px; font-size: 12.5px; box-sizing: border-box;
}
/* Settings: the columns scroll natively beside a drawn thumb (iOS hides its own until you
   scroll); the bottom fade shows only while there is more below; "Graphics & Save ▾" jumps. */
${C} .lr-settings-scroll { position: relative; display: flex; flex: 1 1 auto; min-height: 0; }
${C} .lr-settings-scroll > .lr-settings-cols {
  position: relative; flex: 1 1 auto; min-width: 0; scrollbar-width: none; padding-right: 16px;
}
${C} .lr-settings-scroll > .lr-settings-cols::-webkit-scrollbar { display: none; }
${C} .lr-settings-rail {
  position: absolute; right: 3px; top: 4px; bottom: 8px; width: 5px;
  border-radius: 3px; background: rgb(232 192 106 / 0.16); pointer-events: none;
}
${C} .lr-settings-rail[hidden] { display: none; }
${C} .lr-settings-thumb {
  position: absolute; left: 0; right: 0; min-height: 24px; border-radius: 3px;
  background: rgb(240 205 125 / 0.85);
}
${C} .lr-settings-more { min-height: 40px; padding: 0 14px; border-radius: 20px; }

/* Codex: the ✕ gets a gutter of its own in the leather, right of the pages, so it never
   touches a header; the page number goes (it cost a line on the shortest phones); a page that
   still runs long scrolls with a fade at its foot while more is below. */
${C} .lr-codex { padding-right: 50px; }
${C} .lr-codex-close { top: 32px; right: 7px; background: rgb(255 240 200 / 0.14); color: #f8e6b8; border-color: rgb(232 192 106 / 0.6); }
${C} .lr-codex-page h3 { padding-right: 0; }
${C} .lr-codex-folio { display: none; }
${C} .lr-codex-page[data-more] { mask-image: linear-gradient(#000 calc(100% - 20px), rgb(0 0 0 / 0.15)); }

/* The ☰ says "Menu" under it; when the journal has new pages, a tag under it says so. */
${C} .lr-hud .lr-hud-menu { position: relative; flex-direction: column; gap: 0; height: 44px; }
${C} .lr-hud .lr-hud-menu > span { font-size: 18px; line-height: 1; }
${C} .lr-hud-menu-label { display: block; font: 600 12px/1 var(--tc-font-display, serif); letter-spacing: 0.3px; margin-top: 1px; }
/* chrome-polish-3: the game's toast look (dark card, gold rule, cream serif), not a salmon
   sticker. chrome-polish-4 (blind review 6: it wedged under Menu in two cramped lines): one
   line beside the button, level with it, led by the journal's own red "new" dot, so it reads
   as a note about the Menu rather than part of it. */
${C} .lr-hud-menu-new {
  position: absolute; top: 50%; right: calc(100% + 6px); left: auto; transform: translateY(-50%);
  display: flex; align-items: center; gap: 5px;
  width: max-content; box-sizing: border-box; padding: 4px 9px 5px 7px; border-radius: 6px;
  white-space: nowrap; letter-spacing: 0;
  font: 400 12px/1.1 var(--tc-font-body, serif); color: #f4e6c4; background: rgb(20 14 9 / 0.94);
  border: 1px solid rgb(232 192 106 / 0.45); border-left: 2px solid #e8c06a;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.7); pointer-events: none;
}
${C} .lr-hud-menu-new::before {
  content: ''; flex: none; width: 7px; height: 7px; border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #e0554a, #8a1a14);
}
${C} .lr-hud-menu-new[hidden], ${C} .lr-hud[data-open] .lr-hud-menu-new { display: none; }
/* FUSE's card carries his name (his portrait is hidden on phones), except at an altar, where
   he sits right beside it. */
${C} .tc-caption-text::before {
  content: 'FUSE '; font: 700 12px/1 var(--tc-font-display, serif); letter-spacing: 0.6px; color: #e8c06a;
}
/* Settings: the fold ends on a whole row (settings-panel fold()), so no fade is needed; the
   save code sits in a labelled box; Start over is a group of its own, ruled off in red. */
${C} .lr-settings-scroll > .lr-settings-cols { box-sizing: border-box; mask-image: none; }
${C} .lr-save-box {
  display: flex; flex-direction: column; gap: 2px; margin: 4px 0 0; padding: 4px 8px 6px;
  border: 1px solid rgb(232 192 106 / 0.45); border-radius: 8px; background: rgb(232 192 106 / 0.06);
}
${C} .lr-save-box > span { font: 600 12px/1.2 var(--tc-font-display, serif); color: #e8c06a; letter-spacing: 0.3px; }
${C} .lr-settings .lr-save-box textarea {
  height: 38px; margin: 0; padding: 4px 6px; resize: none; box-sizing: border-box;
  font: 12px/1.3 var(--tc-font-body, serif); color: #f4e6c4; background: rgb(10 7 4 / 0.55);
  border: 1px solid rgb(232 192 106 / 0.25); border-radius: 5px;
}
${C} .lr-settings .lr-save-box textarea::placeholder { color: rgb(244 230 196 / 0.6); font-style: italic; }
${C} .lr-settings-danger {
  margin: 10px 0 4px; padding: 4px 8px 2px; border: 1px solid rgb(224 102 76 / 0.45);
  border-radius: 8px; background: rgb(110 29 18 / 0.18);
}
${C} .lr-settings-danger h4 { margin: 0; font: 600 12px/1.3 var(--tc-font-display, serif); letter-spacing: 1px; text-transform: uppercase; color: #ff9c86; }
${C} .lr-settings-danger p { margin: 1px 0 0; font-size: 12px; line-height: 1.3; color: #e7d3c8; }
${C} .lr-settings-danger .tc-button { min-height: 36px; margin: 4px 0; }
${C} .lr-settings h3 { font-size: 12.5px; }
/* Codex on the shortest phones: the rule and its formula sit beside the gem, FUSE's note
   under them, so the whole rule shows without scrolling. */
@media (max-height: 330px) {
  ${C} .lr-plate, ${C} .lr-niche { grid-row: 3 / span 2; align-self: start; }
  ${C} .lr-codex-rule { grid-column: 2; grid-row: 3; margin-top: 0; }
  ${C} .lr-codex-maths { grid-column: 2; grid-row: 4; align-self: start; }
  ${C} .lr-margin { grid-column: 1 / -1; grid-row: 5; align-self: start; margin-top: 6px; }
}
${C} .lr-codex-status { font-size: 12px; }
/* Chrome text floor 12 px: the Yours / Not met yet / NEW tags and FUSE's margin label. */
${C} .lr-codex-page .lr-status, ${C} .lr-codex-page .lr-new, ${C} .lr-margin b {
  font-size: 12px; letter-spacing: 0.6px;
}

/* Settings: two tabs in the title row ("Sound & Comfort", "Graphics & Save"), each a whole
   view; no "Graphics & Save ▾" jump. */
${C} .tc-panel.lr-settings-host { position: relative; }
${C} .lr-settings-tabs {
  position: absolute; top: 5px; left: 50%; transform: translateX(-50%); display: flex;
  border: 1px solid rgb(232 192 106 / 0.5); border-radius: 18px; overflow: hidden;
  background: rgb(255 255 255 / 0.06);
}
${C} .lr-settings-tab {
  min-height: 34px; padding: 0 14px; margin: 0; border: 0; cursor: pointer; white-space: nowrap;
  font: 600 12.5px/1 var(--tc-font-body, serif); color: #f2d89a; background: transparent;
}
${C} .lr-settings-tab + .lr-settings-tab { border-left: 1px solid rgb(232 192 106 / 0.5); }
${C} .lr-settings-tab[aria-selected="true"] { color: #2a1906; background: linear-gradient(180deg, #f3d488, #c99a45); }
${C} .lr-settings-scroll > .lr-settings-cols[hidden] { display: none; }
/* A whole tab has no fade gap at its foot; at large text the fold still lands on a row. */
${C} .lr-settings-scroll > .lr-settings-cols[role="tabpanel"] { padding-bottom: 0; }

/* Codex on the shortest phones (SE): tighter spacing and FUSE's label inline with his note, so
   every page fits whole at 100% text. A page that still runs long (larger text) fades out at
   its foot over a ⌄ cue, never a line cut in half. */
@media (max-height: 330px) {
  ${C} .lr-codex-page { padding-top: 4px; }
  ${C} .lr-codex-page h3 { font-size: 16px; padding-bottom: 1px; }
  ${C} .lr-codex-status { margin: 1px 0 3px; }
  ${C} .lr-codex-rule, ${C} .lr-margin { line-height: 1.25; }
  ${C} .lr-codex-maths { margin-top: 2px; }
  ${C} .lr-margin { margin-top: 3px; }
  ${C} .lr-margin b { display: inline; margin: 0 6px 0 0; }
}
${C} .lr-codex-page[data-more] {
  mask-image: linear-gradient(#000 calc(100% - 34px), transparent calc(100% - 6px));
}
${OFF} .lr-codex-more { display: none; }
${C} .lr-codex-more {
  position: absolute; bottom: 1px; transform: translateX(-50%); z-index: 1; pointer-events: none;
  font: 700 18px/0.6 var(--tc-font-ui, system-ui, sans-serif); color: #6a3a0c;
}
${C} .lr-codex-more[hidden] { display: none; }

/* ── mobile-7-hall: the open ☰ list stands on a panel of its own (the hall dims behind it). */
${C} .lr-hud { z-index: 5; }
${C} .lr-hud[data-open]::before {
  content: ''; position: absolute; z-index: -1; inset: -5px -5px -6px -6px;
  border-radius: 10px; background: rgb(18 13 9 / 0.97); border: 1px solid rgb(232 192 106 / 0.35);
  box-shadow: 0 3px 14px rgb(0 0 0 / 0.8);
}
${C} .lr-hud-note { font-size: 12px; line-height: 1.15; }
/* New journal pages: one badge on the Menu button's lower edge (no separate dot). */
${C} .lr-hud .lr-hud-menu[data-unread]::after { display: none; }
/* Title: Play and Settings lead; the coffee and Copy link follow as quiet text links
   (chrome-polish-4, blind review 6: as pills they weighed as much as Play). Muted cream, no
   fill or frame, a dotted underline on the label, a shadow so the candles never wash them out.
   Still a 36 px tap each (44 px hit area). */
${C} .lr-title-links .tc-link-row { padding: 0; background: none; box-shadow: none; border-radius: 0; }
${C} .lr-title-links :is(.lr-title-coffee, .tc-link-copy) {
  min-height: 36px; padding: 0 8px; font-size: 12.5px; font-weight: 400; border-radius: 6px;
  color: rgb(236 222 190 / 0.82); background: none; border: 0; box-shadow: none;
  text-decoration: underline dotted rgb(232 192 106 / 0.5); text-underline-offset: 4px;
  text-shadow: 0 1px 3px #000, 0 0 8px #000;
}
${C} .lr-title-links :is(.lr-title-coffee, .tc-link-copy) :is(svg, img) { opacity: 0.8; }
${C} .lr-title-links :is(.lr-title-coffee, .tc-link-copy):hover { color: #fff3d6; text-decoration-color: #e8c06a; }
/* Settings: each segment a 36 px tap. */
${C} .lr-seg button { min-height: 36px; }
/* Every button and link keeps a 44 px hit area (an invisible ::before; see phone-base). */
:where(${C}) :where(button, a[href], [role="button"], summary) { position: relative; }
:where(${C}) :where(button, a[href], [role="button"], summary)::before {
  content: ''; position: absolute; pointer-events: auto;
  top: min(0px, calc(50% - var(--tc-tap-min) / 2)); bottom: min(0px, calc(50% - var(--tc-tap-min) / 2));
  left: min(0px, calc(50% - var(--tc-tap-min) / 2)); right: min(0px, calc(50% - var(--tc-tap-min) / 2));
}
${C} kbd { display: none !important; }
${C} input[type="checkbox"] { width: 18px; height: 18px; }
/* The rails hold the ☰ list and the journal's ✕: their open list may spill left of the rail. */
${C} .tc-region[data-region="right"], ${C} .tc-region[data-region="left"] { overflow: visible; align-items: flex-end; }
${C} .tc-region[data-region="left"] { align-items: flex-start; }

/* ── Title: Full screen and the release label top left, Ko-fi top right (landscape) or along
   the bottom (portrait); the menu a row along the bottom (landscape) or a column under the
   picture (portrait). ─────────────────────────────────────────────────────────── */
${C} .tc-region[data-region="top"] { justify-content: flex-start; }
${C} .lr-fullscreen { position: relative; inset: auto; min-height: 36px; padding: 0 12px; font-size: 13px; }
${C} .lr-release { position: relative; inset: auto; margin: 0; font-size: 12px; }
${C} .tc-link.lr-title-links { position: relative; inset: auto; margin-left: auto; align-items: flex-end; }
${C} .tc-region[data-region="bottom"] .tc-link.lr-title-links { margin: 0 auto; align-items: center; }
${C} .lr-title-links .tc-link-row { gap: 8px; }
${C} .lr-title-menu { position: relative; inset: auto; transform: none; gap: 8px; }
${C} .tc-region[data-region="bottom"] .lr-title-menu { flex-direction: row; margin: 0 auto; }
${C} .tc-region[data-region="cardLane"] { justify-content: center; }
/* Landscape (chrome-polish-4): Play over Settings in the right-hand lane, low, just above FUSE's
   line, so nothing covers the storm or FUSE on the left; the links quietly along the bottom,
   right of the storm cell like FUSE's line. */
${CL} .tc-region[data-region="cardLane"]:has(.lr-title-menu) { justify-content: flex-end; padding-bottom: 6px; }
${CL} .tc-region[data-region="bottom"]:has(.lr-title-links) { padding-left: 41%; justify-content: center; }
/* Upright: the menu centred in its lane under the picture (polish-8: no dead band below it);
   Full screen at the top of the slack above, the links at the bottom of the slack below. */
${CP} .tc-region[data-region="cardLane"]:has(.lr-title-menu) { justify-content: center; }
${CP} .tc-region[data-region="top"] { align-items: flex-start; }
${CP} .tc-region[data-region="bottom"] { align-items: flex-end; }
${C} .tc-region[data-region="cardLane"] .lr-title-menu { align-self: center; }
${C} .lr-title-menu .lr-gold-button {
  min-width: 150px; min-height: 48px; padding: 0 20px; border-radius: 9px;
  font-size: 19px; letter-spacing: 1px; border-width: 2px;
}
${C} .lr-title-menu .lr-stone-button { min-width: 150px; min-height: 44px; font-size: 15px; border-radius: 8px; }
${C} .tc-region[data-region="bottom"] .lr-title-menu :is(.lr-gold-button, .lr-stone-button) { min-width: 140px; min-height: 44px; }
${C} .tc-region[data-region="bottom"] .lr-title-menu .lr-gold-button { min-height: 48px; }

/* ── FUSE's caption, docked in its lane: his name leads the line. ─────────── */
${C} .tc-caption[data-docked] { box-sizing: border-box; }
/* Title, landscape (chrome-polish-3): the lane runs right of the storm cell (design x ≤ 740 of
   1920, under 40% of the width) and FUSE's strolls, so his line never covers either. */
${CL}:has(.lr-title-menu) .tc-caption[data-docked] {
  width: auto; margin-left: 41%;
  /* teach-5: the box hugs its one line, not the lane's height. */
  align-self: center; height: auto; min-height: 0; padding-top: 6px; padding-bottom: 6px;
}
/* Upright (chrome-polish-4): the box hugs his line, centred in the lane, rather than standing
   three times its height. */
${CP}:has(.lr-title-menu) .tc-caption[data-docked] { align-self: center; height: auto; padding-top: 8px; padding-bottom: 8px; }

/* ── The journal's ✕ sits at the top of the right rail, like the ☰. ─────────── */
${C} .lr-j-x { position: relative; inset: auto; display: grid; background: rgb(255 255 255 / 0.1); border: 1px solid rgb(232 192 106 / 0.5); border-radius: 50%; }

/* The open ☰ list: one column of equal buttons under the ☰. */
${C} .lr-hud[data-open] > button:not(.lr-hud-menu):not([hidden]) { align-self: stretch; justify-content: center; }

/* The Codex's brass corners, rims and gutter at phone size (styles.ts draws them in design px,
   which the scaled overlay used to shrink). */
${C} .lr-codex { box-shadow: inset 0 0 0 2px #2a140b, inset 0 0 16px rgb(0 0 0 / 0.6), 0 10px 30px rgb(0 0 0 / 0.8); }
${C} .lr-codex::before, ${C} .lr-codex::after, ${C} .lr-codex .lr-corner-bl, ${C} .lr-codex .lr-corner-br { width: 30px; height: 30px; }
${C} .lr-codex::before { left: -3px; top: -3px; border-top-left-radius: 10px; }
${C} .lr-codex::after { right: -3px; top: -3px; border-top-right-radius: 10px; }
${C} .lr-codex .lr-corner-bl { left: -3px; bottom: -3px; border-bottom-left-radius: 10px; }
${C} .lr-codex .lr-corner-br { right: -3px; bottom: -3px; border-bottom-right-radius: 10px; }
${C} .lr-codex-spread { border-radius: 4px; box-shadow: 0 0 0 1px #1c0d06, 0 3px 8px rgb(0 0 0 / 0.5); }
${C} .lr-codex-spread::after { left: calc(50% - 14px); width: 28px; }

/* While a panel is open, the ☰ steps back. */
${C}:has(.tc-panel-host[data-modal="true"]) .lr-hud { visibility: hidden; }
/* polish-10: and the title's buttons and links: on an upright phone Settings stood over Play,
   and a ghost "Pl" showed through its lower edge. */
${C}:has(.tc-panel-host[data-modal="true"]) :is(.lr-title-menu, .lr-title-links) { visibility: hidden; }

/* Settings on an upright phone: the tabs get their own row under the title, and each tab
   becomes one column with each choice under its label. */
${CP} .lr-settings-host { padding: 6px 6px 10px 12px; }
${CP} .lr-settings-tabs { position: static; transform: none; align-self: center; margin: 2px 0 6px; }
${CP} .lr-settings-tab { padding: 0 12px; }
${CP} .lr-settings-cols { grid-template-columns: 1fr; }
/* One label column, so every slider track starts at the same x. */
${CP} .lr-settings .tc-field > span { flex: 0 0 8.5em; }
${CP} .lr-settings .tc-field input[type="range"] { flex: 1 1 auto; min-width: 0; }
${CP} .lr-choice { flex-wrap: wrap; padding-bottom: 6px; }
${CP} .lr-choice > .lr-seg { margin-left: auto; }
`;
