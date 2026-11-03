/// <reference types="@webgpu/types" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { DEV_URL, waitFrames } from '../../tests/e2e/helpers';

// Memory harness (mobile-perf): what the game holds once everything is loaded, and whether
// orientation changes leak GPU memory. Dev server (needs the DEV `window.__game` handle):
//   PERF_MEM=1 PERF_MOBILE=1 pnpm exec playwright test -c scripts/perf/playwright.config.ts
// Reports:
//   - decoded audio: every rendered AudioBuffer (length × channels × 4 bytes), per sound;
//   - GPU: live textures and buffers made through the device (wrapped in an init script), by
//     their declared size and format (what the driver must back, before any compression);
//   - JS heap (CDP Runtime.getHeapUsage);
//   - the same GPU numbers after 10 landscape ↔ portrait flips (a leak shows as growth).
// Env: PERF_OUT, PERF_LABEL.

const OUT = resolve(process.env.PERF_OUT ?? 'test-results/perf');
const LABEL = process.env.PERF_LABEL ?? 'mem';
const MOBILE = !!process.env.PERF_MOBILE;

// biome-ignore lint/suspicious/noExplicitAny: page-side handle
type G = any;

interface GpuLive {
  /** Largest live textures first: size, label, extent, format. */
  list?: string[];
  textures: number;
  textureBytes: number;
  buffers: number;
  bufferBytes: number;
}

async function gpuLive(page: Page): Promise<GpuLive> {
  return page.evaluate(() => (window as unknown as { __gpuLive: () => GpuLive }).__gpuLive());
}

const MiB = (b: number) => Math.round((b / 2 ** 20) * 10) / 10;

test('memory footprint and orientation flips', async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    // Bytes per texel for the formats the engine uses (unknown formats count as 4).
    const BPP: Record<string, number> = {
      rgba16float: 8,
      rgba32float: 16,
      rg16float: 4,
      r16float: 2,
      r32float: 4,
      rg32float: 8,
      rgba8unorm: 4,
      'rgba8unorm-srgb': 4,
      bgra8unorm: 4,
      'bgra8unorm-srgb': 4,
      r8unorm: 1,
      rg8unorm: 2,
      depth24plus: 4,
      'depth24plus-stencil8': 4,
      depth32float: 4,
      rgb10a2unorm: 4,
      rg11b10ufloat: 4,
    };
    const tex = new Map<GPUTexture, number>();
    const info = new Map<GPUTexture, string>();
    const buf = new Map<GPUBuffer, number>();
    const createTexture = GPUDevice.prototype.createTexture;
    GPUDevice.prototype.createTexture = function (this: GPUDevice, d: GPUTextureDescriptor) {
      const t = createTexture.call(this, d);
      const s = d.size as number[] | GPUExtent3DDict;
      const [w, h, l] = Array.isArray(s)
        ? [s[0] ?? 1, s[1] ?? 1, s[2] ?? 1]
        : [
            (s as GPUExtent3DDict).width,
            (s as GPUExtent3DDict).height ?? 1,
            (s as GPUExtent3DDict).depthOrArrayLayers ?? 1,
          ];
      let bytes = 0;
      const mips = d.mipLevelCount ?? 1;
      for (let m = 0; m < mips; m++) {
        bytes += Math.max(1, w >> m) * Math.max(1, h >> m) * l * (BPP[d.format] ?? 4);
      }
      tex.set(t, bytes * (d.sampleCount ?? 1));
      info.set(t, `${d.label ?? '?'} ${w}x${h}x${l} ${d.format} mips ${mips}`);
      return t;
    };
    const destroyTexture = GPUTexture.prototype.destroy;
    GPUTexture.prototype.destroy = function (this: GPUTexture) {
      tex.delete(this);
      return destroyTexture.call(this);
    };
    const createBuffer = GPUDevice.prototype.createBuffer;
    GPUDevice.prototype.createBuffer = function (this: GPUDevice, d: GPUBufferDescriptor) {
      const b = createBuffer.call(this, d);
      buf.set(b, d.size);
      return b;
    };
    const destroyBuffer = GPUBuffer.prototype.destroy;
    GPUBuffer.prototype.destroy = function (this: GPUBuffer) {
      buf.delete(this);
      return destroyBuffer.call(this);
    };
    const sum = (m: Map<unknown, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    (window as unknown as { __gpuLive: () => GpuLive }).__gpuLive = () => ({
      textures: tex.size,
      textureBytes: sum(tex),
      buffers: buf.size,
      bufferBytes: sum(buf),
      list: [...tex.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([t, b]) => `${(b / 2 ** 20).toFixed(1)} MiB ${info.get(t)}`),
    });
  });
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => (await cdp.send('Runtime.getHeapUsage')).usedSize as number;

  await page.goto(DEV_URL);
  await page.waitForFunction(
    () => (window as unknown as { __game?: G }).__game?.flow.state === 'title',
    null,
    { timeout: 60_000 },
  );
  await waitFrames(page, 30);
  const titleGpu = await gpuLive(page);

  // The first gesture unlocks audio and starts the pre-render. Poll array-buffer backing store
  // meanwhile: the peak is what a phone must survive while the bank renders.
  const backing = async () => (await cdp.send('Runtime.getHeapUsage')).backingStorageSize as number;
  const backingBefore = await backing();
  let backingPeak = backingBefore;
  let polling = true;
  const poll = (async () => {
    while (polling) {
      backingPeak = Math.max(backingPeak, await backing());
      await new Promise((r) => setTimeout(r, 25));
    }
  })();
  const box = (await page.locator('#app canvas').first().boundingBox())!;
  if (MOBILE) await page.touchscreen.tap(box.x + 4, box.y + 4);
  else await page.mouse.click(box.x + 4, box.y + 4);
  await page.waitForFunction(
    () => performance.getEntriesByName('lr:audio-ready').length > 0,
    null,
    { timeout: 60_000 },
  );
  polling = false;
  await poll;
  await cdp.send('HeapProfiler.collectGarbage');
  const backingAfter = await backing();
  const audio = await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    const sounds = g.audio.sounds as Map<string, { buffer: AudioBuffer | null }>;
    const per: { name: string; bytes: number; ch: number; sr: number; s: number }[] = [];
    for (const [name, e] of sounds) {
      const b = e.buffer;
      if (!b) continue;
      per.push({
        name,
        bytes: b.length * b.numberOfChannels * 4,
        ch: b.numberOfChannels,
        sr: b.sampleRate,
        s: Math.round(b.duration * 100) / 100,
      });
    }
    per.sort((a, b) => b.bytes - a.bytes);
    return {
      contextRate: g.audio.context?.sampleRate ?? 0,
      total: per.reduce((a, b) => a + b.bytes, 0),
      count: per.length,
      top: per.slice(0, 15),
    };
  });

  // The hall (the biggest steady scene).
  await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    g.save.update((d: G) => {
      d.flags.hallIntro = true;
      d.settings.captionSpeed = 'instant';
    });
    g.flow.continueGame();
  });
  await expect(page.locator('.lr-hud')).toBeVisible();
  await waitFrames(page, 60);
  const hallGpu = await gpuLive(page);
  const hallHeap = await heap();

  // Orientation flips: landscape ↔ portrait, ten times, a few frames each.
  const vp = page.viewportSize()!;
  const flips: GpuLive[] = [];
  for (let i = 0; i < 10; i++) {
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await waitFrames(page, 6);
    await page.setViewportSize(vp);
    await waitFrames(page, 6);
    flips.push(await gpuLive(page));
  }
  await waitFrames(page, 30);
  const afterFlips = await gpuLive(page);
  const flipsHeap = await heap();

  const result = {
    label: LABEL,
    mobile: MOBILE,
    viewport: vp,
    canvas: await page.evaluate(() => {
      const c = document.querySelector('#app canvas') as HTMLCanvasElement;
      return `${c.width}x${c.height}`;
    }),
    tier: await page.evaluate(() => {
      const g = (window as unknown as { __game: G }).__game.graphics;
      return `${g.preference}->${g.tier} (${g.autoReason ?? '-'})`;
    }),
    audio,
    backing: { before: backingBefore, peak: backingPeak, after: backingAfter },
    titleGpu,
    hallGpu,
    hallHeap,
    flips,
    afterFlips,
    flipsHeap,
  };
  console.log(
    [
      `canvas ${result.canvas} tier ${result.tier}`,
      `audio  ${MiB(audio.total)} MiB in ${audio.count} buffers (context ${audio.contextRate} Hz)`,
      `array buffers: ${MiB(backingBefore)} MiB before audio, peak ${MiB(backingPeak)} MiB during the pre-render, ${MiB(backingAfter)} MiB after (GC)`,
      ...audio.top.map(
        (t) =>
          `  ${t.name.padEnd(22)} ${MiB(t.bytes).toFixed(1).padStart(5)} MiB ${t.ch}ch ${t.sr} Hz ${t.s} s`,
      ),
      `gpu title  tex ${titleGpu.textures} ${MiB(titleGpu.textureBytes)} MiB, buf ${titleGpu.buffers} ${MiB(titleGpu.bufferBytes)} MiB`,
      `gpu hall   tex ${hallGpu.textures} ${MiB(hallGpu.textureBytes)} MiB, buf ${hallGpu.buffers} ${MiB(hallGpu.bufferBytes)} MiB; JS heap ${MiB(hallHeap)} MiB`,
      ...(hallGpu.list ?? []).map((l) => `  ${l}`),
      `gpu flips  ${flips.map((f) => `${f.textures}/${MiB(f.textureBytes)}`).join(' ')}`,
      `gpu after  tex ${afterFlips.textures} ${MiB(afterFlips.textureBytes)} MiB, buf ${afterFlips.buffers} ${MiB(afterFlips.bufferBytes)} MiB; JS heap ${MiB(flipsHeap)} MiB`,
    ].join('\n'),
  );
  const file = join(OUT, `${LABEL}${MOBILE ? '-mobile' : ''}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`wrote ${file}`);
  // No leak: after the flips, the same textures are live as before them.
  expect(afterFlips.textures).toBe(hallGpu.textures);
  expect(afterFlips.textureBytes).toBe(hallGpu.textureBytes);
});
