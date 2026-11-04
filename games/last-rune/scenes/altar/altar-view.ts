/**
 * Everything the altar draws: room, slab, sockets, gems, storm cell, machines, bolts, FUSE.
 * The scene owns the rules state and tells the view what to show; the view owns animation
 * (gem lift/settle, rotation easing, energise glow) and lighting.
 *
 * Render order (submission order = draw order): wall, floor, candle bodies, slab, circuit
 * (conduits, socket veils), socket overlays, props (storm, machines), gem shadows/pools, gems, held gem, bolts, candle flames,
 * FUSE, particles.
 */
import type { Frame, RGBA } from '@thunderclap/engine/render';
import { gemCutPoints } from '../../art/gem-cut';
import type { CandleInstance } from '../../art/materials/candles';
import { addGemLight, type GemInstance, type GemState } from '../../art/materials/gems';
import { LightSet } from '../../art/materials/lights';
import { LINEAR } from '../../art/materials/palette';
import type { AltarSlab, SocketState } from '../../art/materials/stone';
import type { BoltRibbon, BoltSegment } from '../../art/props/bolt';
import { PropLightRig } from '../../art/props/lighting';
import { Machine } from '../../art/props/machine';
import { GEM_COLOUR, pitch } from '../../art/props/palette';
import { StormCell } from '../../art/props/storm';
import type { GameCtx } from '../../game/ctx';
import { isRotational, type Placement, type PuzzleDef } from '../../rules';
import type { Cell, GemKind } from '../../rules/types';
import { altarFrame } from './altar-chrome';
import { type AltarAssets, altarAssets, ensureBolts } from './assets';
import type { BoardState } from './board';
import type { PathHop } from './circuit-model';
import { type AltarLayout, anchorOf, cellCenter, computeLayout, DESIGN_W } from './layout';
import { hopTurn, restTurn } from './rest-turn';
import type { StrikeTimeline } from './strike';

const W = DESIGN_W;
const GOLD: RGBA = [LINEAR.gold[0] * 1.4, LINEAR.gold[1] * 1.4, LINEAR.gold[2] * 1.4, 1];
const DANGER: RGBA = [2.2, 0.35, 0.22, 1];
const ROOF: RGBA = [0.5, 0.62, 0.95, 1];
/** Neutral, slightly cool work light over the slab and machines. */
const WORK: RGBA = [0.62, 0.66, 0.8, 1];
/** Storm conduit glow colour (the storm's own blue-white). */
const STORM_GLOW: RGBA = [0.7, 1.1, 1.8, 1];
/** Route preview glow: a faint warm trace in the groove. */
const PREVIEW_GLOW: RGBA = [1.2, 0.85, 0.4, 1];
/** Guide stubs on a new fixed gem: the gem's own violet, so they read as "what it joins". */
const GUIDE_GLOW: RGBA = [1.0, 0.6, 1.6, 1];
/** How far a socket out of play recedes (veil opacity). */
const VEIL_AMOUNT = 0.75;

const CANDLES: CandleInstance[] = [
  { x: 96, y: 1012, height: 200, seed: 1, melt: 0.6, radius: 820 },
  { x: 1690, y: 1032, height: 150, seed: 3, melt: 0.5, radius: 760 },
  { x: 1812, y: 1008, height: 220, seed: 4, melt: 0.7, radius: 820 },
];

/** Visual + animation state for one gem on the board. */
export interface BoardGem {
  g: GemInstance;
  cell: Cell;
  fixed: boolean;
  /** Target rotation (quarters, unwrapped so easing always turns the short way forward). */
  rotTarget: number;
  /** Settle bounce 0..1 (decays). */
  settle: number;
  /** Lift target 0..1. */
  liftTarget: number;
  /** Energise level 0..1 (eases). */
  energy: number;
  energyTarget: number;
  /** Extra pulse (capacitor holding charge). */
  holding: boolean;
  /**
   * An Amplify the bolt passed without doubling it (it was already doubled; held-gem, finding
   * E): drawn idle, dim and unlit, where a working Amplify flares.
   */
  idle: boolean;
  /** Being dragged: drawn at the pointer instead. */
  hidden: boolean;
}

export interface SocketMark {
  col: number;
  row: number;
  state: SocketState;
  color: Readonly<RGBA>;
  intensity: number;
  /** Pulse speed (0 = steady). */
  pulse: number;
}

export interface HeldGem {
  kind: GemKind;
  rot: number;
  x: number;
  y: number;
  /** Over a legal socket: snap preview. */
  snapped: boolean;
  /** Drawn size, design px, when not the board's gem size (phones: resting in its tray slot). */
  size?: number;
  /** Hover lift when not the default (phones: 0, it rests flat in its tray ring; glyph-truth). */
  lift?: number;
  /**
   * Phones: resting in its own tray slot (held-gem). Drawn calm (no hover wash, no lift) so its
   * glyph keeps full contrast and a Turn shows at a glance; the slot's own copy is hidden.
   */
  rest?: boolean;
  /**
   * Phones, while it is snapped over a socket: the tray slot it came from, where a calm copy at
   * its turn stays (the ghost on the socket shows where it would land).
   */
  slot?: { x: number; y: number; size: number } | null;
}

export class AltarView {
  /** The fitted layout: where things are drawn, hit-tested and labelled (design px). */
  readonly layout: AltarLayout;
  readonly slab: AltarSlab;
  readonly storm: StormCell;
  readonly machines: Machine[];
  readonly assets: AltarAssets;
  readonly board: BoardGem[] = [];
  readonly tray: GemInstance[];
  /** Tray slot emphasis (selected kind) and lift targets. */
  readonly trayLift: number[];
  readonly marks: SocketMark[] = [];
  /** Extra glow a fully energised gem gets (the solve moment turns it down; solve-truth). */
  energyGlow = 0.6;
  held: HeldGem | null = null;
  /**
   * The turn a held straight gem shows while it is snapped over a socket: the way it would sit
   * there (set by the scene with the ghost preview). Off the board it shows the tray's turn.
   */
  heldFace: number | null = null;
  /** A gem shown large in front of everything (the solve moment's granted gem). */
  showcase: GemInstance | null = null;
  private readonly showcaseList: GemInstance[] = [];
  /** Camera shake amount (decays); set by the scene. */
  shake = 0;
  /** 0..1 global dim for the room while the solve moment plays. */
  wake = 0;
  time = 0;
  reducedMotion = false;
  /** Reduce flashes: candles hold a steady light (as in reduced motion). */
  reduceFlashes = false;
  /** Bolt playback speed (fast-forward). */
  boltRate = 1;
  private readonly markPool: SocketMark[] = [];

  // ── Circuit (altar-clarity) ──
  /** Per-socket veil, eased toward `veilTarget` (row-major). */
  private readonly veilK: Float32Array;
  private readonly veilTarget: Float32Array;
  /** Edit-time route through placed gems (strike 1), and how strongly to show it (0..1). */
  preview: PathHop[] = [];
  previewTarget = 0;
  private previewK = 0;
  /** Storm conduit glow 0..1 (decays). */
  stormGlow = 0;
  /** Per-machine conduit glow 0..1 and colour (outcome colour once charge lands). */
  readonly machineGlow: number[];
  readonly machineColor: RGBA[];
  /** Per-machine: does the edit-time route reach it? */
  readonly machineLinked: boolean[];
  private readonly machineLinkK: number[];
  /**
   * First altar: the storm's conduit and each machine's conduit breathe in turn (storm first),
   * so "power goes from there to there" reads before any words. 0..1 target, eased.
   */
  beckonTarget = 0;
  private beckonK = 0;
  /** Faint stubs on a newly met fixed gem's joined sides (what a Bend connects), 0..1 eased. */
  guide: PathHop[] = [];
  guideTarget = 0;
  private guideK = 0;

  private readonly lights = new LightSet();
  private readonly rig = new PropLightRig();
  private readonly heldInst: GemInstance = {
    kind: 'channel',
    x: 0,
    y: 0,
    size: 80,
    state: 'hover',
  };

  /** Phones: the held tray gem's ring (gem state "ring"), drawn round it in its slot. */
  private readonly ringInst: GemInstance = {
    kind: 'channel',
    x: 0,
    y: 0,
    size: 80,
    state: 'ring',
    lift: 0,
  };
  private readonly heldList: GemInstance[] = [this.heldInst];
  private readonly drawList: GemInstance[] = [];
  private readonly pt = { x: 0, y: 0 };
  private activeBolts = 0;

  constructor(
    private readonly ctx: GameCtx,
    readonly puzzle: PuzzleDef,
  ) {
    const r = ctx.renderer;
    this.assets = altarAssets(r, ctx.particles);
    ensureBolts(this.assets, r, ctx.particles, Math.max(1, puzzle.pulses));
    const dev = ctx.device;
    const L = computeLayout(puzzle, altarFrame(dev, ctx.chrome));
    this.layout = L;
    this.slab = L.phone
      ? this.assets.slab(L.cols, L.rows, L.pitch, L.margin, L.phone.front, puzzle.blocked, true)
      : this.assets.slab(L.cols, L.rows, L.pitch);
    this.slab.place(L.cx, L.cy);
    this.storm = new StormCell(r, {
      x: L.storm.x,
      y: L.storm.y,
      size: L.storm.size,
      strength: puzzle.storm.strength,
    });
    this.machines = L.machines.map(
      (m) => new Machine(r, { x: m.x, y: m.y, size: m.size, meter: !!L.phone }),
    );
    this.veilK = new Float32Array(L.cols * L.rows);
    this.veilTarget = new Float32Array(L.cols * L.rows);
    this.machineGlow = L.machines.map(() => 0);
    this.machineColor = L.machines.map(() => [...STORM_GLOW] as RGBA);
    this.machineLinked = L.machines.map(() => false);
    this.machineLinkK = L.machines.map(() => 0);
    this.tray = L.tray.map((s, i) => ({
      kind: s.gem,
      x: s.x,
      y: s.y,
      size: s.size,
      state: 'idle' as GemState,
      lift: 0,
      // One turn on every altar (glyph-truth-2): straight gems upright, as the Codex draws
      // them; Bend, Gate and Split at rot 0, as they come out of the tray.
      rot: 0,
      seed: 40 + i,
    }));
    this.trayLift = L.tray.map(() => 0);
    this.heldInst.size = L.gemSize;
    const fuse = this.assets.fuse;
    if (L.phone) {
      fuse.scale = L.phone.fuseScale;
      // Lifted clear of the screen's edge, so his treads read as standing, not cut off.
      fuse.place(L.phone.fuseX, L.phone.fuseY - phoneFuseLift(L.phone.cssPx));
    } else {
      fuse.scale = 112;
      fuse.place(300, 1046);
    }
    fuse.mood = 'idle';
    fuse.lookAt(null);
    for (const b of this.assets.bolts) b.clear();
  }

  dispose(): void {
    this.storm.destroy();
    for (const b of this.assets.bolts) b.clear();
    this.ctx.renderer.camera.x = 0;
    this.ctx.renderer.camera.y = 0;
    this.ctx.renderer.camera.zoom = 1;
    this.ctx.renderer.camera.rotation = 0;
  }

  get bolts(): readonly BoltRibbon[] {
    return this.assets.bolts;
  }

  get fuse() {
    return this.assets.fuse;
  }

  // ── Socket overlays (rebuilt each frame from a pool) ─────────────────────

  clearMarks(): void {
    this.marks.length = 0;
  }

  mark(
    col: number,
    row: number,
    state: SocketState,
    color: Readonly<RGBA>,
    intensity = 1,
    pulse = 0,
  ): void {
    let m = this.markPool[this.marks.length];
    if (!m) {
      m = { col, row, state, color, intensity, pulse };
      this.markPool.push(m);
    }
    m.col = col;
    m.row = row;
    m.state = state;
    m.color = color;
    m.intensity = intensity;
    m.pulse = pulse;
    this.marks.push(m);
  }

  /**
   * Which empty sockets are in play (`1`) and which recede (`0`), row-major. Occupied and
   * blocked sockets never get a veil (the gem or rubble covers them). `instant` skips easing.
   */
  setLive(mask: Uint8Array, occupied: (x: number, y: number) => boolean, instant = false): void {
    const L = this.layout;
    for (let y = 0; y < L.rows; y++) {
      for (let x = 0; x < L.cols; x++) {
        const i = y * L.cols + x;
        const t = mask[i] || occupied(x, y) ? 0 : VEIL_AMOUNT;
        this.veilTarget[i] = t;
        if (instant) this.veilK[i] = t;
      }
    }
  }

  // ── Board gems ──────────────────────────────────────────────────────────

  /** Rebuild the board gem list after an edit, keeping animation state for gems that stayed. */
  syncBoard(state: BoardState, justPlaced: Cell | null = null): void {
    const L = this.layout;
    const want: { p: Placement; fixed: boolean }[] = [
      ...this.puzzle.fixed.map((p) => ({ p, fixed: true })),
      ...state.placements.map((p) => ({ p, fixed: state.lockedPlacements.includes(p) })),
    ];
    const old = this.board.splice(0, this.board.length);
    const gems = want.map((w) => w.p);
    for (const { p, fixed } of want) {
      const prev = old.find(
        (b) => b.cell.x === p.cell.x && b.cell.y === p.cell.y && b.g.kind === p.gem,
      );
      cellCenter(L, p.cell, this.pt);
      if (prev) {
        // Turn forward to the new rotation (Bend/Gate/Split only; others keep their look).
        if (isRotational(p.gem)) {
          const cur = Math.round(prev.rotTarget);
          const fwd = (((p.rot - cur) % 4) + 4) % 4;
          prev.rotTarget = cur + (fwd === 3 ? -1 : fwd);
        }
        prev.hidden = false;
        this.board.push(prev);
        continue;
      }
      const g: GemInstance = {
        kind: p.gem,
        x: this.pt.x,
        y: this.pt.y,
        size: L.gemSize,
        state: 'placed',
        rot: this.restRot(p, gems),
        lift: 0,
        glow: 1,
        seed: p.cell.x * 7 + p.cell.y * 13 + (fixed ? 100 : 0),
      };
      const isNew = justPlaced && justPlaced.x === p.cell.x && justPlaced.y === p.cell.y;
      this.board.push({
        g,
        cell: { x: p.cell.x, y: p.cell.y },
        fixed,
        rotTarget: g.rot ?? 0,
        settle: isNew ? 1 : 0,
        liftTarget: 0,
        energy: 0,
        energyTarget: 0,
        holding: false,
        idle: false,
        hidden: false,
      });
      if (isNew) g.lift = 1;
    }
  }

  /**
   * Rest rotation: Bend/Gate/Split as set; straight gems lie along the run their socket is part
   * of (`restTurn`, glyph-truth-2), never across it.
   */
  private restRot(p: Placement, gems: readonly Placement[]): number {
    if (isRotational(p.gem)) return p.rot;
    return restTurn(this.puzzle, gems, p.cell);
  }

  /** The gems on the board now, as placements (turned gems at the turn they show). */
  placedGems(): Placement[] {
    return this.board.map((b) => ({
      gem: b.g.kind,
      cell: b.cell,
      rot: (((Math.round(b.rotTarget) % 4) + 4) % 4) as Placement['rot'],
    }));
  }

  gemAt(c: Cell): BoardGem | undefined {
    return this.board.find((b) => b.cell.x === c.x && b.cell.y === c.y);
  }

  /** Orient non-rotational gems along the bolt that passed through them. */
  orientAlong(timeline: StrikeTimeline): void {
    this.faceAlong(timeline.segments.map((s) => s.seg));
  }

  /**
   * Turn each straight-through gem so its glyph's input faces where the bolt comes in: the hop
   * that ends on the gem. With `rest`, gems no hop reaches lie along their run (`restTurn`, from
   * `gems`, by default the board as it is); one already on that axis keeps its turn, so it
   * never spins end for end. Bend, Gate and Split never move: their turn is part of the rules.
   */
  faceAlong(
    hops: readonly { from: Cell; to: Cell }[],
    rest = false,
    gems: readonly Placement[] = this.placedGems(),
  ): void {
    for (const b of this.board) {
      if (isRotational(b.g.kind)) continue;
      const h = hops.find((s) => s.to.x === b.cell.x && s.to.y === b.cell.y);
      let q: number;
      if (h) q = hopTurn(h);
      else if (rest) {
        q = restTurn(this.puzzle, gems, b.cell);
        if (((Math.round(b.rotTarget) - q) & 1) === 0) continue;
      } else continue;
      const cur = Math.round(b.rotTarget);
      const fwd = (((q - cur) % 4) + 4) % 4;
      b.rotTarget = cur + (fwd === 3 ? -1 : fwd);
    }
  }

  /** Reset energy/holding (back to editing). */
  deenergise(): void {
    for (const b of this.board) {
      b.energyTarget = 0;
      b.holding = false;
      b.idle = false;
    }
  }

  // ── Bolts ───────────────────────────────────────────────────────────────

  /** Ribbon segments for one strike, in seconds relative to the strike's start. */
  boltSegments(timeline: StrikeTimeline, pulse: number, out: BoltSegment[]): BoltSegment[] {
    out.length = 0;
    const start = timeline.pulses[pulse]!.start;
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    for (const s of timeline.segments) {
      if (s.seg.pulse !== pulse) continue;
      anchorOf(this.layout, s.seg.from, a);
      anchorOf(this.layout, s.seg.to, b);
      out.push({
        ax: a.x,
        ay: a.y,
        bx: b.x,
        by: b.y,
        colour: pitch(GEM_COLOUR[s.seg.colour], 1.6),
        charge: s.seg.charge / 4,
        t0: s.t0 - start,
        t1: s.t1 - start,
      });
    }
    return out;
  }

  setActiveBolts(n: number): void {
    this.activeBolts = n;
  }

  // ── Frame ───────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.time += dt;
    const k = 1 - Math.exp(-14 * dt);
    const rm = this.reducedMotion;
    for (const b of this.board) {
      const g = b.g;
      g.lift = (g.lift ?? 0) + (b.liftTarget - (g.lift ?? 0)) * k;
      g.rot = (g.rot ?? 0) + (b.rotTarget - (g.rot ?? 0)) * (rm ? 1 : 1 - Math.exp(-18 * dt));
      b.settle = Math.max(0, b.settle - dt * 3.2);
      b.energy +=
        (b.energyTarget - b.energy) * (1 - Math.exp(-(b.energyTarget > b.energy ? 30 : 4) * dt));
      // Settle: a small overshoot squash as the gem seats (easeOutBack-ish bounce).
      const s = b.settle;
      const bounce = rm ? 0 : Math.sin(s * Math.PI * 2.2) * s * 0.09;
      g.size = this.layout.gemSize * (1 + bounce);
      // A gem the bolt has passed and left cools to its placed look (glyph and turn read
      // plainly under the verdict); one still holding or waiting on charge stays energised.
      g.state = b.energy > 0.45 ? 'energised' : b.hidden ? 'dim' : 'placed';
      const hold = b.holding ? 0.35 + 0.25 * Math.sin(this.time * 6) : 0;
      g.glow = 1 + b.energy * this.energyGlow + hold;
      // An idle Amplify sits below a resting gem's glow: the bolt went through, nothing woke.
      if (b.idle && g.state === 'placed') g.glow = 0.45;
    }
    for (let i = 0; i < this.tray.length; i++) {
      const t = this.tray[i]!;
      t.lift = (t.lift ?? 0) + (this.trayLift[i]! - (t.lift ?? 0)) * k;
    }
    const kv = 1 - Math.exp(-8 * dt);
    for (let i = 0; i < this.veilK.length; i++)
      this.veilK[i]! += (this.veilTarget[i]! - this.veilK[i]!) * kv;
    this.previewK += (this.previewTarget - this.previewK) * kv;
    this.beckonK += (this.beckonTarget - this.beckonK) * kv;
    this.guideK += (this.guideTarget - this.guideK) * kv;
    for (let i = 0; i < this.machineLinkK.length; i++) {
      const t = this.machineLinked[i] ? this.previewTarget : 0;
      this.machineLinkK[i]! += (t - this.machineLinkK[i]!) * kv;
    }
    this.stormGlow = Math.max(0, this.stormGlow - dt * 1.2);
    this.storm.update(dt);
    for (const m of this.machines) m.update(dt);
    for (let i = 0; i < this.activeBolts; i++) this.assets.bolts[i]!.update(dt * this.boltRate);
    this.assets.candles.reducedMotion = rm || this.reduceFlashes;
    this.assets.candles.update(CANDLES, this.time);
    this.fuse.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.4);
  }

  /**
   * Conduits and veils. The storm and every machine are wired into the slab by a carved
   * groove to their socket; the edit-time route lies faintly in grooves between gems; sockets
   * out of play are skimmed over so the circuit, not the grid, is what reads.
   */
  /**
   * Phones (held-gem, blind review 9 finding A): the gem in hand, resting in its tray slot,
   * sits in a gold ring of its own outline (a hexagon round a Split), turned with it. Drawn
   * under the gem, hugging its edge, so nothing lies over the gem's glyph: a ring over the gem
   * (and its glow) paled it, and a Turn read as no change.
   */
  private drawHeldRing(frame: Frame): void {
    const h = this.held;
    if (!h || !this.layout.phone) return;
    const ti = this.tray.findIndex((t) => t.kind === h.kind);
    const slot = this.layout.tray[ti];
    if (!slot || !(h.rest || h.slot)) return;
    const r = this.ringInst;
    r.kind = h.kind;
    r.rot = isRotational(h.kind) ? h.rot : 0;
    r.x = slot.x;
    r.y = slot.y;
    // The stroke's centre a hair outside the gem's corners.
    const corner = (slot.size / 2) * Math.min(1, cutRadius(h.kind)) + HELD_RING_GAP;
    r.size = Math.round(2 * corner * ringScale(h.kind));
    this.heldList[0] = r;
    this.assets.gems.drawGems(frame, this.heldList);
    this.heldList[0] = this.heldInst;
  }

  private drawCircuit(frame: Frame): void {
    const c = this.assets.circuit;
    const L = this.layout;
    const r = this.slab.socketRadius;
    const wide = Math.max(8, L.pitch * 0.15);
    const a = this.pt;
    const trim = (ax: number, ay: number, bx: number, by: number, ta: number, tb: number) => {
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      return [
        ax + (dx / len) * ta,
        ay + (dy / len) * ta,
        bx - (dx / len) * tb,
        by - (dy / len) * tb,
      ] as const;
    };
    // Storm → entry socket. Phones lay a lit brass wire, 2+ CSS px, so each prop's lead to
    // the board reads (mobile-6-board); the route preview keeps the plain groove.
    c.bright = !!L.phone;
    cellCenter(L, L.storm.inner, a);
    {
      const [x0, y0, x1, y1] = trim(
        L.storm.port.x,
        L.storm.port.y,
        a.x,
        a.y,
        L.storm.size * 0.2,
        r * 0.95,
      );
      const g = Math.max(this.stormGlow, this.previewK * 0.35, this.beckon(0));
      c.conduit(frame, x0, y0, x1, y1, wide, 0.9, g, STORM_GLOW);
    }
    // Exit socket → each machine's terminal.
    for (let i = 0; i < L.machines.length; i++) {
      const m = L.machines[i]!;
      cellCenter(L, m.inner, a);
      const [x0, y0, x1, y1] = trim(a.x, a.y, m.port.x, m.port.y, r * 0.95, 0);
      const lit = Math.max(this.machineGlow[i]!, this.machineLinkK[i]! * 0.5);
      const call = this.beckon(0.5);
      const g = Math.max(lit, call);
      const col =
        this.machineGlow[i]! > 0.01
          ? this.machineColor[i]!
          : call > lit
            ? STORM_GLOW
            : PREVIEW_GLOW;
      c.conduit(frame, x0, y0, x1, y1, wide, 0.9, g, col);
    }
    c.bright = false;
    // Route preview between sockets.
    if (this.previewK > 0.01) {
      const b = { x: 0, y: 0 };
      for (const h of this.preview) {
        if (!inside(L, h.from) || !inside(L, h.to)) continue;
        cellCenter(L, h.from, a);
        cellCenter(L, h.to, b);
        const [x0, y0, x1, y1] = trim(a.x, a.y, b.x, b.y, r * 0.9, r * 0.9);
        c.conduit(
          frame,
          x0,
          y0,
          x1,
          y1,
          wide * 0.85,
          0.75 * this.previewK,
          0.3 * this.previewK,
          PREVIEW_GLOW,
        );
      }
    }
    // Guide stubs: what a newly met fixed gem joins, before the route reaches it.
    if (this.guideK > 0.01) {
      const b = { x: 0, y: 0 };
      const breathe = this.reducedMotion ? 0.7 : 0.55 + 0.3 * Math.sin(this.time * 2.4);
      for (const h of this.guide) {
        if (!inside(L, h.from) || !inside(L, h.to)) continue;
        if (this.preview.some((p) => sameHop(p, h))) continue;
        cellCenter(L, h.from, a);
        cellCenter(L, h.to, b);
        const [x0, y0, x1, y1] = trim(a.x, a.y, b.x, b.y, r * 0.9, r * 0.9);
        const k = this.guideK * breathe;
        c.conduit(frame, x0, y0, x1, y1, wide * 0.8, 0.6 * k, 0.35 * k, GUIDE_GLOW);
      }
    }
    // Veils.
    for (let y = 0; y < L.rows; y++) {
      for (let x = 0; x < L.cols; x++) {
        const k = this.veilK[y * L.cols + x]!;
        if (k <= 0.01) continue;
        this.slab.socketCenter(x, y, a);
        c.veil(frame, a.x, a.y, r, k);
      }
    }
  }

  /** Beckon glow for a conduit; `lag` (0..1 of a cycle) runs the machine's after the storm's. */
  private beckon(lag: number): number {
    if (this.beckonK < 0.01) return 0;
    if (this.reducedMotion) return this.beckonK * 0.45;
    const ph = (this.time / 2.2 - lag) % 1;
    const u = ph < 0 ? ph + 1 : ph;
    return this.beckonK * (0.15 + 0.6 * Math.exp(-(((u - 0.25) * 6) ** 2)));
  }

  render(frame: Frame): void {
    const a = this.assets;
    const L = this.layout;
    const cam = this.ctx.renderer.camera;
    if (this.shake > 0 && !this.reducedMotion) {
      const s = this.shake * this.shake * 14;
      cam.x = Math.sin(this.time * 71) * s;
      cam.y = Math.cos(this.time * 53) * s * 0.7;
    } else {
      cam.x = 0;
      cam.y = 0;
    }
    cam.zoom = 1;

    // ── Lights ──
    const Ls = this.lights;
    const ph = L.phone;
    Ls.begin(0.075, 0.078, 0.105, 0.5, 0.75);
    // Phones (mobile-3-board): no candles; the board is lit evenly, edge to edge.
    if (!ph) a.candles.addLights(Ls, CANDLES);
    Ls.add(W / 2, 40, 1500, ROOF, 0.42 + this.wake * 0.6, 700);
    // Work light over the slab: big boards sit far from the candles, and their lower rows
    // must read before the first strike.
    const span = Math.max(L.right - L.left, L.frontBottom - L.top);
    if (ph) {
      Ls.add(L.cx, L.cy, span * 1.5, WORK, 0.62, span);
      // The tray in the column.
      Ls.add((ph.colL + ph.colR) / 2, L.trayY, 700, WORK, 0.45, 400);
    } else Ls.add(L.cx, L.cy, span * 0.95, WORK, 0.5, span * 0.55);
    const st = this.storm.light;
    Ls.add(st.x, st.y, L.pitch * 6, st.color, 0.55 * st.intensity, 160);
    let bx = 0;
    let by = 0;
    let bc: ArrayLike<number> | null = null;
    let glow = 0;
    for (let i = 0; i < this.activeBolts; i++) {
      const b = a.bolts[i]!;
      if (b.head) {
        bx = b.head.x;
        by = b.head.y;
        bc = b.head.colour;
      }
      glow = Math.max(glow, b.glow);
    }
    if (bc) Ls.add(bx, by, L.pitch * 5, bc, 1.1, 80);
    for (const m of this.machines) {
      if (m.light.intensity > 0.02)
        Ls.add(m.x, m.y, L.pitch * 4, m.light.color, m.light.intensity, 140);
    }
    for (const b of this.board) if (b.g.state === 'energised') addGemLight(Ls, b.g);
    for (const b of this.board) if (b.g.state !== 'energised') addGemLight(Ls, b.g, 0.6);
    if (this.showcase) addGemLight(Ls, this.showcase, 1.5);

    a.wall.light(Ls);
    a.floor.light(Ls);
    a.candles.light(Ls);
    a.gems.light(Ls);
    this.slab.light(Ls);

    const rig = this.rig.begin(0.19, 0.2, 0.27);
    rig.add(1812, 820, 1500, pitch('warm'), 1.4, 260);
    rig.add(96, 820, 1300, pitch('warm'), 1.2, 260);
    // A lamp over each machine so its cabinet, not just its label, reads on every board.
    for (const m of L.machines) {
      rig.add(m.x, m.y - m.size * 0.45, m.size * 1.5, WORK, 0.75, m.size * 0.7);
    }
    rig.add(st.x, st.y, 1100, st.color, 0.8 * st.intensity, 200);
    if (bc) rig.add(bx, by, 700, bc, 0.8 * Math.max(glow, 0.5), 80);
    const f = this.fuse;
    rig.add(f.eye.x, f.eye.y, 380, f.eye.color, f.eye.intensity, 40);
    let lit: Machine | null = null;
    for (const m of this.machines) if (!lit || m.light.intensity > lit.light.intensity) lit = m;
    if (lit && lit.light.intensity > 0.02) {
      rig.add(lit.light.x, lit.light.y, 500, lit.light.color, 0.6 * lit.light.intensity, 120);
    }

    // ── Draw ──
    frame.clear(0, 0, 0, 1);
    a.wall.draw(frame, W / 2, 540);
    if (!ph) {
      a.floor.draw(frame, W / 2, 1080 - 150, W, 300, undefined, 1, 0.18);
      a.candles.drawBodies(frame, CANDLES);
    }
    this.slab.draw(frame);
    this.drawCircuit(frame);
    for (const m of this.marks) {
      const pulse = m.pulse > 0 ? 0.72 + 0.28 * Math.sin(this.time * m.pulse + m.col * 0.7) : 1;
      this.slab.drawSocket(frame, m.col, m.row, m.state, m.color, m.intensity * pulse);
    }
    this.storm.draw(frame, rig);
    for (const m of this.machines) m.draw(frame, rig);

    const list = this.drawList;
    list.length = 0;
    for (const b of this.board) if (!b.hidden) list.push(b.g);
    for (const t of this.tray) if (t.size !== 0) list.push(t);
    a.gems.drawUnder(frame, list);
    this.drawHeldRing(frame);
    a.gems.drawGems(frame, list);

    if (this.held) {
      const h = this.held;
      const g = this.heldInst;
      g.kind = h.kind;
      // Turned gems show their turn. A straight gem shows the tray's upright turn, and over a
      // socket the way it would sit there (`heldFace`), so it never lands crosswise.
      g.rot = isRotational(h.kind) ? h.rot : h.snapped ? (this.heldFace ?? 0) : 0;
      g.x = h.x;
      g.y = h.y;
      g.seed = this.tray.find((t) => t.kind === h.kind)?.seed ?? 40;
      // held-gem: over a socket it would land in, the gem is a ghost sitting in that socket at
      // its turn: faint, flat, its glyph still clear, so the turn reads before it drops (and the
      // loupe, which copies these pixels, shows the same). Resting in a phone's tray slot it is
      // drawn as the tray draws its gems (idle, flat), only turned, inside its ring.
      g.lift = h.snapped ? 0 : (h.lift ?? 1);
      g.state = h.snapped ? 'ghost' : h.rest ? 'idle' : 'hover';
      g.size = h.size ?? L.gemSize * (h.snapped ? 1 : 1.05);
      g.glow = h.rest ? 1 : 1.1;
      // Resting in its slot it is the tray's own copy, turned (altar-hand.ts `updateTray`).
      if (!h.rest) {
        a.gems.drawUnder(frame, this.heldList);
        a.gems.drawGems(frame, this.heldList);
      }
    }

    if (this.showcase) {
      this.showcaseList[0] = this.showcase;
      a.gems.drawUnder(frame, this.showcaseList);
      a.gems.drawGems(frame, this.showcaseList);
    }

    for (let i = 0; i < this.activeBolts; i++) a.bolts[i]!.draw(frame);
    if (!ph) a.candles.drawFlames(frame, CANDLES);
    f.draw(frame, rig);
    frame.drawable(this.ctx.particles);
  }
}

export { DANGER, GOLD };

/**
 * The ring quad's size per unit of ring radius: the "ring" state strokes the cut's outline
 * shrunk by 1.16 and set 0.07 in (gem-wgsl.ts), so its corners land on the radius.
 */
function ringScale(kind: GemKind): number {
  return 1 / (cutRadius(kind) / 1.16 - 0.07);
}

/** The cut's corner radius, gem half-sizes. */
function cutRadius(kind: GemKind): number {
  return Math.max(...gemCutPoints(kind).map(([x, y]) => Math.hypot(x, y)));
}

/** Design px between a held tray gem's corners and its ring's line. */
const HELD_RING_GAP = 7;

function inside(L: AltarLayout, c: Cell): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < L.cols && c.y < L.rows;
}

/** Same hop either way round (guide stubs are two-way). */
function sameHop(p: PathHop, h: PathHop): boolean {
  const eq = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
  return (eq(p.from, h.from) && eq(p.to, h.to)) || (eq(p.from, h.to) && eq(p.to, h.from));
}

/**
 * Phones (mobile-5-moments): FUSE stands this far (design px) above the layout's floor line, so
 * his dark treads sit fully on screen above the bottom edge; his bubble's tail meets his head.
 */
export function phoneFuseLift(cssPx: number): number {
  return Math.round(5 * cssPx);
}
