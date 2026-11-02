/**
 * LightSet: the scene's 2D point lights (warm candles at the edges, cool gems in the centre).
 * Rebuild it every frame (`begin` → `add…` → `apply` to each lit material). No allocation.
 */
import type { Material } from '@engine/render';
import { LIGHT_SET_FLOATS, MAX_LIGHTS } from '../../shaders/lights-wgsl';
import { LINEAR } from './palette';

export { LIGHT_SET_FLOATS, MAX_LIGHTS };

/**
 * Quality hook (game/graphics.ts): the most lights any `LightSet` or `PropLightRig` takes per
 * frame. Lower tiers cap it below MAX_LIGHTS; scenes add their key lights first, so the cap
 * trims the faint fill lights at the end of the list.
 */
export const lightBudget = { max: MAX_LIGHTS };

/** Default height above the surface (px) for each light family. */
export const LIGHT_HEIGHT = { candle: 140, gem: 55, storm: 400 } as const;

export class LightSet {
  /** Packed uniform data (layout: `LightSet` in `shaders/lights-wgsl.ts`). */
  readonly data = new Float32Array(LIGHT_SET_FLOATS);
  private n = 0;

  constructor() {
    this.begin();
  }

  get count(): number {
    return this.n;
  }

  /**
   * Start a new frame. `ambient` is linear rgb (keep it dim ink-blue); `floorDark` darkens the
   * frame below `floorStart` (0..1 of the screen height) by up to that fraction.
   */
  begin(
    ambientR = 0.03,
    ambientG = 0.034,
    ambientB = 0.06,
    floorDark = 0.5,
    floorStart = 0.75,
  ): this {
    const d = this.data;
    d.fill(0);
    d[0] = ambientR;
    d[1] = ambientG;
    d[2] = ambientB;
    d[3] = floorDark;
    d[5] = floorStart;
    this.n = 0;
    return this;
  }

  /**
   * Add a point light. Returns false when the set is full (16). Add the most important
   * lights first: candles and energised gems before idle ones.
   */
  add(
    x: number,
    y: number,
    radius: number,
    color: ArrayLike<number>,
    intensity: number,
    height: number = LIGHT_HEIGHT.gem,
  ): boolean {
    if (this.n >= lightBudget.max || this.n >= MAX_LIGHTS || intensity <= 0) return false;
    const d = this.data;
    const p = 8 + this.n * 4;
    const c = 8 + MAX_LIGHTS * 4 + this.n * 4;
    d[p] = x;
    d[p + 1] = y;
    d[p + 2] = height;
    d[p + 3] = radius;
    d[c] = color[0]! * intensity;
    d[c + 1] = color[1]! * intensity;
    d[c + 2] = color[2]! * intensity;
    this.n++;
    d[4] = this.n;
    return true;
  }

  /** A warm candle/torch light. Pass the flicker value as `intensity`. */
  addCandle(x: number, y: number, intensity = 1, radius = 700): boolean {
    return this.add(x, y, radius, LINEAR.candle, 1.5 * intensity, LIGHT_HEIGHT.candle);
  }

  /** Upload to a lit material (its uniform block must be the light set). */
  apply(material: Material): void {
    material.setUniforms(this.data);
  }
}
