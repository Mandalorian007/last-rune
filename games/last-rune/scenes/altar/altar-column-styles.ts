/**
 * port-altar-3: the altar's right column on the CSS-px chrome (altar-chrome.ts
 * `placeAltarChrome`), in CSS px. Appended last to the altar sheet (altar-styles.ts).
 *
 * - `top`: the head. The title (and "Holding X" under it) over the tray; one slot ring per
 *   tray gem and a count badge centred under each gem (off its glyph), placed by the gems the
 *   canvas draws (altar-column.ts `placeHead`). A used-up gem is a dimmed copy of itself with a
 *   "×0" badge in every room.
 * - `cardLane`: the cards, one component. Text at the card's full width, 14 px in the game's
 *   serif; the teach card's "New here · n of m" and its button on a footer row under the text;
 *   capped by the region, scrolling inside. FUSE's line docks at the foot of the region and
 *   waits while a card is up (altar-column.ts `arrangeColumn`).
 * - `bottom`: FUSE (canvas) and Strike.
 *
 * Regions never overlap, so no rule here moves one thing out of another's way.
 */
import { CL } from '../../ui/chrome-styles';

const HEAD = `${CL} .lr-altar-head`;
const LANE = `${CL} .lr-altar-lane`;
const CARD = `${LANE} > :is(.lr-altar-tip, .lr-altar-verdict, .lr-altar-cap, .lr-altar-hint)`;
const CAP = `${CL} .tc-region[data-region="cardLane"] > .tc-caption[data-docked]`;
const SERIF = 'var(--tc-font-body, serif)';

export const ALTAR_COLUMN_CSS = /* css */ `
/* ── port-altar-3: the column on regions ──────────────────────────────────── */
${CL} .tc-region[data-region="top"]:has(> .lr-altar-head) { padding: 0; overflow: visible; }
${HEAD} { position: relative; flex: 1 1 auto; align-self: stretch; pointer-events: none; }
${HEAD} kbd { display: none !important; }

/* The title, one line over the tray; "Holding X" under it while a gem is in hand. */
${HEAD} .lr-altar-title {
  position: absolute; left: 0; right: 0; top: 3px; transform: none; max-width: none !important;
  display: flex; flex-direction: column; align-items: center; gap: 2px; line-height: 1.1; text-align: center;
}
${HEAD} .lr-altar-title h2 {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 14px; line-height: 1.2; letter-spacing: 0.5px;
}
${HEAD} .lr-altar-title small { display: none; }
${HEAD} .lr-altar-title[data-holding] h2 { font-size: 12px; opacity: 0.9; }
${HEAD} .lr-altar-holding {
  position: static; display: inline-flex; align-items: center; gap: 5px; max-width: 100%; box-sizing: border-box;
  white-space: nowrap; padding: 0 8px 0 5px; border-radius: 9px; border: 1px solid #ffd77a;
  background: rgba(36,26,10,0.92); color: #f4e6c4; font: 400 12px/1.3 ${SERIF}; letter-spacing: 0;
  text-shadow: none; box-shadow: 0 1px 5px rgba(0,0,0,0.7);
}
${HEAD} .lr-altar-holding[hidden] { display: none; }
${HEAD} .lr-altar-holding b { color: #fff6dd; font-weight: 700; }
${HEAD} .lr-altar-holding i {
  flex: none; width: 9px; height: 9px; border-radius: 50%; background: currentColor; box-shadow: 0 0 4px currentColor;
}

/* Slot rings over the canvas gems: held, taught, and the first visit's breathing tray. */
${HEAD} .lr-altar-slot {
  position: absolute; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; display: none;
}
${HEAD} .lr-altar-slot[data-held]:not([data-empty]) {
  display: block; width: var(--lr-held-d) !important; height: var(--lr-held-d) !important;
  box-shadow: 0 0 0 2.5px #ffd77a, 0 0 0 4px rgba(20,12,4,0.85), 0 0 14px 3px rgba(255,205,110,0.5);
  background: radial-gradient(circle, rgba(255,215,122,0.16) 0 60%, transparent 72%);
}
${HEAD}[data-first] .lr-altar-slot:not([data-empty]):not([data-held]),
${HEAD} .lr-altar-slot[data-teach]:not([data-empty]):not([data-held]) {
  display: block; box-shadow: 0 0 0 2px #ffd77a, 0 0 12px 2px rgba(255,205,110,0.6);
  animation: lr-col-breathe 1.6s ease-in-out infinite;
}
@keyframes lr-col-breathe { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
[data-reduced-motion] ${HEAD} .lr-altar-slot { animation: none !important; }

/* The count: a badge centred under the gem, off its glyph (glyph-truth), the same in every room.
   13 px tall (layout PH.countH), 13 px type (the phone label floor). */
${HEAD} .lr-altar-count {
  position: absolute; transform: translateX(-50%); display: flex; align-items: center; gap: 0;
  box-sizing: border-box; height: 13px; min-width: 0; padding: 0 4px; border-radius: 7px;
  white-space: nowrap; text-align: center;
  font: 700 13px/11px ${SERIF}; letter-spacing: 0; color: #f4e6c4;
  background: rgba(20,16,12,0.94); border: 1px solid rgba(232,192,106,0.6); box-shadow: 0 1px 4px rgba(0,0,0,0.7);
}
${HEAD} .lr-altar-count .lr-n { font: inherit; letter-spacing: inherit; }
${HEAD} .lr-altar-count[data-held] { color: #fff6dd; border-color: #ffd77a; box-shadow: 0 0 0 1px #ffd77a; }
${HEAD} .lr-altar-count[data-empty] {
  opacity: 1; color: #a89a80; text-decoration: none; background: rgba(14,12,10,0.9); border-color: rgba(168,154,128,0.45);
}

/* ── The cards ─────────────────────────────────────────────────────────── */
${CL} .tc-region[data-region="cardLane"]:has(> .lr-altar-lane) { gap: 6px; padding-top: 2px; padding-bottom: 8px; }
${LANE} {
  flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 6px; overflow: hidden; pointer-events: none;
}
${CARD} {
  position: relative !important; left: auto !important; top: auto !important; bottom: auto !important;
  transform: none !important; width: auto; max-width: none !important; min-width: 0; margin: 0; box-sizing: border-box;
  flex: 0 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  padding: 6px 10px; border-radius: 8px; border-width: 1px; text-align: left; white-space: normal;
  font-family: ${SERIF}; font-size: 14px; line-height: 1.3; letter-spacing: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.6); animation: none; visibility: visible;
}
${CARD} > * { flex: none; }

/* Gem and teach card: the rule over the full width, the footer row under it. */
/* Three lines of rule over the footer fit an SE's lane (altar-column.spec checks none scrolls). */
${LANE} > .lr-altar-tip { display: flex; flex-direction: column; line-height: 1.25; padding-bottom: 0; }
${LANE} > .lr-altar-tip[hidden] { display: none; }
${LANE} > .lr-altar-tip::after { display: none; }
${LANE} > .lr-altar-tip:has(.lr-info-next) { pointer-events: auto; }
${LANE} > .lr-altar-tip .lr-info-row { white-space: normal; }
${LANE} > .lr-altar-tip .lr-info-tag { display: none; }
${LANE} > .lr-altar-tip b { margin-right: 4px; }
${LANE} > .lr-altar-tip .lr-info-eg {
  display: block; margin-top: 2px; font: 14px/1.3 ${SERIF}; color: #a8ccf5; white-space: normal;
}
/* teach-4: the first Gate, Split or Capacitor card shows the gem as the codex draws it (the
   real gem material), turned as it sits here, with the charge going in and out. It floats
   beside the rule so the card stays the height of its words (SE lane: 163 px). */
${LANE} > .lr-altar-tip .lr-fig {
  float: right; position: relative; width: 72px; height: 72px; margin: 1px -4px 2px 6px;
  border-radius: 10px; background: #22262f; box-shadow: 0 0 0 1.5px rgba(214,169,78,0.55);
}
${LANE} > .lr-altar-tip .lr-fig[data-small='true'] {
  float: left; width: 46px; height: 46px; margin: 2px 8px 0 0; border-radius: 8px;
}
${LANE} > .lr-altar-tip .lr-fig-turn { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
${LANE} > .lr-altar-tip .lr-fig-gem { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
${LANE} > .lr-altar-tip .lr-fig-bolt { position: absolute; inset: 0; pointer-events: none; }
${LANE} > .lr-altar-tip .lr-fig-bolt svg {
  width: 100%; height: 100%; display: block; overflow: visible; filter: drop-shadow(0 0 2px rgba(80,200,255,0.9));
}
${LANE} > .lr-altar-tip .lr-fig-bolt line { stroke: #9cf0ff; stroke-width: 4.5; stroke-linecap: round; }
${LANE} > .lr-altar-tip .lr-fig-bolt polygon { fill: #9cf0ff; stroke: #9cf0ff; stroke-width: 1.5; stroke-linejoin: round; }
${LANE} > .lr-altar-tip .lr-fig-chip {
  position: absolute; transform: translate(-50%, -50%); min-width: 1.3em; padding: 0 0.25em; box-sizing: border-box;
  border-radius: 999px; white-space: nowrap; text-align: center;
  font: 600 14px/1.1 ${SERIF}; color: #eaf8ff;
  background: rgba(10,18,26,0.92); border: 1.5px solid rgba(120,200,255,0.75); box-shadow: 0 0 4px rgba(80,180,255,0.45);
}
${LANE} > .lr-altar-tip .lr-fig-chip[data-kind='out'] { border-color: #3fe0ff; color: #dff9ff; }
${LANE} > .lr-altar-tip .lr-fig-nogo {
  position: absolute; width: 13px; height: 13px; transform: translate(-50%, -50%); border-radius: 50%; box-sizing: border-box;
  background: rgba(30,6,4,0.92); border: 1.5px solid #ff5a3c;
}
${LANE} > .lr-altar-tip .lr-fig-nogo::before, ${LANE} > .lr-altar-tip .lr-fig-nogo::after {
  content: ''; position: absolute; left: 50%; top: 50%; width: 7px; height: 2px; background: #ffb4a4;
  border-radius: 1px; transform: translate(-50%, -50%) rotate(45deg);
}
${LANE} > .lr-altar-tip .lr-fig-nogo::after { transform: translate(-50%, -50%) rotate(-45deg); }
/* The Capacitor's two strikes, each on its own line, never broken mid-way. */
${LANE} > .lr-altar-tip .lr-info-strip { display: block; color: #a8ccf5; }
${LANE} > .lr-altar-tip .lr-info-strip > span { display: block; white-space: nowrap; }
/* teach-4: the gauge-dot line starts with the dot it explains. */
${LANE} > .lr-altar-hint .lr-need-lamp {
  display: inline-block; width: 10px; height: 10px; margin: 0 6px 0 0; border-radius: 50%; vertical-align: 0.05em;
  background: radial-gradient(circle at 40% 35%, #effdff 0 25%, #5fe6ff 60%, #1fb5e0);
  box-shadow: 0 0 0 1px #d6fbff, 0 0 6px 2px rgba(63,224,255,0.85);
}
/* teach-5: the dot's legend, once per game: a short head, then one row per look of the dot. */
${LANE} > .lr-altar-hint[data-legend] { text-wrap: wrap; text-align: left; padding: 4px 8px; }
/* card-fit: the legend never stacks with another card. It waits for a gem's card, the verdict or
   a live read-out (altar-column.ts arrangeColumn), and the Capacitor plan waits for it. */
${LANE} > .lr-altar-hint[data-legend][data-wait] { display: none; }
${LANE}:has(> .lr-altar-hint[data-legend]:not([data-wait])) > .lr-altar-cap[data-plan] { display: none; }
${LANE} > .lr-altar-hint .lr-dot-head { display: block; color: #c9b995; font-size: 13px; }
${LANE} > .lr-altar-hint .lr-dot-row { display: block; white-space: nowrap; }
${LANE} > .lr-altar-hint .lr-need-lamp[data-look='off'] {
  background: #1b1915; box-shadow: inset 0 0 0 1.5px #8f826b;
}
${LANE} > .lr-altar-hint .lr-need-lamp[data-look='red'],
${LANE} > .lr-altar-hint .lr-need-lamp[data-red='true'] {
  background: radial-gradient(circle at 40% 35%, #fff0ea 0 25%, #ff7a5c 60%, #d8341c);
  box-shadow: 0 0 0 1px #ffd6cc, 0 0 6px 2px rgba(255,90,60,0.85);
}
${LANE} > .lr-altar-tip .lr-info-foot {
  order: 1; position: sticky; bottom: 0; display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin: 2px -10px 0; padding: 1px 10px; min-width: 0; float: none;
  background: rgba(20,16,12,0.98); border-top: 1px solid rgba(232,192,106,0.28);
}
/* teach-5: a pictured page leads with its picture. The picture, "New here" and the button make a
   head row, and the words run the card's full width under it. */
${LANE} > .lr-altar-tip[data-fig] .lr-info-foot {
  order: -1; position: relative; bottom: auto; align-items: center; margin: -2px -10px 2px; padding: 2px 10px 3px 6px;
  background: none; border-top: 0; border-bottom: 1px solid rgba(232,192,106,0.28);
}
${LANE} > .lr-altar-tip[data-fig] .lr-info-foot .lr-fig { float: none; flex: none; margin: 0; zoom: 0.8; }
/* card-fit: in the head row "1 of 2" goes on its own line under "New here" (on a 165 px column it
   ran past its box after a lone "·"), and the button keeps less side padding (its 44 px hit area
   stays). */
${LANE} > .lr-altar-tip[data-fig] .lr-info-foot .lr-info-of { display: block; white-space: nowrap; }
${LANE} > .lr-altar-tip[data-fig] .lr-info-foot .lr-info-of::before { content: none; }
${LANE} > .lr-altar-tip[data-fig] .lr-info-foot .lr-info-next { padding: 0 8px; }
/* A short lane: the picture shrinks so the words still fit without a scroll (altar-column). */
${LANE} > .lr-altar-tip[data-fig][data-tight] .lr-info-foot { padding-top: 1px; padding-bottom: 1px; margin-bottom: 1px; }
${LANE} > .lr-altar-tip[data-fig][data-tight] .lr-info-foot .lr-fig { zoom: 0.62; }
${LANE} > .lr-altar-tip .lr-info-page {
  flex: 1 1 auto; min-width: 0; margin: 0; white-space: normal; text-align: left;
  font: 13px/1.2 ${SERIF}; letter-spacing: 0; color: #c9b995;
}
${LANE} > .lr-altar-tip .lr-info-of { display: inline; }
${LANE} > .lr-altar-tip .lr-info-of::before { content: ' · '; }
${LANE} > .lr-altar-tip .lr-info-next {
  position: relative; flex: none; pointer-events: auto; min-width: 0; min-height: 36px; padding: 0 12px;
  font: 600 14px/1 var(--tc-font-display, serif); border-radius: 8px; border-width: 1px;
}
/* The 44 px hit area grows up from the button, never past the card's bottom edge (that would
   make the card scroll). */
${LANE} > .lr-altar-tip .lr-info-next::before {
  content: ''; position: absolute; left: 50%; top: auto; bottom: -1px; width: max(100%, 44px); height: 44px; transform: translateX(-50%);
}
/* More below (altar-column.ts arrangeColumn): the card takes a swipe and shows a ▾. The text cut
   off under the footer is hidden outright (no fade, no ghost of the next line). */
${LANE} > :is(.lr-altar-tip, .lr-altar-verdict, .lr-altar-cap)[data-more] { pointer-events: auto; }
${LANE} > .lr-altar-tip[data-more] .lr-info-foot::before {
  content: ''; position: absolute; left: 0; right: 0; bottom: 100%; height: 5px;
  background: rgb(20,16,12); pointer-events: none;
}
${LANE} > .lr-altar-tip[data-more] .lr-info-foot::after {
  content: '▾'; position: absolute; right: 0; bottom: calc(100% + 5px); height: 18px; padding: 0 8px 0 6px;
  font: 14px/18px ${SERIF}; color: #e8c06a; pointer-events: none; background: rgb(20,16,12);
}
${LANE} > :is(.lr-altar-verdict, .lr-altar-cap)[data-more]::after {
  content: '▾'; position: sticky; bottom: -6px; align-self: flex-end; float: right; margin-bottom: -6px;
  padding: 0 0 0 6px; font: 14px/18px ${SERIF}; color: #e8c06a; background: rgb(20,16,12);
}

/* The verdict: the headline, then each strike, the cause and the next step on lines of their own.
   The "Try:" line is the point of it (D-027): the verdict keeps its whole height and the Capacitor
   read-out steps aside while it is up (the verdict's strike line already says what each strike
   gave). altar-column.spec checks the Try line shows in full on every phone. */
${LANE}:has(> .lr-altar-verdict:not([hidden])) > .lr-altar-cap { display: none; }
${LANE} > .lr-altar-verdict {
  order: -1; flex-shrink: 0; max-height: 100%; padding-block: 4px;
  font-family: var(--tc-font-display, serif); font-size: 15px; line-height: 1.25;
}
${LANE} > .lr-altar-verdict[hidden] { display: none; }
${LANE} > .lr-altar-verdict :is(.lr-verdict-story, .lr-verdict-hint, .lr-verdict-cause, .lr-verdict-strikes, .lr-verdict-free) {
  display: block; max-width: none; margin: 2px 0 0; white-space: normal; text-align: left;
  font: 14px/1.25 ${SERIF}; letter-spacing: 0;
}
${LANE} > .lr-altar-verdict :is(.lr-verdict-story, .lr-verdict-hint, .lr-verdict-cause)::before { content: none; }
${LANE} > .lr-altar-verdict .lr-verdict-cause { color: #ffb3a0; }
${LANE} > .lr-altar-verdict .lr-verdict-strikes { color: #f4e6c4; }
${LANE} > .lr-altar-verdict .lr-verdict-free { color: #bfe9f2; }

/* Capacitor read-outs: the plan steps aside while a gem is in hand, FUSE speaks or the arrival
   card is up. */
${LANE} > .lr-altar-cap { display: flex; flex-direction: column; gap: 0; }
${LANE} > .lr-altar-cap:not(:has(.lr-cap-line:not([hidden]))) { display: none; }
${LANE}:is([data-hand], [data-fuse]) > .lr-altar-cap[data-plan] { display: none; }
/* strike-free-2: the arrival card wins while it shows; the plan waits (on a pre-filled board
   it squeezed the card on an SE down to its "New here" footer). */
${LANE}:has(> .lr-altar-tip[data-source="intro"]:not([hidden])) > .lr-altar-cap[data-plan] { display: none; }
${LANE} .lr-cap-head { font: 600 13px/1.2 var(--tc-font-display, serif); letter-spacing: 0.5px; color: #9fc8ff; }

/* The how-to line keeps its own slot (D-040 addendum 3): with a gem's card and while FUSE talks
   it stays; a teach card or the verdict stands in for it. */
${LANE} > .lr-altar-hint {
  background: rgba(12,10,8,0.86); border: 0; box-shadow: none; padding: 3px 8px; text-wrap: balance;
  color: rgba(232,220,192,0.95); text-shadow: none;
}
${LANE} > .lr-altar-hint .lr-nowrap { white-space: nowrap; }
${LANE} > .lr-altar-hint:empty,
${LANE}:has(> .lr-altar-tip:not([hidden]) .lr-info-next) > .lr-altar-hint,
${LANE}:has(> .lr-altar-verdict:not([hidden])) > .lr-altar-hint { display: none; }

/* FUSE's line: at the foot of the cards region, its tail down at him in the foot row. */
${CAP} {
  flex: none; margin-top: auto; width: auto; max-height: 100%; overflow: visible; box-sizing: border-box;
  padding: 5px 10px; border-radius: 8px;
}
${CAP} .tc-caption-text { font: 14px/1.3 ${SERIF}; text-wrap: balance; }
${CAP} .tc-caption-text::before { content: none; }
${CAP}::after {
  content: ''; position: absolute; left: calc(var(--lr-cap-tail, 22px) - 5px); bottom: -5px;
  width: 8px; height: 8px; background: inherit; border: 1px solid var(--tc-color-border);
  border-width: 0 1px 1px 0; transform: rotate(45deg); pointer-events: none;
}

/* The open ☰ at an altar: one scrim over everything but the list (the board's overlay and
   this one), and the list's panel starts under the ☰, clear of the title's line. */
${CL}:has(.lr-altar-head):has(.lr-hud[data-open])::before {
  content: ''; position: absolute; inset: 0; z-index: 4; pointer-events: none; background: rgb(4 3 2 / 0.62);
}
.tc-overlay:has(.lr-altar) .lr-hud-scrim { background: transparent; }
${CL}:has(.lr-altar-head) .lr-hud[data-open]::before { top: 36px; }
/* teach-5 (06-menu-altar): the list's panel sits over the lane, so the hint it would cut in
   half ("Tap a gem, ther…") steps out while the list is open and comes back when it closes. */
${CL}:has(.lr-altar-head):has(.lr-hud[data-open]) .lr-altar-hint { visibility: hidden; }

/* The teach leader (in the scaled overlay, over the board). */
.tc-overlay .lr-teach-leader polyline { fill: none; stroke-linejoin: round; }
/* port-altar-3 end */
`;
