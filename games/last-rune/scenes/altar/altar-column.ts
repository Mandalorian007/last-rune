/**
 * Phones: the column beside the board (title, tray, cards, FUSE's line) and Turn.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
 *
 * port-altar-3: the column is regions on the CSS-px chrome (altar-chrome.ts `placeAltarChrome`):
 * the head (title, tray slots and counts) in `top`, the cards in `cardLane`, FUSE's line docked
 * under them, Strike in `bottom`. Regions never overlap, so the only rule left here is who
 * speaks: a card up (verdict, gem or teach card, a live read-out) and FUSE waits; FUSE talking
 * and the how-to line and the plan read-outs wait.
 */
import { h } from '@thunderclap/engine/ui';
import { isRotational } from '../../rules';
import type { Cell } from '../../rules/types';
import { SVG_NS } from './altar-defs';
import type { AltarScene } from './altar-scene';
import {
  type AltarLayout,
  cellCenter,
  FUSE_LANE,
  TRAY_CENTER_X,
  TRAY_COUNT_DROP,
  trayTipX,
} from './layout';
import { straightLine, turnTeachLine } from './moments';

/** A box in design px. */
interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

/** Does the axis-aligned segment a→b (design px) come within `pad` of the box? */
export function segmentHits(
  a: { x: number; y: number },
  b: { x: number; y: number },
  q: Box,
  pad = 0,
): boolean {
  const l = Math.min(a.x, b.x);
  const r = Math.max(a.x, b.x);
  const t = Math.min(a.y, b.y);
  const bt = Math.max(a.y, b.y);
  return l < q.r + pad && r > q.l - pad && t < q.b + pad && bt > q.t - pad;
}

/**
 * The teach card's leader to a socket, design px: out of the card level with its anchor to the
 * gap between the slab's last column and its rim, along that gap to the grid line between two
 * rows, along the line to the socket's column, then half a cell in to the ring. It runs between
 * sockets, never over one. `null` when the board is laid out without room for it.
 */
export function leaderPath(
  L: Pick<AltarLayout, 'left' | 'right' | 'top' | 'margin' | 'pitch' | 'rows'>,
  from: { x: number; y: number },
  cell: { x: number; y: number },
  ring: number,
): { x: number; y: number }[] {
  const x0 = L.left + L.margin;
  const y0 = L.top + L.margin;
  const cx = x0 + L.pitch * (cell.x + 0.5);
  const cy = y0 + L.pitch * (cell.y + 0.5);
  // The grid line above or below the socket's row, whichever is nearer the card's anchor.
  const above = y0 + L.pitch * cell.y;
  const below = above + L.pitch;
  const gy = Math.abs(from.y - above) <= Math.abs(from.y - below) ? above : below;
  const rim = L.right - L.margin / 2;
  const end = { x: cx, y: gy < cy ? cy - ring : cy + ring };
  return [from, { x: rim, y: from.y }, { x: rim, y: gy }, { x: cx, y: gy }, end];
}

export const columnMethods = {
  /** Phones: FUSE's line back to its own corner style on exit (its tail is set per frame). */
  phoneCaption(this: AltarScene, on: boolean): void {
    if (!on) this.ctx.ui.caption.element.style.removeProperty('--lr-cap-tail');
  },

  /**
   * Phones: the head's slots and counts over the gems the canvas draws at `L.tray`. The gems
   * are lit, lifted and animated on the canvas, so they stay there; the head converts the same
   * design-px spots to its own CSS px through the scaled overlay's box, whenever either moves.
   */
  placeHead(this: AltarScene): void {
    const head = this.head;
    if (!head?.isConnected) return;
    const L = this.view.layout;
    const o = this.ctx.ui.root.getBoundingClientRect();
    const hr = head.getBoundingClientRect();
    if (o.width <= 0 || hr.width <= 0) return;
    const k = o.width / 1920;
    const key = [o.left, o.top, k, hr.left, hr.top].map((n) => n.toFixed(2)).join();
    if (key === this.headKey) return;
    this.headKey = key;
    const x = (dx: number) => `${(o.left + dx * k - hr.left).toFixed(1)}px`;
    const y = (dy: number) => `${(o.top + dy * k - hr.top).toFixed(1)}px`;
    L.tray.forEach((t, i) => {
      const s = this.slotEls[i]?.style;
      if (s) {
        s.left = x(t.x);
        s.top = y(t.y);
        s.width = s.height = `${(t.size * k).toFixed(1)}px`;
      }
      // The count is a badge centred under the gem, its top clear of the glyph (glyph-truth:
      // on the corner it hid the Split's input end and the Gate's lower input), the same in
      // every room.
      const c = this.counts[i]?.style;
      if (c) {
        c.left = x(t.x);
        c.top = y(t.y + t.size * TRAY_COUNT_DROP);
      }
    });
  },

  /**
   * Phones: the arrival card points at what it teaches. A fixed gem's page draws a gold line
   * from the card to that gem on the board (which also pulses); a tray gem's page rings its
   * tray tile. The line runs between the sockets (`leaderPath`); where it would cross a gauge
   * or a Gives/Needs card it is left out and the ring alone marks the gem.
   */
  updateTeachPointer(this: AltarScene): void {
    const L = this.view.layout;
    if (!L.phone) return;
    const teachUp = this.introLeft > 0 && this.mode === 'edit' && !this.tip.hidden;
    // teach-4: the goal, strikes and ring pages point at no gem.
    const page =
      teachUp && this.tip.dataset.source === 'intro'
        ? this.teachPages()[Math.min(this.introPageIdx, this.introPages() - 1)]
        : undefined;
    const row = page?.kind === 'gem' ? page : undefined;
    const trayGem = row && row.how !== 'fixed' ? row.gem : null;
    L.tray.forEach((t, i) => {
      this.slotEls[i]?.toggleAttribute('data-teach', t.gem === trayGem);
    });
    const svg = this.leader;
    if (!svg) return;
    const cells = row?.how === 'fixed' ? this.news.fixed.filter((f) => f.gem === row.gem) : [];
    if (cells.length === 0) {
      if (this.leaderKey) svg.replaceChildren();
      this.leaderKey = '';
      return;
    }
    // From the card's left edge, by the gem's name, in design px.
    const box = this.dom.getBoundingClientRect();
    const r = this.tip.getBoundingClientRect();
    if (box.width <= 0 || r.width <= 0) return;
    const k = 1920 / box.width;
    const from = {
      x: Math.round((r.left - box.left) * k),
      y: Math.round((r.top - box.top + Math.min(r.height / 2, 12)) * k),
    };
    const ring = L.pitch * 0.52;
    const key = `${from.x},${from.y},${ring.toFixed(1)}:${cells.map((f) => `${f.cell.x},${f.cell.y}`).join(';')}`;
    if (key === this.leaderKey) return;
    this.leaderKey = key;
    // What the line must not cross: every gauge and every Gives/Needs card.
    const keep: Box[] = [L.storm, ...L.machines].map((sp) => {
      const half = sp === L.storm ? sp.size * 0.26 : sp.size * 0.46;
      return { l: sp.x - half, r: sp.x + half, t: sp.y - half, b: sp.y + half };
    });
    for (const el of [this.stormLabel, ...this.needs]) {
      const q = el?.getBoundingClientRect();
      if (!q || q.width === 0) continue;
      keep.push({
        l: (q.left - box.left) * k,
        r: (q.right - box.left) * k,
        t: (q.top - box.top) * k,
        b: (q.bottom - box.top) * k,
      });
    }
    const w = Math.round(2 * (L.phone.cssPx || 1) * 10) / 10;
    const el = (tag: string, a: Record<string, string | number>) => {
      const e = document.createElementNS(SVG_NS, tag);
      for (const [n, v] of Object.entries(a)) e.setAttribute(n, String(v));
      return e;
    };
    const pt = { x: 0, y: 0 };
    svg.replaceChildren(
      ...cells.flatMap((f) => {
        cellCenter(L, f.cell, pt);
        const ringEl = el('circle', {
          cx: pt.x,
          cy: pt.y,
          r: ring,
          class: 'lr-leader-ring',
          'stroke-width': w,
        });
        const path = leaderPath(L, from, f.cell, ring);
        const clear = path.every(
          (p, i) => i === 0 || !keep.some((q) => segmentHits(path[i - 1]!, p, q, 2)),
        );
        if (!clear) return [ringEl];
        const points = path.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
        return [
          el('polyline', {
            points,
            class: 'lr-leader-shade',
            fill: 'none',
            'stroke-width': w * 2.2,
          }),
          el('polyline', { points, class: 'lr-leader-line', fill: 'none', 'stroke-width': w }),
          ringEl,
        ];
      }),
    );
  },

  /** Over its slot (or the tray's middle), never over FUSE (left) or the caption (right). */
  placeTip(this: AltarScene, L: AltarLayout): void {
    if (L.phone) {
      // In the column lane (CSS lays it out).
      this.tipRight = this.captionLeft(L);
      this.tip.style.left = '';
      this.tip.style.top = '';
      this.tip.style.maxWidth = '';
      return;
    }
    const right = this.captionLeft(L);
    this.tipRight = right;
    // Narrower than the gap if it must be (a phone's caption is wide); wraps to more lines.
    const room = right - FUSE_LANE.x;
    this.tip.style.maxWidth = '';
    if (this.tip.offsetWidth > room) this.tip.style.maxWidth = `${Math.max(320, room)}px`;
    const slotX = this.tipSlotX;
    const x = trayTipX(slotX ?? TRAY_CENTER_X, this.tip.offsetWidth, right);
    this.tip.style.left = `${x}px`;
    // The notch points at the slot; the card for a board gem or the arrival has none.
    if (slotX !== null) this.tip.style.setProperty('--lr-tip-dx', `${slotX - x}px`);
  },

  /**
   * A held Bend, Gate or Split shows it turns: a turn arrow by the gem, with the keys, until the
   * player has turned one here. Only where the altar teaches turning (its first tray Bend or
   * Gate); the preview swings with each turn (see `ghost`).
   */
  updateTurnBadge(this: AltarScene): void {
    const held = this.view.held;
    const show =
      this.mode === 'edit' &&
      !!this.hand &&
      !!held &&
      !this.turned &&
      // Over a fixed or placed gem R would not turn the hand, so the badge does not promise it.
      !this.refusedKey &&
      !this.overPlaced() &&
      this.turnTeach.has(this.hand.kind);
    if (this.turnBadge.hidden === show) this.turnBadge.hidden = !show;
    if (!show || !held) return;
    const r = this.view.layout.gemSize * 0.5;
    this.turnBadge.style.left = `${held.x + r}px`;
    this.turnBadge.style.top = `${held.y - r}px`;
    const keys = this.keyboard ? 'R / Q' : 'R / Scroll';
    if (this.turnBadge.dataset.keys !== keys) {
      this.turnBadge.dataset.keys = keys;
      this.turnBadge.replaceChildren(
        h('span', { class: 'lr-turn-arrow' }, '\u21bb'),
        h('span', { class: 'lr-turn-keys' }, keys),
      );
    }
  },

  /**
   * Phones, every frame: the Gives/Needs cards placed again when one changed size, the head
   * lined up with the tray, and the column's one rule (`arrangeColumn`).
   */
  updateCrowd(this: AltarScene): void {
    const band = this.view.layout.phone;
    if (!this.lane || !band) return;
    const els = [this.stormLabel, ...this.needs];
    const key = els.map((el) => (el ? `${el.offsetWidth}x${el.offsetHeight}` : '')).join();
    if (key !== this.labelKey) {
      this.labelKey = key;
      this.placePhoneLabels(band);
    }
    this.placeHead();
    this.arrangeColumn();
  },

  /**
   * Phones: one owner of the cards region at a time. A card (the verdict, a gem or teach card,
   * a live Capacitor read-out) and FUSE's line waits, frozen not lost; with no card up FUSE
   * speaks, and then the how-to line and the Capacitor plan step aside. The region caps the
   * cards' height (they scroll inside it), and Strike and FUSE stand in the foot row below it,
   * so nothing here measures room.
   */
  arrangeColumn(this: AltarScene): void {
    const lane = this.lane;
    if (!lane?.isConnected) return;
    const dom = this.dom;
    this.head?.toggleAttribute(
      'data-first',
      dom.hasAttribute('data-first') && !dom.hasAttribute('data-picked'),
    );
    lane.toggleAttribute('data-hand', dom.hasAttribute('data-hand'));
    const live = this.capEls.some((el) => !el.hasAttribute('data-plan') && el.offsetHeight > 0);
    const cardUp = !this.verdict.hidden || !this.tip.hidden || live;
    this.holdFuse(cardUp);
    // teach-5: a picture-first card that does not fit its lane (a short lane under a tall tray)
    // draws its picture smaller rather than scroll. Turning the page clears it (altar-info).
    const tip = this.tip;
    if (
      tip.hasAttribute('data-fig') &&
      !tip.hasAttribute('data-tight') &&
      tip.offsetHeight > 0 &&
      tip.scrollHeight > tip.clientHeight + 1
    )
      tip.toggleAttribute('data-tight', true);
    // A card taller than its region scrolls; until its end is in view it says there is more
    // (a fade and a ▾ over its foot) and takes touches, so the rest is a swipe away.
    for (const card of [this.tip, this.verdict, ...this.capEls]) {
      const more =
        card.offsetHeight > 0 && card.scrollHeight - card.scrollTop - card.clientHeight > 2;
      if (more !== card.hasAttribute('data-more')) card.toggleAttribute('data-more', more);
    }
    const cap = this.ctx.ui.caption;
    const talking = !cardUp && !cap.element.hidden && !!cap.currentText;
    lane.toggleAttribute('data-fuse', talking);
    if (talking) {
      // The tail points down at FUSE, who stands in the foot row under the line.
      const o = this.ctx.ui.root.getBoundingClientRect();
      const r = cap.element.getBoundingClientRect();
      const k = o.width / 1920;
      const tail = Math.round(
        Math.min(Math.max(o.left + this.view.fuse.x * k - r.left, 14), r.width - 14),
      );
      if (cap.element.style.getPropertyValue('--lr-cap-tail') !== `${tail}px`)
        cap.element.style.setProperty('--lr-cap-tail', `${tail}px`);
    }
  },

  /** Freeze FUSE's caption while a card owns the column; release it when none does. */
  holdFuse(this: AltarScene, on: boolean): void {
    if (on === this.fuseHeld) return;
    this.fuseHeld = on;
    const ui = this.ctx.ui;
    // A modal holds the caption on its own account: leave it held until the modal closes.
    if (!on && ui.stack.hasModal) return;
    ui.caption.suspend(on);
  },

  /**
   * Touch: the ↻ Turn button (docked right of the tray) turns the Bend, Gate or Split last
   * placed or selected (a long touch) on the board, else the one in hand; a ↻ mark on that gem
   * shows which. Tapping a gem still only picks it up; turning is always this button (D-029).
   * Hidden without touch (CSS `lr-touch-only`).
   */
  updateTurnButton(this: AltarScene): void {
    const L = this.view.layout;
    let target: Cell | 'hand' | null = null;
    const pt = { x: 0, y: 0 };
    const held = this.view.held;
    if (this.mode !== 'strike' && this.touch && !this.keyboard && !this.press) {
      const pl = this.lastPlaced ? this.board.at(this.lastPlaced) : undefined;
      if (this.lastPlaced && pl && isRotational(pl.gem)) {
        target = this.lastPlaced;
        cellCenter(L, target, pt);
      } else if (this.hand && !this.hand.from && held && isRotational(this.hand.kind)) {
        target = 'hand';
        pt.x = held.x;
        pt.y = held.y;
      }
    }
    this.turnTarget = target;
    const show = target !== null;
    const phone = !!L.phone;
    if (this.turnShown !== show) {
      this.turnShown = show;
      // Phones (mobile-5-board): one rotate control. Turn stays on the left rail, dim until a
      // Bend, Gate or Split is in hand or just placed, then lit; no ↻ chip on the gem.
      this.turnBtn.hidden = !show && !phone;
      this.turnBtn.disabled = phone && !show;
      this.turnBtn.toggleAttribute('data-active', show);
      this.turnMark.hidden = !show;
      if (phone) this.updateHint();
      this.avoidTray();
    }
    // altar-truth: the first time a turnable gem is in hand (or just placed), a line names Turn
    // and what it turns, until the player turns one here.
    const kind =
      target === 'hand' ? this.hand?.kind : target ? this.board.at(target)?.gem : undefined;
    // teach-4: on that altar, a gem that never turns says why Turn stays dim while it is held.
    const straight =
      this.straightTeach &&
      target === null &&
      this.mode !== 'strike' &&
      this.hand &&
      !this.hand.from
        ? straightLine(this.hand.kind)
        : null;
    if (phone)
      this.setHintLine(
        'holding',
        turnTeachLine(kind, target === 'hand' ? 'hand' : 'placed', this.turnTeach, this.turned) ??
          straight,
      );
    if (!show) return;
    const r = L.gemSize * 0.5;
    this.turnMark.style.left = `${Math.round(pt.x + r)}px`;
    this.turnMark.style.top = `${Math.round(pt.y - r)}px`;
  },

  turnTapped(this: AltarScene): void {
    const t = this.turnTarget;
    if (t === 'hand') this.turnAt(null, 1);
    else if (t) this.turnAt(t, 1);
  },
};
