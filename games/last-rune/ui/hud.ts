/**
 * Always-there corner buttons (Codex, Settings; Journal in the hall) plus the hall's name plate.
 * C, O and J are Input `globalKeys` and Esc/arrows are `buttonKeys` (game/ctx.ts), so they work
 * while a button has focus. Panels opened from here return focus to the canvas when they close,
 * not to the button (`NO_RESTORE_FOCUS_ATTR` on the bar), so play resumes by keyboard. The
 * Journal button switches scene, which hides the HUD and drops focus with it.
 *
 * Phones (mobile-2): the buttons fold behind one ☰ in the top-right corner (the right letterbox
 * bar); a tap opens them as a short list, picking one or tapping elsewhere closes it. The ☰
 * carries the journal's "new pages" dot. Off phones the ☰ is hidden (CSS) and nothing changes.
 */
import { h, NO_RESTORE_FOCUS_ATTR, type Rect } from '@thunderclap-engine/engine/ui';
import { dpx } from './frame-units';
import { type Bounds, clampInto, cost, type Obstacle, pickSpot } from './place';

/** A door's plate on a phone (mobile-5-chrome): screen design px, centre x and plate top. */
export interface DoorPlate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Widest the plate may grow, design px (about the gap to the next door). */
  readonly maxWidth: number;
  readonly name: string;
  readonly status: 'solved' | 'unlocked' | 'locked';
}

/** A gem a locked door still needs, for the tap card (phones): its name and CSS colour. */
export interface PlateGem {
  readonly label: string;
  readonly colour: string;
}

/** The tapped door's card: centred on x; its top at y (or, `above`, its foot at y). */
export interface PlateAt {
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly note: string;
  /** Phones: the gems a locked door needs, as named icons. */
  readonly gems?: readonly PlateGem[];
  /** Phones: the card hangs above y (its foot at y) instead of below it. */
  readonly above?: boolean;
  /** Phones: the door whose own plate the card must stay clear of (it sits below that plate). */
  readonly door?: string;
  /**
   * Phones (mobile-7-hall): the door's drawn arch, design px. With it the card is placed beside
   * the door wherever it covers no other door's plate, the Next tag or Menu.
   */
  readonly doorBox?: Rect;
  /** Phones: the visible band (design px) the card must stay inside. */
  readonly bounds?: Bounds;
  /** Phones: FUSE's word on the door, inside the card (not a second bubble). */
  readonly fuse?: string;
}

/** The suggested door's ring and tag (see `Hud.suggest`). */
export interface SuggestAt {
  /** The ring: centre x/y and size, design px. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly label: string;
  readonly round?: boolean;
  /**
   * Phones (mobile-7-hall): the visible band, design px. With it the tag sits above the ring,
   * or beside it, wherever it covers no door plate and keeps off the band's edges.
   */
  readonly bounds?: Bounds;
  /** Phones: the least gap, design px, between the tag and the band's edges. */
  readonly gap?: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A small padlock (stroke follows `currentColor`). */
function lockIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 14');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('lr-door-lock');
  const shackle = doc.createElementNS(SVG_NS, 'path');
  shackle.setAttribute('d', 'M3.2 6.2V4.3a2.8 2.8 0 0 1 5.6 0v1.9');
  shackle.setAttribute('fill', 'none');
  shackle.setAttribute('stroke', 'currentColor');
  shackle.setAttribute('stroke-width', '1.6');
  const body = doc.createElementNS(SVG_NS, 'rect');
  body.setAttribute('x', '1.2');
  body.setAttribute('y', '6');
  body.setAttribute('width', '9.6');
  body.setAttribute('height', '7.2');
  body.setAttribute('rx', '1.4');
  body.setAttribute('fill', 'currentColor');
  svg.append(shackle, body);
  return svg;
}

export interface HudActions {
  codex(): void;
  settings(): void;
  /** The journal desk (story-scenes). Shown only while `journalShown` is true. */
  journal?(): void;
}

export class Hud {
  readonly root: HTMLElement;
  readonly nameplate: HTMLElement;
  private readonly plateName: HTMLElement;
  private readonly plateNote: HTMLElement;
  private readonly plateGems: HTMLElement;
  private readonly plateFuse: HTMLElement;
  private readonly plateFuseText: HTMLElement;
  private plateAt: PlateAt | null = null;
  private suggestAt: SuggestAt | null = null;
  private readonly scrim: HTMLElement;
  private readonly journalBtn: HTMLElement | null;
  private readonly menuBtn: HTMLElement;
  private readonly menuNew: HTMLElement;
  private readonly journalNote: HTMLElement;
  private readonly nextRing: HTMLElement;
  private readonly nextTag: HTMLElement;
  private readonly doorLayer: HTMLElement;
  private doorKey = '';
  private offOutside: (() => void) | null = null;

  /**
   * `layer`: the overlay's frame layer (`ui.layers.hud`); `scale`: CSS px per design px there
   * (`ui.scale`). Positions are design px (`dpx`).
   */
  constructor(
    layer: HTMLElement,
    actions: HudActions,
    private readonly scale: () => number = () => 1,
  ) {
    const btn = (label: string, key: string, fn: () => void) =>
      h(
        'button',
        {
          type: 'button',
          class: 'lr-stone-button',
          'aria-keyshortcuts': key,
          on: {
            click: () => {
              this.menu(false);
              fn();
            },
          },
        },
        label,
        h('kbd', { 'aria-hidden': 'true' }, key),
      );
    this.journalBtn = actions.journal ? btn('Journal', 'J', actions.journal) : null;
    // Phones: the ☰'s dot is explained on the Journal row itself (mobile-3-chrome).
    this.journalNote = h('small', { class: 'lr-hud-note', 'aria-hidden': 'true', hidden: true });
    if (this.journalBtn) {
      this.journalBtn.dataset.action = 'journal';
      this.journalBtn.hidden = true;
      this.journalBtn.append(this.journalNote);
    }
    this.menuBtn = h(
      'button',
      {
        type: 'button',
        class: 'lr-stone-button lr-hud-menu',
        'aria-label': 'Menu',
        'aria-expanded': 'false',
        on: { click: () => this.menu(!this.root.hasAttribute('data-open')) },
      },
      h('span', { 'aria-hidden': 'true' }, '\u2630'),
      // Phones (mobile-5-chrome): the ☰ says what it is, and its dot says what is new.
      h('small', { class: 'lr-hud-menu-label', 'aria-hidden': 'true' }, 'Menu'),
    );
    this.menuNew = h('small', { class: 'lr-hud-menu-new', 'aria-hidden': 'true', hidden: true });
    this.menuBtn.append(this.menuNew);
    this.root = h(
      'div',
      { class: 'lr-hud', hidden: true, [NO_RESTORE_FOCUS_ATTR]: '' },
      this.menuBtn,
      this.journalBtn,
      btn('Codex', 'C', actions.codex),
      btn('Settings', 'O', actions.settings),
    );
    this.plateName = h('span');
    this.plateNote = h('small');
    this.plateGems = h('div', { class: 'lr-card-gems', hidden: true });
    // Phones (mobile-7-hall): FUSE's word on a locked door goes in its card, not a second bubble.
    this.plateFuseText = h('span');
    this.plateFuse = h(
      'p',
      { class: 'lr-card-fuse', hidden: true },
      h('b', null, 'FUSE'),
      ' ',
      this.plateFuseText,
    );
    this.nameplate = h(
      'div',
      { class: 'lr-nameplate', hidden: true, 'aria-live': 'polite' },
      this.plateName,
      this.plateNote,
      this.plateGems,
      this.plateFuse,
    );
    // Phones: the open ☰ list dims the hall behind it, so no door name shows through.
    this.scrim = h('div', { class: 'lr-hud-scrim', 'aria-hidden': 'true', hidden: true });
    // Phones: the suggested door gets a pulsing gold outline and a "Start here" / "Next" tag
    // (mobile-3-chrome, D-040); the canvas's own soft ring is too faint at phone size.
    this.nextRing = h('div', { class: 'lr-hall-next', 'aria-hidden': 'true', hidden: true });
    this.nextTag = h('div', { class: 'lr-hall-next-tag', 'aria-hidden': 'true', hidden: true });
    // Phones: every door's own plate (mobile-5-chrome); hidden elsewhere (CSS).
    this.doorLayer = h('div', { class: 'lr-doors', 'aria-hidden': 'true', hidden: true });
    // The ring under the plates (a plate is never cut by it), then the tag, the card, the menu.
    layer.append(
      this.nextRing,
      this.doorLayer,
      this.nextTag,
      this.nameplate,
      this.scrim,
      this.root,
    );
  }

  /**
   * Mark the door to try next: a box (design px, centre x/y, size w×h) and its tag's words;
   * null hides it. Off phones it stays hidden (CSS).
   */
  suggest(at: SuggestAt | null): void {
    this.suggestAt = at;
    this.nextRing.hidden = this.nextTag.hidden = !at;
    if (!at) return;
    const top = at.y - at.h / 2;
    this.nextRing.toggleAttribute('data-round', at.round === true);
    Object.assign(this.nextRing.style, {
      left: dpx(at.x - at.w / 2),
      top: dpx(top),
      width: dpx(at.w),
      height: dpx(at.h),
    });
    this.nextTag.style.left = dpx(at.x);
    this.nextTag.style.setProperty('--lr-next-top', dpx(top));
    this.nextTag.textContent = at.label;
    this.placeTag();
  }

  /**
   * Phones (mobile-7-hall): the tag above the ring if it fits there, clear of every plate, Menu
   * and the band's edges; else beside the ring, pointing at it; else wherever it covers least.
   * A spot that had to slide to stay on screen no longer points at the ring, so it costs extra.
   */
  private placeTag(): void {
    const at = this.suggestAt;
    const tag = this.nextTag;
    if (!at?.bounds || this.doorLayer.hidden || tag.hidden) {
      tag.removeAttribute('data-side');
      tag.style.top = tag.style.transform = '';
      if (at) tag.style.left = dpx(at.x);
      return;
    }
    const g = at.gap ?? 6;
    const b = at.bounds;
    const ring = { x: at.x - at.w / 2, y: at.y - at.h / 2, width: at.w, height: at.h };
    // A margin round each plate (polish-8): a tag flush under a plate read as one label with it
    // ("The Last Rune: Start here"), so the tag keeps a gap's clearance or moves beside the ring.
    const obstacles: Obstacle[] = [{ rect: ring, weight: 4 }, ...this.plateBoxes(null, 10, g)];
    const menu = this.box(this.menuBtn);
    if (menu) obstacles.push({ rect: menu, weight: 10 });
    const inner = { left: b.left + g, top: b.top + g, right: b.right - g, bottom: b.bottom - g };
    const sides = ['above', 'left', 'right'] as const;
    let best: { side: (typeof sides)[number]; rect: Rect; score: number } | null = null;
    tag.style.transform = 'none';
    for (const side of sides) {
      tag.dataset.side = side;
      const w = tag.offsetWidth / this.k;
      const hh = tag.offsetHeight / this.k;
      const want: Rect =
        side === 'above'
          ? { x: at.x - w / 2, y: ring.y - hh - g * 0.5, width: w, height: hh }
          : {
              x: side === 'left' ? ring.x - w - g * 0.5 : ring.x + ring.width + g * 0.5,
              y: ring.y + Math.min(ring.height * 0.3, ring.height / 2 - hh / 2),
              width: w,
              height: hh,
            };
      const rect = clampInto(want, inner);
      const slid = Math.abs(rect.x - want.x) + Math.abs(rect.y - want.y);
      const score = cost(rect, obstacles) + slid * hh * 10;
      if (!best || score < best.score - 1e-6) best = { side, rect, score };
    }
    if (!best) return;
    tag.dataset.side = best.side;
    tag.style.left = dpx(Math.round(best.rect.x));
    tag.style.top = dpx(Math.round(best.rect.y));
  }

  /** CSS px per design px on the frame. */
  private get k(): number {
    return this.scale() || 1;
  }

  /** An element's box in the HUD layer, design px (its transform included); null if not shown. */
  private box(el: HTMLElement): Rect | null {
    const layer = this.doorLayer.parentElement;
    const r = el.getBoundingClientRect();
    if (!layer || r.width === 0) return null;
    const L = layer.getBoundingClientRect();
    const k = this.k;
    return {
      x: (r.left - L.left) / k,
      y: (r.top - L.top) / k,
      width: r.width / k,
      height: r.height / k,
    };
  }

  /** Every door plate's box as an obstacle (but `skip`'s), grown by `pad` each side, design px. */
  private plateBoxes(skip: string | null, weight: number, pad = 0): Obstacle[] {
    const out: Obstacle[] = [];
    for (const el of this.doorLayer.querySelectorAll<HTMLElement>('.lr-door')) {
      if (skip && el.dataset.door === skip) continue;
      const r = this.box(el);
      if (!r) continue;
      const rect = {
        x: r.x - pad,
        y: r.y - pad,
        width: r.width + 2 * pad,
        height: r.height + 2 * pad,
      };
      out.push({ rect, weight });
    }
    return out;
  }

  /**
   * Phones: a plate on every door, saying what it is without a tap. One plate family
   * (mobile-6-chrome): an open door's name in gold, a restored one's with a ✓ inside the plate, a
   * locked one's name, dimmed, after a padlock. What a locked door needs is on its tap card.
   * Null hides them. Rebuilt only when the doors change.
   */
  doors(list: readonly DoorPlate[] | null): void {
    this.doorLayer.hidden = !list;
    if (!list) return;
    const key = JSON.stringify(list);
    if (key === this.doorKey) return;
    this.doorKey = key;
    const doc = this.doorLayer.ownerDocument;
    this.doorLayer.replaceChildren(
      ...list.map((d) => {
        const el = h('div', { class: 'lr-door', dataset: { status: d.status, door: d.id } });
        el.style.left = dpx(Math.round(d.x));
        el.style.top = dpx(Math.round(d.y));
        el.style.setProperty('--lr-door-max', dpx(Math.round(d.maxWidth)));
        if (d.status === 'locked') el.append(lockIcon(doc));
        if (d.status === 'solved') el.append(h('span', { class: 'lr-door-tick' }, '\u2713'));
        // A short last word (Conveyor A, Cell II, Unit 4) never stands alone on a line: it
        // keeps to the word before it (a nowrap pair, so the text itself is unchanged).
        const tail = /^(.*?)(\S+ \S{1,2})$/.exec(d.name);
        el.append(
          h(
            'span',
            { class: 'lr-door-name' },
            tail ? tail[1] : d.name,
            tail ? h('span', { style: { whiteSpace: 'nowrap' } }, tail[2]) : null,
          ),
        );
        return el;
      }),
    );
    this.spreadPlates(list);
    this.placeTag();
  }

  /**
   * Neighbours in a row that would touch (a plate is never narrower than its longest word) step
   * apart, each by half the overlap, so every plate keeps a clear gap and stays under its door.
   */
  private spreadPlates(list: readonly DoorPlate[]): void {
    const els = [...this.doorLayer.querySelectorAll<HTMLElement>('.lr-door')];
    const items = els.map((el, i) => ({
      el,
      x: list[i]!.x,
      y: list[i]!.y,
      w: el.offsetWidth / this.k,
    }));
    const rows = new Map<number, typeof items>();
    for (const it of items) {
      const k = Math.round(it.y / 8);
      const row = rows.get(k) ?? [];
      row.push(it);
      rows.set(k, row);
    }
    const GAP = 14;
    for (const row of rows.values()) {
      row.sort((a, b) => a.x - b.x);
      for (let pass = 0; pass < 4; pass++) {
        for (let i = 1; i < row.length; i++) {
          const a = row[i - 1]!;
          const b = row[i]!;
          const over = a.x + a.w / 2 + GAP - (b.x - b.w / 2);
          if (over <= 0) continue;
          a.x -= over / 2;
          b.x += over / 2;
        }
      }
      for (const it of row) it.el.style.left = dpx(Math.round(it.x));
    }
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
    if (!v) this.menu(false);
  }

  /** Phones: open or close the ☰ list. */
  menu(open: boolean): void {
    this.root.toggleAttribute('data-open', open);
    this.scrim.hidden = !open;
    // polish-10: a door plate the open list would cut mid-word ("Lift S…") steps out while
    // the list is open, so the dimmed hall shows only whole names. The sheet is the list's
    // panel (chrome-styles.ts `.lr-hud[data-open]::before`, 6 px past it), plus its shadow.
    const sheet = open ? this.root.getBoundingClientRect() : null;
    for (const el of this.doorLayer.querySelectorAll<HTMLElement>('.lr-door')) {
      const r = sheet ? el.getBoundingClientRect() : null;
      const under =
        !!sheet &&
        !!r &&
        r.left < sheet.right + 8 &&
        sheet.left - 8 < r.right &&
        r.top < sheet.bottom + 8 &&
        sheet.top - 8 < r.bottom;
      el.toggleAttribute('data-under-menu', under);
    }
    // The list and a door's card never show together (mobile-6-chrome).
    if (open) this.plate(null);
    this.menuBtn.setAttribute('aria-expanded', String(open));
    this.offOutside?.();
    this.offOutside = null;
    if (!open) return;
    const doc = this.root.ownerDocument;
    const away = (e: Event) => {
      if (!this.root.contains(e.target as Node)) this.menu(false);
    };
    // Esc closes the list and nothing else: the key never reaches the scene (in the hall it
    // would open Settings, at an altar it would leave), and focus goes back to the ☰.
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      this.menu(false);
      this.menuBtn.focus();
    };
    doc.addEventListener('pointerdown', away, true);
    doc.addEventListener('keydown', esc, true);
    this.offOutside = () => {
      doc.removeEventListener('pointerdown', away, true);
      doc.removeEventListener('keydown', esc, true);
    };
  }

  /**
   * Show or hide the Journal button; `unread` > 0 marks it (new pages on the desk). `tag`:
   * phones may also say so in words beside the ☰ (the hall); at an altar the dot alone, so
   * the board's column keeps its room.
   */
  journalShown(shown: boolean, unread = 0, tag = true): void {
    const b = this.journalBtn;
    if (!b) return;
    b.hidden = !shown;
    b.toggleAttribute('data-unread', unread > 0);
    this.menuBtn.toggleAttribute('data-unread', shown && unread > 0);
    this.menuNew.hidden = !(tag && shown && unread > 0);
    // Phones: a tag beside the ☰ that says where the new page is (one line).
    this.menuNew.textContent = unread > 1 ? 'New pages in journal' : 'New page in journal';
    this.menuBtn.setAttribute(
      'aria-label',
      shown && unread > 0 ? 'Menu, new journal pages' : 'Menu',
    );
    b.setAttribute('aria-label', unread > 0 ? `Journal, ${unread} new` : 'Journal');
    this.journalNote.hidden = unread <= 0;
    this.journalNote.textContent =
      unread === 1 ? 'New journal page' : unread > 1 ? `${unread} new journal pages` : '';
  }

  /** Phones: the ☰ list is open. */
  get menuOpen(): boolean {
    return this.root.hasAttribute('data-open');
  }

  /** Show the plate centred on x, its top at y in design px (see `PlateAt`); null hides it. */
  plate(at: PlateAt | null): void {
    this.plateAt = at;
    for (const el of this.doorLayer.querySelectorAll('[data-tapped]')) {
      el.removeAttribute('data-tapped');
    }
    if (!at) {
      this.nameplate.hidden = true;
      return;
    }
    this.plateFuse.hidden = !at.fuse;
    this.plateFuseText.textContent = at.fuse ?? '';
    this.plateName.textContent = at.name;
    this.plateNote.textContent = at.note;
    const gems = at.gems ?? [];
    this.plateGems.hidden = gems.length === 0;
    this.plateGems.replaceChildren(
      ...gems.map((g) => {
        const dot = h('i', { class: 'lr-door-gem' });
        dot.style.setProperty('--gem', g.colour);
        return h('span', { class: 'lr-card-gem' }, dot, g.label.replace(/ /g, '\u00a0'));
      }),
    );
    if (at.doorBox && at.bounds && !this.doorLayer.hidden) {
      this.placeCard(at, at.doorBox, at.bounds);
      return;
    }
    this.nameplate.removeAttribute('data-placed');
    this.nameplate.style.transform = '';
    let y = at.y;
    // Below a door: under its own plate, never over it.
    const own = at.door
      ? this.doorLayer.querySelector<HTMLElement>(`[data-door="${at.door}"]`)
      : null;
    if (own && !this.doorLayer.hidden && !at.above) {
      y = Math.max(y, (own.offsetTop + own.offsetHeight) / this.k + 8);
    }
    this.nameplate.toggleAttribute('data-above', at.above === true);
    this.nameplate.style.top = dpx(y);
    this.nameplate.hidden = false;
    // Keep the whole plate on screen: doors at the wall's ends would push it off the edge.
    const half = this.nameplate.offsetWidth / this.k / 2;
    const room = (this.nameplate.parentElement?.clientWidth ?? 0) / this.k || 1920;
    const x = half > 0 ? Math.min(Math.max(at.x, half + 12), room - half - 12) : at.x;
    this.nameplate.style.left = dpx(Math.round(x));
  }

  /** The door card's box on the frame (design px), or null while it is hidden. */
  plateBox(): Rect | null {
    return this.nameplate.hidden ? null : this.box(this.nameplate);
  }

  /** Phones: FUSE's word on the door whose card is showing, inside that card. */
  plateSay(door: string, text: string): boolean {
    const at = this.plateAt;
    if (!at || at.door !== door || this.nameplate.hidden) return false;
    this.plate({ ...at, fuse: text });
    // Where his word would push the card over another plate, it is left off and he speaks in
    // his own caption instead.
    return !this.plateFuse.hidden;
  }

  /**
   * Phones (mobile-7-hall): the card beside its door, on the side where it covers no other
   * door's plate, the Next tag or Menu (then least of the door's own arch). The door's plate
   * lights up, so the card reads as its own even when it has to stand off to one side.
   */
  private placeCard(at: PlateAt, door: Rect, b: Bounds): void {
    const card = this.nameplate;
    card.toggleAttribute('data-placed', true);
    card.removeAttribute('data-above');
    card.style.transform = 'none';
    card.style.left = '0px';
    card.style.top = '0px';
    card.hidden = false;
    const own = at.door
      ? this.doorLayer.querySelector<HTMLElement>(`[data-door="${at.door}"]`)
      : null;
    own?.setAttribute('data-tapped', '');
    const ownBox = own ? this.box(own) : null;
    // The door and its plate together: the card never covers its own plate.
    const d = ownBox ? union(door, ownBox) : door;
    const w = card.offsetWidth / this.k;
    const hh = card.offsetHeight / this.k;
    const g = Math.max(6, (b.bottom - b.top) * 0.012);
    const cx = d.x + d.width / 2;
    const cy = d.y + d.height / 2;
    const left = d.x - w - g;
    const right = d.x + d.width + g;
    const cands: Rect[] = [
      { x: cx - w / 2, y: d.y + d.height + g, width: w, height: hh },
      { x: cx - w / 2, y: d.y - hh - g, width: w, height: hh },
      { x: left, y: cy - hh / 2, width: w, height: hh },
      { x: right, y: cy - hh / 2, width: w, height: hh },
      { x: left, y: d.y, width: w, height: hh },
      { x: right, y: d.y, width: w, height: hh },
      { x: left, y: d.y + d.height - hh, width: w, height: hh },
      { x: right, y: d.y + d.height - hh, width: w, height: hh },
      { x: left, y: d.y + d.height + g, width: w, height: hh },
      { x: right, y: d.y + d.height + g, width: w, height: hh },
      { x: left, y: d.y - hh - g, width: w, height: hh },
      { x: right, y: d.y - hh - g, width: w, height: hh },
    ];
    // Failing those, a strip along the band's top or bottom edge, over the doors' art but no
    // plate, as near the door as it goes.
    for (const y of [b.top + g, b.bottom - hh - g])
      for (const x of [cx - w / 2, d.x + d.width - w, d.x, left, right])
        cands.push({ x, y, width: w, height: hh });
    // Then anywhere in the band, nearest the door first.
    const step = Math.max(8, w / 16);
    const grid: Rect[] = [];
    for (let y = b.top + g; y <= b.bottom - hh - g; y += step / 2)
      for (let x = b.left + g; x <= b.right - w - g; x += step)
        grid.push({ x, y, width: w, height: hh });
    const dist = (r: Rect) => Math.hypot(r.x + w / 2 - cx, r.y + hh / 2 - cy);
    grid.sort((p, q) => dist(p) - dist(q));
    cands.push(...grid);
    const obstacles: Obstacle[] = [...this.plateBoxes(at.door ?? null, 10)];
    if (ownBox) obstacles.push({ rect: ownBox, weight: 10 });
    obstacles.push({ rect: door, weight: 1 });
    for (const el of [this.nextTag, this.menuBtn, this.menuNew]) {
      const r = el.hidden ? null : this.box(el);
      if (r) obstacles.push({ rect: r, weight: 40 });
    }
    // A hair of room round each, so the card never sits flush on a plate.
    const room = obstacles.map((o) => ({
      weight: o.weight,
      rect: {
        x: o.rect.x - g / 2,
        y: o.rect.y - g / 2,
        width: o.rect.width + g,
        height: o.rect.height + g,
      },
    }));
    const best = pickSpot(cands, room, b);
    if (!best) return;
    const hard = room.filter((o) => (o.weight ?? 1) >= 10);
    if (!this.plateFuse.hidden && cost(best.rect, hard) > 0) {
      // No clear spot with FUSE's word on it: the card goes back to name and note.
      this.plateFuse.hidden = true;
      this.placeCard(at, door, b);
      return;
    }
    card.style.left = dpx(Math.round(best.rect.x));
    card.style.top = dpx(Math.round(best.rect.y));
  }
}

/** The smallest box holding both. */
function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}
