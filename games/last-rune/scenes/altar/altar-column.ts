/**
 * Phones: the column beside the board (tray, cards, Turn) and FUSE's place in it.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
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
  type PhoneBand,
  TRAY_CENTER_X,
  trayTipX,
} from './layout';
import { arbitrate, type Grant, type VoiceAsk } from './moments';

export const columnMethods = {
  /**
   * Phones: FUSE's caption is a bubble beside him in the bottom band, left of the tray (CSS
   * reads these variables off the overlay root; ui/phone-styles.ts). Off phones, nothing.
   */
  phoneCaption(this: AltarScene, on: boolean): void {
    const st = this.ctx.ui.root.style;
    const band = this.view.layout.phone;
    if (on && band) {
      st.setProperty('--lr-cap-l', `${band.bubbleL}px`);
      // From the column's left edge on into the right bar (CSS adds the bar).
      st.setProperty('--lr-cap-w', `${1920 - band.bubbleL}px`);
      // Over FUSE's head, its tail pointing down at him (mobile-5-moments).
      const f = this.view.fuse;
      const head = 1080 - f.y + 2.3 * f.scale + 6 * band.cssPx;
      st.setProperty('--lr-cap-b', `${Math.round(Math.max(1080 - band.bubbleB, head))}px`);
      st.setProperty('--lr-cap-tail', `${Math.round(f.x - band.bubbleL)}px`);
    } else {
      st.removeProperty('--lr-cap-l');
      st.removeProperty('--lr-cap-w');
      st.removeProperty('--lr-cap-b');
      st.removeProperty('--lr-cap-tail');
    }
  },

  /**
   * Phones: the arrival card points at what it teaches. A fixed gem's page draws a gold line
   * from the card to that gem on the board (which also pulses); a tray gem's page rings its
   * tray tile. Nothing while the card is down.
   */
  updateTeachPointer(this: AltarScene): void {
    const L = this.view.layout;
    if (!L.phone) return;
    const teachUp = this.introLeft > 0 && this.mode === 'edit' && !this.tip.hidden;
    const row =
      teachUp && this.tip.dataset.source === 'intro'
        ? this.introRows()[Math.min(this.introPageIdx, this.introPages() - 1)]
        : undefined;
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
    // From the card's left edge, a third of the way down (by the gem's name), in design px.
    const box = this.dom.getBoundingClientRect();
    const r = this.tip.getBoundingClientRect();
    if (box.width <= 0 || r.width <= 0) return;
    const k = 1920 / box.width;
    const x0 = Math.round((r.left - box.left) * k);
    const y0 = Math.round((r.top - box.top + Math.min(r.height / 3, 24 / k)) * k);
    const ends = cells.map((f) => {
      const cx = L.left + L.margin + L.pitch * (f.cell.x + 0.5);
      const cy = L.top + L.margin + L.pitch * (f.cell.y + 0.5);
      return { cx, cy };
    });
    const ring = L.pitch * 0.52;
    const key = `${x0},${y0},${ring.toFixed(1)}:${ends.map((e) => `${e.cx},${e.cy}`).join(';')}`;
    if (key === this.leaderKey) return;
    this.leaderKey = key;
    const w = Math.round(2 * (L.phone.cssPx || 1) * 10) / 10;
    const el = (tag: string, a: Record<string, string | number>) => {
      const e = document.createElementNS(SVG_NS, tag);
      for (const [n, v] of Object.entries(a)) e.setAttribute(n, String(v));
      return e;
    };
    svg.replaceChildren(
      ...ends.flatMap(({ cx, cy }) => {
        // Stop at the gem's ring, so the line never covers the gem itself.
        const dx = x0 - cx;
        const dy = y0 - cy;
        const d = Math.hypot(dx, dy) || 1;
        const x1 = cx + (dx / d) * ring;
        const y1 = cy + (dy / d) * ring;
        return [
          el('line', {
            x1: x0,
            y1: y0,
            x2: x1,
            y2: y1,
            class: 'lr-leader-shade',
            'stroke-width': w * 2.2,
          }),
          el('line', {
            x1: x0,
            y1: y0,
            x2: x1,
            y2: y1,
            class: 'lr-leader-line',
            'stroke-width': w,
          }),
          el('circle', { cx, cy, r: ring, class: 'lr-leader-ring', 'stroke-width': w }),
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
   * Phones: FUSE's bubble grows up from above Strike and the lane grows down from the tray;
   * when the two would meet, the lane (the player's own chip, verdict or read-out) wins and
   * the bubble steps out until there is room again.
   */
  updateCrowd(this: AltarScene): void {
    if (!this.lane) return;
    // A Gives/Needs card grew or shrank (a reading came in, the text size changed): place the
    // cards again so none runs into another or a gauge.
    const band = this.view.layout.phone;
    if (band) {
      const els = [this.stormLabel, ...this.needs];
      const key = els.map((el) => (el ? `${el.offsetWidth}x${el.offsetHeight}` : '')).join();
      if (key !== this.labelKey) {
        this.labelKey = key;
        this.placePhoneLabels(band);
      }
    }
    if (band) this.arrangeColumn(band);
  },

  /**
   * Phones: one owner of the right column at a time (mobile-6-moments, moments.ts `arbitrate`).
   * The lane grows down from under the tray; FUSE's bubble sits over his head, 10 px clear of
   * Strike. Between them the verdict, the teach card, a gem's tip, the how-to line and FUSE's
   * bubble get room in that order: a tip that does not fit shrinks to its name line, anything
   * else waits (FUSE's line is frozen, not lost). The lane also steps right of any Gives/Needs
   * card that reaches into the column, so no card ever touches a board label.
   */
  arrangeColumn(this: AltarScene, band: PhoneBand): void {
    const lane = this.lane;
    if (!lane || !this.dom.isConnected) return;
    const ui = this.ctx.ui;
    const css = band.cssPx; // design px per CSS px
    const gap = 4;
    // 1. Clear of board labels: the lane starts 8 px right of any card that reaches it.
    const lr = lane.getBoundingClientRect();
    const baseL = lr.left - this.laneShift / css;
    const floorY = this.strikeBtn.getBoundingClientRect().top;
    let left = baseL;
    for (const el of [this.stormLabel, ...this.needs]) {
      if (!el || el.hidden) continue;
      const q = el.getBoundingClientRect();
      if (q.width === 0 || q.bottom < lr.top - gap || q.top > floorY) continue;
      // Its words, which may run past the card's own box ("in one strike").
      let right = q.right;
      for (const c of el.querySelectorAll('*'))
        right = Math.max(right, c.getBoundingClientRect().right);
      if (right + 8 > left && q.left < baseL + 40) left = right + 8;
    }
    const shift = Math.max(0, Math.round((left - baseL) * css));
    if (shift !== this.laneShift) {
      this.laneShift = shift;
      lane.style.setProperty('--lr-lane-l', `${band.colL + shift}px`);
      lane.style.setProperty('--lr-lane-w', `${Math.round(band.colR - band.colL - shift)}px`);
    }
    // 2. FUSE's bubble: over his head, its bottom at least 10 px above Strike, and never left
    // of the lane (so it clears the labels too).
    const f = this.view.fuse;
    const strikeTop = (this.strikeBtn.getBoundingClientRect().top - this.overlayTop()) * css;
    const bubB = Math.min(f.y - 2.3 * f.scale - 6 * css, band.bubbleB, strikeTop - 10 * css);
    const capL = Math.max(band.bubbleL, band.colL + shift);
    const capKey = `${Math.round(bubB)},${capL}`;
    if (capKey !== this.capKey2) {
      this.capKey2 = capKey;
      const st = ui.root.style;
      st.setProperty('--lr-cap-b', `${Math.round(1080 - bubB)}px`);
      st.setProperty('--lr-cap-l', `${capL}px`);
      st.setProperty('--lr-cap-w', `${1920 - capL}px`);
      st.setProperty('--lr-cap-tail', `${Math.round(Math.max(22 * css, f.x - capL))}px`);
    }
    // 3. Who gets the room between the lane's top and the bubble's bottom.
    const room = this.overlayTop() + bubB / css - lr.top;
    const asks: VoiceAsk[] = [];
    const els = new Map<string, HTMLElement>();
    const ask = (id: string, el: HTMLElement, voice: VoiceAsk['voice'], shrinks: boolean) => {
      if (el.hidden || getComputedStyle(el).display === 'none') return;
      els.set(id, el);
      // Measured whole, even while it waits or is shrunk (briefly laid out whole to measure).
      const was = el.dataset.arb;
      if (was) el.removeAttribute('data-arb');
      const full = el.getBoundingClientRect().height;
      const cs = getComputedStyle(el);
      const first = el.firstElementChild ? getComputedStyle(el.firstElementChild) : cs;
      const lh = Number.parseFloat(first.lineHeight) || Number.parseFloat(first.fontSize) * 1.3;
      const edge = (k: 'Top' | 'Bottom') =>
        Number.parseFloat(cs[`padding${k}`]) + Number.parseFloat(cs[`border${k}Width`]);
      const line = lh + edge('Top') + edge('Bottom');
      if (was) el.dataset.arb = was;
      asks.push(shrinks && line < full ? { id, voice, full, line } : { id, voice, full });
    };
    const verdictUp = !this.verdict.hidden;
    if (verdictUp) ask('verdict', this.verdict, 'verdict', false);
    // mobile-7-strike: under a verdict the Capacitor read-out waits for room (the verdict's
    // strike line already gives each strike's reading).
    this.capEls.forEach((el, i) => {
      if (el.parentElement === lane) ask(`cap${i}`, el, verdictUp ? 'hint' : 'verdict', false);
    });
    const teach = this.tip.dataset.source === 'intro';
    if (teach && !this.tip.hidden) {
      // The teach card's button sits under the rule when there is room; where there is not (an
      // iPhone SE under a two-row tray) it stands top-right and the rule wraps round it.
      this.tip.removeAttribute('data-compact');
      const below = this.verdict.hidden ? 0 : this.verdict.getBoundingClientRect().height + gap;
      if (this.tip.getBoundingClientRect().height + below > room)
        this.tip.setAttribute('data-compact', '');
    }
    if (!this.tip.hidden) ask('tip', this.tip, teach ? 'teach' : 'tip', !teach);
    ask('hint', this.hint, 'hint', false);
    const cap = ui.root.querySelector<HTMLElement>('.tc-caption');
    const talking = !!cap && !cap.hidden && cap.textContent !== '';
    if (talking && cap) {
      const h0 = cap.getBoundingClientRect().height;
      if (h0 > 0) this.fuseH = h0;
      // The bubble keeps its own 8 px from the lane (the gap adds 4).
      asks.push({ id: 'fuse', voice: 'fuse', full: this.fuseH + gap });
    }
    const grants = arbitrate(asks, room, gap);
    for (const [id, el] of els) {
      const g: Grant = grants.get(id) ?? 'full';
      if (g === 'full') el.removeAttribute('data-arb');
      else if (el.dataset.arb !== g) el.dataset.arb = g;
    }
    this.holdFuse(talking && grants.get('fuse') === 'wait');
    // mobile-7-strike: a verdict too tall for the column (an SE after a two-strike fail) owns
    // the corner; Strike steps out until the verdict clears (any tap), never under it.
    let yieldStrike = false;
    if (verdictUp) {
      const v = this.verdict.getBoundingClientRect();
      const b = this.strikeBtn.getBoundingClientRect();
      yieldStrike = v.bottom > b.top && v.right > b.left && v.left < b.right && v.height > 0;
    }
    this.strikeBtn.toggleAttribute('data-yield', yieldStrike);
  },

  /** The overlay's top edge in CSS px (design y 0). */
  overlayTop(this: AltarScene): number {
    return this.ctx.ui.root.getBoundingClientRect().top;
  },

  /** Freeze FUSE's caption while the column has no room for it; release it when it does. */
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
      this.turnMark.hidden = !show || phone;
      if (phone) this.updateHint();
      this.avoidTray();
    }
    if (!show || phone) return;
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
