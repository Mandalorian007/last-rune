/**
 * Phone and touch overrides (D-039; flags from ui/device-mode.ts).
 *
 * - `[data-touch]`: key caps hide (a finger has no keys).
 * - `[data-phone]`: the design is drawn at 0.33–0.40 CSS px per design px. Font sizes already
 *   floor at 14 CSS px through `--lr-text-min` (text-scale.ts); this sheet makes room for that
 *   text and gives every control a hit area of at least 44 CSS px (`--lr-tap`).
 *
 * Sizes here are written in CSS px through `cpx(n)` (n CSS px in design px), so they hold on
 * every phone. Overrides use `P`, which outranks any scene stylesheet whatever the load order.
 */

/** n CSS px, as a design-px length (phones only; the variable is unset elsewhere). */
export const cpx = (n: number) => `calc(var(--lr-css-px, 1px) * ${n})`;
/** Phone root selector, ranked above every `.tc-overlay .class` rule. */
export const P = '.tc-overlay[data-phone]:not(#lr-none)';
/** Touch root selector, same rank. */
export const T = '.tc-overlay[data-touch]:not(#lr-none)';

export const PHONE_CSS = /* css */ `
/* ── Touch: no key caps anywhere ────────────────────────────────────────── */
${T} kbd, ${T} .lr-keys-only { display: none !important; }
.tc-overlay:not([data-touch]) .lr-touch-only { display: none !important; }

/* ── Phone hit areas ───────────────────────────────────────────────────────
   Every button and link gets an invisible target at least 44 CSS px each way, centred on it.
   :where() keeps this rule weaker than any scene rule that positions the control itself. */
:where(.tc-overlay[data-phone]) :where(button, a[href], [role="button"], summary) { position: relative; }
:where(.tc-overlay[data-phone]) :where(button, a[href], [role="button"], summary)::before {
  content: ''; position: absolute; pointer-events: auto;
  top: min(0px, calc(50% - var(--lr-tap) / 2)); bottom: min(0px, calc(50% - var(--lr-tap) / 2));
  left: min(0px, calc(50% - var(--lr-tap) / 2)); right: min(0px, calc(50% - var(--lr-tap) / 2));
}
${P} select, ${P} input[type="range"] { min-height: ${cpx(36)}; }
${P} input[type="checkbox"] { width: ${cpx(28)}; height: ${cpx(28)}; }

/* ── HUD (Codex, Settings, Journal) ─────────────────────────────────────── */
${P} .lr-hud { left: ${cpx(8)}; top: ${cpx(6)}; gap: ${cpx(8)}; }
${P} .lr-hud button { min-height: ${cpx(38)}; padding: 0 ${cpx(12)}; border-radius: ${cpx(8)}; }
${P} .lr-nameplate { padding: ${cpx(4)} ${cpx(10)}; }
/* In the hall the top-left corner is an alcove at phone button sizes: the bar moves to the
   empty floor bottom left, in a row. */
${P} .lr-hud[data-scene="hall"] { top: auto; bottom: ${cpx(6)}; flex-direction: row; }

/* ── Panels: use the whole screen ───────────────────────────────────────── */
${P} .tc-panel { max-width: 99%; max-height: 98%; }
${P} .tc-card { padding: ${cpx(10)} ${cpx(14)}; }
${P} .tc-button, ${P} .lr-stone-button, ${P} .lr-gold-button { min-height: ${cpx(38)}; }
${P} .lr-stone-button { min-width: 0; padding: 0 ${cpx(14)}; }
${P} .lr-gold-button { min-width: ${cpx(150)}; padding: 0 ${cpx(20)}; }

/* Settings: the two columns stay, nearly full width; Done stays pinned while it scrolls. */
${P} .lr-settings { width: 1820px; gap: ${cpx(4)}; }
${P} .lr-settings-cols { gap: 0 ${cpx(24)}; }
${P} .lr-settings-col, ${P} .lr-settings section { gap: ${cpx(4)}; }
${P} .lr-settings .tc-field > span { flex: 0 0 7em; }
${P} .lr-settings select { min-height: ${cpx(38)}; padding: 0 ${cpx(8)}; }
${P} .lr-settings textarea { height: ${cpx(44)}; }
${P} .lr-settings .lr-row { gap: ${cpx(8)}; }
${P} .lr-settings .lr-settings-done { padding: ${cpx(6)} 0 ${cpx(2)}; }
${P} .lr-confirm { width: 1400px; }

/* Codex: the tome fills the screen; each page keeps its plate with FUSE's note beside it and
   scrolls if it has to; the tabs sit in their own strip under the pages. */
${P} .lr-codex { width: 1900px; height: 1056px; padding: ${cpx(8)} ${cpx(8)} ${cpx(50)}; border-radius: ${cpx(10)}; }
${P} .lr-codex-page { padding: ${cpx(12)} ${cpx(16)} ${cpx(8)}; grid-template-columns: ${cpx(96)} 1fr; column-gap: ${cpx(12)}; }
${P} .lr-codex-page h3 { padding-bottom: ${cpx(2)}; }
${P} .lr-codex-status { margin: ${cpx(4)} 0 ${cpx(6)}; }
${P} .lr-plate { width: ${cpx(96)}; height: ${cpx(96)}; border-radius: ${cpx(8)}; }
${P} .lr-niche { width: ${cpx(80)}; height: ${cpx(80)}; }
${P} .lr-niche--locked::before, ${P} .lr-niche--locked::after { width: ${cpx(96)}; left: ${cpx(-8)}; }
${P} .lr-margin { grid-column: 2; transform: none; padding: ${cpx(4)} ${cpx(8)}; align-self: start; }
${P} .lr-codex-rule { margin-top: ${cpx(8)}; line-height: 1.3; }
${P} .lr-codex-maths { margin-top: ${cpx(6)}; padding: ${cpx(4)} ${cpx(8)}; }
${P} .lr-codex-head { top: ${cpx(-2)}; }
${P} .lr-codex-nav { bottom: ${cpx(6)}; gap: ${cpx(6)}; }
${P} .lr-codex-nav button { min-height: ${cpx(36)}; height: auto; padding: 0 ${cpx(10)}; border-radius: ${cpx(18)}; }
${P} .lr-codex-nav .lr-dot { width: ${cpx(9)}; height: ${cpx(9)}; margin-right: ${cpx(4)}; }
${P} .lr-codex-close { width: ${cpx(40)}; height: ${cpx(40)}; right: ${cpx(14)}; top: ${cpx(14)}; }

/* Journal: the slips are an index 16 CSS px apart, so they keep their exact size (no grown hit
   area to steal the neighbour's tap); the big page arrows and a swipe on the book turn pages. */
${P} .lr-journal .lr-j-slip { line-height: 1; padding: 0 ${cpx(4)} 0 ${cpx(6)}; gap: ${cpx(4)}; }
${P} .lr-journal .lr-j-slip::before { display: none; }
${P} .lr-j-slip b { min-width: 1.4em; }
${P} .lr-journal .lr-j-turn { width: ${cpx(44)}; height: ${cpx(44)}; line-height: ${cpx(40)}; font-size: ${cpx(34)}; background: #ffffff1c; }
${P} .lr-j-plate { font-size: var(--lr-text-min); padding: 0 ${cpx(14)}; }

/* Altar: the action row and the title keep to CSS-px sizes; the hint line sits centred under
   the tray and may wrap. */
${P} .lr-altar-actions { right: ${cpx(8)}; top: ${cpx(6)}; gap: ${cpx(6)}; }
${P} .lr-altar-actions .lr-stone-button { min-height: ${cpx(38)}; padding: 0 ${cpx(10)}; }
${P} .lr-altar-actions .lr-gold-button { min-height: ${cpx(44)}; min-width: 0; padding: 0 ${cpx(16)}; }
/* The title sits right-aligned under the action row: over the board it lands on top gauges. */
${P} .lr-altar-title { left: auto !important; max-width: none !important; right: ${cpx(10)}; top: ${cpx(54)}; transform: none; text-align: right; }
${P} .lr-altar-title h2 { white-space: nowrap; }
/* The storm's Gives card already says what the subtitle says; the title gets the room. */
${P} .lr-altar-title small { display: none; }
/* The hint sits in the free strip above the tray (the band under the board is kept clear of
   props), not under it where the count chips are. A gem's card shows in the same strip, and
   while it does the hint steps aside. */
${P} .lr-altar-hint { left: 770px; transform: translateX(-50%); min-width: 0; max-width: 700px; white-space: normal; padding: 0 ${cpx(8)}; bottom: 164px; }
${P} .lr-altar:has(.lr-altar-tip:not([hidden])) .lr-altar-hint { visibility: hidden; }
/* The tray card covers the gem in hand for its first moments; its ↻ mark waits too. */
${T} .lr-altar:has(.lr-altar-tip[data-source="tray"]:not([hidden])) .lr-altar-turnmark { visibility: hidden; }
${P} .lr-altar-count { padding: 0 ${cpx(6)}; margin-top: calc(${cpx(-14)}); }
${P} .lr-altar-verdict { padding: ${cpx(4)} ${cpx(10)}; }
${P} .lr-altar-tip { max-width: 1000px; padding: ${cpx(3)} ${cpx(8)}; }

/* Title: the Ko-fi link and the engine's Copy link (0.75 × the small size) keep phone sizes. */
${P} .tc-link-copy, ${P} .tc-link-message { font-size: var(--lr-text-min); min-height: ${cpx(32)}; }
${P} .lr-title-links { right: ${cpx(8)}; bottom: ${cpx(6)}; }
${P} .lr-title-coffee { min-height: ${cpx(32)}; padding: 0 ${cpx(12)}; }
${P} .lr-release { font-size: var(--lr-text-min); }

/* Solve card: the HUD steps away so the card has the top-left corner (Continue leads). */
${P} .lr-hud[data-scene="solve"] { display: none; }
`;
