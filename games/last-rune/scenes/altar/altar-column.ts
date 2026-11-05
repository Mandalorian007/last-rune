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
import { dpx } from '../../ui/frame-units';
import { GEM_NAME, SVG_NS } from './altar-defs';
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
 * sockets, never over one. The grid line nearer the card's anchor is tried first; when a leg of
 * that route would cross a box in `avoid` (glyph-truth-2: a fixed gem's lock pip, which sits on
 * the grid line below its socket, so a line through it read as a "no entry" sign), the other
 * grid line is used. `null` when neither route is clear.
 */
export function leaderPath(
  L: Pick<AltarLayout, 'left' | 'right' | 'top' | 'margin' | 'pitch' | 'rows'>,
  from: { x: number; y: number },
  cell: { x: number; y: number },
  ring: number,
  avoid: readonly Box[] = [],
): { x: number; y: number }[] | null {
  const x0 = L.left + L.margin;
  const y0 = L.top + L.margin;
  const cx = x0 + L.pitch * (cell.x + 0.5);
  const cy = y0 + L.pitch * (cell.y + 0.5);
  const above = y0 + L.pitch * cell.y;
  const below = above + L.pitch;
  const lines =
    Math.abs(from.y - above) <= Math.abs(from.y - below) ? [above, below] : [below, above];
  const rim = L.right - L.margin / 2;
  for (const gy of lines) {
    const end = { x: cx, y: gy < cy ? cy - ring : cy + ring };
    const path = [from, { x: rim, y: from.y }, { x: rim, y: gy }, { x: cx, y: gy }, end];
    const clear = path.every(
      (pt, i) => i === 0 || !avoid.some((q) => segmentHits(path[i - 1]!, pt, q, 2)),
    );
    if (clear) return path;
  }
  return null;
}

/**
 * The lock pip a fixed gem's collar wears (stone-wgsl state 6: centred one socket radius right
 * and down of the socket's centre, 0.42 radii across), as a box in design px.
 */
export function lockPipBox(
  L: Pick<AltarLayout, 'left' | 'top' | 'margin' | 'pitch'>,
  cell: { x: number; y: number },
): Box {
  const sr = Math.round(L.pitch * 0.36);
  const x = L.left + L.margin + L.pitch * (cell.x + 0.5) + sr;
  const y = L.top + L.margin + L.pitch * (cell.y + 0.5) + sr;
  const h = sr * 0.45;
  return { l: x - h, r: x + h, t: y - h, b: y + h };
}

export const columnMethods = {
  /** Phones: FUSE's line back to its own corner style on exit (its tail is set per frame). */
  phoneCaption(this: AltarScene, on: boolean): void {
    if (!on) this.ctx.ui.caption.element.style.removeProperty('--lr-cap-tail');
  },

  /**
   * Phones: the head's slots and counts over the gems the canvas draws at `L.tray`. The gems
   * are lit, lifted and animated on the canvas, so they stay there; the head converts the same
   * design-px spots to its own CSS px through the frame's box (the HUD layer), whenever either
   * moves.
   */
  placeHead(this: AltarScene): void {
    const head = this.head;
    if (!head?.isConnected) return;
    const L = this.view.layout;
    const o = this.ctx.ui.layers.hud.getBoundingClientRect();
    const hr = head.getBoundingClientRect();
    if (o.width <= 0 || hr.width <= 0) return;
    const k = o.width / 1920;
    const key = [o.left, o.top, k, hr.left, hr.top].map((n) => n.toFixed(2)).join();
    if (key === this.headKey) return;
    this.headKey = key;
    const x = (dx: number) => `${(o.left + dx * k - hr.left).toFixed(1)}px`;
    const y = (dy: number) => `${(o.top + dy * k - hr.top).toFixed(1)}px`;
    // glyph-truth-3: the held slot's gold ring grows past the gem only as far as it stays clear
    // of every other slot's count badge (it used to cut across the "×4" above it).
    const countHalfW = (j: number) => Math.max(10, (this.counts[j]?.offsetWidth ?? 24) / 2);
    L.tray.forEach((t, i) => {
      const s = this.slotEls[i]?.style;
      if (s) {
        s.left = x(t.x);
        s.top = y(t.y);
        let r = t.size * k * 0.61;
        L.tray.forEach((u, j) => {
          if (j === i) return;
          // The badge's box, CSS px, relative to this slot's centre.
          const cx = (u.x - t.x) * k;
          const top = (u.y + u.size * TRAY_COUNT_DROP - t.y) * k;
          const dx = Math.max(0, Math.abs(cx) - countHalfW(j));
          const dy = top > 0 ? top : Math.max(0, -(top + 13));
          // Ring outline (2.5 px gold + 1.5 px dark) plus a 2 px gap.
          r = Math.min(r, Math.hypot(dx, dy) - 6);
        });
        s.width = s.height = `${(t.size * k).toFixed(1)}px`;
        s.setProperty('--lr-held-d', `${Math.max(t.size * k * 0.5, r * 2).toFixed(1)}px`);
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
   * from the card to that gem on the board (which also pulses). A tray gem's page marks nothing
   * in the tray (polish-11, D-040 add. 12: its gold ring read as the gem already picked up, so
   * Control Booth's decoy Capacitor looked recommended); the card's picture and name say which
   * gem, and nothing is held until the player taps. The line runs between the sockets (`leaderPath`); where it would cross a gauge
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
    const svg = this.leader;
    if (!svg) return;
    const at = row?.how === 'fixed' ? this.teachCellOf(row.gem) : undefined;
    const cells = at ? [{ cell: at }] : [];
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
    // What the line must not cross: every gauge and every Gives/Needs card...
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
    // ...nor any fixed gem's lock pip (glyph-truth-2: a line through it read as ⊘).
    const pips = [...this.puzzle.fixed, ...this.board.lockedPlacements].map((f) =>
      lockPipBox(L, f.cell),
    );
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
        // The ring stops short of the lock pip on the lower-right (glyph-truth-2: a ring drawn
        // through the padlock read as ⊘), so it is an arc the long way round from 70° to 20°.
        const a0 = (70 * Math.PI) / 180;
        const a1 = (20 * Math.PI) / 180;
        const ringEl = el('path', {
          d: `M ${(pt.x + ring * Math.cos(a0)).toFixed(1)} ${(pt.y + ring * Math.sin(a0)).toFixed(1)} A ${ring.toFixed(1)} ${ring.toFixed(1)} 0 1 1 ${(pt.x + ring * Math.cos(a1)).toFixed(1)} ${(pt.y + ring * Math.sin(a1)).toFixed(1)}`,
          class: 'lr-leader-ring',
          'stroke-width': w,
          'stroke-linecap': 'round',
        });
        const path = leaderPath(L, from, f.cell, ring, [...keep, ...pips]);
        if (!path) return [ringEl];
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
    const k = this.ctx.ui.scale;
    this.tip.style.maxWidth = '';
    if (this.tip.offsetWidth / k > room) this.tip.style.maxWidth = dpx(Math.max(320, room));
    const slotX = this.tipSlotX;
    const x = trayTipX(slotX ?? TRAY_CENTER_X, this.tip.offsetWidth / k, right);
    this.tip.style.left = dpx(x);
    // The notch points at the slot; the card for a board gem or the arrival has none.
    if (slotX !== null) this.tip.style.setProperty('--lr-tip-dx', dpx(slotX - x));
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
    this.turnBadge.style.left = dpx(held.x + r);
    this.turnBadge.style.top = dpx(held.y - r);
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
    const legend = this.hint.hasAttribute('data-legend');
    // teach-6: the dot's legend outranks a gem's chip (a gem is in hand nearly all the time, so
    // it never came up: blind review 8). The chip steps aside (CSS) until the legend retires.
    const chip =
      !this.tip.hidden &&
      this.tip.dataset.source !== 'intro' &&
      !this.tip.hasAttribute('data-full');
    const yieldTip = legend && chip;
    if (yieldTip !== this.tip.hasAttribute('data-yield'))
      this.tip.toggleAttribute('data-yield', yieldTip);
    const other = !this.verdict.hidden || (!this.tip.hidden && !yieldTip) || live;
    // card-fit: the dot's legend (four lines) gets the lane to itself. It waits while a teach
    // card, a pinned card, the verdict or a live read-out is up (stacked under one, an SE's lane
    // cut both short), and the Capacitor plan steps aside for it (CSS) until it retires.
    const wait = other && legend;
    // teach-6: while it shows it is the column's card, so FUSE waits too (his line cut it).
    // dense-board-4: on a slim column the Rule tab (a gem in hand) owns the lane too; a short
    // lane under a tall tray holds no tab and FUSE's line both, so FUSE waits.
    const tab = this.updateRuleTab(legend);
    const cardUp = other || legend || tab;
    this.holdFuse(cardUp);
    if (wait !== this.hint.hasAttribute('data-wait')) this.hint.toggleAttribute('data-wait', wait);
    // teach-5: a picture-first card that does not fit its lane (a short lane under a tall tray)
    // draws its picture smaller rather than scroll. card-fit: so does one whose head row is too
    // narrow for "New here" beside the picture and the button (an iPhone's 172 px column ran
    // "New" under "Got it"). Turning the page clears it (altar-info).
    // polish-11: a reminder whose head row is still too narrow for its name puts the name back in
    // its words; one still too tall (Press Unit 4's Amplify on an SE) draws its picture the
    // button's height, without the number chips that size can't carry.
    const tip = this.tip;
    const page = tip.querySelector<HTMLElement>('.lr-info-foot .lr-info-page');
    const tall = tip.offsetHeight > 0 && tip.scrollHeight > tip.clientHeight + 1;
    const wide = tip.offsetHeight > 0 && !!page && page.scrollWidth > page.clientWidth + 1;
    if (tip.hasAttribute('data-fig') && (tall || wide)) {
      if (!tip.hasAttribute('data-tight')) tip.toggleAttribute('data-tight', true);
      else if (wide && tip.hasAttribute('data-named')) tip.removeAttribute('data-named');
      else if (tall && !tip.hasAttribute('data-tighter')) tip.toggleAttribute('data-tighter', true);
    }
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
      const o = this.ctx.ui.layers.hud.getBoundingClientRect();
      const r = cap.element.getBoundingClientRect();
      const k = o.width / 1920;
      const tail = Math.round(
        Math.min(Math.max(o.left + this.view.fuse.x * k - r.left, 14), r.width - 14),
      );
      if (cap.element.style.getPropertyValue('--lr-cap-tail') !== `${tail}px`)
        cap.element.style.setProperty('--lr-cap-tail', `${tail}px`);
    }
  },

  /**
   * dense-board-4: the slim column's Rule tab stands while a gem is in hand and no teach card,
   * verdict or legend owns the lane (first-sight teaching wins); open, the gem's card is pinned.
   */
  updateRuleTab(this: AltarScene, legend: boolean): boolean {
    const tab = this.ruleTab;
    if (!tab) return false;
    const open = !!this.infoPin && !!this.hand && this.infoPin.gem === this.hand.kind;
    const teach = !this.tip.hidden && this.tip.dataset.source === 'intro';
    // Open, the card has the lane and the next tap anywhere closes it, so the tab steps aside.
    const show =
      !!this.hand && !open && this.mode !== 'strike' && this.verdict.hidden && !legend && !teach;
    if (tab.hidden === show) tab.hidden = !show;
    if (open !== tab.hasAttribute('data-open')) {
      tab.toggleAttribute('data-open', open);
      tab.setAttribute('aria-expanded', String(open));
    }
    return show;
  },

  /** dense-board-4: the Rule tab opens the held gem's card, or closes it. */
  ruleTapped(this: AltarScene): void {
    const hand = this.hand;
    if (this.infoPin || !hand) this.infoPin = null;
    else {
      this.infoPin = { gem: hand.kind, how: this.turnTeach.has(hand.kind) ? 'turnsTray' : 'tray' };
      this.ruleOpen = true;
    }
    this.updateInfo();
    this.arrangeColumn();
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
    // glyph-truth-3: on a phone the gem in hand rests in its tray slot, its gold ring, the
    // Holding pill and Turn's own label already name it, so it wears no ↻ chip (one sat on the
    // ring's corner like a stray mark). A gem on the board keeps its chip: Turn turns that one.
    const mark = show && !(phone && target === 'hand');
    if (this.turnMark.hidden === mark) this.turnMark.hidden = !mark;
    if (this.turnShown !== show) {
      this.turnShown = show;
      // Phones (mobile-5-board): one rotate control. Turn stays on the left rail, dim until a
      // Bend, Gate or Split is in hand or just placed, then lit; no ↻ chip on the gem.
      this.turnBtn.hidden = !show && !phone;
      this.turnBtn.disabled = phone && !show;
      this.turnBtn.toggleAttribute('data-active', show);
      if (phone) this.updateHint();
      this.avoidTray();
    }
    // altar-truth: the first time a turnable gem is in hand (or just placed), a line names Turn
    // and what it turns, until the player turns one here.
    const kind =
      target === 'hand' ? this.hand?.kind : target ? this.board.at(target)?.gem : undefined;
    // glyph-truth-2: Turn names its gem under the word, so it is plain what a tap turns.
    const what = this.turnBtn.querySelector<HTMLElement>('.lr-turn-what');
    const name = kind ? GEM_NAME[kind] : '';
    if (what && what.textContent !== name) {
      what.textContent = name;
      this.turnBtn.setAttribute('aria-label', name ? `Turn the ${name} (R)` : 'Turn the gem (R)');
    }
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
    this.turnMark.style.left = dpx(Math.round(pt.x + r));
    this.turnMark.style.top = dpx(Math.round(pt.y - r));
  },

  turnTapped(this: AltarScene): void {
    const t = this.turnTarget;
    if (t === 'hand') this.turnAt(null, 1);
    else if (t) this.turnAt(t, 1);
  },
};
