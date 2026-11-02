import { type GpuContext, type GpuFailureReason, initGpu } from './gpu';
import { showDeviceLostScreen, showUnsupportedScreen } from './screens';
import { mountSurface, type Surface, type SurfaceOptions } from './surface';

export interface BootOptions extends SurfaceOptions {
  /** Shown as the eyebrow on fatal screens (the game's name). */
  title?: string;
  /** Called after the device-lost screen is shown (stop loops here). */
  onDeviceLost?: (info: GPUDeviceLostInfo) => void;
  /** Dev aid: pretend WebGPU is missing to preview the unsupported screen. */
  forceUnsupported?: boolean;
}

export type BootResult =
  | { ok: true; surface: Surface; gpu: GpuContext }
  | { ok: false; reason: GpuFailureReason | 'forced' };

/**
 * Mount a letterboxed canvas in `root` and bring up WebGPU. On failure the canvas is removed
 * and the styled unsupported screen is shown; on device loss the reload screen is shown.
 */
export async function boot(root: HTMLElement, opts: BootOptions = {}): Promise<BootResult> {
  if (opts.forceUnsupported) {
    showUnsupportedScreen(root, { title: opts.title });
    return { ok: false, reason: 'forced' };
  }
  const surface = mountSurface(root, opts);
  const res = await initGpu(surface.canvas, {
    onLost: (info) => {
      showDeviceLostScreen(root, { title: opts.title, detail: info.message || undefined });
      opts.onDeviceLost?.(info);
    },
  });
  if (!res.ok) {
    surface.destroy();
    showUnsupportedScreen(root, { title: opts.title, detail: res.detail ?? res.reason });
    return { ok: false, reason: res.reason };
  }
  return { ok: true, surface, gpu: res.gpu };
}
