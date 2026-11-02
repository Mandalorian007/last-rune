/**
 * DeskArt: the GPU half of the journal desk (and the ending's clipboard/paper).
 * One candle-lit `LightSet` shared by the desk, paper and prop materials, plus
 * the candle itself and an additive glow. No per-frame allocation: callers pass
 * numbers, this reuses one DrawParams.
 *
 *   art.beginLights(time)            // candle flicker + light set
 *   art.desk(frame)                  // full-screen wood
 *   art.shadow(frame, x, y, w, h, blur, alpha)
 *   art.paper(frame, x, y, w, h, rot, seed, kind, glow, ruled)
 *   art.prop(frame, mode, x, y, w, h, rot, seed)
 *   art.candleBody(frame) … art.candleFlame(frame)
 */
import type { DrawParams, Frame, Material, Renderer, RGBA } from '@engine/render';
import { type CandleInstance, CandleRenderer } from '../../art/materials/candles';
import { LIGHT_SET_FLOATS, LightSet } from '../../art/materials/lights';
import { GLOW_WGSL } from '../../shaders/candle-wgsl';
import { DESK_WGSL, PAPER_WGSL, PROP, PROPS_WGSL } from './desk-wgsl';

/** Candlelight on paper: warm, but whiter than the hall's torch orange so parchment reads cream. */
const CANDLE_LIGHT: RGBA = [1.0, 0.66, 0.38, 1];

export class DeskArt {
  readonly lights = new LightSet();
  readonly candles: CandleRenderer;
  /** The one candle. Move it with `placeCandle`. */
  readonly candleList: CandleInstance[] = [{ x: 572, y: 470, height: 170, seed: 3.7, melt: 0.7 }];
  private readonly deskMat: Material;
  private readonly paperMat: Material;
  private readonly propMat: Material;
  private readonly glowMat: Material;
  private readonly dp: DrawParams = { x: 0, y: 0, params: [0, 0, 0, 0] };
  private readonly tint: RGBA = [1, 1, 1, 1];
  private readonly pt = { x: 0, y: 0 };
  private readonly extraCol = [0, 0, 0, 1];
  /** Extra warm light (e.g. the ending's gold) added after the candle; 0 = none. */
  extraLight = { x: 0, y: 0, radius: 0, r: 0, g: 0, b: 0, intensity: 0, height: 200 };
  candleOn = true;

  constructor(renderer: Renderer) {
    const uniformBytes = LIGHT_SET_FLOATS * 4;
    this.deskMat = renderer.createMaterial({
      label: 'journal-desk',
      wgsl: DESK_WGSL,
      uniformBytes,
    });
    this.paperMat = renderer.createMaterial({
      label: 'journal-paper',
      wgsl: PAPER_WGSL,
      blend: 'alpha',
      uniformBytes,
    });
    this.propMat = renderer.createMaterial({
      label: 'journal-props',
      wgsl: PROPS_WGSL,
      blend: 'alpha',
      uniformBytes,
    });
    this.glowMat = renderer.createMaterial({
      label: 'journal-glow',
      wgsl: GLOW_WGSL,
      blend: 'additive',
    });
    this.candles = new CandleRenderer(renderer);
  }

  set reducedMotion(v: boolean) {
    this.candles.reducedMotion = v;
  }

  placeCandle(x: number, y: number, height = 170): void {
    const c = this.candleList[0]!;
    c.x = x;
    c.y = y;
    c.height = height;
  }

  /** Candle flame position (for halos/DOM effects). */
  flame(): { x: number; y: number } {
    return this.candles.flamePos(this.candleList[0]!, this.pt);
  }

  /** Flicker the candle and rebuild the light set; apply it to every lit material. */
  beginLights(time: number, ambient = 1): void {
    const l = this.lights;
    l.begin(0.045 * ambient, 0.04 * ambient, 0.042 * ambient, 0.0, 1.0);
    if (this.candleOn) {
      this.candles.update(this.candleList, time);
      const c = this.candleList[0]!;
      this.candles.flamePos(c, this.pt);
      const f = c.flicker ?? 1;
      l.add(this.pt.x, this.pt.y - 10, 1500, CANDLE_LIGHT, 1.25 * f, 260);
      // A softer bounce so the far side of the desk is not black.
      l.add(1300, 520, 1300, CANDLE_LIGHT, 0.3 * f, 900);
    }
    const e = this.extraLight;
    if (e.intensity > 0) {
      const c = this.extraCol;
      c[0] = e.r;
      c[1] = e.g;
      c[2] = e.b;
      l.add(e.x, e.y, e.radius, c, e.intensity, e.height);
    }
    l.apply(this.deskMat);
    l.apply(this.paperMat);
    l.apply(this.propMat);
    this.candles.light(l);
  }

  desk(frame: Frame, vignette = 0.75): void {
    const dp = this.dp;
    const p = dp.params as number[];
    dp.x = 960;
    dp.y = 540;
    dp.w = 1920;
    dp.h = 1080;
    dp.rotation = 0;
    dp.tint = undefined;
    dp.emissive = 0;
    p[0] = vignette;
    p[1] = 0;
    p[2] = 0;
    p[3] = 0;
    frame.sprite(this.deskMat, dp);
  }

  /** Soft rounded-rect contact shadow centred at (x, y). */
  shadow(
    frame: Frame,
    x: number,
    y: number,
    w: number,
    h: number,
    blur: number,
    alpha: number,
    rot = 0,
  ): void {
    const dp = this.dp;
    const p = dp.params as number[];
    const t = this.tint;
    t[0] = 0.01;
    t[1] = 0.005;
    t[2] = 0.0;
    t[3] = alpha;
    dp.tint = t;
    dp.x = x;
    dp.y = y;
    dp.w = w + blur * 2;
    dp.h = h + blur * 2;
    dp.rotation = rot;
    dp.emissive = 0;
    p[0] = 0;
    p[1] = PROP.shadow;
    p[2] = blur;
    p[3] = 0;
    frame.sprite(this.propMat, dp);
  }

  paper(
    frame: Frame,
    x: number,
    y: number,
    w: number,
    h: number,
    rot: number,
    seed: number,
    kind: number,
    glow = 0,
    ruled = false,
    alpha = 1,
  ): void {
    const dp = this.dp;
    const p = dp.params as number[];
    const t = this.tint;
    t[0] = 1;
    t[1] = 1;
    t[2] = 1;
    t[3] = alpha;
    dp.tint = t;
    dp.x = x;
    dp.y = y;
    dp.w = w;
    dp.h = h;
    dp.rotation = rot;
    dp.emissive = 0;
    p[0] = seed;
    p[1] = kind;
    p[2] = glow;
    p[3] = ruled ? 1 : 0;
    frame.sprite(this.paperMat, dp);
  }

  prop(
    frame: Frame,
    mode: number,
    x: number,
    y: number,
    w: number,
    h: number,
    rot = 0,
    seed = 0,
    alpha = 1,
  ): void {
    const dp = this.dp;
    const p = dp.params as number[];
    const t = this.tint;
    t[0] = 1;
    t[1] = 1;
    t[2] = 1;
    t[3] = alpha;
    dp.tint = t;
    dp.x = x;
    dp.y = y;
    dp.w = w;
    dp.h = h;
    dp.rotation = rot;
    dp.emissive = 0;
    p[0] = seed;
    p[1] = mode;
    p[2] = 0;
    p[3] = 0;
    frame.sprite(this.propMat, dp);
  }

  /** Additive glow; (r, g, b) linear × intensity. `surface` = colour only, no bloom. */
  glow(
    frame: Frame,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    emissive = 0.5,
    surface = false,
  ): void {
    const dp = this.dp;
    const p = dp.params as number[];
    const t = this.tint;
    t[0] = r;
    t[1] = g;
    t[2] = b;
    t[3] = 1;
    dp.tint = t;
    dp.x = x;
    dp.y = y;
    dp.w = w;
    dp.h = h;
    dp.rotation = 0;
    dp.emissive = emissive;
    p[0] = 3;
    p[1] = surface ? 1 : 0;
    p[2] = 0;
    p[3] = 0;
    frame.sprite(this.glowMat, dp);
  }

  /** Candle body plus the pool of light on the desk around its dish. */
  candleBody(frame: Frame): void {
    if (!this.candleOn) return;
    const c = this.candleList[0]!;
    this.glow(frame, c.x, c.y - 10, 420, 220, 0.5, 0.24, 0.07, 0, true);
    this.candles.drawBodies(frame, this.candleList);
  }

  /** Flame and halo (draw last, above everything on the desk). */
  candleFlame(frame: Frame): void {
    if (!this.candleOn) return;
    this.candles.drawFlames(frame, this.candleList);
  }

  destroy(): void {
    this.deskMat.destroy();
    this.paperMat.destroy();
    this.propMat.destroy();
    this.glowMat.destroy();
    this.candles.destroy();
  }
}
