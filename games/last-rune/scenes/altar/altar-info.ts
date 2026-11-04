/**
 * Teaching: the info and arrival cards, FUSE's gem lines and nudges.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
 */
import { button, h } from '@thunderclap/engine/ui';
import { createGemPortraits } from '../../art/gem-portraits';
import {
  CAP_CHIP_ONE,
  CAP_ONE_STRIKE,
  codexEntry,
  FIXED_NOTE,
  FIXED_NOTE_FULL,
  GATE_CHIP_ONE,
  GATE_RULE_ONE,
  YOURS_NOTE,
} from '../../content/codex';
import { gemNudge, TEACH_NUDGE } from '../../content/lines';
import { isRotational, stormCharge } from '../../rules';
import type { Cell, Dir, GemKind } from '../../rules/types';
import { chipAt, diagramSvg, fizzleAt, GEM_DIAGRAMS, turnSide } from '../../ui/codex-diagram';
import {
  AMPLIFY_AGAIN,
  AMPLIFY_ONCE,
  capacitorStrip,
  eitherName,
  eitherRule,
  GEM_NAME,
  GOAL_NAME,
  GOAL_RULE,
  INFO_TAG,
  INTRO_FADE,
  type InfoHow,
  RING_NAME,
  RING_RULE,
  strikesRule,
  TEACH_IDLE,
  TOUCH_CARD_SECS,
} from './altar-defs';
import type { AltarScene } from './altar-scene';
import { introButton, pickInfo } from './moments';
import { keepTogether } from './nowrap';
import { legalSockets } from './socket-looks';
import { strikeLabel } from './strike';
import {
  firstSentence,
  gateSides,
  hasPicture,
  type TeachPage,
  type TeachRow,
  teachPages,
  teachRows,
} from './teach';

/** teach-4: the in→out picture on a Gate's or Split's first card, CSS px square. */
const FIG_PX = 72;
/** The Capacitor's picture beside its two-strike strip: smaller, no number chips. */
const CAP_FIG_PX = 46;

export const infoMethods = {
  /** FUSE's nudge for a gem's first appearance (never interrupting). */
  speak(this: AltarScene, gem: GemKind): void {
    if (this.spoken.has(gem)) return;
    this.spoken.add(gem);
    const line = gemNudge(gem);
    if (line) void this.ctx.fuse.say(line);
  },

  /** Phones: FUSE's fail quip, once the verdict has gone (dropped if the player strikes again). */
  updateQuip(this: AltarScene): void {
    if (!this.pendingQuip) return;
    if (this.mode === 'strike') this.pendingQuip = null;
    else if (this.mode === 'edit' && this.verdict.hidden) {
      void this.ctx.fuse.say(this.pendingQuip, { interrupt: true });
      this.pendingQuip = null;
    }
  },

  /**
   * New-gem lines, one at a time, each when FUSE is free. A line is skipped once its gem is
   * in use: a new fixed gem the route already reaches (or has been struck through), a new tray
   * gem already on the board. The player who has it working needs no introduction.
   */
  updateNudges(this: AltarScene, dt: number): void {
    if (this.pendingNudges.length === 0) return;
    if (this.mode !== 'edit' || this.ctx.fuse.speaking) {
      this.quiet = 0;
      return;
    }
    this.quiet += dt;
    if (this.quiet < 0.6) return;
    const gem = this.pendingNudges.shift()!;
    if (!this.inUse(gem)) {
      this.speak(gem);
      this.quiet = 0;
    }
  },

  /** The player is already using `gem` here (see `updateNudges`). */
  inUse(this: AltarScene, gem: GemKind): boolean {
    const fixed = this.news.fixed.find((f) => f.gem === gem);
    if (fixed) {
      if (!this.teachFixed.some((f) => f.gem === gem)) return true;
      const c = fixed.cell;
      return (this.realPreview?.hops ?? []).some((q) => q.to.x === c.x && q.to.y === c.y);
    }
    return this.board.serialise().some((q) => q.gem === gem);
  },

  /**
   * The arrival card's pages on a phone (teach-4): the goal on the first altar, the strikes on
   * the first multi-strike altar, each new piece, and the gold ring on the first altar. Big
   * screens show every new piece and the ring on one card.
   */
  introPages(this: AltarScene): number {
    return this.view.layout.phone
      ? this.teachPages().length
      : this.introRows().length + (this.teachCell ? 1 : 0);
  },

  teachPages(this: AltarScene): TeachPage[] {
    return teachPages(this.introRows(), { first: !!this.teachCell, firstMulti: this.firstMulti });
  },

  /** What this altar introduces, for the arrival card and the briefing. */
  introRows(this: AltarScene): TeachRow[] {
    return teachRows(this.news);
  },

  /** The socket of this altar's built-in gem of this kind, if its card teaches one (teach-8). */
  teachCellOf(this: AltarScene, gem: GemKind): Cell | undefined {
    return (
      this.news.fixed.find((f) => f.gem === gem)?.cell ??
      this.news.remind.find((f) => f.gem === gem)?.cell
    );
  },

  /** One gem's card text: what it does, and whether it is fixed or turns. */
  infoText(this: AltarScene, r: { gem: GemKind; how: InfoHow }): string {
    const tag = this.tagOf(r.how);
    return `${GEM_NAME[r.gem]}${tag ? ` (${tag})` : ''}: ${this.infoRule(r)}`;
  },

  /** The card's tag; a placed Bend, Gate or Split names the keys in use (mouse or keyboard). */
  tagOf(this: AltarScene, how: InfoHow): string {
    if (this.touch && !this.keyboard) {
      if (how === 'turnsTray' || how === 'turns') return 'tap \u21bb to turn';
      if (how === 'boardTurns') return '\u21bb turns · drag off the altar to remove';
      if (how === 'board') return 'drag off the altar to remove';
    }
    if (how === 'boardTurns') {
      // With a gem in hand a click does not pick this one up, so the card only says how to turn.
      if (this.hand) return this.keyboard ? 'R or Q to turn' : 'R or scroll to turn';
      if (this.keyboard) return 'R or Q to turn · Enter to pick up';
    }
    return INFO_TAG[how];
  },

  infoRule(this: AltarScene, r: { gem: GemKind; how: InfoHow }): string {
    // teach-8: an altar that strikes once says the Gate's rule without "same strike".
    const rule =
      r.gem === 'gate' && this.puzzle.pulses <= 1
        ? `${GATE_RULE_ONE} Charge at the back: lost.`
        : r.gem === 'capacitor' && this.puzzle.pulses <= 1
          ? `${this.rules[r.gem] ?? ''} ${CAP_ONE_STRIKE}`
          : (this.rules[r.gem] ?? '');
    // Restate what it does: a newcomer meeting it in the tray may not remember the codex.
    if (r.how === 'turns') return `${firstSentence(rule)} Yours to place now; turn it to fit.`;
    // A Capacitor's first sentence (it stores) is only half of it: the release is the point.
    // A Gate's first sentence ("two side inputs, one output") hides that both must arrive.
    const whole =
      r.how === 'tray' || r.how === 'turnsTray' || r.gem === 'capacitor' || r.gem === 'gate';
    return whole ? rule : firstSentence(rule);
  },

  /**
   * A phone chip's rule: the whole rule in one short line (the codex's `chip`). A fixed gem
   * says it is part of the machine first; on the arrival card a tray gem says it is the
   * player's to place, so the first lesson reads "this one's fixed and turns the charge; you
   * place Channels" (mobile-7-teach).
   */
  chipRule(this: AltarScene, r: { gem: GemKind; how: InfoHow }, intro = false): string {
    const one = this.puzzle.pulses <= 1;
    const line =
      r.gem === 'gate' && one
        ? GATE_CHIP_ONE
        : r.gem === 'capacitor' && one
          ? CAP_CHIP_ONE
          : codexEntry(r.gem).chip;
    if (r.how === 'turns') return `${line} Turn to fit.`;
    // The arrival card's gold line already shows which gem; it says just "Built in." so the card
    // fits an SE. A tap on the gem says the whole line.
    if (r.how === 'fixed') return `${intro ? FIXED_NOTE : FIXED_NOTE_FULL} ${line}`;
    // Only where the same card also teaches a fixed gem (the contrast is the lesson); elsewhere
    // the lit tray tile says it, and an SE has no room for the extra line.
    if (intro && r.how === 'tray' && this.news.fixed.length > 0) return `${YOURS_NOTE} ${line}`;
    return line;
  },

  /** New fixed gems have been struck through: stop pulsing them, close the arrival card. */
  learnFixed(this: AltarScene): void {
    this.teachFixed = [];
    this.introLeft = 0;
  },

  updateTeach(this: AltarScene, dt: number): void {
    if (!this.teachCell) return;
    if (this.board.revision !== this.idleRev) {
      this.idleRev = this.board.revision;
      this.idle = 0;
    }
    if (this.mode !== 'edit' || this.ctx.fuse.speaking) return;
    this.idle += dt;
    if (!this.nudged && this.idle > TEACH_IDLE && this.board.isEmpty) {
      this.nudged = true;
      void this.ctx.fuse.say(TEACH_NUDGE, { interrupt: true });
    }
  },

  /** Empty sockets the held gem could go in (recomputed only when the board or gem changes). */
  validFor(this: AltarScene, kind: GemKind): readonly Cell[] {
    if (this.validRev === this.board.revision && this.validKind === kind) return this.validCells;
    this.validRev = this.board.revision;
    this.validKind = kind;
    return legalSockets(this.puzzle, this.board.placements, kind, this.validCells);
  },

  /**
   * The gem info card. It never covers the board: it sits over the tray band, just above the
   * slots. What it says, first match wins:
   *   1. the hovered or held tray gem (its full rule; the notch points at its slot);
   *   2. the board gem under the pointer, or under the keyboard cursor (first sentence, and
   *      "Fixed in place" for a gem that is part of the machine);
   *   3. on arrival, this altar's new gems, for a few seconds or until the first placement.
   * Keyboard and screen-reader players get the same text through the announcer.
   */
  updateInfo(this: AltarScene): void {
    const L = this.view.layout;
    const strike = this.mode === 'strike';
    // A gem in hand: cards that name a board gem (a Capacitor's plan read-out) step aside (CSS).
    this.dom.toggleAttribute('data-hand', !!this.hand && !strike);
    let rows: { gem: GemKind; how: InfoHow }[] = [];
    let slotX: number | null = null;
    let key = '';
    // With a gem in hand over one of the player's gems, the card is that gem's: R turns it.
    const overPlaced = !strike && this.overPlaced();
    let slot = strike ? -1 : this.hoverSlot;
    // A finger has no hover: the held gem's card shows for a moment after the pick, then
    // steps aside so the gem in hand (and its turn) stays in sight above the tray.
    // dense-board-4: a slim column never flashes it; its card waits behind the Rule tab.
    const cardOff =
      (this.touch && !this.keyboard && this.time - this.handAt > TOUCH_CARD_SECS) ||
      !!L.phone?.slim;
    if (slot < 0 && this.hand && !this.hand.from && !strike && !overPlaced && !cardOff) {
      slot = L.tray.findIndex((t) => t.gem === this.hand!.kind);
    }
    if (strike) this.infoPin = null;
    const pin = this.infoPin;
    // dense-board-4: the Rule tab's card is the chip (a long press still pins the full card).
    if (!pin) this.ruleOpen = false;
    const s = !pin && slot >= 0 ? L.tray[slot] : undefined;
    const focus =
      !strike && (!this.hand || overPlaced)
        ? (this.fixedTap?.cell ?? (this.keyboard ? this.cursor : this.hoverCell))
        : null;
    const fixedHere = focus ? this.board.fixedAt(focus) : undefined;
    const onBoard = focus ? (this.board.at(focus) ?? fixedHere) : undefined;
    // Phones: the arrival card outranks a gem's tip (moments.ts); only a long-press pin wins.
    // With a gem in hand the card names that gem or none (`pickInfo`, D-040 addendum 5).
    const introAt = Math.max(0, Math.min(this.introPageIdx, this.introPages() - 1));
    const news = this.introRows();
    const pages = L.phone ? this.teachPages() : [];
    const onPage = pages[introAt];
    // teach-4: a goal, strikes or ring page names no gem, so a gem in hand takes the card.
    const teachUp =
      this.introLeft > 0 && !strike && !(L.phone && this.hand && onPage?.kind !== 'gem');
    const source = pickInfo({
      pin: !!pin,
      phone: !!L.phone,
      teachUp,
      teachGems: L.phone ? (onPage?.kind === 'gem' ? [onPage.gem] : []) : news.map((r) => r.gem),
      held: this.hand?.kind ?? null,
      slot: s?.gem ?? null,
      board: focus && onBoard ? onBoard.gem : null,
    });
    if (source === 'pin' && pin) {
      rows = [pin];
      key = `p${pin.gem}${pin.how}${this.ruleOpen ? 'r' : ''}`;
    } else if (source === 'teach') {
      rows = news;
      key = L.phone ? `intro${introAt}` : 'intro';
    } else if (source === 'tray' && s) {
      rows = [{ gem: s.gem, how: this.turnTeach.has(s.gem) ? 'turnsTray' : 'tray' }];
      slotX = s.x;
      // Keyed by the gem too: a slot's tip must never outlive the gem it describes.
      key = `t${slot}${s.gem}`;
    } else if (source === 'board' && focus && onBoard) {
      const fixed = !!fixedHere;
      const how: InfoHow = fixed ? 'fixed' : isRotational(onBoard.gem) ? 'boardTurns' : 'board';
      rows = [{ gem: onBoard.gem, how }];
      key = `b${focus.x},${focus.y}${fixed ? 'f' : ''}${this.keyboard ? 'k' : ''}${this.hand ? 'h' : ''}`;
    }
    // Keyboard focus on a board gem: say what it is (once per gem).
    const fk = this.keyboard && key.startsWith('b') ? key : '';
    if (fk !== this.focusKey) {
      this.focusKey = fk;
      if (fk && rows[0]) this.announce(this.infoText(rows[0]));
    }
    const fade =
      key.startsWith('intro') && !this.ctx.settings.reducedMotion
        ? Math.min(1, this.introLeft / INTRO_FADE)
        : 1;
    this.tip.style.opacity = fade < 1 ? fade.toFixed(3) : '';
    if (key === this.tipKey) {
      // FUSE may start (or stop) talking while the card is up: keep it clear of his caption.
      if (!this.tip.hidden && this.captionLeft(L) !== this.tipRight) this.placeTip(L);
      return;
    }
    this.tipKey = key;
    const intro = key.startsWith('intro');
    if (rows.length === 0 && !(intro && pages.length > 0)) {
      this.tip.hidden = true;
      return;
    }
    this.tip.dataset.source = intro ? 'intro' : key[0] === 't' ? 'tray' : 'board';
    // Phones: a chip, each row its gem's name and first whole sentence (never cut mid-rule);
    // a long-press pins the full card.
    const chip = !!L.phone && (!key.startsWith('p') || key.endsWith('r'));
    // Phones: the arrival card's pages (teach-4: the goal and the strikes too, and a picture of
    // the charge going in and out on a Gate's, Split's or Capacitor's first card).
    const pageEls = intro && chip ? pages.map((p) => this.pageEl(p)) : null;
    const items = pageEls ?? [
      ...rows.map((r) => {
        const tag = this.tagOf(r.how);
        return h(
          'div',
          { class: 'lr-info-row', 'data-how': r.how },
          h('b', null, GEM_NAME[r.gem]),
          tag ? h('span', { class: 'lr-info-tag', 'data-how': r.how }, tag) : null,
          ' ',
          h(
            'span',
            { class: 'lr-info-rule' },
            chip ? keepTogether(this.chipRule(r, intro)) : this.infoRule(r),
          ),
          // The worked example, with real numbers (the codex's line; mobile-7-teach).
          // Phones, on a long-press card only: chips and the teach card stay within their line
          // budgets (an SE has no room). Desktop and iPad tips keep their v1.0 look (D-041).
          L.phone && !chip ? h('span', { class: 'lr-info-eg' }, codexEntry(r.gem).maths) : null,
        );
      }),
      ...(intro && this.teachCell
        ? [
            h(
              'div',
              { class: 'lr-info-row', 'data-how': 'ring' },
              h('b', null, RING_NAME),
              ' ',
              h('span', { class: 'lr-info-rule' }, RING_RULE),
            ),
          ]
        : []),
    ];
    // Phones: one new piece at a time, so the card stays short; the player turns the page.
    const paged = key.length > 5 && intro;
    if (paged) {
      const n = items.length;
      const i = Number(key.slice(5));
      const label = introButton(i, n);
      const next = button(
        label,
        (e) => {
          (e.currentTarget as HTMLElement).blur();
          if (label === 'Got it') this.introLeft = 0;
          else this.introPageIdx = i + 1;
          this.updateInfo();
        },
        {
          className: 'lr-info-next',
          ariaLabel: label === 'Got it' ? 'Got it: close the card' : 'Next new piece',
        },
      );
      // "New here" (and "1 of 3") over the button, top-right; the rule wraps round them, so
      // the card is no taller than its words (on an iPhone SE it fits between tray and FUSE).
      const page = h(
        'span',
        { class: 'lr-info-page' },
        // teach-8: a piece taught at another altar, first in the player's hand here.
        pages[i]?.kind === 'gem' && pages[i].again ? 'Again' : 'New here',
        n > 1 ? h('span', { class: 'lr-info-of' }, keepTogether(` ${i + 1} of ${n}`)) : null,
      );
      // teach-5: a pictured page (Gate, Split, Amplify, Capacitor) leads with its picture, in a
      // head row with "New here" and the button, so the words below get the card's full width
      // (no "Power / the no- / arrow end" wraps beside a floated picture).
      const item = items[i]!;
      const fig = item.querySelector<HTMLElement>(':scope > .lr-fig');
      const foot = h('div', { class: 'lr-info-foot' }, fig, page, next);
      this.tip.toggleAttribute('data-fig', !!fig);
      this.tip.removeAttribute('data-tight');
      this.tip.replaceChildren(foot, item);
    } else {
      this.tip.removeAttribute('data-fig');
      this.tip.removeAttribute('data-tight');
      this.tip.replaceChildren(...items);
    }
    // A card with a button is read and used, not a hover tooltip (the announcer reads the rest).
    this.tip.setAttribute('aria-hidden', String(!paged));
    this.tip.toggleAttribute('data-full', key.startsWith('p'));
    if (L.phone) {
      // Phones: a chip in the info lane, bottom-aligned (CSS), never over the board.
      this.tip.hidden = false;
      this.tipSlotX = null;
      this.placeTip(L);
      return;
    }
    // Bottom edge just above the tray slots (translate -100%), clear of the board's sockets.
    const s0 = L.tray[0];
    const size = s0?.size ?? 92;
    this.tip.style.top = `${L.trayY - size * 0.62}px`;
    this.tip.hidden = false;
    this.tipSlotX = slotX;
    this.placeTip(L);
  },

  /** One page of a phone's arrival card (teach-4). */
  pageEl(this: AltarScene, p: TeachPage): HTMLElement {
    const row = (how: string, name: string, fig: HTMLElement | null, ...rest: Node[]) =>
      h('div', { class: 'lr-info-row', 'data-how': how }, fig, h('b', null, name), ' ', ...rest);
    const rule = (text: string) => h('span', { class: 'lr-info-rule' }, keepTogether(text));
    if (p.kind === 'goal') return row('goal', GOAL_NAME, null, rule(GOAL_RULE));
    if (p.kind === 'ring') return row('ring', RING_NAME, null, rule(RING_RULE));
    if (p.kind === 'strikes') {
      const n = this.puzzle.pulses;
      // teach-6: the title wears the same unlit marks as the Strike button, so "a mark lights
      // as each one fires" points at something the player can see.
      const marks = h(
        'span',
        { class: 'lr-info-pips', 'aria-hidden': 'true' },
        ...Array.from({ length: n }, () => h('i')),
      );
      return h(
        'div',
        { class: 'lr-info-row', 'data-how': 'strikes' },
        h('b', null, keepTogether(strikeLabel(n)), marks),
        ' ',
        rule(strikesRule(n)),
      );
    }
    if (p.kind === 'either')
      return row(
        'either',
        keepTogether(eitherName(this.puzzle.pulses)),
        null,
        rule(eitherRule(this.puzzle.pulses)),
      );
    const fixed = p.how === 'fixed';
    const fig = hasPicture(p) ? this.gemFigure(p.gem, fixed) : null;
    // teach-8: pictured pages are not always fixed gems (a Gate first in the hand, a reminder).
    const built = (text: string) => (fixed ? `${FIXED_NOTE} ${text}` : text);
    const turn = p.how === 'turns' ? ' Turn to fit.' : '';
    if (fig && p.gem === 'capacitor') {
      // The Capacitor's lesson is its two strikes, with this altar's own charge (teach-4).
      const [one, two] = capacitorStrip(stormCharge(this.puzzle.storm.strength));
      // teach-8: on an altar that strikes once there is no strike 2; the card says what that means.
      if (this.puzzle.pulses <= 1) return row(p.how, GEM_NAME[p.gem], fig, rule(CAP_ONE_STRIKE));
      return row(
        p.how,
        GEM_NAME[p.gem],
        fig,
        rule(p.how === 'fixed' ? FIXED_NOTE : ''),
        h(
          'span',
          { class: 'lr-info-strip' },
          h('span', null, keepTogether(one)),
          ' ',
          h('span', null, keepTogether(two)),
        ),
      );
    }
    if (fig && p.gem === 'amplify') {
      // teach-5: the picture says 4 → 8; the line under it says a second one doesn't double.
      return row(
        p.how,
        GEM_NAME[p.gem],
        fig,
        rule(built(AMPLIFY_ONCE)),
        h('span', { class: 'lr-info-eg' }, keepTogether(AMPLIFY_AGAIN)),
      );
    }
    if (fig && p.gem === 'gate') {
      // teach-6: the Gate's sides named as the picture shows them, this altar's way round
      // (blind review 8: "both sides of the arrow" was read as head and tail).
      return row(
        p.how,
        GEM_NAME[p.gem],
        fig,
        rule(built(`${gateSides(fixed ? this.shownRot(p.gem) : 0, this.puzzle.pulses)}${turn}`)),
      );
    }
    return row(p.how, GEM_NAME[p.gem], fig, rule(this.chipRule(p, true)));
  },

  /** The quarter turns a fixed gem of this kind shows on this altar (its picture's turn). */
  shownRot(this: AltarScene, gem: GemKind): number {
    const cell = this.teachCellOf(gem);
    const shown = cell ? this.view.gemAt(cell) : undefined;
    return shown ? ((Math.round(shown.rotTarget) % 4) + 4) % 4 : 0;
  },

  /**
   * teach-4: the gem as the codex draws it (the real gem material, `art/gem-portraits.ts`),
   * turned the way it sits on this altar, with the charge going in and out. A Gate or Split
   * shows the numbers on its arrows (4 in, 2 and 2 out); the Capacitor's numbers are its strip.
   */
  gemFigure(this: AltarScene, gem: GemKind, fixed: boolean): HTMLElement {
    const d = GEM_DIAGRAMS[gem];
    // A built-in gem's picture is turned as that gem shows on this altar: its rule turn, or for
    // a straight gem the run it lies along (glyph-truth-2: the Capacitor card ran upright while
    // the board's ice lay across). Tray gems are drawn upright, as in the tray and the Codex.
    const rot = fixed ? this.shownRot(gem) : 0;
    const small = gem === 'capacitor';
    this.pictures ??= createGemPortraits(this.ctx.renderer);
    const pic = this.pictures.canvas(gem, small ? CAP_FIG_PX : FIG_PX);
    if (pic) pic.className = 'lr-fig-gem';
    const bolt = h('div', { class: 'lr-fig-bolt' });
    bolt.innerHTML = diagramSvg(d);
    const turned = h(
      'div',
      { class: 'lr-fig-turn', style: { transform: `rotate(${rot * 90}deg)` } },
      pic ?? h('div', { class: 'lr-fig-gem lr-fig-gem--css' }),
      bolt,
    );
    const at = (side: Dir, place: (s: Dir) => { left: number; top: number }) => {
      const q = place(turnSide(side, rot));
      return { left: `${q.left}%`, top: `${q.top}%` };
    };
    const chip = (side: Dir, charge: string, kind: 'in' | 'out') =>
      h('span', { class: 'lr-fig-chip', dataset: { kind }, style: at(side, chipAt) }, charge);
    const ins = d.ins.map((a) => a.charge).join(' and ');
    const outs = d.outs.map((a) => a.charge).join(' and ');
    return h(
      'div',
      {
        class: 'lr-fig',
        role: 'img',
        'aria-label': small
          ? `${GEM_NAME[gem]}: charge goes in, and comes out a strike later.`
          : `${GEM_NAME[gem]}: ${ins} in, ${outs} out.`,
        dataset: { gem, small: String(small) },
      },
      turned,
      ...(small
        ? []
        : [
            ...d.ins.map((a) => chip(a.side, a.charge, 'in')),
            ...d.outs.map((a) => chip(a.side, a.charge, 'out')),
            ...d.fizzle.map((side) =>
              h('span', { class: 'lr-fig-nogo', style: at(side, fizzleAt) }),
            ),
          ]),
    );
  },
};
