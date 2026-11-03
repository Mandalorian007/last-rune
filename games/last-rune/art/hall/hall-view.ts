/**
 * The machine hall (pitch screen 2), drawn with the real art kits.
 *
 * A tall storm-lit wall: three tiers of `Alcove` niches, each holding its own machine (a furnace,
 * a relay mast, a crane...: see `hall-machine-shaders.ts`), two lancet windows with lightning flanking the Last Rune's great round seal, a
 * flagstone floor with candles, cyan conduits carved between what you've woken, and FUSE rolling
 * along the floor to whatever you're looking at.
 *
 * Mood follows progress: the storm outside darkens and strikes more often, while every restored
 * machine adds warm light inside, so the hall gets darker outside and warmer within.
 *
 * Draw calls (one batch each): wall, floor, floor props (wall layer), conduits, windows, seal,
 * alcoves, machines, fx, floor props (floor layer), candle bodies, candle halos, candle flames,
 * FUSE, particles. The floor props (`hall-floor.ts`) are pipes, cables, lamps, rails, a cart,
 * crates, barrels, steam vents and puddles.
 */
import type { DrawParams, Frame, Material, Renderer } from '@engine/render';
import { MACHINES } from '../../content/machines';
import {
  capabilityFromKey,
  capabilityKey,
  type MachineDef,
  type SocketColour,
  socketColour,
} from '../../rules/progression';
import type { MachineId } from '../../rules/types';
import type { AlcoveModel, AlcoveStatus, HallModel } from '../../scenes/hall/hall-state';
import type { HallView, HallViewFrame, ViewContext } from '../../scenes/views';
import {
  HALL_MACHINE_KINDS,
  HALL_MACHINE_LIFT,
  HALL_MACHINE_QUAD,
  HALL_MACHINE_UNIFORM_FLOATS,
  HALL_MACHINE_WGSL,
} from '../../shaders/hall-machine-shaders';
import {
  HALL_FX_WGSL,
  HALL_SEAL_SOCKETS,
  HALL_SEAL_UNIFORM_FLOATS,
  HALL_SEAL_WGSL,
  HALL_WINDOW_UNIFORM_FLOATS,
  HALL_WINDOW_WGSL,
} from '../../shaders/hall-shaders';
import { type CandleInstance, CandleRenderer } from '../materials/candles';
import { LIGHT_HEIGHT, LightSet } from '../materials/lights';
import { createStoneFloor, createStoneWall, type StoneSurface } from '../materials/stone';
import { Alcove, socketKindOf } from '../props/alcove';
import { Fuse } from '../props/fuse';
import { PROP_LIGHT_FLOATS } from '../props/lighting';
import { type PitchColour, pitch } from '../props/palette';
import { HALL_LAMPS, HallFloor } from './hall-floor';
import { Lightning } from './lightning';

const W = 1920;
const H = 1080;
/** Where the back wall meets the floor. */
export const HALL_FLOOR_Y = 800;
/** FUSE's wheel line: above the caption card (top ≈ 882) so he is never hidden by it. */
const FUSE_GROUND = 866;
const FUSE_SCALE = 62;
const ALCOVE_SIZE = 250;
const SEAL_SIZE = 372;
const WINDOWS = [
  { x: 676, y: 470, w: 104, h: 340 },
  { x: 1244, y: 470, w: 104, h: 340 },
] as const;

const COOL: readonly number[] = [0.45, 0.56, 0.95];
const FLASH: readonly number[] = [0.7, 0.8, 1.0];
const GOLD = pitch('gold');
const WARM = pitch('warm');
const AMETHYST = pitch('amethyst');
const WHITE: readonly number[] = [1, 1, 1];

function socketRgb(c: SocketColour): readonly number[] {
  const name: PitchColour = c === 'slate' ? 'parchment' : c;
  return pitch(name);
}
const SOCKET_RGB: Record<SocketColour, readonly number[]> = {
  amethyst: socketRgb('amethyst'),
  magenta: socketRgb('magenta'),
  amber: socketRgb('amber'),
  emerald: socketRgb('emerald'),
  ice: socketRgb('ice'),
  cyan: socketRgb('cyan'),
  slate: socketRgb('slate'),
};

/** Status → alcove state (0 locked, 1 open, 2 restored). */
const STATE: Record<AlcoveStatus, 0 | 1 | 2> = { locked: 0, unlocked: 1, solved: 2 };

interface Slot {
  readonly def: MachineDef;
  readonly alcove: Alcove;
  /** The machine silhouette inside (one instance of the shared machine material). */
  readonly machine: DrawParams;
  readonly machineParams: Float32Array;
  /** 0..1 eased "restored" amount (fires lit, gears turning). */
  alive: number;
  /** Seconds of machine animation (advances only while alive, so parts start where they stopped). */
  anim: number;
  status: AlcoveStatus | null;
  /** 0..1 how far the grate is up (machine fades in with it). */
  open: number;
  openTarget: number;
  /** Seconds left before a staged unlock plays (after a restore). */
  unlockIn: number;
  /** Time of the last restore in this visit (for the burst), or -1. */
  restoredAt: number;
  readonly pool: DrawParams;
  readonly poolTint: Float32Array;
  readonly poolParams: Float32Array;
}

interface Segment {
  readonly dp: DrawParams;
  readonly params: Float32Array;
  readonly from: MachineId;
  readonly to: MachineId;
}

/** GPU resources that outlive one visit to the hall (baked once per renderer). */
export interface HallKit {
  readonly wall: StoneSurface;
  readonly floor: StoneSurface;
  readonly candles: CandleRenderer;
  readonly windowMat: Material;
  readonly sealMat: Material;
  readonly fxMat: Material;
  readonly machineMat: Material;
  readonly fuse: Fuse;
}
const kits = new WeakMap<Renderer, HallKit>();

export function hallKit(r: Renderer): HallKit {
  let k = kits.get(r);
  if (!k) {
    k = {
      wall: createStoneWall(r, { seed: 7 }),
      floor: createStoneFloor(r, { height: H - HALL_FLOOR_Y, seed: 3 }),
      candles: new CandleRenderer(r),
      windowMat: r.createMaterial({
        label: 'hall-window',
        wgsl: HALL_WINDOW_WGSL,
        blend: 'premultiplied',
        uniformBytes: HALL_WINDOW_UNIFORM_FLOATS * 4,
      }),
      sealMat: r.createMaterial({
        label: 'hall-seal',
        wgsl: HALL_SEAL_WGSL,
        blend: 'premultiplied',
        uniformBytes: HALL_SEAL_UNIFORM_FLOATS * 4,
      }),
      fxMat: r.createMaterial({ label: 'hall-fx', wgsl: HALL_FX_WGSL, blend: 'premultiplied' }),
      machineMat: r.createMaterial({
        label: 'hall-machine',
        wgsl: HALL_MACHINE_WGSL,
        blend: 'premultiplied',
        uniformBytes: HALL_MACHINE_UNIFORM_FLOATS * 4,
      }),
      fuse: new Fuse(r, { x: 300, y: FUSE_GROUND, scale: FUSE_SCALE }),
    };
    kits.set(r, k);
  }
  return k;
}

function candle(x: number, y: number, height: number, seed: number, melt = 0.5): CandleInstance {
  return { x, y, height, seed, melt, radius: 640 };
}

export class CathedralHallView implements HallView {
  private readonly kit: HallKit;
  private readonly floorProps: HallFloor;
  /** Hanging-lamp brightness 0..1 (wakes with progress, dips when lightning strikes). */
  private lamp = 0;
  private motion = 1;
  private readonly lights = new LightSet();
  private readonly lightning = new Lightning(WINDOWS.length, 3);
  private readonly slots = new Map<MachineId, Slot>();
  private readonly slotList: Slot[] = [];
  /** Restored slots, most recent first (they get room lights first). */
  private readonly warmOrder: Slot[] = [];
  private readonly segments: Segment[] = [];
  private model: HallModel | null = null;
  private readonly byId = new Map<MachineId, AlcoveModel>();
  private sealModel: AlcoveModel | null = null;
  private time = 0;
  private level = 0;
  private warmth = 0;
  private sealOpen = 0;
  private sealHi = 0;
  private sealFocus = 0;
  private lastTarget: MachineId | null = null;
  private first = true;

  private readonly litCandles: CandleInstance[] = [
    candle(772, HALL_FLOOR_Y + 40, 74, 1, 0.3),
    candle(1148, HALL_FLOOR_Y + 40, 86, 2, 0.6),
    candle(84, 1050, 120, 3, 0.7),
    candle(700, 1052, 96, 4, 0.5),
  ];
  private readonly allCandles: CandleInstance[] = [
    ...this.litCandles,
    candle(808, HALL_FLOOR_Y + 46, 48, 5, 0.8),
    candle(1112, HALL_FLOOR_Y + 46, 54, 6, 0.4),
    candle(142, 1062, 72, 7, 0.4),
    candle(642, 1064, 58, 8, 0.8),
  ];

  // Preallocated draw state.
  private readonly winCol: number[][] = WINDOWS.map(() => [0, 0, 0]);
  private readonly windowU = new Float32Array(HALL_WINDOW_UNIFORM_FLOATS);
  private readonly windowDp: { dp: DrawParams; params: Float32Array }[];
  private readonly sealU = new Float32Array(HALL_SEAL_UNIFORM_FLOATS);
  private readonly machineU = new Float32Array(HALL_MACHINE_UNIFORM_FLOATS);
  private readonly sealDp: DrawParams = { x: 960, y: 520, w: SEAL_SIZE, h: SEAL_SIZE, emissive: 1 };
  private readonly sealX: number;
  private readonly sealY: number;
  private readonly hoverRing = this.ring(GOLD, 1.4);
  private readonly focusRing = this.ring(WHITE, 1.6);
  /** Soft breathing gold ring on the door to try next, so open doors aren't a coin toss. */
  private readonly suggestRing = this.ring(GOLD, 0.45);

  constructor(private readonly vc: ViewContext) {
    const r = vc.renderer;
    this.kit = hallKit(r);
    this.floorProps = new HallFloor(r);
    const rune = MACHINES.find((m) => m.id === 'the-last-rune');
    this.sealX = rune?.alcove.x ?? 960;
    this.sealY = rune?.alcove.y ?? 520;
    this.sealDp.x = this.sealX;
    this.sealDp.y = this.sealY;
    for (const def of MACHINES) {
      if (def.id === 'the-last-rune') continue;
      const tint = new Float32Array([1, 1, 1, 1]);
      const params = new Float32Array([3, 0, 0, 2]);
      const kind = (HALL_MACHINE_KINDS as readonly string[]).indexOf(def.id);
      const machineParams = new Float32Array([kind < 0 ? 14 : kind, 0, 0, 0]);
      const accent = def.grants ? SOCKET_RGB[socketColour(def.grants)] : GOLD;
      const slot: Slot = {
        def,
        alcove: new Alcove(r, { x: def.alcove.x, y: def.alcove.y, size: ALCOVE_SIZE }),
        machine: {
          x: def.alcove.x,
          y: def.alcove.y - HALL_MACHINE_LIFT,
          w: HALL_MACHINE_QUAD[0],
          h: HALL_MACHINE_QUAD[1],
          tint: [accent[0]!, accent[1]!, accent[2]!, 1],
          params: machineParams,
          emissive: 1,
        },
        machineParams,
        alive: 0,
        anim: 0,
        status: null,
        open: 0,
        openTarget: 0,
        unlockIn: -1,
        restoredAt: -1,
        pool: { x: def.alcove.x, y: def.alcove.y, w: 260, h: 260, tint, params, emissive: 0.8 },
        poolTint: tint,
        poolParams: params,
      };
      this.slots.set(def.id, slot);
      this.slotList.push(slot);
    }
    this.windowDp = WINDOWS.map((w, i) => {
      const params = new Float32Array([0, 3.7 + i * 5.1, 0, 0]);
      return { dp: { x: w.x, y: w.y, w: w.w, h: w.h, params, emissive: 1.3 }, params };
    });
    const fuse = this.kit.fuse;
    fuse.scale = FUSE_SCALE;
    fuse.mood = 'idle';
    fuse.place(-120, FUSE_GROUND);
    fuse.rollTo(330);
    fuse.lookAt(null);
    this.lightning.onStrike = (near) => vc.cue?.(near ? 'thunderNear' : 'thunder');
  }

  // ── HallView ──────────────────────────────────────────────────────────────

  onRestored(machine: MachineId, unlocked: readonly MachineId[]): void {
    const s = this.slots.get(machine);
    if (s) {
      s.restoredAt = this.time;
      this.lastTarget = machine;
    }
    // Doors open one after another once the gem has settled.
    unlocked.forEach((id, i) => {
      const u = this.slots.get(id);
      if (u) u.unlockIn = 1.3 + i * 0.45;
    });
  }

  update(dt: number, s: HallViewFrame): void {
    this.time += dt;
    if (s.model !== this.model) this.sync(s.model);
    const t = this.time;

    // Staged unlocks.
    for (const slot of this.slotList) {
      if (slot.unlockIn > 0) {
        slot.unlockIn -= dt;
        if (slot.unlockIn <= 0) {
          slot.unlockIn = -1;
          this.openSlot(slot);
          this.vc.cue?.('doorUnlock');
        }
      }
      if (slot.open < slot.openTarget) slot.open = Math.min(slot.openTarget, slot.open + dt / 1.6);
      else if (slot.open > slot.openTarget) slot.open = slot.openTarget;
      slot.alcove.update(dt);
      const aliveTarget = slot.status === 'solved' ? 1 : 0;
      if (slot.alive < aliveTarget) slot.alive = Math.min(1, slot.alive + dt / 1.4);
      else if (slot.alive > aliveTarget) slot.alive = 0;
      if (!s.reducedMotion) slot.anim += dt * slot.alive;
      const mp = slot.machineParams;
      mp[1] = smooth(0, 1, slot.open);
      mp[2] = smooth(0, 1, slot.alive);
      mp[3] = slot.anim;
    }

    // Storm.
    const lt = this.lightning;
    lt.reduceFlashes = s.reduceFlashes ?? s.reducedMotion;
    lt.level = this.level;
    lt.update(dt);
    this.motion = s.reducedMotion ? 0 : 1;
    this.lamp = (0.3 + 0.7 * this.warmth) * (1 - 0.55 * Math.min(1, lt.flash));

    // Seal.
    const sealA = this.sealModel;
    const k = 1 - Math.exp(-6 * dt);
    this.sealOpen += ((sealA && sealA.status !== 'locked' ? 1 : 0) - this.sealOpen) * k;
    this.sealHi += ((sealA && s.hover === sealA.id ? 1 : 0) - this.sealHi) * k;
    this.sealFocus = sealA && s.focus === sealA.id ? 1 : 0;

    // FUSE: roll to what the player is looking at (or the last thing that happened).
    const target = s.focus ?? s.hover ?? this.lastTarget;
    if (s.hover || s.focus) this.lastTarget = s.hover ?? s.focus;
    this.steerFuse(target, s, dt);
    this.kit.candles.reducedMotion = s.reducedMotion || !!s.reduceFlashes;
    this.kit.candles.update(this.allCandles, t);
  }

  render(frame: Frame, s: HallViewFrame): void {
    const kit = this.kit;
    const L = this.buildLights(s);
    kit.wall.light(L);
    kit.floor.light(L);
    kit.candles.light(L);

    frame.clear(0, 0, 0, 1);
    kit.wall.draw(frame, W / 2, H / 2, W, H, undefined, 1, 0.06);
    kit.floor.draw(
      frame,
      W / 2,
      HALL_FLOOR_Y + (H - HALL_FLOOR_Y) / 2,
      W,
      H - HALL_FLOOR_Y,
      undefined,
      1,
      0.16,
    );

    // Conduits carved into the wall, under everything else.
    this.floorProps.edgeGauge = !this.vc.phone?.();
    this.floorProps.update(L, this.time, this.motion, this.warmth, this.lamp);
    this.floorProps.drawBack(frame);
    for (const seg of this.segments) {
      seg.params[1] = this.time;
      frame.sprite(kit.fxMat, seg.dp);
    }

    this.drawWindows(frame, L);
    this.drawSeal(frame, L);

    // Alcoves (one batch), then the machines inside them (one batch).
    for (const slot of this.slotList) slot.alcove.draw(frame, L);
    const mu = this.machineU;
    mu.set(L.data, 0);
    // Reduced motion: hold the machines' clock (pulses, motes, flicker) still.
    mu[PROP_LIGHT_FLOATS] = s.reducedMotion ? 0 : this.time;
    kit.machineMat.setUniforms(mu);
    for (const slot of this.slotList) frame.sprite(kit.machineMat, slot.machine);

    this.drawFx(frame, s);
    this.floorProps.drawFront(frame);

    kit.candles.drawBodies(frame, this.allCandles);
    kit.candles.drawFlames(frame, this.allCandles);
    kit.fuse.draw(frame, L);
    frame.drawable(this.vc.particles);
  }

  dispose(): void {
    this.lightning.onStrike = null;
    // GPU resources live in the per-renderer kit; alcove/machine materials are shared.
  }

  // ── model ─────────────────────────────────────────────────────────────────

  private sync(model: HallModel): void {
    this.model = model;
    this.byId.clear();
    this.sealModel = null;
    let solved = 0;
    for (const a of model.alcoves) {
      this.byId.set(a.id, a);
      if (a.floor) this.sealModel = a;
      if (a.status === 'solved') solved++;
      const slot = this.slots.get(a.id);
      if (!slot) continue;
      this.applyStatus(slot, a);
    }
    const total = model.alcoves.length;
    const frac = solved / Math.max(1, total);
    this.level = 0.25 + 0.75 * frac;
    this.warmth = frac;
    this.rebuildConduits(model);
    this.writeSealSockets(model);
    this.first = false;
  }

  private applyStatus(slot: Slot, a: AlcoveModel): void {
    const prev = slot.status;
    slot.status = a.status;
    const al = slot.alcove;
    if (a.status === 'locked') al.setNeeds(a.missing.map((s) => capabilityFromKey(s.capability)));
    else if (a.status === 'solved' && slot.def.grants)
      al.setSockets([socketKindOf(slot.def.grants)]);
    else al.setSockets([]);

    if (this.first || prev === null) {
      al.set(STATE[a.status]);
      slot.open = slot.openTarget = a.status === 'locked' ? 0 : 1;
      slot.alive = a.status === 'solved' ? 1 : 0;
      slot.anim = slot.def.alcove.x * 0.013;
      if (a.status === 'solved') this.warmOrder.push(slot);
      return;
    }
    if (prev === a.status) return;
    if (a.status === 'locked') {
      al.lock();
      slot.alive = 0;
      slot.open = slot.openTarget = 0;
      slot.unlockIn = -1;
      const i = this.warmOrder.indexOf(slot);
      if (i >= 0) this.warmOrder.splice(i, 1);
    } else if (a.status === 'unlocked') {
      // Played by the staged timer when onRestored scheduled it; otherwise open now.
      if (slot.unlockIn < 0) this.openSlot(slot);
    } else {
      slot.openTarget = 1;
      al.restore();
      if (slot.restoredAt < 0) slot.restoredAt = this.time;
      const i = this.warmOrder.indexOf(slot);
      if (i >= 0) this.warmOrder.splice(i, 1);
      this.warmOrder.unshift(slot);
    }
  }

  private openSlot(slot: Slot): void {
    slot.alcove.unlock();
    slot.openTarget = 1;
  }

  private rebuildConduits(model: HallModel): void {
    this.segments.length = 0;
    const byId = new Map(model.alcoves.map((a) => [a.id, a]));
    for (const c of model.conduits) {
      const to = byId.get(c.to);
      const lit = c.lit ? (to?.status === 'solved' ? 2 : 1) : 0;
      const rgb = lit === 2 ? SOCKET_RGB.cyan : SOCKET_RGB[c.colour];
      // L-route: down/up the wall from the source, then across to the target.
      const pts = [c.x0, c.y0, c.x0, c.y1, c.x1, c.y1];
      let arc = 0;
      for (let i = 0; i < 2; i++) {
        const x0 = pts[i * 2]!;
        const y0 = pts[i * 2 + 1]!;
        const x1 = pts[i * 2 + 2]!;
        const y1 = pts[i * 2 + 3]!;
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (len < 1) continue;
        const params = new Float32Array([lit, 0, arc, 1]);
        this.segments.push({
          from: c.from,
          to: c.to,
          params,
          dp: {
            x: (x0 + x1) / 2,
            y: (y0 + y1) / 2,
            w: len + 14,
            h: 12,
            rotation: Math.atan2(y1 - y0, x1 - x0),
            tint: [rgb[0]!, rgb[1]!, rgb[2]!, 1],
            params,
            emissive: 0.6,
          },
        });
        arc += len;
      }
    }
  }

  private writeSealSockets(model: HallModel): void {
    const rune = MACHINES.find((m) => m.id === 'the-last-rune');
    const a = model.alcoves.find((x) => x.floor);
    const u = this.sealU;
    const o = PROP_LIGHT_FLOATS + 8;
    const needs = rune?.requires ?? [];
    const missing = new Set(a?.missing.map((m) => m.capability) ?? []);
    const n = Math.min(needs.length, HALL_SEAL_SOCKETS);
    for (let i = 0; i < n; i++) {
      const cap = needs[i]!;
      const key = capabilityKey(cap);
      const rgb = SOCKET_RGB[socketColour(cap)];
      u[o + i * 4] = rgb[0]!;
      u[o + i * 4 + 1] = rgb[1]!;
      u[o + i * 4 + 2] = rgb[2]!;
      u[o + i * 4 + 3] = a?.status === 'locked' && missing.has(key) ? 0 : 1;
    }
    u[PROP_LIGHT_FLOATS + 3] = n;
  }

  // ── per frame ─────────────────────────────────────────────────────────────

  private buildLights(s: HallViewFrame): LightSet {
    const L = this.lights;
    const w = this.warmth;
    const lt = this.lightning;
    // Cool and dim at the start; warmer (and the storm darker) as the hall wakes.
    L.begin(0.075 + 0.035 * w, 0.08 + 0.015 * w, 0.11 - 0.04 * w, 0.55, 0.8);
    // Cool skylight from the roof (dimmer as the storm thickens): keeps locked niches readable.
    L.add(W / 2, 40, 1600, COOL, 0.5 - 0.15 * this.level, 700);
    // Storm light through the windows; the struck window flares (one light each, recoloured).
    for (let i = 0; i < WINDOWS.length; i++) {
      const win = WINDOWS[i]!;
      const f = lt.flash * (lt.window === i ? 1 : 0.45);
      const c = this.winCol[i]!;
      const m = Math.min(1, f);
      for (let j = 0; j < 3; j++) c[j] = COOL[j]! + (FLASH[j]! - COOL[j]!) * m;
      L.add(win.x, win.y + 40 * m, 800 + 400 * m, c, 0.34 - 0.1 * this.level + f * 2.4, 280);
    }
    // Low wall-washers on each wing so the side niches never fall to black.
    L.add(290, 400, 560, COOL, 0.26, 240);
    L.add(1630, 400, 560, COOL, 0.26, 240);
    this.kit.candles.addLights(L, this.litCandles);
    // The two wing lamps (the centre pair sits in the seal's and windows' light already).
    for (const l of HALL_LAMPS) {
      if (l.x === 325 || l.x === 1595) L.add(l.x, l.y + 30, 420, WARM, 0.75 * this.lamp, 120);
    }
    // The seal: amethyst ember while sealed, gold once open.
    const so = this.sealOpen;
    L.add(this.sealX, this.sealY, 520, so > 0.5 ? GOLD : AMETHYST, 0.25 + 0.75 * so, 140);
    // Hover: gold light on the alcove under the pointer.
    const hov = s.focus ?? s.hover;
    const hs = hov ? this.slots.get(hov) : undefined;
    if (hs) L.add(hs.def.alcove.x, hs.def.alcove.y + 30, 360, GOLD, 0.9, 150);
    // Restored machines: warm light from inside, most recent first.
    for (const slot of this.warmOrder) {
      const al = slot.alcove.light;
      if (!L.add(al.x, al.y, 460, WARM, al.intensity * 1.5, LIGHT_HEIGHT.gem + 60)) break;
    }
    return L;
  }

  private drawWindows(frame: Frame, L: LightSet): void {
    const u = this.windowU;
    u.set(L.data, 0);
    u[PROP_LIGHT_FLOATS] = this.time;
    u[PROP_LIGHT_FLOATS + 1] = this.level;
    u[PROP_LIGHT_FLOATS + 2] = this.lightning.reduceFlashes ? 1 : 0;
    this.kit.windowMat.setUniforms(u);
    const lt = this.lightning;
    for (let i = 0; i < this.windowDp.length; i++) {
      const wd = this.windowDp[i]!;
      const struck = lt.window === i;
      wd.params[0] = lt.flash * (struck ? 1 : 0.45);
      wd.params[2] = lt.boltX * (WINDOWS[i]!.w * 0.3);
      wd.params[3] = struck ? lt.bolt : 0;
      frame.sprite(this.kit.windowMat, wd.dp);
    }
  }

  private drawSeal(frame: Frame, L: LightSet): void {
    const u = this.sealU;
    u.set(L.data, 0);
    const o = PROP_LIGHT_FLOATS;
    u[o] = this.time;
    u[o + 1] = this.sealOpen;
    u[o + 2] = this.sealHi;
    u[o + 4] = this.sealFocus;
    this.kit.sealMat.setUniforms(u);
    frame.sprite(this.kit.sealMat, this.sealDp);
  }

  private drawFx(frame: Frame, s: HallViewFrame): void {
    const t = s.reducedMotion ? 0 : this.time;
    const fx = this.kit.fxMat;
    // Open doors beckon; fresh restores burst in their gem colour.
    for (const slot of this.slotList) {
      const since = slot.restoredAt >= 0 ? this.time - slot.restoredAt : 99;
      let k = 0;
      let rgb: readonly number[] = GOLD;
      if (since < 2.5) {
        k = 1.4 * (1 - since / 2.5);
        rgb = slot.def.grants ? SOCKET_RGB[socketColour(slot.def.grants)] : GOLD;
      } else if (slot.status === 'unlocked' && slot.open > 0.5) {
        k = 0.025 + 0.015 * Math.sin((t / 2.4) * Math.PI * 2 + slot.def.alcove.x * 0.01);
      }
      if (k <= 0.001) continue;
      const tint = slot.poolTint;
      tint[0] = rgb[0]! * k;
      tint[1] = rgb[1]! * k;
      tint[2] = rgb[2]! * k;
      frame.sprite(fx, slot.pool);
    }
    // Suggested-next ring (soft gold, breathing) unless that door is already hovered/focused.
    const next = s.model.alcoves.find((a) => a.suggested);
    const ns = next ? this.slots.get(next.id) : undefined;
    if (ns && ns.open > 0.5 && next!.id !== s.hover && next!.id !== s.focus) {
      const k = 0.16 + 0.08 * Math.sin((t / 1.8) * Math.PI * 2); // well under hover's 1.4
      const tint = this.suggestRing.dp.tint as number[];
      tint[0] = GOLD[0]! * k;
      tint[1] = GOLD[1]! * k;
      tint[2] = GOLD[2]! * k;
      this.drawRing(frame, this.suggestRing, ns, 0);
    }
    // Hover ring (gold) and focus ring (white, marching) around the alcove.
    const hs = s.hover ? this.slots.get(s.hover) : undefined;
    if (hs && s.hover !== s.focus) this.drawRing(frame, this.hoverRing, hs, 0);
    const fs = s.focus ? this.slots.get(s.focus) : undefined;
    if (fs) this.drawRing(frame, this.focusRing, fs, 0.001 + (this.time % 10));
  }

  private ring(rgb: readonly number[], k: number): { dp: DrawParams; params: Float32Array } {
    const params = new Float32Array([28, 3, 0, 0]);
    return {
      params,
      dp: {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        tint: [rgb[0]! * k, rgb[1]! * k, rgb[2]! * k, 1],
        params,
        emissive: 0.7,
      },
    };
  }

  private drawRing(
    frame: Frame,
    ring: { dp: DrawParams; params: Float32Array },
    slot: Slot,
    phase: number,
  ): void {
    ring.dp.x = slot.def.alcove.x;
    ring.dp.y = slot.def.alcove.y - 2;
    ring.dp.w = ALCOVE_SIZE * 0.78 + 36;
    ring.dp.h = ALCOVE_SIZE * 0.98 + 36;
    ring.params[2] = phase;
    frame.sprite(this.kit.fxMat, ring.dp);
  }

  private steerFuse(target: MachineId | null, s: HallViewFrame, dt: number): void {
    const fuse = this.kit.fuse;
    let x = 330;
    let lx: number | null = null;
    let ly = 0;
    if (target) {
      const a = this.byId.get(target);
      if (a) {
        const side = a.x < W / 2 ? 1 : -1;
        x = a.x + side * 130;
        // Keep clear of the intake desk and the seal's candles.
        if (Math.abs(x - W / 2) < 265) x = W / 2 + (a.x <= W / 2 ? -265 : 265);
        x = Math.min(W - 90, Math.max(90, x));
        lx = a.x;
        ly = a.y;
      }
    }
    fuse.rollTo(x);
    if (fuse.rolling) fuse.facing = x > fuse.x ? 1 : -1;
    else if (lx !== null) fuse.facing = lx >= fuse.x ? 1 : -1;
    fuse.lookAt(lx, ly);
    if (s.speaking) fuse.speak(0.3);
    fuse.update(dt);
  }
}

function smooth(e0: number, e1: number, x: number): number {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
}

export const cathedralHallView = (vc: ViewContext): HallView => new CathedralHallView(vc);
