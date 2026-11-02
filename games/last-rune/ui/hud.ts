/**
 * Always-there corner buttons (Codex, Settings; Journal in the hall) plus the hall's name plate.
 * C, O and J are Input `globalKeys` and Esc/arrows are `buttonKeys` (game/ctx.ts), so they work
 * while a button has focus. Panels opened from here return focus to the canvas when they close,
 * not to the button (`NO_RESTORE_FOCUS_ATTR` on the bar), so play resumes by keyboard. The
 * Journal button switches scene, which hides the HUD and drops focus with it.
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

  constructor(layer: HTMLElement, actions: HudActions) {
    const btn = (label: string, key: string, fn: () => void) =>
      h(
        'button',
        {
          type: 'button',
          class: 'lr-stone-button',
          'aria-keyshortcuts': key,
          on: { click: () => fn() },
        },
        label,
        h('kbd', { 'aria-hidden': 'true' }, key),
      );
    this.journalBtn = actions.journal ? btn('Journal', 'J', actions.journal) : null;
    if (this.journalBtn) {
      this.journalBtn.dataset.action = 'journal';
      this.journalBtn.hidden = true;
    }
    this.root = h(
      'div',
      { class: 'lr-hud', hidden: true, [NO_RESTORE_FOCUS_ATTR]: '' },
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
  }

  /** Show or hide the Journal button; `unread` > 0 marks it (new pages on the desk). */
  journalShown(shown: boolean, unread = 0): void {
    const b = this.journalBtn;
    if (!b) return;
    b.hidden = !shown;
    b.toggleAttribute('data-unread', unread > 0);
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
    this.nameplate.style.left = `${at.x}px`;
    this.nameplate.style.top = `${at.y}px`;
    this.nameplate.hidden = false;
  }
}
