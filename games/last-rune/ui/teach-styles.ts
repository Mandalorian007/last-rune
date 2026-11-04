/**
 * mobile-7-teach (D-040 addendum 5): every word and look matches what is on screen. Appended
 * last to the phone sheet (`ui/phone-styles.ts` calls `teach7Css` with its own helpers), so
 * these rules win over earlier layers.
 */

/** Phone sheet helpers: the phone root selector, and CSS px / text px as design lengths. */
export interface SheetKit {
  readonly P: string;
  readonly cpx: (n: number) => string;
  readonly tpx: (n: number) => string;
}

export function teach7Css({ P, cpx, tpx }: SheetKit): string {
  /** The phone altar root. */
  const A = `${P} .lr-altar[data-phone]`;
  return /* css */ `
/* mobile-7-teach ─ The card names the gem in hand, or none ─────────────────────────────────
   A Capacitor's plan read-out names a board gem, so it steps aside while a gem is in hand
   (se/16: "Holding Channel" beside a Capacitor card). It returns when the hand is empty. */
${A}[data-hand] .lr-altar-lane .lr-altar-cap[data-plan] { display: none; }

/* The puzzle's name stays while a gem is in hand: it shrinks to a small line and the
   "Holding X" pill sits under it, both over the tray (the pill no longer covers the name). */
${A} .lr-altar-title[data-holding] {
  top: calc(var(--tc-crop-t, 0px) + ${cpx(0.5)}); display: flex; flex-direction: column; align-items: center;
  gap: ${cpx(1)};
}
${A} .lr-altar-title[data-holding] > :not(.lr-altar-holding) { visibility: visible; }
${A} .lr-altar-title[data-holding] h2 { font-size: ${tpx(10.5)}; line-height: 1; opacity: 0.9; }
${A} .lr-altar-title[data-holding] .lr-altar-holding {
  position: static; padding-top: 0; padding-bottom: 0; font-size: ${tpx(12)}; line-height: 1.25;
}

/* All of a kind placed: the gem stays as a dimmed silhouette (drawn by the scene) with
   "all placed" under it: one quiet line in the UI face. No ✓ circle, no outline, no plate:
   nothing there reads as a button. */
${A} .lr-altar-slot[data-empty] { display: none; }
${A} .lr-altar-count[data-empty] {
  opacity: 1; color: #a89a80; border: 0; background: none; box-shadow: none; text-decoration: none;
  padding: 0; white-space: normal; width: min-content; text-align: center;
  font: 400 ${tpx(13)}/1.05 var(--tc-font-ui); letter-spacing: -0.2px;
}
${A} .lr-altar-count[data-empty] .lr-k { display: none; }
${A} .lr-altar-count[data-empty] .lr-n { font: inherit; letter-spacing: inherit; }

/* One panel while teaching (the arbiter, moments.ts, holds the how-to line and FUSE's bubble).
   "Next ›" stands wholly inside the card: "New here · 1 of 3" wraps before the button can
   push past the card's edge. */
${A} .lr-altar-tip .lr-info-foot { min-width: 0; max-width: 100%; box-sizing: border-box; }
${A} .lr-altar-tip:not([data-compact]) .lr-info-page { flex: 1 1 auto; min-width: 0; white-space: normal; }
${A} .lr-altar-tip .lr-info-of { display: block; }
${A} .lr-altar-tip:not([data-compact]) .lr-info-of::before { content: none; }
/* Worked examples: one line with real numbers under each gem's rule (the codex's maths line). A card
   shrunk to its name line drops it. */
${A} .lr-altar-tip .lr-info-eg { margin-top: ${cpx(1)}; font-size: ${tpx(12)}; line-height: 1.25; white-space: normal; }
${A} .lr-altar-lane > .lr-altar-tip[data-arb="line"] .lr-info-eg { display: none; }
/* The arrival card points at what it teaches. A fixed gem's page: a gold line from the card
   to the gem, ringed. A tray gem's page: its tray tile rings gold and breathes. */
${A} .lr-teach-leader { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
${A} .lr-teach-leader .lr-leader-shade { stroke: rgba(10,6,2,0.75); stroke-linecap: round; }
${A} .lr-teach-leader .lr-leader-line { stroke: #ffd77a; stroke-linecap: round; }
${A} .lr-teach-leader .lr-leader-ring { fill: none; stroke: #ffd77a; animation: lr-t7-breathe 1.6s ease-in-out infinite; }
${A} .lr-altar-slot[data-teach]:not([data-empty]):not([data-held]) {
  display: block; box-shadow: 0 0 0 ${cpx(2)} #ffd77a, 0 0 ${cpx(12)} ${cpx(2)} rgba(255,205,110,0.6);
  animation: lr-t7-breathe 1.6s ease-in-out infinite;
}
@keyframes lr-t7-breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
[data-reduced-motion] ${A} .lr-teach-leader .lr-leader-ring,
[data-reduced-motion] ${A} .lr-altar-slot[data-teach] { animation: none; }
/* mobile-7-teach end */
`;
}
