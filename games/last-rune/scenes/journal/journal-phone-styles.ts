/**
 * The journal on phones (mobile-3/4/5/6-chrome, mobile-7-ending): the found pages as paper rows,
 * the handwriting at a readable size, the page arrows on the book's corners. Appended to the
 * phone sheet by game/ctx.ts (ui/styles.ts ensureGameStyles).
 */
import { CB, cpx, P, tpx } from '../../ui/phone-base';

export const JOURNAL_PHONE_CSS = /* css */ `
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
${P} .lr-j-plate { font-size: var(--tc-text-min); padding: 0 ${cpx(10)}; }
/* Journal: the found pages as paper rows a thumb tall, one row for the rest ("12 more pages to
   find"), scrolling if there are many; solid page arrows; ✕ in the right bar. */
.tc-overlay:not([data-phone]):not([data-form-factor^="phone"]) .lr-j-more { display: none; }
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
/* Journal: the page number at 13 px ink, and the page arrows beside the book, not over its
   edges: ‹ left of the book, › in the right lane under the ✕. */
${P} .lr-j-folio { display: flex; justify-content: center; white-space: nowrap; font-size: ${tpx(13)}; font-weight: 700; color: #3d2818; }
${P} .lr-j-folio[hidden] { display: none; }
${P} .lr-journal .lr-j-turn[aria-label="Previous page"] { transform: translate(calc(-26px - ${cpx(54)}), ${cpx(-4)}); }
${P} .lr-journal .lr-j-turn[aria-label="Next page"] { left: auto !important; right: calc(-1 * var(--tc-bar, 0px)); transform: translateY(${cpx(-4)}); }
${P} .lr-j-head p { font-size: ${tpx(12)}; }

/* Journal (mobile-7-ending): the page arrows sit on the book's outer bottom corners, centred
   on the leaves' outer edges (design px 669 and 1835, 44 above the leaves' foot), so they read
   as the book's own page turns: clear of the quill and the candle, and never out at the screen
   edges on a wide phone. */
${P} .lr-journal .lr-j-turn[aria-label="Previous page"],
${P} .lr-journal .lr-j-turn[aria-label="Next page"] {
  top: 736px !important; right: auto; transform: translate(-50%, -50%);
}
${P} .lr-journal .lr-j-turn[aria-label="Previous page"] { left: 669px !important; }
${P} .lr-journal .lr-j-turn[aria-label="Next page"] { left: 1835px !important; }

/* Journal: the red dot beside a page is keyed in the head ("· ● 1 new"). */
${P} .lr-j-key i {
  display: inline-block; width: ${cpx(8)}; height: ${cpx(8)}; margin: 0 ${cpx(3)} 0 0; border-radius: 50%;
  vertical-align: 0.05em; background: radial-gradient(circle at 40% 35%, #d2463c, #8a1a14);
}
`;
