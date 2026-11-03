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
    if (this.journalBtn) {
      this.journalBtn.dataset.action = 'journal';
      this.journalBtn.hidden = true;
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
    );
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
    layer.append(this.nameplate, this.root);
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
    b.setAttribute('aria-label', unread > 0 ? `Journal, ${unread} new` : 'Journal');
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
