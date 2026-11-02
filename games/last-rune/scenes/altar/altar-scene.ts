/**
 * The altar: build a circuit, fire the storm, read what happened.
 *
 * Modes
 *   edit    place / move / rotate / remove gems (pointer, keyboard, gamepad)
 *   strike  the bolt is running; input only skips (click, Enter, Esc) or fast-forwards (hold F)
 *   result  the verdict is showing; any edit drops back to `edit`
 *
 * One input model (turn-clarity, docs/design/altar-ux.md "Controls"):
 *   - Click / Enter / A picks up and sets down. It never turns anything.
 *   - R / Q / scroll / RB turns the gem under the pointer (or the cursor): the held gem, drawn
 *     where it will land, or a placed Bend or Gate. A gem that cannot turn says so with a tag
 *     at that gem and a deny sound; nothing else turns instead.
 * Pointer: click a tray gem to hold it (stays in hand while the tray has more), click a socket
 * to set it down. Drag from the tray or drag a placed gem to move it; drop it off the altar to
 * put it back. Right-click removes. Keyboard/pad: a gold cursor walks the sockets (arrows,
 * WASD, d-pad, stick); 1-6 / T / LB pick from the tray; Enter/A acts at the cursor.
 *
 * Flow hooks: `savePlacements` on every change, `recordAttempt` on every strike,
 * `completePuzzle` on exact (swaps to the solve moment), `closePuzzle` on back.
 */
import type { Frame, RGBA } from '@engine/render';
import { button, h, type Rect } from '@engine/ui';
import { POST_PRESETS } from '../../art/materials/post-presets';
import type { BoltMode, BoltSegment } from '../../art/props/bolt';
import { GEM_COLOUR, pitch } from '../../art/props/palette';
import type { BoltHandle, StormCellHandle } from '../../audio';
import { exactLine, gemNudge, machineLine, reactionLine, TEACH_NUDGE } from '../../content/lines';
import { puzzleFor } from '../../content/puzzles';
import type { GameCtx, GameScene } from '../../game/ctx';
import type { BoltOutcome } from '../../game/flow';
import { progressOf } from '../../game/save';
import {
  isRotational,
  type Placement,
  type PuzzleDef,
  type SimResult,
  simulate,
  stormCharge,
} from '../../rules';
import { getMachine } from '../../rules/progression';
import type { Cell, GemKind, MachineId } from '../../rules/types';
import { codexPages } from '../../ui/codex-data';
import { scalePxCss } from '../../ui/text-scale';
import { ensureAltarStyles } from './altar-styles';
import { AltarView, DANGER, GOLD } from './altar-view';
import { BoardState } from './board';
import {
  type ChargeChip,
  chargeChips,
  guideHops,
  liveSockets,
  type PathHop,
  previewPath,
} from './circuit-model';
import { jumpCursor, stepCursor } from './cursor';
import { emitPuzzleEvent, type FireMachine, puzzleEventsWanted } from './events';
import { setHintTarget } from './hints';
import { anchorOf, cellAt, cellCenter, TRAY_CENTER_X, traySlotAt, trayTipX } from './layout';
import {
  type Arrival,
  buildTimeline,
  causeText,
  type Fizzle,
  fizzles,
  gemsUsed,
  type StrikeTimeline,
} from './strike';
import { firstSentence, type NewGems, newGems, nudgeGems } from './teach';

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

/** Where a gem on the info card is: hovered in the tray, on the board, fixed, or newly turnable. */
type InfoHow = 'tray' | 'turnsTray' | 'board' | 'boardTurns' | 'fixed' | 'turns';
const INFO_TAG: Record<InfoHow, string> = {
  tray: '',
  turnsTray: 'R or scroll to turn',
  board: '',
  boardTurns: 'R or scroll to turn · Click to pick up',
  fixed: 'Fixed in place',
  turns: 'R or scroll to turn',
};

/**
 * Why a gem will not turn, shown at that gem (R, Q, scroll or RB over it). Straight-through
 * gems need no turning; a Split forks whichever side feeds it; a fixed Bend or Gate is part of
 * the machine.
 */
const NO_TURN: Record<GemKind, string> = {
  channel: "Can't turn: the bolt goes straight through",
  amplify: "Can't turn: the bolt goes straight through",
  capacitor: "Can't turn: the bolt goes straight through",
  split: "Can't turn: the bolt splits left and right",
  bend: "Can't turn: fixed in place",
  gate: "Can't turn: fixed in place",
};

/** The board card's line for a Split: what it does whichever way it is fed. */
const SPLIT_CARD =
  'The bolt can come in any side. It splits left and right, half the charge each way.';

const SIDE_NAME = ['north', 'east', 'south', 'west'] as const;

/** Which sides a Bend or Gate at `rot` uses, for the announcer (rules.md section 4). */
function sidesText(gem: GemKind, rot: number): string {
  const s = (k: number) => SIDE_NAME[(((rot + k) % 4) + 4) % 4]!;
  if (gem === 'bend') return `joins ${s(0)} and ${s(1)}`;
  if (gem === 'gate') return `in from ${s(3)} and ${s(1)}, out ${s(0)}`;
  return '';
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
  blocked: 'Solid stone: nothing goes here',
  fixed: "Fixed: can't be moved or replaced",
  'tray-empty': 'None left in the tray',
  'out-of-bounds': 'Off the altar',
  occupied: 'Socket taken',
};

/**
 * Edit-time route preview: while editing, the route strike 1 would take through the gems
 * already set lies faintly in grooves, and the empty socket it would reach next glows softly.
 * It shows direction only, never charge. Off = the board shows only the storm and machine
 * conduits. PM decision (difficulty): see docs/workstreams/altar-clarity.md.
 */
const OUTCOME_WORD: Record<string, string> = {
  exact: 'exact',
  under: 'not enough',
  over: 'too much, breaker tripped',
  dead: 'no charge',
};

/** "a", "a and b", "a, b and c". */
function listText(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

const PREVIEW_PATH = true;
/** Seconds without a board change before the first altar nudges. */
const TEACH_IDLE = 9;
/** Seconds a new gem's card shows on arrival (less if the player places a gem first). */
const INTRO_SECS = 7;
/** The card fades over its last this-many seconds. */
const INTRO_FADE = 0.5;
const TEACH_MACHINE: MachineId = 'intake-desk';

const SLOT_ACTIONS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
const CYAN: RGBA = [0.25, 1.3, 1.8, 1];
/** Fixed gems wear cold iron, not gold: gold marks where the player acts. */
const FIXED_RING: RGBA = [1.05, 1.15, 1.35, 1];
const WHITE_HOT: RGBA = [2, 2, 2, 1];
const OPEN_END: RGBA = [1.5, 1.05, 0.5, 1];
/** Conduit colours by outcome (match the need label's CSS colours). */
const OUT_GLOW: Record<'exact' | 'under' | 'over' | 'flow', RGBA> = {
  exact: [0.35, 1.6, 2.2, 1],
  under: [2.0, 1.0, 0.25, 1],
  over: [2.4, 0.4, 0.25, 1],
  flow: [0.9, 1.2, 1.8, 1],
};
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
  /** Socket just filled with Enter; the next gem taken by key moves the cursor on from it. */
  private keyPlaced: Cell | null = null;
  private cursorKey = '';
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
  /** Socket the hint mechanism is pointing at, if any. */
  private hintCell: Cell | null = null;

  // Teaching (first altar) + affordances
  /** First socket to use on the first altar; pulses until something is placed. */
  private teachCell: Cell | null = null;
  private idle = 0;
  private idleRev = -1;
  private nudged = false;
  /** Empty sockets the held gem may go in; cached per (board revision, gem). */
  private validCells: Cell[] = [];
  private validRev = -1;
  private validKind: GemKind | null = null;
  private rules = {} as Record<GemKind, string>;
  /** The gem info card: off the board, over the tray band (see `updateInfo`). */
  private tip!: HTMLElement;
  private tipKey = '';
  /** Iron brackets on fixed (and hint-locked) gems, rebuilt when the board changes. */
  private pins: HTMLElement[] = [];
  private pinsRev = -1;
  /** Turn arrow on a held Bend or Gate, until the player has turned one here. */
  private turnBadge!: HTMLElement;
  /** "in" pills at each Split's input side (where the bolt comes in, or would). */
  private splitIns!: HTMLElement;
  private splitInsKey = '';
  private turned = false;
  /** Board gem the keyboard cursor last announced. */
  private focusKey = '';

  // DOM
  private dom!: HTMLElement;
  private subtitle!: HTMLElement;
  private verdict!: HTMLElement;
  /** Screen-reader announcements (sr-only, always in the DOM so changes are read). */
  private announcer!: HTMLElement;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;
  private strikeBtn!: HTMLButtonElement;
  private undoBtn!: HTMLButtonElement;
  private clearBtn!: HTMLButtonElement;
  private counts: HTMLElement[] = [];
  /** The key-hint line under the tray, and which version of it is showing. */
  private hint!: HTMLElement;
  private titleEl!: HTMLElement;
  private actionsEl!: HTMLElement;
  private hintMode: HintMode | '' = '';
  private needs: HTMLElement[] = [];
  /** First altar only: "Gives N" at the storm, the twin of the machine's "Needs N". */
  private stormLabel: HTMLElement | null = null;
  private tags: HTMLElement[] = [];

  // Circuit read-out (altar-clarity)
  private circuitRev = -1;
  private circuitMode: Mode | null = null;
  private liveMask: Uint8Array = new Uint8Array(0);
  private openEnds: Cell[] = [];
  private chips: ChargeChip[] = [];
  private chipEls: HTMLElement[] = [];
  /** Per machine, per strike: what arrived. */
  private strikeReadings: number[][] = [];

  // First-appearance teaching
  private news: NewGems = { fixed: [], tray: [], turns: [] };
  /** New fixed gems still pulsing (until hovered, turned, or the first strike). */
  private teachFixed: { gem: GemKind; cell: Cell }[] = [];
  /** Stubs on the sides each new fixed gem joins (see `guideHops`). */
  private guide: PathHop[] = [];
  /** New tray kinds not yet picked up. */
  private teachTray = new Set<GemKind>();
  private spoken = new Set<GemKind>();
  /** New gems FUSE has yet to name, said one at a time when he is free (see `updateNudges`). */
  private pendingNudges: GemKind[] = [];
  /** Seconds left on the arrival card for this altar's new gems (0 = gone). */
  private introLeft = 0;
  /** Charge read-outs on the route preview through a new fixed gem (see `updatePreviewChips`). */
  private previewChipEls: HTMLElement[] = [];
  private previewChipKey = '';
  /** Charge read-outs on the preview through new gems, until the first strike here. */
  private teachChips = false;
  /** Turning kinds this altar teaches to turn (show the turn arrow when held). */
  private turnTeach = new Set<GemKind>();
  /** The route preview with the held gem tried where it would land (cell, rot, kind). */
  private ghostKey = '';
  private previewSim: SimResult | null = null;

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

    const save = ctx.save.get();
    for (const page of codexPages(progressOf(save), [])) this.rules[page.gem] = page.rule;
    if (this.machine === TEACH_MACHINE && !save.progress.solved.includes(this.machine)) {
      this.teachCell = this.firstSocket();
    }
    if (!save.progress.solved.includes(this.machine)) {
      const solved = save.progress.solved.map((id) => puzzleFor(id as MachineId));
      this.news = newGems(this.puzzle, solved);
      this.teachFixed = this.news.fixed.map((f) => ({ gem: f.gem, cell: f.cell }));
      this.teachTray = new Set(this.news.tray);
      this.teachChips = this.news.fixed.length + this.news.tray.length > 0;
      this.turnTeach = new Set([...this.news.turns, ...this.news.tray.filter(isRotational)]);
      this.guide = guideHops(
        this.puzzle,
        this.teachFixed.map((f) => f.cell),
      );
    }

    ensureAltarStyles(ctx.ui.root.ownerDocument);
    this.buildDom();
    this.refreshHud();
    this.introLeft = this.introRows().length > 0 ? INTRO_SECS : 0;
    this.announce(this.briefing());

    this.updateHint(); // also keeps the caption off the tray and the hint
    const saved = ctx.save.get().puzzles[this.machine];
    if (!saved || saved.attempts === 0) {
      const arrive = machineLine(this.machine, 'arrive');
      if (arrive) void ctx.fuse.say(arrive, { interrupt: true });
      // New gems: one line each once FUSE is free, unless the player is already using it.
      this.pendingNudges = nudgeGems(this.news);
    }
    setHintTarget({
      machine: this.machine,
      highlight: (cell) => this.hintHighlight(cell),
      lock: (p) => this.hintLock(p),
    });
    emitPuzzleEvent({
      type: 'open',
      machine: this.machine,
      t: 0,
      placements: this.board.serialise(),
      attempts: saved?.attempts ?? 0,
    });
  }

  exit(): void {
    this.ctx.fuse.avoid(null);
    setHintTarget(null);
    this.ctx.flow.savePlacements(this.machine, this.board.serialise());
    this.boltSound?.stop(0.2);
    this.boltSound = null;
    this.hum?.stop(0.4);
    this.hum = null;
    this.view.dispose();
    if (this.announceTimer !== null) clearTimeout(this.announceTimer);
    this.dom.remove();
    this.chipEls.length = 0;
    this.previewChipEls.length = 0;
    this.pins.length = 0;
    if (this.postSnapshot) this.ctx.post.set(this.postSnapshot as typeof this.ctx.post.settings);
    this.ctx.particles.clear();
    emitPuzzleEvent({
      type: 'close',
      machine: this.machine,
      t: this.time,
      solved: this.solved,
      seconds: this.time - this.openedAt,
      attempts: this.attempts,
      resets: this.resets,
      outcomes: { ...this.outcomes },
      placements: this.board.serialise(),
    });
  }

  pause(): void {
    this.ctx.fuse.hush();
    this.ctx.fuse.avoid(null);
  }

  resume(): void {
    this.setMood();
    this.fitTop(); // the text size may have changed in Settings
    this.avoidTray();
  }

  /**
   * Keep FUSE's caption card off the tray band (slots, counts, tooltips) and the key-hint line.
   * The hint is measured, so a longer line or a bigger text size moves the card as needed.
   */
  private avoidTray(): void {
    const L = this.view.layout;
    const regions: Rect[] = [];
    const xs = L.tray.map((s) => s.x);
    if (xs.length) {
      const left = Math.min(...xs) - 80;
      const right = Math.max(...xs) + 80;
      regions.push({
        x: left,
        y: L.trayY - 90,
        width: right - left,
        height: 1080 - (L.trayY - 90),
      });
    }
    const hint = this.hint;
    if (hint?.isConnected && hint.offsetWidth > 0) {
      regions.push({
        x: hint.offsetLeft,
        y: hint.offsetTop,
        width: hint.offsetWidth,
        height: hint.offsetHeight,
      });
    }
    // Machine need labels, and the button rows, so the card never moves over them either
    // (bigger text makes the card taller, and it can reach a label beside an east machine).
    if (this.dom.isConnected) {
      const ui = this.ctx.ui;
      const o = ui.root.getBoundingClientRect();
      const els = [
        ...this.needs,
        ...(this.stormLabel ? [this.stormLabel] : []),
        this.actionsEl,
        ...ui.root.querySelectorAll<HTMLElement>('.lr-hud'),
      ];
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        regions.push({
          x: (r.left - o.left) / ui.scale,
          y: (r.top - o.top) / ui.scale,
          width: r.width / ui.scale,
          height: r.height / ui.scale,
        });
      }
    }
    this.ctx.fuse.avoid(regions);
  }

  /**
   * The key-hint line says only what applies now: the mouse controls, the keyboard controls
   * once the player uses keys, or fast-forward while the bolt runs.
   */
  private updateHint(): void {
    const mode: HintMode = this.mode === 'strike' ? 'strike' : this.keyboard ? 'keys' : 'mouse';
    if (mode === this.hintMode) return;
    this.hintMode = mode;
    this.hint.replaceChildren(...hintLine(mode));
    this.hint.dataset.mode = mode;
    this.avoidTray();
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
    this.counts = L.tray.map((s) =>
      h('div', {
        class: 'lr-altar-count',
        // Bigger text lifts the count up the gem so the hint line below stays clear.
        style: {
          left: `${s.x}px`,
          top: `calc(${s.y + 40}px - (var(--lr-text-scale, 1) - 1) * 50px)`,
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
        'Gives ',
        h('b', null, String(stormCharge(this.puzzle.storm.strength))),
      ),
    );
    this.titleEl = h(
      'div',
      { class: 'lr-altar-title', style: { left: `${L.titleX}px` } },
      h('h2', null, getMachine(this.machine).name),
      this.subtitle,
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
      this.hint,
    );
    this.splitIns = h('div', { class: 'lr-altar-ins', 'aria-hidden': 'true' });
    this.dom.append(this.splitIns);
    this.dom.toggleAttribute('data-first', !!this.teachCell);
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
      this.subtitle.textContent =
        `Storm ×${s} gives ${stormCharge(s)}` +
        (p > 1 ? ` · ${p} strikes` : '') +
        (this.attempts > 0 ? ` · try ${this.attempts + 1}` : '');
    }
    this.fitTop();
  }

  /**
   * Keep the title and the verdict under it clear of the HUD buttons (left) and the action
   * row (right). They stay where the layout put them (clear of north gauges) unless bigger
   * text would push them into a button; then they narrow and slide just far enough.
   */
  private fitTop(): void {
    const L = this.view.layout;
    const ui = this.ctx.ui;
    if (!this.dom.isConnected) return;
    const origin = ui.root.getBoundingClientRect().left;
    const toDesign = (px: number) => (px - origin) / ui.scale;
    let hudRight = 0;
    for (const b of ui.root.querySelectorAll<HTMLElement>('.lr-hud:not([hidden]) button')) {
      const r = b.getBoundingClientRect();
      if (r.width > 0) hudRight = Math.max(hudRight, toDesign(r.right));
    }
    const actionsLeft = toDesign(this.actionsEl.getBoundingClientRect().left);
    const half = (L.titleMax + 20) / 2;
    const lo = Math.max(hudRight + 16, L.titleX - half);
    const hi = Math.min(actionsLeft - 16, L.titleX + half);
    const room = Math.max(200, hi - lo);
    const place = (el: HTMLElement, maxW: number) => {
      el.style.maxWidth = `${Math.round(maxW)}px`;
      const w = el.offsetWidth;
      const x =
        lo + w / 2 > hi - w / 2
          ? (lo + hi) / 2
          : Math.min(Math.max(L.titleX, lo + w / 2), hi - w / 2);
      el.style.left = `${Math.round(x)}px`;
    };
    place(this.titleEl, room);
    const verdictW = Math.min(L.titleMax, room);
    this.verdict.toggleAttribute('data-narrow', verdictW < 600);
    if (!this.verdict.hidden) place(this.verdict, verdictW);
    for (const el of this.needs) this.clearOfActions(el);
    if (this.stormLabel) this.clearOfActions(this.stormLabel);
    // The verdict sits under the title, however many lines the title took.
    const titleBottom = this.titleEl.offsetTop + this.titleEl.offsetHeight;
    this.verdict.style.top = `${Math.max(96, titleBottom + 6)}px`;
    this.avoidTray();
  }

  private showVerdict(text: string, outcome: BoltOutcome): void {
    // The verdict sits where the subtitle is; the subtitle steps aside until the next edit.
    this.subtitle.style.display = 'none';
    this.verdict.textContent = text;
    this.verdict.dataset.outcome = outcome;
    this.verdict.hidden = false;
    this.fitTop();
  }

  /**
   * Say `text` through the sr-only live region. It is set a beat after clearing, so a repeat
   * of the same line (the same miss twice) is announced again.
   */
  private announce(text: string): void {
    if (this.announceTimer !== null) clearTimeout(this.announceTimer);
    this.announcer.textContent = '';
    this.announceTimer = setTimeout(() => {
      this.announceTimer = null;
      this.announcer.textContent = text;
    }, 80);
  }

  /** What the altar asks for, read when it opens: storm, strikes and every machine's need. */
  private briefing(): string {
    const p = this.puzzle;
    const needs = p.machines.map((m) => m.need);
    const ask =
      needs.length === 1
        ? `The machine needs exactly ${needs[0]}.`
        : `${needs.length} machines need exactly ${listText(needs.map(String))}.`;
    const strikes = p.pulses > 1 ? `, ${p.pulses} strikes` : '';
    const gives = stormCharge(p.storm.strength);
    const intro = this.introRows().map((r) => `New: ${this.infoText(r)}`);
    return [
      `${getMachine(this.machine).name} altar. Storm ×${p.storm.strength} gives ${gives}${strikes}. ${ask}`,
      ...intro,
    ].join(' ');
  }

  /** The strike result for screen readers: the verdict plus every machine's reading. */
  private resultText(verdict: string): string {
    const res = this.result!;
    const parts = [verdict.endsWith('.') ? verdict : `${verdict}.`];
    const multi = res.machines.length > 1;
    res.machines.forEach((m, i) => {
      const reads = this.strikeReadings[i] ?? [];
      const got =
        this.puzzle.pulses > 1 && reads.length > 0
          ? `strikes gave ${listText(reads.map(String))}`
          : `got ${this.lastReading(m)}`;
      if (multi || this.puzzle.pulses > 1) {
        const who = multi ? `Machine ${i + 1}` : 'The machine';
        parts.push(`${who}: needs ${m.need}, ${got}, ${OUTCOME_WORD[m.outcome] ?? 'no charge'}.`);
      }
    });
    if (this.tags.length > 0) {
      parts.push(`Fizzled: ${this.tags.map((t) => t.textContent ?? '').join('; ')}.`);
    }
    return parts.join(' ');
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

  /** "Needs N" and, once charge has landed, "got M" plus one entry per strike on multi-strike. */
  private setNeed(i: number, need: number, got: number | null): void {
    const el = this.needs[i]!;
    const kids: (HTMLElement | string)[] = [
      h('span', { class: 'lr-need-row' }, 'Needs ', h('b', null, String(need))),
    ];
    if (got !== null) {
      kids.push(h('span', { class: 'lr-need-got' }, 'got ', h('b', null, String(got))));
      const rs = this.strikeReadings[i];
      if (this.puzzle.pulses > 1 && rs && rs.length > 0) {
        kids.push(
          h(
            'span',
            { class: 'lr-need-strikes' },
            ...rs.map((r, k) =>
              h(
                'span',
                { 'data-state': r === need ? 'exact' : r > need ? 'over' : 'under' },
                `Strike ${k + 1}: ${r}`,
              ),
            ),
          ),
        );
      }
    }
    el.replaceChildren(...kids);
    this.clearOfActions(el);
  }

  /**
   * A need label beside a machine near the top edge can grow (bigger text, per-strike
   * readings) into the action row; drop it just below the row when it would touch.
   */
  private clearOfActions(el: HTMLElement): void {
    if (!this.dom.isConnected || !this.actionsEl) return;
    el.style.marginTop = '';
    const a = this.actionsEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const gap = 8 * this.ctx.ui.scale;
    if (r.right <= a.left || r.left >= a.right || r.top >= a.bottom + gap) return;
    el.style.marginTop = `${Math.ceil((a.bottom + gap - r.top) / this.ctx.ui.scale)}px`;
  }

  // ── Circuit read-out ────────────────────────────────────────────────────

  /** Live sockets and the route preview, recomputed when the board or mode changes. */
  private updateCircuit(): void {
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
      const at = (c: Cell, m: Cell) => c.x === m.x && c.y === m.y;
      this.puzzle.machines.forEach((m, i) => {
        v.machineLinked[i] =
          pv.hops.some((q) => at(q.to, m.at)) || sim.trace.some((q) => at(q.to, m.at));
      });
      this.realPreview = { hops: pv.hops, sim };
      this.ghostKey = '#';
      this.updateGhost(ghost, ghostKey);
    } else {
      v.previewTarget = 0;
      this.ghostKey = '';
      this.realPreview = null;
      this.previewSim = null;
      this.updatePreviewChips();
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
  }

  /**
   * The first altar's showing-not-telling (intake desk, until solved):
   * - the storm and machine conduits breathe in turn until the route reaches the machine;
   * - a new fixed gem shows the sides it joins until its first strike;
   * - Strike glows once the route reaches every machine.
   */
  private updateFirstTime(): void {
    const v = this.view;
    const edit = this.mode === 'edit';
    const linked = v.machineLinked.every(Boolean);
    v.beckonTarget = edit && this.teachCell && !linked ? 1 : 0;
    v.guide = this.teachFixed.length > 0 ? this.guide : [];
    v.guideTarget = edit && this.teachFixed.length > 0 ? 1 : 0;
    // Every altar: Strike glows once the route reaches every machine. Reaching is not exact
    // (the charge may still be wrong); the glow only says the bolt has somewhere to go.
    this.strikeBtn.toggleAttribute('data-ready', edit && linked);
  }

  /** The route preview of the board as it is (no held gem), cached per revision. */
  private realPreview: { hops: PathHop[]; sim: SimResult } | null = null;

  /**
   * The held gem, tried where it would land: an empty socket it fits, under the pointer or
   * the cursor. The preview shows the route with it there, so turning a Bend in hand swings
   * the route before it is set down. Never over a placed gem: that gem is what the player
   * sees there, and R turns it (turn-2).
   */
  private ghost(): Placement | null {
    const hand = this.hand;
    if (this.mode !== 'edit' || !hand || hand.from) return null;
    const cell = this.keyboard ? this.cursor : this.hoverCell;
    if (!cell || this.board.at(cell) || !this.lands(cell, hand.kind)) return null;
    return {
      gem: hand.kind,
      cell: { x: cell.x, y: cell.y },
      rot: (hand.rot & 3) as Placement['rot'],
    };
  }

  /**
   * Would the held gem land in `cell`? An empty socket it fits, or a placed gem of the
   * player's it would replace (that one goes back to the tray). Never a fixed gem or stone.
   */
  private lands(cell: Cell, kind: GemKind): boolean {
    if (this.board.fixedAt(cell) || this.board.isBlocked(cell) || !this.inBounds(cell))
      return false;
    if (this.board.at(cell)) return true;
    return this.board.check(cell, kind).ok;
  }

  private updateGhost(ghost: Placement | null, key: string): void {
    if (key === this.ghostKey || !this.realPreview) return;
    this.ghostKey = key;
    const v = this.view;
    let hops = this.realPreview.hops;
    let sim = this.realPreview.sim;
    if (ghost) {
      const at = (q: Placement) => q.cell.x === ghost.cell.x && q.cell.y === ghost.cell.y;
      const placements = [...this.board.serialise().filter((q) => !at(q)), ghost];
      sim = simulate(this.puzzle, placements);
      hops = previewPath(this.puzzle, placements, sim).hops;
    }
    // Glyphs face the way the bolt will really come in, with the held gem where it would land:
    // a fixed Split swings to show its real input and outputs as the player aims at it.
    v.faceAlong(hops, true);
    v.preview = hops;
    v.previewTarget = PREVIEW_PATH ? 1 : 0;
    this.previewSim = sim;
    this.updatePreviewChips();
  }

  private isLive(c: Cell): boolean {
    return this.liveMask[c.y * this.view.layout.cols + c.x] === 1;
  }

  /** Chips for this strike's charge changes (and every hop into a machine). */
  private buildChips(res: SimResult): void {
    this.clearChips();
    const chips = chargeChips(res);
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
            left: `${a.x + (b.x - a.x) * t}px`,
            top: `${a.y + (b.y - a.y) * t}px`,
            // Chips scale with the board so a 10-wide altar's run of changes stays legible.
            // and follow the text size setting.
            fontSize: scalePxCss(chipPx),
            lineHeight: `calc(${scalePxCss(chipPx)} + 6px)`,
          },
        },
        String(c.charge),
      );
      this.dom.append(el);
      this.chipEls.push(el);
    }
  }

  private clearChips(): void {
    for (const el of this.chipEls) el.remove();
    this.chipEls.length = 0;
    this.chips = [];
  }

  /** Show the chips of the strike now playing whose hop has started. */
  private updateChips(): void {
    const tl = this.timeline;
    if (!tl) return;
    for (let i = 0; i < this.chips.length; i++) {
      const c = this.chips[i]!;
      const seg = tl.segments[c.seg]!;
      const show = c.pulse === this.pulse && this.st >= seg.t0;
      const el = this.chipEls[i]!;
      if (el.hidden === show) el.hidden = !show;
    }
  }

  /** Colour the machine chips of strike `i` by what the machine made of them. */
  private settleChips(i: number, m: number, state: string): void {
    const at = this.puzzle.machines[m]!.at;
    for (let k = 0; k < this.chips.length; k++) {
      const c = this.chips[k]!;
      if (c.pulse === i && c.to.x === at.x && c.to.y === at.y)
        this.chipEls[k]!.dataset.state = state;
    }
  }

  // ── First-appearance teaching ───────────────────────────────────────────

  /** FUSE's nudge for a gem's first appearance (never interrupting). */
  private speak(gem: GemKind): void {
    if (this.spoken.has(gem)) return;
    this.spoken.add(gem);
    const line = gemNudge(gem);
    if (line) void this.ctx.fuse.say(line);
  }

  /** Seconds FUSE has been quiet in edit mode (so a nudge never lands on another line). */
  private quiet = 0;

  /**
   * New-gem lines, one at a time, each when FUSE is free. A line is skipped once its gem is
   * in use: a new fixed gem the route already reaches (or has been struck through), a new tray
   * gem already on the board. The player who has it working needs no introduction.
   */
  private updateNudges(dt: number): void {
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
  }

  /** The player is already using `gem` here (see `updateNudges`). */
  private inUse(gem: GemKind): boolean {
    const fixed = this.news.fixed.find((f) => f.gem === gem);
    if (fixed) {
      if (!this.teachFixed.some((f) => f.gem === gem)) return true;
      const c = fixed.cell;
      return (this.realPreview?.hops ?? []).some((q) => q.to.x === c.x && q.to.y === c.y);
    }
    return this.board.serialise().some((q) => q.gem === gem);
  }

  /** What this altar introduces, for the arrival card and the briefing. */
  private introRows(): { gem: GemKind; how: InfoHow }[] {
    return [
      ...this.news.fixed.map((f) => ({ gem: f.gem, how: 'fixed' as const })),
      ...this.news.tray.map((gem) => ({ gem, how: 'tray' as const })),
      ...this.news.turns.map((gem) => ({ gem, how: 'turns' as const })),
    ];
  }

  /** One gem's card text: what it does, and whether it is fixed or turns. */
  private infoText(r: { gem: GemKind; how: InfoHow }): string {
    const tag = this.tagOf(r.how);
    return `${GEM_NAME[r.gem]}${tag ? ` (${tag})` : ''}: ${this.infoRule(r)}`;
  }

  /** The card's tag; a placed Bend or Gate names the keys in use (mouse or keyboard). */
  private tagOf(how: InfoHow): string {
    if (how === 'boardTurns') {
      // With a gem in hand a click does not pick this one up, so the card only says how to turn.
      if (this.hand) return this.keyboard ? 'R or Q to turn' : 'R or scroll to turn';
      if (this.keyboard) return 'R or Q to turn · Enter to pick up';
    }
    return INFO_TAG[how];
  }

  private infoRule(r: { gem: GemKind; how: InfoHow }): string {
    if (r.how === 'turns') return 'Yours to place now. Turn it to face the way you need.';
    if (r.gem === 'split' && (r.how === 'board' || r.how === 'fixed')) return SPLIT_CARD;
    const rule = this.rules[r.gem] ?? '';
    return r.how === 'tray' || r.how === 'turnsTray' ? rule : firstSentence(rule);
  }

  /** New fixed gems have been struck through: stop pulsing them, close the arrival card. */
  private learnFixed(): void {
    this.teachFixed = [];
    this.introLeft = 0;
    this.teachChips = false;
  }

  // ── Edits ───────────────────────────────────────────────────────────────

  private changed(placed: Cell | null = null): void {
    if (this.mode === 'result') this.backToEdit();
    // The arrival card has done its job once the player starts building: let it fade.
    if (placed && this.introLeft > INTRO_FADE) this.introLeft = INTRO_FADE;
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
    this.teachTray.delete(kind);
    const turns = isRotational(kind) ? ' R or Q turns it.' : '';
    this.announce(`${GEM_NAME[kind]} in hand. ${this.rules[kind] ?? ''}${turns}`);
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
        const keys = this.keyboard ? 'R or Q' : 'R or scroll';
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
    this.changed(cell);
  }

  /**
   * Click / Enter / pad A at a socket with an empty hand: a placed gem is picked up, keeping
   * its turn. One rule for every gem and every input: clicking never turns (R, Q, scroll do).
   */
  private actOnGem(cell: Cell): void {
    const p = this.board.at(cell);
    if (p) {
      this.board.remove(cell);
      this.hand = { kind: p.gem, rot: p.rot, from: null };
      this.ctx.sound.sfx.play('gemPick', { gem: p.gem, pan: this.panOf(cell) });
      this.announce(`${GEM_NAME[p.gem]} in hand.${this.turnNote(p.gem, p.rot)}`);
      this.logRemove(p.gem, cell);
      this.changed();
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

  /** " Joins north and east. R or Q turns it." for a Bend or Gate; nothing for other gems. */
  private turnNote(gem: GemKind, rot: number): string {
    if (!isRotational(gem)) return '';
    const s = sidesText(gem, rot);
    return ` ${s.charAt(0).toUpperCase()}${s.slice(1)}. R or Q turns it.`;
  }

  /**
   * R / Q / scroll / RB: turn the gem the player sees under the pointer (or the keyboard cursor).
   *   - A gem on the board (placed or fixed) is what the player is looking at, so it turns,
   *     at once and for good, whatever is in hand; one that cannot turn says why. The hand is
   *     never turned in its place (turn-2: the ghost is not drawn over placed gems).
   *   - Otherwise a gem in hand turns: it is drawn in the empty socket it will land in.
   *   - While dragging a placed gem, the dragged gem is the one under the pointer.
   * Nothing under the pointer (an empty socket, no hand): nothing happens.
   */
  private turnAt(cell: Cell | null, by: number): void {
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
  }

  /** Turn the player's gem at `cell` on the board (saved at once), or say why it won't turn. */
  private turnPlaced(cell: Cell, by: number): void {
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
  }

  /**
   * A gem that will not turn says why, at that gem (or at the held gem), with the deny sound.
   * A fixed Split names what it does instead; other fixed gems say they are part of the machine.
   */
  private denyTurn(cell: Cell | null, gem: GemKind, fixed: boolean): void {
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
  }

  private rotateAt(cell: Cell, by: number): void {
    const p = this.board.at(cell);
    if (!p || !isRotational(p.gem)) return;
    this.board.rotate(cell, by);
    this.ctx.sound.sfx.play('gemRotate', { pan: this.panOf(cell) });
    this.logRotate(cell);
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
    this.logRemove(p.gem, cell);
    this.changed();
  }

  private undo(): void {
    if (this.mode === 'strike') return;
    this.dropHand();
    if (this.board.undo()) {
      this.resets++;
      this.logReset('undo');
      this.ctx.sound.sfx.play('gemRotate');
      this.changed();
    }
  }

  private clear(): void {
    if (this.mode === 'strike') return;
    this.dropHand();
    if (this.board.clear()) {
      this.resets++;
      this.logReset('clear');
      this.ctx.sound.sfx.play('gemPick');
      this.changed();
    }
  }

  private back(): void {
    this.ctx.fuse.hush();
    this.ctx.flow.closePuzzle();
  }

  // ── Playtest events + hint mechanism ───────────────────────────────────

  private logPlace(cell: Cell, from: Cell | null): void {
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
  }

  private logRemove(gem: GemKind, cell: Cell): void {
    if (!puzzleEventsWanted()) return;
    emitPuzzleEvent({
      type: 'remove',
      machine: this.machine,
      t: this.time,
      gem,
      cell: { x: cell.x, y: cell.y },
    });
  }

  private logRotate(cell: Cell): void {
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
  }

  private logReset(kind: 'clear' | 'undo'): void {
    if (!puzzleEventsWanted()) return;
    emitPuzzleEvent({
      type: 'reset',
      machine: this.machine,
      t: this.time,
      kind,
      placements: this.board.serialise(),
    });
  }

  private inBounds(cell: Cell): boolean {
    const L = this.view.layout;
    return cell.x >= 0 && cell.y >= 0 && cell.x < L.cols && cell.y < L.rows;
  }

  private hintHighlight(cell: Cell | null): boolean {
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
  }

  private hintLock(p: Placement): boolean {
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
    if (puzzleEventsWanted()) {
      const saved = this.ctx.save.get().puzzles[this.machine];
      emitPuzzleEvent({
        type: 'fire',
        machine: this.machine,
        t: this.time,
        attempt: saved?.attempts ?? this.attempts,
        placements,
        outcome: result.outcome,
        strikes: result.pulsesRun,
        machines: result.machines.map(
          (m): FireMachine => ({
            at: { x: m.at.x, y: m.at.y },
            need: m.need,
            outcome: m.outcome,
            readings: [...m.readings],
          }),
        ),
      });
    }

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
    this.strikeReadings = this.puzzle.machines.map(() => []);
    this.buildChips(result);
    for (let m = 0; m < this.view.machineGlow.length; m++) this.view.machineGlow[m] = 0;
    this.learnFixed();
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

  /** Effective "Reduce flashes" ('auto' follows reduced motion; an explicit on/off wins). */
  private get reduceFlashes(): boolean {
    return this.ctx.settings.reduceFlashes;
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
    this.view.stormGlow = 1;
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
        this.setNeed(m, need, this.readings[m]!);
        this.view.machineGlow[m] = 1;
        const col = this.view.machineColor[m]!;
        for (let k = 0; k < 4; k++) col[k] = OUT_GLOW.flow[k]!;
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
      this.strikeReadings[m]![i] = got;
      this.setNeed(m, need, got);
      const state = got === need && mr.wokeOn === i ? 'exact' : got > need ? 'over' : 'under';
      this.settleChips(i, m, state);
      if (got > 0) {
        this.view.machineGlow[m] = 1;
        const col = this.view.machineColor[m]!;
        for (let k = 0; k < 4; k++) col[k] = OUT_GLOW[state][k]!;
      }
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
    // The numbers name the machine: its need label shows the same "Needs N · got M", lit in
    // the outcome colour, so a multi-machine verdict needs no "second machine" ordinal.
    const say = (_i: number, text: string) => text;
    if (o === 'exact') {
      // The solve moment's FUSE line follows at once, so the exact line rides in the verdict.
      this.showVerdict(exactLine(Math.min(4, this.ctx.tier()) as 1 | 2 | 3 | 4).text, 'exact');
      this.wakeTimer = this.ctx.settings.reducedMotion ? 0.9 : 1.5;
      this.solved = true;
      this.ctx.sound.music.duck(0.5, 1.6);
    } else {
      const over = ms.findIndex((m) => m.outcome === 'over');
      const under = ms.findIndex((m) => m.outcome !== 'exact' && m.outcome !== 'over');
      if (o === 'over') {
        const m = ms[over]!;
        this.showVerdict(
          say(over, `Breaker tripped: needs ${m.need}, got ${this.lastReading(m)}`),
          'over',
        );
      } else if (o === 'under') {
        const m = ms[under] ?? ms[0]!;
        this.showVerdict(
          say(under, `Not enough: needs ${m.need}, got ${this.lastReading(m)}`),
          'under',
        );
      } else {
        this.showVerdict('No charge reached the machine', 'dead');
      }
      // Teaching: name where it went wrong (first few fizzles, last strike first).
      const shown = new Set<string>();
      const placedTags: { x: number; y: number }[] = [];
      let count = 0;
      const pt = { x: 0, y: 0 };
      for (let i = this.fizzleList.length - 1; i >= 0 && count < 3; i--) {
        const f = this.fizzleList[i]!;
        const k = `${f.cell.x},${f.cell.y}`;
        if (shown.has(k)) continue;
        shown.add(k);
        anchorOf(L, f.cell, pt);
        let ty = pt.y - L.pitch * 0.38;
        // Keep tags from stacking on each other (big boards fizzle in clusters).
        for (const q of placedTags)
          if (Math.abs(q.x - pt.x) < 230 && Math.abs(q.y - ty) < 40) ty = q.y - 40;
        placedTags.push({ x: pt.x, y: ty });
        this.addTag(pt.x, ty, causeText(f.cause));
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
    this.announce(
      this.resultText(this.verdict.textContent ?? '') +
        (o === 'exact' ? '' : ' Change anything to try again.'),
    );
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
    this.subtitle.style.display = '';
    this.clearTags();
    this.clearChips();
    for (let m = 0; m < this.view.machineGlow.length; m++) this.view.machineGlow[m] = 0;
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
    this.updateChips();
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
      if (this.tagTimer <= 0 && this.mode === 'edit') {
        this.clearTags();
        // A refusal still under the pointer shows again.
        this.refusedKey = '';
      }
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

    this.updateCircuit();
    this.updateTeach(dt);
    this.updateNudges(dt);
    this.updateFuse();
    this.updateHint();
    this.updateTray();
    if (this.introLeft > 0 && this.mode === 'edit')
      this.introLeft = Math.max(0, this.introLeft - dt);
    this.updateInfo();
    this.updatePins();
    this.updateTurnBadge();
    this.updateSplitIns();
    // The keyboard cursor, for tests and tools (the gold ring is drawn on the GPU).
    const ck = `${this.cursor.x},${this.cursor.y}`;
    if (ck !== this.cursorKey) {
      this.cursorKey = ck;
      this.dom.dataset.cursor = ck;
    }
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
          // A click picks it up (on release); a drag moves it.
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
  }

  /**
   * G: the cursor goes to the wire's open end (the empty socket the bolt would reach next),
   * then on to the next open end with each press. Nothing open: a soft deny.
   */
  private jumpToOpenEnd(): void {
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
  }

  /**
   * After Enter fills a socket, taking the next gem by key moves the cursor to the nearest open
   * end of the route (the socket the bolt would reach next), so building a long route is a
   * gem key and Enter per socket instead of a walk across the board each time.
   */
  private cursorOn(): void {
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

  // ── Teaching + affordances ──────────────────────────────────────────────

  /** The intended placement nearest the storm cell: where the first gem obviously goes. */
  private firstSocket(): Cell | null {
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
  }

  /** True while the first altar is still teaching its first move. */
  private get teaching(): boolean {
    return !!this.teachCell && this.mode === 'edit' && !this.board.at(this.teachCell);
  }

  private updateTeach(dt: number): void {
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
  }

  /** Empty sockets the held gem could go in (recomputed only when the board or gem changes). */
  private validFor(kind: GemKind): readonly Cell[] {
    if (this.validRev === this.board.revision && this.validKind === kind) return this.validCells;
    this.validRev = this.board.revision;
    this.validKind = kind;
    this.validCells.length = 0;
    const L = this.view.layout;
    for (let y = 0; y < L.rows; y++) {
      for (let x = 0; x < L.cols; x++) {
        const c = { x, y };
        if (this.board.at(c) || this.board.fixedAt(c) || this.board.isBlocked(c)) continue;
        if (this.board.check(c, kind).ok) this.validCells.push(c);
      }
    }
    return this.validCells;
  }

  /**
   * The gem info card. It never covers the board: it sits over the tray band, just above the
   * slots. What it says, first match wins:
   *   1. the hovered or held tray gem (its full rule; the notch points at its slot);
   *   2. the board gem under the pointer, or under the keyboard cursor (first sentence, and
   *      "Fixed in place" for a gem that is part of the machine);
   *   3. on arrival, this altar's new gems, for a few seconds or until the first placement.
   * Keyboard and screen-reader players get the same text through the announcer.
   */
  private updateInfo(): void {
    const L = this.view.layout;
    const strike = this.mode === 'strike';
    let rows: { gem: GemKind; how: InfoHow }[] = [];
    let slotX: number | null = null;
    let key = '';
    // With a gem in hand over one of the player's gems, the card is that gem's: R turns it.
    const overPlaced = !strike && this.overPlaced();
    let slot = strike ? -1 : this.hoverSlot;
    if (slot < 0 && this.hand && !this.hand.from && !strike && !overPlaced) {
      slot = L.tray.findIndex((t) => t.gem === this.hand!.kind);
    }
    const s = slot >= 0 ? L.tray[slot] : undefined;
    const focus =
      !strike && (!this.hand || overPlaced) ? (this.keyboard ? this.cursor : this.hoverCell) : null;
    const fixedHere = focus ? this.board.fixedAt(focus) : undefined;
    const onBoard = focus ? (this.board.at(focus) ?? fixedHere) : undefined;
    if (s) {
      rows = [{ gem: s.gem, how: this.turnTeach.has(s.gem) ? 'turnsTray' : 'tray' }];
      slotX = s.x;
      key = `t${slot}`;
    } else if (focus && onBoard) {
      const fixed = !!fixedHere;
      const how: InfoHow = fixed ? 'fixed' : isRotational(onBoard.gem) ? 'boardTurns' : 'board';
      rows = [{ gem: onBoard.gem, how }];
      key = `b${focus.x},${focus.y}${fixed ? 'f' : ''}${this.keyboard ? 'k' : ''}${this.hand ? 'h' : ''}`;
    } else if (this.introLeft > 0 && !strike) {
      rows = this.introRows();
      key = 'intro';
    }
    // Keyboard focus on a board gem: say what it is (once per gem).
    const fk = this.keyboard && key.startsWith('b') ? key : '';
    if (fk !== this.focusKey) {
      this.focusKey = fk;
      if (fk && rows[0]) this.announce(this.infoText(rows[0]));
    }
    const fade =
      key === 'intro' && !this.ctx.settings.reducedMotion
        ? Math.min(1, this.introLeft / INTRO_FADE)
        : 1;
    this.tip.style.opacity = fade < 1 ? fade.toFixed(3) : '';
    if (key === this.tipKey) return;
    this.tipKey = key;
    if (rows.length === 0) {
      this.tip.hidden = true;
      return;
    }
    this.tip.dataset.source = key === 'intro' ? 'intro' : key[0] === 't' ? 'tray' : 'board';
    this.tip.replaceChildren(
      ...rows.map((r) => {
        const tag = this.tagOf(r.how);
        return h(
          'div',
          { class: 'lr-info-row', 'data-how': r.how },
          h('b', null, GEM_NAME[r.gem]),
          tag ? h('span', { class: 'lr-info-tag', 'data-how': r.how }, tag) : null,
          ` ${this.infoRule(r)}`,
        );
      }),
    );
    // Bottom edge just above the tray slots (translate -100%), clear of the board's sockets.
    const s0 = L.tray[0];
    const size = s0?.size ?? 92;
    this.tip.style.top = `${L.trayY - size * 0.62}px`;
    this.tip.hidden = false;
    // Over its slot (or the tray's middle), never over FUSE (left) or the caption (right).
    const x = trayTipX(slotX ?? TRAY_CENTER_X, this.tip.offsetWidth);
    this.tip.style.left = `${x}px`;
    // The notch points at the slot; the card for a board gem or the arrival has none.
    if (slotX !== null) this.tip.style.setProperty('--lr-tip-dx', `${slotX - x}px`);
  }

  /**
   * Iron brackets and a bolt head on every fixed gem (and a hint-locked one): part of the
   * machine, not the player's to move or turn. Drawn in the overlay over the socket corners.
   */
  private updatePins(): void {
    const rev = this.board.revision;
    if (rev === this.pinsRev) return;
    this.pinsRev = rev;
    for (const el of this.pins) el.remove();
    this.pins.length = 0;
    const L = this.view.layout;
    const pt = { x: 0, y: 0 };
    const cells = [
      ...this.puzzle.fixed.map((f) => f.cell),
      ...this.board.lockedPlacements.map((f) => f.cell),
    ];
    for (const c of cells) {
      cellCenter(L, c, pt);
      const el = h(
        'div',
        {
          class: 'lr-altar-pin',
          'aria-hidden': 'true',
          style: {
            left: `${pt.x}px`,
            top: `${pt.y}px`,
            width: `${L.pitch * 0.9}px`,
            height: `${L.pitch * 0.9}px`,
          },
        },
        h('i', { class: 'lr-pin-bolt' }),
      );
      el.dataset.cell = `${c.x},${c.y}`;
      this.dom.insertBefore(el, this.tip);
      this.pins.push(el);
    }
  }

  /**
   * A held Bend or Gate shows it turns: a turn arrow by the gem, with the keys, until the
   * player has turned one here. Only where the altar teaches turning (its first tray Bend or
   * Gate); the preview swings with each turn (see `ghost`).
   */
  private updateTurnBadge(): void {
    const held = this.view.held;
    const show =
      this.mode === 'edit' &&
      !!this.hand &&
      !!held &&
      !this.turned &&
      // Over a fixed or placed gem R would not turn the hand, so the badge does not promise it.
      !this.refusedKey &&
      !this.overPlaced() &&
      this.turnTeach.has(this.hand.kind);
    if (this.turnBadge.hidden === show) this.turnBadge.hidden = !show;
    if (!show || !held) return;
    const r = this.view.layout.gemSize * 0.5;
    this.turnBadge.style.left = `${held.x + r}px`;
    this.turnBadge.style.top = `${held.y - r}px`;
    const keys = this.keyboard ? 'R / Q' : 'R / Scroll';
    if (this.turnBadge.dataset.keys !== keys) {
      this.turnBadge.dataset.keys = keys;
      this.turnBadge.replaceChildren(
        h('span', { class: 'lr-turn-arrow' }, '\u21bb'),
        h('span', { class: 'lr-turn-keys' }, keys),
      );
    }
  }

  /**
   * A Split reads without turning it: a small "in" sits on the side its bolt comes in by (the
   * real feed, the held gem's would-be feed, or the storm's way when nothing reaches it yet).
   * Its glyph's two arms point at the sides the halves leave by.
   */
  private updateSplitIns(): void {
    const L = this.view.layout;
    const parts: string[] = [];
    const at: { x: number; y: number }[] = [];
    if (this.mode === 'edit') {
      for (const b of this.view.board) {
        if (b.g.kind !== 'split' || b.hidden) continue;
        const q = (((Math.round(b.rotTarget) + 2) % 4) + 4) % 4;
        const pt = { x: 0, y: 0 };
        cellCenter(L, b.cell, pt);
        const d = L.pitch * 0.5;
        pt.x += q === 1 ? d : q === 3 ? -d : 0;
        pt.y += q === 0 ? -d : q === 2 ? d : 0;
        at.push(pt);
        parts.push(`${Math.round(pt.x)},${Math.round(pt.y)}`);
      }
    }
    const key = parts.join(';');
    if (key === this.splitInsKey) return;
    this.splitInsKey = key;
    this.splitIns.replaceChildren(
      ...at.map((pt) =>
        h('div', { class: 'lr-altar-in', style: { left: `${pt.x}px`, top: `${pt.y}px` } }, 'in'),
      ),
    );
  }

  /**
   * Until the first strike on an altar that introduces a gem, the route preview carries the
   * charge into and out of each new gem on it, so its effect reads before anything fires.
   */
  private updatePreviewChips(): void {
    const sim = this.teachChips && this.mode === 'edit' ? this.previewSim : null;
    const L = this.view.layout;
    const kinds = new Set<GemKind>([...this.news.fixed.map((f) => f.gem), ...this.news.tray]);
    const chips: { from: Cell; to: Cell; charge: number }[] = [];
    if (sim) {
      const ghost = this.ghost();
      const kindAt = (c: Cell): GemKind | undefined =>
        ghost && ghost.cell.x === c.x && ghost.cell.y === c.y
          ? ghost.gem
          : (this.board.at(c) ?? this.board.fixedAt(c))?.gem;
      const touches = (c: Cell): boolean => {
        const k = kindAt(c);
        return !!k && kinds.has(k);
      };
      for (const seg of sim.trace) {
        if (seg.pulse !== 0) continue;
        if (touches(seg.from) || touches(seg.to)) chips.push(seg);
      }
    }
    const key = chips
      .map((c) => `${c.from.x},${c.from.y}>${c.to.x},${c.to.y}=${c.charge}`)
      .join(';');
    if (key === this.previewChipKey) return;
    this.previewChipKey = key;
    for (const el of this.previewChipEls) el.remove();
    this.previewChipEls.length = 0;
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    const chipPx = Math.max(16, Math.min(24, Math.round(L.pitch * 0.3)));
    for (const c of chips) {
      anchorOf(L, c.from, a);
      anchorOf(L, c.to, b);
      const el = h(
        'div',
        {
          class: 'lr-altar-chip',
          'data-preview': '',
          'aria-hidden': 'true',
          style: {
            left: `${(a.x + b.x) / 2}px`,
            top: `${(a.y + b.y) / 2}px`,
            fontSize: scalePxCss(chipPx),
            lineHeight: `calc(${scalePxCss(chipPx)} + 6px)`,
          },
        },
        String(c.charge),
      );
      this.dom.insertBefore(el, this.tip);
      this.previewChipEls.push(el);
    }
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
      const fresh = (i === 0 && this.teaching) || this.teachTray.has(s.gem);
      const bob =
        fresh && !this.hand && n > 0 && !this.view.reducedMotion
          ? 0.35 + 0.35 * Math.sin(this.time * 4 + i)
          : 0;
      this.view.trayLift[i] =
        lift < 0 ? Math.min(0, lift + 0.05) : held ? 1 : i === this.hoverSlot ? 0.6 : bob;
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
      pt.x = p.x;
      pt.y = p.y;
      if (this.keyboard || !p.inside) {
        const i = L.tray.findIndex((s) => s.gem === hand.kind);
        const s = L.tray[Math.max(0, i)]!;
        pt.x = s.x;
        pt.y = s.y - 70;
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
    } else this.view.held = { kind: hand.kind, rot: hand.rot, x: pt.x, y: pt.y, snapped };
  }

  /** With a gem in hand (not dragging), is the pointer or cursor on one of the player's gems? */
  private overPlaced(): boolean {
    const cell = this.keyboard ? this.cursor : this.hoverCell;
    return !!cell && !!this.hand && !this.hand.from && !!this.board.at(cell);
  }

  /** Why the held gem will not land in `cell` (fixed gem, carved stone, off the altar). */
  private refusal(cell: Cell, kind: GemKind): string {
    if (this.board.fixedAt(cell)) return 'fixed';
    if (this.board.isBlocked(cell)) return 'blocked';
    const r = this.board.check(cell, kind);
    return r.ok ? 'occupied' : r.reason;
  }

  /** The socket the held gem is refused at (its tag stays while the gem hovers there). */
  private refusedKey = '';

  private showRefusal(cell: Cell | null, reason: string | null): void {
    const key = cell && reason ? `${cell.x},${cell.y}` : '';
    if (key === this.refusedKey) return;
    // A deny tag still showing (a click just refused) keeps its place.
    if (this.refusedKey && this.tagTimer <= 0) this.clearTags();
    this.refusedKey = key;
    if (!cell || !reason || this.tagTimer > 0) return;
    const pt = { x: 0, y: 0 };
    cellCenter(this.view.layout, cell, pt);
    this.addTag(pt.x, pt.y - this.view.layout.pitch * 0.42, DENY_REASON[reason] ?? reason, 'info');
  }

  private buildMarks(): void {
    const v = this.view;
    v.clearMarks();
    for (const b of this.puzzle.blocked) v.mark(b.x, b.y, 'blocked', GOLD, 1);
    for (const f of this.puzzle.fixed) v.mark(f.cell.x, f.cell.y, 'wanted', FIXED_RING, 0.8);
    for (const f of this.board.lockedPlacements) {
      v.mark(f.cell.x, f.cell.y, 'wanted', FIXED_RING, 0.8);
    }
    if (this.hintCell && this.mode !== 'strike') {
      v.mark(this.hintCell.x, this.hintCell.y, 'highlighted', GOLD, 1.3, 3);
    }
    if (this.mode === 'result' && this.result?.outcome !== 'exact') {
      const L = v.layout;
      for (const f of this.fizzleList) {
        if (f.cell.x < 0 || f.cell.y < 0 || f.cell.x >= L.cols || f.cell.y >= L.rows) continue;
        v.mark(f.cell.x, f.cell.y, 'highlighted', DANGER, 1.1, 5);
      }
    }
    if (this.mode === 'edit' && this.hand && !this.hand.from) {
      // Every socket the held gem would go in hums quietly, so legal moves read at a glance.
      // Sockets near the circuit hum clearly; the rest only whisper (they still take the gem).
      const kind = this.hand.kind;
      for (const c of this.validFor(kind))
        v.mark(c.x, c.y, 'highlighted', HUM[kind], this.isLive(c) ? 0.45 : 0.1, 0);
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
  }

  render(frame: Frame): void {
    this.view.render(frame);
  }
}

type HintMode = 'mouse' | 'keys' | 'strike';

/** The key-hint line for each mode. Short enough to sit under the tray at 150% text. */
function hintLine(mode: HintMode): (Node | string)[] {
  const b = (t: string) => h('b', null, t);
  switch (mode) {
    case 'mouse':
      return [
        b('Click'),
        ' a gem below, then a socket · ',
        b('R'),
        ' or ',
        b('scroll'),
        ' turns the gem you point at · ',
        b('Right-click'),
        ' removes',
      ];
    case 'keys':
      return [
        b('1–6'),
        ' pick a gem · ',
        b('Arrows'),
        ' move · ',
        b('Enter'),
        ' place / pick up · ',
        b('R'),
        ' turns · ',
        b('G'),
        ' end of the route',
      ];
    case 'strike':
      return ['Hold ', b('F'), ' to speed up · ', b('Click'), ' or ', b('Enter'), ' to skip'];
  }
}
