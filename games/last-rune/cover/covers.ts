/**
 * The itch cover (D-043 addendum 1): #8 of the ws/cover-art candidates, "fuse-portrait". FUSE by
 * candlelight with his eye on a glowing Amplify gem, under the gold title and the tagline. A
 * still life built from the game's own props and lit the way the game lights them. See stage.ts
 * for how the cover is framed and titled. `pnpm cover` renders it to build/.
 */
import { hallKit } from '../art/hall/hall-view';
import type { CandleInstance } from '../art/materials/candles';
import { addGemLight, type GemInstance, GemRenderer } from '../art/materials/gems';
import { LightSet } from '../art/materials/lights';
import { POST_PRESETS } from '../art/materials/post-presets';
import { Fuse } from '../art/props/fuse';
import { PropLightRig } from '../art/props/lighting';
import { pitch } from '../art/props/palette';
import type { CoverContext, CoverDef, CoverScene } from './stage';

const WARM = pitch('warm');
const GOLD = pitch('gold');
const AMBER = pitch('amber', 1.8) as unknown as number[];

const GEM: GemInstance = {
  kind: 'amplify',
  x: 760,
  y: 720,
  size: 170,
  state: 'placed',
  rot: 0,
  glow: 1.2,
  lift: 0,
  seed: 9,
};

function candle(x: number, y: number, height: number, seed: number, melt: number): CandleInstance {
  return { x, y, height, seed, melt, radius: 700 };
}

const CANDLES: CandleInstance[] = [
  candle(560, 1040, 240, 41, 0.5),
  candle(1380, 1045, 180, 42, 0.7),
  candle(1300, 1060, 110, 43, 0.8),
];

const FUSE = { x: 1080, y: 1040, scale: 230, look: { x: 760, y: 720 } } as const;
const FLOOR_Y = 900;
const AMBIENT = [0.05, 0.05, 0.075] as const;
/** An amber wash around the gem, so FUSE's face catches its light. */
const WASH = { x: 760, y: 720, r: 700, c: AMBER, k: 0.3 } as const;

/**
 * The still life on the hall's stone: the gem, three candles and FUSE facing left at the gem,
 * lit with LightSet (stone and gem) and the prop rig (FUSE and the candles).
 */
function fusePortrait(ctx: CoverContext): CoverScene {
  const r = ctx.renderer;
  const kit = hallKit(r);
  const gems = new GemRenderer(r);
  const L = new LightSet();
  const rig = new PropLightRig();
  const fuse = new Fuse(r, { x: FUSE.x, y: FUSE.y, scale: FUSE.scale });
  fuse.facing = -1;
  fuse.mood = 'idle';
  fuse.lookAt(FUSE.look.x, FUSE.look.y);
  const gemList = [GEM];
  let time = 0;
  return {
    update(dt) {
      time += dt;
      fuse.update(dt);
      fuse.lookAt(FUSE.look.x, FUSE.look.y);
      kit.candles.reducedMotion = true;
      kit.candles.update(CANDLES, time);
    },
    draw(frame) {
      L.begin(AMBIENT[0], AMBIENT[1], AMBIENT[2], 0.5, 0.75);
      kit.candles.addLights(L, CANDLES);
      L.add(WASH.x, WASH.y, WASH.r, WASH.c, WASH.k, 200);
      addGemLight(L, GEM, 1);
      kit.wall.light(L);
      kit.floor.light(L);
      kit.candles.light(L);
      gems.light(L);

      const R = rig.begin(0.18, 0.19, 0.26);
      for (const c of CANDLES.slice(0, 2)) R.add(c.x, c.y - c.height, 1300, WARM, 1.3, 260);
      R.add(fuse.eye.x, fuse.eye.y, 380, fuse.eye.color, fuse.eye.intensity, 40);
      R.add(GEM.x, GEM.y, 900, GOLD, 0.9, 120);

      frame.clear(0, 0, 0, 1);
      kit.wall.draw(frame, 960, 540, 1920, 1080, undefined, 1, 0.07);
      kit.floor.draw(frame, 960, (FLOOR_Y + 1080) / 2, 1920, 1080 - FLOOR_Y, undefined, 1, 0.16);
      kit.candles.drawBodies(frame, CANDLES);
      gems.drawUnder(frame, gemList);
      gems.drawGems(frame, gemList);
      kit.candles.drawFlames(frame, CANDLES);
      fuse.draw(frame, R);
      frame.drawable(ctx.particles);
    },
  };
}

export const COVER: CoverDef = {
  id: 'fuse-portrait',
  pitch: 'FUSE by candlelight, eye on a glowing gem: the friendly face of the puzzle',
  post: { ...POST_PRESETS.hall, godRays: { enabled: false } },
  shot: { cx: 960, cy: 700, width: 900 },
  title: { x: 315, y: 66, width: 540 },
  tagline: { text: 'A gem-circuit puzzle', x: 315, y: 128, size: 15 },
  create: fusePortrait,
};
