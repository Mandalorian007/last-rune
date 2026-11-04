/**
 * The itch cover candidates page (D-043): eight covers rendered live by the game's engine, each
 * with a 315×250 preview and a 630×500 PNG download. Not part of the game's boot path: its own
 * Vite build (vite.cover.config.ts) served at /cover-image/ on GitHub Pages.
 */
import { initGpu } from '@thunderclap/engine/platform';
import { COVERS } from './covers';
import { COVER_H, COVER_W, CoverStage, paintCover } from './stage';

interface Card {
  stage: CoverStage;
  full: CanvasRenderingContext2D;
  thumb: CanvasRenderingContext2D;
  painted: boolean;
}

declare global {
  interface Window {
    /** For the e2e smoke test: how many covers have painted, and any error. */
    __covers?: { total: number; painted: number; error?: string };
  }
}

const statusEl = document.getElementById('status') as HTMLElement;
const list = document.getElementById('covers') as HTMLElement;
const state = { total: COVERS.length, painted: 0 } as NonNullable<Window['__covers']>;
window.__covers = state;

function fail(msg: string): void {
  state.error = msg;
  statusEl.textContent = msg;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
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

  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const cards: Card[] = [];
  COVERS.forEach((def, i) => {
    const card = el('section', 'cover');
    card.dataset.cover = def.id;
    const full = el('canvas', 'full');
    full.width = COVER_W;
    full.height = COVER_H;
    const side = el('div', 'side');
    const h = el('h2');
    h.append(el('span', undefined, String(i + 1)), def.pitch);
    const thumb = el('canvas', 'thumb');
    thumb.width = Math.round((COVER_W / 2) * dpr);
    thumb.height = Math.round((COVER_H / 2) * dpr);
    const button = el('button', undefined, 'Download PNG');
    button.type = 'button';
    button.addEventListener('click', () =>
      download(full, `last-rune-cover-${i + 1}-${def.id}.png`),
    );
    side.append(h, el('div', 'thumb-label', 'At itch browse size (315×250)'), thumb, button);
    card.append(full, side);
    list.append(card);
    const g = full.getContext('2d');
    const t = thumb.getContext('2d');
    if (!g || !t) return;
    try {
      cards.push({ stage: new CoverStage(device, format, def), full: g, thumb: t, painted: false });
    } catch (e) {
      fail(`Cover ${def.id} failed: ${(e as Error).message}`);
    }
  });

  const paint = (c: Card) => {
    const bmp = c.stage.capture();
    paintCover(c.full, bmp, c.stage.def);
    bmp.close();
    c.thumb.imageSmoothingEnabled = true;
    c.thumb.imageSmoothingQuality = 'high';
    c.thumb.drawImage(c.full.canvas, 0, 0, c.thumb.canvas.width, c.thumb.canvas.height);
    if (!c.painted) {
      c.painted = true;
      state.painted++;
    }
  };

  // Round-robin: two covers a frame, each advanced by the time since it last drew.
  let next = 0;
  const stamps = new Map<Card, number>();
  const tick = (now: number) => {
    for (let k = 0; k < 2 && cards.length > 0; k++) {
      const c = cards[next]!;
      next = (next + 1) % cards.length;
      const prev = stamps.get(c) ?? now - 1000 / 60;
      c.stage.update(Math.min(0.1, (now - prev) / 1000));
      stamps.set(c, now);
      paint(c);
    }
    if (state.painted === state.total && !state.error) statusEl.textContent = '';
    requestAnimationFrame(tick);
  };
  statusEl.textContent = 'Rendering covers…';
  requestAnimationFrame(tick);
}

start().catch((e: unknown) => fail(`Cover page failed: ${(e as Error).message ?? String(e)}`));
