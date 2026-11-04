/**
 * The gem in hand: pick up, set down, turn, remove, undo and clear, and the tray.
 * Methods of `AltarScene` (altar-scene.ts), assigned to its prototype.
 */
import { isRotational, type Placement } from '../../rules';
import type { Cell, GemKind } from '../../rules/types';
import {
  DENY_REASON,
  GEM_NAME,
  INTRO_FADE,
  NO_TURN,
  sidesText,
  TOUCH_CARD_SECS,
} from './altar-defs';
import type { AltarScene } from './altar-scene';
import { emitPuzzleEvent, puzzleEventsWanted } from './events';
import { cellCenter } from './layout';

export const handMethods = {
  changed(this: AltarScene, placed: Cell | null = null): void {
    if (this.mode === 'result') this.backToEdit();
    // The arrival card has done its job once the player starts building: let it fade.
    if (placed && this.introLeft > INTRO_FADE) this.introLeft = INTRO_FADE;
    this.view.syncBoard(this.board, placed);
    if (placed) this.lastPlaced = { x: placed.x, y: placed.y };
    this.ctx.flow.savePlacements(this.machine, this.board.serialise());
    if (this.hand && !this.hand.from && this.board.remaining(this.hand.kind) <= 0) this.hand = null;
    this.refreshHud();
  },

  denyAt(this: AltarScene, cell: Cell | null, reason: string): void {
    this.ctx.sound.sfx.play('socketBlocked', { pan: this.panOf(cell) });
    if (cell) {
      this.deny = { cell, t: 0.5 };
      const b = this.view.gemAt(cell);
      if (b) b.settle = 0.7;
      const pt = { x: 0, y: 0 };
      cellCenter(this.view.layout, cell, pt);
      this.clearTags();
      if (this.mode === 'result') this.backToEdit();
      this.addTag(
        pt.x,
        pt.y - this.view.layout.pitch * 0.42,
        DENY_REASON[reason] ?? reason,
        'info',
      );
      this.tagTimer = 1.6;
    }
  },

  panOf(this: AltarScene, cell: Cell | null): number {
    if (!cell) return 0;
    const pt = { x: 0, y: 0 };
    cellCenter(this.view.layout, cell, pt);
    return Math.max(-1, Math.min(1, (pt.x - 960) / 960));
  },

  takeFromTray(this: AltarScene, kind: GemKind, keepRot = false): void {
    if (this.board.remaining(kind) <= 0) {
      this.ctx.sound.sfx.play('socketBlocked');
      const i = this.view.layout.tray.findIndex((s) => s.gem === kind);
      if (i >= 0) this.view.trayLift[i] = -0.3;
      return;
    }
    const rot = keepRot && this.hand?.kind === kind ? this.hand.rot : 0;
    this.hand = { kind, rot, from: null };
    this.picked = true;
    this.dom.toggleAttribute('data-picked', true);
    this.lastPlaced = null; // ↻ now turns the gem in hand
    this.handAt = this.time;
    this.teachTray.delete(kind);
    const turns = isRotational(kind) ? ` ${this.turnKeys} turns it.` : '';
    this.announce(`${GEM_NAME[kind]} in hand. ${this.rules[kind] ?? ''}${turns}`);
    this.ctx.sound.sfx.play('gemPick', { gem: kind });
    this.refreshHud();
  },

  dropHand(this: AltarScene): void {
    if (!this.hand) return;
    if (this.hand.from) {
      const b = this.view.gemAt(this.hand.from);
      if (b) b.hidden = false;
    }
    this.hand = null;
    this.refreshHud();
  },

  placeHand(this: AltarScene, cell: Cell): void {
    const hand = this.hand;
    if (!hand) return;
    if (this.board.isBlocked(cell)) {
      this.denyAt(cell, 'blocked');
      return;
    }
    if (this.board.fixedAt(cell)) {
      this.denyAt(cell, 'fixed');
      return;
    }
    if (hand.from) {
      const from = hand.from;
      this.hand = null;
      if (from.x === cell.x && from.y === cell.y) {
        // Dropped where it came from: any turn made mid-drag sticks.
        const here = this.board.at(cell);
        const by = here && isRotational(here.gem) ? ((hand.rot & 3) - here.rot + 4) & 3 : 0;
        if (by) {
          this.board.rotate(cell, by);
          this.ctx.sound.sfx.play('gemRotate', { pan: this.panOf(cell) });
          this.logRotate(cell);
          this.changed();
        } else this.view.syncBoard(this.board);
        return;
      }
      const other = this.board.at(cell);
      if (other) {
        // Swap the two gems (three undo steps; the board has no compound edit).
        this.board.remove(cell);
        this.board.move(from, cell);
        this.board.place(from, other.gem, other.rot);
        this.logPlace(from, cell);
      } else {
        const r = this.board.move(from, cell);
        if (!r.ok) {
          this.view.syncBoard(this.board);
          this.denyAt(cell, r.reason);
          return;
        }
      }
      // Turned while dragged: it lands as it was shown.
      const moved = this.board.at(cell);
      if (moved && moved.gem === hand.kind && isRotational(hand.kind)) {
        const by = ((hand.rot & 3) - moved.rot + 4) & 3;
        if (by) this.board.rotate(cell, by);
      }
      this.ctx.sound.sfx.play('gemPlace', {
        gem: this.board.at(cell)?.gem ?? hand.kind,
        pan: this.panOf(cell),
      });
      this.logPlace(cell, from);
      this.changed(cell);
      return;
    }
    const existing = this.board.at(cell);
    if (existing) {
      if (existing.gem === hand.kind) {
        // Same gem already here: nothing to set down, and a click never turns it.
        const keys = this.keyboard ? 'R or Q' : this.touch ? '\u21bb' : 'R or scroll';
        const turn = isRotational(existing.gem) ? `: ${keys} turns it` : '';
        this.denyAt(cell, `${GEM_NAME[existing.gem]} already here${turn}`);
        return;
      }
      this.board.remove(cell);
    }
    const r = this.board.place(cell, hand.kind, hand.rot & 3);
    if (!r.ok) {
      if (existing) this.board.undo();
      this.denyAt(cell, r.reason);
      return;
    }
    this.ctx.sound.sfx.play('gemPlace', { gem: hand.kind, pan: this.panOf(cell) });
    if (existing) this.logRemove(existing.gem, cell);
    this.logPlace(cell, null);
    // Phones (mobile-5-board): setting a gem down ends the hold, so the valid-socket rings
    // clear and Turn turns the gem just placed; the next tap on the tray takes another.
    if (this.view.layout.phone) this.hand = null;
    this.changed(cell);
  },

  /**
   * Click / Enter / pad A at a socket with an empty hand: a placed gem is picked up, keeping
   * its turn. One rule for every gem and every input: clicking never turns (R, Q, scroll do).
   */
  actOnGem(this: AltarScene, cell: Cell): void {
    const p = this.board.at(cell);
    if (p) {
      this.board.remove(cell);
      this.hand = { kind: p.gem, rot: p.rot, from: null };
      this.lastPlaced = null;
      this.ctx.sound.sfx.play('gemPick', { gem: p.gem, pan: this.panOf(cell) });
      this.announce(`${GEM_NAME[p.gem]} in hand.${this.turnNote(p.gem, p.rot)}`);
      this.logRemove(p.gem, cell);
      this.changed();
      return;
    }
    if (this.board.fixedAt(cell)) {
      // Phones: a tap on a fixed gem asks what it is. Its card says "Fixed: part of the
      // machine" in the tip slot; the gem stays still (no bounce, no red flash), so nothing
      // suggests it could move (mobile-7-teach).
      if (this.view.layout.phone) {
        this.fixedTap = { cell: { x: cell.x, y: cell.y }, t: TOUCH_CARD_SECS };
        this.ctx.sound.sfx.play('uiClick');
        return;
      }
      this.denyAt(cell, 'fixed');
      return;
    }
    if (this.board.isBlocked(cell)) {
      this.denyAt(cell, 'blocked');
      return;
    }
  },

  /** " Joins north and east. R or Q turns it." for a Bend, Gate or Split; nothing for others. */
  turnNote(this: AltarScene, gem: GemKind, rot: number): string {
    if (!isRotational(gem)) return '';
    const s = sidesText(gem, rot);
    return ` ${s.charAt(0).toUpperCase()}${s.slice(1)}. ${this.turnKeys} turns it.`;
  },

  /**
   * R / Q / scroll / RB: turn the gem the player sees under the pointer (or the keyboard cursor).
   *   - A gem on the board (placed or fixed) is what the player is looking at, so it turns,
   *     at once and for good, whatever is in hand; one that cannot turn says why. The hand is
   *     never turned in its place (turn-2: the ghost is not drawn over placed gems).
   *   - Otherwise a gem in hand turns: it is drawn in the empty socket it will land in.
   *   - While dragging a placed gem, the dragged gem is the one under the pointer.
   * Nothing under the pointer (an empty socket, no hand): nothing happens.
   */
  turnAt(this: AltarScene, cell: Cell | null, by: number): void {
    const hand = this.hand;
    const fixed = cell ? this.board.fixedAt(cell) : undefined;
    if (fixed && cell) {
      this.denyTurn(cell, fixed.gem, true);
      return;
    }
    if (cell && this.board.at(cell) && !hand?.from) {
      this.turnPlaced(cell, by);
      return;
    }
    if (hand) {
      if (!isRotational(hand.kind)) {
        this.denyTurn(null, hand.kind, false);
        return;
      }
      hand.rot = (hand.rot + by + 4) & 3;
      this.turned = true;
      this.ctx.sound.sfx.play('gemRotate', { pan: this.panOf(cell) });
      this.announce(`${GEM_NAME[hand.kind]} in hand: ${sidesText(hand.kind, hand.rot)}.`);
    }
  },

  /** Turn the player's gem at `cell` on the board (saved at once), or say why it won't turn. */
  turnPlaced(this: AltarScene, cell: Cell, by: number): void {
    const p = this.board.at(cell);
    if (!p) return;
    if (!isRotational(p.gem)) {
      this.denyTurn(cell, p.gem, false);
      return;
    }
    this.rotateAt(cell, by);
    this.turned = true;
    const q = this.board.at(cell);
    if (q) this.announce(`${GEM_NAME[q.gem]} turned: ${sidesText(q.gem, q.rot)}.`);
  },

  /**
   * A gem that will not turn says why, at that gem (or at the held gem), with the deny sound.
   * Fixed gems say they are part of the machine.
   */
  denyTurn(this: AltarScene, cell: Cell | null, gem: GemKind, fixed: boolean): void {
    const text = fixed && isRotational(gem) ? NO_TURN.bend : NO_TURN[gem];
    if (cell) {
      this.denyAt(cell, text);
    } else {
      // The held gem: tag it where it is drawn.
      this.ctx.sound.sfx.play('socketBlocked');
      const held = this.view.held;
      if (held) {
        this.clearTags();
        if (this.mode === 'result') this.backToEdit();
        this.addTag(held.x, held.y - this.view.layout.pitch * 0.42, text, 'info');
        this.tagTimer = 1.6;
      }
    }
    this.announce(text);
  },

  rotateAt(this: AltarScene, cell: Cell, by: number): void {
    const p = this.board.at(cell);
    if (!p || !isRotational(p.gem)) return;
    this.board.rotate(cell, by);
    this.ctx.sound.sfx.play('gemRotate', { pan: this.panOf(cell) });
    this.logRotate(cell);
    this.changed();
  },

  removeAt(this: AltarScene, cell: Cell): void {
    const p = this.board.at(cell);
    if (!p) {
      if (this.board.fixedAt(cell)) this.denyAt(cell, 'fixed');
      return;
    }
    this.board.remove(cell);
    this.ctx.sound.sfx.play('gemPick', { gem: p.gem, pan: this.panOf(cell) });
    this.logRemove(p.gem, cell);
    this.changed();
  },

  undo(this: AltarScene): void {
    if (this.mode === 'strike') return;
    this.dropHand();
    if (this.board.undo()) {
      this.resets++;
      this.logReset('undo');
      this.ctx.sound.sfx.play('gemRotate');
      this.changed();
    }
  },

  clear(this: AltarScene): void {
    if (this.mode === 'strike') return;
    this.dropHand();
    if (this.board.clear()) {
      this.resets++;
      this.logReset('clear');
      this.ctx.sound.sfx.play('gemPick');
      this.changed();
    }
  },

  back(this: AltarScene): void {
    this.ctx.fuse.hush();
    this.ctx.flow.closePuzzle();
  },

  logPlace(this: AltarScene, cell: Cell, from: Cell | null): void {
    if (!puzzleEventsWanted()) return;
    const p = this.board.at(cell);
    if (!p) return;
    emitPuzzleEvent({
      type: 'place',
      machine: this.machine,
      t: this.time,
      gem: p.gem,
      cell: { x: cell.x, y: cell.y },
      rot: p.rot,
      from: from ? { x: from.x, y: from.y } : null,
    });
  },

  logRemove(this: AltarScene, gem: GemKind, cell: Cell): void {
    if (!puzzleEventsWanted()) return;
    emitPuzzleEvent({
      type: 'remove',
      machine: this.machine,
      t: this.time,
      gem,
      cell: { x: cell.x, y: cell.y },
    });
  },

  logRotate(this: AltarScene, cell: Cell): void {
    if (!puzzleEventsWanted()) return;
    const p = this.board.at(cell);
    if (!p) return;
    emitPuzzleEvent({
      type: 'rotate',
      machine: this.machine,
      t: this.time,
      gem: p.gem,
      cell: { x: cell.x, y: cell.y },
      rot: p.rot,
    });
  },

  logReset(this: AltarScene, kind: 'clear' | 'undo'): void {
    if (!puzzleEventsWanted()) return;
    emitPuzzleEvent({
      type: 'reset',
      machine: this.machine,
      t: this.time,
      kind,
      placements: this.board.serialise(),
    });
  },

  inBounds(this: AltarScene, cell: Cell): boolean {
    const L = this.view.layout;
    return cell.x >= 0 && cell.y >= 0 && cell.x < L.cols && cell.y < L.rows;
  },

  hintHighlight(this: AltarScene, cell: Cell | null): boolean {
    if (cell && !this.inBounds(cell)) return false;
    this.hintCell = cell ? { x: cell.x, y: cell.y } : null;
    emitPuzzleEvent({
      type: 'hint',
      machine: this.machine,
      t: this.time,
      kind: 'highlight',
      cell: this.hintCell,
      gem: null,
    });
    return true;
  },

  hintLock(this: AltarScene, p: Placement): boolean {
    if (this.mode === 'strike' || !this.inBounds(p.cell)) return false;
    this.dropHand();
    const r = this.board.lock(p.cell, p.gem, p.rot);
    if (!r.ok) return false;
    if (this.hintCell && this.hintCell.x === p.cell.x && this.hintCell.y === p.cell.y) {
      this.hintCell = null;
    }
    this.ctx.sound.sfx.play('gemPlace', { gem: p.gem, pan: this.panOf(p.cell) });
    this.changed(p.cell);
    emitPuzzleEvent({
      type: 'hint',
      machine: this.machine,
      t: this.time,
      kind: 'lock',
      cell: { x: p.cell.x, y: p.cell.y },
      gem: p.gem,
    });
    return true;
  },

  updateTray(this: AltarScene): void {
    const L = this.view.layout;
    for (let i = 0; i < L.tray.length; i++) {
      const s = L.tray[i]!;
      const t = this.view.tray[i]!;
      const n = this.board.remaining(s.gem);
      const held = this.hand && !this.hand.from && this.hand.kind === s.gem;
      t.state = n === 0 ? 'dim' : held || i === this.hoverSlot ? 'hover' : 'idle';
      // All of a kind on the board: a dimmed, smaller silhouette stays in its slot ("all
      // placed" under it), so the tray keeps its shape and nothing there reads as a button.
      t.size = n === 0 && L.phone ? s.size * 0.8 : s.size;
      const lift = this.view.trayLift[i]!;
      const fresh = (i === 0 && this.teaching) || this.teachTray.has(s.gem);
      const bob =
        fresh && !this.hand && n > 0 && !this.view.reducedMotion
          ? 0.35 + 0.35 * Math.sin(this.time * 4 + i)
          : 0;
      this.view.trayLift[i] =
        lift < 0
          ? Math.min(0, lift + 0.05)
          : held
            ? 1
            : i === this.hoverSlot && (n > 0 || !L.phone)
              ? 0.6
              : bob;
    }
    // Held gem: follows the pointer, snaps to the socket it would land in.
    const hand = this.hand;
    const showHeld = hand && (hand.from ? this.press?.dragging : true);
    if (!hand || !showHeld) {
      this.view.held = null;
      this.showRefusal(null, null);
      return;
    }
    const pt = { x: 0, y: 0 };
    let snapped = false;
    let size: number | undefined;
    const p = this.ctx.input.pointer;
    const cell = this.keyboard ? this.cursor : this.hoverCell;
    let refused: string | null = null;
    if (cell) {
      cellCenter(L, cell, pt);
      // Over one of the player's placed gems (not dragging), that gem is what R turns: the
      // held gem waits beside it, so the placed gem stays in plain sight at its real turn.
      const overPlaced = !hand.from && !!this.board.at(cell);
      snapped =
        (!overPlaced && this.lands(cell, hand.kind)) ||
        (!!hand.from && hand.from.x === cell.x && hand.from.y === cell.y);
      if (!snapped) {
        // It will not land here: hold it off to the side so the gem or stone underneath stays
        // in plain sight (the reason sits above that socket).
        if (!overPlaced) refused = this.refusal(cell, hand.kind);
        pt.x += L.pitch * 0.62;
        pt.y += L.pitch * 0.12;
      }
    } else {
      // A dragging finger carries the gem at its aim point, lifted above the fingertip.
      const aim = p.type !== 'mouse' ? this.gestures?.aim : null;
      pt.x = aim ? aim.x : p.x;
      pt.y = aim ? aim.y : p.y;
      const finger = p.type !== 'mouse';
      if (this.keyboard || !p.inside || (finger && !this.press?.dragging)) {
        const i = L.tray.findIndex((s) => s.gem === hand.kind);
        const s = L.tray[Math.max(0, i)]!;
        pt.x = s.x;
        // Phones: it rests lifted in its own slot, under the title (mobile-4-board), a size up
        // inside its gold ring, so the gem in hand is unmistakable (mobile-6-board).
        pt.y = L.phone ? s.y : s.y - 70;
        if (L.phone) size = Math.round(s.size * 1.16);
      }
    }
    this.showRefusal(refused ? cell : null, refused);
    const h0 = this.view.held;
    if (h0) {
      h0.kind = hand.kind;
      h0.rot = hand.rot;
      h0.x = pt.x;
      h0.y = pt.y;
      h0.snapped = snapped;
      h0.size = size;
    } else this.view.held = { kind: hand.kind, rot: hand.rot, x: pt.x, y: pt.y, snapped, size };
  },

  /** With a gem in hand (not dragging), is the pointer or cursor on one of the player's gems? */
  overPlaced(this: AltarScene): boolean {
    const cell = this.keyboard ? this.cursor : this.hoverCell;
    return !!cell && !!this.hand && !this.hand.from && !!this.board.at(cell);
  },

  /** Why the held gem will not land in `cell` (fixed gem, carved stone, off the altar). */
  refusal(this: AltarScene, cell: Cell, kind: GemKind): string {
    if (this.board.fixedAt(cell)) return 'fixed';
    if (this.board.isBlocked(cell)) return 'blocked';
    const r = this.board.check(cell, kind);
    return r.ok ? 'occupied' : r.reason;
  },

  showRefusal(this: AltarScene, cell: Cell | null, reason: string | null): void {
    const key = cell && reason ? `${cell.x},${cell.y}` : '';
    if (key === this.refusedKey) return;
    // A deny tag still showing (a click just refused) keeps its place.
    if (this.refusedKey && this.tagTimer <= 0) this.clearTags();
    this.refusedKey = key;
    // No idle hints over a verdict: the fizzle tags and the Try line have the floor.
    if (!cell || !reason || this.tagTimer > 0 || !this.verdict.hidden) return;
    const pt = { x: 0, y: 0 };
    cellCenter(this.view.layout, cell, pt);
    this.addTag(pt.x, pt.y - this.view.layout.pitch * 0.42, DENY_REASON[reason] ?? reason, 'info');
  },
};
