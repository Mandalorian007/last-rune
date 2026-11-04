/**
 * Phone and touch base rules (D-039, mobile-2; flags from engine platform/device-mode.ts), and the
 * helpers every scene's phone sheet uses.
 *
 * - `[data-touch]`: key caps hide (a finger has no keys).
 * - `[data-phone]`: the design is drawn at 0.30–0.35 CSS px per design px. Text is 12–13 CSS px
 *   (`--tc-text-min` floors every scaled size at 12). Controls keep a 44 CSS px hit area
 *   (`--tc-tap-min`) through an invisible `::before`; drawn boxes stay compact.
 *
 * Each scene keeps its own phone rules beside its scene (port-altar-3): the altar's in
 * scenes/altar/altar-phone-styles.ts (with the altar sheet), the hall's, title's and journal's in
 * scenes/<scene>/<scene>-phone-styles.ts (game/ctx.ts hands them to `ensureGameStyles`, which
 * appends them to this sheet), the ending's in scenes/ending/ending-phone-styles.ts.
 *
 * Sizes are written in CSS px through `cpx(n)` (n CSS px in design px) or `tpx(n)` (the same,
 * following Settings → Text size), so they hold on every phone. Overrides use `P`, which
 * outranks any scene stylesheet whatever the load order.
 */

/** n CSS px, as a design-px length (phones only; the variable is unset elsewhere). */
export const cpx = (n: number) => `calc(var(--tc-css-px, 1px) * ${n})`;
/** n CSS px of text, grown by Settings → Text size. */
export const tpx = (n: number) => `calc(var(--tc-css-px, 1px) * ${n} * var(--tc-text-scale, 1))`;
/** Phone root selector, ranked above every `.tc-overlay .class` rule. */
export const P = '.tc-overlay[data-phone]:not(#lr-none)';
/** Touch root selector, same rank. */
export const T = '.tc-overlay[data-touch]:not(#lr-none)';
/** The visible band's top and bottom edges when the art fills the width (D-040; 0 otherwise). */
export const CT = 'var(--tc-crop-t, 0px)';
export const CB = 'var(--tc-crop-b, 0px)';

export const PHONE_BASE_CSS = /* css */ `
/* The edge columns live in the letterbox bars, outside the 16:9 box (#app still clips). */
${P} { overflow: visible; }
/* ── Touch: no key caps anywhere ────────────────────────────────────────── */
${T} kbd, ${T} .lr-keys-only { display: none !important; }
.tc-overlay:not([data-touch]) .lr-touch-only { display: none !important; }
.tc-overlay:not([data-phone]):not([data-form-factor^="phone"]) .lr-ph-ico, .tc-overlay:not([data-phone]):not([data-form-factor^="phone"]) .lr-hud-menu { display: none !important; }
${P} kbd { display: none !important; }

/* ── Phone hit areas ───────────────────────────────────────────────────────
   Every button and link gets an invisible target at least 44 CSS px each way, centred on it.
   :where() keeps this rule weaker than any scene rule that positions the control itself. */
:where(.tc-overlay[data-phone]) :where(button, a[href], [role="button"], summary) { position: relative; }
:where(.tc-overlay[data-phone]) :where(button, a[href], [role="button"], summary)::before {
  content: ''; position: absolute; pointer-events: auto;
  top: min(0px, calc(50% - var(--tc-tap-min) / 2)); bottom: min(0px, calc(50% - var(--tc-tap-min) / 2));
  left: min(0px, calc(50% - var(--tc-tap-min) / 2)); right: min(0px, calc(50% - var(--tc-tap-min) / 2));
}
${P} input[type="checkbox"] { width: ${cpx(18)}; height: ${cpx(18)}; }

/* ── Compact controls ───────────────────────────────────────────────────── */
${P} .tc-button, ${P} .lr-stone-button, ${P} .lr-gold-button {
  min-width: 0; min-height: ${cpx(28)}; padding: 0 ${cpx(10)}; font-size: ${tpx(13)};
  border-radius: ${cpx(7)}; border-width: 1px;
}
${P} .lr-gold-button { padding: 0 ${cpx(14)}; }

${P} .lr-nameplate { padding: ${cpx(2)} ${cpx(8)}; font-size: ${tpx(12)}; border-radius: ${cpx(6)}; }

/* ── FUSE's caption: a slim bubble, paged by tap (ui/fuse.ts pages it at 12 words) ───────── */
${P} { --tc-caption-margin: ${cpx(6)}; --tc-caption-max-width: min(${cpx(280)}, var(--tc-third, 100vw)); }
${P} .tc-caption {
  gap: ${cpx(6)}; padding: ${cpx(4)} ${cpx(9)}; border-radius: ${cpx(8)}; border-width: 1px;
}
${P} .tc-caption-side { display: none; }
${P} .tc-caption-text { font-size: ${tpx(12.5)}; line-height: 1.3; }

/* ── mobile-3-chrome: title, hall and menus (D-040) ─────────────────────────
   Title and hall fill the width (game/ctx.ts FILL_BANDS); the canvas overflows top and bottom by
   --tc-crop-t/-b design px, so chrome anchored to the design's edges moves in by the crop. */
${P} .lr-hud { top: calc(${CT} + ${cpx(4)}); }
${P} .tc-caption[data-corner^="bottom"] { bottom: calc(${CB} + var(--tc-caption-margin)); }
${P} .tc-caption[data-corner^="top"] { top: calc(${CT} + var(--tc-caption-margin)); }
/* FUSE's lines break evenly, never one word alone on the last line. */
${P} .tc-caption-text { text-wrap: balance; }

/* The open ☰ list stands on a panel of its own over a dimmed hall: no door name shows
   through it. */
${P} .lr-hud-scrim {
  position: absolute; inset: 0 calc(-1 * var(--tc-bar, 0px)); z-index: 4; pointer-events: none;
  background: rgb(4 3 2 / 0.6);
}
${P} .lr-hud-scrim[hidden] { display: none; }
.tc-overlay:not([data-phone]):not([data-form-factor^="phone"]) .lr-hud-scrim { display: none !important; }
`;
