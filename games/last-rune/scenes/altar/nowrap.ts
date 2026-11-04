/**
 * teach-4: copy that must never break inside an expression. Sums ("8 + 8 = 16", "8 + 8 → 16")
 * and value phrases ("Needs 20", "in one strike", "1 of 2", "Strike (2 left)") read as one
 * thing; a line break inside one splits a number from what it counts. `keepTogether` joins
 * them with no-break spaces wherever this copy is rendered: verdicts, the Capacitor preview,
 * the Needs pills, the teach card and its count, Strike. Pure TS, unit-tested.
 */

const NB = ' ';

/** `text` with the spaces inside sums and value phrases made non-breaking. */
export function keepTogether(text: string): string {
  return (
    text
      // A sum or step: "8 + 8", "8 + 8 → 16", "4 = 4", "2 × 4".
      .replace(/(\d) ([+=→×−-]) (?=\d)/g, `$1${NB}$2${NB}`)
      // "1 of 2".
      .replace(/(\d) of (?=\d)/g, `$1${NB}of${NB}`)
      // "in one strike", "per strike".
      .replace(/\bin one strike\b/g, `in${NB}one${NB}strike`)
      .replace(/(\d) per strike\b/g, `$1${NB}per${NB}strike`)
      // "Strike (2 left)".
      .replace(/(\S) \((\d+) left\)/g, `$1${NB}($2${NB}left)`)
      // A word and its number: "Needs 20", "Strike 1", "got 4", "then 16".
      .replace(/([A-Za-z]) (?=\d)/g, `$1${NB}`)
  );
}
