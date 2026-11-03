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
import { h, NO_RESTORE_FOCUS_ATTR } from '@engine/ui';

/** A door's plate on a phone (mobile-5-chrome): screen design px, centre x and plate top. */
export interface DoorPlate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Widest the plate may grow, design px (about the gap to the next door). */
  readonly maxWidth: number;
  readonly name: string;
  readonly status: 'solved' | 'unlocked' | 'locked';
  /** Locked: the missing sockets' colours (CSS colours), in order. */
  readonly needs: readonly string[];
  /** Locked: machines still to restore (shown as "+N"). */
  readonly more: number;
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
  private readonly journalBtn: HTMLElement | null;
  private readonly menuBtn: HTMLElement;
  private readonly menuNew: HTMLElement;
  private readonly journalNote: HTMLElement;
  private readonly nextRing: HTMLElement;
  private readonly nextTag: HTMLElement;
  private readonly doorLayer: HTMLElement;
  private doorKey = '';
  private offOutside: (() => void) | null = null;

  constructor(layer: HTMLElement, actions: HudActions) {
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
    this.nameplate = h(
      'div',
      { class: 'lr-nameplate', hidden: true, 'aria-live': 'polite' },
      this.plateName,
      this.plateNote,
    );
    // Phones: the suggested door gets a pulsing gold outline and a "Start here" / "Next" tag
    // (mobile-3-chrome, D-040); the canvas's own soft ring is too faint at phone size.
    this.nextRing = h('div', { class: 'lr-hall-next', 'aria-hidden': 'true', hidden: true });
    this.nextTag = h('div', { class: 'lr-hall-next-tag', 'aria-hidden': 'true', hidden: true });
    // Phones: every door's own plate (mobile-5-chrome); hidden elsewhere (CSS).
    this.doorLayer = h('div', { class: 'lr-doors', 'aria-hidden': 'true', hidden: true });
    layer.append(this.doorLayer, this.nextRing, this.nextTag, this.nameplate, this.root);
  }

  /**
   * Mark the door to try next: a box (design px, centre x/y, size w×h) and its tag's words;
   * null hides it. Off phones it stays hidden (CSS).
   */
  suggest(
    at: { x: number; y: number; w: number; h: number; label: string; round?: boolean } | null,
  ): void {
    this.nextRing.hidden = this.nextTag.hidden = !at;
    if (!at) return;
    const top = at.y - at.h / 2;
    this.nextRing.toggleAttribute('data-round', at.round === true);
    Object.assign(this.nextRing.style, {
      left: `${at.x - at.w / 2}px`,
      top: `${top}px`,
      width: `${at.w}px`,
      height: `${at.h}px`,
    });
    this.nextTag.style.left = `${at.x}px`;
    this.nextTag.style.setProperty('--lr-next-top', `${top}px`);
    this.nextTag.textContent = at.label;
  }

  /**
   * Phones: a plate on every door, saying what it is without a tap: an open door's name in
   * gold, a restored one's with a ✓, a locked one's padlock and the colours it still needs.
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
        el.style.left = `${Math.round(d.x)}px`;
        el.style.top = `${Math.round(d.y)}px`;
        el.style.setProperty('--lr-door-max', `${Math.round(d.maxWidth)}px`);
        if (d.status === 'locked') {
          el.append(lockIcon(doc));
          for (const c of d.needs) {
            const dot = h('i', { class: 'lr-door-gem' });
            dot.style.setProperty('--gem', c);
            el.append(dot);
          }
          if (d.more > 0) el.append(h('b', {}, `+${d.more}`));
        } else {
          if (d.status === 'solved') el.append(h('span', { class: 'lr-door-tick' }, '\u2713'));
          el.append(h('span', { class: 'lr-door-name' }, d.name));
        }
        return el;
      }),
    );
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
    if (!v) this.menu(false);
  }

  /** Phones: open or close the ☰ list. */
  menu(open: boolean): void {
    this.root.toggleAttribute('data-open', open);
    this.menuBtn.setAttribute('aria-expanded', String(open));
    this.offOutside?.();
    this.offOutside = null;
    if (!open) return;
    const doc = this.root.ownerDocument;
    const away = (e: Event) => {
      if (!this.root.contains(e.target as Node)) this.menu(false);
    };
    doc.addEventListener('pointerdown', away, true);
    this.offOutside = () => doc.removeEventListener('pointerdown', away, true);
  }

  /** Show or hide the Journal button; `unread` > 0 marks it (new pages on the desk). */
  journalShown(shown: boolean, unread = 0): void {
    const b = this.journalBtn;
    if (!b) return;
    b.hidden = !shown;
    b.toggleAttribute('data-unread', unread > 0);
    this.menuBtn.toggleAttribute('data-unread', shown && unread > 0);
    this.menuNew.hidden = !(shown && unread > 0);
    this.menuNew.textContent = unread > 1 ? 'New pages' : 'New page';
    this.menuBtn.setAttribute(
      'aria-label',
      shown && unread > 0 ? 'Menu, new journal pages' : 'Menu',
    );
    b.setAttribute('aria-label', unread > 0 ? `Journal, ${unread} new` : 'Journal');
    this.journalNote.hidden = unread <= 0;
    this.journalNote.textContent =
      unread === 1 ? 'New journal page' : unread > 1 ? `${unread} new journal pages` : '';
  }

  /** Show the plate centred above (x, y) in design px; null hides it. */
  plate(at: { x: number; y: number; name: string; note: string } | null): void {
    if (!at) {
      this.nameplate.hidden = true;
      return;
    }
    this.plateName.textContent = at.name;
    this.plateNote.textContent = at.note;
    this.nameplate.style.top = `${at.y}px`;
    this.nameplate.hidden = false;
    // Keep the whole plate on screen: doors at the wall's ends would push it off the edge.
    const half = this.nameplate.offsetWidth / 2;
    const room = (this.nameplate.parentElement?.clientWidth ?? 0) || 1920;
    const x = half > 0 ? Math.min(Math.max(at.x, half + 12), room - half - 12) : at.x;
    this.nameplate.style.left = `${Math.round(x)}px`;
  }
}
