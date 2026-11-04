/**
 * Codex charge diagrams (pure data): for each gem at rotation 0 (as the Codex portrait shows
 * it), where a 1× charge (4 sparks) goes in, where it comes out and with how much, and which
 * sides lose it (the red ✕). Matches docs/design/rules.md §4 (whose "bolt" and "fizzle" the
 * player reads as "charge" and "lost"); `codex-diagram.test.ts` checks the sides against the
 * simulator's `acceptMask`. The `alt` text is player-facing: it says "charge", never "bolt".
 */
import type { Dir, GemKind } from '../rules/types';

export interface DiagramArrow {
  readonly side: Dir;
  /** Charge label on the arrow, in sparks. */
  readonly charge: string;
}

export interface GemDiagram {
  readonly ins: readonly DiagramArrow[];
  readonly outs: readonly DiagramArrow[];
  /** Sides where the charge is lost (drawn as a red ✕, as in the altar preview). */
  readonly fizzle: readonly Dir[];
  /** The picture in words, for screen readers. */
  readonly alt: string;
}

export const GEM_DIAGRAMS: Readonly<Record<GemKind, GemDiagram>> = {
  channel: {
    ins: [{ side: 'S', charge: '4' }],
    outs: [{ side: 'N', charge: '4' }],
    fizzle: [],
    alt: 'Charge of 4 enters from below and leaves straight out the top with 4.',
  },
  bend: {
    ins: [{ side: 'N', charge: '4' }],
    outs: [{ side: 'E', charge: '4' }],
    fizzle: ['S', 'W'],
    alt: 'Charge of 4 enters from the top and leaves to the right with 4. Charge entering the bottom or left side is lost.',
  },
  split: {
    ins: [{ side: 'S', charge: '4' }],
    outs: [
      { side: 'W', charge: '2' },
      { side: 'E', charge: '2' },
    ],
    fizzle: ['N'],
    alt: 'Charge of 4 enters from below and leaves left and right with 2 each. Charge entering the top is lost.',
  },
  amplify: {
    ins: [{ side: 'S', charge: '4' }],
    outs: [{ side: 'N', charge: '8' }],
    fizzle: [],
    alt: 'Charge of 4 enters from below and leaves straight out the top with 8.',
  },
  gate: {
    ins: [
      { side: 'W', charge: '4' },
      { side: 'E', charge: '4' },
    ],
    outs: [{ side: 'N', charge: '8' }],
    fizzle: ['S'],
    alt: 'Charge of 4 enters from the left and the right in the same strike; 8 leaves out the top. Charge entering the bottom is lost.',
  },
  capacitor: {
    ins: [{ side: 'S', charge: '4' }],
    outs: [{ side: 'N', charge: '0, then 8' }],
    fizzle: [],
    alt: 'Charge of 4 enters from below. On the first strike nothing comes out; on the next, 8 leaves out the top.',
  },
};

const TURN: readonly Dir[] = ['N', 'E', 'S', 'W'];

/** `side` after the gem turns `rot` quarter turns clockwise (as on the altar, rules.md §4). */
export function turnSide(side: Dir, rot: number): Dir {
  return TURN[(((TURN.indexOf(side) + rot) % 4) + 4) % 4]!;
}

/** Unit vector of a side in the 0..100 diagram box (y down). */
const SIDE: Readonly<Record<Dir, readonly [number, number]>> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

/** Gem rim and box edge, as distances from the centre in diagram units (box is 100). */
const RIM = 27;
const EDGE = 48;

/**
 * SVG markup for the arrows (static strings from the table above, no user input). The box is
 * 0..100 with the gem centred and spanning about half of it.
 */
export function diagramSvg(d: GemDiagram): string {
  const arrow = (side: Dir, inward: boolean) => {
    const [dx, dy] = SIDE[side];
    // Unit vector the bolt travels along, and the tip of the arrow.
    const [ux, uy] = inward ? [-dx, -dy] : [dx, dy];
    const tipR = inward ? RIM : EDGE;
    const tailR = inward ? EDGE : RIM;
    const tip = [50 + dx * tipR, 50 + dy * tipR] as const;
    const tail = [50 + dx * tailR, 50 + dy * tailR] as const;
    const head = 7;
    const base = [tip[0] - ux * head, tip[1] - uy * head] as const;
    const px = -uy * head * 0.62;
    const py = ux * head * 0.62;
    const n = (v: number) => Math.round(v * 10) / 10;
    return (
      `<line x1="${n(tail[0])}" y1="${n(tail[1])}" x2="${n(base[0])}" y2="${n(base[1])}"/>` +
      `<polygon points="${n(tip[0])},${n(tip[1])} ${n(base[0] + px)},${n(base[1] + py)} ${n(base[0] - px)},${n(base[1] - py)}"/>`
    );
  };
  return (
    '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
    d.ins.map((a) => arrow(a.side, true)).join('') +
    d.outs.map((a) => arrow(a.side, false)).join('') +
    '</svg>'
  );
}

/** Where a side's charge chip sits (percent of the box): beside the arrow, mid-way out. */
export function chipAt(side: Dir): { left: number; top: number } {
  const [dx, dy] = SIDE[side];
  const mid = (RIM + EDGE) / 2;
  // Vertical arrows: chip to the right. Horizontal arrows: chip above.
  const ox = dy !== 0 ? 17 : 0;
  const oy = dx !== 0 ? -15 : 0;
  return { left: 50 + dx * mid + ox, top: 50 + dy * mid + oy };
}

/** Where a fizzle ✕ sits: just outside the gem's rim on that side. */
export function fizzleAt(side: Dir): { left: number; top: number } {
  const [dx, dy] = SIDE[side];
  const r = RIM + 6;
  return { left: 50 + dx * r, top: 50 + dy * r };
}
