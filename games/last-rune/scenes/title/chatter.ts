/**
 * Title-screen chatter pacing: which line next, and when.
 *
 * - Lines come from a shuffle bag: every line once, in random order, before any repeats, and a
 *   new round never opens with the line that closed the last one.
 * - Lines start `GAP` seconds apart (first one `FIRST_GAP` in), but never over another line:
 *   if FUSE is talking when one is due, it waits until he has been quiet for `BREATH` seconds.
 *   The clock stops while a panel is open.
 */

/** Seconds from entering the title to the first chatter line (min, max). */
export const FIRST_GAP: readonly [number, number] = [8, 11];
/** Seconds from one chatter line's start to the next (min, max). */
export const GAP: readonly [number, number] = [12, 20];
/** Least quiet, in seconds, after any line before a chatter line starts. */
export const BREATH = 4;

export class ShuffleBag<T> {
  private bag: T[] = [];
  private last: T | undefined;

  constructor(
    private readonly items: readonly T[],
    private readonly random: () => number = Math.random,
  ) {}

  next(): T | undefined {
    if (this.items.length === 0) return undefined;
    if (this.bag.length === 0) this.refill();
    const item = this.bag.pop()!;
    this.last = item;
    return item;
  }

  private refill(): void {
    const b = [...this.items];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [b[i], b[j]] = [b[j]!, b[i]!];
    }
    // `next` pops from the end: don't open the round with the line that just closed the last.
    if (b.length > 1 && b[b.length - 1] === this.last)
      [b[0], b[b.length - 1]] = [b[b.length - 1]!, b[0]!];
    this.bag = b;
  }
}

export interface ChatterInput {
  /** A panel is open (or the knock is still to come): the clock stops. */
  readonly paused: boolean;
  /** FUSE is talking: a due line waits for him to finish. */
  readonly speaking: boolean;
}

/** Times the chatter: says when the next line is due. */
export class ChatterClock {
  private elapsed = 0;
  private quiet = BREATH;
  private gap: number;

  constructor(private readonly random: () => number = Math.random) {
    this.gap = between(FIRST_GAP, random);
  }

  /** Advance; true when a line should start now (then the next gap begins). */
  tick(dt: number, input: ChatterInput): boolean {
    if (input.paused) return false;
    this.elapsed += dt;
    this.quiet = input.speaking ? 0 : this.quiet + dt;
    if (this.elapsed < this.gap || this.quiet < BREATH) return false;
    this.elapsed = 0;
    this.gap = between(GAP, this.random);
    return true;
  }
}

function between([lo, hi]: readonly [number, number], random: () => number): number {
  return lo + (hi - lo) * random();
}
