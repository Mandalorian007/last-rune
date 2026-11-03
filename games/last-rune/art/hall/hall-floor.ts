/**
 * Factory-floor dressing for the machine hall: pipes and cable runs along the wall between the
 * niches, hanging lamps, a junction box, a rail track with a cart of rune ore, crates, barrels,
 * steam vents and puddles. One material (`hall-floor-shaders.ts`), drawn as two batches: the
 * back layer sits on the wall behind the alcoves, the front layer stands on the floor in front of
 * them. Nothing covers an alcove, the HUD, FUSE's caption card or the intake desk.
 *
 * Everything is lit by the hall's light set, so the floor wakes with the machines: lamps brighten
 * with progress, and the puddles mirror lightning and each restored machine's warm glow.
 */
import type { DrawParams, Frame, Material, Renderer } from '@engine/render';
import {
  HALL_FLOOR_UNIFORM_FLOATS,
  HALL_FLOOR_WGSL,
  HallFloorKind as K,
} from '../../shaders/hall-floor-shaders';
import type { LightSet } from '../materials/lights';
import { PROP_LIGHT_FLOATS } from '../props/lighting';

const mats = new WeakMap<Renderer, Material>();
function floorMaterial(r: Renderer): Material {
  let m = mats.get(r);
  if (!m) {
    m = r.createMaterial({
      label: 'hall-floor',
      wgsl: HALL_FLOOR_WGSL,
      blend: 'premultiplied',
      uniformBytes: HALL_FLOOR_UNIFORM_FLOATS * 4,
    });
    mats.set(r, m);
  }
  return m;
}

/** A prop: centre, size, kind and its three parameters. */
type Prop = readonly [
  x: number,
  y: number,
  w: number,
  h: number,
  kind: number,
  a?: number,
  b?: number,
  c?: number,
];

function dp(p: Prop, emissive = 1): DrawParams {
  const [x, y, w, h, kind, a = 0, b = 0, c = 0] = p;
  return { x, y, w, h, params: [kind, a, b, c], emissive };
}

/** Lamp shade centres (design px): the hall adds a warm light under each. */
export const HALL_LAMPS: readonly { x: number; y: number; seed: number }[] = [
  { x: 325, y: 272, seed: 0.1 },
  { x: 832, y: 236, seed: 0.6 },
  { x: 1088, y: 236, seed: 0.35 },
  { x: 1595, y: 272, seed: 0.85 },
];

// Wall layer, drawn before the alcoves (all y in design px, y down).
const BACK: Prop[] = [
  // Two runs along the foot of the wall: a fat iron main and a thin copper line above it.
  [960, 788, 1920, 30, K.pipeH, 8, 160, 0],
  [960, 766, 1920, 22, K.pipeH, 4.5, 240, 1],
  // Risers in the gaps between niches (left one stops below the HUD).
  [44, 512, 46, 560, K.pipeV, 7, 140, 2],
  [577, 396, 30, 780, K.pipeV, 7, 180, 0],
  [1342, 396, 30, 780, K.pipeV, 7, 180, 0],
  [1876, 400, 60, 776, K.pipeV, 7, 140, 4],
  // Cable runs slung across the ceiling between the risers and lamp hooks.
  [180, 22, 300, 60, K.cable, 26, 2, 2.2],
  [451, 22, 252, 54, K.cable, 20, 3, 1.8],
  [704, 22, 254, 50, K.cable, 16, 2, 2.4],
  [960, 22, 256, 74, K.cable, 34, 3, 2],
  [1215, 22, 254, 50, K.cable, 16, 2, 2.4],
  [1468, 22, 252, 54, K.cable, 20, 3, 1.8],
  [1735, 22, 282, 60, K.cable, 26, 2, 2.2],
  // A low run across the open wall under the seal and windows.
  [960, 700, 760, 46, K.cable, 14, 2, 2],
  // Junction boxes on the open wall either side of the seal's foot.
  [826, 724, 40, 56, K.junction, 0.2],
  [1094, 724, 40, 56, K.junction, 0.7],
  // Rails along the floor with a cart of ore parked right of the desk.
  [960, 846, 1920, 28, K.rails, 30],
  [1196, 820, 116, 72, K.cart],
];

/** Index in BACK of the far-right riser (its gauge is dropped on phones). */
const RIGHT_RISER = 5;

// Floor layer, drawn after the machines (in front of the wall, behind candles and FUSE).
const FRONT: Prop[] = [
  [360, 980, 260, 44, K.puddle, 0.3],
  [706, 1012, 170, 32, K.puddle, 0.8],
  [1300, 1062, 320, 36, K.puddle, 0.55],
  [430, 842, 176, 130, K.crates, 0.1],
  [1322, 830, 134, 104, K.barrels, 0.4],
  [577, 790, 96, 200, K.vent, 0.2, 0.9],
  [1595, 790, 96, 200, K.vent, 0.7, 0.8],
];

export class HallFloor {
  private readonly mat: Material;
  private readonly u = new Float32Array(HALL_FLOOR_UNIFORM_FLOATS);
  private readonly back: DrawParams[];
  private readonly front: DrawParams[];
  private readonly lamps: DrawParams[];
  /** The props as designed, matching `back` then `front` (for `layout`). */
  private readonly props: Prop[];

  constructor(r: Renderer) {
    this.mat = floorMaterial(r);
    this.back = BACK.map((p) => dp(p));
    this.front = FRONT.map((p) => dp(p));
    this.props = [...BACK, ...FRONT];
    // Lamps: hook at the ceiling, shade 34 px above the quad's bottom.
    this.lamps = HALL_LAMPS.map((l) => {
      const h = l.y + 34;
      return dp([l.x, h / 2, 64, h, K.lamp, l.seed, 1]);
    });
  }

  /**
   * Upload the shared uniforms for this frame. 'lamp' 0..1 = lamp brightness (dips with
   * lightning); 'motion' 0 freezes steam, sway and ripples (reduced motion).
   */
  update(L: LightSet, time: number, motion: number, warmth: number, lamp: number): void {
    const u = this.u;
    u.set(L.data, 0);
    u[PROP_LIGHT_FLOATS] = time;
    u[PROP_LIGHT_FLOATS + 1] = motion;
    u[PROP_LIGHT_FLOATS + 2] = warmth;
    u[PROP_LIGHT_FLOATS + 3] = lamp;
    this.mat.setUniforms(u);
  }

  /**
   * Phones: the gauge on the far-right riser shrinks to a lone dot at the screen's edge (D-040
   * review), so it goes; the riser stays. Desktop keeps it.
   */
  set edgeGauge(on: boolean) {
    const d = this.back[RIGHT_RISER];
    if (d?.params) (d.params as number[])[3] = on ? 4 : 0;
  }

  /**
   * A phone's widened hall (mobile-5-chrome, `hall-frame.ts`): every prop moves out from the
   * centre line by `spread`, the ceiling cables stretch with their spans, and the runs that cross
   * the whole wall reach `halfWidth` either side of the centre. `spread` 1 is the design.
   */
  layout(spread: number, halfWidth: number): void {
    const cx = 960;
    const all = [...this.back, ...this.front];
    this.props.forEach((p, i) => {
      const d = all[i]!;
      const [x, , w, , kind] = p;
      d.x = cx + (x - cx) * spread;
      if (w >= 1920) d.w = Math.max(w, halfWidth * 2 + 40);
      else if (kind === K.cable && p[1] < 60) d.w = w * spread;
    });
    HALL_LAMPS.forEach((l, i) => {
      this.lamps[i]!.x = cx + (l.x - cx) * spread;
    });
  }

  /** Wall layer: pipes, cables, lamps, junction boxes, rails, cart (one draw call). */
  drawBack(frame: Frame): void {
    for (const d of this.back) frame.sprite(this.mat, d);
    for (const d of this.lamps) frame.sprite(this.mat, d);
  }

  /** Floor layer: puddles, crates, barrels, vents (one draw call). */
  drawFront(frame: Frame): void {
    for (const d of this.front) frame.sprite(this.mat, d);
  }
}
