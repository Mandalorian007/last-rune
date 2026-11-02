/**
 * Dev-only props showcase (`?demo=props`): FUSE, the storm cell, the bolt ribbon, the machine
 * with its gauge, and hall alcoves, all animating. Not shipped (DEV-gated in main.ts).
 *
 * The demo loops exact (solve flash, gauge pins, machine wakes, alcove restores) → over (breaker)
 * → under (fizzle). Keys: 1 exact · 2 over · 3 under · S storm strength · F FUSE mood ·
 * R roll out/in · C caption · H hud.
 * URL: `&shot=fuse|storm|machine|alcove|bolt|portrait` close-ups, `&t=<s>` fast-forward,
 * `&strength=1|2|4`, `&mood=idle|talk|quiet`, `&mode=exact|over|under` (first bolt), `&hold`
 * (don't auto-cycle), `&nohud`, `&caption` (caption card with FUSE's portrait).
 */
import { GameLoop, type Scene, SceneStack, type Time } from '@engine/core';
import { flicker, ParticleSystem } from '@engine/fx';
import type { GpuContext, Surface } from '@engine/platform';
import { watchVisibility } from '@engine/platform';
import { PostStack } from '@engine/post';
import {
  type DrawParams,
  type Frame,
  gpuDiagnostics,
  type Material,
  Renderer,
} from '@engine/render';
import { createOverlay } from '@engine/ui';
import { Alcove } from '../../art/props/alcove';
import { type BoltMode, BoltRibbon, boltSegmentsFromPolyline } from '../../art/props/bolt';
import { Fuse, type FuseMood } from '../../art/props/fuse';
import { createFusePortrait, type FusePortrait } from '../../art/props/fuse-portrait';
import { PropLightRig } from '../../art/props/lighting';
import { Machine } from '../../art/props/machine';
import { pitch } from '../../art/props/palette';
import { StormCell } from '../../art/props/storm';
import type { StormStrength } from '../../rules/types';
import { LIT_STONE_FLOATS, LIT_STONE_WGSL, MAX_LIGHTS, STONE_TEXTURE_WGSL } from './demo-shaders';

const W = 1920;
const H = 1080;

interface Ctx {
  renderer: Renderer;
  post: PostStack;
  surface: Surface;
}

const SHOTS: Record<string, [number, number, number]> = {
  fuse: [760, 800, 2.4],
  storm: [330, 450, 2.2],
  machine: [1560, 600, 2.4],
  alcove: [1020, 250, 2.4],
  bolt: [930, 560, 1.5],
};

/** Fake circuit: storm → five "gems" → machine terminal. */
const PATH_COLOURS = [
  pitch('cyan', 1.6),
  pitch('amethyst', 1.8),
  pitch('magenta', 1.6),
  pitch('amber', 1.5),
  pitch('emerald', 1.4),
  pitch('ice', 1.4),
];
const MODES: BoltMode[] = ['exact', 'over', 'under'];
const CHARGE: Record<BoltMode, number> = { exact: 2, over: 4, under: 0.6 };

class PropsDemoScene implements Scene<Ctx, Frame> {
  readonly name = 'props-demo';
  time = 0;
  fuse!: Fuse;
  storm!: StormCell;
  machine!: Machine;
  bolt!: BoltRibbon;
  particles!: ParticleSystem;
  alcoves: Alcove[] = [];
  portrait!: FusePortrait;
  /** Demo cycle: which mode is running and how long since it fired. */
  mode: BoltMode = 'exact';
  auto = true;
  private phaseT = 0;
  private arrived = false;
  private stone!: Material;
  private readonly lights = new PropLightRig();
  private readonly wallLights = new Float32Array(LIT_STONE_FLOATS);
  private readonly dp: DrawParams = { x: 0, y: 0 };
  private wallCount = 0;

  enter(ctx: Ctx): void {
    const r = ctx.renderer;
    const stoneTex = r.textureFromShader({
      width: 1600,
      height: 900,
      wgsl: STONE_TEXTURE_WGSL,
      label: 'props-stone',
    });
    this.stone = r.createMaterial({
      label: 'props-wall',
      wgsl: LIT_STONE_WGSL,
      blend: 'opaque',
      uniformBytes: LIT_STONE_FLOATS * 4,
      textures: 1,
    });
    this.stone.setTexture(0, stoneTex);
    this.particles = new ParticleSystem(r, { capacity: 8192, floorY: 1030 });
    this.storm = new StormCell(r, { x: 330, y: 470, size: 460, strength: 2 });
    this.machine = new Machine(r, { x: 1590, y: 610, size: 400 });
    this.bolt = new BoltRibbon(r, { particles: this.particles });
    const a0 = new Alcove(r, { x: 860, y: 230, size: 300 });
    a0.setNeeds([
      { type: 'gem', gem: 'bend' },
      { type: 'storm', strength: 4 },
    ]);
    const a1 = new Alcove(r, { x: 1180, y: 230, size: 300 });
    a1.setNeeds([
      { type: 'gem', gem: 'split' },
      { type: 'gem', gem: 'amplify' },
      { type: 'altar', size: '8x6' },
    ]);
    this.alcoves = [a0, a1];
    this.fuse = new Fuse(r, { x: 760, y: 990, scale: 150 });
    this.portrait = createFusePortrait(r, { size: 160 });
  }

  exit(): void {
    this.portrait.destroy();
    this.storm.destroy();
  }

  fire(mode: BoltMode): void {
    this.mode = mode;
    this.phaseT = 0;
    this.arrived = false;
    this.machine.reset();
    this.alcoves[1]!.lock();
    const o = this.storm.sphere;
    const t = this.machine.terminal;
    const pts = [
      { x: o.x, y: o.y },
      { x: 610, y: 600 },
      { x: 790, y: 470 },
      { x: 990, y: 640 },
      { x: 1110, y: 500 },
      { x: 1250, y: 610 },
      { x: t.x, y: t.y },
    ];
    // Under-charged bolts give out before the last gems.
    const path = mode === 'under' ? pts.slice(0, 5) : pts;
    this.bolt.play(
      boltSegmentsFromPolyline(path, {
        colours: PATH_COLOURS,
        charges: CHARGE[mode],
        speed: mode === 'under' ? 900 : 1500,
      }),
      mode,
    );
    this.storm.surge(mode === 'over' ? 1.5 : 1);
  }

  update(dt: number): void {
    this.time += dt;
    this.phaseT += dt;
    const bolt = this.bolt;
    if (!this.arrived && bolt.time >= bolt.duration && this.phaseT > 0.05) {
      this.arrived = true;
      if (this.mode === 'exact') {
        this.machine.solve();
        bolt.flash();
        this.alcoves[1]!.unlock();
        this.fuse.speak(1.8);
      } else if (this.mode === 'over') {
        this.machine.breaker();
      } else {
        this.machine.gauge = 0;
      }
    }
    // Under: the needle twitches up with the weak charge as it travels, then sags back.
    if (this.mode === 'under' && !this.arrived) {
      this.machine.gauge = 0.45 * Math.min(bolt.time / Math.max(bolt.duration, 1e-3), 1);
    }
    if (this.mode === 'exact' && this.arrived && this.phaseT > bolt.duration + 1.4) {
      this.alcoves[1]!.restore();
    }
    if (this.mode === 'exact' && this.phaseT > bolt.duration + 3.2) bolt.fadeOut(0.5);
    const hold = { exact: 4.6, over: 4.4, under: 3.6 }[this.mode];
    if (this.auto && this.phaseT > bolt.duration + hold) {
      this.fire(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]!);
    }
    this.fuse.update(dt);
    this.storm.update(dt);
    this.machine.update(dt);
    bolt.update(dt);
    for (const a of this.alcoves) a.update(dt);
    this.particles.update(dt);
    // FUSE watches the bolt head while it travels.
    const h = bolt.head;
    if (h) this.fuse.lookAt(h.x, h.y);
  }

  private wallLight(x: number, y: number, radius: number, c: ArrayLike<number>, k: number): void {
    if (this.wallCount >= MAX_LIGHTS) return;
    const o = 4 + this.wallCount++ * 8;
    const L = this.wallLights;
    L[o] = x;
    L[o + 1] = y;
    L[o + 2] = radius;
    L[o + 4] = c[0]!;
    L[o + 5] = c[1]!;
    L[o + 6] = c[2]!;
    L[o + 7] = k;
  }

  render(frame: Frame): void {
    const t = this.time;
    const { fuse, storm, machine, bolt } = this;
    const candle = flicker(t, { seed: 3, amount: 0.3 });
    const head = bolt.head;
    const boltX = head ? head.x : bolt.end.x;
    const boltY = head ? head.y : bolt.end.y;
    const boltC = head ? head.colour : pitch('ice');
    const lit = this.alcoves[1]!;
    // Wall lighting.
    const WL = this.wallLights;
    WL.fill(0);
    WL[0] = 0.05;
    WL[1] = 0.055;
    WL[2] = 0.08;
    WL[3] = 0.55;
    this.wallCount = 0;
    this.wallLight(1880, 900, 700, pitch('warm'), 1.2 * candle);
    this.wallLight(fuse.eye.x, fuse.eye.y, 380, fuse.eye.color, 0.9 * fuse.eye.intensity);
    this.wallLight(
      storm.light.x,
      storm.light.y,
      800,
      storm.light.color,
      0.8 * storm.light.intensity,
    );
    this.wallLight(
      machine.light.x,
      machine.light.y,
      700,
      machine.light.color,
      0.7 * machine.light.intensity,
    );
    this.wallLight(boltX, boltY, 600, boltC, 0.9 * bolt.glow);
    this.wallLight(lit.light.x, lit.light.y, 500, lit.light.color, lit.light.intensity);
    this.stone.setUniforms(WL);

    // Prop lighting (6 lights max).
    const L = this.lights.begin(0.16, 0.17, 0.24);
    L.add(1880, 860, 1500, pitch('warm'), 1.8 * candle, 260);
    L.add(storm.light.x, storm.light.y, 1300, storm.light.color, 0.9 * storm.light.intensity, 200);
    L.add(fuse.eye.x, fuse.eye.y, 420, fuse.eye.color, fuse.eye.intensity, 40);
    L.add(
      machine.light.x,
      machine.light.y - 40,
      600,
      machine.light.color,
      0.3 * machine.light.intensity,
      260,
    );
    L.add(boltX, boltY, 700, boltC, 0.8 * bolt.glow, 80);
    L.add(lit.light.x, lit.light.y, 450, lit.light.color, 0.6 * lit.light.intensity, 120);

    frame.clear(0, 0, 0, 1);
    const dp = this.dp;
    dp.x = W / 2;
    dp.y = H / 2;
    dp.w = W;
    dp.h = H;
    frame.sprite(this.stone, dp);
    for (const a of this.alcoves) a.draw(frame, L);
    storm.draw(frame, L);
    machine.draw(frame, L);
    fuse.draw(frame, L);
    bolt.draw(frame);
    frame.drawable(this.particles);
    this.portrait.render(fuse.state);
  }
}

export interface PropsDemoDiagnostics {
  frames: number;
  fps: number;
  errors: typeof gpuDiagnostics;
  stats: Renderer['stats'];
  scene: PropsDemoScene;
}

export function startPropsDemo(surface: Surface, gpu: GpuContext): void {
  const qs = new URLSearchParams(location.search);
  const renderer = new Renderer(gpu, { logicalWidth: W, logicalHeight: H });
  const post = new PostStack(renderer, {
    godRays: { x: 330, y: 450, bloomSource: 0.1, sourceIntensity: 0 },
    fog: { density: 0.55 },
  });
  renderer.post = post;
  surface.onResize(({ backbuffer }) => renderer.resize(backbuffer.width, backbuffer.height));

  const scene = new PropsDemoScene();
  const stack = new SceneStack<Ctx, Frame>({ renderer, post, surface });
  stack.push(scene);

  const mood = qs.get('mood') as FuseMood | null;
  if (mood) scene.fuse.mood = mood;
  const strength = Number(qs.get('strength'));
  if (strength === 1 || strength === 2 || strength === 4) scene.storm.strength = strength;
  if (qs.has('hold')) scene.auto = false;
  const first = (qs.get('mode') as BoltMode | null) ?? 'exact';
  scene.fire(MODES.includes(first) ? first : 'exact');
  const skip = Number(qs.get('t')) || 0;
  for (let s = 0; s < skip; s += 1 / 60) stack.update(1 / 60);

  const shot = qs.get('shot');
  if (shot && SHOTS[shot]) {
    const [x, y, z] = SHOTS[shot];
    renderer.camera.x = x - W / 2;
    renderer.camera.y = y - H / 2;
    renderer.camera.zoom = z;
  }

  // FUSE's portrait in the engine/ui caption card, exactly as the game will use it.
  const ui = createOverlay({ parent: surface.root });
  surface.onResize(({ rect }) => ui.setRect(rect));
  const pc = scene.portrait.canvas;
  if (shot === 'portrait') {
    pc.style.cssText +=
      ';position:fixed;right:16px;bottom:16px;z-index:10;width:480px;height:480px';
    document.body.appendChild(pc);
  }
  const lines = [
    'Storm cell is humming. Route it through the gems, mind the gauge.',
    'Breaker tripped. Too much. That costs us a day.',
    'Not enough to wake it. It needs more.',
  ];
  let line = 0;
  const say = (): void => {
    void ui.caption.say(lines[line++ % lines.length]!, { speaker: 'FUSE', portrait: pc, hold: 0 });
  };
  if (qs.has('caption')) say();

  const hud = document.createElement('div');
  hud.style.cssText =
    'position:fixed;left:8px;top:8px;font:12px/1.4 ui-monospace,monospace;color:#cfe;' +
    'background:#0008;padding:6px 8px;border-radius:4px;pointer-events:none;z-index:10;white-space:pre';
  if (qs.has('nohud')) hud.hidden = true;
  surface.root.appendChild(hud);

  const diag: PropsDemoDiagnostics = {
    frames: 0,
    fps: 0,
    errors: gpuDiagnostics,
    stats: renderer.stats,
    scene,
  };
  (window as unknown as { __props: PropsDemoDiagnostics }).__props = diag;

  let fpsAcc = 0;
  let fpsFrames = 0;
  const loop = new GameLoop({
    update: (dt: number) => stack.update(dt),
    render: (alpha: number, time: Time) => {
      const frame = renderer.beginFrame(time.realTime, time.frameDt);
      stack.render(frame, alpha);
      renderer.endFrame();
      diag.frames++;
      fpsAcc += time.frameDt;
      fpsFrames++;
      if (fpsAcc >= 0.5) {
        diag.fps = fpsFrames / fpsAcc;
        fpsAcc = 0;
        fpsFrames = 0;
        hud.textContent =
          `${diag.fps.toFixed(0)} fps  ${renderer.stats.drawCalls} draws  gpu errors ${gpuDiagnostics.errorCount}\n` +
          `FUSE ${scene.fuse.mood}  storm ${scene.storm.strength}x  bolt ${scene.mode}` +
          `  gauge ${(scene.machine.reading * 100).toFixed(0)}%\n` +
          '1 exact 2 over 3 under  S storm  F mood  R roll  C caption  H hud';
      }
    },
  });
  loop.start();
  watchVisibility((visible) => {
    if (visible) loop.start();
    else loop.stop();
  });

  const moods: FuseMood[] = ['idle', 'talk', 'quiet'];
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === '1' || k === '2' || k === '3') scene.fire(MODES[Number(k) - 1]!);
    else if (k === 'f')
      scene.fuse.mood = moods[(moods.indexOf(scene.fuse.mood) + 1) % moods.length]!;
    else if (k === 'r') scene.fuse.rollTo(scene.fuse.x > 0 ? -300 : 760);
    else if (k === 'c') say();
    else if (k === 'h') hud.hidden = !hud.hidden;
    else if (k === 's') {
      const order: StormStrength[] = [1, 2, 4];
      scene.storm.strength = order[(order.indexOf(scene.storm.strength) + 1) % 3]!;
    }
  });
  const pt = { x: 0, y: 0 };
  surface.canvas.addEventListener('pointermove', (e) => {
    surface.clientToLogical(e.clientX, e.clientY, pt);
    scene.fuse.lookAt(pt.x, pt.y);
  });
}
