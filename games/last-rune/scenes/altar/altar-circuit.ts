/**
 * The circuit as the player builds it: live sockets, charge chips, the ghost, the no-go marks and the socket marks.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
 */
import { h, scalePxCss, toFrameUnits } from '@thunderclap/engine/ui';
import { isRotational, type Placement, type SimResult, simulate } from '../../rules';
import type { Cell, GemKind } from '../../rules/types';
import { dpx } from '../../ui/frame-units';
import { CYAN, HUM, LEGAL_RING, OPEN_END, PREVIEW_PATH, WHITE_HOT } from './altar-defs';
import type { AltarScene } from './altar-scene';
import { DANGER, GOLD } from './altar-view';
import { capacitorBeats, chargeChips, liveSockets, previewPath } from './circuit-model';
import { anchorOf } from './layout';
import { LAMP_LINE, lampLine } from './moments';
import { allReached, gaugeReach } from './reach';
import { hopTurn, restTurn } from './rest-turn';
import { socketLooks } from './socket-looks';
import { fizzles } from './strike';

export const circuitMethods = {
  /** Live sockets and the route preview, recomputed when the board or mode changes. */
  updateCircuit(this: AltarScene): void {
    const rev = this.board.revision;
    const ghost = this.ghost();
    const ghostKey = ghost ? `${ghost.gem}@${ghost.cell.x},${ghost.cell.y}r${ghost.rot}` : '';
    if (rev === this.circuitRev && this.mode === this.circuitMode) {
      if (ghostKey !== this.ghostKey) this.updateGhost(ghost, ghostKey);
      return;
    }
    const first = this.circuitRev < 0;
    this.circuitRev = rev;
    this.circuitMode = this.mode;
    const v = this.view;
    const placements = this.board.serialise();
    if (this.mode === 'edit') {
      const sim = simulate(this.puzzle, placements);
      const pv = previewPath(this.puzzle, placements, sim);
      this.openEnds = pv.openEnds;
      // Linked (and Strike-ready) by what is on the board, never by the gem in hand. A route
      // that reaches a machine only on a later strike (a Capacitor's release) still reaches it.
      // The same rule lights each gauge's reach lamp (reach.ts, unit-tested).
      gaugeReach(this.puzzle, placements, sim, pv.hops).forEach((on, i) => {
        v.machineLinked[i] = on;
      });
      this.realPreview = { hops: pv.hops, sim };
      this.ghostKey = '#';
      this.updateGhost(ghost, ghostKey);
    } else {
      v.previewTarget = 0;
      this.ghostKey = '';
      this.realPreview = null;
      this.updateNoGo([], null);
      // The strike's own read-out replaces the plan (built in `strike`).
    }
    this.updateFirstTime();
    this.liveMask = liveSockets(this.puzzle, placements, this.openEnds, this.liveMask);
    v.setLive(
      this.liveMask,
      (x, y) => {
        const c = { x, y };
        return !!this.board.at(c) || !!this.board.fixedAt(c) || this.board.isBlocked(c);
      },
      first,
    );
  },

  /**
   * The first altar's showing-not-telling (intake desk, until solved):
   * - the storm and machine conduits breathe in turn until the route reaches the machine;
   * - a new fixed gem shows the sides it joins until its first strike;
   * - Strike glows once the route reaches every machine.
   */
  /**
   * teach-4: the first time a gauge's dot changes from an empty ring, one line under the tray
   * says what it means (moments.ts `lampLine`): the lit dot on the first altar until its first
   * strike, the red dot while the plan warns on the first Capacitor altar.
   */
  /** teach-6: the dot legend's "Got it": it retires now, once per game, as a Strike would. */
  retireDotLegend(this: AltarScene): void {
    if (!this.lampTeach.reach) return;
    this.lampTeach.reach = false;
    this.ctx.flow.tellDot();
    this.updateLampLine();
    this.arrangeColumn();
  },

  updateLampLine(this: AltarScene): void {
    if (!this.view.layout.phone) return;
    const t = this.lampTeach;
    // teach-5: the legend shows until the strike after it first shows, once per game.
    if (this.mode !== 'edit' && this.hintLines.lamp === LAMP_LINE.reach && t.reach) {
      t.reach = false;
      this.ctx.flow.tellDot();
    }
    const which =
      this.mode === 'edit'
        ? lampLine({
            reached: this.lampEls.some((el) => !!el?.hasAttribute('data-on')),
            teachReach: t.reach,
          })
        : null;
    this.setHintLine('lamp', which ? LAMP_LINE[which] : null);
  },

  updateFirstTime(this: AltarScene): void {
    const v = this.view;
    const edit = this.mode === 'edit';
    const linked = allReached(v.machineLinked);
    // Phones: each gauge's lamp follows the same reach (lit only while editing).
    this.lampEls.forEach((el, i) => {
      el?.toggleAttribute('data-on', edit && !!v.machineLinked[i]);
    });
    this.updateLampLine();
    v.beckonTarget = edit && this.teachCell && !linked ? 1 : 0;
    v.guide = this.teachFixed.length > 0 ? this.guide : [];
    v.guideTarget = edit && this.teachFixed.length > 0 ? 1 : 0;
    // Every altar: Strike glows once the route reaches every machine. Reaching is not exact
    // (the charge may still be wrong); the glow only says the bolt has somewhere to go.
    this.strikeBtn.toggleAttribute('data-ready', edit && linked);
  },

  /**
   * The held gem, tried where it would land: an empty socket it fits, under the pointer or
   * the cursor. The preview shows the route with it there, so turning a Bend in hand swings
   * the route before it is set down. Never over a placed gem: that gem is what the player
   * sees there, and R turns it (turn-2).
   */
  ghost(this: AltarScene): Placement | null {
    const hand = this.hand;
    if (this.mode !== 'edit' || !hand || hand.from) return null;
    const cell = this.keyboard ? this.cursor : this.hoverCell;
    if (!cell || this.board.at(cell) || !this.lands(cell, hand.kind)) return null;
    return {
      gem: hand.kind,
      cell: { x: cell.x, y: cell.y },
      rot: (hand.rot & 3) as Placement['rot'],
    };
  },

  /**
   * Would the held gem land in `cell`? An empty socket it fits, or a placed gem of the
   * player's it would replace (that one goes back to the tray). Never a fixed gem or stone.
   */
  lands(this: AltarScene, cell: Cell, kind: GemKind): boolean {
    if (this.board.fixedAt(cell) || this.board.isBlocked(cell) || !this.inBounds(cell))
      return false;
    if (this.board.at(cell)) return true;
    return this.board.check(cell, kind).ok;
  },

  updateGhost(this: AltarScene, ghost: Placement | null, key: string): void {
    if (key === this.ghostKey || !this.realPreview) return;
    this.ghostKey = key;
    const v = this.view;
    let hops = this.realPreview.hops;
    let sim = this.realPreview.sim;
    let placements = this.board.serialise();
    if (ghost) {
      const at = (q: Placement) => q.cell.x === ghost.cell.x && q.cell.y === ghost.cell.y;
      placements = [...placements.filter((q) => !at(q)), ghost];
      sim = simulate(this.puzzle, placements);
      hops = previewPath(this.puzzle, placements, sim).hops;
    }
    this.updateNoGo(placements, sim);
    // Straight-through glyphs face the way the bolt will really come in, with the held gem
    // where it would land. Bend, Gate and Split keep the turn they were set at. Every strike
    // counts, not just the first (glyph-truth): a gem only a Capacitor's release reaches already
    // rests along that run, so nothing turns when Strike is pressed (the verdict faces gems
    // along the same trace; `solvedLook` hops).
    // Gems no strike reaches lie along their run, counting the held gem where it would land
    // (glyph-truth-2); the held straight gem itself shows the turn it would sit at.
    const gems = [...this.puzzle.fixed, ...placements];
    v.faceAlong(sim.trace, true, gems);
    v.heldFace = null;
    if (ghost && !isRotational(ghost.gem)) {
      const h = sim.trace.find((s) => s.to.x === ghost.cell.x && s.to.y === ghost.cell.y);
      v.heldFace = h ? hopTurn(h) : restTurn(this.puzzle, gems, ghost.cell);
    }
    v.preview = hops;
    v.previewTarget = PREVIEW_PATH ? 1 : 0;
    this.renderCaps(capacitorBeats(this.puzzle, placements, sim), sim, false);
  },

  /** Chips for this strike's charge changes (and every hop into a machine). */
  buildChips(this: AltarScene, res: SimResult): void {
    this.clearChips();
    // Phones: the storm's first hop is already its "Gives 4" card; an unlabelled "4" on the
    // first cell read as a rule of its own (mobile-6-moments). Changes and arrivals stay.
    const phone = !!this.view.layout.phone;
    const chips = chargeChips(res).filter(
      (c) => !phone || res.trace[c.seg]!.tick !== 0 || res.trace[c.seg]!.end === 'machine',
    );
    const have = new Set(chips.map((c) => c.seg));
    res.trace.forEach((seg, i) => {
      if (seg.end === 'machine' && !have.has(i))
        chips.push({ seg: i, pulse: seg.pulse, from: seg.from, to: seg.to, charge: seg.charge });
    });
    this.chips = chips;
    const L = this.view.layout;
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    const chipPx = Math.max(16, Math.min(24, Math.round(L.pitch * 0.3)));
    for (const c of chips) {
      anchorOf(L, c.from, a);
      anchorOf(L, c.to, b);
      // Chips into a machine sit near the port, where the reading is decided.
      const t = res.trace[c.seg]!.end === 'machine' ? 0.62 : 0.5;
      const el = h(
        'div',
        {
          class: 'lr-altar-chip',
          hidden: true,
          style: {
            left: dpx(a.x + (b.x - a.x) * t),
            top: dpx(a.y + (b.y - a.y) * t),
            // Chips scale with the board so a 10-wide altar's run of changes stays legible.
            // and follow the text size setting.
            fontSize: toFrameUnits(scalePxCss(chipPx)),
            lineHeight: toFrameUnits(`calc(${scalePxCss(chipPx)} + 6px)`),
          },
        },
        String(c.charge),
      );
      this.dom.append(el);
      this.chipEls.push(el);
    }
    // teach-7 (D-040 add. 10, B): phones, what a Capacitor stored on strike 1 stays on the board
    // ("stores 8", ice-blue, on the seam beside the gem) through the rest of the strike and the
    // result, so strike 1 is seen to happen. Desktop has its Capacitor read-out on the board.
    if (!phone) return;
    res.trace.forEach((seg, i) => {
      if (seg.end !== 'store') return;
      anchorOf(L, seg.to, b);
      // Above the gem unless it sits on the top row, where the chip goes below.
      const dy = (seg.to.y > 0 ? -0.5 : 0.5) * L.pitch;
      const px = Math.round(chipPx * 0.75);
      const el = h(
        'div',
        {
          class: 'lr-altar-chip',
          'data-store': '',
          hidden: true,
          style: {
            left: dpx(b.x),
            top: dpx(b.y + dy),
            fontSize: toFrameUnits(scalePxCss(px)),
            lineHeight: toFrameUnits(`calc(${scalePxCss(px)} + 6px)`),
          },
        },
        `stores ${seg.charge}`,
      );
      this.chips.push({ seg: i, pulse: seg.pulse, from: seg.from, to: seg.to, charge: seg.charge });
      this.dom.append(el);
      this.chipEls.push(el);
    });
  },

  clearChips(this: AltarScene): void {
    for (const el of this.chipEls) el.remove();
    this.chipEls.length = 0;
    this.chips = [];
  },

  /** Show the chips of the strike now playing whose hop has started. */
  updateChips(this: AltarScene): void {
    const tl = this.timeline;
    if (!tl) return;
    for (let i = 0; i < this.chips.length; i++) {
      const c = this.chips[i]!;
      const seg = tl.segments[c.seg]!;
      const el = this.chipEls[i]!;
      // A stored charge stays shown once it has landed, through later strikes and the result.
      const show =
        el.dataset.store !== undefined
          ? this.pulse > c.pulse || (c.pulse === this.pulse && this.st >= seg.t1)
          : c.pulse === this.pulse && this.st >= seg.t0;
      if (el.hidden === show) el.hidden = !show;
    }
  },

  /** Colour the machine chips of strike `i` by what the machine made of them. */
  settleChips(this: AltarScene, i: number, m: number, state: string): void {
    const at = this.puzzle.machines[m]!.at;
    for (let k = 0; k < this.chips.length; k++) {
      const c = this.chips[k]!;
      if (c.pulse === i && c.to.x === at.x && c.to.y === at.y)
        this.chipEls[k]!.dataset.state = state;
    }
  },

  /**
   * Where the route preview stops at a Bend, Gate or Split facing the wrong way, a small ✕ on
   * the side the bolt meets it, so a stopped preview says why (same cause as the strike's
   * `Faces the wrong way`).
   */
  updateNoGo(this: AltarScene, placements: readonly Placement[], sim: SimResult | null): void {
    const hops: { from: Cell; to: Cell }[] = [];
    if (sim && PREVIEW_PATH && !this.teaching) {
      for (const seg of sim.trace) {
        if (seg.pulse !== 0 || seg.end !== 'fizzle') continue;
        const one = fizzles(this.puzzle, placements, { ...sim, trace: [seg] });
        if (one[0]?.cause === 'facing') hops.push(seg);
      }
    }
    const key = hops.map((c) => `${c.from.x},${c.from.y}>${c.to.x},${c.to.y}`).join(';');
    if (key === this.noGoKey) return;
    this.noGoKey = key;
    for (const el of this.noGoEls) el.remove();
    this.noGoEls.length = 0;
    const L = this.view.layout;
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    for (const c of hops) {
      anchorOf(L, c.from, a);
      anchorOf(L, c.to, b);
      // On the gem's rim, where the bolt is turned away.
      const t = 0.62;
      const el = h('div', {
        class: 'lr-altar-nogo',
        'aria-hidden': 'true',
        style: { left: dpx(a.x + (b.x - a.x) * t), top: dpx(a.y + (b.y - a.y) * t) },
      });
      this.dom.insertBefore(el, this.tip.parentNode === this.dom ? this.tip : this.leader);
      this.noGoEls.push(el);
    }
  },

  buildMarks(this: AltarScene): void {
    const v = this.view;
    v.clearMarks();
    // Open, blocked and fixed sockets (see socket-looks): phones bake blocked cells solid, so
    // only open sockets get the pale lip; fixed and hint-locked gems wear a bolted collar.
    const L = v.layout;
    const fixed = [
      ...this.puzzle.fixed.map((f) => f.cell),
      ...this.board.lockedPlacements.map((f) => f.cell),
    ];
    for (const m of socketLooks(!!L.phone, L.cols, L.rows, this.puzzle.blocked, fixed)) {
      v.mark(m.x, m.y, m.state, GOLD, 1);
    }
    if (this.hintCell && this.mode !== 'strike') {
      v.mark(this.hintCell.x, this.hintCell.y, 'highlighted', GOLD, 1.3, 3);
    }
    if (this.mode === 'result' && this.result?.outcome !== 'exact') {
      const L = v.layout;
      // Phones (mobile-7-strike): the socket the Try line names wears the thick red ring.
      const root = L.phone ? this.verdictAvoid : null;
      for (const f of this.fizzleList) {
        if (f.cell.x < 0 || f.cell.y < 0 || f.cell.x >= L.cols || f.cell.y >= L.rows) continue;
        if (root && f.cell.x === root.x && f.cell.y === root.y) continue;
        v.mark(f.cell.x, f.cell.y, 'highlighted', DANGER, 1.1, 5);
      }
      if (root) v.mark(root.x, root.y, 'fault', DANGER, 1, 0);
    }
    if (this.mode === 'edit' && this.hand && !this.hand.from) {
      // Every socket the held gem may go in wears the same steady ring (mobile-6-board): the
      // ringed set is exactly the legal set, so legal moves read at a glance.
      for (const c of this.validFor(this.hand.kind)) v.mark(c.x, c.y, 'legal', LEGAL_RING, 1, 0);
    }
    if (this.mode === 'edit' && PREVIEW_PATH && !this.teaching) {
      // Where the wire goes next: the socket the bolt would reach and fizzle in.
      for (const c of this.openEnds) v.mark(c.x, c.y, 'highlighted', OPEN_END, 0.4, 2.2);
    }
    if (this.mode !== 'strike') {
      // A gem seen for the first time pulses in its own colour until the first strike.
      for (const f of this.teachFixed)
        v.mark(f.cell.x, f.cell.y, 'highlighted', HUM[f.gem], 1.1, 3);
    }
    if (this.teaching) {
      const c = this.teachCell!;
      v.mark(c.x, c.y, 'highlighted', GOLD, 1.3, 3);
    }
    if (this.teachCell && this.mode === 'edit') {
      // The other end of the wire: each machine's exit socket, until the route reaches it.
      this.view.layout.machines.forEach((m, i) => {
        if (v.machineLinked[i] || this.board.at(m.inner)) return;
        v.mark(m.inner.x, m.inner.y, 'highlighted', GOLD, 0.8, 3);
      });
    }
    if (this.mode === 'edit') {
      const hand = this.hand;
      const cell = this.keyboard ? this.cursor : this.hoverCell;
      if (cell) {
        const blocked = this.board.isBlocked(cell) || !!this.board.fixedAt(cell);
        if (hand && !hand.from && this.board.at(cell)) {
          // The player's gem under the pointer is what R turns (and a click would swap it).
          v.mark(cell.x, cell.y, 'highlighted', CYAN, 0.7, 0);
        } else if (hand) {
          const ok =
            !blocked &&
            (this.board.check(cell, hand.kind).ok || !!hand.from || !!this.board.at(cell));
          // The socket hums in the gem's colour when the gem would go in.
          v.mark(
            cell.x,
            cell.y,
            'highlighted',
            ok ? HUM[hand.kind] : DANGER,
            ok ? 1.2 : 0.9,
            ok ? 9 : 0,
          );
        } else if (this.keyboard) {
          v.mark(cell.x, cell.y, 'highlighted', blocked ? DANGER : GOLD, 1, 0);
        } else if (this.board.at(cell)) {
          v.mark(cell.x, cell.y, 'highlighted', CYAN, 0.7, 0);
        }
      }
    }
    if (this.deny)
      v.mark(this.deny.cell.x, this.deny.cell.y, 'highlighted', DANGER, this.deny.t * 2.4, 0);
    if (this.mode === 'result' && this.result?.outcome === 'exact') {
      for (const b of v.board)
        v.mark(b.cell.x, b.cell.y, 'highlighted', WHITE_HOT, 0.4 + 0.6 * v.wake, 0);
    }
  },
};
