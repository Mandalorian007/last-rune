/**
 * FUSE's corner card: glue between content lines and engine/ui's caption card.
 *
 * - Lines over 20 words are shown as several cards (`cardsOf`, D-015).
 * - `say(…, { interrupt: true })` drops whatever he was saying (hover changes).
 * - The portrait is a hook: art-props' FUSE portrait swaps in via `setPortrait`.
 *   Until then a CSS placeholder (brass disc, one amber eye) stands in.
 */

import type { CaptionCard } from '@engine/ui';
import { h } from '@engine/ui';
import { cardsOf, type FuseLine } from '../content/lines';

export type PortraitFactory = () => Node;

export interface FuseOptions {
  /** Called per revealed character (e.g. a quiet blip); throttled to every 3rd. */
  onChar?: () => void;
}

export function placeholderPortrait(): Node {
  return h(
    'div',
    { class: 'lr-fuse-portrait', 'aria-hidden': 'true' },
    h('div', { class: 'lr-fuse-eye lr-fuse-eye--live' }),
    h('div', { class: 'lr-fuse-eye lr-fuse-eye--dead' }),
  );
}

export class Fuse {
  private portraitFactory: PortraitFactory = placeholderPortrait;
  private lastId: string | null = null;

  constructor(
    private readonly caption: CaptionCard,
    private readonly opts: FuseOptions = {},
  ) {}

  /** Art swap-in point for the animated portrait. */
  setPortrait(factory: PortraitFactory): void {
    this.portraitFactory = factory;
  }

  /** Id (or text) of the line most recently started. */
  get last(): string | null {
    return this.lastId;
  }

  get speaking(): boolean {
    return this.caption.busy;
  }

  /**
   * Say a content line (or raw text). Resolves when every card has gone.
   * `interrupt` clears the queue first. `hold: 0` waits for a click.
   */
  async say(
    line: FuseLine | string,
    opts: { interrupt?: boolean; hold?: number } = {},
  ): Promise<void> {
    const text = typeof line === 'string' ? line : line.text;
    if (opts.interrupt) this.caption.clear();
    this.lastId = typeof line === 'string' ? line : line.id;
    let n = 0;
    const onChar = this.opts.onChar
      ? () => {
          if (n++ % 3 === 0) this.opts.onChar!();
        }
      : undefined;
    const cards = cardsOf(text);
    const portrait = this.portraitFactory();
    await Promise.all(
      cards.map((card) =>
        this.caption.say(card, { speaker: 'FUSE', portrait, onChar, hold: opts.hold }),
      ),
    );
  }

  /** True if this line is the one on screen or queued last. */
  isSaying(line: FuseLine | string): boolean {
    const id = typeof line === 'string' ? line : line.id;
    return this.caption.busy && this.lastId === id;
  }

  hush(): void {
    this.caption.clear();
    this.lastId = null;
  }
}
