/**
 * FUSE portrait for the corner caption card: head and shoulders on a dark plate with a gold
 * bezel, rendered by the same SDF painter as the in-scene FUSE into its own small canvas.
 *
 * ```ts
 * const portrait = createFusePortrait(renderer, { size: 160 });
 * ui.caption.say(line, { speaker: 'FUSE', portrait: portrait.canvas });
 * // each frame (or at ~30 Hz): mirror the scene FUSE so his eye/talk match
 * portrait.render(fuse.state);
 * const still = await portrait.snapshot(); // ImageBitmap, if you need a static copy
 * ```
 *
 * Without a scene FUSE, `portrait.render()` animates a default idle/talk rig on its own clock.
 */
import type { FullscreenPass, Renderer } from '@engine/render';
import { FUSE_PORTRAIT_WGSL, FUSE_UNIFORM_FLOATS } from '../../shaders/fuse-shaders';
import type { FuseRigState } from './fuse';
import { writeFuseState } from './fuse';
import { PROP_LIGHT_FLOATS, PropLightRig } from './lighting';
import { pitch, prop } from './palette';

export interface FusePortraitOptions {
  /** Canvas size in CSS px (square). Default 128. */
  size?: number;
  /** Device pixel ratio to render at. Default min(devicePixelRatio, 2). */
  dpr?: number;
  /** Half-extent of the view in FUSE units (smaller = tighter crop). Default 0.5. */
  zoom?: number;
}

export interface FusePortrait {
  readonly canvas: HTMLCanvasElement;
  /** Draw one frame. Pass a rig state (e.g. `fuse.state`) to mirror the scene FUSE. */
  render(state?: FuseRigState, talking?: boolean): void;
  snapshot(): Promise<ImageBitmap>;
  destroy(): void;
}

export function createFusePortrait(
  renderer: Renderer,
  opts: FusePortraitOptions = {},
): FusePortrait {
  const size = opts.size ?? 128;
  const dpr = opts.dpr ?? Math.min(globalThis.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.style.display = 'block';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('webgpu');
  if (!ctx) throw new Error('fuse-portrait: no webgpu canvas context');
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device: renderer.device, format, alphaMode: 'premultiplied' });

  const pass: FullscreenPass = renderer.createFullscreenPass({
    label: 'fuse-portrait',
    wgsl: FUSE_PORTRAIT_WGSL,
    targets: [format],
    uniformBytes: (FUSE_UNIFORM_FLOATS + 4) * 4,
  });
  const u = new Float32Array(FUSE_UNIFORM_FLOATS + 4);
  // Fixed portrait lighting in the pass's synthetic px space (100 px/unit, y down, origin at
  // his feet): a warm key from upper right (candle), a cool rim from the left (gems/storm).
  const rig = new PropLightRig()
    .begin(0.09, 0.1, 0.16)
    .add(140, -260, 520, pitch('warm'), 2.2, 120)
    .add(-170, -150, 420, pitch('cyan'), 0.9, 50)
    .add(0, -60, 300, prop('eye'), 0.4, 60);
  const zoom = opts.zoom ?? 0.5;

  const own: FuseRigState = {
    time: 0,
    bob: 0,
    tilt: 0,
    lean: 0,
    lookX: 0.25,
    lookY: -0.1,
    eyeGlow: 1.1,
    lid: 0.12,
    talk: 0,
    quiet: 0,
    wheel: 0,
    swing: 0,
    facing: 1,
    raise: 0,
    deadSpark: 1,
  };
  let last = performance.now();

  return {
    canvas,
    render(state?: FuseRigState, talking = false) {
      let s = state;
      if (!s) {
        const now = performance.now();
        own.time += Math.min((now - last) / 1000, 0.1);
        last = now;
        own.talk += ((talking ? 1 : 0) - own.talk) * 0.2;
        own.bob =
          Math.sin(own.time * 2.1) * 0.012 + own.talk * Math.abs(Math.sin(own.time * 7.3)) * 0.018;
        own.tilt = Math.sin(own.time * 0.7) * 0.03 + own.talk * Math.sin(own.time * 3.7) * 0.05;
        own.eyeGlow = 1.1 + own.talk * 0.25 * Math.sin(own.time * 17);
        s = own;
      }
      u.set(rig.data, 0);
      writeFuseState(s, u, PROP_LIGHT_FLOATS, 1);
      // Portrait always faces the viewer slightly right; ignore scene facing.
      u[PROP_LIGHT_FLOATS + 12] = 1;
      const v = FUSE_UNIFORM_FLOATS;
      u[v] = 0.02;
      u[v + 1] = 1.47;
      u[v + 2] = zoom;
      u[v + 3] = 0.12;
      pass.setUniforms(u);
      const enc = renderer.device.createCommandEncoder({ label: 'fuse-portrait' });
      pass.encode(enc, ctx.getCurrentTexture().createView(), { clear: { r: 0, g: 0, b: 0, a: 0 } });
      renderer.device.queue.submit([enc.finish()]);
    },
    snapshot() {
      return createImageBitmap(canvas);
    },
    destroy() {
      pass.destroy();
      ctx.unconfigure();
    },
  };
}
