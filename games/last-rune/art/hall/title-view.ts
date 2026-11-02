/**
 * Title backdrop (pitch screen 1): the name embossed in gold on a storm-lit stone wall, two tall
 * lancet windows with lightning, a storm cell humming in the dark, candles, and FUSE idling by
 * the menu. The menu buttons (and an accessible copy of the title) stay DOM.
 *
 * Shares the hall's baked stone, window material and FUSE rig (per-renderer kit), so going
 * title → hall → title never rebakes or leaks.
 */
import type { DrawParams, Frame, Renderer } from '@engine/render';
import type { TitleView, TitleViewFrame, ViewContext } from '../../scenes/views';
import { HALL_WINDOW_UNIFORM_FLOATS } from '../../shaders/hall-shaders';
import { type CandleInstance, CandleRenderer } from '../materials/candles';
import { EmbossLabel, EmbossRenderer } from '../materials/emboss';
import { LightSet } from '../materials/lights';
import { PROP_LIGHT_FLOATS } from '../props/lighting';
import { pitch } from '../props/palette';
import { StormCell } from '../props/storm';
import { hallKit } from './hall-view';
import { Lightning } from './lightning';

const W = 1920;
const H = 1080;
const FLOOR_Y = 880;
const FUSE_X = 700;
const FUSE_GROUND = 968;
const STORM = { x: 520, y: 690, size: 440 } as const;
const TITLE_Y = 228;
const WINDOWS = [
  { x: 250, y: 420, w: 150, h: 520 },
  { x: 1670, y: 420, w: 150, h: 520 },
] as const;
const COOL: readonly number[] = [0.45, 0.56, 0.95];
const FLASH: readonly number[] = [0.7, 0.8, 1.0];
const GOLD = pitch('gold');

interface TitleKit {
  readonly title: EmbossLabel;
  readonly emboss: EmbossRenderer;
  readonly candles: CandleRenderer;
}
const kits = new WeakMap<Renderer, TitleKit>();

function titleKit(r: Renderer): TitleKit {
  let k = kits.get(r);
  if (!k) {
    k = {
      title: new EmbossLabel(r, {
        text: 'The Last Rune',
        font: "700 150px 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
        width: 1400,
        height: 230,
        tracking: 6,
      }),
      emboss: new EmbossRenderer(),
      candles: new CandleRenderer(r),
    };
    kits.set(r, k);
  }
  return k;
}

function candle(x: number, y: number, height: number, seed: number, melt = 0.5): CandleInstance {
  return { x, y, height, seed, melt, radius: 700 };
}

export class StormTitleView implements TitleView {
  /** The title is drawn in the canvas; the scene keeps its DOM heading for screen readers only. */
  readonly drawsTitle = true;
  private readonly hall;
  private readonly kit: TitleKit;
  private readonly storm: StormCell;
  private readonly lights = new LightSet();
  private readonly lightning = new Lightning(WINDOWS.length, 2.2);
  private readonly windowU = new Float32Array(HALL_WINDOW_UNIFORM_FLOATS);
  private readonly windowDp: { dp: DrawParams; params: Float32Array }[];
  private time = 0;
  private knockAt = -10;
  private readonly lit: CandleInstance[] = [
    candle(150, 1040, 230, 11, 0.6),
    candle(1780, 1040, 250, 12, 0.4),
  ];
  private readonly all: CandleInstance[] = [
    ...this.lit,
    candle(236, 1056, 140, 13, 0.8),
    candle(1690, 1058, 150, 14, 0.7),
    candle(1250, 950, 90, 15, 0.5),
  ];

  constructor(private readonly vc: ViewContext) {
    const r = vc.renderer;
    this.hall = hallKit(r);
    this.kit = titleKit(r);
    this.storm = new StormCell(r, { x: STORM.x, y: STORM.y, size: STORM.size, strength: 2 });
    this.storm.intensity = 0.85;
    this.windowDp = WINDOWS.map((w, i) => {
      const params = new Float32Array([0, 11.3 + i * 4.7, 0, 0]);
      return { dp: { x: w.x, y: w.y, w: w.w, h: w.h, params, emissive: 1.3 }, params };
    });
    const fuse = this.hall.fuse;
    fuse.scale = 92;
    fuse.place(FUSE_X, FUSE_GROUND);
    fuse.rollTo(FUSE_X);
    fuse.facing = -1;
    fuse.mood = 'idle';
    this.lightning.onStrike = (near) => {
      vc.cue?.(near ? 'thunderNear' : 'thunder');
      this.storm.surge(near ? 0.8 : 0.4);
    };
  }

  knock(): void {
    this.knockAt = this.time;
    this.storm.surge(1);
    this.lightning.strike();
  }

  update(dt: number, s: TitleViewFrame): void {
    this.time += dt;
    const calm = s.reduceFlashes ?? s.reducedMotion;
    const lt = this.lightning;
    lt.reduceFlashes = calm;
    lt.level = 0.55;
    lt.update(dt);
    const storm = this.storm;
    storm.reduceFlashes = calm;
    storm.update(dt);
    const fuse = this.hall.fuse;
    // FUSE watches the storm; after the knock he leans in toward it.
    const since = this.time - this.knockAt;
    const sph = storm.sphere;
    fuse.lookAt(since < 6 ? sph.x : sph.x + 260, sph.y);
    if (s.speaking) fuse.speak(0.3);
    fuse.update(dt);
    const k = this.kit.candles;
    k.reducedMotion = s.reducedMotion;
    k.update(this.all, this.time);
  }

  render(frame: Frame, s: TitleViewFrame): void {
    void s;
    const hall = this.hall;
    const kit = this.kit;
    const L = this.buildLights();
    hall.wall.light(L);
    hall.floor.light(L);
    kit.candles.light(L);
    kit.emboss.light(L);

    frame.clear(0, 0, 0, 1);
    hall.wall.draw(frame, W / 2, H / 2, W, H, undefined, 1, 0.07);
    hall.floor.draw(frame, W / 2, (FLOOR_Y + H) / 2, W, H - FLOOR_Y, undefined, 1, 0.16);
    this.drawWindows(frame, L);
    kit.emboss.draw(frame, kit.title, W / 2, TITLE_Y, { shine: 1.2, glow: 0.6 });
    this.storm.draw(frame, L);
    kit.candles.drawBodies(frame, this.all);
    kit.candles.drawFlames(frame, this.all);
    hall.fuse.draw(frame, L);
    frame.drawable(this.vc.particles);
  }

  dispose(): void {
    this.lightning.onStrike = null;
    this.storm.destroy();
  }

  private buildLights(): LightSet {
    const L = this.lights;
    const lt = this.lightning;
    L.begin(0.065, 0.066, 0.09, 0.55, 0.82);
    for (let i = 0; i < WINDOWS.length; i++) {
      const win = WINDOWS[i]!;
      L.add(win.x, win.y, 900, COOL, 0.3, 260);
      if (lt.flash > 0.001) {
        L.add(win.x, win.y + 80, 1300, FLASH, lt.flash * (lt.window === i ? 2.4 : 1), 320);
      }
    }
    const sl = this.storm.light;
    L.add(sl.x, sl.y, 900, sl.color, sl.intensity * 1.1, 200);
    // A low gold wash across the title so the emboss reads even between strikes.
    L.add(W / 2, TITLE_Y + 200, 900, GOLD, 0.55, 260);
    this.kit.candles.addLights(L, this.lit);
    return L;
  }

  private drawWindows(frame: Frame, L: LightSet): void {
    const u = this.windowU;
    u.set(L.data, 0);
    u[PROP_LIGHT_FLOATS] = this.time;
    u[PROP_LIGHT_FLOATS + 1] = 0.55;
    u[PROP_LIGHT_FLOATS + 2] = this.lightning.reduceFlashes ? 1 : 0;
    const mat = this.hall.windowMat;
    mat.setUniforms(u);
    const lt = this.lightning;
    for (let i = 0; i < this.windowDp.length; i++) {
      const wd = this.windowDp[i]!;
      const struck = lt.window === i;
      wd.params[0] = lt.flash * (struck ? 1 : 0.45);
      wd.params[2] = lt.boltX * (WINDOWS[i]!.w * 0.3);
      wd.params[3] = struck ? lt.bolt : 0;
      frame.sprite(mat, wd.dp);
    }
  }
}

export const stormTitleView = (vc: ViewContext): TitleView => new StormTitleView(vc);
