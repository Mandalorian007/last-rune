/**
 * The community hangout beyond the door (D-038): a Discord-like chat window drawn in the
 * game's own style (slate panels, gold edges), playing `HANGOUT_SCRIPT` from content.
 *
 * - The sidebar is the star: the server's real channel list, with unread pips lighting up
 *   as the server notices FUSE, and his face beside whichever channel he is in.
 * - FUSE types into the message bar, then sends. Members post after "… is typing".
 * - Reactions are real emoji (system text glyphs, colour-emoji font stack) whose counts tick up.
 * - The window is hidden from screen readers; `summary` is announced instead (two lines).
 *
 * Pure DOM plus FUSE's procedural portrait. Waits come from the ending's scene clock, so
 * skip/exit cancel it through `live()`.
 */
import { h } from '@engine/ui';
import type { FusePortrait } from '../../art/props/fuse-portrait';
import {
  type ChannelId,
  HANGOUT_CATEGORY,
  HANGOUT_CHANNELS,
  HANGOUT_COPY,
  HANGOUT_HISTORY,
  HANGOUT_MEMBERS,
  HANGOUT_SERVER,
  HANGOUT_START,
  type HangoutStep,
  type MemberId,
} from '../../content/ending';
import { emojiRuns, fusePostText, HANGOUT_TIMING, hangoutCps } from './ending-model';

export interface HangoutHost {
  /** Scene-time wait. */
  wait(seconds: number): Promise<void>;
  /** Scene time, seconds. */
  now(): number;
  /** False once the ending was skipped or left. */
  live(): boolean;
  readonly reducedMotion: boolean;
  /** Caption speed, chars/s (0 = instant). */
  readonly captionCps: number;
  /** FUSE's voice for one post, per typed character. */
  voice(text: string): ((ch: string, index: number) => void) | undefined;
  /** A gentle pop (a message lands, a reaction appears). */
  pop(kind: 'message' | 'react'): void;
  readonly portrait: FusePortrait;
}

interface Chip {
  readonly count: HTMLElement;
  shown: number;
  target: number;
  acc: number;
}

/** Text with each emoji wrapped so it wears the colour-emoji font stack. */
function richText(text: string): Node[] {
  return emojiRuns(text).map((r) =>
    r.emoji ? h('span', { class: 'lr-emo' }, r.text) : document.createTextNode(r.text),
  );
}

export class Hangout {
  readonly el: HTMLElement;
  private readonly host: HangoutHost;
  private readonly rows = new Map<ChannelId, HTMLElement>();
  private readonly logs = new Map<ChannelId, HTMLElement>();
  private readonly msgs = new Map<string, HTMLElement>();
  private readonly chips = new Map<string, Chip>();
  private readonly list: HTMLElement;
  private readonly here: HTMLElement;
  private readonly logsEl: HTMLElement;
  private readonly topEl: HTMLElement;
  private readonly compose: HTMLElement;
  private readonly composeText: HTMLElement;
  private readonly typingEl: HTMLElement;
  /** Phones (D-040): the conversation header's ‹, with a count of channels holding unread posts. */
  private readonly badgeEl: HTMLElement;
  private channel: ChannelId = HANGOUT_START;
  private talking = false;
  private portraitClock = 0;

  constructor(host: HangoutHost) {
    this.host = host;
    // Server rail: just ThunderClap Gaming's own badge.
    const rail = h(
      'div',
      { class: 'lr-hg-rail' },
      h('div', { class: 'lr-hg-badge' }, h('span', { class: 'lr-emo' }, '⚡')),
    );
    this.list = h(
      'div',
      { class: 'lr-hg-list' },
      h('div', { class: 'lr-hg-cat' }, h('span', { class: 'lr-hg-caret' }, '▾'), HANGOUT_CATEGORY),
    );
    for (const c of HANGOUT_CHANNELS) {
      const row = h(
        'div',
        { class: 'lr-hg-ch', dataset: { ch: c.id } },
        h('i', { class: 'lr-hg-pip' }),
        h('span', { class: 'lr-hg-hash' }, '#'),
        h('span', { class: 'lr-emo' }, c.emoji),
        h('span', { class: 'lr-hg-name' }, c.name),
      );
      this.rows.set(c.id, row);
      this.list.append(row);
    }
    // FUSE's face beside the channel he is in: the live portrait.
    host.portrait.canvas.classList.add('lr-hg-face');
    this.here = h('div', { class: 'lr-hg-here' }, host.portrait.canvas);
    this.list.append(this.here);
    const side = h(
      'div',
      { class: 'lr-hg-side' },
      h('div', { class: 'lr-hg-server' }, HANGOUT_SERVER),
      this.list,
    );
    this.topEl = h('div', { class: 'lr-hg-top' });
    this.badgeEl = h('span', { class: 'lr-hg-badge-count' });
    this.logsEl = h('div', { class: 'lr-hg-logs' });
    this.composeText = h('span', { class: 'lr-hg-draft' });
    this.compose = h(
      'div',
      { class: 'lr-hg-compose' },
      h('span', { class: 'lr-hg-placeholder' }),
      this.composeText,
      h('span', { class: 'lr-hg-caret-bar' }),
    );
    this.typingEl = h('div', { class: 'lr-hg-typing' });
    const main = h(
      'div',
      { class: 'lr-hg-main' },
      this.topEl,
      this.logsEl,
      this.compose,
      this.typingEl,
    );
    this.el = h('div', { class: 'lr-hg', 'aria-hidden': 'true' }, rail, side, main);
    if (host.reducedMotion) this.el.dataset.still = '';
  }

  /** Open the window (fades in) on the first channel. */
  open(): void {
    this.show(HANGOUT_START);
    requestAnimationFrame(() => this.el.setAttribute('data-in', ''));
  }

  /** Fold the window back into the light. */
  close(): void {
    this.el.setAttribute('data-out', '');
    this.talking = false;
  }

  /** Play the script. Resolves early (quietly) if the ending is skipped. */
  async play(steps: readonly HangoutStep[]): Promise<void> {
    const host = this.host;
    const T = HANGOUT_TIMING;
    await host.wait(T.open);
    for (const st of steps) {
      if (!host.live()) return;
      switch (st.type) {
        case 'wait':
          await host.wait(st.seconds);
          break;
        case 'go':
          this.show(st.channel);
          await host.wait(T.go);
          break;
        case 'join':
          this.system(st.key, h('span', { class: 'lr-hg-arrow' }, '→'), ...this.boldName(st.text));
          host.pop('message');
          await host.wait(T.afterPost);
          break;
        case 'fuse':
          await this.fusePost(st);
          break;
        case 'post':
          this.typingEl.textContent = '';
          this.typingEl.append(
            h('span', { class: 'lr-hg-dots' }, h('i'), h('i'), h('i')),
            h('b', null, HANGOUT_MEMBERS[st.who].name),
            ` ${HANGOUT_COPY.isTyping}…`,
          );
          await host.wait(T.memberTyping);
          if (!host.live()) return;
          this.typingEl.textContent = '';
          this.message(st.who, st.text, st.key);
          host.pop('message');
          await host.wait(T.afterPost);
          break;
        case 'react':
          this.react(st.key, st.emoji, st.count);
          host.pop('react');
          await host.wait(T.afterReact);
          break;
        case 'unread':
          for (const c of st.channels) if (c !== this.channel) this.unread(c);
          break;
        case 'pin': {
          this.msgs.get(st.key)?.setAttribute('data-pinned', '');
          this.system(
            `${st.key}-pin`,
            h('span', { class: 'lr-emo lr-hg-arrow' }, '📌'),
            h('b', null, HANGOUT_MEMBERS[st.by].name),
            ` ${st.text}`,
          );
          host.pop('message');
          await host.wait(T.afterPost);
          break;
        }
      }
      this.fitStart();
    }
  }

  /** Per frame: reaction counts tick up; FUSE's face stays alive (about 30 Hz). */
  update(dt: number): void {
    for (const c of this.chips.values()) {
      if (c.shown >= c.target) continue;
      c.acc += dt;
      // Every count arrives in about a second, a small one a tick at a time.
      const step = Math.min(0.22, 1.0 / c.target);
      while (c.acc >= step && c.shown < c.target) {
        c.acc -= step;
        c.shown++;
      }
      c.count.textContent = String(c.shown);
    }
    this.portraitClock += dt;
    if (this.portraitClock >= 1 / 30 && !this.el.hasAttribute('data-out')) {
      this.portraitClock = 0;
      this.host.portrait.render(undefined, this.talking);
    }
  }

  destroy(): void {
    this.el.remove();
  }

  // ── Steps ────────────────────────────────────────────────────────────────

  private show(id: ChannelId): void {
    this.rows.get(this.channel)?.removeAttribute('data-on');
    this.channel = id;
    const row = this.rows.get(id)!;
    row.setAttribute('data-on', '');
    row.removeAttribute('data-unread');
    const ch = HANGOUT_CHANNELS.find((c) => c.id === id)!;
    // On phones the header is all the chrome there is (D-040): the channel, the server, and a
    // plain count of other channels with news (information only: nothing here is a control).
    this.topEl.replaceChildren(
      h('span', { class: 'lr-hg-hash' }, '#'),
      h('span', { class: 'lr-emo' }, ch.emoji),
      h('span', { class: 'lr-hg-top-name' }, ch.name),
      h('span', { class: 'lr-hg-top-server' }, HANGOUT_SERVER),
      this.badgeEl,
    );
    (this.compose.firstChild as HTMLElement).textContent =
      `${HANGOUT_COPY.messagePrefix}${ch.name}`;
    let log = this.logs.get(id);
    if (!log) {
      log = h(
        'div',
        { class: 'lr-hg-log', dataset: { ch: id } },
        // The start of the channel (phones show it; it scrolls away as the chat fills).
        h(
          'div',
          { class: 'lr-hg-start' },
          h('span', { class: 'lr-hg-start-emo' }, h('span', { class: 'lr-emo' }, ch.emoji)),
          h('b', null, h('span', { class: 'lr-hg-hash' }, '#'), ch.name),
        ),
      );
      this.logs.set(id, log);
      this.logsEl.append(log);
      for (const p of HANGOUT_HISTORY[id] ?? []) log.append(this.messageEl(p.who, p.text, true));
    }
    for (const [cid, l] of this.logs) l.hidden = cid !== id;
    this.here.style.top = `${row.offsetTop + row.offsetHeight / 2}px`;
    this.countUnread(false);
    this.fitStart();
  }

  /**
   * Phones: a channel's start block shows only while the whole conversation fits under it, so
   * it never peeks out half-cut at the top (it is display:none elsewhere, so this is a no-op).
   */
  private fitStart(): void {
    const log = this.logs.get(this.channel);
    const start = log?.firstElementChild as HTMLElement | null | undefined;
    if (!log || !start?.classList.contains('lr-hg-start')) return;
    start.hidden = false;
    if (!start.offsetHeight) return;
    const cs = getComputedStyle(log);
    let used = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    for (const el of log.children) {
      const m = getComputedStyle(el);
      used +=
        (el as HTMLElement).offsetHeight + parseFloat(m.marginTop) + parseFloat(m.marginBottom);
    }
    // The auto margin under the block reads as 0 once there is no room left.
    start.hidden = used > log.clientHeight + 0.5;
  }

  /** The ‹'s badge: how many other channels have something new. */
  private countUnread(ping: boolean): void {
    let n = 0;
    for (const r of this.rows.values()) if (r.hasAttribute('data-unread')) n++;
    this.badgeEl.textContent = n ? String(n) : '';
    if (!ping) return;
    this.badgeEl.removeAttribute('data-ping');
    void this.badgeEl.offsetWidth;
    this.badgeEl.setAttribute('data-ping', '');
  }

  private unread(id: ChannelId): void {
    const row = this.rows.get(id);
    if (!row) return;
    row.setAttribute('data-unread', '');
    // Re-trigger the pip's ping.
    row.removeAttribute('data-ping');
    void row.offsetWidth;
    row.setAttribute('data-ping', '');
    this.countUnread(true);
  }

  private async fusePost(st: Extract<HangoutStep, { type: 'fuse' }>): Promise<void> {
    const host = this.host;
    const T = HANGOUT_TIMING;
    const text = fusePostText(st);
    const cps = hangoutCps(host.captionCps);
    this.compose.setAttribute('data-typing', '');
    this.talking = true;
    if (cps > 0) {
      const chars = [...text];
      const voice = host.voice(text);
      const t0 = host.now();
      let shown = 0;
      while (shown < chars.length) {
        await host.wait(0);
        if (!host.live()) return;
        const want = Math.min(chars.length, Math.floor((host.now() - t0) * cps) + 1);
        for (; shown < want; shown++) voice?.(chars[shown]!, shown);
        this.composeText.textContent = chars.slice(0, shown).join('');
      }
    } else {
      this.composeText.textContent = text;
    }
    await host.wait(T.beforeSend);
    if (!host.live()) return;
    this.talking = false;
    this.composeText.textContent = '';
    this.compose.removeAttribute('data-typing');
    const msg = this.message('fuse', text, st.key);
    if (st.form) {
      msg
        .querySelector('.lr-hg-body')
        ?.insertBefore(
          h(
            'div',
            { class: 'lr-hg-form' },
            h('small', null, HANGOUT_COPY.formTitle),
            ...st.form.map(([k, v]) => h('p', null, h('span', null, `${k}:`), ` ${v}`)),
          ),
          msg.querySelector('.lr-hg-reacts'),
        );
      this.fitStart();
    }
    host.pop('message');
    await host.wait(T.afterFuse);
  }

  private message(who: MemberId, text: string, key?: string): HTMLElement {
    const el = this.messageEl(who, text, false);
    this.logs.get(this.channel)?.append(el);
    if (key) this.msgs.set(key, el);
    this.fitStart();
    return el;
  }

  private messageEl(who: MemberId, text: string, old: boolean): HTMLElement {
    const m = HANGOUT_MEMBERS[who];
    const av =
      who === 'fuse'
        ? h('div', { class: 'lr-hg-av lr-hg-av-fuse' }, this.fuseFace())
        : h(
            'div',
            {
              class: 'lr-hg-av',
              style: { '--hue': String(m.hue) },
            },
            h('span', { class: 'lr-emo' }, m.emoji),
          );
    return h(
      'div',
      { class: 'lr-hg-msg', dataset: { who, ...(old ? { old: '' } : {}) } },
      av,
      h(
        'div',
        { class: 'lr-hg-body' },
        h(
          'div',
          { class: 'lr-hg-meta' },
          h('b', null, m.name),
          h('small', null, HANGOUT_COPY.today),
        ),
        h('p', { class: 'lr-hg-text' }, ...richText(text)),
        h('div', { class: 'lr-hg-reacts' }),
      ),
    );
  }

  private system(key: string, ...parts: (Node | string)[]): void {
    const el = h('div', { class: 'lr-hg-sys' }, ...parts);
    // A join notice can take reactions like any message.
    el.append(h('div', { class: 'lr-hg-reacts' }));
    this.logs.get(this.channel)?.append(el);
    this.msgs.set(key, el);
    this.fitStart();
  }

  /** "FUSE came through the door…" with his name in bold. */
  private boldName(text: string): (Node | string)[] {
    const name = HANGOUT_MEMBERS.fuse.name;
    const i = text.indexOf(name);
    if (i < 0) return [text];
    return [text.slice(0, i), h('b', null, name), text.slice(i + name.length)];
  }

  private react(key: string, emoji: string, count: number): void {
    const msg = this.msgs.get(key);
    const bar = msg?.querySelector('.lr-hg-reacts');
    if (!bar) return;
    const id = `${key}:${emoji}`;
    let chip = this.chips.get(id);
    if (!chip) {
      const countEl = h('span', { class: 'lr-hg-count' }, '1');
      bar.append(
        h('span', { class: 'lr-hg-react' }, h('span', { class: 'lr-emo' }, emoji), countEl),
      );
      chip = { count: countEl, shown: 1, target: 1, acc: 0 };
      this.chips.set(id, chip);
    }
    chip.target = Math.max(chip.target, count);
    this.fitStart();
  }

  /** A still copy of FUSE's face for a message avatar (the live one is in the sidebar). */
  private fuseFace(): HTMLCanvasElement {
    const src = this.host.portrait.canvas;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.className = 'lr-hg-face';
    this.host.portrait.render(undefined, false);
    c.getContext('2d')?.drawImage(src, 0, 0);
    return c;
  }
}
