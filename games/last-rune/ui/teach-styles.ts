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
  top: calc(var(--lr-crop-t, 0px) + ${cpx(0.5)}); display: flex; flex-direction: column; align-items: center;
  gap: ${cpx(1)};
}
${A} .lr-altar-title[data-holding] > :not(.lr-altar-holding) { visibility: visible; }
${A} .lr-altar-title[data-holding] h2 { font-size: ${tpx(10.5)}; line-height: 1; opacity: 0.9; }
${A} .lr-altar-title[data-holding] .lr-altar-holding {
  position: static; padding-top: 0; padding-bottom: 0; font-size: ${tpx(12)}; line-height: 1.25;
}
/* mobile-7-teach end */
`;
}
