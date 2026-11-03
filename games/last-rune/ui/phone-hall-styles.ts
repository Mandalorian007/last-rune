/**
 * mobile-7-hall (D-040 addendum 5): the hall, its menu and the title on phones, after gate
 * review 4. Appended last to the phone stylesheet, so these rules win over the earlier passes.
 */
import { cpx, P, tpx } from './phone-styles';

const CT = 'var(--lr-crop-t, 0px)';
/** Not at an altar or a solve card: those draw FUSE's card and its tail their own way. */
const hall = () => `${P}:not(:has(.lr-altar[data-phone])):not(:has(.lr-solve[data-phone]))`;

/** A function, so the stylesheet that imports it can call it once its own helpers exist. */
export const hall7Css = (HALL = hall()): string => /* css */ `
/* ── mobile-7-hall ─────────────────────────────────────────────────────────────────────── */
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
${P} .lr-door[data-status="locked"] { color: #c4b99f; background: rgb(10 8 6 / 0.8); border-color: rgb(200 190 170 / 0.22); }
${P} .lr-door[data-status="locked"] .lr-door-lock { opacity: 0.75; }
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

/* The open ☰ list stands on a panel of its own over a dimmed hall: no door name shows
   through it. */
${P} .lr-hud-scrim {
  position: absolute; inset: 0 calc(-1 * var(--lr-bar, 0px)); z-index: 4; pointer-events: none;
  background: rgb(4 3 2 / 0.6);
}
${P} .lr-hud-scrim[hidden] { display: none; }
.tc-overlay:not([data-phone]) .lr-hud-scrim { display: none !important; }
${P} .lr-hud { z-index: 5; }
${P} .lr-hud[data-open]::before {
  content: ''; position: absolute; z-index: -1; inset: ${cpx(-5)} ${cpx(-5)} ${cpx(-6)} ${cpx(-6)};
  border-radius: ${cpx(10)}; background: rgb(18 13 9 / 0.97); border: 1px solid rgb(232 192 106 / 0.35);
  box-shadow: 0 ${cpx(3)} ${cpx(14)} rgb(0 0 0 / 0.8);
}
${P} .lr-hud-note { font-size: ${tpx(12)}; line-height: 1.15; }

/* New journal pages: one badge on the Menu button's lower edge (no separate dot). */
${P} .lr-hud .lr-hud-menu[data-unread]::after { display: none; }
${P} .lr-hud-menu-new {
  top: calc(100% - ${cpx(6)}); right: ${cpx(-2)}; width: auto; white-space: nowrap;
  padding: ${cpx(1)} ${cpx(6)}; border-radius: ${cpx(8)}; border: 1px solid #5a2a0c;
  font: 700 ${tpx(12)}/1.1 var(--tc-font-body, serif); font-style: normal;
}

/* FUSE's card has a tail toward him (ui/fuse.ts pointAt sets the side and where along it). */
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

/* Title: Play and Settings lead; the coffee and Copy link are quiet text links (still a
   36 px tap each). */
${P} .lr-title-links .tc-link-row { padding: 0 ${cpx(2)}; background: rgb(8 6 4 / 0.55); box-shadow: 0 0 ${cpx(8)} ${cpx(3)} rgb(8 6 4 / 0.45); }
${P} .lr-title-links :is(.lr-title-coffee, .tc-link-copy) {
  min-height: ${cpx(36)}; padding: 0 ${cpx(8)}; font-size: ${tpx(12)}; font-weight: 400;
  color: #cdbd9a; background: transparent; border-color: transparent; box-shadow: none;
}
${P} .lr-title-links :is(.lr-title-coffee, .tc-link-copy):hover { color: #f4e6c4; text-decoration: underline; }

/* Settings: each segment a 36 px tap. */
${P} .lr-seg button { min-height: ${cpx(36)}; }

/* Journal: the red dot beside a page is keyed in the head ("· ● 1 new"). */
${P} .lr-j-key i {
  display: inline-block; width: ${cpx(8)}; height: ${cpx(8)}; margin: 0 ${cpx(3)} 0 0; border-radius: 50%;
  vertical-align: 0.05em; background: radial-gradient(circle at 40% 35%, #d2463c, #8a1a14);
}
/* Keep the tag off the band's very top even before the HUD places it. */
${P} .lr-hall-next-tag:not([data-side]) { top: max(calc(var(--lr-next-top, 0px) - ${cpx(23)}), calc(${CT} + ${cpx(5)})); }
`;
