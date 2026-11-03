/**
 * The ending on phones (D-039, D-040; mobile-3-ending). Phone only: every rule is under `P`
 * (the phone overlay), so desktop and tablets are untouched. Sizes are CSS px through `cpx`/`tpx`.
 *
 * - **Skip** has its own lane: the top of the right letterbox bar, where no caption, chat or
 *   card ever goes. FUSE's ending lines sit bottom-left, clear of him and of that lane, at
 *   14 px, with a faint "Tap to continue" (a tap on the caption advances it).
 * - **The hangout** is a phone chat app, not a desktop window: one conversation, full width
 *   (into the bars, up to the safe areas), under a header that reads
 *   "‹ # channel · ThunderClap Gaming". The ‹ carries a count of channels with something new,
 *   so the server still visibly notices FUSE. Messages are 14 px and sit at the bottom above
 *   the "is typing" line and the message bar; each channel opens on its own start block, so
 *   the top of the screen is never dead space.
 * - **The end card** is a column of 40 px controls (44 px to the finger), set left of centre
 *   so the dropped clipboard on the right stays a prop, apart from the buttons.
 */
import { cpx, P, tpx } from '../../ui/phone-styles';

/** Right edge of the right bar column, 3 CSS px in from the bar's edge. */
const BAR_IN = `calc(-1 * var(--lr-bar, 0px) + ${cpx(3)})`;
/** Skip's lane: a 44 CSS px column at the top of the right bar. */
const LANE = cpx(44);
/** The chat header: tall enough to hold Skip on its right. */
const HEAD = cpx(44);
/** The end card's stack is centred this far left of the screen's centre (design px). */
const SHIFT = '260px';

export const ENDING_PHONE_CSS = /* css */ `
/* ── Skip: its own lane, top right, in the bar ───────────────────────────── */
${P} .lr-end-skip {
  right: ${BAR_IN}; top: ${cpx(4)}; bottom: auto; z-index: 3; width: ${LANE}; min-width: 0; height: ${cpx(36)};
  min-height: 0; padding: 0; display: flex; align-items: center; justify-content: center;
  font-size: ${tpx(13)}; border-radius: ${cpx(8)};
}

/* ── FUSE's ending lines: bottom left, clear of him (he stands right of centre) ── */
${P}:has(.lr-ending) .tc-caption {
  left: ${cpx(8)} !important; right: auto !important; top: auto !important; bottom: ${cpx(8)} !important;
  max-width: min(${cpx(330)}, 1160px) !important; padding: ${cpx(6)} ${cpx(11)} ${cpx(5)};
}
${P}:has(.lr-ending) .tc-caption-text { font-size: ${tpx(14)}; line-height: 1.32; }
${P}:has(.lr-ending) .tc-caption-body::after {
  content: 'Tap to continue'; display: block; margin-top: ${cpx(2)}; text-align: right;
  font-family: var(--tc-font-ui); font-size: ${tpx(11)}; letter-spacing: 0.3px; color: #e8dcc0; opacity: 0.55;
}

/* ── Hangout: one conversation, full screen ────────────────────────────── */
${P} .lr-hg {
  left: calc(-1 * var(--lr-bar, 0px)); top: 0; width: calc(1920px + 2 * var(--lr-bar, 0px)); height: 1080px;
  border: 0; border-radius: 0; box-shadow: none; transform: translateY(${cpx(12)}); line-height: 1.32;
}
${P} .lr-hg[data-in] { transform: none; }
${P} .lr-hg-rail, ${P} .lr-hg-side { display: none; }
${P} .lr-hg-main { background: #2b2e37; }

/* Header: ‹ (with the unread count) · # channel · server; Skip sits at its right end. */
${P} .lr-hg-top {
  height: ${HEAD}; gap: ${cpx(4)}; padding: 0 calc(${LANE} + ${cpx(12)}) 0 ${cpx(12)};
  font-size: ${tpx(15)}; white-space: nowrap; background: #30343f;
}
${P} .lr-hg-top .lr-emo { font-size: ${tpx(15)}; margin-right: ${cpx(3)}; }
${P} .lr-hg-top .lr-hg-hash { font-size: ${tpx(16)}; min-width: 0; color: #8f887b; }
${P} .lr-hg-top-name { color: #fff0b8; }
${P} .lr-hg-top-server {
  display: inline; margin-left: ${cpx(2)}; font-family: var(--tc-font-display); font-size: ${tpx(13)}; font-weight: 400; color: #a39a88;
}
${P} .lr-hg-top-server::before { content: '·'; margin-right: ${cpx(6)}; color: #6e6a62; }
/* Other channels' news: a quiet "· 3 unread" after the server name. Plain text, no pill or
   glow, so it reads as information and never as something to tap (D-027). */
${P} .lr-hg-badge-count {
  display: inline; margin-left: ${cpx(8)}; font-size: ${tpx(12)}; font-weight: 600; color: #d9a54a;
  white-space: nowrap; pointer-events: none;
}
${P} .lr-hg-badge-count::before { content: '·'; margin-right: ${cpx(8)}; color: #6e6a62; font-weight: 400; }
${P} .lr-hg-badge-count::after { content: ' unread'; font-weight: 400; color: #a88a52; }
${P} .lr-hg-badge-count:empty { display: none; }
${P} .lr-hg-badge-count[data-ping] { animation: lr-hg-news 900ms ease-out both; }
@keyframes lr-hg-news { from { color: #ffe08a; } to { color: #d9a54a; } }

/* Messages: full width, 14 px, bottom-anchored. */
${P} .lr-hg-log {
  padding: 0 ${cpx(12)} ${cpx(2)};
  -webkit-mask-image: linear-gradient(#0000 0, #000 ${cpx(18)}); mask-image: linear-gradient(#0000 0, #000 ${cpx(18)});
}
${P} .lr-hg-log:not([hidden]) { animation: lr-hg-in 300ms ease-out both; }
/* A channel opens on its start block (pinned to the top while there's room; scrolls away after). */
${P} .lr-hg-start {
  display: flex; flex: none; align-items: center; gap: ${cpx(8)}; margin: ${cpx(10)} 0 auto; padding: 0 ${cpx(4)} ${cpx(8)};
  border-bottom: 1px solid #ffffff14; font-size: ${tpx(17)}; color: #fbf3e0;
}
${P} .lr-hg-start[hidden] { display: none; }
${P} .lr-hg-start-emo {
  width: ${cpx(40)}; height: ${cpx(40)}; border-radius: 50%; display: grid; place-items: center; flex: none;
  background: #3a3f4c; font-size: ${tpx(21)};
}
${P} .lr-hg-start .lr-hg-hash { margin-right: ${cpx(3)}; color: #8f887b; font-weight: 400; }
${P} .lr-hg-msg { gap: ${cpx(10)}; padding: ${cpx(4)} ${cpx(4)}; border-radius: ${cpx(6)}; }
${P} .lr-hg-msg[data-pinned] { box-shadow: inset ${cpx(3)} 0 0 #e8c06a; }
${P} .lr-hg-av { width: ${cpx(32)}; height: ${cpx(32)}; margin-top: ${cpx(2)}; font-size: ${tpx(17)}; }
${P} .lr-hg-meta { line-height: 1.2; }
${P} .lr-hg-meta b { font-size: ${tpx(14)}; }
${P} .lr-hg-meta small { margin-left: ${cpx(6)}; font-size: ${tpx(11)}; }
${P} .lr-hg-text { margin-top: ${cpx(1)}; font-size: ${tpx(14)}; line-height: 1.32; }
/* FUSE's paper form: as wide as its lines, each on one line ("Builder, then foreman" stays whole). */
${P} .lr-hg-form {
  display: inline-block; width: auto; max-width: 100%; box-sizing: border-box; margin-top: ${cpx(4)};
  padding: ${cpx(4)} ${cpx(14)} ${cpx(5)} ${cpx(12)}; font-size: ${tpx(14)}; line-height: 1.3;
  background: linear-gradient(#f6e7c4, #e6cf9c); box-shadow: 0 ${cpx(2)} ${cpx(6)} #0007, inset ${cpx(3)} 0 0 #c9533a88;
}
${P} .lr-hg-form small { font-size: ${tpx(11)}; letter-spacing: 1.5px; }
${P} .lr-hg-form p { white-space: nowrap; border-bottom: 1px solid #5a412826; }
${P} .lr-hg-form p:last-child { border-bottom: 0; }
${P} .lr-hg-reacts { gap: ${cpx(4)}; margin-top: ${cpx(3)}; }
${P} .lr-hg-react {
  height: ${cpx(22)}; gap: ${cpx(4)}; padding: 0 ${cpx(7)} 0 ${cpx(5)}; border-radius: ${cpx(11)}; font-size: ${tpx(12)};
}
${P} .lr-hg-react .lr-emo { font-size: ${tpx(13)}; }
${P} .lr-hg-sys { padding: ${cpx(4)} ${cpx(4)} ${cpx(4)} ${cpx(12)}; font-size: ${tpx(13)}; }
${P} .lr-hg-sys .lr-hg-reacts { margin-left: ${cpx(24)}; }
${P} .lr-hg-arrow { width: ${cpx(24)}; margin-left: ${cpx(-4)}; }

/* "… is typing" just above the message bar, then the bar itself. */
${P} .lr-hg-typing {
  order: 0; height: ${cpx(18)}; margin: 0 ${cpx(14)}; padding: 0 0 ${cpx(2)}; gap: ${cpx(4)}; font-size: ${tpx(12)};
}
${P} .lr-hg-dots { gap: ${cpx(3)}; margin-right: ${cpx(3)}; }
${P} .lr-hg-dots i { width: ${cpx(4)}; height: ${cpx(4)}; }
${P} .lr-hg-compose {
  order: 1; height: ${cpx(36)}; margin: 0 ${cpx(10)} ${cpx(8)}; padding: 0 ${cpx(12)}; border-radius: ${cpx(18)};
  font-size: ${tpx(14)};
}
${P} .lr-hg-caret-bar { width: ${cpx(2)}; }

/* ── Title card, safety record, credits: compact, left of the clipboard ── */
${P} .lr-end-title { top: ${cpx(6)}; right: ${SHIFT}; }
${P} .lr-end-title::before { top: ${cpx(-12)}; bottom: ${cpx(-12)}; }
${P} .lr-end-title h2 { font-size: ${tpx(20)}; line-height: 1.15; letter-spacing: 0.5px; }
${P} .lr-end-title h2 + h2 { margin-top: ${cpx(1)}; font-size: ${tpx(13.5)}; line-height: 1.25; }
${P} .lr-end-safety {
  top: ${cpx(72)}; left: calc(50% - ${SHIFT} / 2); width: ${cpx(370)}; margin-left: ${cpx(-185)};
  padding: ${cpx(5)} ${cpx(14)} ${cpx(6)}; font-size: ${tpx(13)}; line-height: 1.28; border-radius: ${cpx(4)};
}
${P} .lr-end-safety small { font-size: ${tpx(11)}; letter-spacing: 1.5px; margin-bottom: ${cpx(1)}; }
${P} .lr-end-credits { top: ${cpx(156)}; right: ${SHIFT}; }
${P} .lr-end-credits::before { top: ${cpx(-20)}; height: ${cpx(80)}; width: ${cpx(380)}; margin-left: ${cpx(-190)}; }
${P} .lr-end-credits div { margin-bottom: ${cpx(6)}; }
${P} .lr-end-credits small { font-size: ${tpx(11)}; letter-spacing: 2px; }
${P} .lr-end-credits span { font-size: ${tpx(18)}; }

/* ── End card: 40 px controls (44 to the finger), the hierarchy kept ─────── */
${P} .lr-end-card { top: ${cpx(144)}; right: ${SHIFT}; gap: ${cpx(6)}; }
${P} .lr-end-card a.lr-end-join {
  min-height: ${cpx(40)}; box-sizing: border-box; padding: 0 ${cpx(18)}; gap: ${cpx(8)}; border-radius: ${cpx(10)};
  font-size: ${tpx(15.5)}; box-shadow: 0 ${cpx(3)} ${cpx(12)} #ffb43a88, inset 0 1px 0 #fff8, inset 0 -2px 0 #7a4a1088;
}
${P} .lr-end-card a.lr-end-join::after { font-size: ${tpx(13)}; }
${P} .lr-end-card a.lr-end-coffee {
  min-height: ${cpx(40)}; box-sizing: border-box; padding: 0 ${cpx(16)}; gap: ${cpx(7)}; font-size: ${tpx(13.5)}; border-width: 1px;
}
${P} .lr-end-links .tc-link-copy {
  min-height: ${cpx(40)}; box-sizing: border-box; margin-left: ${cpx(8)}; padding: 0 ${cpx(12)}; gap: ${cpx(5)};
  font-size: ${tpx(12.5)}; border-width: 1px; border-radius: ${cpx(10)}; white-space: nowrap;
}
${P} .lr-end-footer { padding: ${cpx(1)} ${cpx(30)}; font-size: ${tpx(12.5)}; }
${P} .lr-end-card .lr-end-back { margin-top: 0; min-height: ${cpx(40)}; padding: 0 ${cpx(18)}; font-size: ${tpx(14)}; }
/* The clipboard is a prop: nothing about it says "press me". */
${P} .lr-clip-note { pointer-events: none; }
`;
