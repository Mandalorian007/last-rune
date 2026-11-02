/**
 * Dev-only props showcase (`?demo=props`): FUSE, the storm cell, the bolt ribbon, the machine
 * with its gauge, and hall alcoves, all animating. Not shipped (DEV-gated in main.ts).
 *
 * URL: `&shot=fuse|storm|machine|alcove|bolt|portrait` zooms the camera for close-ups,
 * `&t=<seconds>` fast-forwards the demo clock, `&strength=1|2|4`, `&mood=idle|talk|quiet`.
 * Keys: 1 exact · 2 over · 3 under · S storm strength · F FUSE mood · R roll out/in · H hud.
 */
import { GameLoop, type Scene, SceneStack, type Time } from '@engine/core';
import { flicker } from '@engine/fx';
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
import { Fuse, type FuseMood } from '../../art/props/fuse';
import { createFusePortrait, type FusePortrait } from '../../art/props/fuse-portrait';
import { PropLightRig } from '../../art/props/lighting';
import { pitch } from '../../art/props/palette';
import { StormCell, type StormStrength } from '../../art/props/storm';
import { LIT_STONE_FLOATS, LIT_STONE_WGSL, MAX_LIGHTS, STONE_TEXTURE_WGSL } from './demo-shaders';

const W = 1920;
const H = 1080;

interface Ctx {
  renderer: Renderer;
  post: PostStack;
  surface: Surface;
}

const SHOTS: Record<string, [number, number, number]> = {
  fuse: [700, 790, 2.4],
  storm: [330, 400, 2.2],
  machine: [1560, 560, 2.2],
  alcove: [1040, 220, 2.6],
  bolt: [900, 520, 1.6],
};

class PropsDemoScene implements Scene<Ctx, Frame> {
  readonly name = 'props-demo';
  time = 0;
  fuse!: Fuse;
  storm!: StormCell;
  portrait!: FusePortrait;
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
    this.storm = new StormCell(r, { x: 330, y: 420, size: 460, strength: 1 });
    this.fuse = new Fuse(r, { x: 700, y: 980, scale: 160 });
    this.portrait = createFusePortrait(r, { size: 160 });
  }

  exit(): void {
    this.portrait.destroy();
    this.storm.destroy();
  }

  update(dt: number): void {
    this.time += dt;
    this.fuse.update(dt);
    this.storm.update(dt);
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
    const fuse = this.fuse;
    const candle = flicker(t, { seed: 3, amount: 0.3 });
    const storm = this.storm;
    // Wall lighting.
    const WL = this.wallLights;
    WL.fill(0);
    WL[0] = 0.05;
    WL[1] = 0.055;
    WL[2] = 0.08;
    WL[3] = 0.55;
    this.wallCount = 0;
    this.wallLight(120, 700, 700, pitch('warm'), 1.4 * candle);
    this.wallLight(fuse.eye.x, fuse.eye.y, 380, fuse.eye.color, 0.9 * fuse.eye.intensity);
    this.wallLight(
      storm.light.x,
      storm.light.y,
      800,
      storm.light.color,
      0.8 * storm.light.intensity,
    );
    this.stone.setUniforms(WL);

    // Prop lighting.
    const L = this.lights.begin(0.16, 0.17, 0.24);
    L.add(120, 640, 1500, pitch('warm'), 1.8 * candle, 260);
    L.add(1500, 300, 1500, pitch('cyan'), 0.8, 300);
    L.add(storm.light.x, storm.light.y, 1400, storm.light.color, 0.9 * storm.light.intensity, 200);
    L.add(fuse.eye.x, fuse.eye.y, 420, fuse.eye.color, 1.0 * fuse.eye.intensity, 40);

    frame.clear(0, 0, 0, 1);
    const dp = this.dp;
    dp.x = W / 2;
    dp.y = H / 2;
    dp.w = W;
    dp.h = H;
    frame.sprite(this.stone, dp);
    storm.draw(frame, L);
    fuse.draw(frame, L);
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
    godRays: { x: 330, y: 400, bloomSource: 0.1, sourceIntensity: 0 },
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
  const skip = Number(qs.get('t')) || 0;
  for (let s = 0; s < skip; s += 1 / 60) stack.update(1 / 60);

  const shot = qs.get('shot');
  if (shot && SHOTS[shot]) {
    const [x, y, z] = SHOTS[shot];
    renderer.camera.x = x - W / 2;
    renderer.camera.y = y - H / 2;
    renderer.camera.zoom = z;
  }

  // The portrait canvas, shown as it would sit in the caption card.
  const pc = scene.portrait.canvas;
  pc.style.cssText += ';position:fixed;right:16px;bottom:16px;z-index:10';
  if (shot === 'portrait') {
    pc.style.width = '480px';
    pc.style.height = '480px';
  }
  document.body.appendChild(pc);

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
          `FUSE ${scene.fuse.mood}\n` +
          '1 exact 2 over 3 under  S storm  F mood  R roll  H hud';
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
    if (k === 'f') scene.fuse.mood = moods[(moods.indexOf(scene.fuse.mood) + 1) % moods.length]!;
    else if (k === 'r') scene.fuse.rollTo(scene.fuse.x > 0 ? -300 : 700);
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
