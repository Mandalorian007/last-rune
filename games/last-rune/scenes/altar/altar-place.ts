/**
 * Where the altar's DOM goes: the title, verdict, labels and FUSE's card kept clear of the board and the buttons.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
 */
import type { Rect } from '@thunderclap/engine/ui';
import { dpx, dpxOf } from '../../ui/frame-units';
import { boxesTouch, designBox } from './altar-defs';
import type { AltarScene } from './altar-scene';
import {
  type AltarLayout,
  anchorOf,
  CAPTION_LANE,
  FUSE_LANE,
  type PhoneBand,
  type PropSpot,
  TRAY_CENTER_X,
} from './layout';

export const placeMethods = {
  /**
   * Left edge (design px) of FUSE's caption card when it sits beside the tray, so the gem card
   * stops short of it (a phone's caption is bigger than the lane the layout keeps for it).
   */
  captionLeft(this: AltarScene, L: AltarLayout): number {
    const ui = this.ctx.ui;
    const cap = ui.root.querySelector<HTMLElement>('.tc-caption:not([hidden])');
    const r = cap?.getBoundingClientRect();
    if (!r || r.width === 0) return CAPTION_LANE.x;
    const o = ui.layers.hud.getBoundingClientRect();
    const top = (r.top - o.top) / ui.scale;
    const left = (r.left - o.left) / ui.scale;
    if (top > 1080 || (r.bottom - o.top) / ui.scale < L.trayY - 200 || left < TRAY_CENTER_X)
      return CAPTION_LANE.x;
    return Math.min(CAPTION_LANE.x, left - 16);
  },

  /**
   * Keep FUSE's caption card off the tray band (slots, counts, tooltips) and the key-hint line.
   * The hint is measured, so a longer line or a bigger text size moves the card as needed.
   */
  avoidTray(this: AltarScene): void {
    const L = this.view.layout;
    // Phones: the caption has its own bubble in the bottom band (phoneCaption).
    if (L.phone) {
      this.ctx.fuse.keepClear(null);
      return;
    }
    const regions: Rect[] = [];
    const xs = L.tray.map((s) => s.x);
    if (xs.length) {
      const left = Math.min(...xs) - 80;
      const right = Math.max(...xs) + 80;
      regions.push({
        x: left,
        y: L.trayY - 90,
        width: right - left,
        height: 1080 - (L.trayY - 90),
      });
    }
    // FUSE himself (bottom-left): the card may move to that corner, but never over his body.
    regions.push({
      x: 0,
      y: FUSE_LANE.y - 30,
      width: FUSE_LANE.x,
      height: 1080 - (FUSE_LANE.y - 30),
    });
    // Machine need labels, and the button rows, so the card never moves over them either
    // (bigger text makes the card taller, and it can reach a label beside an east machine).
    if (this.dom.isConnected) {
      const ui = this.ctx.ui;
      const o = ui.layers.hud.getBoundingClientRect();
      const els = [
        this.hint,
        ...(this.verdict.hidden ? [] : [this.verdict]),
        ...this.needs,
        ...(this.stormLabel ? [this.stormLabel] : []),
        this.undoBtn,
        this.clearBtn,
        this.backBtn,
        this.strikeBtn,
        ...(this.turnBtn.hidden ? [] : [this.turnBtn]),
        ...ui.root.ownerDocument.querySelectorAll<HTMLElement>('.lr-hud'),
      ];
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        regions.push({
          x: (r.left - o.left) / ui.scale,
          y: (r.top - o.top) / ui.scale,
          width: r.width / ui.scale,
          height: r.height / ui.scale,
        });
      }
    }
    this.ctx.fuse.keepClear(regions);
  },

  /**
   * Keep the title and the verdict under it clear of the HUD buttons (left) and the action
   * row (right). They stay where the layout put them (clear of north gauges) unless bigger
   * text would push them into a button; then they narrow and slide just far enough.
   */
  fitTop(this: AltarScene): void {
    const L = this.view.layout;
    const ui = this.ctx.ui;
    if (!this.dom.isConnected) return;
    if (L.phone) {
      this.fitPhone(L.phone);
      return;
    }
    const origin = ui.layers.hud.getBoundingClientRect().left;
    const toDesign = (px: number) => (px - origin) / ui.scale;
    let hudRight = 0;
    for (const b of ui.root.querySelectorAll<HTMLElement>('.lr-hud:not([hidden]) button')) {
      const r = b.getBoundingClientRect();
      if (r.width > 0) hudRight = Math.max(hudRight, toDesign(r.right));
    }
    const actionsLeft = toDesign(this.actionsEl.getBoundingClientRect().left);
    const half = (L.titleMax + 20) / 2;
    const lo = Math.max(hudRight + 16, L.titleX - half);
    const hi = Math.min(actionsLeft - 16, L.titleX + half);
    const room = Math.max(200, hi - lo);
    const place = (el: HTMLElement, maxW: number) => {
      el.style.maxWidth = dpx(Math.round(maxW));
      const w = el.offsetWidth / ui.scale;
      const x =
        lo + w / 2 > hi - w / 2
          ? (lo + hi) / 2
          : Math.min(Math.max(L.titleX, lo + w / 2), hi - w / 2);
      el.style.left = dpx(Math.round(x));
    };
    place(this.titleEl, room);
    const verdictW = Math.min(L.titleMax, room);
    this.verdict.toggleAttribute('data-narrow', verdictW < 600);
    if (!this.verdict.hidden) place(this.verdict, verdictW);
    for (const el of this.needs) this.clearOfActions(el);
    if (this.stormLabel) {
      this.clearOfBoard(this.stormLabel);
      this.clearOfActions(this.stormLabel);
    }
    // The verdict sits under the title, however many lines the title took.
    const titleBottom = (this.titleEl.offsetTop + this.titleEl.offsetHeight) / ui.scale;
    this.verdict.style.top = dpx(Math.max(96, titleBottom + 6));
    this.verdict.removeAttribute('data-docked');
    if (!this.verdict.hidden) this.clearRootMark(lo, hi);
    this.avoidTray();
  },

  /**
   * Phones: the title is one line over the board's centre; the verdict sits in the info lane
   * (bottom right, beside the tray), bottom-aligned, never over the board.
   */
  fitPhone(this: AltarScene, band: PhoneBand): void {
    // The title heads the column's region (altar-chrome.ts), which sizes it.
    this.titleEl.style.left = '';
    this.titleEl.style.maxWidth = '';
    const v = this.verdict;
    v.removeAttribute('data-docked');
    v.removeAttribute('data-narrow');
    v.style.top = '';
    this.placePhoneLabels(band);
    this.ctx.fuse.keepClear(null);
  },

  /**
   * Phones: every Gives/Needs card beside its own gauge, never on the board (8 CSS px clear).
   * West/east cards hang under their gauge in its gutter, wrapping to fit; north/south cards
   * sit beside the gauge, outside the board's edge, on whichever side is free of the other
   * gauges and cards.
   */
  placePhoneLabels(this: AltarScene, band: PhoneBand): void {
    const L = this.view.layout;
    const k = this.ctx.ui.scale;
    const ox = this.ctx.ui.layers.hud.getBoundingClientRect();
    const box = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        l: (r.left - ox.left) / k,
        r: (r.right - ox.left) / k,
        t: (r.top - ox.top) / k,
        b: (r.bottom - ox.top) / k,
      };
    };
    type Box = ReturnType<typeof box>;
    const hit = (a: Box, b: Box, pad: number) =>
      a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
    const gauge = (sp: PropSpot): Box => {
      const half = sp === L.storm ? sp.size * 0.26 : sp.size * 0.46;
      return { l: sp.x - half, r: sp.x + half, t: sp.y - half, b: sp.y + half };
    };
    const items: [HTMLElement, PropSpot][] = [
      ...(this.stormLabel ? [[this.stormLabel, L.storm] as [HTMLElement, PropSpot]] : []),
      ...this.needs.map((el, i) => [el, L.machines[i]!] as [HTMLElement, PropSpot]),
    ];
    const gauges = [L.storm, ...L.machines].map(gauge);
    const placed: Box[] = [];
    const minX = band.padL + band.edge;
    const maxX = band.colL - band.edge;
    // West/east cards sit under their gauge; north/south ones beside it, right or left. The
    // sides are chosen together (every combination, ≤2^4): never off the open canvas, under a
    // side bar or into the column, then not over another card, then not over a gauge.
    const free: { el: HTMLElement; sp: PropSpot; opts: { x: number; b: Box; cost: number }[] }[] =
      [];
    for (const [el, sp] of items) {
      const lb = sp.label;
      el.style.marginLeft = '';
      el.style.marginTop = '';
      el.style.maxWidth = '';
      if (lb.align === 'below') {
        el.dataset.align = 'below';
        // port-altar-3: the card is as wide as its words (two lines, never spilling); it
        // slides along under its gauge to stay off the left rail and out of the column.
        el.style.left = dpx(lb.x);
        el.style.top = dpx(lb.y);
        // Off the bottom of the screen: up over the gauge's top instead.
        if (box(el).b > band.visB - band.edge) {
          el.dataset.align = 'above';
          el.style.top = dpx(Math.round(gauge(sp).t));
        }
        const b0 = box(el);
        // Off the sockets: a card under an east gauge starts right of the sockets' edge, one
        // under a west gauge ends left of it, when the open canvas has the room.
        const inner = L.margin + L.pitch * 0.02;
        let want = 0;
        if (b0.t < L.frontBottom && b0.b > L.top) {
          if (sp.x > L.right && b0.l < L.right - inner) want = L.right - inner - b0.l;
          if (sp.x < L.left && b0.r > L.left + inner) want = L.left + inner - b0.r;
        }
        const lo = minX - b0.l;
        const hi = maxX - b0.r;
        const shift = hi < lo ? lo : Math.min(hi, Math.max(lo, want));
        el.style.removeProperty('--lr-notch');
        if (shift) {
          el.style.marginLeft = dpx(Math.round(shift));
          // The notch stays under the gauge.
          el.style.setProperty('--lr-notch', dpx(Math.round((b0.r - b0.l) / 2 - shift)));
        }
        // Squeezed back over the sockets (no room before the column): down past them instead.
        const b1 = box(el);
        let under = 0;
        for (let y = 0; y < L.rows; y++)
          for (let x = 0; x < L.cols; x++) {
            if (this.puzzle.blocked.some((c) => c.x === x && c.y === y)) continue;
            const r = L.pitch * 0.38;
            const cx = L.left + L.margin + L.pitch * (x + 0.5);
            const cy = L.top + L.margin + L.pitch * (y + 0.5);
            if (b1.l < cx + r && b1.r > cx - r && b1.t < cy + r && b1.b > cy - r)
              under = Math.max(under, cy + r + 2 - b1.t);
          }
        if (under > 0 && el.dataset.align === 'below' && b1.b + under <= band.visB - band.edge)
          el.style.marginTop = dpx(Math.ceil(under));
        placed.push(box(el));
        continue;
      }
      el.dataset.align = lb.align === 'up' ? 'up' : 'down';
      el.style.top = dpx(lb.y);
      const own = gauge(sp);
      const opts = [...new Set([lb.x, lb.alt ?? lb.x])].map((x) => {
        el.toggleAttribute('data-left', x < sp.x);
        el.style.left = dpx(x);
        const b = box(el);
        const cost =
          (b.l < minX || b.r > maxX ? 100 : 0) +
          (gauges.some((g) => g !== own && hit(b, g, 2)) ? 1 : 0);
        return { x, b, cost };
      });
      free.push({ el, sp, opts });
    }
    let best: number[] = free.map(() => 0);
    let bestCost = Number.POSITIVE_INFINITY;
    const pick: number[] = [];
    const search = (i: number, cost: number) => {
      if (cost >= bestCost) return;
      if (i === free.length) {
        best = [...pick];
        bestCost = cost;
        return;
      }
      free[i]!.opts.forEach((o, j) => {
        let c = cost + o.cost;
        if (placed.some((p) => hit(o.b, p, 4))) c += 10;
        for (let k = 0; k < i; k++) if (hit(o.b, free[k]!.opts[pick[k]!]!.b, 4)) c += 10;
        pick[i] = j;
        search(i + 1, c);
      });
    };
    search(0, 0);
    // Never closer than 8 CSS px to the visible band's top (mobile-6-board): a two-line
    // north card nudges down instead (into the clearance above the board, not over it).
    const topMin = band.visT + 8 * band.cssPx;
    free.forEach(({ el, sp, opts }, i) => {
      const x = opts[best[i]!]!.x;
      el.toggleAttribute('data-left', x < sp.x);
      el.style.left = dpx(x);
      const t = box(el).t;
      if (t < topMin) el.style.marginTop = dpx(Math.ceil(topMin - t));
    });
  },

  /**
   * A storm on the west or east edge has its "Gives N" card centred under it, which at bigger
   * text reaches over the board's first column. Slide the card outward until it clears the
   * sockets; the notch stays under the storm.
   */
  clearOfBoard(this: AltarScene, el: HTMLElement): void {
    const L = this.view.layout;
    const side = L.storm.side;
    el.style.marginLeft = '';
    el.style.removeProperty('--lr-notch');
    // Runs while the DOM is still being built (setStrikeRow), before `dom` is attached.
    if ((side !== 1 && side !== 3) || !this.dom?.isConnected) return;
    const w = el.offsetWidth / this.ctx.ui.scale;
    const x = L.storm.label.x;
    const gap = 6;
    let shift = 0;
    if (side === 3) {
      const edge = L.left + L.margin - gap;
      shift = Math.min(0, edge - (x + w / 2));
      shift = Math.max(shift, 8 - (x - w / 2)); // never off the left of the screen
    } else {
      const edge = L.right - L.margin + gap;
      shift = Math.max(0, edge - (x - w / 2));
    }
    if (shift === 0) return;
    el.style.marginLeft = dpx(Math.round(shift));
    el.style.setProperty('--lr-notch', dpx(Math.round(w / 2 - shift)));
  },

  /**
   * The verdict never hides the red mark its Try line points at (at 1280×720 with big text the
   * box reaches the board's top row). Slide it sideways within the title band if that clears
   * the socket; otherwise dock it under the altar, between the board and the tray.
   */
  /** Big screens: whether the verdict covers the socket where the strike went wrong. */
  verdictCoversRoot(this: AltarScene): boolean {
    const cell = this.verdictAvoid;
    if (!cell || this.verdict.hidden) return false;
    const L = this.view.layout;
    const c = { x: 0, y: 0 };
    anchorOf(L, cell, c);
    const r = L.pitch * 0.5;
    const b = designBox(this.verdict);
    return b.l < c.x + r && b.r > c.x - r && b.t < c.y + r && b.b > c.y - r;
  },

  clearRootMark(this: AltarScene, lo: number, hi: number): void {
    const cell = this.verdictAvoid;
    if (!cell) return;
    const L = this.view.layout;
    const c = { x: 0, y: 0 };
    anchorOf(L, cell, c);
    const r = L.pitch * 0.5;
    const covers = () => {
      const b = designBox(this.verdict);
      return b.l < c.x + r && b.r > c.x - r && b.t < c.y + r && b.b > c.y - r;
    };
    if (!covers()) return;
    const v = this.verdict;
    const k = this.ctx.ui.scale;
    const w = v.offsetWidth / k;
    const x0 = v.style.left;
    for (const x of [lo + w / 2, hi - w / 2]) {
      v.style.left = dpx(Math.round(x));
      if (!covers()) return;
    }
    // Docked: under the last row of sockets, above the tray gems, a little wider so the
    // headline and the Try line take a line each.
    const last = { x: 0, y: 0 };
    anchorOf(L, { x: 0, y: L.rows - 1 }, last);
    const top = last.y + L.pitch * 0.5 + 10;
    const floor = L.trayY - (L.tray[0]?.size ?? 92) / 2 - 6;
    const top0 = v.style.top;
    const maxW0 = v.style.maxWidth;
    const narrow0 = v.hasAttribute('data-narrow');
    v.toggleAttribute('data-docked', true);
    v.removeAttribute('data-narrow');
    v.style.maxWidth = dpx(Math.round(Math.min(780, L.right - L.left)));
    // Centred under the board, but kept out of the caption lane, so FUSE's card keeps its
    // bottom-right corner instead of moving over FUSE.
    const dw = v.offsetWidth / k;
    const cx = Math.max(
      16 + dw / 2,
      Math.min((L.left + L.right) / 2, CAPTION_LANE.x - 12 - dw / 2),
    );
    v.style.left = dpx(Math.round(cx));
    v.style.top = dpx(Math.round(top));
    if (top + v.offsetHeight / k <= floor && !covers()) return;
    // No room under the board: keep the usual place (better than covering the tray).
    v.removeAttribute('data-docked');
    v.toggleAttribute('data-narrow', narrow0);
    v.style.maxWidth = maxW0;
    v.style.left = x0;
    v.style.top = top0;
  },

  /**
   * Whether a tag covers any of the verdict box (headline, Try line or story), measured on the
   * laid-out boxes (not mid-animation rects), for tags above or below their anchor, any text size.
   */
  overlapsVerdict(this: AltarScene, tag: HTMLElement): boolean {
    if (this.verdict.hidden || !this.dom.isConnected || this.lane) return false;
    return boxesTouch(tag, this.verdict, 6);
  },

  /**
   * Settle a fizzle tag where it covers neither the verdict box nor an earlier tag: above its
   * anchor, else hung below it, else one tag-height further out, else just under the verdict if
   * that is still near its cell. A tag that would land far from its cell is dropped (false): the
   * red mark and the Try line still say it, and a stray tag would point at the wrong socket.
   */
  placeClear(
    this: AltarScene,
    tag: HTMLElement,
    above: number,
    below: number,
    others: HTMLElement[],
  ): boolean {
    const at = (y: number, low: boolean) => {
      tag.toggleAttribute('data-below', low);
      tag.style.top = dpx(Math.round(y));
    };
    const L = this.view.layout;
    if (L.phone) {
      // Phones: by its red socket, slid along to stay over the slab (never over the storm or
      // a card), then above or below whichever is clear.
      const x0 = dpxOf(tag.style.left);
      const w = tag.offsetWidth / this.ctx.ui.scale;
      const x = Math.min(Math.max(x0, L.left + w / 2), Math.max(L.left + w / 2, L.right - w / 2));
      tag.style.left = dpx(Math.round(x));
      const labels = [this.stormLabel, ...this.needs].filter((e): e is HTMLElement => !!e);
      const ok = () => {
        const r = tag.getBoundingClientRect();
        const pad = 2;
        return (
          !others.some((o) => boxesTouch(tag, o, 2)) &&
          !labels.some((e) => {
            const q = e.getBoundingClientRect();
            return (
              r.left < q.right + pad &&
              r.right > q.left - pad &&
              r.top < q.bottom + pad &&
              r.bottom > q.top - pad
            );
          }) &&
          designBox(tag).t >= 0
        );
      };
      for (const [y, low] of [
        [above, false],
        [below, true],
      ] as [number, boolean][]) {
        at(y, low);
        if (ok()) return true;
      }
      tag.remove();
      this.tags.splice(this.tags.indexOf(tag), 1);
      return false;
    }
    // Never up into the title band above the verdict either.
    const clear = () =>
      designBox(tag).t >= 90 &&
      !this.overlapsVerdict(tag) &&
      !others.some((o) => boxesTouch(tag, o, 2));
    if (clear()) return true;
    const step = tag.offsetHeight / this.ctx.ui.scale + 6;
    const tries: [number, boolean][] = [
      [below, true],
      [below + step, true],
      [above - step, false],
    ];
    // Off the top edge the cell sits under the verdict: hang just below the whole box.
    const vBottom =
      dpxOf(this.verdict.style.top) + this.verdict.offsetHeight / this.ctx.ui.scale + 8;
    if (vBottom - below <= this.view.layout.pitch) tries.push([vBottom, true]);
    for (const [y, low] of tries) {
      at(y, low);
      if (clear()) return true;
    }
    tag.remove();
    this.tags.splice(this.tags.indexOf(tag), 1);
    return false;
  },

  /**
   * A need label beside a machine near the top edge can grow (bigger text, per-strike
   * readings) into the action row; drop it just below the row when it would touch.
   */
  clearOfActions(this: AltarScene, el: HTMLElement): void {
    if (!this.dom.isConnected || !this.actionsEl || this.view.layout.phone) return;
    el.style.marginTop = '';
    const a = this.actionsEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const gap = 8 * this.ctx.ui.scale;
    if (r.right <= a.left || r.left >= a.right || r.top >= a.bottom + gap) return;
    el.style.marginTop = dpx(Math.ceil((a.bottom + gap - r.top) / this.ctx.ui.scale));
  },
};
