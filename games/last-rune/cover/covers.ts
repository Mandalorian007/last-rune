/**
 * The eight itch cover candidates (D-043). Each reuses the game's own views and props: the
 * title wall, the altar mid-strike, the restored hall, FUSE, the storm cell, a gem. See stage.ts
 * for how a cover is framed and titled.
 */
import type { Frame } from '@thunderclap/engine/render';
import { CathedralHallView, hallKit } from '../art/hall/hall-view';
import { StormTitleView } from '../art/hall/title-view';
import type { CandleInstance } from '../art/materials/candles';
import { addGemLight, type GemInstance, GemRenderer } from '../art/materials/gems';
import { LightSet } from '../art/materials/lights';
import { POST_PRESETS } from '../art/materials/post-presets';
import { BoltRibbon, boltSegmentsFromPolyline } from '../art/props/bolt';
import { Fuse } from '../art/props/fuse';
import { PropLightRig } from '../art/props/lighting';
import { pitch } from '../art/props/palette';
import { StormCell } from '../art/props/storm';
import { MACHINES } from '../content/machines';
import { PUZZLES } from '../content/puzzles';
import type { GameCtx } from '../game/ctx';
import { simulate } from '../rules';
import type { MachineId } from '../rules/types';
import { OUT_GLOW } from '../scenes/altar/altar-defs';
import { AltarView } from '../scenes/altar/altar-view';
import { BoardState } from '../scenes/altar/board';
import { previewPath } from '../scenes/altar/circuit-model';
import { buildTimeline } from '../scenes/altar/strike';
import { deriveHall } from '../scenes/hall/hall-state';
import type { HallViewFrame, TitleViewFrame } from '../scenes/views';
import type { CoverContext, CoverDef, CoverScene, Shot } from './stage';

const DESIGN = { width: 1920, height: 1080 } as const;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// ─── Scenes from the game's views ───────────────────────────────────────────

/** The title screen: stone wall, lancet windows, the storm cell, candles, FUSE and the name. */
function titleWall(ctx: CoverContext): CoverScene {
  const view = new StormTitleView({ ...ctx, ...DESIGN });
  const s: Mutable<TitleViewFrame> = { time: 0, reducedMotion: true, returning: false };
  return {
    update(dt) {
      s.time += dt;
      view.update(dt, s);
    },
    draw(frame: Frame) {
      view.render(frame, s);
    },
  };
}

/** The cathedral hall with every machine restored: all doors lit, the rune seal whole. */
function restoredHall(ctx: CoverContext): CoverScene {
  const view = new CathedralHallView({ ...ctx, ...DESIGN });
  const model = deriveHall({ solved: MACHINES.map((m) => m.id) });
  const s: Mutable<HallViewFrame> = {
    time: 0,
    reducedMotion: true,
    model,
    hover: null,
    focus: null,
  };
  return {
    update(dt) {
      s.time += dt;
      view.update(dt, s);
    },
    draw(frame) {
      view.render(frame, s);
    },
  };
}

interface AltarOpts {
  /** Bolt brightness (the game's 1 blooms out the gems at cover size). */
  boltIntensity?: number;
  /** How lit a gem the bolt reaches is (0..1; past 0.45 it reads as energised). */
  gemEnergy?: number;
  /** Send FUSE off-stage (he would stand under a bottom title). */
  hideFuse?: boolean;
  /** Frame the shot from the layout: the slab's cells `[x0..x1] × [y0..y1]`, plus padding. */
  frame?: (v: AltarView) => Shot;
}

/**
 * The altar of `machine` with its intended solution placed and struck: the bolt runs from the
 * storm cell through the gems and wakes the machines, the gold route drawn under it.
 */
function struckAltar(ctx: CoverContext, machine: MachineId, opts: AltarOpts = {}): CoverScene {
  const puzzle = PUZZLES[machine];
  const fake = {
    renderer: ctx.renderer,
    particles: ctx.particles,
    device: { phone: false, cssPx: 1, bar: 0 },
    chrome: null,
  } as unknown as GameCtx;
  const view = new AltarView(fake, puzzle);
  for (const t of view.tray) t.size = 0;
  view.reducedMotion = true;
  if (opts.hideFuse) view.assets.fuse.place(-2000, 1046);
  const board = new BoardState(puzzle);
  board.restore(puzzle.design.intended);
  view.syncBoard(board);
  const placements = board.serialise();
  const result = simulate(puzzle, placements);
  // The route the game draws while editing: gold wire between the gems.
  const pv = previewPath(puzzle, placements, result);
  view.faceAlong(pv.hops, true);
  view.preview = pv.hops;
  view.previewTarget = 1;
  for (let i = 0; i < view.machineLinked.length; i++) view.machineLinked[i] = true;
  const tl = buildTimeline(result, { tickSeconds: 0.12 });
  view.orientAlong(tl);
  const last = tl.pulses.length - 1;
  const bolt = view.bolts[last] ?? view.bolts[0]!;
  bolt.play(view.boltSegments(tl, last, []), 'exact');
  bolt.intensity = opts.boltIntensity ?? 0.35;
  view.setActiveBolts(last + 1);
  view.storm.surge(1);
  view.stormGlow = 1;
  view.energyGlow = 0.25;
  let t = 0;
  let next = 0;
  const start = tl.pulses[last]!.start;
  return {
    shot: opts.frame?.(view),
    update(dt) {
      t += dt;
      while (next < tl.arrivals.length && tl.arrivals[next]!.t - start <= t) {
        const a = tl.arrivals[next++]!;
        if (a.end === 'machine' && a.machine >= 0) {
          view.machines[a.machine]!.solve();
          view.machineGlow[a.machine] = 1;
          const c = view.machineColor[a.machine]!;
          for (let k = 0; k < 4; k++) c[k] = OUT_GLOW.exact[k]!;
        } else {
          // Lit, not white-hot: the glyph and colour must still read at thumbnail size.
          const b = view.gemAt(a.cell);
          if (b) b.energyTarget = opts.gemEnergy ?? 0;
        }
      }
      view.stormGlow = Math.max(view.stormGlow, 0.8);
      for (let i = 0; i < view.machineGlow.length; i++) {
        if (view.machines[i]!.gauge > 0.5) view.machineGlow[i] = 1;
      }
      view.update(dt);
    },
    draw(frame) {
      view.render(frame);
    },
  };
}

// ─── Scenes composed from props ─────────────────────────────────────────────

const WARM = pitch('warm');
const GOLD = pitch('gold');

function candle(x: number, y: number, height: number, seed: number, melt = 0.5): CandleInstance {
  return { x, y, height, seed, melt, radius: 700 };
}

interface StillLifeOpts {
  gems: GemInstance[];
  candles: CandleInstance[];
  /** Bolt path(s) as polylines; each gets its own colour per hop and charge. */
  bolts?: { points: { x: number; y: number }[]; colours: number[][]; charges: number[] }[];
  storm?: { x: number; y: number; size: number };
  fuse?: { x: number; y: number; scale: number; facing: 1 | -1; look: { x: number; y: number } };
  ambient?: [number, number, number];
  /** Extra coloured wash lights: x, y, radius, colour, intensity. */
  wash?: { x: number; y: number; r: number; c: ArrayLike<number>; k: number }[];
  floorY?: number;
  boltIntensity?: number;
}

/**
 * A still life on the hall's stone: gems, candles, optionally the storm cell, FUSE and a
 * bolt, lit the way the game lights them (LightSet for stone and gems, the prop rig for props).
 */
function stillLife(ctx: CoverContext, o: StillLifeOpts): CoverScene {
  const r = ctx.renderer;
  const kit = hallKit(r);
  const gems = new GemRenderer(r);
  const L = new LightSet();
  const rig = new PropLightRig();
  const storm = o.storm ? new StormCell(r, { ...o.storm, strength: 2 }) : null;
  const fuse = o.fuse ? new Fuse(r, { x: o.fuse.x, y: o.fuse.y, scale: o.fuse.scale }) : null;
  if (fuse && o.fuse) {
    fuse.facing = o.fuse.facing;
    fuse.mood = 'idle';
    fuse.lookAt(o.fuse.look.x, o.fuse.look.y);
  }
  const ribbons = (o.bolts ?? []).map((b) => {
    const rb = new BoltRibbon(r, { particles: ctx.particles });
    rb.play(
      boltSegmentsFromPolyline(b.points, { colours: b.colours, charges: b.charges, speed: 1800 }),
      'exact',
    );
    rb.intensity = o.boltIntensity ?? 0.55;
    return rb;
  });
  storm?.surge(1);
  const floorY = o.floorY ?? 880;
  let time = 0;
  return {
    update(dt) {
      time += dt;
      storm?.update(dt);
      fuse?.update(dt);
      if (fuse && o.fuse) fuse.lookAt(o.fuse.look.x, o.fuse.look.y);
      for (const b of ribbons) b.update(dt);
      kit.candles.reducedMotion = true;
      kit.candles.update(o.candles, time);
    },
    draw(frame) {
      const a = o.ambient ?? [0.05, 0.05, 0.075];
      L.begin(a[0], a[1], a[2], 0.5, 0.75);
      kit.candles.addLights(L, o.candles);
      for (const w of o.wash ?? []) L.add(w.x, w.y, w.r, w.c, w.k, 200);
      if (storm)
        L.add(
          storm.light.x,
          storm.light.y,
          900,
          storm.light.color,
          storm.light.intensity * 0.8,
          160,
        );
      for (const g of o.gems) addGemLight(L, g, 1);
      for (const b of ribbons) {
        if (b.head) L.add(b.head.x, b.head.y, 500, b.head.colour, 0.9, 80);
      }
      kit.wall.light(L);
      kit.floor.light(L);
      kit.candles.light(L);
      gems.light(L);

      const R = rig.begin(0.18, 0.19, 0.26);
      for (const c of o.candles.slice(0, 2)) R.add(c.x, c.y - c.height, 1300, WARM, 1.3, 260);
      if (storm)
        R.add(
          storm.light.x,
          storm.light.y,
          1100,
          storm.light.color,
          0.9 * storm.light.intensity,
          200,
        );
      if (fuse) R.add(fuse.eye.x, fuse.eye.y, 380, fuse.eye.color, fuse.eye.intensity, 40);
      const g0 = o.gems[0];
      if (g0) R.add(g0.x, g0.y, 900, GOLD, 0.9, 120);

      frame.clear(0, 0, 0, 1);
      kit.wall.draw(frame, 960, 540, 1920, 1080, undefined, 1, 0.07);
      kit.floor.draw(frame, 960, (floorY + 1080) / 2, 1920, 1080 - floorY, undefined, 1, 0.16);
      kit.candles.drawBodies(frame, o.candles);
      storm?.draw(frame, R);
      gems.drawUnder(frame, o.gems);
      gems.drawGems(frame, o.gems);
      for (const b of ribbons) b.draw(frame);
      kit.candles.drawFlames(frame, o.candles);
      fuse?.draw(frame, R);
      frame.drawable(ctx.particles);
    },
  };
}

function gem(
  kind: GemInstance['kind'],
  x: number,
  y: number,
  size: number,
  rot = 1,
  seed = 1,
): GemInstance {
  return { kind, x, y, size, state: 'placed', rot, glow: 1.2, lift: 0, seed };
}

const CYAN = pitch('cyan', 1.6) as unknown as number[];
const AMBER = pitch('amber', 1.8) as unknown as number[];
const AMETHYST = pitch('amethyst', 1.6) as unknown as number[];

// ─── The eight ──────────────────────────────────────────────────────────────

export const COVERS: readonly CoverDef[] = [
  {
    id: 'title-wall',
    pitch: 'The title wall: the gold name over the storm cell, FUSE and the candles',
    post: { ...POST_PRESETS.title },
    shot: { cx: 960, cy: 560, width: 1250 },
    tagline: { text: 'A gem-circuit puzzle', x: 315, y: 134, size: 19 },
    create: titleWall,
  },
  {
    id: 'altar-bolt',
    pitch: 'Mid-solve: the bolt runs from the storm cell through lit gems to every gauge',
    post: { ...POST_PRESETS.altar },
    title: { x: 315, y: 62, width: 520 },
    warmup: 2.5,
    create: (ctx) =>
      struckAltar(ctx, 'storm-cell-2', {
        frame: (v) => {
          const L = v.layout;
          return { cx: L.cx + 20, cy: L.cy - 10, width: 1230 };
        },
      }),
  },
  {
    id: 'fuse-storm',
    pitch: 'FUSE squares up to the storm cell: a little robot, a caged bolt, cold blue light',
    post: { ...POST_PRESETS.title, grade: { ...POST_PRESETS.title.grade, gain: [0.95, 1, 1.08] } },
    shot: { cx: 640, cy: 735, width: 880 },
    title: { x: 315, y: 64, width: 540 },
    create: titleWall,
  },
  {
    id: 'restored-hall',
    pitch: 'The hall restored: every door lit and the rune seal whole, in gold candlelight',
    // Less floor mist than the game's hall, so the name at the foot of the frame stays crisp.
    post: { ...POST_PRESETS.hall, fog: { ...POST_PRESETS.hall.fog, density: 0.3 } },
    shot: { cx: 960, cy: 600, width: 1360 },
    title: { x: 315, y: 466, width: 520, halo: 0.85 },
    create: restoredHall,
  },
  {
    id: 'last-altar',
    pitch: 'The last altar: the biggest board, wired end to end and struck',
    post: { ...POST_PRESETS.altar },
    title: { x: 315, y: 446, width: 520 },
    warmup: 4,
    create: (ctx) =>
      struckAltar(ctx, 'the-last-rune', {
        boltIntensity: 0.3,
        hideFuse: true,
        frame: (v) => {
          const L = v.layout;
          return { cx: L.cx, cy: L.cy + 40, width: 1500 };
        },
      }),
  },
  {
    id: 'one-gem',
    pitch: 'One rune gem: an amber Amplify takes the bolt in and throws it out doubled',
    post: { ...POST_PRESETS.altar, godRays: { enabled: false } },
    shot: { cx: 960, cy: 600, width: 1000 },
    title: { x: 315, y: 70, width: 540 },
    create: (ctx) =>
      stillLife(ctx, {
        gems: [gem('amplify', 960, 640, 300, 1, 7)],
        candles: [
          candle(560, 1010, 260, 21, 0.4),
          candle(1380, 1015, 220, 22, 0.6),
          candle(650, 1040, 130, 23, 0.8),
        ],
        bolts: [
          {
            points: [
              { x: 300, y: 640 },
              { x: 960, y: 640 },
              { x: 1700, y: 640 },
            ],
            colours: [CYAN, AMBER],
            charges: [1, 2],
          },
        ],
        wash: [{ x: 960, y: 640, r: 900, c: AMBER, k: 0.35 }],
      }),
  },
  {
    id: 'storm-chain',
    pitch: 'The storm cell fires: the bolt runs a Channel, then two Bends, in storm blue',
    post: {
      ...POST_PRESETS.title,
      grade: { ...POST_PRESETS.title.grade, gain: [0.92, 0.99, 1.1] },
      godRays: { enabled: true, x: 520, y: 560, intensity: 0.35 },
    },
    shot: { cx: 900, cy: 560, width: 1150 },
    title: { x: 315, y: 440, width: 540 },
    create: (ctx) =>
      stillLife(ctx, {
        storm: { x: 520, y: 520, size: 520 },
        gems: [
          gem('channel', 900, 520, 150, 1, 3),
          gem('bend', 1180, 520, 150, 2, 4),
          gem('bend', 1180, 760, 150, 0, 5),
        ],
        candles: [candle(1420, 1040, 200, 31, 0.5), candle(260, 1050, 150, 32, 0.7)],
        bolts: [
          {
            points: [
              { x: 640, y: 520 },
              { x: 900, y: 520 },
              { x: 1180, y: 520 },
              { x: 1180, y: 760 },
              { x: 1420, y: 760 },
            ],
            colours: [CYAN, CYAN, AMETHYST, AMETHYST],
            charges: [1, 1, 1, 1],
          },
        ],
        ambient: [0.04, 0.05, 0.09],
        boltIntensity: 0.4,
      }),
  },
  {
    id: 'fuse-portrait',
    pitch: 'FUSE by candlelight, eye on a glowing gem: the friendly face of the puzzle',
    post: { ...POST_PRESETS.hall, godRays: { enabled: false } },
    shot: { cx: 960, cy: 700, width: 900 },
    title: { x: 315, y: 66, width: 540 },
    tagline: { text: 'A gem-circuit puzzle', x: 315, y: 128, size: 15 },
    create: (ctx) =>
      stillLife(ctx, {
        gems: [gem('amplify', 760, 720, 170, 0, 9)],
        candles: [
          candle(560, 1040, 240, 41, 0.5),
          candle(1380, 1045, 180, 42, 0.7),
          candle(1300, 1060, 110, 43, 0.8),
        ],
        fuse: { x: 1080, y: 1040, scale: 230, facing: -1, look: { x: 760, y: 720 } },
        wash: [{ x: 760, y: 720, r: 700, c: AMBER, k: 0.3 }],
        floorY: 900,
      }),
  },
];
