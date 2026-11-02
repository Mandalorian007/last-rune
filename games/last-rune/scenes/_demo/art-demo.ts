/**
 * Dev-only material showcase (`?demo=art`). Not shipped (DEV-gated in main.ts).
 *
 * Views (`&view=` or keys 1–4):
 *   altar  : carved altar with sockets in every state, placed/energised gems, tray, candles
 *   sheet  : all 6 gems × all 5 states
 *   stress : 10×8 altar, 80 gems, candles, full light set (perf check)
 *   title  : gold embossed title and plates over the gem heap
 * Keys: H hud, P pause. `window.__art` exposes fps/frames/errors for headless checks.
 */
import { GameLoop, type Time } from '@engine/core';
import type { GpuContext, Surface } from '@engine/platform';
import { watchReducedMotion, watchVisibility } from '@engine/platform';
import { PostStack } from '@engine/post';
import { type Frame, gpuDiagnostics, Renderer, type RGBA } from '@engine/render';
import { type CandleInstance, CandleRenderer } from '../../art/materials/candles';
import { EmbossLabel, EmbossRenderer } from '../../art/materials/emboss';
import {
  addGemLight,
  type GemInstance,
  GemRenderer,
  type GemState,
} from '../../art/materials/gems';
import { LightSet } from '../../art/materials/lights';
import { LINEAR } from '../../art/materials/palette';
import { POST_PRESETS } from '../../art/materials/post-presets';
import {
  AltarSlab,
  createStoneFloor,
  createStoneWall,
  type SocketState,
  type StoneSurface,
} from '../../art/materials/stone';
import { GEM_KINDS, type GemKind } from '../../rules/types';

const W = 1920;
const H = 1080;
type View = 'altar' | 'sheet' | 'stress' | 'title';
const VIEWS: View[] = ['altar', 'sheet', 'stress', 'title'];
const STATES: GemState[] = ['idle', 'hover', 'placed', 'energised', 'dim'];

interface SocketMark {
  col: number;
  row: number;
  state: SocketState;
  color: Readonly<RGBA>;
}

interface ViewData {
  altar: AltarSlab | null;
  sockets: SocketMark[];
  gems: GemInstance[];
  candles: CandleInstance[];
  labels: { text: string; x: number; y: number }[];
}

const GOLD: RGBA = [LINEAR.gold[0] * 1.4, LINEAR.gold[1] * 1.4, LINEAR.gold[2] * 1.4, 1];

class ArtDemo {
  readonly lights = new LightSet();
  readonly wall: StoneSurface;
  readonly floor: StoneSurface;
  readonly gems: GemRenderer;
  readonly candles: CandleRenderer;
  readonly emboss: EmbossRenderer;
  readonly titleLabel: EmbossLabel;
  readonly playLabel: EmbossLabel;
  readonly badgeLabel: EmbossLabel;
  private readonly views: Record<View, ViewData>;
  view: View;
  time = 0;
  private readonly pt = { x: 0, y: 0 };

  constructor(
    private readonly renderer: Renderer,
    view: View,
  ) {
    this.wall = createStoneWall(renderer);
    this.floor = createStoneFloor(renderer, { height: 300 });
    this.gems = new GemRenderer(renderer);
    this.candles = new CandleRenderer(renderer);
    this.emboss = new EmbossRenderer();
    this.titleLabel = new EmbossLabel(renderer, {
      text: 'The Last Rune',
      font: '700 150px Georgia, "Times New Roman", serif',
      width: 1300,
      height: 240,
    });
    this.playLabel = new EmbossLabel(renderer, {
      text: 'Play',
      font: '700 64px Georgia, "Times New Roman", serif',
      width: 340,
      height: 120,
      plate: true,
    });
    this.badgeLabel = new EmbossLabel(renderer, {
      text: 'Bend unlocked',
      font: '700 40px Georgia, "Times New Roman", serif',
      width: 420,
      height: 96,
      plate: true,
    });
    this.views = {
      altar: this.buildAltarView(),
      sheet: this.buildSheetView(),
      stress: this.buildStressView(),
      title: this.buildTitleView(),
    };
    this.view = view;
  }

  private edgeCandles(): CandleInstance[] {
    return [
      { x: 130, y: 1010, height: 210, seed: 1, melt: 0.6 },
      { x: 250, y: 1030, height: 140, seed: 2, melt: 0.3 },
      { x: 1680, y: 1030, height: 160, seed: 3, melt: 0.5 },
      { x: 1795, y: 1005, height: 230, seed: 4, melt: 0.7 },
      { x: 470, y: 800, height: 120, seed: 5, melt: 0.5, radius: 650 },
      { x: 1450, y: 790, height: 150, seed: 6, melt: 0.2, radius: 650 },
    ];
  }

  private buildAltarView(): ViewData {
    const altar = new AltarSlab(this.renderer, { cols: 6, rows: 4, pitch: 112, seed: 5 });
    altar.place(W / 2, 430);
    const pt = this.pt;
    const gems: GemInstance[] = [];
    const placed: [GemKind, number, number, number, GemState][] = [
      ['channel', 0, 1, 1, 'energised'],
      ['amplify', 1, 1, 1, 'energised'],
      ['bend', 2, 1, 1, 'energised'],
      ['split', 2, 2, 0, 'energised'],
      ['channel', 1, 3, 1, 'placed'],
      ['gate', 4, 2, 0, 'placed'],
      ['capacitor', 4, 0, 0, 'placed'],
    ];
    let seed = 1;
    for (const [kind, c, r, rot, state] of placed) {
      altar.socketCenter(c, r, pt);
      gems.push({ kind, x: pt.x, y: pt.y, size: 84, state, rot, seed: seed++ });
    }
    // Tray: one of each, the chosen one lifted.
    GEM_KINDS.forEach((kind, i) => {
      gems.push({
        kind,
        x: W / 2 - 375 + i * 150,
        y: 930,
        size: 92,
        state: i === 1 ? 'hover' : 'idle',
        lift: i === 1 ? 1 : 0,
        seed: 10 + i,
      });
    });
    const sockets: SocketMark[] = [
      { col: 5, row: 3, state: 'blocked', color: GOLD },
      { col: 0, row: 0, state: 'blocked', color: GOLD },
      { col: 3, row: 2, state: 'highlighted', color: GOLD },
      { col: 3, row: 1, state: 'highlighted', color: GOLD },
      { col: 5, row: 1, state: 'wanted', color: LINEAR.split },
    ];
    return { altar, sockets, gems, candles: this.edgeCandles(), labels: [] };
  }

  private buildSheetView(): ViewData {
    const gems: GemInstance[] = [];
    const labels: ViewData['labels'] = [];
    const x0 = 560;
    const y0 = 210;
    const dx = 170;
    const dy = 165;
    GEM_KINDS.forEach((kind, i) => {
      labels.push({ text: kind, x: x0 + i * dx, y: y0 - 110 });
      STATES.forEach((state, j) => {
        gems.push({
          kind,
          x: x0 + i * dx,
          y: y0 + j * dy,
          size: 116,
          state,
          lift: state === 'hover' ? 1 : 0,
          rot: 0,
          seed: i * 5 + j,
        });
      });
    });
    STATES.forEach((s, j) => {
      labels.push({ text: s, x: x0 - 150, y: y0 + j * dy });
    });
    return { altar: null, sockets: [], gems, candles: this.edgeCandles(), labels };
  }

  private buildStressView(): ViewData {
    const altar = new AltarSlab(this.renderer, { cols: 10, rows: 8, pitch: 96, seed: 9 });
    altar.place(W / 2, 470);
    const pt = this.pt;
    const gems: GemInstance[] = [];
    const states: GemState[] = ['placed', 'energised', 'placed', 'idle'];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 10; c++) {
        altar.socketCenter(c, r, pt);
        const k = (c + r * 3) % 6;
        gems.push({
          kind: GEM_KINDS[k]!,
          x: pt.x,
          y: pt.y,
          size: 74,
          state: states[(c * 7 + r) % 4]!,
          rot: (c + r) % 4,
          seed: c * 13 + r,
        });
      }
    }
    return { altar, sockets: [], gems, candles: this.edgeCandles().slice(0, 4), labels: [] };
  }

  private buildTitleView(): ViewData {
    const gems: GemInstance[] = [];
    // A heap of gems on a low altar.
    const heap: [GemKind, number, number, number][] = [
      ['channel', -150, 40, 0.3],
      ['bend', -60, 10, -0.2],
      ['split', 40, 30, 0.1],
      ['amplify', 140, 45, 0.5],
      ['gate', -100, 95, -0.4],
      ['capacitor', 70, 100, 0.2],
    ];
    heap.forEach(([kind, dx, dy, rot], i) => {
      gems.push({
        kind,
        x: W / 2 + dx,
        y: 640 + dy,
        size: 104,
        state: 'energised',
        rot,
        glow: 0.8,
        seed: i * 3.3,
      });
    });
    return { altar: null, sockets: [], gems, candles: this.edgeCandles(), labels: [] };
  }

  get data(): ViewData {
    return this.views[this.view];
  }

  update(dt: number): void {
    this.time += dt;
    this.candles.update(this.data.candles, this.time);
  }

  render(frame: Frame): void {
    const v = this.data;
    const L = this.lights;
    const t = this.time;
    L.begin(0.06, 0.062, 0.085, 0.5, 0.75);
    this.candles.addLights(L, v.candles);
    // Cool storm/ambient light from above centre.
    L.add(W / 2, 60, 1500, [0.5, 0.62, 0.95], 0.45, 700);
    for (const g of v.gems) if (g.state === 'energised') addGemLight(L, g);
    for (const g of v.gems) if (g.state !== 'energised') addGemLight(L, g, 0.7);

    this.wall.light(L);
    this.floor.light(L);
    this.candles.light(L);
    this.gems.light(L);
    this.emboss.light(L);
    v.altar?.light(L);

    frame.clear(0, 0, 0, 1);
    this.wall.draw(frame, W / 2, H / 2);
    this.floor.draw(frame, W / 2, H - 150, W, 300, undefined, 1, 0.18);
    if (v.altar) {
      v.altar.draw(frame);
      for (const s of v.sockets) {
        const pulse = s.state === 'blocked' ? 1 : 0.75 + 0.25 * Math.sin(t * 2.5 + s.col);
        v.altar.drawSocket(frame, s.col, s.row, s.state, s.color, pulse);
      }
    }
    this.candles.drawBodies(frame, v.candles);
    this.gems.drawUnder(frame, v.gems);
    this.gems.drawGems(frame, v.gems);
    this.candles.drawFlames(frame, v.candles);
    if (this.view === 'title') {
      this.emboss.draw(frame, this.titleLabel, W / 2, 250);
      this.emboss.draw(frame, this.playLabel, W / 2, 900);
      this.emboss.draw(frame, this.badgeLabel, 1560, 120);
    }
  }
}

export interface ArtDiagnostics {
  frames: number;
  fps: number;
  errors: typeof gpuDiagnostics;
  stats: Renderer['stats'];
  extra: { view: View; gems: number; lights: number };
  setView(v: View): void;
}

export function startArtDemo(surface: Surface, gpu: GpuContext): void {
  const qs = new URLSearchParams(location.search);
  const initial = (VIEWS as string[]).includes(qs.get('view') ?? '')
    ? (qs.get('view') as View)
    : 'altar';

  const renderer = new Renderer(gpu, { logicalWidth: W, logicalHeight: H });
  const post = new PostStack(renderer);
  renderer.post = post;
  surface.onResize(({ backbuffer }) => renderer.resize(backbuffer.width, backbuffer.height));

  const demo = new ArtDemo(renderer, initial);
  const presetFor = (v: View) => (v === 'title' ? POST_PRESETS.title : POST_PRESETS.altar);
  post.set(presetFor(initial));
  watchReducedMotion((reduced) => {
    demo.candles.reducedMotion = reduced;
  });

  const hud = document.createElement('div');
  hud.style.cssText =
    'position:fixed;left:8px;top:8px;font:12px/1.4 ui-monospace,monospace;color:#cfe;' +
    'background:#0008;padding:6px 8px;border-radius:4px;pointer-events:none;z-index:10;white-space:pre';
  surface.root.appendChild(hud);
  if (qs.has('nohud')) hud.hidden = true;

  // DOM labels for the sheet view (text is DOM per D-009).
  const labelLayer = document.createElement('div');
  labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5';
  surface.root.appendChild(labelLayer);
  const placeLabels = () => {
    labelLayer.replaceChildren();
    const rect = surface.canvas.getBoundingClientRect();
    const sx = rect.width / W;
    const sy = rect.height / H;
    for (const l of demo.data.labels) {
      const el = document.createElement('div');
      el.textContent = l.text;
      el.style.cssText =
        `position:fixed;left:${rect.left + l.x * sx}px;top:${rect.top + l.y * sy}px;` +
        'transform:translate(-50%,-50%);font:600 15px Georgia,serif;letter-spacing:.08em;' +
        'text-transform:uppercase;color:#e8c77a;text-shadow:0 1px 2px #000';
      labelLayer.appendChild(el);
    }
  };

  const diag: ArtDiagnostics = {
    frames: 0,
    fps: 0,
    errors: gpuDiagnostics,
    stats: renderer.stats,
    extra: { view: initial, gems: demo.data.gems.length, lights: 0 },
    setView: (v) => {
      demo.view = v;
      post.set(presetFor(v));
      diag.extra.view = v;
      diag.extra.gems = demo.data.gems.length;
      placeLabels();
    },
  };
  (window as unknown as { __art: ArtDiagnostics }).__art = diag;
  surface.onResize(() => placeLabels());
  placeLabels();

  let fpsAcc = 0;
  let fpsFrames = 0;
  const loop = new GameLoop({
    update: (dt: number) => demo.update(dt),
    render: (_alpha: number, time: Time) => {
      const frame = renderer.beginFrame(time.realTime, time.frameDt);
      demo.render(frame);
      renderer.endFrame();
      diag.frames++;
      diag.extra.lights = demo.lights.count;
      fpsAcc += time.frameDt;
      fpsFrames++;
      if (fpsAcc >= 0.5) {
        diag.fps = fpsFrames / fpsAcc;
        fpsAcc = 0;
        fpsFrames = 0;
        hud.textContent =
          `${diag.fps.toFixed(0)} fps  ${renderer.stats.drawCalls} draws  ${renderer.stats.instances} inst\n` +
          `view ${demo.view} (1-4)  gems ${demo.data.gems.length}  lights ${demo.lights.count}\n` +
          `gpu errors ${gpuDiagnostics.errorCount}  H hud  P pause`;
      }
    },
  });
  loop.start();
  watchVisibility((visible) => {
    if (visible) loop.start();
    else loop.stop();
  });
  window.addEventListener('keydown', (e) => {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < VIEWS.length) diag.setView(VIEWS[i]!);
    else if (e.key === 'h' || e.key === 'H') hud.hidden = !hud.hidden;
    else if (e.key === 'p' || e.key === 'P') loop.paused = !loop.paused;
  });
}
