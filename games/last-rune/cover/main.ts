/**
 * The itch cover page (D-043 addendum 1): the fuse-portrait cover rendered by the game's engine
 * into a 630×500 canvas, with a 315×250 copy at itch's browse-grid size and a PNG download.
 * Not part of the game or the Pages build: `pnpm cover` builds it with vite.cover.config.ts
 * into build/cover-image/ and saves the PNGs (scripts/cover/). Dev:
 * `pnpm exec vite -c vite.cover.config.ts`.
 *
 * The cover is a still: one frame, drawn once after the stage's warmup, with `Math.random`
 * seeded (FUSE picks his idle sway and eye flicker phase from it), so the PNG is the same on
 * every run.
 */
import { initGpu } from '@thunderclap/engine/platform';
import { COVER } from './covers';
import { COVER_H, COVER_W, CoverStage, paintCover } from './stage';

declare global {
  interface Window {
    /** For scripts/cover: whether the cover has painted, and any error. */
    __cover?: { painted: boolean; error?: string };
  }
}

/** mulberry32: a small seeded PRNG standing in for Math.random on this page only. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 8;
Math.random = seededRandom(SEED);

const statusEl = document.getElementById('status') as HTMLElement;
const state: NonNullable<Window['__cover']> = { painted: false };
window.__cover = state;

function fail(msg: string): void {
  state.error = msg;
  statusEl.textContent = msg;
}

function download(canvas: HTMLCanvasElement, name: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

async function start(): Promise<void> {
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const init = await initGpu(probe, { timestamps: false });
  if (!init.ok) {
    fail(`This page needs WebGPU (${init.reason}). Try a current Chrome or Edge.`);
    return;
  }
  const { device, format } = init.gpu;
  device.lost.then((info) => fail(`GPU device lost: ${info.message}`));

  const full = document.getElementById('full') as HTMLCanvasElement;
  const thumb = document.getElementById('thumb') as HTMLCanvasElement;
  full.width = COVER_W;
  full.height = COVER_H;
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  thumb.width = Math.round((COVER_W / 2) * dpr);
  thumb.height = Math.round((COVER_H / 2) * dpr);
  const g = full.getContext('2d');
  const t = thumb.getContext('2d');
  if (!g || !t) {
    fail('This page needs a 2D canvas.');
    return;
  }
  (document.getElementById('download') as HTMLButtonElement).addEventListener('click', () =>
    download(full, 'last-rune-itch-cover.png'),
  );

  const stage = new CoverStage(device, format, COVER);
  stage.update(1 / 60);
  const bmp = stage.capture();
  paintCover(g, bmp, COVER);
  bmp.close();
  t.imageSmoothingEnabled = true;
  t.imageSmoothingQuality = 'high';
  t.drawImage(full, 0, 0, thumb.width, thumb.height);
  statusEl.textContent = '';
  state.painted = true;
}

start().catch((e: unknown) => fail(`Cover page failed: ${(e as Error).message ?? String(e)}`));
