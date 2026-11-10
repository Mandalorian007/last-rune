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
/* The head fills its region (no pad: the layout measures the region's computed content box);
   its slots are placed off its own box (placeHead). */
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
/* dense-board-4: the slim strip is ~100 px; its title (and "Holding Capacitor") may reach a
   little past the strip into the open stone either side, and the pill packs tighter. */
${HEAD}[data-slim] .lr-altar-title { left: -14px; right: -14px; }
${HEAD}[data-slim] .lr-altar-holding { gap: 4px; padding: 0 6px 0 4px; }
${HEAD} .lr-altar-holding b { color: #fff6dd; font-weight: 700; }
${HEAD} .lr-altar-holding i {
  flex: none; width: 9px; height: 9px; border-radius: 50%; background: currentColor; box-shadow: 0 0 4px currentColor;
}

/* Slot rings over the canvas gems: held, and the first visit's breathing tray. polish-11: an
   arrival card no longer rings its tray gem (it read as picked up). */
${HEAD} .lr-altar-slot {
  position: absolute; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; display: none;
}
/* held-gem: the held slot's box is the ring's footprint (placeHead keeps it clear of the
   counts), but nothing is painted over the canvas gem: any DOM paint laid over it paled the
   gem and its glyph in the shots (blind review 9, finding A). The canvas draws the ring, the
   gem's own outline just outside it, turned with it (altar-view.ts, gem state "ring"). */
${HEAD} .lr-altar-slot[data-held]:not([data-empty]) {
  display: block; width: var(--lr-held-d) !important; height: var(--lr-held-d) !important;
}
${HEAD}[data-first] .lr-altar-slot:not([data-empty]):not([data-held]) {
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
  opacity: 1; color: #a89a80; background: rgba(14,12,10,0.9); border-color: rgba(168,154,128,0.45);
}
/* polish-10: spent reads at a glance: the "×0" is struck through. */
${HEAD} .lr-altar-count[data-empty] .lr-n {
  text-decoration: line-through; text-decoration-thickness: 2px; text-decoration-color: #e8c06a;
}

/* dense-board-4: on a dense board the badge is set at the 14 px floor (layout PH.countDense). */
${HEAD}[data-dense] .lr-altar-count { height: 15px; padding: 0 5px; border-radius: 8px; font: 700 14px/13px ${SERIF}; }

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
/* polish-11: Amplify's second sentence runs on after the first (a line of its own cost the SE's
   lane the line it lacked). */
${LANE} > .lr-altar-tip .lr-info-eg[data-flow] { display: inline; margin-top: 0; }
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
/* teach-6: the strikes card's title wears the Strike button's marks, unlit, in the card's gold. */
${LANE} > .lr-altar-tip .lr-info-pips { display: inline-flex; gap: 4px; margin-left: 6px; vertical-align: 0; }
${LANE} > .lr-altar-tip .lr-info-pips i {
  display: block; width: 9px; height: 9px; box-sizing: border-box; border: 2px solid #e8c06a; border-radius: 50%;
}
/* The Capacitor's two strikes, each on its own line. polish-11: a line may wrap (a nowrap line
   ran off the SE's card). */
${LANE} > .lr-altar-tip .lr-info-strip { display: block; color: #a8ccf5; }
${LANE} > .lr-altar-tip .lr-info-strip > span { display: block; white-space: normal; }
/* teach-4: the gauge-dot line starts with the dot it explains. */
${LANE} > .lr-altar-hint .lr-need-lamp {
  display: inline-block; width: 10px; height: 10px; margin: 0 6px 0 0; border-radius: 50%; vertical-align: 0.05em;
  background: radial-gradient(circle at 40% 35%, #effdff 0 25%, #5fe6ff 60%, #1fb5e0);
  box-shadow: 0 0 0 1px #d6fbff, 0 0 6px 2px rgba(63,224,255,0.85);
}
/* teach-5: the dot's legend, once per game: a short head, then one row per look of the dot. */
${LANE} > .lr-altar-hint[data-legend] { text-wrap: wrap; text-align: left; padding: 2px 8px 3px; }
/* card-fit: the legend never stacks with another card. It waits for a gem's card, the verdict or
   a live read-out (altar-column.ts arrangeColumn), and the Capacitor plan waits for it. */
${LANE} > .lr-altar-hint[data-legend][data-wait] { display: none; }
${LANE}:has(> .lr-altar-hint[data-legend]:not([data-wait])) > .lr-altar-cap[data-plan] { display: none; }
/* teach-6: the legend outranks a gem's chip; the chip waits until it retires (arrangeColumn). */
${LANE} > .lr-altar-tip[data-yield] { display: none; }
${LANE} > .lr-altar-hint[data-legend] { pointer-events: auto; }
${LANE} > .lr-altar-hint .lr-dot-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  color: #c9b995; font-size: 13px;
}
${LANE} > .lr-altar-hint .lr-dot-ok {
  position: relative; flex: none; min-width: 0; min-height: 20px; padding: 0 10px;
  font: 600 13px/1 var(--tc-font-display, serif); border-radius: 8px; border-width: 1px;
}
/* A 44 px hit area round the small button. */
${LANE} > .lr-altar-hint .lr-dot-ok::before {
  content: ''; position: absolute; left: 50%; top: 50%; width: max(100%, 44px); height: 44px; transform: translate(-50%, -50%);
}
/* Each row hangs from its dot, so a narrow column wraps it under its words, never cut. The 'off'
   row has no dot: its words start where the others' do. */
${LANE} > .lr-altar-hint .lr-dot-row { display: block; padding-left: 16px; text-indent: -16px; }
${LANE} > .lr-altar-hint .lr-dot-row[data-look='off'] { text-indent: 0; }
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
/* polish-11: still too tall, the picture is the button's height and drops its number chips
   (at that size they were under the 14 px floor); the gem and its bolts still show which piece. */
${LANE} > .lr-altar-tip[data-fig][data-tighter] .lr-info-foot .lr-fig:not([data-small='true']) { zoom: 0.5; }
${LANE} > .lr-altar-tip[data-fig][data-tighter] .lr-info-foot :is(.lr-fig-chip, .lr-fig-nogo) { display: none; }
${LANE} > .lr-altar-tip[data-fig][data-tighter] { padding-top: 4px; }
/* polish-11: a piece taught at another altar names itself in the head row ("Again" read as a
   button). */
${LANE} > .lr-altar-tip .lr-info-page > b { display: block; margin: 0; font-size: 14px; line-height: 1.2; }
${LANE} > .lr-altar-tip:not([data-named]) .lr-info-page > b,
${LANE} > .lr-altar-tip[data-named] .lr-info-row > b { display: none; }
/* polish-11: a tight lane runs the Capacitor's two strikes on, not a line each. */
${LANE} > .lr-altar-tip[data-tight] .lr-info-strip > span { display: inline; }
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
${LANE} > .lr-altar-verdict :is(.lr-verdict-story, .lr-verdict-hint, .lr-verdict-cause, .lr-verdict-strikes, .lr-verdict-also, .lr-verdict-free) {
  display: block; max-width: none; margin: 2px 0 0; white-space: normal; text-align: left;
  font: 14px/1.25 ${SERIF}; letter-spacing: 0;
}
${LANE} > .lr-altar-verdict :is(.lr-verdict-story, .lr-verdict-hint, .lr-verdict-cause)::before { content: none; }
${LANE} > .lr-altar-verdict .lr-verdict-cause { color: #ffb3a0; }
${LANE} > .lr-altar-verdict :is(.lr-verdict-strikes, .lr-verdict-also) { color: #f4e6c4; }
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
/* polish-8 (06-menu-altar): under the scrim Strike's gold and FUSE's cream line still read as
   live. While the list is open his line steps out (it comes back when the list closes) and
   Strike goes grey like the rest of the altar's controls. */
${CL}:has(.lr-altar-head):has(.lr-hud[data-open]) .tc-caption { visibility: hidden; }
${CL}:has(.lr-altar-head):has(.lr-hud[data-open]) [data-action="strike"] { filter: saturate(0.1) brightness(0.55); }

/* dense-board-4: the slim column's Rule tab. The held gem's card folds behind it; a tap opens
   it, the next tap (or setting the gem down) closes it. 44 px tall, at the lane's top. */
${LANE} > .lr-rule-tab {
  flex: none; align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
  min-height: 44px; min-width: 44px; margin: 0; padding: 0 14px; box-sizing: border-box;
  pointer-events: auto; border-radius: 22px; border: 1px solid rgba(232,192,106,0.7);
  background: rgba(20,16,12,0.94); color: #f4e6c4; box-shadow: 0 2px 8px rgba(0,0,0,0.6);
  font: 600 15px/1 ${SERIF}; letter-spacing: 0.3px;
}
${LANE} > .lr-rule-tab[hidden] { display: none; }
${LANE} > .lr-rule-tab b {
  display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  background: #e8c06a; color: #1a120a; font: 700 14px/1 ${SERIF};
}
${LANE} > .lr-rule-tab[data-open] { border-color: #ffd77a; box-shadow: 0 0 0 1px #ffd77a, 0 2px 8px rgba(0,0,0,0.6); }

/* teach-overlay: the arrival card (and a pinned rule card; on a short lane a verdict or the dot's
   legend cut short) is a panel over the column: over the
   tray and the lane, under the title and the ☰, on the foot row's top edge (FUSE and Strike stay
   in view), never over the board (altar-column.ts placeCardPanel sets the box). It is as tall
   as its words, up to that box. Opaque: the tray under it does not show through. */
${LANE} > [data-over] {
  position: fixed !important; left: var(--lr-over-l) !important; right: var(--lr-over-r) !important;
  bottom: var(--lr-over-b) !important; top: auto !important; width: auto; max-height: var(--lr-over-h);
  z-index: 6; background: rgb(22,17,12); border-color: rgba(232,192,106,0.8);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.6), 0 6px 22px 4px rgba(0,0,0,0.85);
  animation: lr-over-in 140ms ease-out;
}
${LANE} > .lr-altar-tip[data-over] { pointer-events: auto; }
@keyframes lr-over-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
[data-reduced-motion] ${LANE} > [data-over] { animation: none; }
${LANE} > .lr-altar-tip[data-over] .lr-info-foot { background: rgb(22,17,12); }
/* The folded arrival card: the gem's picture and its name, 44 px tall; a tap opens it again. */
${LANE} > .lr-card-pill {
  flex: none; align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; max-width: 100%;
  min-height: 44px; min-width: 44px; margin: 0; padding: 0 14px 0 7px; box-sizing: border-box;
  pointer-events: auto; border-radius: 22px; border: 1px solid #e8c06a;
  background: rgba(20,16,12,0.96); color: #f4e6c4; box-shadow: 0 0 0 1px rgba(232,192,106,0.35), 0 2px 8px rgba(0,0,0,0.6);
  font: 600 15px/1.1 ${SERIF}; letter-spacing: 0.3px; text-align: left;
}
${LANE} > .lr-card-pill[hidden] { display: none; }
${LANE} > .lr-card-pill .lr-pill-gem { flex: none; width: 30px; height: 30px; border-radius: 7px; background: #22262f; }
${LANE} > .lr-card-pill > b {
  flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
  background: #e8c06a; color: #1a120a; font: 700 15px/1 ${SERIF};
}
${LANE} > .lr-card-pill .lr-pill-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* The teach leader (in the scaled overlay, over the board). */
.tc-overlay .lr-teach-leader polyline { fill: none; stroke-linejoin: round; }
/* port-altar-3 end */
`;
