/**
 * The Builder's margin sketches: procedural ink drawings (SVG path data) for
 * the right-hand leaf. An altar grid, a few gems, a bolt's path with an arrow,
 * a circled gem, tally marks, and an ink ring. Deterministic per page.
 * Pure: returns strings, no DOM.
 */

export interface Sketch {
  /** Stroked ink paths (fill none). */
  readonly strokes: readonly string[];
  /** Ink ring stain: centre and radius (drawn faint). */
  readonly ring: { x: number; y: number; r: number };
  readonly width: number;
  readonly height: number;
}

function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

/** A hand-drawn line: a gentle quadratic with a little wobble. */
function line(r: () => number, x0: number, y0: number, x1: number, y1: number, wob = 2.2): string {
  const mx = (x0 + x1) / 2 + (r() - 0.5) * wob * 2;
  const my = (y0 + y1) / 2 + (r() - 0.5) * wob * 2;
  return `M${f(x0 + (r() - 0.5) * wob)} ${f(y0 + (r() - 0.5) * wob)} Q${f(mx)} ${f(my)} ${f(x1 + (r() - 0.5) * wob)} ${f(y1 + (r() - 0.5) * wob)}`;
}

function polygon(
  r: () => number,
  cx: number,
  cy: number,
  rad: number,
  sides: number,
  rot: number,
): string {
  let d = '';
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const rr = rad * (1 + (r() - 0.5) * 0.08);
    d += `${i === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
  }
  return d;
}

function loop(r: () => number, cx: number, cy: number, rx: number, ry: number): string {
  // An open, slightly overshooting ellipse: how people circle things.
  let d = '';
  const start = r() * Math.PI * 2;
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2.15;
    const k = 1 + (i / n) * 0.08;
    d += `${i === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * rx * k)} ${f(cy + Math.sin(a) * ry * k)}`;
  }
  return d;
}

export function journalSketch(page: number, width = 440, height = 300): Sketch {
  const r = rng(page * 7919 + 13);
  const strokes: string[] = [];
  const cols = 5 + Math.floor(r() * 2);
  const rows = 3 + Math.floor(r() * 2);
  const cell = Math.min((width - 120) / cols, (height - 90) / rows);
  const gx = 40 + r() * 20;
  const gy = 30 + r() * 14;
  // Altar grid.
  for (let i = 0; i <= cols; i++) {
    strokes.push(line(r, gx + i * cell, gy, gx + i * cell, gy + rows * cell, 1.6));
  }
  for (let j = 0; j <= rows; j++) {
    strokes.push(line(r, gx, gy + j * cell, gx + cols * cell, gy + j * cell, 1.6));
  }
  // A bolt path through the grid: in from the left, a couple of turns, out the right.
  let cx = 0;
  let cy = Math.floor(r() * rows);
  const pts: [number, number][] = [[gx - 30, gy + (cy + 0.5) * cell]];
  while (cx < cols) {
    pts.push([gx + (cx + 0.5) * cell, gy + (cy + 0.5) * cell]);
    if (r() < 0.35 && cx > 0) {
      const ny = Math.max(0, Math.min(rows - 1, cy + (r() < 0.5 ? -1 : 1)));
      if (ny !== cy) {
        cy = ny;
        pts.push([gx + (cx + 0.5) * cell, gy + (cy + 0.5) * cell]);
      }
    }
    cx++;
  }
  pts.push([gx + cols * cell + 34, gy + (cy + 0.5) * cell]);
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]!;
    d += `${i === 0 ? 'M' : 'L'}${f(x + (r() - 0.5) * 3)} ${f(y + (r() - 0.5) * 3)}`;
  }
  strokes.push(d);
  const [ex, ey] = pts[pts.length - 1]!;
  strokes.push(`M${f(ex - 12)} ${f(ey - 8)} L${f(ex)} ${f(ey)} L${f(ex - 12)} ${f(ey + 8)}`);
  // Gems on a few of the path's cells.
  const gems = 2 + Math.floor(r() * 2);
  for (let g = 0; g < gems; g++) {
    const p = pts[1 + Math.floor(r() * (pts.length - 2))]!;
    const sides = r() < 0.5 ? 6 : 4;
    strokes.push(polygon(r, p[0], p[1], cell * 0.3, sides, r() * 0.6));
  }
  // Circle one of them, twice, the way you do when it matters.
  const c = pts[1 + Math.floor(r() * (pts.length - 2))]!;
  strokes.push(loop(r, c[0], c[1], cell * 0.62, cell * 0.5));
  strokes.push(loop(r, c[0] + 2, c[1] - 1, cell * 0.66, cell * 0.54));
  // Tally marks in the corner: somebody counting.
  const tx = gx + 10;
  const ty = gy + rows * cell + 26;
  const tallies = 3 + (page % 5);
  for (let i = 0; i < tallies; i++) {
    const x = tx + i * 11 + Math.floor(i / 5) * 10;
    if (i % 5 === 4) strokes.push(line(r, x - 50, ty + 26, x + 2, ty + 4, 1));
    else strokes.push(line(r, x, ty, x + 2, ty + 30, 1));
  }
  const ring = { x: width - 70 - r() * 40, y: height - 60 - r() * 30, r: 34 + r() * 10 };
  return { strokes, ring, width, height };
}

/**
 * Page 16's signature: big ragged loops (a name nobody can read any more) that
 * tighten and flatten as they go, then come down to the baseline where FUSE's
 * sign-off picks up in the same hand (stage direction and `signOff` in
 * content/journal.ts). The path ends at (width, baseline - 4) so the words follow on.
 */
export function trailingSignature(width = 210, height = 80, baseline = 56): string {
  const r = rng(1616);
  let d = '';
  const n = 64;
  const end = width - 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = 8 + t * (end - 8);
    // Ragged loops at first, settling into small regular ones just above the baseline.
    const loose = (1 - t) ** 1.2;
    const amp = 3 + loose * 20;
    const freq = 0.17 + (1 - loose) * 0.2;
    const wob = loose * (r() - 0.5) * 8;
    const mid = Math.min(height - 4, baseline - 8 - loose * 6);
    const y = mid + Math.sin(i * freq * Math.PI) * amp + wob;
    d += `${i === 0 ? 'M' : 'L'}${f(x + Math.cos(i * freq * Math.PI) * loose * 9)} ${f(y)}`;
  }
  // The pen comes down and runs on into the next word.
  d += `Q${f(end + 8)} ${f(baseline + 2)} ${f(width)} ${f(baseline - 4)}`;
  return d;
}
