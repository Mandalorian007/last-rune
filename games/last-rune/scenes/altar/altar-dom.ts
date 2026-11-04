/**
 * The altar's DOM: built once per layout, refreshed as the board changes.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
 */
import { button, h } from '@thunderclap/engine/ui';
import { GEM_COLOUR } from '../../art/props/palette';
import { isRotational, stormCharge } from '../../rules';
import { getMachine } from '../../rules/progression';
import { CSS_PALETTE } from '../../ui/styles';
import { type AltarColumn, placeAltarChrome } from './altar-chrome';
import { GEM_NAME, type HintMode, hintLine, SVG_NS, timesWord } from './altar-defs';
import type { AltarScene } from './altar-scene';
import { TRAY_CENTER_X } from './layout';
import { type HintSlot, LAMP_LINE, phoneHint, pickHint } from './moments';
import { keepTogether } from './nowrap';

export const domMethods = {
  /**
   * The key-hint line says only what applies now: the mouse controls, the keyboard controls
   * once the player uses keys, or fast-forward while the bolt runs.
   */
  updateHint(this: AltarScene): void {
    let mode: HintMode =
      this.mode === 'strike'
        ? this.touch
          ? 'touchStrike'
          : 'strike'
        : this.keyboard
          ? 'keys'
          : this.touch
            ? 'touch'
            : 'mouse';
    // Phones: the line says the next tap, and retires once the tap is known (moments.ts).
    if (mode === 'touch' && this.view.layout.phone)
      mode = phoneHint(this.hintRetired, !!this.hand && !this.hand.from);
    // Only mention ↻ where a gem can turn (the Turn button shows only then). Phones say it
    // only while the Turn button is up, so the line stays one short line.
    const turns = this.view.layout.phone
      ? this.turnTarget !== null
      : this.view.layout.tray.some((t) => isRotational(t.gem));
    // Phones: another workstream's line ("Holding: X") may stand in
    // the slot (moments.ts HINT_SLOTS); the strike's own line always wins.
    const slot =
      this.view.layout.phone && mode !== 'touchStrike'
        ? pickHint({ ...this.hintLines, howto: null })
        : null;
    const other = slot ? (this.hintLines[slot] ?? '') : '';
    const key = other ? `slot:${other}` : `${mode}${turns ? '+' : ''}`;
    if (key === this.hintMode) return;
    this.hintMode = key;
    if (other) {
      // teach-4: the gauge-dot line starts with the dot it explains, lit as on the gauge.
      const dot =
        slot === 'lamp'
          ? h('i', {
              class: 'lr-need-lamp',
              'data-on': '',
              'data-red': String(other === LAMP_LINE.over),
              'aria-hidden': 'true',
            })
          : null;
      this.hint.replaceChildren(...(dot ? [dot] : []), keepTogether(other));
      this.hint.dataset.mode = 'slot';
      this.avoidTray();
      return;
    }
    this.hint.replaceChildren(...hintLine(mode, turns));
    // Phones: one line inside the column, never cut. Too long? The ↻ clause goes first.
    if (turns && this.view.layout.phone && this.hint.scrollWidth > this.hint.clientWidth + 1)
      this.hint.replaceChildren(...hintLine(mode, false));
    this.hint.dataset.mode = mode;
    this.avoidTray();
  },

  /**
   * Phones: put a line in the how-to slot under the tray, or clear it with `null`. The slot
   * shows one line, in `HINT_SLOTS` order ('holding' first, then the how-to line), and the
   * column arbiter (`arrangeColumn`) gives it room after the verdict, the teach card and a
   * gem's tip, before FUSE. For mobile-6-board ("Holding: X"); off phones it is ignored.
   */
  setHintLine(this: AltarScene, slot: Exclude<HintSlot, 'howto'>, text: string | null): void {
    if ((this.hintLines[slot] ?? null) === text) return;
    this.hintLines[slot] = text;
    this.updateHint();
  },

  buildDom(this: AltarScene): void {
    const L = this.view.layout;
    const btn = (
      label: string,
      key: string,
      fn: () => void,
      gold = false,
      action = '',
      icon = '',
    ) => {
      const b = button(
        h(
          'span',
          null,
          // Phones only (CSS): an icon over the word, for the narrow edge columns.
          icon ? h('i', { class: 'lr-ph-ico', 'aria-hidden': 'true' }, icon) : null,
          label,
          h('kbd', { 'aria-hidden': 'true' }, key),
        ),
        (e) => {
          (e.currentTarget as HTMLElement).blur();
          this.ctx.sound.sfx.play('uiClick');
          fn();
        },
        { className: gold ? 'lr-gold-button' : 'lr-stone-button', ariaLabel: `${label} (${key})` },
      );
      b.setAttribute('aria-keyshortcuts', key);
      if (action) b.dataset.action = action;
      return b;
    };
    this.undoBtn = btn('Undo', 'Z', () => this.undo(), false, 'undo', '\u21b6');
    this.clearBtn = btn('Clear', 'Del', () => this.clear(), false, 'clear', '\u2715');
    this.strikeBtn = btn('Strike', 'F', () => this.strike(), true, 'strike');
    // The word in its own span, so phones can say what a tap will do (`setStrikeWord`).
    const inner = this.strikeBtn.firstElementChild;
    const word = [...(inner?.childNodes ?? [])].find((n) => n.nodeType === Node.TEXT_NODE);
    this.strikeWord = h('span', { class: 'lr-strike-word' }, 'Strike');
    if (word) word.replaceWith(this.strikeWord);
    const back = btn('Back', 'Esc', () => this.back(), false, 'back', '\u2190');
    this.backBtn = back;
    this.subtitle = h('small');
    this.holdingEl = h('span', { class: 'lr-altar-holding', 'aria-hidden': 'true', hidden: true });
    // The visible verdict is not a live region: it is unhidden and filled in the same frame,
    // which screen readers miss. `announcer` speaks it (and the needs) instead.
    this.verdict = h('div', {
      class: 'lr-altar-verdict',
      hidden: true,
      style: { left: `${L.titleX}px`, maxWidth: `${L.titleMax}px` },
    });
    if (L.titleMax < 600) this.verdict.dataset.narrow = '';
    this.announcer = h('div', {
      class: 'tc-sr-only lr-altar-announce',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
    // The info card is read through the announcer (on focus), not as a live tooltip.
    this.tip = h('div', { class: 'lr-altar-tip', 'aria-hidden': 'true', hidden: true });
    this.turnBadge = h(
      'div',
      { class: 'lr-altar-turn', 'aria-hidden': 'true', hidden: true },
      h('span', { class: 'lr-turn-arrow' }, '\u21bb'),
    );
    this.turnBtn = button(
      h('span', null, h('b', { 'aria-hidden': 'true' }, '\u21bb'), ' Turn'),
      (e) => {
        (e.currentTarget as HTMLElement).blur();
        this.turnTapped();
      },
      { className: 'lr-altar-turnbtn lr-touch-only', ariaLabel: 'Turn the gem (R)' },
    );
    this.turnBtn.hidden = true;
    this.turnShown = null;
    // Docked just right of the tray, so it never covers a socket the player may tap next.
    // Phones: at the foot of the left rail instead (altar-chrome.ts).
    if (!L.phone) {
      const trayRight = Math.max(...L.tray.map((s) => s.x), TRAY_CENTER_X);
      this.turnBtn.style.left = `${trayRight + 80}px`;
      this.turnBtn.style.top = `${L.trayY}px`;
    }
    // altar-truth: phones mark Turn's target too (its own class: a small \u21bb on the gem's corner).
    this.turnMark = h(
      'div',
      {
        class: `${L.phone ? 'lr-turn-target' : 'lr-altar-turnmark'} lr-touch-only`,
        'aria-hidden': 'true',
        hidden: true,
      },
      '\u21bb',
    );
    this.counts = L.tray.map((s) =>
      h('div', {
        class: 'lr-altar-count',
        // Bigger text lifts the count up the gem so the hint line below stays clear.
        style: {
          left: `${s.x}px`,
          top: L.phone
            ? `${Math.round(s.y + s.size / 2 + L.phone.cssPx)}px`
            : `calc(${s.y + 40}px - (var(--tc-text-scale, 1) - 1) * 50px)`,
        },
      }),
    );
    // Need labels sit against their machine: beside it for N/S machines (below would hit the
    // board or the tray), under the cabinet for E/W.
    this.needs = L.machines.map((m) =>
      h('div', {
        class: 'lr-altar-need',
        'data-align': m.label.align,
        style: { left: `${m.label.x}px`, top: `${m.label.y}px` },
      }),
    );
    // The storm says what it gives, in the same card as the machines' needs, so "Gives 4" and
    // "Needs 4" read as one quantity before anything is placed.
    this.stormLabel = h(
      'div',
      {
        class: 'lr-altar-need lr-altar-storm',
        'data-align': L.storm.label.align,
        style: { left: `${L.storm.label.x}px`, top: `${L.storm.label.y}px` },
      },
      h(
        'span',
        { class: 'lr-need-row' },
        'Gives\u00a0',
        h('b', null, String(stormCharge(this.puzzle.storm.strength))),
      ),
    );
    // A multi-strike altar says so at the storm and on Strike, one pip per strike; the pips
    // light as each strike fires.
    const pulses = this.puzzle.pulses;
    if (pulses > 1) {
      const pips = () =>
        h(
          'span',
          { class: 'lr-strike-pips', 'aria-hidden': 'true' },
          ...Array.from({ length: pulses }, () => h('i')),
        );
      const stormPips = pips();
      this.strikeRow = h('span', { class: 'lr-storm-strikes' });
      this.stormLabel.append(h('span', { class: 'lr-storm-row' }, stormPips, this.strikeRow));
      const btnPips = pips();
      this.strikeBtn.firstElementChild?.insertBefore(btnPips, this.strikeBtn.querySelector('kbd'));
      // Phones read the count as text: "twice" before, "1 of 2" while the strikes run.
      this.strikeCount = h('span', { class: 'lr-strike-n', 'aria-hidden': 'true' });
      this.strikeBtn.firstElementChild?.insertBefore(
        this.strikeCount,
        this.strikeBtn.querySelector('kbd'),
      );
      this.strikeBtn.setAttribute('aria-label', `Strike (F): one tap strikes ${timesWord(pulses)}`);
      this.strikePips = [...stormPips.children, ...btnPips.children] as HTMLElement[];
      this.setStrikeRow(-1);
    }
    this.titleEl = h(
      'div',
      { class: 'lr-altar-title', style: { left: `${L.titleX}px` } },
      h('h2', null, getMachine(this.machine).name),
      this.subtitle,
      this.holdingEl,
    );
    this.actionsEl = h(
      'div',
      { class: 'lr-altar-actions' },
      this.undoBtn,
      this.clearBtn,
      back,
      this.strikeBtn,
    );
    this.hint = h('div', { class: 'lr-altar-hint' });
    this.hintMode = '';
    this.dom = h(
      'div',
      { class: 'lr-altar', role: 'region', 'aria-label': `${getMachine(this.machine).name} altar` },
      this.titleEl,
      this.actionsEl,
      this.verdict,
      this.announcer,
      ...this.counts,
      ...this.needs,
      ...(this.stormLabel ? [this.stormLabel] : []),
      this.tip,
      this.turnBadge,
      this.turnMark,
      this.turnBtn,
      this.hint,
    );
    this.dom.toggleAttribute('data-first', !!this.teachCell);
    this.dom.toggleAttribute('data-picked', this.picked);
    const band = L.phone;
    this.dom.toggleAttribute('data-phone', !!band);
    let col: AltarColumn | null = null;
    if (band) {
      // port-altar-3: the column right of the board is a region on the CSS-px chrome
      // (altar-chrome.ts). Its head holds the title and the tray's slots and counts, over the
      // gems the canvas draws at `L.tray` (placeHead lines them up); the cards stack under it.
      this.verdict.style.left = '';
      this.verdict.style.maxWidth = '';
      delete this.verdict.dataset.narrow;
      this.lane = h('div', { class: 'lr-altar-lane' }, this.tip, this.verdict, this.hint);
      this.slotEls = L.tray.map(() => h('div', { class: 'lr-altar-slot', 'aria-hidden': 'true' }));
      this.head = h(
        'div',
        { class: 'lr-altar-head' },
        this.titleEl,
        ...this.slotEls,
        ...this.counts,
      );
      this.headKey = '';
      this.leader = document.createElementNS(SVG_NS, 'svg');
      this.leader.setAttribute('class', 'lr-teach-leader');
      this.leader.setAttribute('viewBox', '0 0 1920 1080');
      this.leader.setAttribute('aria-hidden', 'true');
      this.dom.append(this.leader);
      col = {
        head: this.head,
        cards: this.lane,
        caption: this.ctx.ui.caption,
        colL: band.colL,
        headB: band.laneTop,
      };
    }
    this.ctx.ui.layers.hud.append(this.dom);
    // Phones: the rail buttons in the chrome's rails, the column beside the board, and the
    // board in what they leave (altar-chrome.ts).
    this.offRails = placeAltarChrome(
      this.ctx.chrome,
      this.ctx.device,
      {
        back,
        undo: this.undoBtn,
        clear: this.clearBtn,
        turn: this.turnBtn,
        strike: this.strikeBtn,
      },
      col,
    );
    this.placeHead();
    // Dev/e2e handle: the layout in use (tests tap cells and slots by it on phones).
    if (import.meta.env.DEV) {
      Object.defineProperty(window, '__altarLayout', {
        configurable: true,
        get: () => this.view.layout,
      });
      Object.assign(window, { __altarView: this.view });
    }
  },

  refreshHud(this: AltarScene): void {
    const L = this.view.layout;
    L.tray.forEach((s, i) => {
      const el = this.counts[i]!;
      const n = this.board.remaining(s.gem);
      // A keycap for the hotkey, then the count apart from it: "1 ×6" must never read "16".
      el.replaceChildren(
        h('kbd', { class: 'lr-k' }, String(i + 1)),
        // Phones: a used-up gem stays as a dimmed silhouette with a "×0" badge (port-altar-3:
        // the same short badge in its own slot in every room, so nothing can cut it).
        h('span', { class: 'lr-n' }, `×${n}`),
      );
      if (L.phone) el.setAttribute('aria-label', n === 0 ? 'all placed' : `${n} left`);
      el.toggleAttribute('data-empty', n === 0);
      this.slotEls[i]?.toggleAttribute('data-empty', n === 0);
      const held = this.hand?.kind === s.gem && !this.hand.from;
      el.toggleAttribute('data-held', held);
      this.slotEls[i]?.toggleAttribute('data-held', held);
      el.title = GEM_NAME[s.gem];
    });
    const inHand = this.hand && !this.hand.from ? this.hand.kind : null;
    if (inHand && L.phone) {
      this.holdingEl.replaceChildren(
        h('i', { style: { color: CSS_PALETTE[GEM_COLOUR[inHand]] } }),
        'Holding ',
        h('b', null, GEM_NAME[inHand]),
      );
      this.holdingEl.hidden = false;
    } else this.holdingEl.hidden = true;
    this.titleEl.toggleAttribute('data-holding', !!inHand && !!L.phone);
    // Phones: the pill is in the column's head, a region apart from Menu's (altar-chrome.ts).
    this.puzzle.machines.forEach((m, i) => {
      const el = this.needs[i]!;
      if (this.mode === 'edit' || !this.result) {
        this.setNeed(i, m.need, null);
        el.removeAttribute('data-state');
      }
    });
    this.undoBtn.disabled = !this.board.canUndo || this.mode === 'strike';
    this.clearBtn.disabled = this.board.isEmpty || this.mode === 'strike';
    this.strikeBtn.disabled = this.mode === 'strike';
    if (this.mode === 'edit') {
      const p = this.puzzle.pulses;
      const s = this.puzzle.storm.strength;
      // Each part keeps its words together, so a wrap never strands "strikes" on its own.
      const parts = [`Storm ×${s} gives ${stormCharge(s)}`];
      if (p > 1) parts.push(`· ${p} strikes`);
      this.subtitle.replaceChildren(
        ...parts.flatMap((t, i) => [...(i ? [' '] : []), h('span', { class: 'lr-nowrap' }, t)]),
      );
    }
    this.fitTop();
  },
};
