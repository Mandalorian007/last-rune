/**
 * Phones, dense boards (mobile-6-zoom): the zoomed view's DOM. The rail's Zoom / Whole board
 * button, the edge cues where the board runs on past the view, and the Gives/Needs cards
 * following their gauges through the zoom (pinned to the view's edge, with an arrow, while
 * their gauge is off screen). The camera math is in `zoom.ts`.
 */
import { button, h } from '@engine/ui';
import { cpx, P, tpx } from '../../ui/phone-styles';
import { scaleFontSizes } from '../../ui/text-scale';
import type { AltarLayout, PropSpot } from './layout';
import {
  type Cam,
  clearSpot,
  offEdges,
  type Rect,
  rectHitsCircle,
  socketHits,
  transformLayout,
  viewRect,
} from './zoom';

const SVG = 'http://www.w3.org/2000/svg';

/** A small line icon: a magnifier with a plus (zoom in), or four corners (the whole board). */
function icon(kind: 'in' | 'all'): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'lr-zoom-ico');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute(
    'd',
    kind === 'in'
      ? 'M8.5 3a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11M12.5 12.5L17 17M8.5 6v5M6 8.5h5'
      : 'M3 7.5V3h4.5M12.5 3H17v4.5M17 12.5V17h-4.5M7.5 17H3v-4.5M7 7h6v6H7z',
  );
  svg.append(path);
  return svg;
}

/** A Gives/Needs card and where it sits at the fitted view. */
interface Tracked {
  el: HTMLElement;
  spot: PropSpot;
  left: number;
  top: number;
  /** Its box at the fitted view, relative to (left, top). */
  l: number;
  r: number;
  t: number;
  b: number;
}

export class ZoomUi {
  readonly button: HTMLButtonElement;
  private readonly edges: HTMLElement[];
  private labels: Tracked[] = [];
  private zoomed: boolean | null = null;
  private box: ((el: HTMLElement) => Rect) | null = null;
  private sizes = new Map<
    HTMLElement,
    { key: string; l: number; t: number; r: number; b: number }
  >();
  private open: (x: number, y: number) => boolean = () => true;

  constructor(host: HTMLElement, actions: HTMLElement, onTap: () => void) {
    ensureZoomStyles(host.ownerDocument);
    this.button = button(h('span'), (e) => {
      (e.currentTarget as HTMLElement).blur();
      onTap();
    });
    this.button.className = 'tc-button lr-stone-button lr-zoom-btn';
    this.button.dataset.action = 'zoom';
    actions.append(this.button);
    this.edges = ['n', 'e', 's', 'w'].map((side) =>
      h('div', { class: 'lr-zoom-edge', 'data-side': side, 'aria-hidden': 'true', hidden: true }),
    );
    host.append(...this.edges);
    this.setZoomed(false);
  }

  /** The button says what a tap does: zoom in, or show the whole board. */
  setZoomed(on: boolean): void {
    if (this.zoomed === on) return;
    this.zoomed = on;
    const label = on ? 'Whole board' : 'Zoom';
    this.button.replaceChildren(
      h('span', null, icon(on ? 'all' : 'in'), h('span', { class: 'lr-zoom-word' }, label)),
    );
    this.button.setAttribute('aria-label', on ? 'Show the whole board' : 'Zoom in on the board');
    this.button.toggleAttribute('data-zoomed', on);
  }

  /** Edge cues on each side the board runs on past the view. */
  placeEdges(L: AltarLayout, c: Cam): void {
    const v = viewRect(L);
    const off = offEdges(L, c);
    const st = (el: HTMLElement, r: Rect) => {
      el.style.left = `${r.x0}px`;
      el.style.top = `${r.y0}px`;
      el.style.width = `${r.x1 - r.x0}px`;
      el.style.height = `${r.y1 - r.y0}px`;
    };
    const d = 26 * (L.phone?.cssPx ?? 1);
    const [n, e, s, w] = this.edges as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    st(n, { x0: v.x0, y0: v.y0, x1: v.x1, y1: v.y0 + d });
    st(e, { x0: v.x1 - d, y0: v.y0, x1: v.x1, y1: v.y1 });
    st(s, { x0: v.x0, y0: v.y1 - d, x1: v.x1, y1: v.y1 });
    st(w, { x0: v.x0, y0: v.y0, x1: v.x0 + d, y1: v.y1 });
    this.edges.forEach((el, i) => {
      if (el.hidden === off[i]) el.hidden = !off[i];
    });
  }

  /**
   * The cards were just laid out at the fitted view: remember where (and how big), then put
   * them where the camera shows their gauges.
   */
  record(items: [HTMLElement, PropSpot][], box: (el: HTMLElement) => Rect): void {
    this.box = box;
    this.sizes.clear();
    this.labels = items.map(([el, spot]) => {
      el.removeAttribute('data-off');
      el.removeAttribute('data-free');
      const left = Number.parseFloat(el.style.left) || 0;
      const top = Number.parseFloat(el.style.top) || 0;
      const b = box(el);
      return { el, spot, left, top, l: b.x0 - left, r: b.x1 - left, t: b.y0 - top, b: b.y1 - top };
    });
  }

  /** Which cells are sockets (carved stone is not), for keeping cards off them when zoomed. */
  setSockets(open: (x: number, y: number) => boolean): void {
    this.open = open;
  }

  /**
   * A card's box at (x, y) as it is drawn now: the card and every word in it (a word may run
   * past the card's own box). Cached per look, since a pan asks every frame.
   */
  private extent(k: Tracked, x: number, y: number): Rect {
    const el = k.el;
    const key = `${el.dataset.off ?? ''}|${el.dataset.align ?? ''}|${el.hasAttribute('data-left')}|${el.textContent}`;
    let r = this.sizes.get(el);
    if (!r || r.key !== key) {
      const box = this.box;
      if (!box) return { x0: x + k.l, y0: y + k.t, x1: x + k.r, y1: y + k.b };
      const lx = Math.round(x);
      const ty = Math.round(y);
      el.style.left = `${lx}px`;
      el.style.top = `${ty}px`;
      const u = box(el);
      for (const c of el.querySelectorAll<HTMLElement>('*')) {
        const q = box(c);
        if (q.x1 - q.x0 < 0.5 || q.y1 - q.y0 < 0.5) continue;
        u.x0 = Math.min(u.x0, q.x0);
        u.y0 = Math.min(u.y0, q.y0);
        u.x1 = Math.max(u.x1, q.x1);
        u.y1 = Math.max(u.y1, q.y1);
      }
      r = { key, l: u.x0 - lx, t: u.y0 - ty, r: u.x1 - lx, b: u.y1 - ty };
      this.sizes.set(el, r);
    }
    return { x0: x + r.l, y0: y + r.t, x1: x + r.r, y1: y + r.b };
  }

  /**
   * Each card moves with its gauge. Zoomed, the board fills the view, so no card may sit on a
   * socket's tap circle or on a gauge (mobile-6-integrate):
   * - a card whose gauge is in view takes the nearest clear spot to where it would hang;
   * - one whose gauge is off the view shrinks to a one-line chip with an arrow the way to it,
   *   at that edge of the view, slid along the edge to the nearest clear spot.
   */
  placeLabels(L: AltarLayout, c: Cam): void {
    const css = L.phone?.cssPx ?? 1;
    const e = L.phone?.edge ?? 0;
    if (c.z <= 1) {
      for (const k of this.labels) {
        k.el.style.left = `${Math.round(k.left)}px`;
        k.el.style.top = `${Math.round(k.top)}px`;
        k.el.removeAttribute('data-off');
        k.el.removeAttribute('data-free');
      }
      return;
    }
    const v = viewRect(L);
    const S = transformLayout(L, c);
    const sockets = socketHits(S, this.open);
    const gauges = [S.storm, ...S.machines].map((sp) => ({
      x: sp.x,
      y: sp.y,
      r: sp.size * (sp === S.storm ? 0.26 : 0.46),
    }));
    // The edge cues' chevrons, mid-way along each side the board runs on past.
    const placed: Rect[] = [];
    const ch = 13 * css;
    const mx = (v.x0 + v.x1) / 2;
    const my = (v.y0 + v.y1) / 2;
    const [n, ea, so, w] = offEdges(L, c);
    if (n) placed.push({ x0: mx - ch, y0: v.y0, x1: mx + ch, y1: v.y0 + 2 * ch });
    if (ea) placed.push({ x0: v.x1 - 2 * ch, y0: my - ch, x1: v.x1, y1: my + ch });
    if (so) placed.push({ x0: mx - ch, y0: v.y1 - 2 * ch, x1: mx + ch, y1: v.y1 });
    if (w) placed.push({ x0: v.x0, y0: my - ch, x1: v.x0 + 2 * ch, y1: my + ch });
    const pad = 4 * css;
    const near = (r: Rect) =>
      placed.some(
        (p) => r.x0 < p.x1 + pad && r.x1 > p.x0 - pad && r.y0 < p.y1 + pad && r.y1 > p.y0 - pad,
      );
    const onGauge = (r: Rect) => gauges.some((g) => rectHitsCircle(r, g.x, g.y, g.r));
    const all = (r: Rect) => sockets(r) || onGauge(r) || near(r);
    const bounds = { x0: v.x0 + e, y0: v.y0 + e, x1: v.x1 - e, y1: v.y1 - e };
    const step = 4 * css;
    for (const k of this.labels) {
      const gx = c.ox + c.z * k.spot.x;
      const gy = c.oy + c.z * k.spot.y;
      let x = k.left + (gx - k.spot.x);
      let y = k.top + (gy - k.spot.y);
      let off = '';
      if (gy < v.y0) off = 'n';
      else if (gy > v.y1) off = 's';
      else if (gx > v.x1) off = 'e';
      else if (gx < v.x0) off = 'w';
      if ((k.el.dataset.off ?? '') !== off) {
        if (off) k.el.dataset.off = off;
        else k.el.removeAttribute('data-off');
      }
      const want = this.extent(k, x, y);
      // Pinned at a side, the chip keeps to that side and slides along it.
      const wx = off === 'e' || off === 'w' ? 6 : 1;
      const wy = off === 'n' || off === 's' ? 6 : 1;
      const at =
        clearSpot(want, bounds, all, step, 4 * S.pitch, wx, wy) ??
        clearSpot(want, bounds, sockets, step, 8 * S.pitch, wx, wy) ??
        clearSpot(want, bounds, () => false, step, 0);
      const dx = at?.dx ?? 0;
      const dy = at?.dy ?? 0;
      x += dx;
      y += dy;
      placed.push({ x0: want.x0 + dx, y0: want.y0 + dy, x1: want.x1 + dx, y1: want.y1 + dy });
      k.el.style.left = `${Math.round(x)}px`;
      k.el.style.top = `${Math.round(y)}px`;
      // Slid off its gauge: the notch would point at nothing.
      k.el.toggleAttribute('data-free', !off && Math.hypot(dx, dy) > 3 * css);
    }
  }

  dispose(): void {
    this.button.remove();
    for (const el of this.edges) el.remove();
    this.labels = [];
    this.sizes.clear();
  }
}

const CT = 'var(--lr-crop-t, 0px)';
const A = `${P} .lr-altar[data-phone]`;

const CSS = /* css */ `
/* mobile-6-zoom: the Zoom / Whole board button on the left rail, between Back and Undo. */
${P} .lr-altar-actions .lr-zoom-btn { left: calc(-1 * var(--lr-bar, 0px) + ${cpx(3)}); top: calc(${CT} + ${cpx(54)}); }
${P} .lr-altar-actions .lr-zoom-btn > span { gap: ${cpx(1)}; }
${P} .lr-zoom-ico {
  width: ${cpx(18)}; height: ${cpx(18)}; fill: none; stroke: var(--lr-gold, #e8c06a);
  stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
}
${P} .lr-zoom-word { font-size: ${tpx(11)}; line-height: 1.02; text-align: center; }
${P} .lr-altar-actions .lr-zoom-btn[data-zoomed] { border-color: var(--lr-gold, #e8c06a); }
.tc-overlay .lr-zoom-btn:not(#lr-none) { display: none; }
${A}[data-zoomable] .lr-zoom-btn:not(#lr-none) { display: flex; }

/* The board runs on past the view this way: a shade and a chevron at that edge. */
.tc-overlay .lr-zoom-edge {
  position: absolute; pointer-events: none; display: flex; align-items: center; justify-content: center;
  color: var(--lr-gold, #e8c06a); font-size: ${cpx(20)}; line-height: 1; text-shadow: 0 0 ${cpx(4)} #000, 0 0 ${cpx(2)} #000;
}
.tc-overlay .lr-zoom-edge[hidden] { display: none; }
.tc-overlay .lr-zoom-edge[data-side="n"] { background: linear-gradient(180deg, rgba(0,0,0,0.6), transparent); }
.tc-overlay .lr-zoom-edge[data-side="s"] { background: linear-gradient(0deg, rgba(0,0,0,0.6), transparent); }
.tc-overlay .lr-zoom-edge[data-side="e"] { background: linear-gradient(270deg, rgba(0,0,0,0.6), transparent); }
.tc-overlay .lr-zoom-edge[data-side="w"] { background: linear-gradient(90deg, rgba(0,0,0,0.6), transparent); }
.tc-overlay .lr-zoom-edge[data-side="n"]::after { content: '\\25B2'; }
.tc-overlay .lr-zoom-edge[data-side="s"]::after { content: '\\25BC'; }
.tc-overlay .lr-zoom-edge[data-side="e"]::after { content: '\\25B6'; }
.tc-overlay .lr-zoom-edge[data-side="w"]::after { content: '\\25C0'; }

/* A card whose gauge is off the view: a one-line chip at the edge, its notch traded for an
   arrow that way (mobile-6-integrate). A card slid off its gauge to clear the sockets drops
   its notch too. */
${A} .lr-altar-need:is([data-off], [data-free])::before { display: none; }
${A} .lr-altar-need[data-off] :is(.lr-need-note, .lr-storm-row, .lr-need-got, .lr-need-strikes) { display: none; }
${A} .lr-altar-need[data-off] { white-space: nowrap; max-width: none !important; }
${A} .lr-altar-need[data-off]::after {
  position: absolute; color: var(--lr-gold, #e8c06a); font-size: ${tpx(14)}; line-height: 1;
  text-shadow: 0 0 ${cpx(3)} #000;
}
${A} .lr-altar-need[data-off="e"] { padding-right: ${cpx(16)}; }
${A} .lr-altar-need[data-off="e"]::after { content: '\\2192'; right: ${cpx(3)}; top: 50%; transform: translateY(-50%); }
${A} .lr-altar-need[data-off="w"] { padding-left: ${cpx(16)}; }
${A} .lr-altar-need[data-off="w"]::after { content: '\\2190'; left: ${cpx(3)}; top: 50%; transform: translateY(-50%); }
${A} .lr-altar-need[data-off="n"] { padding-top: ${cpx(13)}; }
${A} .lr-altar-need[data-off="n"]::after { content: '\\2191'; top: ${cpx(1)}; left: 50%; transform: translateX(-50%); }
${A} .lr-altar-need[data-off="s"] { padding-bottom: ${cpx(13)}; }
${A} .lr-altar-need[data-off="s"]::after { content: '\\2193'; bottom: ${cpx(1)}; left: 50%; transform: translateX(-50%); }
`;

function ensureZoomStyles(doc: Document): void {
  if (doc.getElementById('lr-zoom-styles')) return;
  const el = doc.createElement('style');
  el.id = 'lr-zoom-styles';
  el.textContent = scaleFontSizes(CSS);
  doc.head.append(el);
}
