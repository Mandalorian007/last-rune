/**
 * mobile-7-strike (D-040 addendum 5): Strike, the gauges and the verdict read at a glance on
 * phones. Appended to the altar sheet (altar-styles.ts), after the phone sheet, so these rules
 * win at equal rank.
 *
 * - Strike says what a tap will do on one line ("Strike (2 left)", "Strike again", "Try
 *   again"), 58 CSS px tall, 12 CSS px in from the screen's edge; it glows when every gauge's
 *   lamp is lit.
 * - Each gauge's card: a reach lamp before Strike (lit or not, never a number); after it, one
 *   compact format, "Needs 20 · got 0". Per-strike readings are told in the verdict.
 * - The verdict's strike line sits right under its headline.
 */
import { cpx, P, tpx } from '../../ui/phone-styles';

const A = `${P} .lr-altar[data-phone]`;
const CB = 'var(--lr-crop-b, 0px)';

export const STRIKE_CSS = /* css */ `
/* mobile-7-strike ─ Strike and the verdict at a glance (D-040 addendum 5) ─────────────── */
${A} .lr-altar-actions [data-action="strike"] {
  width: auto; min-width: ${cpx(64)}; height: ${cpx(58)}; padding: 0 ${cpx(14)};
  right: calc(-1 * var(--lr-bar, 0px) + ${cpx(12)}); bottom: calc(${CB} + ${cpx(6)});
  font-family: var(--tc-font-display); font-size: ${tpx(15)}; letter-spacing: 0.3px; white-space: nowrap;
}
${A} .lr-altar-actions [data-action="strike"] > span { flex-direction: row; }
${A} .lr-altar-actions .lr-strike-word { white-space: nowrap; line-height: 1; }
${A} .lr-altar-actions .lr-strike-n { display: none; }
/* A verdict too tall for the column owns the corner until it clears (altar-scene arrangeColumn). */
${A} .lr-altar-actions [data-action="strike"][data-yield] { visibility: hidden; }
/* Ready: every gauge's lamp is lit. A bright rim and a slow glow (steady under reduced motion). */
${A} .lr-altar-actions .lr-gold-button[data-ready] { animation: lr-strike-ready-ph 1.8s ease-in-out infinite; }
@keyframes lr-strike-ready-ph {
  0%, 100% { box-shadow: 0 0 0 ${cpx(2)} rgba(255,236,170,0.85), 0 0 ${cpx(8)} ${cpx(1)} rgba(255,214,120,0.45); }
  50% { box-shadow: 0 0 0 ${cpx(3)} #fff3c8, 0 0 ${cpx(20)} ${cpx(5)} rgba(255,214,120,0.9); }
}
[data-reduced-motion] ${A} .lr-altar-actions .lr-gold-button[data-ready] {
  animation: none; box-shadow: 0 0 0 ${cpx(3)} #fff3c8, 0 0 ${cpx(16)} ${cpx(4)} rgba(255,214,120,0.8);
}

/* The reach lamp: dark and hollow until the charge path reaches the gauge, then lit cyan, the
   colour of the route. */
${A} .lr-need-lamp {
  display: inline-block; flex: none; width: ${cpx(10)}; height: ${cpx(10)}; margin: 0 ${cpx(5)} 0 0;
  border-radius: 50%; vertical-align: 0.05em; background: #1b1915; box-shadow: inset 0 0 0 ${cpx(1.5)} #8f826b;
  transition: background 200ms, box-shadow 200ms;
}
${A} .lr-need-lamp[data-on] {
  background: radial-gradient(circle at 40% 35%, #effdff 0 25%, #5fe6ff 60%, #1fb5e0);
  box-shadow: 0 0 0 1px #d6fbff, 0 0 ${cpx(7)} ${cpx(2)} rgba(63,224,255,0.85);
}
${A} .lr-altar-need[data-lamp] .lr-need-row { display: inline-flex; align-items: center; }
/* Hide the leftover "Strike 1: 2: " parts if any, and keep "got" as one compact line. */
${A} .lr-altar-need .lr-need-strikes { display: none; }
${A} .lr-altar-need:is([data-align="up"], [data-align="down"]) .lr-need-got { display: inline; }
${A} .lr-altar-need:is([data-align="up"], [data-align="down"]):not(:has(.lr-need-note)) {
  flex-direction: row; align-items: baseline; gap: ${cpx(4)};
}
${A} .lr-altar-need:is([data-align="up"], [data-align="down"]) .lr-need-got::before { content: '· '; color: #bfae8a; }

/* The verdict: headline, each strike's reading in words, then the cause or the next step. */
${A} .lr-altar-verdict .lr-verdict-strikes {
  display: block; margin-top: ${cpx(2)}; font-family: var(--tc-font-ui); font-size: ${tpx(12.5)}; line-height: 1.3;
  letter-spacing: 0; color: #f4e6c4;
}
/* mobile-7-strike end */
`;
