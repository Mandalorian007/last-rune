/**
 * The codex: a leather tome (CSS) laid over whatever scene is running. One page per gem, two
 * pages per spread. A page opens the first time the player sees its gem at an altar (fixed on
 * the board or in the tray), marked "Seen" until the gem is earned, then "Yours". Open pages
 * show the gem as it looks on the altar (rendered by the real gem material, see
 * `art/gem-portraits.ts`) with the bolt drawn going in and out, the rule, the maths and FUSE's
 * margin note. Gems not met yet are a chained niche.
 *
 * Keys inside the book: ←/→ turn the spread, Esc closes (engine/ui panel stack).
 */
import { button, h, type PanelHandle, type PanelStack } from '@engine/ui';
import type { GameSave } from '../game/save';
import { markCodexSeen, metGems, progressOf } from '../game/save';
import type { GemKind } from '../rules/types';
import { type CodexPage, codexPages } from './codex-data';
import { chipAt, diagramSvg, fizzleAt, GEM_DIAGRAMS } from './codex-diagram';

/** Source of gem pictures (`art/gem-portraits.ts`); a CSS gem stands in without one. */
export interface GemPictures {
  canvas(gem: GemKind, cssPx: number): HTMLCanvasElement | null;
}

/** Design-px size of the gem plate (the overlay scales it with the window). */
const PLATE_PX = 280;

export interface CodexOptions {
  readonly panels: PanelStack;
  readonly save: GameSave;
  /** Page-turn / open sound hook. */
  readonly onTurn?: () => void;
  /** Book open / close sound hooks. */
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
  /** Real gem pictures. Without it (tests, no GPU) the page shows a CSS stand-in. */
  readonly pictures?: GemPictures;
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
    return codexPages(progressOf(d), d.codex.seen, metGems(d));
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
            'aria-label': navLabel(p, i),
            dataset: { status: p.status },
            on: {
              click: () => {
                this.spread = Math.floor(i / 2);
                this.draw(book);
                this.opts.onTurn?.();
              },
            },
          },
          h('span', { class: 'lr-dot', style: { '--gem': p.colour } }),
          p.unlocked ? p.name : '?',
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
    // A page that runs past its foot says so (phones fade its foot until it is scrolled down).
    for (const page of book.querySelectorAll<HTMLElement>('.lr-codex-page')) {
      const sync = () =>
        page.toggleAttribute(
          'data-more',
          page.scrollHeight - page.clientHeight - page.scrollTop > 2,
        );
      page.addEventListener('scroll', sync, { passive: true });
      requestAnimationFrame(sync);
    }
    close.focus();
  }

  private page(p: CodexPage, folio: number, isNew: boolean): HTMLElement {
    const badge =
      p.status === 'yours'
        ? h('span', { class: 'lr-status', dataset: { status: 'yours' } }, 'Yours')
        : p.status === 'seen'
          ? h('span', { class: 'lr-status', dataset: { status: 'seen' } }, 'Seen')
          : h('span', { class: 'lr-status', dataset: { status: 'unknown' } }, 'Not met yet');
    const sub =
      p.status === 'yours'
        ? p.gem === 'channel'
          ? 'In your tray from the start.'
          : `In your tray. Earned at the ${p.taughtBy?.name ?? '?'}.`
        : p.status === 'seen'
          ? `Seen at an altar. Restore the ${p.taughtBy?.name ?? '?'} to earn it.`
          : 'Opens when you first see this gem at an altar.';
    const title = h(
      'h3',
      null,
      p.unlocked ? p.name : '— — —',
      badge,
      isNew ? h('span', { class: 'lr-new' }, 'NEW') : null,
    );
    const status = h('p', { class: 'lr-codex-status', dataset: { status: p.status } }, sub);
    const art = p.unlocked ? this.figure(p) : this.chained();
    const body = p.unlocked
      ? [h('p', { class: 'lr-codex-rule' }, p.rule), h('div', { class: 'lr-codex-maths' }, p.maths)]
      : [];
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
      {
        class: 'lr-codex-page',
        dataset: { gem: p.gem, locked: String(!p.unlocked), status: p.status },
      },
      title,
      status,
      art,
      ...body,
      margin,
      h('div', { class: 'lr-codex-folio' }, `— ${folio} —`),
    );
  }

  /** The gem as it sits on the altar, with the bolt going in and out of it. */
  private figure(p: CodexPage): HTMLElement {
    const d = GEM_DIAGRAMS[p.gem];
    const pic = this.opts.pictures?.canvas(p.gem, PLATE_PX) ?? null;
    if (pic) pic.className = 'lr-plate-gem';
    const gem = pic ?? h('div', { class: 'lr-plate-gem lr-plate-gem--css' });
    const bolt = h('div', { class: 'lr-plate-bolt' });
    bolt.innerHTML = diagramSvg(d);
    const chip = (side: Parameters<typeof chipAt>[0], charge: string, kind: 'in' | 'out') => {
      const at = chipAt(side);
      return h(
        'span',
        {
          class: 'lr-plate-chip',
          dataset: { kind },
          style: { left: `${at.left}%`, top: `${at.top}%` },
        },
        charge,
      );
    };
    return h(
      'div',
      {
        class: 'lr-plate',
        role: 'img',
        'aria-label': `${p.name}. ${d.alt}`,
        style: { '--gem': p.colour },
        dataset: { real: String(pic !== null) },
      },
      gem,
      bolt,
      ...d.ins.map((a) => chip(a.side, a.charge, 'in')),
      ...d.outs.map((a) => chip(a.side, a.charge, 'out')),
      ...d.fizzle.map((side) => {
        const at = fizzleAt(side);
        return h('span', {
          class: 'lr-plate-nogo',
          style: { left: `${at.left}%`, top: `${at.top}%` },
        });
      }),
    );
  }

  /** A gem not met yet: an empty niche, chained shut. */
  private chained(): HTMLElement {
    return h(
      'div',
      { class: 'lr-niche lr-niche--locked', 'aria-hidden': 'true' },
      h('div', { class: 'lr-padlock' }),
    );
  }
}

function navLabel(p: CodexPage, i: number): string {
  if (p.status === 'yours') return `${p.name}, yours`;
  if (p.status === 'seen') return `${p.name}, seen, not yours yet`;
  return `Page ${i + 1}, not met yet`;
}
