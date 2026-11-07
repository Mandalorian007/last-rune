/**
 * The hall on phones (mobile-3/5/6-chrome, mobile-7-hall): door plates, the suggested door's
 * ring and tag, a tapped door's card, FUSE's card with its tail. Appended to the phone sheet by
 * game/ctx.ts (ui/styles.ts ensureGameStyles).
 */
import { CT, cpx, P, ph, tpx } from '../../ui/phone-base';

/** Not at an altar or a solve card: those draw FUSE's card and its tail their own way. */
const HALL = ph(':not(:has(.lr-altar[data-phone])):not(:has(.lr-solve[data-phone]))');

export const HALL_PHONE_CSS = /* css */ `
${P} .lr-nameplate { padding: ${cpx(2)} ${cpx(8)}; font-size: ${tpx(12)}; border-radius: ${cpx(6)}; }

/* Hall: the suggested door, unmistakable at phone size: a pulsing gold outline and a tag on
   its top edge (kept inside the visible band). Off phones neither shows. */
.tc-overlay:not([data-phone]):not([data-form-factor^="phone"]) :is(.lr-hall-next, .lr-hall-next-tag, .lr-hud-note) { display: none !important; }
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
/* Every door wears a plate (hall-scene doorPlates): an open door's name in gold, a restored
   one's with a ✓, a locked one's padlock and the gem colours it still needs. Phones only. */
.tc-overlay:not([data-phone]):not([data-form-factor^="phone"]) :is(.lr-doors, .lr-hud-menu-label, .lr-hud-menu-new) { display: none !important; }
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
/* Hall: one plate family. Open: gold name; restored: ✓ and name inside the plate; locked: a
   padlock and the name, dimmed. No gem pips or "+N" on the map; the tap card names them. */
${P} .lr-door[data-status="locked"] {
  gap: ${cpx(3)}; padding: ${cpx(1)} ${cpx(4)}; color: #b4a990; background: rgb(10 8 6 / 0.82);
  border-color: rgb(200 190 170 / 0.28); box-shadow: 0 ${cpx(1)} ${cpx(3)} rgb(0 0 0 / 0.6);
}
${P} .lr-door-lock { width: ${cpx(9)}; height: ${cpx(11)}; opacity: 0.9; }
${P} .lr-door-tick { margin-right: ${cpx(1)}; }
/* The "Start here" / "Next" tag stands wholly above the door's outline, clear of its frame
   (the band leaves room above the top row: hall-frame HALL_BAND). */
${P} .lr-hall-next-tag { top: max(calc(var(--lr-next-top, 0px) - ${cpx(23)}), calc(${CT} + ${cpx(3)})); }
/* The tapped door's card: name, plain words, the gems it needs by name; never over its plate. */
${P} .lr-nameplate[data-above] { transform: translate(-50%, -100%); }
${P} .lr-nameplate > span { display: block; white-space: nowrap; font-weight: 600; }
${P} .lr-nameplate small { display: block; text-wrap: balance; }
${P} .lr-card-gems {
  display: flex; flex-wrap: wrap; justify-content: center; gap: ${cpx(2)} ${cpx(8)}; margin-top: ${cpx(3)};
}
${P} .lr-card-gems[hidden] { display: none; }
${P} .lr-card-gem {
  display: inline-flex; align-items: center; gap: ${cpx(4)}; white-space: nowrap;
  font: 600 ${tpx(12)}/1.2 var(--tc-font-body, serif); color: #f4e6c4;
}
${P} .lr-card-gem .lr-door-gem { width: ${cpx(10)}; height: ${cpx(10)}; }

/* The Next ring goes round the door's art and stops above its plate (hall-scene placeChrome);
   the plates are drawn over it, so a name is never cut by the outline. */
${P} .lr-doors { z-index: 1; }
${P} .lr-hall-next { z-index: 0; }
${P} .lr-hall-next-tag { z-index: 2; }
/* The tag is placed by the HUD (hud placeTag): above the ring if that is clear, else beside it,
   pointing at it. Its position is set inline; these give its arrow. */
${P} .lr-hall-next-tag[data-side] { transform: none; }
${P} .lr-hall-next-tag[data-side="left"]::after { content: ' ▸'; }
${P} .lr-hall-next-tag[data-side="right"]::after { content: none; }
${P} .lr-hall-next-tag[data-side="right"]::before { content: '◂ '; }

/* Door plates: open and restored names a size up and brighter; locked ones quieter, still
   readable (contrast ≥ 7:1 on their dark plate). */
${P} .lr-door { padding: ${cpx(1)} ${cpx(5)}; }
${P} .lr-door[data-status="unlocked"] { font-size: ${tpx(13)}; color: #ffe08f; background: rgb(20 13 6 / 0.92); }
${P} .lr-door[data-status="solved"] { font-size: ${tpx(13)}; color: #f2faee; background: rgb(12 16 12 / 0.9); }
/* polish-9: locked names a shade brighter on a near-opaque plate, so the window bars behind
   don't show through the letters; still quieter than the open door's gold. */
${P} .lr-door[data-status="locked"] { color: #d8cdb4; background: rgb(10 8 6 / 0.93); border-color: rgb(200 190 170 / 0.26); }
${P} .lr-door[data-status="locked"] .lr-door-lock { opacity: 0.8; }
/* The tapped door's plate lights up, so its card reads as its own wherever the card stands. */
${P} .lr-door[data-tapped] { color: #fff1c4; border-color: #ffd77a; box-shadow: 0 0 ${cpx(5)} rgb(255 205 110 / 0.75); }

/* A tapped door's card: beside the door, clear of every other plate (hud placeCard). The words
   are "Locked: solve Relay Tower first"; FUSE's word on it joins the same card. */
${P} .lr-nameplate[data-placed] { transform: none; z-index: 3; max-width: min(${cpx(400)}, 60%); padding: ${cpx(3)} ${cpx(10)}; line-height: 1.2; }
/* Wide and short, so it fits in a strip between plate rows: the name and its note run on. */
${P} .lr-nameplate[data-placed] > span { display: inline; }
${P} .lr-nameplate[data-placed] > small { display: inline; margin: 0; }
${P} .lr-nameplate[data-placed] > small::before { content: ' · '; color: #e8c06a; }
${P} .lr-card-fuse {
  margin: ${cpx(2)} 0 0; padding-top: ${cpx(2)}; border-top: 1px solid rgb(232 192 106 / 0.3);
  font: italic ${tpx(12)}/1.22 var(--tc-font-body, serif); letter-spacing: 0; white-space: normal;
  text-wrap: balance; color: #f4e6c4; text-align: center;
}
${P} .lr-card-fuse[hidden] { display: none; }
${P} .lr-card-fuse b { font: 700 ${tpx(12)}/1 var(--tc-font-display, serif); font-style: normal; letter-spacing: 0.6px; color: #e8c06a; }
/* Keep the tag off the band's very top even before the HUD places it. */
${P} .lr-hall-next-tag:not([data-side]) { top: max(calc(var(--lr-next-top, 0px) - ${cpx(23)}), calc(var(--tc-crop-t, 0px) + ${cpx(5)})); }

/* FUSE's card in the hall stays on this overlay (it steers clear of the doors; ui/chrome.ts
   docks it only on the title and journal). It carries his name, and a tail toward him
   (ui/fuse.ts pointAt sets the side and where along it). An altar or a solve card draws its
   own. */
${HALL} .tc-caption-text::before {
  content: 'FUSE '; font: 700 ${tpx(12)}/1 var(--tc-font-display, serif); letter-spacing: 0.6px; color: #e8c06a;
}
${HALL} .tc-caption[data-tail] { overflow: visible; }
${HALL} .tc-caption[data-tail]::after {
  content: ''; position: absolute; width: ${cpx(9)}; height: ${cpx(9)}; box-sizing: border-box;
  background: var(--tc-color-surface); border: 0 solid var(--tc-color-border);
  transform: translate(-50%, -50%) rotate(45deg);
}
${HALL} .tc-caption[data-tail="bottom"]::after { left: var(--lr-tail-at); top: 100%; border-width: 0 1px 1px 0; }
${HALL} .tc-caption[data-tail="top"]::after { left: var(--lr-tail-at); top: 0; border-width: 1px 0 0 1px; }
${HALL} .tc-caption[data-tail="left"]::after { top: var(--lr-tail-at); left: 0; border-width: 0 0 1px 1px; }
${HALL} .tc-caption[data-tail="right"]::after { top: var(--lr-tail-at); left: 100%; border-width: 1px 1px 0 0; }
`;
