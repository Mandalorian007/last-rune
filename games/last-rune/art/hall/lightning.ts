/**
 * Storm lightning seen through windows: when it strikes, how bright it is, and where the bolt
 * falls. Pure timing (no GPU). The hall and title read `flash` for window glass, room light and
 * the bolt, and get `onStrike` to sync thunder.
 *
 * Reduce flashes: no multi-strike flicker and no bolt; a single slow swell at a third of the
 * brightness (well under 3 changes a second), so the room never jumps in brightness.
 */

/** Strike envelope offsets (s) and weights for the full look: a hit, a re-strike, a tail. */
const STRIKES = [
  [0, 1],
  [0.11, 0.55],
  [0.29, 0.85],
] as const;
const FULL_DURATION = 1.1;
const CALM_DURATION = 2.2;

export class Lightning {
  /** 0..1 how stormy: raises strike frequency and brightness. */
  level = 0.5;
  reduceFlashes = false;
  /** 0..1 brightness right now. */
  flash = 0;
  /** 0..1 visibility of the bolt itself (full look only). */
  bolt = 0;
  /** Which window the bolt is in (0..windows-1) and its x offset (-1..1). */
  window = 0;
  boltX = 0;
  /** Called on each strike; `near` for the brighter, closer ones. */
  onStrike: ((near: boolean) => void) | null = null;

  private age = -1;
  private wait: number;
  private peak = 1;
  private near = false;

  constructor(
    private readonly windows = 1,
    firstIn = 2.5,
  ) {
    this.wait = firstIn;
  }

  /** Strike now (e.g. the title knock). */
  strike(): void {
    this.age = 0;
    this.near = Math.random() < 0.35 + this.level * 0.4;
    this.peak = this.near ? 1 : 0.6 + Math.random() * 0.25;
    this.window = Math.floor(Math.random() * this.windows);
    this.boltX = (Math.random() * 2 - 1) * 0.5;
    this.onStrike?.(this.near);
  }

  update(dt: number): void {
    if (this.age < 0) {
      this.flash = 0;
      this.bolt = 0;
      this.wait -= dt;
      if (this.wait <= 0) this.strike();
      return;
    }
    this.age += dt;
    const a = this.age;
    if (this.reduceFlashes) {
      // One soft swell: 0.6 s up, 1.6 s down.
      const up = Math.min(a / 0.6, 1);
      const down = 1 - Math.max(0, Math.min((a - 0.6) / 1.6, 1));
      const s = up * up * (3 - 2 * up) * down;
      this.flash = s * this.peak * 0.32;
      this.bolt = 0;
      if (a >= CALM_DURATION) this.end();
      return;
    }
    let f = 0;
    for (let i = 0; i < STRIKES.length; i++) {
      const t0 = STRIKES[i]![0];
      if (a >= t0) f += STRIKES[i]![1] * Math.exp(-(a - t0) * 11);
    }
    this.flash = Math.min(1, f) * this.peak;
    this.bolt = a < 0.42 ? Math.min(1, f * 1.4) : 0;
    if (a >= FULL_DURATION) this.end();
  }

  private end(): void {
    this.age = -1;
    this.flash = 0;
    this.bolt = 0;
    // Calmer storms wait longer; the end game is a near-constant storm.
    const base = 13 - this.level * 8;
    this.wait = base * (0.6 + Math.random() * 0.8);
  }
}
