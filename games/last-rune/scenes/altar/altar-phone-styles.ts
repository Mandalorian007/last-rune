/**
 * The altar and its solve card on phones, in the scaled overlay: the Gives/Needs labels by
 * the gauges, the socket tag, the solve card and the teach leader. The right column (title,
 * tray counts, cards, FUSE's lane, Strike) is on the chrome's CSS-px regions
 * (altar-column-styles.ts, altar-chrome.ts). Injected first in the altar sheet (altar-styles.ts).
 */
import { cpx, P, ph, T, tpx } from '../../ui/phone-base';

/** The phone altar root. */
const A = `${P} .lr-altar[data-phone]`;
/** Design px cropped off the top of the band while the altar fills the width. */
const CT = 'var(--tc-crop-t, 0px)';
const CB = 'var(--tc-crop-b, 0px)';

export const ALTAR_PHONE_CSS = /* css */ `
/* Gives / Needs: under a west/east gauge (wrapping to its gutter), beside a north/south one
   (altar-place placePhoneLabels). */
${P} .lr-altar-need { padding: ${cpx(1)} ${cpx(6)} ${cpx(2)}; border-width: 1px; border-radius: ${cpx(6)}; font-size: ${tpx(11)}; line-height: 1.1; }
${P} .lr-altar-need[data-align="below"] { transform: translate(-50%, ${cpx(4)}); }
${P} .lr-altar-need[data-align="right"] { transform: translate(${cpx(5)}, -50%); }
${P} .lr-altar-need b { font-size: ${tpx(14)}; margin-left: ${cpx(2)}; }
${P} .lr-altar-need .lr-need-got { font-size: ${tpx(11)}; }
${P} .lr-altar-need .lr-need-got b { font-size: ${tpx(12)}; }
${P} .lr-altar-need .lr-need-note { font-size: ${tpx(11)}; margin-top: 0; }
${P} .lr-altar-need .lr-need-strikes { font-size: ${tpx(11)}; gap: ${cpx(2)}; }
${T} .lr-altar:not([data-phone]):has(.lr-altar-tip[data-source="tray"]:not([hidden])) .lr-altar-turnmark { visibility: hidden; }
${P} .lr-altar-tag { font-size: ${tpx(11)}; padding: ${cpx(1)} ${cpx(5)}; border-radius: ${cpx(5)}; }
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
.tc-overlay .lr-strike-n { display: none; }

/* Solve moment: card, journal page and Continue fill the altar's column and the free right
   bar (solve-scene); FUSE speaks beside himself at the column's foot. */
${P} .lr-solve[data-phone] {
  left: var(--lr-col-l); top: ${cpx(4)}; width: calc(var(--lr-col-w) + var(--tc-bar, 0px) - ${cpx(3)}); gap: ${cpx(5)};
}
${P} .lr-solve[data-phone] .lr-solve-card { padding: ${cpx(5)} ${cpx(9)} ${cpx(6)}; }
${P} .lr-solve[data-phone] .lr-page-note { margin: 0 ${cpx(6)}; padding: ${cpx(4)} ${cpx(9)}; }
${P} .lr-solve[data-phone] .lr-page-note b { white-space: nowrap; margin-bottom: ${cpx(1)}; }
${ph(':has(.lr-solve[data-phone])')} .tc-caption {
  left: var(--lr-scap-l) !important; right: auto !important; top: auto !important; bottom: ${cpx(3)} !important;
  max-width: min(calc(var(--lr-scap-w) + var(--tc-bar, 0px) - ${cpx(3)}), var(--tc-third)) !important;
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

/* Solve: one card, ≥12 CSS px inside the play area; Continue 44 px tall across the card. */
${P} .lr-solve[data-phone] {
  top: ${cpx(8)}; width: calc(var(--lr-col-w) + var(--tc-bar, 0px) - ${cpx(12)}); gap: 0;
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
${ph(':has(.lr-solve[data-phone])')} .tc-caption {
  bottom: ${cpx(8)} !important; overflow: visible;
  max-width: min(calc(var(--lr-scap-w) + var(--tc-bar, 0px) - ${cpx(12)}), var(--tc-third)) !important;
}
${ph(':has(.lr-solve[data-phone])')} .tc-caption::after {
  content: ''; position: absolute; left: ${cpx(-5)}; bottom: calc(var(--lr-scap-face, ${cpx(40)}) - ${cpx(8)} - ${cpx(4)});
  width: ${cpx(8)}; height: ${cpx(8)}; background: inherit; border: 1px solid var(--tc-color-border);
  border-width: 0 0 1px 1px; transform: rotate(45deg); pointer-events: none;
}
${ph(':has(.lr-solve[data-phone][data-crowd])')} .tc-caption { visibility: hidden; }
/* The solve card reaches from the column to 12 px inside the screen's edge (the canvas fills
   the width, so there is no free right bar; Strike and the menu are gone while it shows). */
${P} .lr-solve[data-phone] {
  top: calc(${CT} + ${cpx(12)});
  width: calc(1920px - var(--lr-col-l) + var(--tc-bar, 0px) - ${cpx(12)});
}
${ph(':has(.lr-solve[data-phone])')} .tc-caption { bottom: calc(${CB} + ${cpx(8)}) !important; }

${A} .lr-altar-turnmark { display: none !important; }

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
${P} .lr-solve[data-phone] .lr-page-note, ${P} .lr-solve[data-phone] .lr-page-note b { font-size: ${tpx(12)}; }

/* The arrival card points at what it teaches: a gold line from the card to a fixed gem, ringed
   (altar-dom leader, in the scaled overlay over the board). */
${A} .lr-teach-leader { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
${A} .lr-teach-leader .lr-leader-shade { stroke: rgba(10,6,2,0.75); stroke-linecap: round; }
${A} .lr-teach-leader .lr-leader-line { stroke: #ffd77a; stroke-linecap: round; }
${A} .lr-teach-leader .lr-leader-ring { fill: none; stroke: #ffd77a; animation: lr-t7-breathe 1.6s ease-in-out infinite; }
@keyframes lr-t7-breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
[data-reduced-motion] ${A} .lr-teach-leader .lr-leader-ring { animation: none; }
`;
