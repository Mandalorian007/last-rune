/**
 * The social card page (D-050): the fuse-portrait scene rendered by the game's engine into a
 * 1200×630 canvas (og:image for Discord, iMessage, Slack, X), plus a 180×180 home-screen icon cut
 * from the same frame. Not part of the game bundle: `pnpm social` builds it with
 * vite.cover.config.ts into build/cover-image/ and saves public/social.jpg and
 * public/apple-touch-icon.png (scripts/cover/). Dev: `pnpm exec vite -c vite.cover.config.ts`.
 *
 * One still frame after the stage's warmup, with `Math.random` seeded (FUSE picks his idle sway
 * and eye flicker phase from it), so the PNG is the same on every run.
 */
import { initGpu } from '@thunderclap/engine/platform';
import { COVER } from './covers';
import { COVER_H, COVER_W, CoverStage, paintCover } from './stage';

declare global {
  interface Window {
    /** For scripts/cover: whether the card has painted, and any error. */
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
Math.random = seededRandom(8);

const statusEl = document.getElementById('status') as HTMLElement;
const state: NonNullable<Window['__cover']> = { painted: false };
window.__cover = state;

function fail(msg: string): void {
  state.error = msg;
  statusEl.textContent = msg;
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
  const icon = document.getElementById('icon') as HTMLCanvasElement;
  full.width = COVER_W;
  full.height = COVER_H;
  icon.width = icon.height = 180;
  const g = full.getContext('2d');
  const ig = icon.getContext('2d');
  if (!g || !ig) {
    fail('This page needs a 2D canvas.');
    return;
  }

  const stage = new CoverStage(device, format, COVER);
  stage.update(1 / 60);
  const bmp = stage.capture();
  paintCover(g, bmp, COVER);
  // The icon: the gem alone, from the untitled frame (bitmap px are SUPERSAMPLE × card px).
  const k = bmp.width / COVER_W;
  const c = gemOnCard();
  const side = 230;
  ig.imageSmoothingEnabled = true;
  ig.imageSmoothingQuality = 'high';
  ig.drawImage(bmp, (c.x - side / 2) * k, (c.y - side / 2) * k, side * k, side * k, 0, 0, 180, 180);
  bmp.close();
  statusEl.textContent = '';
  state.painted = true;
}

/** Where the cover's gem lands on the card, from the shot (world → card px). */
function gemOnCard(): { x: number; y: number } {
  const s = COVER.shot ?? { cx: 960, cy: 540, width: 1360 };
  const z = COVER_W / s.width;
  return { x: COVER_W / 2 + (760 - s.cx) * z, y: COVER_H / 2 + (720 - s.cy) * z };
}

start().catch((e: unknown) =>
  fail(`Social card page failed: ${(e as Error).message ?? String(e)}`),
);
