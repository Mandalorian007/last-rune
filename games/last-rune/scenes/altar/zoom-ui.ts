/**
 * Phones, dense boards (mobile-6-zoom, mobile-7-zoom): the zoomed view's DOM. The camera math
 * is in `zoom.ts`.
 *
 * - The rail's Zoom / Whole board button, and at the whole board a magnifier badge on the
 *   board's corner (the "Tap the board to zoom in" line wears the same magnifier).
 * - Zoomed, a gutter frames the cells (drawn by the view). In it: an arrow on each side the
 *   board runs on past the view (32 CSS px, a tap pans one step), and the chip of each gauge
 *   out of view, with an arrow the way to it. On-view Gives/Needs cards follow their gauges,
 *   on the nearest spot clear of every visible socket.
 * - Zoomed, a minimap in the column's foot (left of Strike): the whole board, the source, the
 *   gauges, the placed gems and the viewport. A tap (or a drag) on it looks there.
 */
import { button, h } from '@engine/ui';
import { GEM_COLOUR } from '../../art/props/palette';
import type { GemKind } from '../../rules/types';
import { cpx, P, tpx } from '../../ui/phone-styles';
import { CSS_PALETTE } from '../../ui/styles';
import { scaleFontSizes } from '../../ui/text-scale';
import type { AltarLayout, PropSpot } from './layout';
import {
  blockRect,
  type Cam,
  cellRect,
  clampCam,
  clearSpot,
  offEdges,
  propRects,
  type Rect,
  rectHitsCircle,
  SOCKET_CLEAR,
  settleCam,
  socketHits,
  stepCam,
  transformLayout,
  viewRect,
} from './zoom';

const SVG = 'http://www.w3.org/2000/svg';

/** Edge arrows, CSS px across (≥ 28: a thumb finds them). */
export const ARROW_CSS = 32;
/** The minimap's largest side, CSS px, and the smallest it may shrink to before it hides. */
const MAP_MAX_CSS = 104;
const MAP_MIN_CSS = 56;
/** The Holding pill keeps this far from Menu, CSS px. */
export const MENU_GAP_CSS = 8;

/** A small line icon: a magnifier with a plus (zoom in), or four corners (the whole board). */
function icon(kind: 'in' | 'all'): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'lr-zoom-ico');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', kind === 'in' ? MAGNIFIER : CORNERS);
  svg.append(path);
  return svg;
}
const MAGNIFIER = 'M8.5 3a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11M12.5 12.5L17 17M8.5 6v5M6 8.5h5';
const CORNERS = 'M3 7.5V3h4.5M12.5 3H17v4.5M17 12.5V17h-4.5M7.5 17H3v-4.5M7 7h6v6H7z';

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

export interface ZoomUiHooks {
  /** The rail button and the badge: the whole board, or back in. */
  onTap: () => void;
  /** Look somewhere (an arrow, the minimap): eased, or at once (a drag on the map). */
  go: (c: Cam, ease: boolean) => void;
  /** An element's box in design px. */
  measure: (el: Element) => Rect;
  /** The Strike button (the minimap stands left of it). */
  strike: HTMLElement;
}

type MapGem = { x: number; y: number; gem: GemKind };

export class ZoomUi {
  readonly button: HTMLButtonElement;
  private readonly edges: HTMLButtonElement[];
  private readonly badge: HTMLButtonElement;
  private readonly map: HTMLElement;
  private readonly mapSvg: SVGSVGElement;
  private readonly mapView: SVGRectElement;
  private readonly mapGemsG: SVGGElement;
  private mapKey = '';
  private mapBox: Rect | null = null;
  /** The column said there is no room for the map just now (a long card in the lane). */
  private mapCrowded = false;
  private labels: Tracked[] = [];
  private zoomed: boolean | null = null;
  private box: ((el: HTMLElement) => Rect) | null = null;
  private sizes = new Map<
    HTMLElement,
    { key: string; l: number; t: number; r: number; b: number }
  >();
  private open: (x: number, y: number) => boolean = () => true;
  private L: AltarLayout | null = null;
  private cam: Cam = { z: 1, ox: 0, oy: 0 };
  private badgeOn = false;

  constructor(
    host: HTMLElement,
    actions: HTMLElement,
    private readonly hooks: ZoomUiHooks,
  ) {
    ensureZoomStyles(host.ownerDocument);
    this.button = button(h('span'), (e) => {
      (e.currentTarget as HTMLElement).blur();
      hooks.onTap();
    });
    this.button.className = 'tc-button lr-stone-button lr-zoom-btn';
    this.button.dataset.action = 'zoom';
    actions.append(this.button);
    const names = ['Look up the board', 'Look right', 'Look down the board', 'Look left'];
    this.edges = (['n', 'e', 's', 'w'] as const).map((side, i) => {
      const b = button(h('span', { 'aria-hidden': 'true' }), (e) => {
        (e.currentTarget as HTMLElement).blur();
        const L = this.L;
        if (L) hooks.go(stepCam(L, this.cam, i as 0 | 1 | 2 | 3), true);
      });
      b.className = 'lr-zoom-edge';
      b.dataset.side = side;
      b.setAttribute('aria-label', names[i]!);
      b.hidden = true;
      return b;
    });
    this.badge = button(icon('in'), (e) => {
      (e.currentTarget as HTMLElement).blur();
      hooks.onTap();
    });
    this.badge.className = 'lr-zoom-badge';
    this.badge.setAttribute('aria-label', 'Zoom in on the board');
    this.badge.hidden = true;
    this.mapSvg = document.createElementNS(SVG, 'svg');
    this.mapSvg.setAttribute('aria-hidden', 'true');
    this.mapGemsG = document.createElementNS(SVG, 'g');
    this.mapView = document.createElementNS(SVG, 'rect');
    this.mapView.setAttribute('class', 'lr-zoom-map-view');
    this.map = h('div', {
      class: 'lr-zoom-map',
      role: 'button',
      'aria-label': 'Board overview: tap to look there',
      hidden: true,
    });
    this.map.append(this.mapSvg);
    this.mapPointer();
    host.append(...this.edges, this.badge, this.map);
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

  /**
   * The magnifier badge on the board's corner, at the whole board while editing; it pulses
   * while the "Tap the board to zoom in" line shows.
   */
  setBadge(on: boolean, pulse: boolean): void {
    this.badgeOn = on;
    this.badge.toggleAttribute('data-pulse', pulse);
    if (this.L) this.placeBadge(this.L, this.cam);
  }

  /** Everything that follows the camera: the arrows, the badge and the minimap. */
  place(L: AltarLayout, c: Cam): void {
    this.L = L;
    this.cam = c;
    this.placeEdges(L, c);
    this.placeBadge(L, c);
    this.placeMap(L, c);
  }

  /** An arrow in the gutter's middle on each side the board runs on past the view. */
  private placeEdges(L: AltarLayout, c: Cam): void {
    const off = offEdges(L, c);
    this.edges.forEach((el, i) => {
      const r = arrowRect(L, i);
      el.style.left = `${Math.round(r.x0)}px`;
      el.style.top = `${Math.round(r.y0)}px`;
      if (el.hidden === off[i]) el.hidden = !off[i];
    });
  }

  private placeBadge(L: AltarLayout, c: Cam): void {
    const show = this.badgeOn && c.z <= 1;
    if (!show) {
      if (!this.badge.hidden) this.badge.hidden = true;
      return;
    }
    const css = L.phone?.cssPx ?? 1;
    const d = ARROW_CSS * css;
    const v = viewRect(L);
    const e = L.phone?.edge ?? 0;
    // Just outside one of the slab's corners, clear of the gauges and their cards.
    const busy: Rect[] = propRects(L);
    for (const k of this.labels)
      busy.push({ x0: k.left + k.l, y0: k.top + k.t, x1: k.left + k.r, y1: k.top + k.b });
    const g = 2 * css;
    const corners: [number, number][] = [
      [L.right + g, L.top - d - g],
      [L.left - d - g, L.top - d - g],
      [L.right + g, L.frontBottom + g],
      [L.left - d - g, L.frontBottom + g],
      [L.right - d, L.top - d - g],
      [L.right + g, L.top],
    ];
    const fits = (x: number, y: number) =>
      x >= v.x0 + e && y >= v.y0 + e && x + d <= v.x1 - e && y + d <= v.y1 - e;
    const clear = (x: number, y: number) =>
      !busy.some((b) => x < b.x1 && x + d > b.x0 && y < b.y1 && y + d > b.y0);
    const at =
      corners.find(([x, y]) => fits(x, y) && clear(x, y)) ??
      corners.find(([x, y]) => fits(x, y)) ??
      corners[0]!;
    this.badge.style.left = `${Math.round(at[0])}px`;
    this.badge.style.top = `${Math.round(at[1])}px`;
    if (this.badge.hidden) this.badge.hidden = false;
  }

  // ── The minimap ──────────────────────────────────────────────────────────

  /** Draw the board's still parts (slab, sockets, source, gauges) for the minimap. */
  private buildMap(L: AltarLayout): void {
    const b = blockRect(L);
    const svg = this.mapSvg;
    svg.setAttribute('viewBox', `${b.x0} ${b.y0} ${b.x1 - b.x0} ${b.y1 - b.y0}`);
    const p = L.pitch;
    const el = (tag: string, a: Record<string, string | number>) => {
      const n = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(a)) n.setAttribute(k, String(v));
      return n;
    };
    const parts: Element[] = [
      el('rect', {
        x: L.left,
        y: L.top,
        width: L.right - L.left,
        height: L.bottom - L.top,
        rx: p * 0.2,
        class: 'lr-zoom-map-slab',
      }),
    ];
    for (let y = 0; y < L.rows; y++)
      for (let x = 0; x < L.cols; x++) {
        if (!this.open(x, y)) continue;
        parts.push(
          el('circle', {
            cx: L.left + L.margin + p * (x + 0.5),
            cy: L.top + L.margin + p * (y + 0.5),
            r: p * 0.3,
            class: 'lr-zoom-map-socket',
          }),
        );
      }
    const s = L.storm;
    parts.push(el('circle', { cx: s.x, cy: s.y, r: p * 0.62, class: 'lr-zoom-map-storm' }));
    for (const m of L.machines)
      parts.push(el('circle', { cx: m.x, cy: m.y, r: p * 0.5, class: 'lr-zoom-map-gauge' }));
    svg.replaceChildren(...parts, this.mapGemsG, this.mapView);
    this.mapKey = '';
  }

  /** The gems on the board (the puzzle's fixed ones included), for the minimap. */
  mapGems(L: AltarLayout, gems: readonly MapGem[], key: string): void {
    if (key === this.mapKey) return;
    this.mapKey = key;
    const p = L.pitch;
    this.mapGemsG.replaceChildren(
      ...gems.map((g) => {
        const n = document.createElementNS(SVG, 'circle');
        n.setAttribute('cx', String(L.left + L.margin + p * (g.x + 0.5)));
        n.setAttribute('cy', String(L.top + L.margin + p * (g.y + 0.5)));
        n.setAttribute('r', String(p * 0.42));
        n.setAttribute('fill', CSS_PALETTE[GEM_COLOUR[g.gem]]);
        return n;
      }),
    );
  }

  /** The column has (no) room for the map just now; it hides rather than sit under a card. */
  setMapCrowded(on: boolean): void {
    if (this.mapCrowded === on) return;
    this.mapCrowded = on;
    if (this.L) this.placeMap(this.L, this.cam);
  }

  /** The map's top (design y) where it stands while zoomed, else null: the column's floor. */
  get mapTop(): number | null {
    return this.cam.z > 1 && this.mapBox ? this.mapBox.y0 : null;
  }

  /** Where the map stands: the column's foot, left of Strike and right of FUSE. */
  private mapSpot(L: AltarLayout): Rect | null {
    const band = L.phone;
    if (!band) return null;
    const css = band.cssPx;
    const s = this.hooks.measure(this.hooks.strike);
    if (s.x1 - s.x0 < 1) return null;
    const b = blockRect(L);
    const aspect = (b.x1 - b.x0) / (b.y1 - b.y0);
    const right = s.x0 - 10 * css;
    const left = Math.max(band.colL + band.edge, band.fuseX + 0.7 * band.fuseScale + 8 * css);
    const bottom = Math.min(s.y1, band.visB - band.edge);
    let h = MAP_MAX_CSS * css;
    let w = h * aspect;
    if (w > right - left) {
      w = right - left;
      h = w / aspect;
    }
    if (Math.min(w, h) < MAP_MIN_CSS * css * Math.min(1, aspect)) return null;
    return { x0: right - w, y0: bottom - h, x1: right, y1: bottom };
  }

  private placeMap(L: AltarLayout, c: Cam): void {
    if (c.z <= 1) {
      if (!this.map.hidden) this.map.hidden = true;
      this.mapBox = null;
      return;
    }
    const r = this.mapSpot(L);
    this.mapBox = r;
    const show = !!r && !this.mapCrowded;
    if (this.map.hidden === show) this.map.hidden = !show;
    if (!r) return;
    const st = this.map.style;
    st.left = `${Math.round(r.x0)}px`;
    st.top = `${Math.round(r.y0)}px`;
    st.width = `${Math.round(r.x1 - r.x0)}px`;
    st.height = `${Math.round(r.y1 - r.y0)}px`;
    // The viewport: the cell area, back in world px.
    const v = cellRect(L);
    const wx0 = (v.x0 - c.ox) / c.z;
    const wy0 = (v.y0 - c.oy) / c.z;
    this.mapView.setAttribute('x', String(wx0));
    this.mapView.setAttribute('y', String(wy0));
    this.mapView.setAttribute('width', String((v.x1 - v.x0) / c.z));
    this.mapView.setAttribute('height', String((v.y1 - v.y0) / c.z));
  }

  /** A tap or drag on the map looks there (the cell area centred on that point). */
  private mapPointer(): void {
    let down = false;
    const at = (e: PointerEvent, ease: boolean) => {
      const L = this.L;
      if (!L || this.cam.z <= 1) return;
      const q = this.map.getBoundingClientRect();
      const b = blockRect(L);
      const wx = b.x0 + ((e.clientX - q.left) / q.width) * (b.x1 - b.x0);
      const wy = b.y0 + ((e.clientY - q.top) / q.height) * (b.y1 - b.y0);
      const v = cellRect(L);
      const z = this.cam.z;
      const c = { z, ox: (v.x0 + v.x1) / 2 - z * wx, oy: (v.y0 + v.y1) / 2 - z * wy };
      this.hooks.go(ease ? settleCam(L, c) : clampCam(L, c), ease);
    };
    this.map.addEventListener('pointerdown', (e) => {
      down = true;
      try {
        this.map.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events have no active pointer.
      }
      at(e, false);
    });
    this.map.addEventListener('pointermove', (e) => {
      if (down) at(e, false);
    });
    const up = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      at(e, true);
    };
    this.map.addEventListener('pointerup', up);
    this.map.addEventListener('pointercancel', up);
  }

  // ── The cards ────────────────────────────────────────────────────────────

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

  /** Which cells are sockets (carved stone is not): the minimap, and cards keep off them. */
  setSockets(L: AltarLayout, open: (x: number, y: number) => boolean): void {
    this.open = open;
    this.buildMap(L);
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
   * Each card moves with its gauge. Zoomed (mobile-7-zoom):
   * - a card whose gauge is in the cell area takes the nearest spot clear of every visible
   *   socket's tap circle, every gauge, the arrows and the other cards;
   * - one whose gauge is out of it shrinks to a one-line chip with an arrow the way to it, in
   *   the gutter: north and south chips in their own gutter under their gauge, east and west
   *   ones at that end of the nearer of the two.
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
    const R = cellRect(L);
    const S = transformLayout(L, c);
    // Only sockets that show: one under the gutter is hidden by it.
    const rad = S.pitch * SOCKET_CLEAR;
    const x0 = S.left + S.margin;
    const y0 = S.top + S.margin;
    const shown = (i: number, j: number) =>
      this.open(i, j) && rectHitsCircle(R, x0 + S.pitch * (i + 0.5), y0 + S.pitch * (j + 0.5), rad);
    const sockets = socketHits(S, shown);
    const props = propRects(L).map((p) => ({
      x0: c.ox + c.z * p.x0,
      x1: c.ox + c.z * p.x1,
      y0: c.oy + c.z * p.y0,
      y1: c.oy + c.z * p.y1,
    }));
    const inView = props.map(
      (b) => b.x0 >= R.x0 - 1 && b.x1 <= R.x1 + 1 && b.y0 >= R.y0 - 1 && b.y1 <= R.y1 + 1,
    );
    const gauges = [S.storm, ...S.machines]
      .map((sp, i) => ({ x: sp.x, y: sp.y, r: sp.size * (i === 0 ? 0.26 : 0.46), on: inView[i] }))
      .filter((g) => g.on);
    const placed: Rect[] = [];
    const [n, ea, so, w] = offEdges(L, c);
    [n, ea, so, w].forEach((on, i) => {
      if (on) placed.push(arrowRect(L, i));
    });
    const pad = 4 * css;
    const near = (r: Rect) =>
      placed.some(
        (p) => r.x0 < p.x1 + pad && r.x1 > p.x0 - pad && r.y0 < p.y1 + pad && r.y1 > p.y0 - pad,
      );
    const onGauge = (r: Rect) => gauges.some((g) => rectHitsCircle(r, g.x, g.y, g.r));
    const all = (r: Rect) => sockets(r) || onGauge(r) || near(r);
    const bounds = { x0: v.x0 + e, y0: v.y0 + e, x1: v.x1 - e, y1: v.y1 - e };
    const step = 4 * css;
    const midY = (R.y0 + R.y1) / 2;
    this.labels.forEach((k) => {
      const pi = k.spot === L.storm ? 0 : 1 + L.machines.indexOf(k.spot);
      const pb = props[Math.max(0, pi)]!;
      const gx = c.ox + c.z * k.spot.x;
      const gy = c.oy + c.z * k.spot.y;
      let x = k.left + (gx - k.spot.x);
      let y = k.top + (gy - k.spot.y);
      let off = '';
      if (!inView[pi] || pi < 0) {
        if (pb.y1 <= R.y0 + 1) off = 'n';
        else if (pb.y0 >= R.y1 - 1) off = 's';
        else if (pb.x0 >= R.x1 - 1) off = 'e';
        else if (pb.x1 <= R.x0 + 1) off = 'w';
      }
      if ((k.el.dataset.off ?? '') !== off) {
        if (off) k.el.dataset.off = off;
        else k.el.removeAttribute('data-off');
      }
      const want = this.extent(k, x, y);
      let dx = 0;
      let dy = 0;
      if (off) {
        // Into the gutter: its own side's for north and south, else the nearer of the two.
        const top = off === 'n' || ((off === 'e' || off === 'w') && gy < midY);
        const g: Rect = top
          ? { x0: v.x0 + e, y0: v.y0, x1: v.x1 - e, y1: R.y0 }
          : { x0: v.x0 + e, y0: R.y1, x1: v.x1 - e, y1: v.y1 };
        const cw = want.x1 - want.x0;
        const chh = want.y1 - want.y0;
        const tx =
          off === 'e'
            ? g.x1 - cw
            : off === 'w'
              ? g.x0
              : Math.min(g.x1 - cw, Math.max(g.x0, gx - cw / 2));
        const ty = (g.y0 + g.y1) / 2 - chh / 2;
        const from: Rect = { x0: tx, y0: ty, x1: tx + cw, y1: ty + chh };
        const loose: Rect = {
          x0: g.x0,
          y0: Math.min(g.y0, ty),
          x1: g.x1,
          y1: Math.max(g.y1, ty + chh),
        };
        const at =
          clearSpot(from, loose, near, step, v.x1 - v.x0, 1, 50) ??
          clearSpot(from, loose, () => false, step, 0);
        dx = tx - want.x0 + (at?.dx ?? 0);
        dy = ty - want.y0 + (at?.dy ?? 0);
      } else {
        const at =
          clearSpot(want, bounds, all, step, 4 * S.pitch) ??
          clearSpot(want, bounds, sockets, step, 8 * S.pitch) ??
          clearSpot(want, bounds, () => false, step, 0);
        dx = at?.dx ?? 0;
        dy = at?.dy ?? 0;
      }
      x += dx;
      y += dy;
      placed.push({ x0: want.x0 + dx, y0: want.y0 + dy, x1: want.x1 + dx, y1: want.y1 + dy });
      k.el.style.left = `${Math.round(x)}px`;
      k.el.style.top = `${Math.round(y)}px`;
      // Slid off its gauge: the notch would point at nothing.
      k.el.toggleAttribute('data-free', !off && Math.hypot(dx, dy) > 3 * css);
    });
  }

  dispose(): void {
    this.button.remove();
    for (const el of this.edges) el.remove();
    this.badge.remove();
    this.map.remove();
    this.labels = [];
    this.sizes.clear();
  }
}

/** Edge arrow `i` (n, e, s, w): in the middle of that side's gutter. */
export function arrowRect(L: AltarLayout, i: number): Rect {
  const v = viewRect(L);
  const R = cellRect(L);
  const d = ARROW_CSS * (L.phone?.cssPx ?? 1);
  const mx = (R.x0 + R.x1) / 2;
  const my = (R.y0 + R.y1) / 2;
  const cx = [mx, (R.x1 + v.x1) / 2, mx, (v.x0 + R.x0) / 2][i]!;
  const cy = [(v.y0 + R.y0) / 2, my, (R.y1 + v.y1) / 2, my][i]!;
  return { x0: cx - d / 2, y0: cy - d / 2, x1: cx + d / 2, y1: cy + d / 2 };
}

/**
 * The Holding pill never touches Menu (mobile-7-zoom): slide it left until it is
 * `MENU_GAP_CSS` clear. `scale` is CSS px per design px.
 */
export function keepClearOfMenu(pill: HTMLElement, menu: Element | null, scale: number): void {
  pill.style.marginLeft = '';
  if (!menu || pill.hidden) return;
  const m = menu.getBoundingClientRect();
  const p = pill.getBoundingClientRect();
  if (m.width < 1 || p.width < 1) return;
  if (p.bottom <= m.top || p.top >= m.bottom) return;
  const over = p.right + MENU_GAP_CSS - m.left;
  if (over > 0) pill.style.marginLeft = `${-Math.ceil(over / scale)}px`;
}

const CT = 'var(--lr-crop-t, 0px)';
const A = `${P} .lr-altar[data-phone]`;
const MAG_URL = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='${MAGNIFIER}' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round'/></svg>`,
)}")`;

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

/* mobile-7-zoom: an arrow in the gutter on each side the board runs on past the view; a tap
   pans one step. Gold on a dark disc, 32 CSS px. */
.tc-overlay .lr-zoom-edge {
  position: absolute; box-sizing: border-box; width: ${cpx(ARROW_CSS)}; height: ${cpx(ARROW_CSS)};
  padding: 0; margin: 0; border-radius: 50%; border: ${cpx(1.5)} solid var(--lr-gold, #e8c06a);
  background: rgba(16,12,8,0.92); color: #ffd77a; cursor: pointer; pointer-events: auto;
  display: flex; align-items: center; justify-content: center; font-size: ${cpx(15)}; line-height: 1;
  box-shadow: 0 0 0 ${cpx(1)} rgba(0,0,0,0.8), 0 ${cpx(2)} ${cpx(6)} rgba(0,0,0,0.7);
}
.tc-overlay .lr-zoom-edge[hidden] { display: none; }
.tc-overlay .lr-zoom-edge:active { background: rgba(70,52,20,0.95); }
.tc-overlay .lr-zoom-edge[data-side="n"]::after { content: '\\25B2'; }
.tc-overlay .lr-zoom-edge[data-side="s"]::after { content: '\\25BC'; }
.tc-overlay .lr-zoom-edge[data-side="e"]::after { content: '\\25B6'; margin-left: ${cpx(2)}; }
.tc-overlay .lr-zoom-edge[data-side="w"]::after { content: '\\25C0'; margin-right: ${cpx(2)}; }

/* The magnifier badge on the board's corner at the whole board (the zoom line wears it too). */
.tc-overlay .lr-zoom-badge {
  position: absolute; box-sizing: border-box; width: ${cpx(ARROW_CSS)}; height: ${cpx(ARROW_CSS)};
  padding: 0; margin: 0; border-radius: 50%; border: ${cpx(1.5)} solid var(--lr-gold, #e8c06a);
  background: rgba(16,12,8,0.9); cursor: pointer; pointer-events: auto;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 ${cpx(2)} ${cpx(6)} rgba(0,0,0,0.7);
}
.tc-overlay .lr-zoom-badge[hidden] { display: none; }
.tc-overlay .lr-zoom-badge .lr-zoom-ico { width: ${cpx(20)}; height: ${cpx(20)}; stroke-width: 2; }
.tc-overlay .lr-zoom-badge[data-pulse] { animation: lr-zoom-pulse 1.6s ease-in-out infinite; }
@keyframes lr-zoom-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,122,0.55), 0 ${cpx(2)} ${cpx(6)} rgba(0,0,0,0.7); }
  50% { box-shadow: 0 0 0 ${cpx(6)} rgba(255,215,122,0), 0 ${cpx(2)} ${cpx(6)} rgba(0,0,0,0.7); }
}
@media (prefers-reduced-motion: reduce) {
  .tc-overlay .lr-zoom-badge[data-pulse] { animation: none; box-shadow: 0 0 0 ${cpx(3)} rgba(255,215,122,0.45); }
}
${A} .lr-altar-hint[data-zoomhint]::before {
  content: ''; display: inline-block; width: 1.1em; height: 1.1em; margin-right: 0.35em;
  vertical-align: -0.2em; background: var(--lr-gold, #e8c06a);
  -webkit-mask: ${MAG_URL} center / contain no-repeat; mask: ${MAG_URL} center / contain no-repeat;
}

/* The minimap: the whole board and where the view is on it. */
.tc-overlay .lr-zoom-map {
  position: absolute; box-sizing: border-box; padding: ${cpx(3)}; border-radius: ${cpx(6)};
  border: ${cpx(1)} solid rgba(232,192,106,0.75); background: rgba(10,9,12,0.88);
  box-shadow: 0 ${cpx(2)} ${cpx(8)} rgba(0,0,0,0.7); cursor: pointer; pointer-events: auto; touch-action: none;
}
.tc-overlay .lr-zoom-map[hidden] { display: none; }
.tc-overlay .lr-zoom-map svg { display: block; width: 100%; height: 100%; overflow: visible; }
.tc-overlay .lr-zoom-map-slab { fill: #3b4252; stroke: #8b93a6; stroke-width: 6; }
.tc-overlay .lr-zoom-map-socket { fill: #12141c; stroke: #c9c2b0; stroke-width: 5; }
.tc-overlay .lr-zoom-map-storm { fill: #7fe0ff; stroke: #e8fbff; stroke-width: 6; }
.tc-overlay .lr-zoom-map-gauge { fill: #e8c06a; stroke: #2a1d14; stroke-width: 6; }
.tc-overlay .lr-zoom-map-view {
  fill: rgba(255,215,122,0.14); stroke: #ffd77a; stroke-width: ${cpx(2)}; vector-effect: non-scaling-stroke;
}

/* A card whose gauge is out of the cells: a one-line chip in the gutter, its notch traded for
   an arrow the way to the gauge. A card slid off its gauge to clear the sockets drops its
   notch too. */
${A} .lr-altar-need:is([data-off], [data-free])::before { display: none; }
${A} .lr-altar-need[data-off] :is(.lr-need-note, .lr-storm-row, .lr-need-got, .lr-need-strikes) { display: none; }
${A} .lr-altar-need[data-off] { white-space: nowrap; max-width: none !important; flex-direction: row; }
${A} .lr-altar-need[data-off]::after {
  position: absolute; top: 50%; transform: translateY(-50%); color: var(--lr-gold, #e8c06a);
  font-size: ${tpx(14)}; line-height: 1; text-shadow: 0 0 ${cpx(3)} #000;
}
${A} .lr-altar-need[data-off="e"] { padding-right: ${cpx(17)}; }
${A} .lr-altar-need[data-off="e"]::after { content: '\\2192'; right: ${cpx(3)}; }
${A} :is(.lr-altar-need[data-off="w"], .lr-altar-need[data-off="n"], .lr-altar-need[data-off="s"]) { padding-left: ${cpx(17)}; }
${A} .lr-altar-need[data-off="w"]::after { content: '\\2190'; left: ${cpx(3)}; }
${A} .lr-altar-need[data-off="n"]::after { content: '\\2191'; left: ${cpx(4)}; }
${A} .lr-altar-need[data-off="s"]::after { content: '\\2193'; left: ${cpx(4)}; }
`;

function ensureZoomStyles(doc: Document): void {
  if (doc.getElementById('lr-zoom-styles')) return;
  const el = doc.createElement('style');
  el.id = 'lr-zoom-styles';
  el.textContent = scaleFontSizes(CSS);
  doc.head.append(el);
}
