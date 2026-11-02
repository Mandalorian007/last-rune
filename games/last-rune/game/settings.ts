/**
 * Settings: the non-audio preferences stored in the save (volumes are engine/audio's
 * `persistMixer` slot). `SettingsController` applies them to the systems that care and
 * tells listeners (scenes, views) when the effective values change.
 */
import type { GameSave, GameSettings } from './save';

export type CaptionSpeed = GameSettings['captionSpeed'];
export type ReducedMotionPref = GameSettings['reducedMotion'];
export type ReduceFlashesPref = NonNullable<GameSettings['reduceFlashes']>;
export type GraphicsPref = NonNullable<GameSettings['graphics']>;

export function resolveReducedMotion(pref: ReducedMotionPref, system: boolean): boolean {
  return pref === 'system' ? system : pref === 'reduce';
}

/** `auto` (or missing, in saves from before the setting) follows reduced motion. */
export function resolveReduceFlashes(
  pref: ReduceFlashesPref | undefined,
  reducedMotion: boolean,
): boolean {
  return pref === 'on' ? true : pref === 'off' ? false : reducedMotion;
}

/** Characters per second for FUSE's typewriter (0 = instant). */
export function captionCps(speed: CaptionSpeed): number {
  return speed === 'instant' ? 0 : speed === 'fast' ? 90 : 45;
}

export interface EffectiveSettings {
  readonly reducedMotion: boolean;
  readonly captionCps: number;
  /**
   * Photosensitivity: no full-screen whiteouts, lightning dimmed and slowed. Anything that
   * flashes the whole frame (bolt over-charge, breaker, storm lightning) must honour it.
   */
  readonly reduceFlashes: boolean;
  /** Graphics quality preference (missing in old saves = `auto`). See game/graphics.ts. */
  readonly graphics: GraphicsPref;
}

export interface SettingsTargets {
  /** e.g. `(r) => { caption.reducedMotion = r; particles.spawnScale = r ? 0.25 : 1; }` */
  apply(effective: EffectiveSettings): void;
}

export class SettingsController {
  private system: boolean;
  private readonly listeners = new Set<(e: EffectiveSettings) => void>();
  private _effective: EffectiveSettings;

  constructor(
    private readonly save: GameSave,
    private readonly targets: SettingsTargets,
    systemReducedMotion: boolean,
  ) {
    this.system = systemReducedMotion;
    this._effective = this.compute();
    this.targets.apply(this._effective);
  }

  get stored(): Readonly<GameSettings> {
    return this.save.get().settings;
  }

  get effective(): EffectiveSettings {
    return this._effective;
  }

  get reducedMotion(): boolean {
    return this._effective.reducedMotion;
  }

  get reduceFlashes(): boolean {
    return this._effective.reduceFlashes;
  }

  set(patch: Partial<GameSettings>): void {
    this.save.update((d) => {
      Object.assign(d.settings, patch);
      return undefined;
    });
    this.refresh();
  }

  /** The OS preference changed (`watchReducedMotion`). */
  setSystemReducedMotion(reduced: boolean): void {
    this.system = reduced;
    this.refresh();
  }

  /** Re-apply after the save was replaced (import, reset). */
  refresh(): void {
    const next = this.compute();
    if (
      next.reducedMotion === this._effective.reducedMotion &&
      next.captionCps === this._effective.captionCps &&
      next.reduceFlashes === this._effective.reduceFlashes &&
      next.graphics === this._effective.graphics
    ) {
      return;
    }
    this._effective = next;
    this.targets.apply(next);
    for (const fn of this.listeners) fn(next);
  }

  onChange(fn: (e: EffectiveSettings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private compute(): EffectiveSettings {
    const s = this.save.get().settings;
    const reducedMotion = resolveReducedMotion(s.reducedMotion, this.system);
    return {
      reducedMotion,
      captionCps: captionCps(s.captionSpeed),
      reduceFlashes: resolveReduceFlashes(s.reduceFlashes, reducedMotion),
      graphics: s.graphics ?? 'auto',
    };
  }
}
