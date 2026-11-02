/**
 * The altar: build a circuit, fire the storm, read what happened.
 *
 * Modes
 *   edit    place / move / rotate / remove gems (pointer, keyboard, gamepad)
 *   strike  the bolt is running; input only skips (click, Enter, Esc) or fast-forwards (hold F)
 *   result  the verdict is showing; any edit drops back to `edit`
 *
 * Pointer: click a tray gem to hold it (stays in hand while the tray has more), click a socket
 * to place. Drag from the tray or drag a placed gem to move it; drop it off the altar to put
 * it back. Click a placed Bend/Gate to turn it; click any other placed gem to pick it up.
 * Right-click removes. Scroll turns. Keyboard/pad: a gold cursor walks the sockets (arrows,
 * WASD, d-pad, stick); 1-6 / T / LB pick from the tray; Enter/A acts at the cursor.
 *
 * Flow hooks: `savePlacements` on every change, `recordAttempt` on every strike,
 * `completePuzzle` on exact (swaps to the solve moment), `closePuzzle` on back.
 */
import type { Frame, RGBA } from '@engine/render';
import { button, h } from '@engine/ui';
import { POST_PRESETS } from '../../art/materials/post-presets';
import type { BoltMode, BoltSegment } from '../../art/props/bolt';
import { GEM_COLOUR, pitch } from '../../art/props/palette';
import type { BoltHandle, StormCellHandle } from '../../audio';
import { machineLine, reactionLine } from '../../content/lines';
import { puzzleFor } from '../../content/puzzles';
import type { GameCtx, GameScene } from '../../game/ctx';
import type { BoltOutcome } from '../../game/flow';
import {
  isRotational,
  type Placement,
  type PuzzleDef,
  type SimResult,
  simulate,
} from '../../rules';
import { getMachine } from '../../rules/progression';
import type { Cell, GemKind, MachineId } from '../../rules/types';
import { ensureAltarStyles } from './altar-styles';
import { AltarView, DANGER, GOLD } from './altar-view';
import { BoardState } from './board';
import { emitPuzzleEvent } from './events';
import { anchorOf, cellAt, cellCenter, traySlotAt } from './layout';
import {
  type Arrival,
  buildTimeline,
  causeText,
  type Fizzle,
  fizzles,
  gemsUsed,
  type StrikeTimeline,
} from './strike';

type Mode = 'edit' | 'strike' | 'result';

interface Hand {
  kind: GemKind;
  rot: number;
  /** Dragging a placed gem: where it came from (it stays on the board until dropped). */
  from: Cell | null;
}

interface Press {
  origin: 'tray' | 'board';
  cell: Cell | null;
  x: number;
  y: number;
  dragging: boolean;
}

const GEM_NAME: Record<GemKind, string> = {
  channel: 'Channel',
  bend: 'Bend',
  split: 'Split',
  amplify: 'Amplify',
  gate: 'Gate',
  capacitor: 'Capacitor',
};

const DENY_REASON: Record<string, string> = {
  blocked: 'Carved stone: nothing fits here',
  fixed: 'Part of the machine: it stays',
  'tray-empty': 'None left in the tray',
  'out-of-bounds': 'Off the altar',
  occupied: 'Socket taken',
};

const SLOT_ACTIONS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
const CYAN: RGBA = [0.25, 1.3, 1.8, 1];
const FIXED_RING: RGBA = [GOLD[0] * 0.8, GOLD[1] * 0.8, GOLD[2] * 0.8, 1];
const WHITE_HOT: RGBA = [2, 2, 2, 1];
/** Socket hum colour per gem (the socket glows in the held gem's colour when it fits). */
const HUM = Object.fromEntries(
  (Object.keys(GEM_COLOUR) as GemKind[]).map((k) => [k, pitch(GEM_COLOUR[k], 1.3)]),
) as Record<GemKind, RGBA>;
const DRAG_PX = 10;
/** Seconds per sim tick at normal speed. */
const TICK = 0.15;
const SKIP_RATE = 10;
const FF_RATE = 3;

export class AltarScene implements GameScene {
  readonly name = 'altar';
  private ctx!: GameCtx;
  private puzzle!: PuzzleDef;
  private board!: BoardState;
  private view!: AltarView;
  private mode: Mode = 'edit';
  private hand: Hand | null = null;
  private press: Press | null = null;
  private cursor: Cell = { x: 0, y: 0 };
  private keyboard = false;
  private lastPointer = { x: -1, y: -1 };
  private hoverCell: Cell | null = null;
  private hoverSlot = -1;
  private deny: { cell: Cell; t: number } | null = null;
  private postSnapshot: unknown = null;
  private hum: StormCellHandle | null = null;
  private boltSound: BoltHandle | null = null;
  private bloomBase = 0.85;
  private bloomBoost = 0;

  // Strike playback
  private result: SimResult | null = null;
  private timeline: StrikeTimeline | null = null;
  private fizzleList: Fizzle[] = [];
  private pulseSegs: BoltSegment[][] = [];
  private st = 0;
  private pulse = -1;
  private arrival = 0;
  private rate = 1;
  private skipping = false;
  private verdictShown = false;
  private wakeTimer = -1;
  private readings: number[] = [];
  private pulseEnded = -1;
  private strikeRevision = -1;
  private resultAge = 0;

  // Session stats (dev hook)
  private openedAt = 0;
  private time = 0;
  private attempts = 0;
  private resets = 0;
  private outcomes: Record<BoltOutcome, number> = { dead: 0, under: 0, exact: 0, over: 0 };
  private solved = false;

  // DOM
  private dom!: HTMLElement;
  private subtitle!: HTMLElement;
  private verdict!: HTMLElement;
  private strikeBtn!: HTMLButtonElement;
  private undoBtn!: HTMLButtonElement;
  private clearBtn!: HTMLButtonElement;
  private counts: HTMLElement[] = [];
  private needs: HTMLElement[] = [];
  private tags: HTMLElement[] = [];

  constructor(readonly machine: MachineId) {}

  // ── Lifecycle ───────────────────────────────────────────────────────────

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    this.puzzle = puzzleFor(this.machine);
    this.board = new BoardState(this.puzzle);
    this.board.restore(ctx.flow.placementsFor(this.machine) as Placement[]);
    this.view = new AltarView(ctx, this.puzzle);
    this.view.reducedMotion = ctx.settings.reducedMotion;
    this.view.syncBoard(this.board);
    this.cursor = {
      x: 0,
      y: this.puzzle.storm.at.y >= 0 ? Math.max(0, this.puzzle.storm.at.y) : 0,
    };
    this.cursor.y = Math.min(this.cursor.y, this.view.layout.rows - 1);

    this.postSnapshot = structuredClone(ctx.post.settings);
    ctx.post.set(POST_PRESETS.altar);
    this.bloomBase = ctx.post.settings.bloom.intensity;
    this.setMood();
    this.hum = ctx.sound.sfx.stormCell(this.puzzle.storm.strength, 0.8);

    ensureAltarStyles(ctx.ui.root.ownerDocument);
    this.buildDom();
    this.refreshHud();

    const saved = ctx.save.get().puzzles[this.machine];
    if (!saved || saved.attempts === 0) {
      const arrive = machineLine(this.machine, 'arrive');
      if (arrive) void ctx.fuse.say(arrive, { interrupt: true });
    }
    emitPuzzleEvent({ type: 'open', machine: this.machine, t: 0 });
  }

  exit(): void {
    this.ctx.flow.savePlacements(this.machine, this.board.serialise());
    this.boltSound?.stop(0.2);
    this.boltSound = null;
    this.hum?.stop(0.4);
    this.hum = null;
    this.view.dispose();
    this.dom.remove();
    if (this.postSnapshot) this.ctx.post.set(this.postSnapshot as typeof this.ctx.post.settings);
    // particles.clear() is broken in engine (buffer lacks COPY_DST); particles die on their own.
    emitPuzzleEvent({
      type: 'close',
      machine: this.machine,
      t: this.time,
      solved: this.solved,
      seconds: this.time - this.openedAt,
      attempts: this.attempts,
      resets: this.resets,
      outcomes: { ...this.outcomes },
    });
  }

  pause(): void {
    this.ctx.fuse.hush();
  }

  resume(): void {
    this.setMood();
  }

  private setMood(): void {
    this.ctx.setMood(this.machine === 'the-last-rune' ? 'last-rune' : 'altar');
  }

  // ── DOM ─────────────────────────────────────────────────────────────────

  private buildDom(): void {
    const L = this.view.layout;
    const btn = (label: string, key: string, fn: () => void, gold = false, action = '') => {
      const b = button(
        h('span', null, label, h('kbd', { 'aria-hidden': 'true' }, key)),
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
    this.undoBtn = btn('Undo', 'Z', () => this.undo(), false, 'undo');
    this.clearBtn = btn('Clear', 'Del', () => this.clear(), false, 'clear');
    this.strikeBtn = btn('Strike', 'F', () => this.strike(), true, 'strike');
    const back = btn('Back', 'Esc', () => this.back(), false, 'back');
    this.subtitle = h('small');
    this.verdict = h('div', {
      class: 'lr-altar-verdict',
      role: 'status',
      'aria-live': 'polite',
      hidden: true,
    });
    this.counts = L.tray.map((s) =>
      h('div', { class: 'lr-altar-count', style: { left: `${s.x}px`, top: `${s.y + 40}px` } }),
    );
    this.needs = L.machines.map((m) => {
      const k = m.size / 2;
      const y = m.side === 2 ? m.y + 0.62 * k + 34 : m.y - 0.62 * k;
      return h('div', { class: 'lr-altar-need', style: { left: `${m.x}px`, top: `${y}px` } });
    });
    const hint = h(
      'div',
      { class: 'lr-altar-hint' },
      h('b', null, 'Click'),
      ' a gem, then a socket · ',
      h('b', null, 'R'),
      '/scroll turns · ',
      h('b', null, 'Right-click'),
      ' removes · arrows + ',
      h('b', null, 'Enter'),
      ' to play by keyboard · hold ',
      h('b', null, 'F'),
      ' to fast-forward',
    );
    this.dom = h(
      'div',
      { class: 'lr-altar', role: 'region', 'aria-label': `${getMachine(this.machine).name} altar` },
      h(
        'div',
        { class: 'lr-altar-title' },
        h('h2', null, getMachine(this.machine).name),
        this.subtitle,
      ),
      h('div', { class: 'lr-altar-actions' }, this.undoBtn, this.clearBtn, back, this.strikeBtn),
      this.verdict,
      ...this.counts,
      ...this.needs,
      hint,
    );
    this.ctx.ui.layers.hud.append(this.dom);
  }

  private refreshHud(): void {
    const L = this.view.layout;
    L.tray.forEach((s, i) => {
      const el = this.counts[i]!;
      const n = this.board.remaining(s.gem);
      el.replaceChildren(h('span', { class: 'lr-k' }, String(i + 1)), `×${n}`);
      el.toggleAttribute('data-empty', n === 0);
      el.toggleAttribute('data-held', this.hand?.kind === s.gem && !this.hand.from);
      el.title = GEM_NAME[s.gem];
    });
    this.puzzle.machines.forEach((m, i) => {
      const el = this.needs[i]!;
      if (this.mode === 'edit' || !this.result) {
        el.textContent = `Needs ${m.need}`;
        el.removeAttribute('data-state');
      }
    });
    this.undoBtn.disabled = !this.board.canUndo || this.mode === 'strike';
    this.clearBtn.disabled = this.board.isEmpty || this.mode === 'strike';
    this.strikeBtn.disabled = this.mode === 'strike';
    if (this.mode === 'edit') {
      const p = this.puzzle.pulses;
      const s = this.puzzle.storm.strength;
      this.subtitle.textContent =
        `Storm ×${s}` +
        (p > 1 ? ` · ${p} strikes` : '') +
        (this.attempts > 0 ? ` · try ${this.attempts + 1}` : '');
    }
  }

  private showVerdict(text: string, outcome: BoltOutcome): void {
    this.verdict.textContent = text;
    this.verdict.dataset.outcome = outcome;
    this.verdict.hidden = false;
  }

  private addTag(x: number, y: number, text: string, tone: 'bad' | 'info' = 'bad'): void {
    const el = h('div', { class: 'lr-altar-tag', style: { left: `${x}px`, top: `${y}px` } }, text);
    if (tone === 'info') el.dataset.tone = 'info';
    this.dom.append(el);
    this.tags.push(el);
  }

  private clearTags(): void {
    for (const t of this.tags) t.remove();
    this.tags.length = 0;
  }

  // ── Edits ───────────────────────────────────────────────────────────────

  private changed(placed: Cell | null = null): void {
    if (this.mode === 'result') this.backToEdit();
    this.view.syncBoard(this.board, placed);
    this.ctx.flow.savePlacements(this.machine, this.board.serialise());
    if (this.hand && !this.hand.from && this.board.remaining(this.hand.kind) <= 0) this.hand = null;
    this.refreshHud();
  }

  private denyAt(cell: Cell | null, reason: string): void {
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
  }

  private tagTimer = 0;

  private panOf(cell: Cell | null): number {
    if (!cell) return 0;
    const pt = { x: 0, y: 0 };
    cellCenter(this.view.layout, cell, pt);
    return Math.max(-1, Math.min(1, (pt.x - 960) / 960));
  }

  private takeFromTray(kind: GemKind, keepRot = false): void {
    if (this.board.remaining(kind) <= 0) {
      this.ctx.sound.sfx.play('socketBlocked');
      const i = this.view.layout.tray.findIndex((s) => s.gem === kind);
      if (i >= 0) this.view.trayLift[i] = -0.3;
      return;
    }
    const rot = keepRot && this.hand?.kind === kind ? this.hand.rot : 0;
    this.hand = { kind, rot, from: null };
    this.ctx.sound.sfx.play('gemPick', { gem: kind });
    this.refreshHud();
  }

  private dropHand(): void {
    if (!this.hand) return;
    if (this.hand.from) {
      const b = this.view.gemAt(this.hand.from);
      if (b) b.hidden = false;
    }
    this.hand = null;
    this.refreshHud();
  }

  private placeHand(cell: Cell): void {
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
        this.view.syncBoard(this.board);
        return;
      }
      const other = this.board.at(cell);
      if (other) {
        // Swap the two gems (three undo steps; the board has no compound edit).
        this.board.remove(cell);
        this.board.move(from, cell);
        this.board.place(from, other.gem, other.rot);
      } else {
        const r = this.board.move(from, cell);
        if (!r.ok) {
          this.view.syncBoard(this.board);
          this.denyAt(cell, r.reason);
          return;
        }
      }
      this.ctx.sound.sfx.play('gemPlace', {
        gem: this.board.at(cell)?.gem ?? hand.kind,
        pan: this.panOf(cell),
      });
      this.changed(cell);
      return;
    }
    const existing = this.board.at(cell);
    if (existing) {
      if (existing.gem === hand.kind) {
        if (isRotational(hand.kind) && existing.rot !== (hand.rot & 3)) {
          this.board.rotate(cell, ((hand.rot & 3) - existing.rot + 4) & 3);
          this.ctx.sound.sfx.play('gemRotate');
          this.changed();
        }
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
    this.changed(cell);
  }

  /** Click / Enter on a placed gem with an empty hand. */
  private actOnGem(cell: Cell): void {
    const p = this.board.at(cell);
    if (p) {
      if (isRotational(p.gem)) this.rotateAt(cell, 1);
      else {
        this.board.remove(cell);
        this.hand = { kind: p.gem, rot: p.rot, from: null };
        this.ctx.sound.sfx.play('gemPick', { gem: p.gem });
        this.changed();
      }
      return;
    }
    if (this.board.fixedAt(cell)) {
      this.denyAt(cell, 'fixed');
      return;
    }
    if (this.board.isBlocked(cell)) {
      this.denyAt(cell, 'blocked');
      return;
    }
  }

  private rotateAt(cell: Cell, by: number): void {
    const p = this.board.at(cell);
    if (!p) {
      if (this.board.fixedAt(cell)) this.denyAt(cell, 'fixed');
      return;
    }
    if (!isRotational(p.gem)) return;
    this.board.rotate(cell, by);
    this.ctx.sound.sfx.play('gemRotate', { pan: this.panOf(cell) });
    this.changed();
  }

  private removeAt(cell: Cell): void {
    const p = this.board.at(cell);
    if (!p) {
      if (this.board.fixedAt(cell)) this.denyAt(cell, 'fixed');
      return;
    }
    this.board.remove(cell);
    this.ctx.sound.sfx.play('gemPick', { gem: p.gem, pan: this.panOf(cell) });
    this.changed();
  }

  private undo(): void {
    if (this.mode === 'strike') return;
    this.dropHand();
    if (this.board.undo()) {
      this.resets++;
      emitPuzzleEvent({ type: 'reset', machine: this.machine, t: this.time, kind: 'undo' });
      this.ctx.sound.sfx.play('gemRotate');
      this.changed();
    }
  }

  private clear(): void {
    if (this.mode === 'strike') return;
    this.dropHand();
    if (this.board.clear()) {
      this.resets++;
      emitPuzzleEvent({ type: 'reset', machine: this.machine, t: this.time, kind: 'clear' });
      this.ctx.sound.sfx.play('gemPick');
      this.changed();
    }
  }

  private back(): void {
    this.ctx.fuse.hush();
    this.ctx.flow.closePuzzle();
  }

  // ── Strike ──────────────────────────────────────────────────────────────

  private strike(): void {
    if (this.mode === 'strike') return;
    this.dropHand();
    if (this.mode === 'result') this.backToEdit();
    const placements = this.board.serialise();
    const result = simulate(this.puzzle, placements);
    const tl = buildTimeline(result, { tickSeconds: TICK, pulseGap: 0.9, verdictDelay: 0.45 });
    this.result = result;
    this.timeline = tl;
    this.fizzleList = fizzles(this.puzzle, placements, result, tl);
    this.attempts++;
    this.outcomes[result.outcome]++;
    this.ctx.flow.recordAttempt(this.machine, result.outcome);
    emitPuzzleEvent({
      type: 'strike',
      machine: this.machine,
      t: this.time,
      outcome: result.outcome,
      attempt: this.attempts,
      gems: placements.length,
    });

    // Ribbons: one per strike; the verdict strike plays in the outcome's mode, with the
    // segment that decides it (tripped machine / last fizzle) last so the ribbon ends there.
    const n = tl.pulses.length;
    this.pulseSegs = [];
    for (let i = 0; i < n; i++) {
      const segs = this.view.boltSegments(tl, i, []);
      if (i === n - 1) this.orderForVerdict(segs, result);
      this.pulseSegs.push(segs);
    }
    this.view.orientAlong(tl);
    this.view.deenergise();
    for (const m of this.view.machines) m.reset();
    this.readings = this.puzzle.machines.map(() => 0);
    this.st = 0;
    this.pulse = -1;
    this.pulseEnded = -1;
    this.arrival = 0;
    this.verdictShown = false;
    this.wakeTimer = -1;
    this.skipping = false;
    this.rate = this.board.revision === this.strikeRevision ? 2 : 1; // repeats run quicker
    this.strikeRevision = this.board.revision;
    this.mode = 'strike';
    this.subtitle.textContent = n > 1 ? `Strike 1 of ${n}` : 'Strike';
    this.ctx.fuse.hush();
    this.refreshHud();
  }

  private orderForVerdict(segs: BoltSegment[], result: SimResult): void {
    if (segs.length < 2) return;
    let key = -1;
    if (result.outcome === 'over' || result.outcome === 'exact' || result.outcome === 'under') {
      // Last segment that lands on a machine.
      const L = this.view.layout;
      for (let i = segs.length - 1; i >= 0 && key < 0; i--) {
        const s = segs[i]!;
        if (L.machines.some((m) => Math.abs(m.port.x - s.bx) < 1 && Math.abs(m.port.y - s.by) < 1))
          key = i;
      }
    }
    if (key < 0) {
      // Dead: end where the latest bolt died.
      let best = -1;
      for (let i = 0; i < segs.length; i++) if (best < 0 || segs[i]!.t1 >= segs[best]!.t1) best = i;
      key = best;
    }
    if (key >= 0 && key !== segs.length - 1) {
      const [s] = segs.splice(key, 1);
      segs.push(s!);
    }
  }

  private outcomeMode(o: BoltOutcome): BoltMode {
    return o === 'over' ? 'over' : o === 'exact' ? 'exact' : 'under';
  }

  private get reduceFlashes(): boolean {
    const eff = this.ctx.settings.effective as unknown as Record<string, unknown>;
    return eff.reduceFlashes === true || this.ctx.settings.reducedMotion;
  }

  private startPulse(i: number): void {
    const tl = this.timeline!;
    const res = this.result!;
    const last = i === tl.pulses.length - 1;
    const bolts = this.view.bolts;
    if (i > 0) bolts[i - 1]!.fadeOut(0.5);
    const bolt = bolts[i]!;
    const mode = last ? this.outcomeMode(res.outcome) : 'exact';
    bolt.intensity = mode === 'over' && this.reduceFlashes ? 0.45 : 1;
    bolt.play(this.pulseSegs[i]!, mode);
    this.view.setActiveBolts(i + 1);
    this.view.storm.surge(1);
    this.view.shake = Math.max(this.view.shake, 0.25 + 0.1 * this.puzzle.storm.strength);
    const sx = (this.view.layout.storm.x - 960) / 960;
    if (!this.skipping) this.ctx.sound.sfx.play('thunder', { near: true, pan: sx });
    this.boltSound?.stop(0.1);
    this.boltSound = this.skipping
      ? null
      : this.ctx.sound.sfx.bolt(0.6 + 0.1 * this.puzzle.storm.strength);
    // New strike: machines not yet awake start counting again; stored charge is released.
    for (let m = 0; m < this.readings.length; m++) {
      const mr = res.machines[m]!;
      if (mr.wokeOn >= 0 && mr.wokeOn < i) continue;
      this.readings[m] = 0;
      this.view.machines[m]!.gauge = 0;
    }
    for (const b of this.view.board) {
      b.holding = false;
      if (i > 0) b.energyTarget = 0;
    }
    if (tl.pulses.length > 1) this.subtitle.textContent = `Strike ${i + 1} of ${tl.pulses.length}`;
  }

  private onArrival(a: Arrival): void {
    const L = this.view.layout;
    const quiet = this.skipping;
    switch (a.end) {
      case 'gem':
      case 'store':
      case 'wait': {
        const b = this.view.gemAt(a.cell);
        if (b) {
          b.energyTarget = a.end === 'wait' ? 0.6 : 1;
          if (a.end === 'store') b.holding = true;
        }
        if (!quiet) {
          const kind = b?.g.kind ?? a.colour;
          this.ctx.sound.sfx.play('boltStep', {
            gem: kind,
            charge: a.charge,
            pan: this.panOf(a.cell),
          });
        }
        this.boltSound?.setIntensity(0.4 + 0.15 * Math.min(a.charge, 4), 0.05);
        break;
      }
      case 'machine': {
        const m = a.machine;
        if (m < 0) break;
        this.readings[m] = (this.readings[m] ?? 0) + a.charge;
        const need = this.puzzle.machines[m]!.need;
        this.view.machines[m]!.gauge = Math.min(1.25, this.readings[m]! / need);
        const el = this.needs[m]!;
        el.textContent = `Needs ${need} · got ${this.readings[m]}`;
        break;
      }
      case 'fizzle':
      case 'ground': {
        const pt = { x: 0, y: 0 };
        anchorOf(L, a.cell, pt);
        this.ctx.particles.emit(
          {
            x: pt.x,
            y: pt.y,
            speed: [30, 160],
            life: [0.3, 0.8],
            size: [5, 1],
            colorStart: [1.6, 0.5, 0.25, 1],
            colorEnd: [0.2, 0.2, 0.22, 0],
            gravity: [0, -60],
            emissive: 0.8,
          },
          18,
        );
        if (!quiet) this.ctx.sound.sfx.play('fuseBzzt', { gain: 0.5, pan: this.panOf(a.cell) });
        break;
      }
    }
  }

  /** All arrivals of strike `i` are in: settle each machine for this strike. */
  private endPulse(i: number): void {
    const res = this.result!;
    this.boltSound?.stop(0.25);
    this.boltSound = null;
    for (let m = 0; m < res.machines.length; m++) {
      const mr = res.machines[m]!;
      if (mr.wokeOn >= 0 && mr.wokeOn < i) continue;
      const got = mr.readings[i] ?? this.readings[m] ?? 0;
      const need = mr.need;
      const prop = this.view.machines[m]!;
      const el = this.needs[m]!;
      el.textContent = `Needs ${need} · got ${got}`;
      if (got === need && mr.wokeOn === i) {
        prop.solve();
        el.dataset.state = 'exact';
        this.ctx.sound.sfx.play('machineExact');
      } else if (got > need) {
        prop.breaker();
        el.dataset.state = 'over';
        this.breaker();
      } else if (got > 0) {
        el.dataset.state = 'under';
        if (i === res.pulsesRun - 1) this.ctx.sound.sfx.play('machineUnder');
      } else el.dataset.state = 'under';
    }
    // Capacitors keep glowing between strikes.
    for (const b of this.view.board)
      if (!b.holding) b.energyTarget = Math.min(b.energyTarget, 0.35);
  }

  private breaker(): void {
    const soft = this.reduceFlashes;
    this.ctx.sound.sfx.play('breakerTrip');
    if (!soft) {
      this.view.shake = 1;
      this.bloomBoost = 1.4;
      this.view.bolts[Math.max(0, this.pulse)]!.flash(1);
    } else {
      this.bloomBoost = 0.15;
    }
  }

  private showResult(): void {
    const res = this.result!;
    this.verdictShown = true;
    this.mode = 'result';
    this.resultAge = 0;
    const L = this.view.layout;
    const o = res.outcome;
    const ms = res.machines;
    const label = (i: number) =>
      ms.length > 1 ? `${['First', 'Second', 'Third', 'Fourth'][i]} machine: ` : '';
    if (o === 'exact') {
      this.showVerdict('Exactly right. It wakes.', 'exact');
      this.wakeTimer = this.ctx.settings.reducedMotion ? 0.9 : 1.5;
      this.solved = true;
      this.ctx.sound.music.duck(0.5, 1.6);
    } else {
      const over = ms.findIndex((m) => m.outcome === 'over');
      const under = ms.findIndex((m) => m.outcome !== 'exact' && m.outcome !== 'over');
      if (o === 'over') {
        const m = ms[over]!;
        this.showVerdict(
          `${label(over)}Breaker tripped: needs ${m.need}, got ${this.lastReading(m)}`,
          'over',
        );
      } else if (o === 'under') {
        const m = ms[under] ?? ms[0]!;
        this.showVerdict(
          `${label(under)}Not enough: needs ${m.need}, got ${this.lastReading(m)}`,
          'under',
        );
      } else {
        this.showVerdict('No charge reached the machine', 'dead');
      }
      // Teaching: name where it went wrong (first few fizzles, last strike first).
      const shown = new Set<string>();
      let count = 0;
      const pt = { x: 0, y: 0 };
      for (let i = this.fizzleList.length - 1; i >= 0 && count < 3; i--) {
        const f = this.fizzleList[i]!;
        const k = `${f.cell.x},${f.cell.y}`;
        if (shown.has(k)) continue;
        shown.add(k);
        anchorOf(L, f.cell, pt);
        this.addTag(pt.x, pt.y - L.pitch * 0.38, causeText(f.cause));
        count++;
      }
      const line = reactionLine(
        o,
        Math.min(3, this.ctx.tier()) as 1 | 2 | 3,
        gemsUsed(res),
        this.attempts - 1,
      );
      if (line) void this.ctx.fuse.say(line, { interrupt: true });
    }
    this.subtitle.textContent =
      o === 'exact' ? 'Restored' : `Attempt ${this.attempts} · change anything to try again`;
    this.refreshHud();
  }

  private lastReading(m: SimResult['machines'][number]): number {
    for (let i = m.readings.length - 1; i >= 0; i--)
      if ((m.readings[i] ?? 0) > 0) return m.readings[i]!;
    return 0;
  }

  /** Leave the result: bolts fade, gems cool, gauges drop. */
  private backToEdit(): void {
    this.mode = 'edit';
    this.verdict.hidden = true;
    this.clearTags();
    this.view.deenergise();
    for (const b of this.view.bolts) b.fadeOut(0.35);
    for (const m of this.view.machines) m.reset();
    this.wakeTimer = -1;
    this.refreshHud();
  }

  private skip(): void {
    if (this.skipping) return;
    this.skipping = true;
    this.rate = SKIP_RATE;
    this.boltSound?.stop(0.1);
    this.boltSound = null;
  }

  private updateStrike(dt: number): void {
    const input = this.ctx.input;
    if (input.pressed('select') || input.pressed('confirm') || input.pressed('cancel')) this.skip();
    const rate = this.skipping
      ? SKIP_RATE
      : input.held('strike') && !input.pressed('strike')
        ? FF_RATE
        : this.rate;
    this.view.boltRate = rate;
    this.st += dt * rate;
    const tl = this.timeline!;
    while (this.pulse + 1 < tl.pulses.length && this.st >= tl.pulses[this.pulse + 1]!.start) {
      this.startPulse(++this.pulse);
    }
    while (this.arrival < tl.arrivals.length && tl.arrivals[this.arrival]!.t <= this.st) {
      this.onArrival(tl.arrivals[this.arrival++]!);
    }
    while (this.pulseEnded < this.pulse && this.st >= tl.pulses[this.pulseEnded + 1]!.end) {
      this.endPulse(++this.pulseEnded);
    }
    if (this.st >= tl.verdictAt && !this.verdictShown) {
      this.view.boltRate = 1;
      this.showResult();
    }
  }

  // ── Frame ───────────────────────────────────────────────────────────────

  update(dt: number): void {
    const ctx = this.ctx;
    const input = ctx.input;
    this.time += dt;
    this.view.reducedMotion = ctx.settings.reducedMotion;

    if (this.mode === 'strike') this.updateStrike(dt);
    else this.updateEdit(dt);

    if (this.mode === 'result') {
      this.resultAge += dt;
      if (this.resultAge > 1.4 && this.result?.outcome !== 'exact') {
        for (const b of this.view.board) if (!b.holding) b.energyTarget = 0;
      }
      if (this.wakeTimer >= 0) {
        if (input.pressed('select') || input.pressed('confirm')) this.wakeTimer = 0;
        this.wakeTimer -= dt;
        if (this.wakeTimer <= 0) {
          this.wakeTimer = -1;
          ctx.flow.savePlacements(this.machine, this.board.serialise());
          ctx.flow.completePuzzle(this.machine);
          return;
        }
      }
    }

    if (this.tagTimer > 0) {
      this.tagTimer -= dt;
      if (this.tagTimer <= 0 && this.mode === 'edit') this.clearTags();
    }
    if (this.deny) {
      this.deny.t -= dt;
      if (this.deny.t <= 0) this.deny = null;
    }

    // Bloom swell / breaker spike.
    this.bloomBoost = Math.max(0, this.bloomBoost - dt * 1.6);
    const wake = this.wakeTimer >= 0 ? 1 : 0;
    this.view.wake += (wake - this.view.wake) * (1 - Math.exp(-3 * dt));
    ctx.post.settings.bloom.intensity =
      this.bloomBase * (1 + this.bloomBoost + 0.6 * this.view.wake);

    this.updateFuse();
    this.updateTray();
    this.buildMarks();
    this.view.update(dt);
  }

  private updateEdit(_dt: number): void {
    const input = this.ctx.input;
    const L = this.view.layout;
    const p = input.pointer;
    const moved = p.x !== this.lastPointer.x || p.y !== this.lastPointer.y;
    if (moved) {
      this.lastPointer.x = p.x;
      this.lastPointer.y = p.y;
      if (p.inside) this.keyboard = false;
    }
    this.hoverCell = p.inside && !this.keyboard ? cellAt(L, p.x, p.y) : null;
    this.hoverSlot = p.inside && !this.keyboard ? traySlotAt(L, p.x, p.y) : -1;

    // ── Pointer ──
    if (input.pressed('select') && p.inside) {
      this.keyboard = false;
      if (this.hoverSlot >= 0) {
        const kind = L.tray[this.hoverSlot]!.gem;
        if (this.hand && !this.hand.from && this.hand.kind === kind) {
          this.press = { origin: 'tray', cell: null, x: p.x, y: p.y, dragging: false };
        } else {
          this.takeFromTray(kind);
          if (this.hand)
            this.press = { origin: 'tray', cell: null, x: p.x, y: p.y, dragging: false };
        }
      } else if (this.hoverCell) {
        const cell = this.hoverCell;
        if (this.hand) this.placeHand(cell);
        else if (this.board.at(cell)) {
          this.press = { origin: 'board', cell, x: p.x, y: p.y, dragging: false };
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
    if (press && input.released('select')) {
      this.press = null;
      if (press.dragging) {
        const cell = cellAt(L, p.x, p.y);
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
        this.actOnGem(press.cell);
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
      if (this.keyboard) {
        this.cursor.x = Math.max(0, Math.min(L.cols - 1, this.cursor.x + dx));
        this.cursor.y = Math.max(0, Math.min(L.rows - 1, this.cursor.y + dy));
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
      }
    }
    if (input.pressed('trayNext')) this.cycleTray();
    const target = this.keyboard ? this.cursor : this.hoverCell;
    if (input.pressed('confirm') && this.keyboard) {
      if (this.hand) this.placeHand(this.cursor);
      else this.actOnGem(this.cursor);
    }
    const turn = (input.pressed('rotate') ? 1 : 0) - (input.pressed('rotateBack') ? 1 : 0);
    if (turn !== 0) {
      if (this.hand && isRotational(this.hand.kind)) {
        this.hand.rot = (this.hand.rot + turn + 4) & 3;
        this.ctx.sound.sfx.play('gemRotate');
      } else if (!this.hand && target) this.rotateAt(target, turn);
    }
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
  }

  private cycleTray(): void {
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
  }

  private updateFuse(): void {
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
  }

  private updateTray(): void {
    const L = this.view.layout;
    for (let i = 0; i < L.tray.length; i++) {
      const s = L.tray[i]!;
      const t = this.view.tray[i]!;
      const n = this.board.remaining(s.gem);
      const held = this.hand && !this.hand.from && this.hand.kind === s.gem;
      t.state = n === 0 ? 'dim' : held || i === this.hoverSlot ? 'hover' : 'idle';
      const lift = this.view.trayLift[i]!;
      this.view.trayLift[i] =
        lift < 0 ? Math.min(0, lift + 0.05) : held ? 1 : i === this.hoverSlot ? 0.6 : 0;
    }
    // Held gem: follows the pointer, snaps to the socket it would land in.
    const hand = this.hand;
    const showHeld = hand && (hand.from ? this.press?.dragging : true);
    if (!hand || !showHeld) {
      this.view.held = null;
      return;
    }
    const pt = { x: 0, y: 0 };
    let snapped = false;
    const p = this.ctx.input.pointer;
    const cell = this.keyboard ? this.cursor : this.hoverCell;
    if (cell) {
      cellCenter(L, cell, pt);
      snapped = this.board.check(cell, hand.kind).ok || !!hand.from || !!this.board.at(cell);
      if (!snapped && !this.keyboard) {
        pt.x = p.x;
        pt.y = p.y;
      }
    } else {
      pt.x = p.x;
      pt.y = p.y;
      if (this.keyboard || !p.inside) {
        const i = L.tray.findIndex((s) => s.gem === hand.kind);
        const s = L.tray[Math.max(0, i)]!;
        pt.x = s.x;
        pt.y = s.y - 70;
      }
    }
    const h0 = this.view.held;
    if (h0) {
      h0.kind = hand.kind;
      h0.rot = hand.rot;
      h0.x = pt.x;
      h0.y = pt.y;
      h0.snapped = snapped;
    } else this.view.held = { kind: hand.kind, rot: hand.rot, x: pt.x, y: pt.y, snapped };
  }

  private buildMarks(): void {
    const v = this.view;
    v.clearMarks();
    for (const b of this.puzzle.blocked) v.mark(b.x, b.y, 'blocked', GOLD, 1);
    for (const f of this.puzzle.fixed) v.mark(f.cell.x, f.cell.y, 'wanted', FIXED_RING, 0.8);
    if (this.mode === 'result' && this.result?.outcome !== 'exact') {
      const L = v.layout;
      for (const f of this.fizzleList) {
        if (f.cell.x < 0 || f.cell.y < 0 || f.cell.x >= L.cols || f.cell.y >= L.rows) continue;
        v.mark(f.cell.x, f.cell.y, 'highlighted', DANGER, 1.1, 5);
      }
    }
    if (this.mode === 'edit') {
      const hand = this.hand;
      const cell = this.keyboard ? this.cursor : this.hoverCell;
      if (cell) {
        const blocked = this.board.isBlocked(cell) || !!this.board.fixedAt(cell);
        if (hand) {
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
  }

  render(frame: Frame): void {
    this.view.render(frame);
  }
}
