/**
 * The codex: a leather tome (CSS only) laid over whatever scene is running.
 * One page per gem, two pages per spread. Earned gems sit lit in a stone niche
 * with their rule, the maths, and FUSE's margin note. Unearned gems are a
 * chained niche naming the machine that teaches them.
 *
 * Keys inside the book: ←/→ turn the spread, Esc closes (engine/ui panel stack).
 */
import { button, h, type PanelHandle, type PanelStack } from '@engine/ui';
import type { GameSave } from '../game/save';
import { markCodexSeen, progressOf } from '../game/save';
import type { GemKind } from '../rules/types';
import { type CodexPage, codexPages } from './codex-data';

export interface CodexOptions {
  readonly panels: PanelStack;
  readonly save: GameSave;
  /** Page-turn / open sound hook. */
  readonly onTurn?: () => void;
  /** Book open / close sound hooks. */
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
}

export class Codex {
  private handle: PanelHandle | null = null;
  private spread = 0;

  constructor(private readonly opts: CodexOptions) {}

  get isOpen(): boolean {
    return this.handle?.open ?? false;
  }

  toggle(gem?: GemKind): void {
    if (this.isOpen) this.close();
    else this.open(gem);
  }

  /** Open at `gem`'s spread, else the first fresh page, else the first. */
  open(gem?: GemKind): void {
    if (this.isOpen) return;
    const pages = this.pages();
    const target = gem ? pages.findIndex((p) => p.gem === gem) : pages.findIndex((p) => p.fresh);
    this.spread = Math.max(0, Math.floor(Math.max(0, target) / 2));
    const book = h('div', { class: 'lr-codex' });
    this.opts.onOpen?.();
    this.handle = this.opts.panels.push({
      content: book,
      label: 'Codex',
      chrome: 'none',
      className: 'lr-codex-host',
      modal: true,
      dismissible: true,
      closeOnBackdrop: true,
      onClose: () => {
        this.handle = null;
        this.opts.onClose?.();
      },
    });
    book.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') this.turn(1, book);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.turn(-1, book);
      else if (e.code === 'KeyC') this.close();
      else return;
      // Keep the game's Input from seeing the same key once the modal is gone.
      e.preventDefault();
      e.stopPropagation();
    });
    this.draw(book);
    this.opts.onTurn?.();
  }

  close(): void {
    this.handle?.close('programmatic');
    this.handle = null;
  }

  private pages(): CodexPage[] {
    const d = this.opts.save.get();
    return codexPages(progressOf(d), d.codex.seen);
  }

  private turn(delta: number, book: HTMLElement): void {
    const last = Math.ceil(this.pages().length / 2) - 1;
    const next = Math.min(last, Math.max(0, this.spread + delta));
    if (next === this.spread) return;
    this.spread = next;
    this.draw(book);
    this.opts.onTurn?.();
  }

  private draw(book: HTMLElement): void {
    const pages = this.pages();
    const shown = pages.slice(this.spread * 2, this.spread * 2 + 2);
    // Viewing an earned page marks it seen (clears its "new" ribbon next time).
    const fresh = shown.filter((p) => p.fresh).map((p) => p.gem);
    if (fresh.length > 0) {
      this.opts.save.update((d) => {
        for (const g of fresh) markCodexSeen(d, g);
        return undefined;
      });
    }
    const nav = h(
      'nav',
      { class: 'lr-codex-nav', 'aria-label': 'Codex pages' },
      ...pages.map((p, i) =>
        h(
          'button',
          {
            type: 'button',
            'aria-current': String(Math.floor(i / 2) === this.spread),
            'aria-label': `${p.name}${p.unlocked ? '' : ' (locked)'}`,
            on: {
              click: () => {
                this.spread = Math.floor(i / 2);
                this.draw(book);
                this.opts.onTurn?.();
              },
            },
          },
          h('span', {
            class: 'lr-dot',
            style: { background: p.unlocked ? p.colour : '#6c7488' },
          }),
          p.name,
        ),
      ),
    );
    const close = button('×', () => this.close(), {
      className: 'lr-codex-close',
      ariaLabel: 'Close codex',
    });
    book.replaceChildren(
      h('div', { class: 'lr-corner-bl' }),
      h('div', { class: 'lr-corner-br' }),
      h('div', { class: 'lr-codex-head' }, 'CODEX · Regulations of the Storm Works'),
      h(
        'div',
        { class: 'lr-codex-spread' },
        ...shown.map((p, i) => this.page(p, this.spread * 2 + i + 1, fresh.includes(p.gem))),
      ),
      nav,
      close,
    );
    close.focus();
  }

  private page(p: CodexPage, folio: number, isNew: boolean): HTMLElement {
    const title = h(
      'h3',
      null,
      p.unlocked ? p.name : '— — —',
      h('small', null, p.unlocked ? 'Rune gem' : `Taught by the ${p.taughtBy?.name ?? '?'}`),
      isNew ? h('span', { class: 'lr-new' }, 'NEW') : null,
    );
    const niche = h(
      'div',
      {
        class: `lr-niche${p.unlocked ? '' : ' lr-niche--locked'}`,
        style: { '--gem': p.colour },
        'aria-hidden': 'true',
      },
      p.unlocked ? h('div', { class: 'lr-gem' }) : h('div', { class: 'lr-padlock' }),
    );
    const body = p.unlocked
      ? [h('p', { class: 'lr-codex-rule' }, p.rule), h('div', { class: 'lr-codex-maths' }, p.maths)]
      : [
          h(
            'p',
            { class: 'lr-codex-locked' },
            `An empty niche, chained shut. Restore the ${p.taughtBy?.name ?? 'right machine'} to earn this gem.`,
          ),
        ];
    const margin =
      p.unlocked && p.note
        ? h(
            'aside',
            { class: 'lr-margin', 'aria-label': 'FUSE’s note' },
            h('b', null, 'FUSE'),
            p.note,
          )
        : h('aside', { class: 'lr-margin' });
    return h(
      'section',
      { class: 'lr-codex-page', dataset: { gem: p.gem, locked: String(!p.unlocked) } },
      title,
      niche,
      ...body,
      margin,
      h('div', { class: 'lr-codex-folio' }, `— ${folio} —`),
    );
  }
}
