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

export function teach7Css({ P }: SheetKit): string {
  /** The phone altar root. */
  const A = `${P} .lr-altar[data-phone]`;
  return /* css */ `
/* mobile-7-teach ─ The card names the gem in hand, or none ─────────────────────────────────
   A Capacitor's plan read-out names a board gem, so it steps aside while a gem is in hand
   (se/16: "Holding Channel" beside a Capacitor card). It returns when the hand is empty. */
${A}[data-hand] .lr-altar-lane .lr-altar-cap[data-plan] { display: none; }
/* mobile-7-teach end */
`;
}
