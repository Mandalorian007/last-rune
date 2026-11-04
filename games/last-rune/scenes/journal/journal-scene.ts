/**
 * The journal desk (pitch screen 6): a wooden desk under one candle. Found
 * pages stack at the left in page order, unfound ones as blank slots that only
 * hint at their tier. The selected page lies open at the right in the
 * Builder's ink; FUSE's rebuttal sits on a brass-tacked dark plate below.
 * Inkwell, quill, wood grain. The warmest screen in the game.
 *
 * GPU draws every surface (desk, paper, leather, plate, props, candle); the
 * DOM overlay carries all text, in design px over the same coordinates.
 *
 * Input: ←/→ (or the ink arrows) turn pages, click a slip to open it,
 * Esc / J / "Back to the hall" (or "Back to the altar", over an altar) closes. Pages are
 * marked read as they open; the "new" seals stay up until the desk is closed.
 */
import type { Frame } from '@thunderclap/engine/render';
import { h } from '@thunderclap/engine/ui';
import { POST_PRESETS } from '../../art/materials/post-presets';
import type { GameCtx, GameScene } from '../../game/ctx';
import { placeWidgets } from '../../ui/chrome';
import { DeskArt } from './desk-art';
import { PAPER, PROP, RULE_PITCH, RULE_TOP } from './desk-wgsl';
import {
  initialPage,
  type JournalModel,
  type JournalSlot,
  journalModel,
  stepPage,
  tierNumeral,
} from './journal-model';
import { journalSketch, trailingSignature } from './journal-sketch';
import { ensureJournalStyles } from './journal-styles';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Layout (design px). */
export const DESK_LAYOUT = {
  stack: { x: 76, y: 148, w: 388, h: 44, pitch: 47, tierGap: 22 },
  cover: { x: 1252, y: 430, w: 1236, h: 748 },
  leafL: { x: 958, y: 430, w: 578, h: 700 },
  leafR: { x: 1546, y: 430, w: 578, h: 700 },
  plate: { x: 1252, y: 926, w: 1080, h: 150 },
  inkwell: { x: 566, y: 918, w: 128, h: 128 },
  quill: { x: 0, y: 0, w: 112, h: 400, rot: -0.2 },
  candle: { x: 566, y: 520, height: 176 },
} as const;

/** The quill on phones: upright enough to keep clear of the page list (design px x ≤ 498). */
const PHONE_QUILL = { ...DESK_LAYOUT.quill, h: 330, rot: -0.08 } as const;

/** The quill standing in the inkwell: its size and rotation, and its centre (design px). */
function quillPose(phone: boolean) {
  const q = phone ? PHONE_QUILL : DESK_LAYOUT.quill;
  const nibX = DESK_LAYOUT.inkwell.x + 4;
  const nibY = DESK_LAYOUT.inkwell.y - 26;
  return { q, qx: nibX + (q.h / 2) * Math.sin(q.rot), qy: nibY - (q.h / 2) * Math.cos(q.rot) };
}

/**
 * The quill's drawn box, axis-aligned (design px), for the e2e layout checks: the feather as
 * desk-wgsl draws it (its vane reaches 0.26 of the sprite's width left of the shaft and curls
 * out to the sprite's right edge; the rest of the sprite is empty), rotated.
 */
export function quillBox(phone: boolean): { l: number; t: number; r: number; b: number } {
  const { q, qx, qy } = quillPose(phone);
  const up = { x: Math.sin(q.rot), y: -Math.cos(q.rot) };
  const right = { x: Math.cos(q.rot), y: Math.sin(q.rot) };
  const xs: number[] = [];
  const ys: number[] = [];
  for (const u of [-q.w * 0.26, q.w * 0.5]) {
    for (const v of [-q.h / 2, q.h / 2]) {
      xs.push(qx + u * right.x + v * up.x);
      ys.push(qy + u * right.y + v * up.y);
    }
  }
  return { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
}

const LONG_TEXT = 170;

/**
 * Page 16's signature box (design px): the scribble's width, then the sign-off on the
 * baseline. Fixed size (it is a drawing, labelled for screen readers), not text-scaled.
 */
const SIGNATURE = { w: 500, h: 80, scribble: 210, baseline: 56, fontSize: 44 } as const;

interface SlipView {
  readonly slot: JournalSlot;
  readonly el: HTMLButtonElement;
  readonly y: number;
  readonly rot: number;
  readonly seed: number;
  /** Animated pull-out offset (px). */
  pull: number;
}

export class JournalScene implements GameScene {
  readonly name = 'journal';
  private ctx!: GameCtx;
  /** The quill's drawn box as this device draws it (design px): e2e layout checks. */
  quillBox(): { l: number; t: number; r: number; b: number } {
    return quillBox(!!this.ctx.viewContext.phone?.());
  }
  private art!: DeskArt;
  private model!: JournalModel;
  private current: number | null = null;
  private slips: SlipView[] = [];
  private root: HTMLElement | null = null;
  /** Phones: the ✕ at the top of the right rail, like the ☰ (ui/chrome.ts). */
  private unplace: () => void = () => {};
  private spread!: HTMLElement;
  private date!: HTMLElement;
  private body!: HTMLElement;
  private folio!: HTMLElement;
  private sketch!: SVGSVGElement;
  private sign!: SVGSVGElement;
  private signOff!: SVGTextElement;
  private plate!: HTMLElement;
  private empty!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private time = 0;
  private frames = 0;
  private turnTimer = 0;
  private pendingPage: number | null = null;
  /** Fades the "new" glow in on enter. */
  private glowIn = 0;

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    const doc = ctx.surface.root.ownerDocument;
    ensureJournalStyles(doc);
    const j = ctx.save.get().journal;
    this.model = journalModel(j.found, j.read);
    this.art = new DeskArt(ctx.renderer);
    this.art.placeCandle(DESK_LAYOUT.candle.x, DESK_LAYOUT.candle.y, DESK_LAYOUT.candle.height);
    this.art.reducedMotion = ctx.settings.reducedMotion || ctx.settings.reduceFlashes;
    this.buildDom(doc);
    ctx.post.set(POST_PRESETS.journal);
    ctx.setMood('journal');
    ctx.sound.sfx.play('codexOpen');
    ctx.hud.plate(null);
    this.show(initialPage(this.model), false);
  }

  exit(): void {
    this.unplace();
    this.unplace = () => {};
    this.root?.remove();
    this.root = null;
    this.art.destroy();
    this.ctx.sound.sfx.play('codexClose');
    this.ctx.post.set(POST_PRESETS.hall);
  }

  /** Read-only snapshot for tests/diagnostics. */
  get state(): { current: number | null; model: JournalModel } {
    return { current: this.current, model: this.model };
  }

  update(dt: number): void {
    this.time += dt;
    this.frames++;
    this.glowIn = Math.min(1, this.glowIn + dt * 1.5);
    const input = this.ctx.input;
    // On the first tick the J that opened the desk is still "pressed", so ignore J then; Esc
    // counts from the first tick so a quick Esc is never dropped.
    if (!this.ctx.ui.stack.hasModal) {
      if (input.pressed('cancel') || (this.frames > 1 && input.pressed('journal'))) {
        this.close();
        return;
      }
      if (input.pressed('next')) this.turn(1);
      else if (input.pressed('prev')) this.turn(-1);
    }
    if (this.turnTimer > 0) {
      this.turnTimer -= dt;
      if (this.turnTimer <= 0 && this.pendingPage !== null) {
        this.fill(this.pendingPage);
        this.pendingPage = null;
        this.spread.removeAttribute('data-turning');
      }
    }
    const reduced = this.ctx.settings.reducedMotion;
    for (const s of this.slips) {
      const target = s.slot.page === this.current ? 30 : 0;
      const before = s.pull;
      s.pull = reduced ? target : s.pull + (target - s.pull) * Math.min(1, dt * 12);
      if (Math.abs(s.pull - target) < 0.05) s.pull = target;
      if (s.pull !== before)
        s.el.style.transform = `translateX(${s.pull.toFixed(1)}px) rotate(${s.rot}rad)`;
    }
  }

  render(frame: Frame): void {
    const art = this.art;
    const L = DESK_LAYOUT;
    art.beginLights(this.time);
    art.desk(frame);
    art.candleBody(frame);

    // Journal: shadow, leather cover, two leaves, gutter.
    const c = L.cover;
    art.shadow(frame, c.x + 14, c.y + 22, c.w, c.h, 26, 0.7);
    art.prop(frame, PROP.cover, c.x, c.y, c.w, c.h, 0, 2.3);
    const showing = this.current !== null;
    art.paper(frame, L.leafL.x, L.leafL.y, L.leafL.w, L.leafL.h, 0, 11, PAPER.leftLeaf, 0, showing);
    art.paper(
      frame,
      L.leafR.x,
      L.leafR.y,
      L.leafR.w,
      L.leafR.h,
      0,
      17,
      PAPER.rightLeaf,
      0,
      showing,
    );
    art.shadow(frame, c.x, c.y, 18, L.leafL.h - 8, 14, 0.35);

    // The stack of slips (found pages are paper; blank slots barely there). Phones list the
    // found pages as paper rows in the DOM instead (mobile-3-chrome), so none are drawn here.
    const st = L.stack;
    const phone = !!this.ctx.viewContext.phone?.();
    const slips = phone ? [] : this.slips;
    for (const s of slips) {
      const x = st.x + st.w / 2 + s.pull;
      const y = s.y + st.h / 2;
      if (s.slot.found) {
        art.shadow(frame, x + 4, y + 6, st.w, st.h, 8, 0.55, s.rot);
        const glow = s.slot.fresh ? this.glowIn * (0.75 + 0.25 * Math.sin(this.time * 2.2)) : 0;
        if (s.slot.fresh) {
          art.glow(
            frame,
            x,
            y,
            st.w + 90,
            st.h + 60,
            0.35 * glow,
            0.2 * glow,
            0.05 * glow,
            0.25,
            true,
          );
        }
        art.paper(frame, x, y, st.w, st.h, s.rot, s.seed, PAPER.slip, glow, false);
      } else {
        art.paper(frame, x, y, st.w, st.h, s.rot, s.seed, PAPER.slip, 0, false, 0.1);
      }
    }

    // FUSE's plate.
    const p = L.plate;
    art.shadow(frame, p.x + 6, p.y + 10, p.w, p.h, 12, 0.7);
    art.prop(frame, PROP.plate, p.x, p.y, p.w, p.h, 0, 4.1);

    // Inkwell and quill (the quill stands in the well, leaning left).
    const iw = L.inkwell;
    art.shadow(frame, iw.x + 10, iw.y + 50, iw.w * 0.9, 30, 14, 0.75);
    // Phones (chrome-polish-3): the quill stands straighter and shorter, clear of the page
    // list beside it.
    const { q, qx, qy } = quillPose(phone);
    art.prop(frame, PROP.inkwell, iw.x, iw.y, iw.w, iw.h, 0, 1);
    art.prop(frame, PROP.quill, qx, qy, q.w, q.h, q.rot, 5);
    // The candle flame draws last so it sits above everything.
    art.candleFlame(frame);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private close(): void {
    this.ctx.sfx('ui.click');
    this.ctx.flow.closeJournal();
  }

  private turn(dir: 1 | -1): void {
    const next = stepPage(this.model, this.current, dir);
    if (next === null || next === this.current) return;
    this.show(next, true);
  }

  private show(page: number | null, animate: boolean): void {
    if (page === this.current && page !== null) return;
    this.current = page;
    for (const s of this.slips) {
      if (s.slot.page === page) s.el.setAttribute('aria-current', 'page');
      else s.el.removeAttribute('aria-current');
    }
    if (page !== null) this.ctx.flow.markPagesRead([page]);
    if (animate && !this.ctx.settings.reducedMotion) {
      this.ctx.sfx('ui.page');
      this.spread.setAttribute('data-turning', '');
      this.pendingPage = page;
      this.turnTimer = 0.18;
    } else {
      if (animate) this.ctx.sfx('ui.page');
      this.fill(page);
    }
  }

  private fill(page: number | null): void {
    const slot = page === null ? null : this.model.slots.find((s) => s.page === page);
    const entry = slot?.entry ?? null;
    const multi = this.model.readable.length > 1;
    this.prevBtn.hidden = !multi;
    this.nextBtn.hidden = !multi;
    this.empty.hidden = entry !== null;
    this.date.hidden = entry === null;
    this.body.hidden = entry === null;
    this.folio.hidden = entry === null;
    if (!entry) {
      this.sketch.style.display = 'none';
      this.sign.style.display = 'none';
      this.plate.textContent = '';
      this.plate.setAttribute('data-blank', '');
      return;
    }
    this.date.textContent = entry.dateline;
    this.body.textContent = entry.text;
    this.body.toggleAttribute('data-long', entry.text.length > LONG_TEXT);
    this.folio.textContent = `— ${entry.page} —`;
    // Short pages get a margin sketch on the right leaf; the last page gets the trailing signature.
    const long = entry.text.length > LONG_TEXT;
    this.sketch.style.display = long ? 'none' : '';
    if (!long) this.drawSketch(entry.page);
    this.sign.style.display = entry.direction ? '' : 'none';
    this.signOff.textContent = entry.signOff ?? '';
    if (entry.direction) {
      const off = entry.signOff ? ` It ends: “${entry.signOff}”` : '';
      this.sign.setAttribute('aria-label', `${entry.direction}${off}`);
    }
    if (entry.rebuttal) {
      this.plate.textContent = entry.rebuttal;
      this.plate.removeAttribute('data-blank');
      this.plate.removeAttribute('aria-label');
    } else {
      this.plate.textContent = '';
      this.plate.setAttribute('data-blank', '');
      this.plate.setAttribute('aria-label', 'FUSE’s plate is blank.');
    }
  }

  private drawSketch(page: number): void {
    const sk = journalSketch(page);
    const svg = this.sketch;
    svg.replaceChildren();
    const doc = svg.ownerDocument;
    const ring = doc.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', String(sk.ring.x));
    ring.setAttribute('cy', String(sk.ring.y));
    ring.setAttribute('r', String(sk.ring.r));
    svg.append(ring);
    for (const d of sk.strokes) {
      const path = doc.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
  }

  private buildDom(doc: Document): void {
    const L = DESK_LAYOUT;
    const m = this.model;

    const head = h(
      'div',
      { class: 'lr-j-head' },
      h('h1', null, 'Journal'),
      // The "new" mark beside a page is keyed here: phones draw it as a red dot (mobile-7-hall).
      h(
        'p',
        null,
        `${m.foundCount} of ${m.total} pages`,
        m.freshCount > 0
          ? h(
              'span',
              { class: 'lr-j-key' },
              ' · ',
              h('i', { 'aria-hidden': 'true' }),
              `${m.freshCount} new`,
            )
          : null,
      ),
    );

    // Slips, grouped by tier with a small gap between tiers.
    const st = L.stack;
    let y = st.y;
    let lastTier = m.slots[0]?.tier ?? 1;
    const list = h('div', { class: 'lr-j-stack', role: 'group', 'aria-label': 'Journal pages' });
    this.slips = m.slots.map((slot, i) => {
      if (slot.tier !== lastTier) {
        y += st.tierGap;
        lastTier = slot.tier;
      }
      const rot = (((slot.page * 37) % 11) - 5) * 0.0028;
      const el = h(
        'button',
        {
          type: 'button',
          class: 'lr-j-slip',
          style: {
            left: `${st.x}px`,
            top: `${y}px`,
            width: `${st.w}px`,
            height: `${st.h}px`,
            transform: `rotate(${rot}rad)`,
          },
        },
        h('b', null, String(slot.page)),
        slot.entry
          ? h('span', null, slot.entry.dateline)
          : h('span', null, `Tier ${tierNumeral(slot.tier)} · not found`),
        slot.fresh ? h('i', { class: 'lr-j-new' }, 'new') : null,
      ) as HTMLButtonElement;
      el.dataset.page = String(slot.page);
      if (slot.found) {
        el.setAttribute(
          'aria-label',
          `Page ${slot.page}, ${slot.entry!.dateline}${slot.fresh ? ', new' : ''}`,
        );
        el.addEventListener('click', () => {
          el.blur();
          this.show(slot.page, true);
        });
      } else {
        el.setAttribute('data-blank', '');
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('aria-label', `Page ${slot.page}, tier ${slot.tier}, not found yet`);
        el.tabIndex = -1;
      }
      const view: SlipView = { slot, el, y, rot, seed: 3 + i * 1.7, pull: 0 };
      y += st.pitch;
      list.append(el);
      return view;
    });
    // Phones: one row stands for every page not found yet (CSS hides the blank slips there).
    const missing = m.total - m.foundCount;
    if (missing > 0) {
      list.append(
        h(
          'div',
          { class: 'lr-j-more', 'aria-hidden': 'true' },
          `${missing} more page${missing === 1 ? '' : 's'} to find`,
        ),
      );
    }

    // The open spread.
    const lx = L.leafL.x - L.leafL.w / 2;
    const ly = L.leafL.y - L.leafL.h / 2;
    const rx = L.leafR.x - L.leafR.w / 2;
    const margin = 62;
    this.date = h('div', {
      class: 'lr-j-date',
      style: { left: `${lx + margin}px`, top: `${ly + 64}px` },
    });
    this.body = h('p', {
      class: 'lr-j-body',
      style: {
        left: `${lx + margin}px`,
        top: `${ly + RULE_TOP - 36}px`,
        width: `${L.leafR.x + L.leafR.w / 2 - margin - (lx + margin)}px`,
        height: `${RULE_PITCH * 9}px`,
        columnGap: `${2 * margin + (rx - (lx + L.leafL.w))}px`,
      },
    });
    this.folio = h('div', {
      class: 'lr-j-folio',
      style: { left: `${L.leafL.x - 60}px`, top: `${ly + L.leafL.h - 58}px` },
    });
    this.sketch = doc.createElementNS(SVG_NS, 'svg');
    this.sketch.setAttribute('class', 'lr-j-sketch');
    this.sketch.setAttribute('viewBox', '0 0 440 300');
    this.sketch.setAttribute('aria-hidden', 'true');
    Object.assign(this.sketch.style, {
      left: `${rx + 70}px`,
      top: `${ly + 190}px`,
      width: '440px',
      height: '300px',
    });
    // Page 16's signature: the Builder's loops run on into FUSE's sign-off, in the same hand.
    const sg = SIGNATURE;
    this.sign = doc.createElementNS(SVG_NS, 'svg');
    this.sign.setAttribute('class', 'lr-j-sign');
    this.sign.setAttribute('viewBox', `0 0 ${sg.w} ${sg.h}`);
    this.sign.setAttribute('role', 'img');
    Object.assign(this.sign.style, {
      left: `${rx + 46}px`,
      top: `${ly + RULE_TOP + RULE_PITCH * 5 - sg.baseline}px`,
      width: `${sg.w}px`,
      height: `${sg.h}px`,
    });
    const sigPath = doc.createElementNS(SVG_NS, 'path');
    sigPath.setAttribute('d', trailingSignature(sg.scribble, sg.h, sg.baseline));
    this.signOff = doc.createElementNS(SVG_NS, 'text');
    this.signOff.setAttribute('x', String(sg.scribble + 2));
    this.signOff.setAttribute('y', String(sg.baseline));
    this.signOff.setAttribute('font-size', String(sg.fontSize));
    this.sign.append(sigPath, this.signOff);
    this.empty = h(
      'div',
      {
        class: 'lr-j-empty',
        style: { left: `${lx + 40}px`, top: `${ly + 280}px`, width: `${L.leafL.w - 80}px` },
      },
      'No pages yet. Restore a machine.',
    );
    this.prevBtn = h(
      'button',
      {
        type: 'button',
        class: 'lr-j-turn',
        'aria-label': 'Previous page',
        style: { left: `${lx + 26}px`, top: `${ly + L.leafL.h - 76}px` },
        on: {
          click: (e: Event) => {
            (e.currentTarget as HTMLElement).blur();
            this.turn(-1);
          },
        },
      },
      '‹',
    ) as HTMLButtonElement;
    this.nextBtn = h(
      'button',
      {
        type: 'button',
        class: 'lr-j-turn',
        'aria-label': 'Next page',
        style: { left: `${rx + L.leafR.w - 90}px`, top: `${ly + L.leafR.h - 76}px` },
        on: {
          click: (e: Event) => {
            (e.currentTarget as HTMLElement).blur();
            this.turn(1);
          },
        },
      },
      '›',
    ) as HTMLButtonElement;
    this.spread = h(
      'div',
      { class: 'lr-j-spread', 'aria-live': 'polite' },
      this.date,
      this.body,
      this.folio,
      this.sketch,
      this.sign,
      this.empty,
    );

    const p = L.plate;
    this.plate = h('div', {
      class: 'lr-j-plate',
      'aria-live': 'polite',
      style: {
        left: `${p.x - p.w / 2}px`,
        top: `${p.y - p.h / 2}px`,
        width: `${p.w}px`,
        height: `${p.h}px`,
      },
    });

    const back = h(
      'button',
      {
        type: 'button',
        class: 'lr-stone-button lr-j-back',
        'aria-keyshortcuts': 'Escape J',
        on: {
          click: (e: Event) => {
            (e.currentTarget as HTMLElement).blur();
            this.close();
          },
        },
      },
      this.ctx.flow.journalFrom === 'puzzle' ? 'Back to the altar' : 'Back to the hall',
      h('kbd', { 'aria-hidden': 'true' }, 'Esc'),
    );
    back.dataset.action = 'journal-back';
    // Phones: the same ✕ in the top-right corner as Settings and the Codex (D-040).
    const x = h(
      'button',
      {
        type: 'button',
        class: 'lr-panel-x lr-j-x',
        'aria-label': 'Close journal',
        on: {
          click: (e: Event) => {
            (e.currentTarget as HTMLElement).blur();
            this.close();
          },
        },
      },
      '✕',
    );

    this.root = h(
      'section',
      { class: 'lr-journal', 'aria-label': 'Journal' },
      head,
      list,
      this.spread,
      this.prevBtn,
      this.nextBtn,
      this.plate,
      back,
      x,
    );
    this.ctx.ui.layers.hud.append(this.root);
    this.unplace = placeWidgets(this.ctx.chrome, [
      { el: x, place: { default: 'right' }, id: 'lr-journal-close' },
    ]);
  }
}
