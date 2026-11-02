/**
 * FUSE's stroll: a tiny planner for idling on a stage. He stands at a spot, glances between the
 * things there worth looking at (or out at the player), then now and then rolls, unhurried, to
 * another spot. Pure logic: it says where to go and what to look at; the view drives the rig.
 *
 * ```ts
 * const stroll = new FuseStroll(spots);
 * stroll.update(dt, { hold: speaking, still: reducedMotion, rolling: fuse.rolling });
 * fuse.rollTo(stroll.x);
 * fuse.lookAt(stroll.look ? stroll.look.x : null, stroll.look?.y);
 * ```
 */

export interface StrollPoint {
  readonly x: number;
  readonly y: number;
}

export interface StrollSpot {
  /** Floor x to stand at (logical px). */
  readonly x: number;
  /** Things worth looking at from here. `null` means out at the player. */
  readonly looks: readonly (StrollPoint | null)[];
}

export interface StrollOptions {
  /** Seconds to stay at a spot before strolling on (min, max). Default 7–13. */
  readonly dwell?: readonly [number, number];
  /** Seconds between glances while standing (min, max). Default 2.5–5. */
  readonly glance?: readonly [number, number];
  /** Spot index to start at. Default 0. */
  readonly start?: number;
  /** Injected for tests. Default `Math.random`. */
  readonly random?: () => number;
}

export interface StrollInput {
  /** Don't start a walk (he is talking, or something just happened). Glances continue. */
  readonly hold?: boolean;
  /** Reduced motion: never walk; glance less often. */
  readonly still?: boolean;
  /** The rig is still rolling toward `x`. */
  readonly rolling: boolean;
}

export class FuseStroll {
  private spotIndex: number;
  private walking = false;
  private dwellLeft: number;
  private glanceLeft: number;
  private lookIndex = 0;
  private readonly dwell: readonly [number, number];
  private readonly glance: readonly [number, number];
  private readonly random: () => number;

  constructor(
    readonly spots: readonly StrollSpot[],
    opts: StrollOptions = {},
  ) {
    if (spots.length === 0) throw new Error('FuseStroll needs at least one spot');
    this.random = opts.random ?? Math.random;
    this.dwell = opts.dwell ?? [7, 13];
    this.glance = opts.glance ?? [2.5, 5];
    this.spotIndex = Math.min(spots.length - 1, Math.max(0, opts.start ?? 0));
    this.dwellLeft = this.between(this.dwell);
    this.glanceLeft = this.between(this.glance);
  }

  /** The spot he is at, or heading to. */
  get spot(): StrollSpot {
    return this.spots[this.spotIndex]!;
  }

  /** Floor x to roll to. */
  get x(): number {
    return this.spot.x;
  }

  /** True from choosing a new spot until the rig stops rolling there. */
  get isWalking(): boolean {
    return this.walking;
  }

  /** What to look at while standing (`null`: the player). While walking, look where he's going. */
  get look(): StrollPoint | null {
    const looks = this.spot.looks;
    return looks.length ? (looks[this.lookIndex % looks.length] ?? null) : null;
  }

  update(dt: number, input: StrollInput): void {
    if (this.walking) {
      if (!input.rolling) {
        this.walking = false;
        this.dwellLeft = this.between(this.dwell);
        this.glanceLeft = this.between(this.glance);
        this.lookIndex = 0;
      }
      return;
    }
    this.glanceLeft -= dt;
    if (this.glanceLeft <= 0) {
      const g = this.between(this.glance);
      this.glanceLeft = input.still ? g * 1.5 : g;
      this.nextLook();
    }
    if (input.still || this.spots.length < 2) return;
    this.dwellLeft -= dt;
    if (this.dwellLeft <= 0 && !input.hold) this.walkOn();
  }

  private nextLook(): void {
    const n = this.spot.looks.length;
    if (n < 2) return;
    // Any other look than the current one.
    this.lookIndex = (this.lookIndex + 1 + Math.floor(this.random() * (n - 1))) % n;
  }

  private walkOn(): void {
    const n = this.spots.length;
    this.spotIndex = (this.spotIndex + 1 + Math.floor(this.random() * (n - 1))) % n;
    this.lookIndex = 0;
    this.walking = true;
  }

  private between([lo, hi]: readonly [number, number]): number {
    return lo + (hi - lo) * this.random();
  }
}
