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

export const STRIKE_CSS = /* css */ `
/* mobile-7-strike ─ Strike and the verdict at a glance (D-040 addendum 5) ─────────────── */
/* Strike itself stands at the foot of the right rail on the chrome (altar-chrome.ts). */

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
/* altar-truth: the Capacitor's plan shows more than this gauge takes: the lamp warns red. */
${A} .lr-altar-need[data-warn] { border-color: #ff6a4d; }
${A} .lr-altar-need[data-warn] .lr-need-lamp[data-on] {
  background: radial-gradient(circle at 40% 35%, #fff0ea 0 25%, #ff7a5c 60%, #d8341c);
  box-shadow: 0 0 0 1px #ffd6cc, 0 0 ${cpx(7)} ${cpx(2)} rgba(255,90,60,0.85);
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
/* altar-truth: Turn's target on a phone, a small gold ↻ on the gem's corner (the one the Turn
   button will rotate: the gem just placed, else the one in hand). */
.tc-overlay .lr-turn-target[hidden] { display: none; }
${A} .lr-turn-target {
  position: absolute; pointer-events: none; transform: translate(-50%, -50%); z-index: 2;
  width: ${cpx(22)}; height: ${cpx(22)}; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: ${tpx(15)}; line-height: 1; color: var(--lr-gold);
  background: rgba(20,16,12,0.92); border: 1px solid rgba(232,192,106,0.9); box-shadow: 0 ${cpx(1)} ${cpx(4)} rgba(0,0,0,0.7);
}
/* mobile-7-strike end */
`;
