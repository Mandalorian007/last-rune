/**
 * Dev-only render showcase (`?demo=render`). Exercises every engine-render feature:
 * procedural texture, custom game materials, instanced sprites, HDR emissive → bloom,
 * floor mist, god rays, compute particles, light flicker. Not shipped (DEV-gated in main.ts).
 *
 * Keys: 1 bloom · 2 fog · 3 god rays · 4 vignette · 5 grade · P pause · H hud.
 * Click / tap: spark burst. URL `&sparks=20000` sets the ambient particle target.
 */
import { GameLoop, type Scene, SceneStack, type Time } from '@thunderclap-engine/engine/core';
import { flicker, ParticleEmitter, ParticleSystem, pulse } from '@thunderclap-engine/engine/fx';
import type { GpuContext, Surface } from '@thunderclap-engine/engine/platform';
import { watchReducedMotion, watchVisibility } from '@thunderclap-engine/engine/platform';
import { PostStack } from '@thunderclap-engine/engine/post';
import {
  type DrawParams,
  type Frame,
  gpuDiagnostics,
  hex,
  type Material,
  Renderer,
  type RGBA,
} from '@thunderclap-engine/engine/render';
import {
  GLOW_WGSL,
  LIT_STONE_FLOATS,
  LIT_STONE_WGSL,
  MAX_LIGHTS,
  ORB_WGSL,
  STONE_TEXTURE_WGSL,
} from './demo-shaders';

const W = 1920;
const H = 1080;

const PALETTE: { name: string; color: RGBA }[] = [
  { name: 'cyan', color: hex('#3fe0ff') },
  { name: 'amethyst', color: hex('#9b5cff') },
  { name: 'magenta', color: hex('#ff3fb4') },
  { name: 'amber', color: hex('#ffb03f') },
  { name: 'emerald', color: hex('#3fff9a') },
  { name: 'ice', color: hex('#8fc8ff', 0.8) },
];
const CANDLE = hex('#ffb35c');
const FLAME: RGBA = [1.0, 0.75, 0.4, 1];

interface DemoCtx {
  renderer: Renderer;
  post: PostStack;
  surface: Surface;
}

interface Orb {
  x: number;
  y: number;
  r: number;
  color: RGBA;
  seed: number;
  emitter: ParticleEmitter;
}

interface Candle {
  x: number;
  y: number;
  h: number;
  seed: number;
}

class RenderDemoScene implements Scene<DemoCtx, Frame> {
  readonly name = 'render-demo';

  private stone!: Material;
  private orb!: Material;
  private glow!: Material;
  private particles!: ParticleSystem;
  private dust!: ParticleEmitter;
  private readonly lights = new Float32Array(LIT_STONE_FLOATS);
  private readonly orbs: Orb[] = [];
  private readonly candles: Candle[] = [];
  private time = 0;
  private lightCount = 0;
  private readonly addLightBound = this.addLight.bind(this);
  private readonly stormLight = [0.55, 0.7, 1.0];
  // Reused draw records (no per-frame garbage).
  private readonly dp: DrawParams = { x: 0, y: 0 };
  private readonly tint: RGBA = [1, 1, 1, 1];
  private readonly params = [0, 0, 0, 0];

  constructor(private readonly sparkTarget: number) {}

  enter(ctx: DemoCtx): void {
    const r = ctx.renderer;
    const stoneTex = r.textureFromShader({
      width: 1600,
      height: 900,
      wgsl: STONE_TEXTURE_WGSL,
      label: 'demo-stone',
    });
    this.stone = r.createMaterial({
      label: 'demo-lit-stone',
      wgsl: LIT_STONE_WGSL,
      blend: 'opaque',
      uniformBytes: LIT_STONE_FLOATS * 4,
      textures: 1,
    });
    this.stone.setTexture(0, stoneTex);
    this.orb = r.createMaterial({ label: 'demo-orb', wgsl: ORB_WGSL, blend: 'alpha' });
    this.glow = r.createMaterial({ label: 'demo-glow', wgsl: GLOW_WGSL, blend: 'additive' });

    this.particles = new ParticleSystem(r, {
      capacity: Math.max(65536, Math.ceil(this.sparkTarget * 1.5)),
      floorY: 1010,
    });

    const n = PALETTE.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = 520 + t * 880;
      const y = 640 - Math.sin(t * Math.PI) * 120;
      const color = PALETTE[i]!.color;
      const emitter = new ParticleEmitter(
        this.particles,
        {
          x,
          y,
          shape: { kind: 'circle', radius: 40 },
          angle: -Math.PI / 2,
          spread: 1.2,
          speed: [30, 120],
          life: [1.0, 2.2],
          size: [5, 0],
          colorStart: [color[0] * 4, color[1] * 4, color[2] * 4, 1],
          colorEnd: [color[0], color[1], color[2], 0],
          gravity: [0, -60],
          drag: 0.8,
          emissive: 1.5,
        },
        40,
      );
      this.orbs.push({ x, y, r: 62, color, seed: i * 1.7 + 0.3, emitter });
    }
    for (const [x, h] of [
      [210, 150],
      [330, 110],
      [1590, 120],
      [1710, 160],
    ] as const) {
      this.candles.push({ x, y: 930, h, seed: x });
    }
    // Ambient embers rising from the floor, sized to hit `sparkTarget` live particles.
    this.dust = new ParticleEmitter(
      this.particles,
      {
        x: 0,
        y: 1000,
        shape: { kind: 'line', dx: W, dy: 0 },
        angle: -Math.PI / 2,
        spread: 0.9,
        speed: [60, 340],
        life: [1.4, 3.0],
        size: [3, 0.5],
        colorStart: [2.4, 1.1, 0.4, 1],
        colorEnd: [0.5, 0.2, 0.9, 0],
        gravity: [0, -40],
        drag: 0.25,
        emissive: 1.2,
      },
      this.sparkTarget / 2.2,
    );
  }

  exit(): void {
    this.particles.destroy();
  }

  setReducedMotion(reduced: boolean): void {
    this.particles.spawnScale = reduced ? 0.25 : 1;
  }

  private addLight(x: number, y: number, radius: number, c: ArrayLike<number>, k: number): void {
    if (this.lightCount >= MAX_LIGHTS) return;
    const L = this.lights;
    const o = 4 + this.lightCount++ * 8;
    L[o] = x;
    L[o + 1] = y;
    L[o + 2] = radius;
    L[o + 4] = c[0]!;
    L[o + 5] = c[1]!;
    L[o + 6] = c[2]!;
    L[o + 7] = k;
  }

  burst(x: number, y: number): void {
    const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]!.color;
    this.particles.emit(
      {
        x,
        y,
        shape: { kind: 'circle', radius: 6 },
        spread: Math.PI * 2,
        speed: [200, 900],
        life: [0.6, 1.6],
        size: [7, 1],
        colorStart: [c[0] * 8, c[1] * 8, c[2] * 8, 1],
        colorEnd: [c[0] * 0.5, c[1] * 0.3, c[2] * 0.8, 0],
        gravity: [0, 900],
        drag: 1.6,
        emissive: 2,
      },
      2500,
    );
  }

  update(dt: number): void {
    this.time += dt;
    for (const o of this.orbs) o.emitter.update(dt);
    this.dust.update(dt);
    this.particles.update(dt);
  }

  render(frame: Frame): void {
    const t = this.time;
    const L = this.lights;
    L.fill(0);
    L[0] = 0.05;
    L[1] = 0.055;
    L[2] = 0.08;
    L[3] = 0.55;
    this.lightCount = 0;
    const light = this.addLightBound;
    for (const c of this.candles) {
      light(c.x, c.y - c.h - 30, 620, CANDLE, 1.6 * flicker(t, { seed: c.seed, amount: 0.35 }));
    }
    for (const o of this.orbs) {
      light(o.x, o.y, 420, o.color, 0.9 * pulse(t, { period: 3, phase: o.seed, min: 0.6 }));
    }
    // Cold storm light spilling from the top.
    light(W / 2, -200, 1100, this.stormLight, 0.6);
    this.stone.setUniforms(L);

    frame.clear(0, 0, 0, 1);
    const dp = this.dp;
    const tint = this.tint;
    const params = this.params;

    // Backdrop.
    set(dp, W / 2, H / 2, W, H, 0);
    dp.tint = undefined;
    dp.params = undefined;
    frame.sprite(this.stone, dp);

    // Altar ledge + floor shadow (default sprite = white texture × tint).
    tint[0] = 0.012;
    tint[1] = 0.012;
    tint[2] = 0.018;
    tint[3] = 0.85;
    set(dp, W / 2, 860, 1240, 46, 0);
    dp.tint = tint;
    frame.sprite(null, dp);

    // Candle bodies.
    for (const c of this.candles) {
      tint[0] = 0.09;
      tint[1] = 0.065;
      tint[2] = 0.045;
      tint[3] = 1;
      set(dp, c.x, c.y - c.h / 2, 46, c.h, 0);
      frame.sprite(null, dp);
    }
    // Candle flames + halos (additive glow material).
    for (const c of this.candles) {
      const f = flicker(t, { seed: c.seed, amount: 0.35 });
      const fy = c.y - c.h - 22;
      params[0] = 3;
      dp.params = params;
      setTint(tint, CANDLE, 0.35 * f, 1);
      set(dp, c.x, fy, 260 * f, 260 * f, 0);
      frame.sprite(this.glow, dp);
      params[0] = 4;
      setTint(tint, FLAME, 3 * f, 1);
      set(dp, c.x, fy, 26, 54 * (0.9 + 0.2 * f), Math.sin(t * 3 + c.seed) * 0.06);
      frame.sprite(this.glow, dp);
    }
    // Orb halos.
    for (const o of this.orbs) {
      const p = pulse(t, { period: 3, phase: o.seed, min: 0 });
      params[0] = 2.5;
      dp.params = params;
      setTint(tint, o.color, 0.25 + 0.2 * p, 1);
      set(dp, o.x, o.y, o.r * 5, o.r * 5, 0);
      frame.sprite(this.glow, dp);
    }
    // Orbs (custom game material: faceted gem with an inner glyph).
    for (const o of this.orbs) {
      const p = pulse(t, { period: 3, phase: o.seed, min: 0 });
      const bob = Math.sin(t * 1.3 + o.seed * 2) * 6;
      params[0] = p;
      params[1] = o.seed;
      dp.params = params;
      setTint(tint, o.color, 1, 1);
      set(dp, o.x, o.y + bob, o.r * 2, o.r * 2, 0);
      dp.emissive = 2.2;
      frame.sprite(this.orb, dp);
    }
    dp.emissive = 0;
    dp.params = undefined;
    frame.drawable(this.particles);
  }
}

function set(dp: DrawParams, x: number, y: number, w: number, h: number, rot: number): void {
  dp.x = x;
  dp.y = y;
  dp.w = w;
  dp.h = h;
  dp.rotation = rot;
}

function setTint(out: RGBA, c: ArrayLike<number>, k: number, a: number): void {
  out[0] = c[0]! * k;
  out[1] = c[1]! * k;
  out[2] = c[2]! * k;
  out[3] = a;
}

/** Diagnostics exposed on `window.__demo` for headless verification. */
export interface DemoDiagnostics {
  frames: number;
  fps: number;
  errors: typeof gpuDiagnostics;
  stats: Renderer['stats'];
  sparkTarget: number;
  burst(x: number, y: number): void;
  toggle(pass: 'bloom' | 'mist' | 'godRays' | 'vignette' | 'grade'): boolean;
}

export function startRenderDemo(surface: Surface, gpu: GpuContext): void {
  const qs = new URLSearchParams(location.search);
  const sparkTarget = Math.min(Math.max(Number(qs.get('sparks')) || 6000, 0), 200000);

  const renderer = new Renderer(gpu, { logicalWidth: W, logicalHeight: H });
  const post = new PostStack(renderer, {
    godRays: { x: W / 2, y: -60, bloomSource: 0.12 },
    mist: { density: 0.7 },
  });
  renderer.post = post;
  surface.onResize(({ backbuffer }) => renderer.resize(backbuffer.width, backbuffer.height));

  const scene = new RenderDemoScene(sparkTarget);
  const stack = new SceneStack<DemoCtx, Frame>({ renderer, post, surface });
  stack.push(scene);
  watchReducedMotion((reduced) => scene.setReducedMotion(reduced));

  const hud = document.createElement('div');
  hud.style.cssText =
    'position:fixed;left:8px;top:8px;font:12px/1.4 ui-monospace,monospace;color:#cfe;' +
    'background:#0008;padding:6px 8px;border-radius:4px;pointer-events:none;z-index:10;white-space:pre';
  surface.root.appendChild(hud);

  const diag: DemoDiagnostics = {
    frames: 0,
    fps: 0,
    errors: gpuDiagnostics,
    stats: renderer.stats,
    sparkTarget,
    burst: (x, y) => scene.burst(x, y),
    toggle: (pass) => {
      const s = post.settings[pass];
      s.enabled = !s.enabled;
      return s.enabled;
    },
  };
  (window as unknown as { __demo: DemoDiagnostics }).__demo = diag;

  let fpsAcc = 0;
  let fpsFrames = 0;
  const loop = new GameLoop({
    update: (dt: number) => stack.update(dt),
    render: (alpha: number, time: Time) => {
      const frame = renderer.beginFrame(time.realTime, time.frameDt);
      stack.render(frame, renderer.camera, alpha);
      renderer.endFrame();
      diag.frames++;
      fpsAcc += time.frameDt;
      fpsFrames++;
      if (fpsAcc >= 0.5) {
        diag.fps = fpsFrames / fpsAcc;
        fpsAcc = 0;
        fpsFrames = 0;
        const s = post.settings;
        const on = (b: boolean) => (b ? 'on ' : 'off');
        hud.textContent =
          `${diag.fps.toFixed(0)} fps  ${renderer.stats.drawCalls} draws  ${renderer.stats.instances} inst\n` +
          `sparks ~${sparkTarget}  gpu errors ${gpuDiagnostics.errorCount}\n` +
          `1 bloom ${on(s.bloom.enabled)} 2 fog ${on(s.mist.enabled)} 3 rays ${on(s.godRays.enabled)}\n` +
          `4 vignette ${on(s.vignette.enabled)} 5 grade ${on(s.grade.enabled)}  P pause${loop.paused ? 'd' : ''}  H hud\n` +
          'click: spark burst';
      }
    },
  });
  loop.start();
  watchVisibility((visible) => {
    if (visible) loop.start();
    else loop.stop();
  });

  const pt = { x: 0, y: 0 };
  surface.canvas.addEventListener('pointerdown', (e) => {
    surface.clientToLogical(e.clientX, e.clientY, pt);
    scene.burst(pt.x, pt.y);
  });
  const keys: Record<string, 'bloom' | 'mist' | 'godRays' | 'vignette' | 'grade'> = {
    '1': 'bloom',
    '2': 'mist',
    '3': 'godRays',
    '4': 'vignette',
    '5': 'grade',
  };
  window.addEventListener('keydown', (e) => {
    const pass = keys[e.key];
    if (pass) diag.toggle(pass);
    else if (e.key === 'p' || e.key === 'P') loop.paused = !loop.paused;
    else if (e.key === 'h' || e.key === 'H') hud.hidden = !hud.hidden;
  });
}
