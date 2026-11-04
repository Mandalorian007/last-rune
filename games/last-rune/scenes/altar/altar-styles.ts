/**
 * Altar + solve-moment overlay styles (design px, 1920×1080). Kept with the scene so the
 * shared `ui/styles.ts` stays untouched; injected once per document.
 */
import { scaleFontSizes } from '@thunderclap/engine/ui';
import { ALTAR_CHROME_CSS } from './altar-chrome';
import { STRIKE_CSS } from './strike-styles';

const CSS = /* css */ `
.tc-overlay .lr-altar { position: absolute; inset: 0; pointer-events: none; }
.tc-overlay .lr-altar button { pointer-events: auto; }
.tc-overlay .lr-altar kbd { font-family: var(--tc-font-mono); font-size: 18px; opacity: 0.8; margin-left: 10px; }

.tc-overlay .lr-altar-title {
  position: absolute; left: 50%; top: 18px; transform: translateX(-50%); text-align: center;
  font-family: var(--tc-font-display); color: #f4e6c4; text-shadow: 0 2px 10px rgba(0,0,0,0.9);
}
.tc-overlay .lr-altar-title h2 { margin: 0; font-size: 40px; letter-spacing: 2px; color: var(--lr-gold); }
.tc-overlay .lr-altar-title small { display: block; font-size: 22px; color: #bfae8a; letter-spacing: 1px; min-height: 26px; }
.tc-overlay .lr-altar-title .lr-nowrap { white-space: nowrap; }

.tc-overlay .lr-altar-actions {
  position: absolute; right: 28px; top: 24px; display: flex; gap: 12px; align-items: center;
}
.tc-overlay .lr-altar-actions .lr-stone-button { min-width: 0; min-height: 56px; font-size: 24px; padding: 0 20px; }
.tc-overlay .lr-altar-actions .lr-gold-button { min-width: 0; min-height: 70px; font-size: 34px; padding: 0 34px; }
/* Bigger text makes the key-hint line taller and wider: FUSE's caption card sits just above
   it rather than squeezing beside it. */
.tc-overlay[data-text-scale]:has(.lr-altar) .tc-caption[data-corner^="bottom"] { bottom: 50px; }
/* Bigger text: the action row tightens so the title keeps its room. */
.tc-overlay[data-text-scale] .lr-altar-actions { right: 20px; gap: 8px; }
.tc-overlay[data-text-scale] .lr-altar-actions .lr-stone-button { padding: 0 12px; }
.tc-overlay[data-text-scale] .lr-altar-actions .lr-gold-button { padding: 0 20px; }
.tc-overlay[data-text-scale] .lr-altar kbd { margin-left: 6px; }
.tc-overlay .lr-altar-actions button:disabled { opacity: 0.45; cursor: default; filter: saturate(0.4); }

.tc-overlay .lr-altar-count {
  position: absolute; transform: translate(-50%, 0); min-width: 30px; padding: 2px 8px; border-radius: 12px;
  font-family: var(--tc-font-mono); font-size: 20px; text-align: center; color: #f4e6c4;
  background: rgba(20,16,12,0.85); border: 1px solid rgba(232,192,106,0.45);
}
.tc-overlay .lr-altar-count[data-empty] { opacity: 0.35; }
.tc-overlay .lr-altar-count[data-held] { border-color: var(--lr-gold); color: #fff6dd; box-shadow: 0 0 14px rgba(232,192,106,0.5); }
/* The slot's hotkey is a keycap and the count sits apart from it, so "1 ×6" never reads "16". */
.tc-overlay .lr-altar-count { display: flex; align-items: center; gap: 8px; padding: 2px 10px 2px 4px; white-space: nowrap; }
.tc-overlay .lr-altar .lr-altar-count kbd.lr-k {
  display: inline-block; min-width: 24px; margin: 0; padding: 0 5px; box-sizing: border-box;
  font-family: var(--tc-font-ui); font-size: 15px; font-weight: 600; line-height: 20px; text-align: center;
  opacity: 0.85; color: #f4e6c4; background: linear-gradient(180deg, #5d6375 0%, #3a3f4d 100%);
  border: 1px solid rgba(232,192,106,0.5); border-bottom-width: 3px; border-radius: 6px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
}
.tc-overlay .lr-altar-count .lr-n { letter-spacing: 0.5px; }
.tc-overlay .lr-altar-tip {
  position: absolute; transform: translate(-50%, -100%); max-width: 600px; padding: 6px 14px; border-radius: 10px;
  font-family: var(--tc-font-body, serif); font-size: 20px; line-height: 1.3; color: #f4e6c4; text-align: center;
  background: rgba(20,16,12,0.92); border: 1px solid rgba(232,192,106,0.55); box-shadow: 0 6px 16px rgba(0,0,0,0.6);
  pointer-events: none; white-space: normal; width: max-content;
}
.tc-overlay .lr-altar-tip::after {
  content: ''; position: absolute; left: calc(50% + var(--lr-tip-dx, 0px)); bottom: -7px; margin-left: -6px;
  border: 6px solid transparent; border-bottom: 0; border-top-color: rgba(232,192,106,0.55);
}
.tc-overlay .lr-altar-tip[hidden] { display: none; }
.tc-overlay .lr-altar-tip b { color: var(--lr-gold); font-weight: 600; margin-right: 4px; }
.tc-overlay .lr-altar-tip:not([data-source="tray"])::after { display: none; }
.tc-overlay .lr-altar-tip .lr-info-row + .lr-info-row { margin-top: 3px; }
/* The worked example under the rule, in the read-out's blue (mobile-7-teach). */
.tc-overlay .lr-altar-tip .lr-info-eg {
  display: block; margin-top: 2px; font-family: var(--tc-font-ui); font-size: 0.85em; color: #a8ccf5; white-space: nowrap;
}
.tc-overlay .lr-altar-tip .lr-info-tag {
  display: inline-block; margin-right: 6px; padding: 0 8px; border-radius: 6px; font-size: 16px; line-height: 1.4;
  vertical-align: 1px; color: #dfe6f2; background: rgba(150,165,190,0.22); border: 1px solid rgba(196,208,226,0.6);
}
.tc-overlay .lr-altar-tip .lr-info-tag:is([data-how="turns"], [data-how="turnsTray"]) { color: #f4e6c4; background: rgba(232,192,106,0.16); border-color: rgba(232,192,106,0.7); }

.tc-overlay .lr-altar-need {
  position: absolute; display: flex; flex-direction: column; align-items: center; gap: 0;
  padding: 6px 18px 8px; border-radius: 12px; white-space: nowrap; line-height: 1.1;
  font-family: var(--tc-font-display); font-size: 24px; color: rgba(244,230,196,0.85);
  background: linear-gradient(180deg, rgba(40,32,22,0.94), rgba(20,16,12,0.94));
  border: 2px solid rgba(232,192,106,0.55); box-shadow: 0 6px 16px rgba(0,0,0,0.6);
  transition: border-color 200ms, color 200ms;
}
.tc-overlay .lr-altar-need[data-align="below"] { transform: translate(-50%, 12px); }
.tc-overlay .lr-altar-need[data-align="right"] { transform: translate(14px, -50%); }
/* A notch on the side facing the machine ties each label to its cabinet. */
.tc-overlay .lr-altar-need::before {
  content: ''; position: absolute; width: 14px; height: 14px; background: rgb(36,29,20);
  border: 0 solid; border-color: inherit; transition: border-color 200ms;
}
.tc-overlay .lr-altar-need[data-align="right"]::before {
  left: -9px; top: 50%; transform: translateY(-50%) rotate(45deg); border-left-width: 2px; border-bottom-width: 2px;
}
.tc-overlay .lr-altar-need[data-align="below"]::before {
  left: var(--lr-notch, 50%); top: -9px; transform: translateX(-50%) rotate(45deg); border-left-width: 2px; border-top-width: 2px;
}
.tc-overlay .lr-altar-need b { font-size: 40px; color: #ffe2a0; font-weight: 600; margin-left: 4px; }
.tc-overlay .lr-altar-need .lr-need-got { font-size: 22px; }
.tc-overlay .lr-altar-need .lr-need-got b { font-size: 32px; color: #f4e6c4; }
.tc-overlay .lr-altar-need[data-state="exact"] { border-color: #3fe0ff; box-shadow: 0 0 22px rgba(63,224,255,0.55); }
.tc-overlay .lr-altar-need[data-state="exact"] .lr-need-got b { color: #7ff0ff; }
.tc-overlay .lr-altar-need[data-state="under"] { border-color: #ffb03f; }
.tc-overlay .lr-altar-need[data-state="under"] .lr-need-got b { color: #ffc46a; }
.tc-overlay .lr-altar-need[data-state="over"] { border-color: #ff5a3c; box-shadow: 0 0 22px rgba(255,90,60,0.55); }
.tc-overlay .lr-altar-need[data-state="over"] .lr-need-got b { color: #ff8a6e; }
/* First altar: the storm's "Gives N", the same card in the storm's blue. */
.tc-overlay .lr-altar-need.lr-altar-storm { border-color: rgba(120,200,255,0.75); box-shadow: 0 0 18px rgba(80,180,255,0.35); }
.tc-overlay .lr-altar-need.lr-altar-storm b { color: #bfefff; }
/* First altar: Strike glows once the route reaches the machine. */
.tc-overlay .lr-altar-actions .lr-gold-button[data-ready] { animation: lr-strike-ready 1.6s ease-in-out infinite; }
@keyframes lr-strike-ready {
  0%, 100% { box-shadow: 0 0 10px rgba(255,214,120,0.35); }
  50% { box-shadow: 0 0 34px 6px rgba(255,214,120,0.85); }
}
/* Until the route reaches a machine, Strike steps back so the tray and board lead the eye. */
.tc-overlay .lr-altar-actions .lr-gold-button:not([data-ready]):not(:hover):not(:focus-visible):not(:disabled) {
  filter: saturate(0.55) brightness(0.8);
}
[data-reduced-motion] .tc-overlay .lr-altar-actions .lr-gold-button[data-ready] {
  animation: none; box-shadow: 0 0 28px 4px rgba(255,214,120,0.75);
}
.tc-overlay .lr-need-strikes { display: flex; gap: 8px; margin-top: 4px; font-family: var(--tc-font-body, serif); font-size: 16px; }
.tc-overlay .lr-need-strikes span { padding: 1px 6px; border-radius: 6px; border: 1px solid rgba(232,192,106,0.4); }
.tc-overlay .lr-need-strikes [data-state="exact"] { border-color: #3fe0ff; color: #bff6ff; }
.tc-overlay .lr-need-strikes [data-state="under"] { border-color: #ffb03f; color: #ffd9a0; }
.tc-overlay .lr-need-strikes [data-state="over"] { border-color: #ff5a3c; color: #ffc0b0; }
.tc-overlay .lr-need-strikes [data-state="live"] { border-style: dashed; color: #f4e6c4; }
/* Phones: a strike chip never breaks across lines ("1:" over "0") in a narrow card; the
   chips drop under "Strike" instead, inside the card. */
.tc-overlay[data-phone] .lr-need-strikes { flex-wrap: wrap; justify-content: center; row-gap: 2px; }
.tc-overlay[data-phone] .lr-need-strikes span { white-space: nowrap; }

/* Charge chips: the bolt's charge where it changes, and what lands at each machine. */
.tc-overlay .lr-altar-chip {
  position: absolute; transform: translate(-50%, -50%); min-width: 34px; padding: 1px 9px; border-radius: 999px;
  font-family: var(--tc-font-display); font-size: 24px; line-height: 30px; text-align: center; color: #eaf8ff;
  background: rgba(10,18,26,0.88); border: 2px solid rgba(120,200,255,0.75);
  box-shadow: 0 0 12px rgba(80,180,255,0.45); pointer-events: none;
  animation: lr-chip-in 180ms var(--tc-easing) both;
}
.tc-overlay .lr-altar-chip[hidden] { display: none; }
.tc-overlay .lr-altar-chip[data-state="exact"] { border-color: #3fe0ff; color: #dff9ff; }
.tc-overlay .lr-altar-chip[data-state="under"] { border-color: #ffb03f; color: #ffe1b0; box-shadow: 0 0 12px rgba(255,176,63,0.5); }
.tc-overlay .lr-altar-chip[data-state="over"] { border-color: #ff5a3c; color: #ffd7cc; box-shadow: 0 0 14px rgba(255,90,60,0.6); }
@keyframes lr-chip-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); } to { opacity: 1; } }

/* Preview chips: the charge into and out of a new gem on the route, before the first strike. */
/* Multi-strike: one pip per strike at the storm and on Strike; lit as each strike fires. */
.tc-overlay .lr-altar-storm .lr-storm-row {
  display: flex; align-items: center; gap: 8px; margin-top: 4px; font-family: var(--tc-font-body, serif); font-size: 20px; color: #cfeeff;
}
.tc-overlay .lr-strike-pips { display: inline-flex; gap: 5px; align-items: center; }
.tc-overlay .lr-strike-pips i {
  width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(150,215,255,0.85); background: rgba(10,18,26,0.6);
  transition: background 150ms, box-shadow 150ms;
}
.tc-overlay .lr-strike-pips i[data-lit] { background: #bfefff; box-shadow: 0 0 10px rgba(120,210,255,0.9); }
.tc-overlay .lr-altar-actions .lr-gold-button .lr-strike-pips { margin-left: 12px; vertical-align: 4px; }
.tc-overlay .lr-altar-actions .lr-gold-button .lr-strike-pips i { border-color: rgba(60,36,8,0.85); background: rgba(60,36,8,0.15); }
.tc-overlay .lr-altar-actions .lr-gold-button .lr-strike-pips i[data-lit] { background: #3a2406; box-shadow: none; }
.tc-overlay .lr-altar-need .lr-need-note { font-family: var(--tc-font-body, serif); font-size: 17px; opacity: 0.8; margin-top: 2px; }

/* Capacitor read-out: what it keeps on one strike and lets out on the next. Dashed = the plan
   for the board as built; solid lines appear as the strike plays. */
.tc-overlay .lr-altar-cap {
  position: absolute; display: flex; flex-direction: column; gap: 2px; padding: 4px 10px; border-radius: 10px;
  white-space: nowrap; pointer-events: none; font-family: var(--tc-font-body, serif); font-size: 19px; line-height: 1.25;
  color: #eef6ff; background: rgba(12,16,22,0.9); border: 2px solid rgba(214,232,255,0.75);
  box-shadow: 0 4px 12px rgba(0,0,0,0.6); animation: lr-chip-in 180ms var(--tc-easing) both;
}
.tc-overlay .lr-altar-cap[data-side="above"] { transform: translate(-50%, -100%); }
.tc-overlay .lr-altar-cap[data-side="below"] { transform: translate(-50%, 0); }
.tc-overlay .lr-altar-cap[data-side="left"] { transform: translate(-100%, -50%); }
.tc-overlay .lr-altar-cap[data-side="right"] { transform: translate(0, -50%); }
.tc-overlay .lr-altar-cap[data-plan] { border-style: dashed; border-color: rgba(214,232,255,0.6); background: rgba(12,16,22,0.8); }
.tc-overlay .lr-altar-cap:not(:has(.lr-cap-line:not([hidden]))) { display: none; }
.tc-overlay .lr-cap-line[hidden] { display: none; }
.tc-overlay .lr-cap-line[data-kind="keep"] { color: #d8ecff; }
.tc-overlay .lr-cap-line[data-kind="release"] { color: #fff6dd; }
.tc-overlay .lr-cap-line[data-now] { color: #ffffff; text-shadow: 0 0 8px rgba(160,220,255,0.9); font-weight: 600; }
/* altar-truth: the plan lets out more than a machine takes: the line and that gauge warn. */
.tc-overlay .lr-cap-line[data-warn] { color: #ff9c86; font-weight: 600; }
.tc-overlay .lr-altar-cap:has(.lr-cap-line[data-warn]) { border-color: #ff6a4d; }
.tc-overlay .lr-altar-need[data-warn] { border-color: #ff6a4d; box-shadow: 0 0 18px rgba(255,90,60,0.55); }

/* Preview: a wrong-facing gem turns the bolt away here (a small ✕ on its rim). */
.tc-overlay .lr-altar-nogo {
  position: absolute; width: 28px; height: 28px; transform: translate(-50%, -50%); border-radius: 50%;
  background: rgba(30,6,4,0.9); border: 2px solid #ff5a3c; box-shadow: 0 0 10px rgba(255,90,60,0.7);
  pointer-events: none; animation: lr-chip-in 180ms var(--tc-easing) both;
}
.tc-overlay .lr-altar-nogo::before, .tc-overlay .lr-altar-nogo::after {
  content: ''; position: absolute; left: 50%; top: 50%; width: 16px; height: 3px; background: #ffb4a4;
  border-radius: 2px; transform: translate(-50%, -50%) rotate(45deg);
}
.tc-overlay .lr-altar-nogo::after { transform: translate(-50%, -50%) rotate(-45deg); }

/* A held Bend, Gate or Split turns: an arrow by the gem, with its keys, until the first turn. */
.tc-overlay .lr-altar-turn {
  position: absolute; transform: translate(-30%, -70%); display: flex; align-items: center; gap: 6px;
  padding: 2px 10px 2px 6px; border-radius: 999px; pointer-events: none; white-space: nowrap;
  font-family: var(--tc-font-body, serif); font-size: 18px; color: #f4e6c4;
  background: rgba(20,16,12,0.9); border: 1px solid rgba(232,192,106,0.7); box-shadow: 0 3px 10px rgba(0,0,0,0.6);
}
.tc-overlay .lr-altar-turn[hidden] { display: none; }
.tc-overlay .lr-turn-arrow {
  font-size: 28px; line-height: 1; color: var(--lr-gold); display: inline-block;
  animation: lr-turn-nudge 1.6s ease-in-out infinite;
}
@keyframes lr-turn-nudge { 0%, 60%, 100% { transform: rotate(0deg); } 30% { transform: rotate(90deg); } }
/* Touch: the ↻ Turn button, docked right of the tray, and the ↻ mark on the gem it turns. */
.tc-overlay .lr-altar .lr-altar-turnbtn {
  position: absolute; transform: translate(0, -50%); min-width: 0; padding: 0 22px;
  min-height: max(72px, var(--tc-tap-min, 0px)); border-radius: 999px; cursor: pointer; white-space: nowrap;
  font-family: var(--tc-font-display); font-size: 28px; color: #f4e6c4;
  background: rgba(20,16,12,0.92); border: 2px solid rgba(232,192,106,0.85); box-shadow: 0 3px 12px rgba(0,0,0,0.7);
}
.tc-overlay .lr-altar .lr-altar-turnbtn b { color: var(--lr-gold); font-size: 1.4em; line-height: 1; vertical-align: -0.1em; }
.tc-overlay .lr-altar .lr-altar-turnbtn:active { background: rgba(70,56,30,0.95); }
.tc-overlay .lr-altar .lr-altar-turnbtn[hidden], .tc-overlay .lr-altar-turnmark[hidden] { display: none; }
.tc-overlay .lr-altar-turnmark {
  position: absolute; transform: translate(-30%, -70%); pointer-events: none;
  width: max(44px, calc(var(--tc-text-min, 0px) * 1.6)); height: max(44px, calc(var(--tc-text-min, 0px) * 1.6)); border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 30px; line-height: 1; color: var(--lr-gold);
  background: rgba(20,16,12,0.9); border: 2px solid rgba(232,192,106,0.8); box-shadow: 0 2px 8px rgba(0,0,0,0.6);
}
.tc-overlay[data-touch] .lr-altar-turn { display: none; }

.tc-overlay .lr-altar-verdict {
  position: absolute; left: 50%; top: 96px; transform: translateX(-50%); padding: 10px 30px; border-radius: 12px;
  font-family: var(--tc-font-display); font-size: 30px; letter-spacing: 1px; width: max-content; text-align: center; color: #f4e6c4;
  background: rgba(16,13,10,0.9); border: 2px solid rgba(232,192,106,0.55); box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  animation: lr-altar-pop 260ms var(--tc-easing) both;
}
.tc-overlay .lr-altar-verdict[hidden] { display: none; }
.tc-overlay .lr-altar-verdict .lr-verdict-story {
  display: block; max-width: 640px; margin: 4px auto 0; white-space: normal; font-family: var(--tc-font-body, serif);
  font-size: 20px; line-height: 1.3; letter-spacing: 0; color: #e8dcc0;
}
.tc-overlay .lr-altar-verdict .lr-verdict-hint {
  display: block; max-width: 640px; margin: 4px auto 0; white-space: normal; font-family: var(--tc-font-body, serif);
  font-size: 20px; line-height: 1.3; letter-spacing: 0; color: #ffd98a;
}
.tc-overlay .lr-altar-verdict[data-narrow] { font-size: 24px; letter-spacing: 0; padding: 8px 18px; }
.tc-overlay .lr-altar-verdict[data-outcome="over"] { border-color: #ff5a3c; }
.tc-overlay .lr-altar-verdict[data-outcome="under"] { border-color: #ffb03f; }
.tc-overlay .lr-altar-verdict[data-outcome="exact"] { border-color: #3fe0ff; color: #dff9ff; }

.tc-overlay .lr-altar-tag {
  position: absolute; transform: translate(-50%, -100%); padding: 4px 12px; border-radius: 8px; white-space: nowrap;
  font-size: 20px; color: #ffe3dc; background: rgba(60,14,10,0.9); border: 1px solid rgba(255,110,80,0.7);
  box-shadow: 0 4px 12px rgba(0,0,0,0.6); pointer-events: none;
  animation: lr-altar-pop 220ms var(--tc-easing) both;
}
/* Fizzle tags name the cause, then fade so the board reads again; the red ring stays. */
.tc-overlay .lr-altar-tag:not([data-tone]) {
  animation: lr-altar-pop 220ms var(--tc-easing) both, lr-altar-tag-fade 700ms ease 3.2s forwards;
}
@keyframes lr-altar-tag-fade { to { opacity: 0; visibility: hidden; } }
.tc-overlay .lr-altar-tag::after {
  content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -6px;
  border: 6px solid transparent; border-bottom: 0; border-top-color: rgba(255,110,80,0.7);
}
/* Hung below its cell (arrow up) when above would cover the verdict. It pops out of the cell
   downward, mirroring the above-cell pop, so it never jumps from the above position. */
.tc-overlay .lr-altar-tag[data-below] { transform: translate(-50%, 7px); --lr-tag-pop-from: calc(7px - 20%); }
.tc-overlay .lr-altar-tag[data-below]::after { bottom: auto; top: -7px; border: 6px solid transparent; border-top: 0; border-bottom-color: rgba(255,110,80,0.7); }
.tc-overlay .lr-altar-tag[data-tone="info"] { color: #f4e6c4; background: rgba(20,16,12,0.9); border-color: rgba(232,192,106,0.6); }
.tc-overlay .lr-altar-tag[data-tone="info"]::after { border-top-color: rgba(232,192,106,0.6); }

/* The key-hint line sits under the tray, between FUSE (x ≤ 410) and his caption card: centred
   on the tray (430–1090), growing to the right if bigger text needs more room. The caption
   card measures it and keeps clear (altar-scene avoidTray). */
.tc-overlay .lr-altar-hint {
  position: absolute; left: 430px; bottom: 4px; width: max-content; min-width: 660px; box-sizing: border-box;
  text-align: center; white-space: nowrap; font-size: 19px; line-height: 1.25; color: rgba(232,220,192,0.92);
  text-shadow: 0 1px 4px #000, 0 0 2px #000; padding: 2px 20px; pointer-events: none;
  background: radial-gradient(closest-side, #05060ab0, #05060a70 70%, #05060a00);
}
.tc-overlay .lr-altar-hint b { color: #e8c06a; font-weight: 600; }
/* The phone loupe (engine Loupe, fixed, outside the scaled overlay; CSS px). */
.lr-loupe {
  z-index: 30; border-radius: 50%; overflow: hidden; border: 3px solid #e8c06a; box-sizing: border-box;
  background: #000; box-shadow: 0 6px 22px rgba(0,0,0,0.7), 0 0 0 1px #000; transition: opacity 0.15s ease-out;
}
[data-reduced-motion] .lr-loupe { transition: none; }
[data-reduced-motion] .tc-overlay .lr-altar-verdict,
[data-reduced-motion] .tc-overlay .lr-altar-chip, [data-reduced-motion] .tc-overlay .lr-turn-arrow,
[data-reduced-motion] .tc-overlay .lr-altar-cap,
[data-reduced-motion] .tc-overlay .lr-altar-tag { animation: none; }
/* Reduced motion: no pop or fade, but fizzle tags still step aside after a few seconds. */
[data-reduced-motion] .tc-overlay .lr-altar-tag:not([data-tone]) { animation: lr-altar-tag-fade 1ms linear 3.6s forwards; }

@keyframes lr-altar-pop { from { opacity: 0; transform: translate(-50%, var(--lr-tag-pop-from, -80%)) scale(0.92); } to { opacity: 1; } }
.tc-overlay .lr-altar-verdict { animation-name: lr-altar-drop; }
@keyframes lr-altar-drop { from { opacity: 0; transform: translate(-50%, -14px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* Solve moment: a left column (card, journal page, Continue) so the waking machine and the
   granted gem stay in view; FUSE's caption keeps the bottom-right corner. */
@keyframes lr-solve-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
.tc-overlay .lr-solve {
  position: absolute; left: 40px; top: 170px; width: 500px; display: flex; flex-direction: column;
  align-items: stretch; gap: 26px; pointer-events: none;
}
/* Bigger text: a wider, tighter column so card, page and Continue still fit above the floor. */
.tc-overlay[data-text-scale] .lr-solve { width: 580px; gap: 14px; }
.tc-overlay[data-text-scale] .lr-solve-card { padding: 18px 28px 22px; }
.tc-overlay .lr-solve-card {
  padding: 24px 34px 28px; border-radius: 18px; text-align: left;
  background: linear-gradient(180deg, rgba(255,241,181,0.97) 0%, rgba(232,192,106,0.97) 40%, rgba(168,122,44,0.97) 100%);
  border: 3px solid #5a3d12; color: #2a1906; box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 80px rgba(255,214,120,0.4);
  animation: lr-solve-in 600ms var(--tc-easing) both;
}
.tc-overlay .lr-solve-card h2 { margin: 0; font-family: var(--tc-font-display); font-size: 42px; line-height: 1.1; letter-spacing: 1px; }
.tc-overlay .lr-solve-card .lr-solve-sub { margin: 6px 0 0; font-size: 24px; opacity: 0.8; }
.tc-overlay .lr-solve-grant {
  margin: 20px 0 0; display: flex; align-items: center; gap: 16px;
  font-family: var(--tc-font-display); font-size: 36px; animation: lr-solve-in 500ms var(--tc-easing) both;
}
.tc-overlay .lr-solve-grant .lr-gem-dot { flex: none; width: 40px; height: 40px; border-radius: 50%; background: currentColor; box-shadow: 0 0 22px currentColor, inset 0 -6px 10px rgba(0,0,0,0.35); }
.tc-overlay .lr-solve-codex { margin: 8px 0 0; font-size: 22px; font-style: italic; line-height: 1.4; opacity: 0.85; animation: lr-solve-in 500ms var(--tc-easing) both; }
.tc-overlay .lr-solve-opens { margin: 14px 0 0; font-size: 22px; animation: lr-solve-in 500ms var(--tc-easing) both; }
.tc-overlay .lr-solve .lr-page-note { position: relative; left: auto; bottom: auto; width: auto; margin: 0 18px; animation: lr-solve-in 500ms var(--tc-easing) both; }
.tc-overlay .lr-solve [hidden] { display: none; }
.tc-overlay .lr-solve-continue { align-self: flex-start; pointer-events: auto; }
[data-reduced-motion] .tc-overlay .lr-solve * { animation-duration: 1ms; }
`;

let injected: WeakSet<Document> | undefined;

export function ensureAltarStyles(doc: Document = document): void {
  injected ??= new WeakSet();
  if (injected.has(doc)) return;
  injected.add(doc);
  const el = doc.createElement('style');
  el.dataset.lr = 'altar';
  el.textContent = scaleFontSizes(CSS + STRIKE_CSS + ALTAR_CHROME_CSS);
  doc.head.append(el);
}
