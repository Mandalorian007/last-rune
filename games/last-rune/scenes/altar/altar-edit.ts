/**
 * Edit mode input: pointer, touch gestures, keyboard and pad.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
 */
import { Gestures, type Rect } from '@thunderclap/engine/input';
import { isRotational } from '../../rules';
import type { Cell } from '../../rules/types';
import { DRAG_PX, HOLD_SECS, SLOT_ACTIONS } from './altar-defs';
import type { AltarScene } from './altar-scene';
import { jumpCursor, stepCursor } from './cursor';
import { cellAt, cellCenter, LOUPE_BELOW, snapCell, traySlotAt } from './layout';

export const editMethods = {
  /**
   * Touch aiming (engine Gestures `magnify`): while a finger holds a gem it aims at the nearest
   * socket the gem may go in, 56 CSS px above the fingertip while it drags, and on small sockets
   * (under 48 CSS px, dense-board: every dense board on every phone, Lift Shaft's 45 on a Pro
   * Max included) a loupe beside the finger shows that socket, ringed, clear of its eight
   * neighbours (dense-board-3). Mouse, pen and keyboard
   * never aim; nor does a finger with nothing in hand.
   */
  linkGestures(this: AltarScene): void {
    const ctx = this.ctx;
    const L = () => this.view.layout;
    this.gestures = new Gestures({
      magnify: {
        pitch: () => L().pitch / ctx.device.cssPx,
        below: LOUPE_BELOW,
        when: () => !!this.hand && !this.keyboard && this.mode === 'edit',
        snap: (x, y) => {
          const cell = snapCell(L(), x, y, this.aimable);
          if (!cell) return null;
          const c = { x: 0, y: 0 };
          cellCenter(L(), cell, c);
          return { x: c.x, y: c.y, r: L().pitch * 0.52, data: cell };
        },
        over: (x, y) => !!cellAt(L(), x, y),
        toClient: (x, y) => ctx.surface.logicalToClient(x, y),
        // dense-board-3: the loupe never covers the aimed socket or its eight neighbours (the
        // player still sees where the gem goes and what it joins), and keeps off the column's
        // title, held-gem pill and tray counts unless nowhere else is free.
        clear: (t) => {
          if (!t) return null;
          const l = L();
          const to = (x: number, y: number) => ctx.surface.logicalToClient(x, y);
          const n = 1.5 * l.pitch;
          const a = to(t.x - n, t.y - n);
          const b = to(t.x + n, t.y + n);
          const keep = [{ l: a.x, t: a.y, r: b.x, b: b.y }];
          const ph = l.phone;
          if (!ph) return { keep };
          const c0 = to(ph.colL, 0);
          const c1 = to(ph.colR, ph.laneTop);
          // polish-9: it leaves the Gives/Needs cards and the open hint or teach card in sight
          // too when it can (below the 3×3 and the finger, above the column's head).
          const spare: Rect[] = [];
          for (const el of [...this.needs, this.stormLabel, this.hint, this.tip]) {
            if (!el || el.hidden || !el.isConnected) continue;
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0)
              spare.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
          }
          return {
            keep,
            spare,
            avoid: [{ l: c0.x, t: Number.NEGATIVE_INFINITY, r: c1.x, b: c1.y }],
          };
        },
        source: ctx.surface.canvas,
        className: 'lr-loupe',
      },
    });
    ctx.input.setGestures(this.gestures);
  },

  updateEdit(this: AltarScene, _dt: number): void {
    const input = this.ctx.input;
    const L = this.view.layout;
    const p = input.pointer;
    const moved = p.x !== this.lastPointer.x || p.y !== this.lastPointer.y;
    if (moved) {
      this.lastPointer.x = p.x;
      this.lastPointer.y = p.y;
      if (p.inside) this.keyboard = false;
    }
    // A finger has no hover: between touches nothing is under it. A finger holding a gem aims
    // through Gestures `magnify` (linkGestures): lifted while it drags, snapped to a socket.
    const finger = p.type !== 'mouse';
    const aim = finger ? (this.gestures?.aim ?? null) : null;
    const live =
      p.inside && !this.keyboard && (!finger || input.held('select') || input.released('select'));
    const aimAt = (x: number, y: number) =>
      aim ? ((aim.target?.data as Cell | undefined) ?? null) : cellAt(L, x, y);
    this.hoverCell = live ? aimAt(p.x, p.y) : null;
    this.hoverSlot = live && !aim?.lifted ? traySlotAt(L, p.x, p.y) : -1;
    if (aim?.loupe)
      this.dom.dataset.loupe = this.hoverCell ? `${this.hoverCell.x},${this.hoverCell.y}` : '';
    else delete this.dom.dataset.loupe;

    // ── Pointer ──
    // Phones: a tap while a gem's full card is open only closes it.
    const closing = input.pressed('select') && !!this.infoPin;
    if (closing) this.infoPin = null;
    if (
      !closing &&
      input.pressed('select') &&
      p.inside &&
      finger &&
      this.hand &&
      !this.hand.from &&
      this.hoverCell
    ) {
      // Touch: the gem lands where the finger lifts, so a press can slide to the right socket.
      this.keyboard = false;
      this.press = {
        origin: 'aim',
        cell: this.hoverCell,
        x: p.x,
        y: p.y,
        dragging: false,
        t: this.time,
      };
    } else if (!closing && input.pressed('select') && p.inside) {
      this.keyboard = false;
      if (this.hoverSlot >= 0) {
        const kind = L.tray[this.hoverSlot]!.gem;
        if (this.hand && !this.hand.from && this.hand.kind === kind) {
          this.press = {
            origin: 'tray',
            cell: null,
            x: p.x,
            y: p.y,
            dragging: false,
            t: this.time,
            again: true,
          };
        } else {
          this.takeFromTray(kind);
          if (this.hand)
            this.press = {
              origin: 'tray',
              cell: null,
              x: p.x,
              y: p.y,
              dragging: false,
              t: this.time,
            };
        }
      } else if (this.hoverCell) {
        const cell = this.hoverCell;
        if (this.hand) this.placeHand(cell);
        else if (this.board.at(cell)) {
          // A click picks it up (on release); a drag moves it.
          this.press = { origin: 'board', cell, x: p.x, y: p.y, dragging: false, t: this.time };
        } else this.actOnGem(cell);
      } else if (this.hand) {
        this.dropHand();
      }
    }
    const press = this.press;
    if (press && input.held('select')) {
      if (!press.dragging && Math.hypot(p.x - press.x, p.y - press.y) > DRAG_PX) {
        press.dragging = true;
        if (press.origin === 'board' && press.cell) {
          const pl = this.board.at(press.cell);
          const b = this.view.gemAt(press.cell);
          if (pl && b) {
            b.hidden = true;
            this.hand = { kind: pl.gem, rot: pl.rot, from: press.cell };
            this.ctx.sound.sfx.play('gemPick', { gem: pl.gem });
          }
        }
      }
    }
    if (press && input.held('select') && finger && press.origin === 'board' && press.cell) {
      // A long touch on a placed gem shows its card and selects it for ↻; it does not pick up.
      if (!press.dragging && this.time - press.t >= HOLD_SECS && !this.hand) {
        this.lastPlaced = { x: press.cell.x, y: press.cell.y };
        const pl = this.board.at(press.cell);
        if (L.phone && pl && !this.infoPin)
          this.infoPin = { gem: pl.gem, how: isRotational(pl.gem) ? 'boardTurns' : 'board' };
      }
    }
    // Phones: a long press on a tray gem opens its full card too.
    if (
      press &&
      L.phone &&
      finger &&
      input.held('select') &&
      press.origin === 'tray' &&
      !press.dragging &&
      !this.infoPin &&
      this.time - press.t >= HOLD_SECS &&
      this.hand &&
      !this.hand.from
    ) {
      const gem = this.hand.kind;
      this.infoPin = { gem, how: this.turnTeach.has(gem) ? 'turnsTray' : 'tray' };
    }
    if (press && input.released('select')) {
      this.press = null;
      if (press.origin === 'aim') {
        // On release: the socket under the aim point; anywhere else keeps the gem in hand.
        if (this.hoverCell && this.hand) this.placeHand(this.hoverCell);
      } else if (press.dragging) {
        const cell = aimAt(p.x, p.y);
        if (press.origin === 'board' && this.hand?.from) {
          if (cell) this.placeHand(cell);
          else {
            const from = this.hand.from;
            this.hand = null;
            this.removeAt(from);
          }
        } else if (press.origin === 'tray') {
          if (cell) this.placeHand(cell);
          else if (traySlotAt(L, p.x, p.y) < 0) this.dropHand();
        }
      } else if (press.origin === 'board' && press.cell) {
        if (!(finger && this.time - press.t >= HOLD_SECS)) this.actOnGem(press.cell);
      } else if (press.origin === 'tray' && press.again && this.time - press.t < HOLD_SECS) {
        // A second tap on the gem in hand puts it back (a long one shows its card instead).
        this.dropHand();
      }
    }
    if (input.pressed('alt')) {
      if (this.hand) this.dropHand();
      else if (this.hoverCell) this.removeAt(this.hoverCell);
    }

    // ── Keyboard / pad ──
    const dx = (input.pressed('right') ? 1 : 0) - (input.pressed('left') ? 1 : 0);
    const dy = (input.pressed('down') ? 1 : 0) - (input.pressed('up') ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      this.keyPlaced = null;
      if (this.keyboard) {
        // Arrows never stop on carved stone: nothing can go there.
        this.cursor = stepCursor(
          { cols: L.cols, rows: L.rows, isBlocked: (c) => this.board.isBlocked(c) },
          this.cursor,
          dx,
          dy,
        );
      } else if (this.hoverCell) {
        this.cursor = { x: this.hoverCell.x, y: this.hoverCell.y };
      }
      this.keyboard = true;
      this.ctx.sound.sfx.play('uiHover', { gain: 0.5 });
    }
    for (let i = 0; i < SLOT_ACTIONS.length; i++) {
      if (input.pressed(SLOT_ACTIONS[i]!) && L.tray[i]) {
        if (this.hand?.from) this.dropHand();
        this.takeFromTray(L.tray[i]!.gem);
        if (!this.hoverCell) this.keyboard = true;
        this.cursorOn();
      }
    }
    if (input.pressed('jump')) this.jumpToOpenEnd();
    if (input.pressed('trayNext')) {
      this.cycleTray();
      if (!this.hoverCell) this.keyboard = true;
      this.cursorOn();
    }
    if (input.pressed('confirm')) {
      // Enter acts where the player is looking: the hovered socket, else the cursor.
      if (!this.keyboard && !this.hoverCell) this.keyboard = true;
      const at = this.keyboard ? this.cursor : this.hoverCell;
      if (at) {
        if (this.hand) {
          this.placeHand(at);
          this.keyPlaced = this.keyboard && this.board.at(at) ? { x: at.x, y: at.y } : null;
        } else this.actOnGem(at);
      }
    }
    const target = this.keyboard ? this.cursor : this.hoverCell;
    const turn = (input.pressed('rotate') ? 1 : 0) - (input.pressed('rotateBack') ? 1 : 0);
    if (turn !== 0) this.turnAt(target, turn);
    if (input.pressed('remove')) {
      if (this.hand) this.dropHand();
      else if (target) this.removeAt(target);
    }
    if (input.pressed('undo')) this.undo();
    if (input.pressed('clear')) this.clear();
    if (input.pressed('strike')) this.strike();
    else if (input.pressed('cancel')) {
      if (this.hand) this.dropHand();
      else this.back();
    }
  },

  /**
   * G: the cursor goes to the wire's open end (the empty socket the bolt would reach next),
   * then on to the next open end with each press. Nothing open: a soft deny.
   */
  jumpToOpenEnd(this: AltarScene): void {
    this.keyPlaced = null;
    this.updateCircuit();
    const ends = this.openEnds.filter(
      (c) =>
        this.inBounds(c) && !this.board.at(c) && !this.board.fixedAt(c) && !this.board.isBlocked(c),
    );
    const from = this.keyboard ? this.cursor : (this.hoverCell ?? this.cursor);
    const to = jumpCursor(from, ends);
    if (!to) {
      this.ctx.sound.sfx.play('socketBlocked', { gain: 0.6 });
      return;
    }
    this.cursor = to;
    this.keyboard = true;
    this.ctx.sound.sfx.play('uiHover', { gain: 0.5 });
  },

  /**
   * After Enter fills a socket, taking the next gem by key moves the cursor to the nearest open
   * end of the route (the socket the bolt would reach next), so building a long route is a
   * gem key and Enter per socket instead of a walk across the board each time.
   */
  cursorOn(this: AltarScene): void {
    const from = this.keyPlaced;
    this.keyPlaced = null;
    if (!from || !this.keyboard || !this.hand) return;
    if (from.x !== this.cursor.x || from.y !== this.cursor.y) return;
    this.updateCircuit();
    let best: Cell | null = null;
    let bestD = Infinity;
    for (const c of this.openEnds) {
      if (this.board.at(c) || this.board.fixedAt(c) || this.board.isBlocked(c)) continue;
      const d = Math.abs(c.x - from.x) + Math.abs(c.y - from.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) this.cursor = { x: best.x, y: best.y };
  },

  cycleTray(this: AltarScene): void {
    const tray = this.view.layout.tray;
    if (tray.length === 0) return;
    const cur =
      this.hand && !this.hand.from ? tray.findIndex((s) => s.gem === this.hand!.kind) : -1;
    for (let k = 1; k <= tray.length; k++) {
      const s = tray[(cur + k + tray.length) % tray.length]!;
      if (this.board.remaining(s.gem) > 0) {
        this.takeFromTray(s.gem);
        return;
      }
    }
    this.ctx.sound.sfx.play('socketBlocked');
  },

  /** The intended placement nearest the storm cell: where the first gem obviously goes. */
  firstSocket(this: AltarScene): Cell | null {
    const at = this.puzzle.storm.at;
    let best: Cell | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const q of this.puzzle.design.intended) {
      const d = Math.abs(q.cell.x - at.x) + Math.abs(q.cell.y - at.y);
      if (d < bestD) {
        bestD = d;
        best = q.cell;
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  },

  updateFuse(this: AltarScene): void {
    const f = this.view.fuse;
    f.mood = this.ctx.fuse.speaking ? 'talk' : this.ctx.tier() >= 3 ? 'quiet' : 'idle';
    let head: { x: number; y: number } | null = null;
    for (let i = 0; i < this.view.bolts.length; i++) {
      const b = this.view.bolts[i]!;
      if (b.head) head = b.head;
    }
    if (this.mode === 'strike' && head) f.lookAt(head.x, head.y);
    else if (this.hand && this.view.held) f.lookAt(this.view.held.x, this.view.held.y);
    else if (this.mode === 'result') {
      const m = this.view.layout.machines[0];
      if (m) f.lookAt(m.x, m.y);
    } else f.lookAt(null);
  },
};
