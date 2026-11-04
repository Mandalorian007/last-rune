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
import type { Frame, RGBA } from '@thunderclap/engine/render';
import { button, h, Loupe, type Rect, scalePxCss } from '@thunderclap/engine/ui';
import { POST_PRESETS } from '../../art/materials/post-presets';
import type { BoltMode, BoltSegment } from '../../art/props/bolt';
import { GEM_COLOUR, pitch } from '../../art/props/palette';
import type { BoltHandle, StormCellHandle } from '../../audio';
import { codexEntry } from '../../content/codex';
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
import { CSS_PALETTE } from '../../ui/styles';
import { ensureAltarStyles } from './altar-styles';
import { AltarView, DANGER, GOLD } from './altar-view';
import { BoardState } from './board';
import {
  type CapBeat,
  type ChargeChip,
  capacitorBeats,
  capBeatText,
  chargeChips,
  guideHops,
  liveSockets,
  type PathHop,
  previewPath,
} from './circuit-model';
import { jumpCursor, stepCursor } from './cursor';
import { emitPuzzleEvent, type FireMachine, puzzleEventsWanted } from './events';
import { setHintTarget } from './hints';
import {
  type AltarLayout,
  anchorOf,
  CAPTION_LANE,
  cellAt,
  cellCenter,
  FUSE_LANE,
  PHONE_GUTTER_CARD,
  type PhoneBand,
  type PropSpot,
  phoneFrameFor,
  snapCell,
  TRAY_CENTER_X,
  traySlotAt,
  trayTipX,
} from './layout';
import {
  arbitrate,
  type Grant,
  type HintSlot,
  hintRetired,
  introButton,
  phoneHint,
  pickHint,
  pickInfo,
  type VoiceAsk,
} from './moments';
import { allReached, gaugeReach } from './reach';
import { legalSockets, socketLooks } from './socket-looks';
import {
  type Arrival,
  buildTimeline,
  causeHeadline,
  causeText,
  type Fizzle,
  failHead,
  failText,
  fizzles,
  nextStep,
  rootCell,
  rootFizzle,
  type StrikeTimeline,
  strikeLabel,
  strikeStory,
  strikesLine,
} from './strike';
import { arrivalNudges, firstSentence, type NewGems, newGems } from './teach';

type Mode = 'edit' | 'strike' | 'result';

interface Hand {
  kind: GemKind;
  rot: number;
  /** Dragging a placed gem: where it came from (it stays on the board until dropped). */
  from: Cell | null;
}

interface Press {
  /** `aim`: a finger down on the board with a gem in hand; it lands where the finger lifts. */
  origin: 'tray' | 'board' | 'aim';
  cell: Cell | null;
  x: number;
  y: number;
  dragging: boolean;
  /** Scene time at the press (a long touch shows the info card instead of picking up). */
  t: number;
  /** A tap on the tray gem already in hand: lifting the finger puts it back (mobile-6-board). */
  again?: boolean;
}

/** A touch held this long on a placed gem shows its card and selects it for ↻ (no pick-up). */
const HOLD_SECS = 0.45;
/** While a finger drags a gem, it aims this many CSS px above the fingertip, in plain sight. */
const LIFT_CSS = 56;
/** Touch: how long the held gem's card stays up after the pick (no hover to keep it). */
const TOUCH_CARD_SECS = 2.5;
const SVG_NS = 'http://www.w3.org/2000/svg';
/** Phones: under this socket pitch (CSS px) a finger aiming a gem gets the loupe. */
const LOUPE_PITCH_CSS = 44;
/** The loupe: diameter (CSS px) and magnification. */
const LOUPE_SIZE = 128;
const LOUPE_MAG = 2.5;

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
 * gems need no turning; a fixed Bend, Gate or Split is part of the machine.
 */
const NO_TURN: Record<GemKind, string> = {
  channel: "Can't turn: charge goes straight through",
  amplify: "Can't turn: charge goes straight through",
  capacitor: "Can't turn: charge goes straight through",
  split: "Can't turn: fixed in place",
  bend: "Can't turn: fixed in place",
  gate: "Can't turn: fixed in place",
};

const SIDE_NAME = ['north', 'east', 'south', 'west'] as const;

/** Which sides a Bend, Gate or Split at `rot` uses, for the announcer (rules.md section 4). */
function sidesText(gem: GemKind, rot: number): string {
  const s = (k: number) => SIDE_NAME[(((rot + k) % 4) + 4) % 4]!;
  if (gem === 'bend') return `joins ${s(0)} and ${s(1)}`;
  if (gem === 'gate') return `in from ${s(3)} and ${s(1)}, out ${s(0)}`;
  if (gem === 'split') return `in from ${s(2)}, out ${s(3)} and ${s(1)}`;
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
/**
 * The first altar's arrival card also says what the gold socket rings mean: the teach socket,
 * the machine's exit and, once building, the open ends of the route all ring gold.
 */
/** A fixed gem's card on a phone opens with this (mobile-7-teach). */
const FIXED_LINE = 'Fixed: part of the machine.';
/** A tray gem on the arrival card: the player's to place. */
const YOURS_LINE = 'Yours to place.';
const RING_NAME = 'Gold ring';
const RING_RULE = 'A socket the charge must reach. Set a gem there.';

const SLOT_ACTIONS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
const CYAN: RGBA = [0.25, 1.3, 1.8, 1];
/** Fixed gems wear cold iron, not gold: gold marks where the player acts. */
const WHITE_HOT: RGBA = [2, 2, 2, 1];
const OPEN_END: RGBA = [1.5, 1.05, 0.5, 1];
/** The ring round every socket the held gem may go in: pale gold, bright on navy or stone. */
const LEGAL_RING: RGBA = [1.35, 1.1, 0.62, 1];
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
  /** The root red mark of a failed strike: the verdict moves so it never covers this socket. */
  private verdictAvoid: Cell | null = null;
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
  /** The tray slot the info card points at (null: none), and the caption edge it was fit to. */
  private tipSlotX: number | null = null;
  private tipRight = 0;
  /** Iron brackets on fixed (and hint-locked) gems, rebuilt when the board changes. */
  /** Turn arrow on a held Bend, Gate or Split, until the player has turned one here. */
  private turnBadge!: HTMLElement;
  private turned = false;
  /** Touch: the on-screen turn control, by the held gem or the gem last placed or selected. */
  private turnBtn!: HTMLButtonElement;
  /** Touch: a ↻ mark on the gem the button turns (not a target itself: taps pass through). */
  private turnMark!: HTMLElement;
  /** Whether Turn has a gem to turn (null: not yet decided since the DOM was built). */
  private turnShown: boolean | null = null;
  private turnTarget: Cell | 'hand' | null = null;
  private lastPlaced: Cell | null = null;
  /** Scene time the gem in hand was taken from the tray. */
  private handAt = 0;
  /** Frames left in which avoidTray re-measures after enter. */
  private settleFrames = 4;
  /** Phones: the magnifier over the board while a finger aims a gem (made on first use). */
  private loupe: Loupe | null = null;
  /** Board gem the keyboard cursor last announced. */
  private focusKey = '';

  // DOM
  private dom!: HTMLElement;
  private subtitle!: HTMLElement;
  /** Phones (mobile-6-board): "Holding Bend" over the tray, in the title's place, while held. */
  private holdingEl!: HTMLElement;
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
  /** The hint's mode, plus `+` when it mentions ↻ (phones say it only while it applies). */
  private hintMode = '';
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
  /** Phones: the arrival card's page, one new piece at a time; the player turns it (Next ›). */
  private introPageIdx = 0;
  /** Phones: lines other workstreams put in the how-to slot (`setHintLine`, moments.ts). */
  private hintLines: Partial<Record<HintSlot, string | null>> = {};
  /** Phones: the column arbiter froze FUSE's caption to make room (released when it fits). */
  private fuseHeld = false;
  /** Phones: FUSE's bubble height when last measured (it is not laid out while frozen). */
  private fuseH = 0;
  /** Phones: the how-to line has retired (moments.ts), and FUSE's fail quip waits its turn. */
  private hintRetired = false;
  private pendingQuip: ReturnType<typeof reactionLine> | null = null;
  /** Phones: a long press opened this gem's full card; the next tap closes it. */
  private infoPin: { gem: GemKind; how: InfoHow } | null = null;
  /** Phones: the frame the layout was built for, and a rebuild waiting for edit mode. */
  private frame = '';
  private relayoutPending = false;
  private offDevice: (() => void) | null = null;
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
  /** Where the preview's first strike meets a gem from a side it doesn't take: a small ✕. */
  private noGoEls: HTMLElement[] = [];
  private noGoKey = '';

  // Multi-strike read-outs (capacitor-clarity)
  /** "2 strikes" row in the storm's Gives card, and pips on Strike: one per strike. */
  private strikeRow: HTMLElement | null = null;
  private strikePips: HTMLElement[] = [];
  /** One read-out per Capacitor the bolt reaches: what it keeps and lets out, per strike. */
  private capEls: HTMLElement[] = [];
  /** Phones: the column lane under the tray (gem chip, verdict, Capacitor read-outs). */
  private lane: HTMLElement | null = null;
  /** Gives/Needs card sizes when last placed (phone). */
  private labelKey = '';
  /** Phones: how far (design px) the lane steps right of a label, and the bubble's last place. */
  private laneShift = 0;
  private capKey2 = '';
  /** Phones: Strike's "twice" / "1 of 2" for multi-strike altars (the pips are for big screens). */
  private strikeCount: HTMLElement | null = null;
  /**
   * Strike's word (mobile-7-strike). Phones say what a tap does on one line: "Strike",
   * "Strike (2 left)", "Strike again" while the last strike runs, "Try again" after a fail.
   */
  private strikeWord: HTMLElement | null = null;
  /** Phones: one reach lamp per gauge, before Strike (see reach.ts). */
  private lampEls: (HTMLElement | null)[] = [];
  /** Phones: one marker per tray slot (a used-up slash; the first visit's pulse). */
  private slotEls: HTMLElement[] = [];
  /** A gem has been taken from the tray at this visit (ends the first visit's tray pulse). */
  private picked = false;
  private capKey = '';
  /** The strike's Capacitor beats (live read-out), with their line elements. */
  private capBeats: CapBeat[] = [];
  private capLines: HTMLElement[] = [];

  constructor(readonly machine: MachineId) {}

  // ── Lifecycle ───────────────────────────────────────────────────────────

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    this.settleFrames = 4;
    this.puzzle = puzzleFor(this.machine);
    this.board = new BoardState(this.puzzle);
    this.board.restore(ctx.flow.placementsFor(this.machine) as Placement[]);
    this.view = new AltarView(ctx, this.puzzle);
    this.view.reducedMotion = ctx.settings.reducedMotion;
    this.view.reduceFlashes = ctx.settings.reduceFlashes;
    this.view.syncBoard(this.board);
    this.cursor = {
      x: 0,
      y: this.puzzle.storm.at.y >= 0 ? Math.max(0, this.puzzle.storm.at.y) : 0,
    };
    this.cursor.y = Math.min(this.cursor.y, this.view.layout.rows - 1);

    this.postSnapshot = structuredClone(ctx.post.settings);
    this.applyPost();
    this.bloomBase = ctx.post.settings.bloom.intensity;
    this.setMood();
    this.hum = ctx.sound.sfx.stormCell(this.puzzle.storm.strength, 0.8);

    const save = ctx.save.get();
    this.hintRetired = hintRetired(save.progress.solved);
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
    this.frame = this.frameKey();
    this.offDevice = ctx.device.onChange(() => {
      this.relayoutPending = this.frameKey() !== this.frame;
    });
    // On the first altar the card (with the gold-ring line) stays until the first placement.
    // Phones: until the player taps Got it (or places a gem), never on a timer.
    this.introLeft =
      this.introRows().length === 0
        ? 0
        : this.teachCell || this.view.layout.phone
          ? Number.POSITIVE_INFINITY
          : INTRO_SECS;
    this.introPageIdx = 0;
    this.announce(this.briefing());

    this.updateHint(); // also keeps the caption off the tray and the hint
    const saved = ctx.save.get().puzzles[this.machine];
    if (!saved || saved.attempts === 0) {
      const arrive = machineLine(this.machine, 'arrive');
      if (arrive) void ctx.fuse.say(arrive, { interrupt: true });
      // New gems: one line each once FUSE is free, unless the player is already using it.
      this.pendingNudges = arrivalNudges(this.news, !!this.teachCell);
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
    this.holdFuse(false);
    this.phoneCaption(false);
    this.offDevice?.();
    this.offDevice = null;
    setHintTarget(null);
    this.ctx.flow.savePlacements(this.machine, this.board.serialise());
    this.boltSound?.stop(0.2);
    this.boltSound = null;
    this.hum?.stop(0.4);
    this.hum = null;
    if (this.announceTimer !== null) clearTimeout(this.announceTimer);
    this.teardownView();
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

  /** The board's view and every DOM label on it (exit, and a phone relayout). */
  private teardownView(): void {
    this.view.dispose();
    this.loupe?.destroy();
    this.loupe = null;
    this.dom.remove();
    this.chipEls.length = 0;
    this.previewChipEls.length = 0;
    this.noGoEls.length = 0;
    this.capEls.length = 0;
    this.capLines.length = 0;
    this.capBeats = [];
    this.capKey = '';
    this.strikePips.length = 0;
    this.strikeRow = null;
    this.strikeCount = null;
    this.strikeWord = null;
    this.lampEls.length = 0;
    this.lane = null;
    this.laneShift = 0;
    this.capKey2 = '';
    this.slotEls.length = 0;
    this.leader = null;
    this.leaderKey = '';
    this.fixedTap = null;
  }

  /** The altar's look; phones drop the fog and vignette so the whole grid reads evenly. */
  private applyPost(): void {
    const post = this.ctx.post;
    post.set(POST_PRESETS.altar);
    if (this.view.layout.phone) post.set({ fog: { enabled: false }, vignette: { enabled: false } });
  }

  /** The phone frame the layout was built for ('' off phones). */
  private frameKey(): string {
    const d = this.ctx.device;
    const f = phoneFrameFor(d);
    return f ? `${f.padL},${f.padR},${f.cssPx.toFixed(3)},${f.top},${f.bottom}` : '';
  }

  /**
   * A phone turned, or the window crossed the phone size: rebuild the board's layout and its
   * labels for the new frame. Waits for the edit mode (never mid-strike or on a verdict).
   */
  private relayout(): void {
    this.relayoutPending = false;
    this.frame = this.frameKey();
    this.teardownView();
    this.view = new AltarView(this.ctx, this.puzzle);
    this.view.reducedMotion = this.ctx.settings.reducedMotion;
    this.view.reduceFlashes = this.ctx.settings.reduceFlashes;
    this.view.syncBoard(this.board);
    this.applyPost();
    this.press = null;
    this.infoPin = null;
    this.circuitRev = -1;
    this.circuitMode = null;
    this.cursorKey = '';
    this.idleRev = -1;
    this.validRev = -1;
    this.tipKey = '';
    this.focusKey = '';
    this.previewChipKey = '';
    this.ghostKey = '';
    this.noGoKey = '';
    this.buildDom();
    this.refreshHud();
    this.updateHint();
    this.settleFrames = 4;
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
   * Left edge (design px) of FUSE's caption card when it sits beside the tray, so the gem card
   * stops short of it (a phone's caption is bigger than the lane the layout keeps for it).
   */
  private captionLeft(L: AltarLayout): number {
    const ui = this.ctx.ui;
    const cap = ui.root.querySelector<HTMLElement>('.tc-caption:not([hidden])');
    const r = cap?.getBoundingClientRect();
    if (!r || r.width === 0) return CAPTION_LANE.x;
    const o = ui.root.getBoundingClientRect();
    const top = (r.top - o.top) / ui.scale;
    const left = (r.left - o.left) / ui.scale;
    if (top > 1080 || (r.bottom - o.top) / ui.scale < L.trayY - 200 || left < TRAY_CENTER_X)
      return CAPTION_LANE.x;
    return Math.min(CAPTION_LANE.x, left - 16);
  }

  /**
   * Keep FUSE's caption card off the tray band (slots, counts, tooltips) and the key-hint line.
   * The hint is measured, so a longer line or a bigger text size moves the card as needed.
   */
  private avoidTray(): void {
    const L = this.view.layout;
    // Phones: the caption has its own bubble in the bottom band (phoneCaption).
    if (L.phone) {
      this.ctx.fuse.avoid(null);
      return;
    }
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
    // FUSE himself (bottom-left): the card may move to that corner, but never over his body.
    regions.push({
      x: 0,
      y: FUSE_LANE.y - 30,
      width: FUSE_LANE.x,
      height: 1080 - (FUSE_LANE.y - 30),
    });
    // Machine need labels, and the button rows, so the card never moves over them either
    // (bigger text makes the card taller, and it can reach a label beside an east machine).
    if (this.dom.isConnected) {
      const ui = this.ctx.ui;
      const o = ui.root.getBoundingClientRect();
      const els = [
        this.hint,
        ...(this.verdict.hidden ? [] : [this.verdict]),
        ...this.needs,
        ...(this.stormLabel ? [this.stormLabel] : []),
        this.actionsEl,
        ...(this.turnBtn.hidden ? [] : [this.turnBtn]),
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
      this.hint.replaceChildren(other);
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
  }

  /**
   * Phones: put a line in the how-to slot under the tray, or clear it with `null`. The slot
   * shows one line, in `HINT_SLOTS` order ('holding' first, then the how-to line), and the
   * column arbiter (`arrangeColumn`) gives it room after the verdict, the teach card and a
   * gem's tip, before FUSE. For mobile-6-board ("Holding: X"); off phones it is ignored.
   */
  setHintLine(slot: Exclude<HintSlot, 'howto'>, text: string | null): void {
    if ((this.hintLines[slot] ?? null) === text) return;
    this.hintLines[slot] = text;
    this.updateHint();
  }

  private setMood(): void {
    this.ctx.setMood(this.machine === 'the-last-rune' ? 'last-rune' : 'altar');
  }

  // ── DOM ─────────────────────────────────────────────────────────────────

  private buildDom(): void {
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
    const trayRight = Math.max(...L.tray.map((s) => s.x), TRAY_CENTER_X);
    this.turnBtn.style.left = `${trayRight + 80}px`;
    this.turnBtn.style.top = `${L.trayY}px`;
    this.turnMark = h(
      'div',
      { class: 'lr-altar-turnmark lr-touch-only', 'aria-hidden': 'true', hidden: true },
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
        'Gives ',
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
    if (band) {
      // The column right of the board (layout.ts PhoneBand): title, tray, then the lane.
      const st = this.dom.style;
      st.setProperty('--lr-col-l', `${band.colL}px`);
      st.setProperty('--lr-col-w', `${band.colR - band.colL}px`);
      st.setProperty('--lr-lane-t', `${band.laneTop}px`);
      st.setProperty('--lr-bub-l', `${band.bubbleL}px`);
      st.setProperty('--lr-bub-b', `${1080 - band.bubbleB}px`);
      this.verdict.style.left = '';
      this.verdict.style.maxWidth = '';
      delete this.verdict.dataset.narrow;
      // The how-to line heads the lane, under the tray: its own slot, apart from FUSE's bubble.
      this.lane = h('div', { class: 'lr-altar-lane' }, this.hint, this.tip, this.verdict);
      this.dom.append(this.lane);
      this.slotEls = L.tray.map((t) =>
        h('div', {
          class: 'lr-altar-slot',
          'aria-hidden': 'true',
          style: { left: `${t.x}px`, top: `${t.y}px`, width: `${t.size}px`, height: `${t.size}px` },
        }),
      );
      this.dom.prepend(...this.slotEls);
      this.leader = document.createElementNS(SVG_NS, 'svg');
      this.leader.setAttribute('class', 'lr-teach-leader');
      this.leader.setAttribute('viewBox', '0 0 1920 1080');
      this.leader.setAttribute('aria-hidden', 'true');
      this.dom.append(this.leader);
    }
    this.phoneCaption(true);
    this.ctx.ui.layers.hud.append(this.dom);
    // Dev/e2e handle: the layout in use (tests tap cells and slots by it on phones).
    if (import.meta.env.DEV) {
      Object.defineProperty(window, '__altarLayout', {
        configurable: true,
        get: () => this.view.layout,
      });
      Object.assign(window, { __altarView: this.view });
    }
  }

  /**
   * Phones: FUSE's caption is a bubble beside him in the bottom band, left of the tray (CSS
   * reads these variables off the overlay root; ui/phone-styles.ts). Off phones, nothing.
   */
  private phoneCaption(on: boolean): void {
    const st = this.ctx.ui.root.style;
    const band = this.view.layout.phone;
    if (on && band) {
      st.setProperty('--lr-cap-l', `${band.bubbleL}px`);
      // From the column's left edge on into the right bar (CSS adds the bar).
      st.setProperty('--lr-cap-w', `${1920 - band.bubbleL}px`);
      // Over FUSE's head, its tail pointing down at him (mobile-5-moments).
      const f = this.view.fuse;
      const head = 1080 - f.y + 2.3 * f.scale + 6 * band.cssPx;
      st.setProperty('--lr-cap-b', `${Math.round(Math.max(1080 - band.bubbleB, head))}px`);
      st.setProperty('--lr-cap-tail', `${Math.round(f.x - band.bubbleL)}px`);
    } else {
      st.removeProperty('--lr-cap-l');
      st.removeProperty('--lr-cap-w');
      st.removeProperty('--lr-cap-b');
      st.removeProperty('--lr-cap-tail');
    }
  }

  private refreshHud(): void {
    const L = this.view.layout;
    L.tray.forEach((s, i) => {
      const el = this.counts[i]!;
      const n = this.board.remaining(s.gem);
      // A keycap for the hotkey, then the count apart from it: "1 ×6" must never read "16".
      el.replaceChildren(
        h('kbd', { class: 'lr-k' }, String(i + 1)),
        // Phones: a used-up gem stays as a dimmed silhouette that reads "all placed".
        h('span', { class: 'lr-n' }, n === 0 && L.phone ? 'all placed' : `×${n}`),
      );
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
    // A long gem name must not run the pill into Menu.
    if (L.phone && this.dom.isConnected)
      keepClearOfMenu(
        this.holdingEl,
        this.ctx.ui.root.querySelector('.lr-hud-menu'),
        this.ctx.ui.scale,
      );
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
      if (this.attempts > 0) parts.push(`· try ${this.attempts + 1}`);
      this.subtitle.replaceChildren(
        ...parts.flatMap((t, i) => [...(i ? [' '] : []), h('span', { class: 'lr-nowrap' }, t)]),
      );
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
    if (L.phone) {
      this.fitPhone(L.phone);
      return;
    }
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
    if (this.stormLabel) {
      this.clearOfBoard(this.stormLabel);
      this.clearOfActions(this.stormLabel);
    }
    // The verdict sits under the title, however many lines the title took.
    const titleBottom = this.titleEl.offsetTop + this.titleEl.offsetHeight;
    this.verdict.style.top = `${Math.max(96, titleBottom + 6)}px`;
    this.verdict.removeAttribute('data-docked');
    if (!this.verdict.hidden) this.clearRootMark(lo, hi);
    this.avoidTray();
  }

  /**
   * Phones: the title is one line over the board's centre; the verdict sits in the info lane
   * (bottom right, beside the tray), bottom-aligned, never over the board.
   */
  private fitPhone(band: PhoneBand): void {
    const L = this.view.layout;
    this.titleEl.style.left = `${Math.round(L.titleX)}px`;
    this.titleEl.style.maxWidth = `${band.colR - band.colL}px`;
    const v = this.verdict;
    v.removeAttribute('data-docked');
    v.removeAttribute('data-narrow');
    v.style.top = '';
    this.placePhoneLabels(band);
    this.ctx.fuse.avoid(null);
  }

  /**
   * Phones: every Gives/Needs card beside its own gauge, never on the board (8 CSS px clear).
   * West/east cards hang under their gauge in its gutter, wrapping to fit; north/south cards
   * sit beside the gauge, outside the board's edge, on whichever side is free of the other
   * gauges and cards.
   */
  private placePhoneLabels(band: PhoneBand): void {
    const L = this.view.layout;
    const k = this.ctx.ui.scale;
    const ox = this.ctx.ui.root.getBoundingClientRect();
    const box = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        l: (r.left - ox.left) / k,
        r: (r.right - ox.left) / k,
        t: (r.top - ox.top) / k,
        b: (r.bottom - ox.top) / k,
      };
    };
    type Box = ReturnType<typeof box>;
    const hit = (a: Box, b: Box, pad: number) =>
      a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
    const gauge = (sp: PropSpot): Box => {
      const half = sp === L.storm ? sp.size * 0.26 : sp.size * 0.46;
      return { l: sp.x - half, r: sp.x + half, t: sp.y - half, b: sp.y + half };
    };
    const items: [HTMLElement, PropSpot][] = [
      ...(this.stormLabel ? [[this.stormLabel, L.storm] as [HTMLElement, PropSpot]] : []),
      ...this.needs.map((el, i) => [el, L.machines[i]!] as [HTMLElement, PropSpot]),
    ];
    const gauges = [L.storm, ...L.machines].map(gauge);
    const placed: Box[] = [];
    const room = (PHONE_GUTTER_CARD * band.cssPx) | 0;
    const minX = band.padL + band.edge;
    const maxX = band.colL - band.edge;
    // West/east cards sit under their gauge; north/south ones beside it, right or left. The
    // sides are chosen together (every combination, ≤2^4): never off the open canvas, under a
    // side bar or into the column, then not over another card, then not over a gauge.
    const free: { el: HTMLElement; sp: PropSpot; opts: { x: number; b: Box; cost: number }[] }[] =
      [];
    for (const [el, sp] of items) {
      const lb = sp.label;
      el.style.marginLeft = '';
      el.style.marginTop = '';
      el.style.maxWidth = '';
      if (lb.align === 'below') {
        el.dataset.align = 'below';
        el.style.maxWidth = `${room}px`;
        el.style.left = `${lb.x}px`;
        el.style.top = `${lb.y}px`;
        // Off the bottom of the screen: up over the gauge's top instead.
        if (box(el).b > band.visB - band.edge) {
          el.dataset.align = 'above';
          el.style.top = `${Math.round(gauge(sp).t)}px`;
        }
        placed.push(box(el));
        continue;
      }
      el.dataset.align = lb.align === 'up' ? 'up' : 'down';
      el.style.top = `${lb.y}px`;
      const own = gauge(sp);
      const opts = [...new Set([lb.x, lb.alt ?? lb.x])].map((x) => {
        el.toggleAttribute('data-left', x < sp.x);
        el.style.left = `${x}px`;
        const b = box(el);
        const cost =
          (b.l < minX || b.r > maxX ? 100 : 0) +
          (gauges.some((g) => g !== own && hit(b, g, 2)) ? 1 : 0);
        return { x, b, cost };
      });
      free.push({ el, sp, opts });
    }
    let best: number[] = free.map(() => 0);
    let bestCost = Number.POSITIVE_INFINITY;
    const pick: number[] = [];
    const search = (i: number, cost: number) => {
      if (cost >= bestCost) return;
      if (i === free.length) {
        best = [...pick];
        bestCost = cost;
        return;
      }
      free[i]!.opts.forEach((o, j) => {
        let c = cost + o.cost;
        if (placed.some((p) => hit(o.b, p, 4))) c += 10;
        for (let k = 0; k < i; k++) if (hit(o.b, free[k]!.opts[pick[k]!]!.b, 4)) c += 10;
        pick[i] = j;
        search(i + 1, c);
      });
    };
    search(0, 0);
    // Never closer than 8 CSS px to the visible band's top (mobile-6-board): a two-line
    // north card nudges down instead (into the clearance above the board, not over it).
    const topMin = band.visT + 8 * band.cssPx;
    free.forEach(({ el, sp, opts }, i) => {
      const x = opts[best[i]!]!.x;
      el.toggleAttribute('data-left', x < sp.x);
      el.style.left = `${x}px`;
      const t = box(el).t;
      if (t < topMin) el.style.marginTop = `${Math.ceil(topMin - t)}px`;
    });
  }

  /**
   * The storm's strike row and the pips: "2 strikes" while editing (`now` < 0), "Strike 2 of 2"
   * once strike `now` fires, with that many pips lit.
   */
  private setStrikeRow(now: number): void {
    this.setStrikeWord(now < 0 ? 'edit' : 'strike', now);
    if (!this.strikeRow) return;
    const n = this.puzzle.pulses;
    // Phones (mobile-5-board): the storm's card says the number is per strike ("Gives 8" /
    // "per strike") and Strike says what one tap does ("Strike" / "twice"), then counts the run
    // ("1 of 2"). The pips are hidden there, and the card keeps "per strike" through the run
    // (the button counts it), so it fits the gauge's gutter at 13 px.
    const phone = !!this.view.layout.phone;
    this.strikeRow.textContent = phone
      ? 'per strike'
      : now < 0
        ? `${n} strikes`
        : `Strike ${now + 1} of ${n}`;
    if (this.strikeCount)
      this.strikeCount.textContent = now < 0 ? timesWord(n) : `${now + 1} of ${n}`;

    this.strikePips.forEach((el, i) => {
      el.toggleAttribute('data-lit', i % n <= now);
    });
    const band = this.view.layout.phone;
    if (band) {
      if (this.dom?.isConnected) this.placePhoneLabels(band);
    } else if (this.stormLabel) this.clearOfBoard(this.stormLabel);
  }

  /**
   * Phones (mobile-7-strike): Strike says what a tap will do, on one line (`strikeLabel`).
   * Big screens keep "Strike" and the pips.
   */
  private setStrikeWord(state: 'edit' | 'strike' | 'fail', now = -1): void {
    if (!this.strikeWord || !this.view.layout.phone) return;
    const text = strikeLabel(this.puzzle.pulses, state, now);
    if (this.strikeWord.textContent !== text) this.strikeWord.textContent = text;
  }

  /**
   * A storm on the west or east edge has its "Gives N" card centred under it, which at bigger
   * text reaches over the board's first column. Slide the card outward until it clears the
   * sockets; the notch stays under the storm.
   */
  private clearOfBoard(el: HTMLElement): void {
    const L = this.view.layout;
    const side = L.storm.side;
    el.style.marginLeft = '';
    el.style.removeProperty('--lr-notch');
    // Runs while the DOM is still being built (setStrikeRow), before `dom` is attached.
    if ((side !== 1 && side !== 3) || !this.dom?.isConnected) return;
    const w = el.offsetWidth;
    const x = L.storm.label.x;
    const gap = 6;
    let shift = 0;
    if (side === 3) {
      const edge = L.left + L.margin - gap;
      shift = Math.min(0, edge - (x + w / 2));
      shift = Math.max(shift, 8 - (x - w / 2)); // never off the left of the screen
    } else {
      const edge = L.right - L.margin + gap;
      shift = Math.max(0, edge - (x - w / 2));
    }
    if (shift === 0) return;
    el.style.marginLeft = `${Math.round(shift)}px`;
    el.style.setProperty('--lr-notch', `${Math.round(w / 2 - shift)}px`);
  }

  /**
   * Capacitor read-outs beside each Capacitor the bolt reaches, one line per strike it acts
   * on. `live` lines start hidden and appear as the strike reaches them (see `updateCapLive`);
   * otherwise it is the plan for the board as built, shown before Strike.
   */
  private renderCaps(beats: readonly CapBeat[], sim: SimResult | null, live: boolean): void {
    const key =
      (live ? 'L' : 'P') +
      beats
        .map((b) => `${b.cell.x},${b.cell.y}:${b.pulse}${b.kind}${b.stored}+${b.incoming}`)
        .join(';');
    if (key === this.capKey) return;
    this.capKey = key;
    for (const el of this.capEls) el.remove();
    this.capEls.length = 0;
    this.capLines.length = 0;
    this.capBeats = live ? [...beats] : [];
    const L = this.view.layout;
    const route = new Set<string>();
    for (const s of sim?.trace ?? []) route.add(`${s.to.x},${s.to.y}`);
    const cells = new Map<string, CapBeat[]>();
    for (const b of beats) {
      const k = `${b.cell.x},${b.cell.y}`;
      cells.set(k, [...(cells.get(k) ?? []), b]);
    }
    const pt = { x: 0, y: 0 };
    for (const list of cells.values()) {
      const c = list[0]!.cell;
      cellCenter(L, c, pt);
      // Off the board where the Capacitor sits on an edge column; else above it, or below
      // when the route runs through the socket above.
      const free = (x: number, y: number) => y < 0 || y >= L.rows || !route.has(`${x},${y}`);
      const side =
        c.x === 0
          ? 'left'
          : c.x === L.cols - 1
            ? 'right'
            : !free(c.x, c.y - 1) && free(c.x, c.y + 1)
              ? 'below'
              : 'above';
      const off = L.pitch * 0.42;
      const x = side === 'left' ? pt.x - off : side === 'right' ? pt.x + off : pt.x;
      const y = side === 'above' ? pt.y - off : side === 'below' ? pt.y + off : pt.y;
      const lines = list.map((b) => {
        const el = h(
          'span',
          { class: 'lr-cap-line', 'data-kind': b.kind },
          capBeatText(b, this.puzzle.pulses),
        );
        if (live) el.hidden = true;
        this.capLines.push(el);
        return el;
      });
      const el = h(
        'div',
        {
          class: 'lr-altar-cap',
          'data-side': side,
          'aria-hidden': 'true',
          ...(live ? {} : { 'data-plan': '' }),
          style: { left: `${x}px`, top: `${y}px` },
        },
        ...lines,
      );
      if (this.lane) {
        // Phones: in the column lane, under a heading, never over the board or a label.
        el.dataset.side = 'lane';
        el.style.left = '';
        el.style.top = '';
        el.prepend(h('span', { class: 'lr-cap-head' }, 'Capacitor'));
        this.lane.append(el);
      } else this.dom.insertBefore(el, this.tip);
      this.capEls.push(el);
    }
  }

  /** Live read-out: show each Capacitor line once its bolt has arrived; the newest is lit. */
  private updateCapLive(): void {
    const tl = this.timeline;
    if (!tl || this.capBeats.length === 0) return;
    let newest = -1;
    this.capBeats.forEach((b, i) => {
      const show = this.st >= tl.segments[b.seg]!.t1;
      const el = this.capLines[i]!;
      if (el.hidden === show) el.hidden = !show;
      if (show) newest = i;
    });
    this.capLines.forEach((el, i) => {
      el.toggleAttribute('data-now', i === newest && this.mode === 'strike');
    });
  }

  private showVerdict(
    text: string,
    outcome: BoltOutcome,
    story = '',
    hint = '',
    cause = '',
    strikes = '',
  ): void {
    // The verdict sits where the subtitle is; the subtitle steps aside until the next edit.
    this.subtitle.style.display = 'none';
    this.verdict.textContent = text;
    // Phones, multi-strike: each strike's reading, in words, right under the headline.
    if (strikes) this.verdict.append(h('small', { class: 'lr-verdict-strikes' }, strikes));
    // Phones: where it went wrong rides in the verdict, not in a tag over the board.
    if (cause) this.verdict.append(h('small', { class: 'lr-verdict-cause' }, cause));
    if (story) this.verdict.append(h('small', { class: 'lr-verdict-story' }, story));
    // One visible next step (the fizzle tags fade; this stays until the next edit).
    else if (hint) this.verdict.append(h('small', { class: 'lr-verdict-hint' }, hint));
    this.verdict.dataset.outcome = outcome;
    this.verdict.hidden = false;
    this.fitTop();
  }

  /**
   * The verdict never hides the red mark its Try line points at (at 1280×720 with big text the
   * box reaches the board's top row). Slide it sideways within the title band if that clears
   * the socket; otherwise dock it under the altar, between the board and the tray.
   */
  private clearRootMark(lo: number, hi: number): void {
    const cell = this.verdictAvoid;
    if (!cell) return;
    const L = this.view.layout;
    const c = { x: 0, y: 0 };
    anchorOf(L, cell, c);
    const r = L.pitch * 0.5;
    const covers = () => {
      const b = designBox(this.verdict);
      return b.l < c.x + r && b.r > c.x - r && b.t < c.y + r && b.b > c.y - r;
    };
    if (!covers()) return;
    const v = this.verdict;
    const w = v.offsetWidth;
    const x0 = v.style.left;
    for (const x of [lo + w / 2, hi - w / 2]) {
      v.style.left = `${Math.round(x)}px`;
      if (!covers()) return;
    }
    // Docked: under the last row of sockets, above the tray gems, a little wider so the
    // headline and the Try line take a line each.
    const last = { x: 0, y: 0 };
    anchorOf(L, { x: 0, y: L.rows - 1 }, last);
    const top = last.y + L.pitch * 0.5 + 10;
    const floor = L.trayY - (L.tray[0]?.size ?? 92) / 2 - 6;
    const top0 = v.style.top;
    const maxW0 = v.style.maxWidth;
    const narrow0 = v.hasAttribute('data-narrow');
    v.toggleAttribute('data-docked', true);
    v.removeAttribute('data-narrow');
    v.style.maxWidth = `${Math.round(Math.min(780, L.right - L.left))}px`;
    // Centred under the board, but kept out of the caption lane, so FUSE's card keeps its
    // bottom-right corner instead of moving over FUSE.
    const dw = v.offsetWidth;
    const cx = Math.max(
      16 + dw / 2,
      Math.min((L.left + L.right) / 2, CAPTION_LANE.x - 12 - dw / 2),
    );
    v.style.left = `${Math.round(cx)}px`;
    v.style.top = `${Math.round(top)}px`;
    if (top + v.offsetHeight <= floor && !covers()) return;
    // No room under the board: keep the usual place (better than covering the tray).
    v.removeAttribute('data-docked');
    v.toggleAttribute('data-narrow', narrow0);
    v.style.maxWidth = maxW0;
    v.style.left = x0;
    v.style.top = top0;
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
      ...(this.teachCell ? [`${RING_NAME}: ${RING_RULE}`] : []),
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
      parts.push(`Where it went wrong: ${this.tags.map((t) => t.textContent ?? '').join('; ')}.`);
    }
    return parts.join(' ');
  }

  private addTag(x: number, y: number, text: string, tone: 'bad' | 'info' = 'bad'): HTMLElement {
    const el = h('div', { class: 'lr-altar-tag', style: { left: `${x}px`, top: `${y}px` } }, text);
    if (tone === 'info') el.dataset.tone = 'info';
    this.dom.append(el);
    this.tags.push(el);
    return el;
  }

  /**
   * Whether a tag covers any of the verdict box (headline, Try line or story), measured on the
   * laid-out boxes (not mid-animation rects), for tags above or below their anchor, any text size.
   */
  private overlapsVerdict(tag: HTMLElement): boolean {
    if (this.verdict.hidden || !this.dom.isConnected || this.lane) return false;
    return boxesTouch(tag, this.verdict, 6);
  }

  /**
   * Settle a fizzle tag where it covers neither the verdict box nor an earlier tag: above its
   * anchor, else hung below it, else one tag-height further out, else just under the verdict if
   * that is still near its cell. A tag that would land far from its cell is dropped (false): the
   * red mark and the Try line still say it, and a stray tag would point at the wrong socket.
   */
  private placeClear(
    tag: HTMLElement,
    above: number,
    below: number,
    others: HTMLElement[],
  ): boolean {
    const at = (y: number, low: boolean) => {
      tag.toggleAttribute('data-below', low);
      tag.style.top = `${Math.round(y)}px`;
    };
    const L = this.view.layout;
    if (L.phone) {
      // Phones: by its red socket, slid along to stay over the slab (never over the storm or
      // a card), then above or below whichever is clear.
      const x0 = Number.parseFloat(tag.style.left) || 0;
      const w = tag.offsetWidth;
      const x = Math.min(Math.max(x0, L.left + w / 2), Math.max(L.left + w / 2, L.right - w / 2));
      tag.style.left = `${Math.round(x)}px`;
      const labels = [this.stormLabel, ...this.needs].filter((e): e is HTMLElement => !!e);
      const ok = () => {
        const r = tag.getBoundingClientRect();
        const pad = 2;
        return (
          !others.some((o) => boxesTouch(tag, o, 2)) &&
          !labels.some((e) => {
            const q = e.getBoundingClientRect();
            return (
              r.left < q.right + pad &&
              r.right > q.left - pad &&
              r.top < q.bottom + pad &&
              r.bottom > q.top - pad
            );
          }) &&
          designBox(tag).t >= 0
        );
      };
      for (const [y, low] of [
        [above, false],
        [below, true],
      ] as [number, boolean][]) {
        at(y, low);
        if (ok()) return true;
      }
      tag.remove();
      this.tags.splice(this.tags.indexOf(tag), 1);
      return false;
    }
    // Never up into the title band above the verdict either.
    const clear = () =>
      designBox(tag).t >= 90 &&
      !this.overlapsVerdict(tag) &&
      !others.some((o) => boxesTouch(tag, o, 2));
    if (clear()) return true;
    const step = tag.offsetHeight + 6;
    const tries: [number, boolean][] = [
      [below, true],
      [below + step, true],
      [above - step, false],
    ];
    // Off the top edge the cell sits under the verdict: hang just below the whole box.
    const vBottom =
      (Number.parseFloat(this.verdict.style.top) || 0) + this.verdict.offsetHeight + 8;
    if (vBottom - below <= this.view.layout.pitch) tries.push([vBottom, true]);
    for (const [y, low] of tries) {
      at(y, low);
      if (clear()) return true;
    }
    tag.remove();
    this.tags.splice(this.tags.indexOf(tag), 1);
    return false;
  }

  private clearTags(): void {
    for (const t of this.tags) t.remove();
    this.tags.length = 0;
  }

  /** "Needs N" and, once charge has landed, "got M" plus one entry per strike on multi-strike. */
  private setNeed(i: number, need: number, got: number | null): void {
    const el = this.needs[i]!;
    const phone = !!this.view.layout.phone;
    // Phones, before Strike (mobile-7-strike): a lamp, lit when the charge path reaches this
    // gauge (reach.ts). On or off only: it never shows an amount.
    const lamp =
      phone && got === null
        ? h('i', {
            class: 'lr-need-lamp',
            'aria-hidden': 'true',
            ...(this.view.machineLinked[i] ? { 'data-on': '' } : {}),
          })
        : null;
    this.lampEls[i] = lamp;
    el.toggleAttribute('data-lamp', !!lamp);
    const kids: (HTMLElement | string)[] = [
      h('span', { class: 'lr-need-row' }, lamp, 'Needs ', h('b', null, String(need))),
    ];
    // Multi-strike: each strike is read on its own; the strikes never add up at the machine.
    if (got === null && this.puzzle.pulses > 1)
      kids.push(h('span', { class: 'lr-need-note' }, 'in one strike'));
    if (got !== null) {
      kids.push(h('span', { class: 'lr-need-got' }, 'got ', h('b', null, String(got))));
      const rs = this.strikeReadings[i] ?? [];
      // Mid-strike, `got` is the strike still landing: show it as a live entry so "got 4"
      // never sits beside only "Strike 1: 2" and reads as strike 1's total.
      const live = this.pulse >= 0 && rs.length <= this.pulse;
      // Phones (mobile-7-strike): the card stays compact, "Needs 20 · got 0" (the strike now
      // landing, or the last); each strike's reading is told in words in the verdict.
      if (!phone && this.puzzle.pulses > 1 && (rs.length > 0 || live)) {
        const chip = (r: number, k: number, state: string) =>
          h('span', { 'data-state': state }, `Strike ${k + 1}: ${r}`);
        kids.push(
          h(
            'span',
            { class: 'lr-need-strikes' },
            ...rs.map((r, k) => chip(r, k, r === need ? 'exact' : r > need ? 'over' : 'under')),
            ...(live ? [chip(got, this.pulse, 'live')] : []),
          ),
        );
      }
    }
    el.replaceChildren(...kids);
    this.clearOfActions(el);
    const band = this.view.layout.phone;
    if (band && this.dom?.isConnected) this.placePhoneLabels(band);
  }

  /**
   * A need label beside a machine near the top edge can grow (bigger text, per-strike
   * readings) into the action row; drop it just below the row when it would touch.
   */
  private clearOfActions(el: HTMLElement): void {
    if (!this.dom.isConnected || !this.actionsEl || this.view.layout.phone) return;
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
      this.previewSim = null;
      this.updatePreviewChips();
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
    const linked = allReached(v.machineLinked);
    // Phones: each gauge's lamp follows the same reach (lit only while editing).
    this.lampEls.forEach((el, i) => {
      el?.toggleAttribute('data-on', edit && !!v.machineLinked[i]);
    });
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
    let placements = this.board.serialise();
    if (ghost) {
      const at = (q: Placement) => q.cell.x === ghost.cell.x && q.cell.y === ghost.cell.y;
      placements = [...placements.filter((q) => !at(q)), ghost];
      sim = simulate(this.puzzle, placements);
      hops = previewPath(this.puzzle, placements, sim).hops;
    }
    this.updateNoGo(placements, sim);
    // Straight-through glyphs face the way the bolt will really come in, with the held gem
    // where it would land. Bend, Gate and Split keep the turn they were set at.
    v.faceAlong(hops, true);
    v.preview = hops;
    v.previewTarget = PREVIEW_PATH ? 1 : 0;
    this.previewSim = sim;
    this.updatePreviewChips();
    this.renderCaps(capacitorBeats(this.puzzle, placements, sim), sim, false);
  }

  /** Chips for this strike's charge changes (and every hop into a machine). */
  private buildChips(res: SimResult): void {
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

  /** Phones: FUSE's fail quip, once the verdict has gone (dropped if the player strikes again). */
  private updateQuip(): void {
    if (!this.pendingQuip) return;
    if (this.mode === 'strike') this.pendingQuip = null;
    else if (this.mode === 'edit' && this.verdict.hidden) {
      void this.ctx.fuse.say(this.pendingQuip, { interrupt: true });
      this.pendingQuip = null;
    }
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

  /** The arrival card's pages on a phone: each new piece, and the gold ring on the first altar. */
  private introPages(): number {
    return this.introRows().length + (this.teachCell ? 1 : 0);
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

  /** The card's tag; a placed Bend, Gate or Split names the keys in use (mouse or keyboard). */
  private tagOf(how: InfoHow): string {
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
  }

  private infoRule(r: { gem: GemKind; how: InfoHow }): string {
    const rule = this.rules[r.gem] ?? '';
    // Restate what it does: a newcomer meeting it in the tray may not remember the codex.
    if (r.how === 'turns') return `${firstSentence(rule)} Yours to place now; turn it to fit.`;
    // A Capacitor's first sentence (it stores) is only half of it: the release is the point.
    // A Gate's first sentence ("two side inputs, one output") hides that both must arrive.
    const whole =
      r.how === 'tray' || r.how === 'turnsTray' || r.gem === 'capacitor' || r.gem === 'gate';
    return whole ? rule : firstSentence(rule);
  }

  /**
   * A phone chip's rule: the whole rule in one short line (the codex's `chip`). A fixed gem
   * says it is part of the machine first; on the arrival card a tray gem says it is the
   * player's to place, so the first lesson reads "this one's fixed and turns the charge; you
   * place Channels" (mobile-7-teach).
   */
  private chipRule(r: { gem: GemKind; how: InfoHow }, intro = false): string {
    const line = codexEntry(r.gem).chip;
    if (r.how === 'turns') return `${line} Turn it to fit.`;
    // The arrival card's gold line already shows which gem; it says just "Fixed." so the card
    // fits an SE. A tap on the gem says the whole line.
    if (r.how === 'fixed') return `${intro ? 'Fixed.' : FIXED_LINE} ${line}`;
    // Only where the same card also teaches a fixed gem (the contrast is the lesson); elsewhere
    // the lit tray tile says it, and an SE has no room for the extra line.
    if (intro && r.how === 'tray' && this.news.fixed.length > 0) return `${YOURS_LINE} ${line}`;
    return line;
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
    if (placed) this.lastPlaced = { x: placed.x, y: placed.y };
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
    this.picked = true;
    this.dom.toggleAttribute('data-picked', true);
    this.lastPlaced = null; // ↻ now turns the gem in hand
    this.handAt = this.time;
    this.teachTray.delete(kind);
    const turns = isRotational(kind) ? ` ${this.turnKeys} turns it.` : '';
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
  }

  /** Phones: the line from the arrival card to the fixed gem it teaches (mobile-7-teach). */
  private leader: SVGSVGElement | null = null;
  private leaderKey = '';

  /**
   * Phones: the arrival card points at what it teaches. A fixed gem's page draws a gold line
   * from the card to that gem on the board (which also pulses); a tray gem's page rings its
   * tray tile. Nothing while the card is down.
   */
  private updateTeachPointer(): void {
    const L = this.view.layout;
    if (!L.phone) return;
    const teachUp = this.introLeft > 0 && this.mode === 'edit' && !this.tip.hidden;
    const row =
      teachUp && this.tip.dataset.source === 'intro'
        ? this.introRows()[Math.min(this.introPageIdx, this.introPages() - 1)]
        : undefined;
    const trayGem = row && row.how !== 'fixed' ? row.gem : null;
    L.tray.forEach((t, i) => {
      this.slotEls[i]?.toggleAttribute('data-teach', t.gem === trayGem);
    });
    const svg = this.leader;
    if (!svg) return;
    const cells = row?.how === 'fixed' ? this.news.fixed.filter((f) => f.gem === row.gem) : [];
    if (cells.length === 0) {
      if (this.leaderKey) svg.replaceChildren();
      this.leaderKey = '';
      return;
    }
    // From the card's left edge, a third of the way down (by the gem's name), in design px.
    const box = this.dom.getBoundingClientRect();
    const r = this.tip.getBoundingClientRect();
    if (box.width <= 0 || r.width <= 0) return;
    const k = 1920 / box.width;
    const x0 = Math.round((r.left - box.left) * k);
    const y0 = Math.round((r.top - box.top + Math.min(r.height / 3, 24 / k)) * k);
    const ends = cells.map((f) => {
      const cx = L.left + L.margin + L.pitch * (f.cell.x + 0.5);
      const cy = L.top + L.margin + L.pitch * (f.cell.y + 0.5);
      return { cx, cy };
    });
    const ring = L.pitch * 0.52;
    const key = `${x0},${y0},${ring.toFixed(1)}:${ends.map((e) => `${e.cx},${e.cy}`).join(';')}`;
    if (key === this.leaderKey) return;
    this.leaderKey = key;
    const w = Math.round(2 * (L.phone.cssPx || 1) * 10) / 10;
    const el = (tag: string, a: Record<string, string | number>) => {
      const e = document.createElementNS(SVG_NS, tag);
      for (const [n, v] of Object.entries(a)) e.setAttribute(n, String(v));
      return e;
    };
    svg.replaceChildren(
      ...ends.flatMap(({ cx, cy }) => {
        // Stop at the gem's ring, so the line never covers the gem itself.
        const dx = x0 - cx;
        const dy = y0 - cy;
        const d = Math.hypot(dx, dy) || 1;
        const x1 = cx + (dx / d) * ring;
        const y1 = cy + (dy / d) * ring;
        return [
          el('line', {
            x1: x0,
            y1: y0,
            x2: x1,
            y2: y1,
            class: 'lr-leader-shade',
            'stroke-width': w * 2.2,
          }),
          el('line', {
            x1: x0,
            y1: y0,
            x2: x1,
            y2: y1,
            class: 'lr-leader-line',
            'stroke-width': w,
          }),
          el('circle', { cx, cy, r: ring, class: 'lr-leader-ring', 'stroke-width': w }),
        ];
      }),
    );
  }

  /** Phones: the fixed gem just tapped, whose card shows for a moment (mobile-7-teach). */
  private fixedTap: { cell: Cell; t: number } | null = null;

  /** " Joins north and east. R or Q turns it." for a Bend, Gate or Split; nothing for others. */
  private turnNote(gem: GemKind, rot: number): string {
    if (!isRotational(gem)) return '';
    const s = sidesText(gem, rot);
    return ` ${s.charAt(0).toUpperCase()}${s.slice(1)}. ${this.turnKeys} turns it.`;
  }

  /** What turns a gem with the input in use: the keys, or the on-screen ↻ for a finger. */
  private get turnKeys(): string {
    return this.touch && !this.keyboard ? 'The \u21bb button' : 'R or Q';
  }

  /** The player's last input was a finger (see engine platform/device-mode.ts). */
  private get touch(): boolean {
    return this.ctx.device.touch;
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
   * Fixed gems say they are part of the machine.
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
    // Multi-strike: a longer rest between strikes so each reads as its own beat.
    const pulseGap = this.puzzle.pulses > 1 ? 1.4 : 0.9;
    const tl = buildTimeline(result, { tickSeconds: TICK, pulseGap, verdictDelay: 0.45 });
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
    this.capKey = '';
    this.renderCaps(capacitorBeats(this.puzzle, placements, result), result, true);
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
    this.setStrikeRow(0);
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
    this.setStrikeRow(i);
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
    const root = o === 'exact' ? undefined : rootCell(this.fizzleList);
    this.verdictAvoid =
      root && root.x >= 0 && root.y >= 0 && root.x < L.cols && root.y < L.rows ? root : null;
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
      // Phones, multi-strike: the strike line and the Capacitor read-out in the lane already
      // tell each strike, so the verdict skips the story and keeps the next step.
      const story =
        L.phone && this.puzzle.pulses > 1
          ? ''
          : strikeStory(this.puzzle.pulses, res, this.capBeats);
      const hint = nextStep(
        o,
        this.fizzleList.map((f) => f.cause),
        this.touch && !this.keyboard,
      );
      // Phones: the root cause is in the verdict (the headline when nothing arrived, else a line
      // unless the strike's story already fills it); the red mark on the socket says where.
      const phone = !!L.phone;
      const why = phone ? rootFizzle('dead', this.fizzleList) : undefined;
      // Phones (mobile-7-strike): the cause in plain words ("The charge hit an empty socket"),
      // and the Try line under it, so cause and fix read together.
      const cause = why ? causeHeadline(why.cause) : '';
      // Phones, multi-strike: a plain headline, then each strike's reading in words ("Strike 1:
      // 0 · Strike 2: 8. Needs 20 in one strike."); the gauge's own card stays compact.
      const multi = phone && this.puzzle.pulses > 1;
      const head = (m: SimResult['machines'][number], oc: 'over' | 'under') =>
        multi ? failHead(m, oc) : failText(m, oc, this.puzzle.pulses);
      const each = (m: SimResult['machines'][number]) =>
        multi ? strikesLine(m, this.puzzle.pulses) : '';
      if (o === 'over') {
        const m = ms[over]!;
        const text = say(over, head(m, 'over'));
        this.showVerdict(text, 'over', story, hint, story ? '' : cause, each(m));
      } else if (o === 'under') {
        const m = ms[under] ?? ms[0]!;
        const text = say(under, head(m, 'under'));
        this.showVerdict(text, 'under', story, hint, story ? '' : cause, each(m));
      } else {
        // On a phone the cause is the headline ("The charge hit an empty socket").
        this.showVerdict(cause || 'No charge reached the machine', 'dead', '', hint);
      }
      this.setStrikeWord('fail');
      // Idle hints ("Bend already here") give way to the verdict and its fizzle tags.
      this.clearTags();
      this.tagTimer = 0;
      this.refusedKey = '';
      // Teaching: name where it went wrong (first few fizzles, last strike first).
      const shown = new Set<string>();
      const placed: HTMLElement[] = [];
      let count = 0;
      const pt = { x: 0, y: 0 };
      for (let i = this.fizzleList.length - 1; !phone && i >= 0 && count < 3; i--) {
        const f = this.fizzleList[i]!;
        const k = `${f.cell.x},${f.cell.y}`;
        if (shown.has(k)) continue;
        shown.add(k);
        anchorOf(L, f.cell, pt);
        const tag = this.addTag(pt.x, pt.y - L.pitch * 0.38, causeText(f.cause));
        if (!this.placeClear(tag, pt.y - L.pitch * 0.38, pt.y + L.pitch * 0.38, placed)) continue;
        placed.push(tag);
        count++;
      }
      const line = reactionLine(
        o,
        Math.min(3, this.ctx.tier()) as 1 | 2 | 3,
        rootFizzle(o, this.fizzleList),
        this.attempts - 1,
      );
      // Phones: one message at a time. The quip waits until the player acts on the verdict.
      if (line && this.view.layout.phone) {
        this.ctx.fuse.hush();
        this.pendingQuip = line;
      } else if (line) void this.ctx.fuse.say(line, { interrupt: true });
    }
    this.subtitle.textContent =
      o === 'exact' ? 'Restored' : `Attempt ${this.attempts} · change anything to try again`;
    this.updateCapLive();
    const head = this.verdict.firstChild?.textContent ?? '';
    const told = this.verdict.querySelector('.lr-verdict-story')?.textContent;
    const next = this.verdict.querySelector('.lr-verdict-hint')?.textContent;
    this.announce(
      this.resultText(told ? `${head}. ${told}` : head) +
        (next ? ` ${next}` : '') +
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
    this.verdictAvoid = null;
    this.subtitle.style.display = '';
    this.clearTags();
    this.clearChips();
    for (let m = 0; m < this.view.machineGlow.length; m++) this.view.machineGlow[m] = 0;
    this.view.deenergise();
    for (const b of this.view.bolts) b.fadeOut(0.35);
    for (const m of this.view.machines) m.reset();
    this.wakeTimer = -1;
    this.setStrikeRow(-1);
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
    this.updateCapLive();
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
    // The HUD settles into its altar spot after enter (the scene flag is set once the flow
    // has switched): measure what FUSE's card must avoid again on the first frames.
    if (this.settleFrames > 0 && --this.settleFrames % 2 === 0) this.avoidTray();
    this.view.reducedMotion = ctx.settings.reducedMotion;
    this.view.reduceFlashes = ctx.settings.reduceFlashes;
    if (this.relayoutPending && this.mode === 'edit' && !this.press) this.relayout();

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
    this.updateQuip();
    this.updateFuse();
    this.updateHint();
    this.updateTray();
    if (this.introLeft > 0 && this.mode === 'edit') {
      this.introLeft = Math.max(0, this.introLeft - dt);
    }
    if (this.fixedTap) {
      this.fixedTap.t -= dt;
      if (this.fixedTap.t <= 0 || this.hand || this.mode !== 'edit') this.fixedTap = null;
    }
    this.updateInfo();
    this.updateTeachPointer();
    this.updateTurnBadge();
    this.updateTurnButton();
    this.updateCrowd();
    this.updateLoupe();
    // The keyboard cursor, for tests and tools (the gold ring is drawn on the GPU).
    const ck = `${this.cursor.x},${this.cursor.y}`;
    if (ck !== this.cursorKey) {
      this.cursorKey = ck;
      this.dom.dataset.cursor = ck;
    }
    this.buildMarks();
    this.view.update(dt);
  }

  /** A socket a held gem may be put in (or swapped into): not carved stone, not a fixed gem. */
  private readonly aimable = (c: Cell) => !this.board.isBlocked(c) && !this.board.fixedAt(c);

  /**
   * Phones, small sockets: while a finger holds a gem down on the board, a round loupe beside
   * it shows the socket under the aim point, 2.5× bigger, with the target ringed. It fades
   * when the finger lifts. Mouse, keyboard and big boards never see it.
   */
  private updateLoupe(): void {
    const dev = this.ctx.device;
    const input = this.ctx.input;
    const p = input.pointer;
    const L = this.view.layout;
    const press = this.press;
    const lift = press?.dragging ? LIFT_CSS * dev.cssPx : 0;
    const want =
      dev.phone &&
      p.type !== 'mouse' &&
      !this.keyboard &&
      !!this.hand &&
      !!press &&
      input.held('select') &&
      (press.dragging || press.origin === 'aim') &&
      L.pitch / dev.cssPx < LOUPE_PITCH_CSS &&
      (!!this.hoverCell || !!cellAt(L, p.x, p.y - lift));
    if (!want) {
      if (this.loupe?.visible) {
        this.loupe.hide();
        delete this.dom.dataset.loupe;
      }
      return;
    }
    if (!this.loupe) {
      this.loupe = new Loupe(this.ctx.surface.canvas, {
        size: LOUPE_SIZE,
        zoom: LOUPE_MAG,
        className: 'lr-loupe',
      });
    }
    const r = this.ctx.ui.root.getBoundingClientRect();
    const k = r.width / 1920;
    const cx = (x: number) => r.left + x * k;
    const cy = (y: number) => r.top + y * k;
    const fx = cx(p.x);
    const ax = fx;
    const ay = cy(p.y - lift);
    // Above the aim point and off to the side of the finger, towards the middle of the screen.
    const win = this.dom.ownerDocument.defaultView ?? window;
    const half = LOUPE_SIZE / 2;
    const side = fx > win.innerWidth / 2 ? -1 : 1;
    const at = {
      x: Math.min(win.innerWidth - half - 4, Math.max(half + 4, fx + side * (half + 28))),
      y: Math.min(win.innerHeight - half - 4, Math.max(half + 4, ay - half * 0.6)),
    };
    let ring: { x: number; y: number; r: number } | null = null;
    if (this.hoverCell) {
      const c = { x: 0, y: 0 };
      cellCenter(L, this.hoverCell, c);
      ring = { x: cx(c.x), y: cy(c.y), r: L.pitch * k * 0.52 };
    }
    this.loupe.show({ focus: { x: ax, y: ay }, at, ring });
    this.dom.dataset.loupe = this.hoverCell ? `${this.hoverCell.x},${this.hoverCell.y}` : '';
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
    // A finger has no hover: between touches nothing is under it. While it drags a gem, it
    // aims a little above the fingertip so the gem and its socket stay in sight.
    const finger = p.type !== 'mouse';
    const lift = finger && this.press?.dragging ? LIFT_CSS * this.ctx.device.cssPx : 0;
    const live =
      p.inside && !this.keyboard && (!finger || input.held('select') || input.released('select'));
    // A finger holding a gem snaps to the nearest socket it could go in (layout snapCell).
    const aimAt = (x: number, y: number) =>
      finger && this.hand ? snapCell(L, x, y, this.aimable) : cellAt(L, x, y);
    this.hoverCell = live ? aimAt(p.x, p.y - lift) : null;
    this.hoverSlot = live && !lift ? traySlotAt(L, p.x, p.y) : -1;

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
        const cell = aimAt(p.x, p.y - lift);
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
    return legalSockets(this.puzzle, this.board.placements, kind, this.validCells);
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
    const cardOff = this.touch && !this.keyboard && this.time - this.handAt > TOUCH_CARD_SECS;
    if (slot < 0 && this.hand && !this.hand.from && !strike && !overPlaced && !cardOff) {
      slot = L.tray.findIndex((t) => t.gem === this.hand!.kind);
    }
    if (strike) this.infoPin = null;
    const pin = this.infoPin;
    const s = !pin && slot >= 0 ? L.tray[slot] : undefined;
    const focus =
      !strike && (!this.hand || overPlaced)
        ? (this.fixedTap?.cell ?? (this.keyboard ? this.cursor : this.hoverCell))
        : null;
    const fixedHere = focus ? this.board.fixedAt(focus) : undefined;
    const onBoard = focus ? (this.board.at(focus) ?? fixedHere) : undefined;
    // Phones: the arrival card outranks a gem's tip (moments.ts); only a long-press pin wins.
    // With a gem in hand the card names that gem or none (`pickInfo`, D-040 addendum 5).
    const teachUp = this.introLeft > 0 && !strike;
    const introAt = Math.min(this.introPageIdx, this.introPages() - 1);
    const news = this.introRows();
    const source = pickInfo({
      pin: !!pin,
      phone: !!L.phone,
      teachUp,
      teachGems: L.phone ? (news[introAt] ? [news[introAt].gem] : []) : news.map((r) => r.gem),
      held: this.hand?.kind ?? null,
      slot: s?.gem ?? null,
      board: focus && onBoard ? onBoard.gem : null,
    });
    if (source === 'pin' && pin) {
      rows = [pin];
      key = `p${pin.gem}${pin.how}`;
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
    if (rows.length === 0) {
      this.tip.hidden = true;
      return;
    }
    const intro = key.startsWith('intro');
    this.tip.dataset.source = intro ? 'intro' : key[0] === 't' ? 'tray' : 'board';
    // Phones: a chip, each row its gem's name and first whole sentence (never cut mid-rule);
    // a long-press pins the full card.
    const chip = !!L.phone && !key.startsWith('p');
    const items = [
      ...rows.map((r) => {
        const tag = this.tagOf(r.how);
        return h(
          'div',
          { class: 'lr-info-row', 'data-how': r.how },
          h('b', null, GEM_NAME[r.gem]),
          tag ? h('span', { class: 'lr-info-tag', 'data-how': r.how }, tag) : null,
          ' ',
          h('span', { class: 'lr-info-rule' }, chip ? this.chipRule(r, intro) : this.infoRule(r)),
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
        'New here',
        n > 1 ? h('span', { class: 'lr-info-of' }, ` ${i + 1} of ${n}`) : null,
      );
      this.tip.replaceChildren(h('div', { class: 'lr-info-foot' }, page, next), items[i]!);
    } else this.tip.replaceChildren(...items);
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
  }

  /** Over its slot (or the tray's middle), never over FUSE (left) or the caption (right). */
  private placeTip(L: AltarLayout): void {
    if (L.phone) {
      // In the column lane (CSS lays it out).
      this.tipRight = this.captionLeft(L);
      this.tip.style.left = '';
      this.tip.style.top = '';
      this.tip.style.maxWidth = '';
      return;
    }
    const right = this.captionLeft(L);
    this.tipRight = right;
    // Narrower than the gap if it must be (a phone's caption is wide); wraps to more lines.
    const room = right - FUSE_LANE.x;
    this.tip.style.maxWidth = '';
    if (this.tip.offsetWidth > room) this.tip.style.maxWidth = `${Math.max(320, room)}px`;
    const slotX = this.tipSlotX;
    const x = trayTipX(slotX ?? TRAY_CENTER_X, this.tip.offsetWidth, right);
    this.tip.style.left = `${x}px`;
    // The notch points at the slot; the card for a board gem or the arrival has none.
    if (slotX !== null) this.tip.style.setProperty('--lr-tip-dx', `${slotX - x}px`);
  }

  /**
   * A held Bend, Gate or Split shows it turns: a turn arrow by the gem, with the keys, until the
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
   * Phones: FUSE's bubble grows up from above Strike and the lane grows down from the tray;
   * when the two would meet, the lane (the player's own chip, verdict or read-out) wins and
   * the bubble steps out until there is room again.
   */
  private updateCrowd(): void {
    if (!this.lane) return;
    // A Gives/Needs card grew or shrank (a reading came in, the text size changed): place the
    // cards again so none runs into another or a gauge.
    const band = this.view.layout.phone;
    if (band) {
      const els = [this.stormLabel, ...this.needs];
      const key = els.map((el) => (el ? `${el.offsetWidth}x${el.offsetHeight}` : '')).join();
      if (key !== this.labelKey) {
        this.labelKey = key;
        this.placePhoneLabels(band);
      }
    }
    if (band) this.arrangeColumn(band);
  }

  /**
   * Phones: one owner of the right column at a time (mobile-6-moments, moments.ts `arbitrate`).
   * The lane grows down from under the tray; FUSE's bubble sits over his head, 10 px clear of
   * Strike. Between them the verdict, the teach card, a gem's tip, the how-to line and FUSE's
   * bubble get room in that order: a tip that does not fit shrinks to its name line, anything
   * else waits (FUSE's line is frozen, not lost). The lane also steps right of any Gives/Needs
   * card that reaches into the column, so no card ever touches a board label.
   */
  private arrangeColumn(band: PhoneBand): void {
    const lane = this.lane;
    if (!lane || !this.dom.isConnected) return;
    const ui = this.ctx.ui;
    const css = band.cssPx; // design px per CSS px
    const gap = 4;
    // 1. Clear of board labels: the lane starts 8 px right of any card that reaches it.
    const lr = lane.getBoundingClientRect();
    const baseL = lr.left - this.laneShift / css;
    const floorY = this.strikeBtn.getBoundingClientRect().top;
    let left = baseL;
    for (const el of [this.stormLabel, ...this.needs]) {
      if (!el || el.hidden) continue;
      const q = el.getBoundingClientRect();
      if (q.width === 0 || q.bottom < lr.top - gap || q.top > floorY) continue;
      // Its words, which may run past the card's own box ("in one strike").
      let right = q.right;
      for (const c of el.querySelectorAll('*'))
        right = Math.max(right, c.getBoundingClientRect().right);
      if (right + 8 > left && q.left < baseL + 40) left = right + 8;
    }
    const shift = Math.max(0, Math.round((left - baseL) * css));
    if (shift !== this.laneShift) {
      this.laneShift = shift;
      lane.style.setProperty('--lr-lane-l', `${band.colL + shift}px`);
      lane.style.setProperty('--lr-lane-w', `${Math.round(band.colR - band.colL - shift)}px`);
    }
    // 2. FUSE's bubble: over his head, its bottom at least 10 px above Strike, and never left
    // of the lane (so it clears the labels too).
    const f = this.view.fuse;
    const strikeTop = (this.strikeBtn.getBoundingClientRect().top - this.overlayTop()) * css;
    const bubB = Math.min(f.y - 2.3 * f.scale - 6 * css, band.bubbleB, strikeTop - 10 * css);
    const capL = Math.max(band.bubbleL, band.colL + shift);
    const capKey = `${Math.round(bubB)},${capL}`;
    if (capKey !== this.capKey2) {
      this.capKey2 = capKey;
      const st = ui.root.style;
      st.setProperty('--lr-cap-b', `${Math.round(1080 - bubB)}px`);
      st.setProperty('--lr-cap-l', `${capL}px`);
      st.setProperty('--lr-cap-w', `${1920 - capL}px`);
      st.setProperty('--lr-cap-tail', `${Math.round(Math.max(22 * css, f.x - capL))}px`);
    }
    // 3. Who gets the room between the lane's top and the bubble's bottom.
    const room = this.overlayTop() + bubB / css - lr.top;
    const asks: VoiceAsk[] = [];
    const els = new Map<string, HTMLElement>();
    const ask = (id: string, el: HTMLElement, voice: VoiceAsk['voice'], shrinks: boolean) => {
      if (el.hidden || getComputedStyle(el).display === 'none') return;
      els.set(id, el);
      // Measured whole, even while it waits or is shrunk (briefly laid out whole to measure).
      const was = el.dataset.arb;
      if (was) el.removeAttribute('data-arb');
      const full = el.getBoundingClientRect().height;
      const cs = getComputedStyle(el);
      const first = el.firstElementChild ? getComputedStyle(el.firstElementChild) : cs;
      const lh = Number.parseFloat(first.lineHeight) || Number.parseFloat(first.fontSize) * 1.3;
      const edge = (k: 'Top' | 'Bottom') =>
        Number.parseFloat(cs[`padding${k}`]) + Number.parseFloat(cs[`border${k}Width`]);
      const line = lh + edge('Top') + edge('Bottom');
      if (was) el.dataset.arb = was;
      asks.push(shrinks && line < full ? { id, voice, full, line } : { id, voice, full });
    };
    const verdictUp = !this.verdict.hidden;
    if (verdictUp) ask('verdict', this.verdict, 'verdict', false);
    // mobile-7-strike: under a verdict the Capacitor read-out waits for room (the verdict's
    // strike line already gives each strike's reading).
    this.capEls.forEach((el, i) => {
      if (el.parentElement === lane) ask(`cap${i}`, el, verdictUp ? 'hint' : 'verdict', false);
    });
    const teach = this.tip.dataset.source === 'intro';
    if (teach && !this.tip.hidden) {
      // The teach card's button sits under the rule when there is room; where there is not (an
      // iPhone SE under a two-row tray) it stands top-right and the rule wraps round it.
      this.tip.removeAttribute('data-compact');
      const below = this.verdict.hidden ? 0 : this.verdict.getBoundingClientRect().height + gap;
      if (this.tip.getBoundingClientRect().height + below > room)
        this.tip.setAttribute('data-compact', '');
    }
    if (!this.tip.hidden) ask('tip', this.tip, teach ? 'teach' : 'tip', !teach);
    ask('hint', this.hint, 'hint', false);
    const cap = ui.root.querySelector<HTMLElement>('.tc-caption');
    const talking = !!cap && !cap.hidden && cap.textContent !== '';
    if (talking && cap) {
      const h0 = cap.getBoundingClientRect().height;
      if (h0 > 0) this.fuseH = h0;
      // The bubble keeps its own 8 px from the lane (the gap adds 4).
      asks.push({ id: 'fuse', voice: 'fuse', full: this.fuseH + gap });
    }
    const grants = arbitrate(asks, room, gap);
    for (const [id, el] of els) {
      const g: Grant = grants.get(id) ?? 'full';
      if (g === 'full') el.removeAttribute('data-arb');
      else if (el.dataset.arb !== g) el.dataset.arb = g;
    }
    this.holdFuse(talking && grants.get('fuse') === 'wait');
    // mobile-7-strike: a verdict too tall for the column (an SE after a two-strike fail) owns
    // the corner; Strike steps out until the verdict clears (any tap), never under it.
    let yieldStrike = false;
    if (verdictUp) {
      const v = this.verdict.getBoundingClientRect();
      const b = this.strikeBtn.getBoundingClientRect();
      yieldStrike = v.bottom > b.top && v.right > b.left && v.left < b.right && v.height > 0;
    }
    this.strikeBtn.toggleAttribute('data-yield', yieldStrike);
  }

  /** The overlay's top edge in CSS px (design y 0). */
  private overlayTop(): number {
    return this.ctx.ui.root.getBoundingClientRect().top;
  }

  /** Freeze FUSE's caption while the column has no room for it; release it when it does. */
  private holdFuse(on: boolean): void {
    if (on === this.fuseHeld) return;
    this.fuseHeld = on;
    const ui = this.ctx.ui;
    // A modal holds the caption on its own account: leave it held until the modal closes.
    if (!on && ui.stack.hasModal) return;
    ui.caption.suspend(on);
  }

  /**
   * Touch: the ↻ Turn button (docked right of the tray) turns the Bend, Gate or Split last
   * placed or selected (a long touch) on the board, else the one in hand; a ↻ mark on that gem
   * shows which. Tapping a gem still only picks it up; turning is always this button (D-029).
   * Hidden without touch (CSS `lr-touch-only`).
   */
  private updateTurnButton(): void {
    const L = this.view.layout;
    let target: Cell | 'hand' | null = null;
    const pt = { x: 0, y: 0 };
    const held = this.view.held;
    if (this.mode !== 'strike' && this.touch && !this.keyboard && !this.press) {
      const pl = this.lastPlaced ? this.board.at(this.lastPlaced) : undefined;
      if (this.lastPlaced && pl && isRotational(pl.gem)) {
        target = this.lastPlaced;
        cellCenter(L, target, pt);
      } else if (this.hand && !this.hand.from && held && isRotational(this.hand.kind)) {
        target = 'hand';
        pt.x = held.x;
        pt.y = held.y;
      }
    }
    this.turnTarget = target;
    const show = target !== null;
    const phone = !!L.phone;
    if (this.turnShown !== show) {
      this.turnShown = show;
      // Phones (mobile-5-board): one rotate control. Turn stays on the left rail, dim until a
      // Bend, Gate or Split is in hand or just placed, then lit; no ↻ chip on the gem.
      this.turnBtn.hidden = !show && !phone;
      this.turnBtn.disabled = phone && !show;
      this.turnBtn.toggleAttribute('data-active', show);
      this.turnMark.hidden = !show || phone;
      if (phone) this.updateHint();
      this.avoidTray();
    }
    if (!show || phone) return;
    const r = L.gemSize * 0.5;
    this.turnMark.style.left = `${Math.round(pt.x + r)}px`;
    this.turnMark.style.top = `${Math.round(pt.y - r)}px`;
  }

  private turnTapped(): void {
    const t = this.turnTarget;
    if (t === 'hand') this.turnAt(null, 1);
    else if (t) this.turnAt(t, 1);
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
      this.dom.insertBefore(el, this.lane ?? this.tip);
      this.previewChipEls.push(el);
    }
  }

  /**
   * Where the route preview stops at a Bend, Gate or Split facing the wrong way, a small ✕ on
   * the side the bolt meets it, so a stopped preview says why (same cause as the strike's
   * `Faces the wrong way`).
   */
  private updateNoGo(placements: readonly Placement[], sim: SimResult | null): void {
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
        style: { left: `${a.x + (b.x - a.x) * t}px`, top: `${a.y + (b.y - a.y) * t}px` },
      });
      this.dom.insertBefore(el, this.lane ?? this.tip);
      this.noGoEls.push(el);
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
      pt.x = p.x;
      pt.y = p.y;
      const finger = p.type !== 'mouse';
      if (finger && this.press?.dragging) pt.y -= LIFT_CSS * this.ctx.device.cssPx;
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
    // No idle hints over a verdict: the fizzle tags and the Try line have the floor.
    if (!cell || !reason || this.tagTimer > 0 || !this.verdict.hidden) return;
    const pt = { x: 0, y: 0 };
    cellCenter(this.view.layout, cell, pt);
    this.addTag(pt.x, pt.y - this.view.layout.pitch * 0.42, DENY_REASON[reason] ?? reason, 'info');
  }

  private buildMarks(): void {
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
  }

  render(frame: Frame): void {
    this.view.render(frame);
  }
}

/** The Holding pill's gap to Menu, CSS px. */
const MENU_GAP_CSS = 8;

/**
 * The Holding pill never touches Menu: slide it left until it is `MENU_GAP_CSS` clear.
 * `scale` is CSS px per design px.
 */
function keepClearOfMenu(pill: HTMLElement, menu: Element | null, scale: number): void {
  pill.style.marginLeft = '';
  if (!menu || pill.hidden) return;
  const m = menu.getBoundingClientRect();
  const p = pill.getBoundingClientRect();
  if (m.width < 1 || p.width < 1) return;
  if (p.bottom <= m.top || p.top >= m.bottom) return;
  const over = p.right + MENU_GAP_CSS - m.left;
  if (over > 0) pill.style.marginLeft = `${-Math.ceil(over / scale)}px`;
}

type HintMode = 'mouse' | 'keys' | 'strike' | 'touch' | 'touchHeld' | 'touchStrike' | 'off';

/** The key-hint line for each mode. Short enough to sit under the tray at 150% text. */
function hintLine(mode: HintMode, turns = true): (Node | string)[] {
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
    case 'touch':
      return turns
        ? [
            b('Tap'),
            ' a gem, then a socket · ',
            h('span', { class: 'lr-nowrap' }, b('\u21bb'), ' turns it'),
          ]
        : [b('Tap'), ' a gem, then a socket'];
    case 'touchHeld':
      return turns
        ? [
            'Now ',
            b('tap'),
            ' a socket · ',
            h('span', { class: 'lr-nowrap' }, b('\u21bb Turn'), ' spins it'),
          ]
        : ['Now ', b('tap'), ' a socket'];
    case 'off':
      return [];
    case 'touchStrike':
      return [b('Tap'), ' to skip'];
  }
}

/**
 * An element's box in design pixels from its inline left/top and its size, so the answer holds
 * while the pop-in animations are still moving it. Verdicts hang from their top centre; tags sit
 * above their anchor (arrow down, 7px) or, with data-below, under it (arrow up).
 */
function designBox(el: HTMLElement): { l: number; r: number; t: number; b: number } {
  const x = Number.parseFloat(el.style.left) || 0;
  const y = Number.parseFloat(el.style.top) || 0;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const tag = el.classList.contains('lr-altar-tag');
  const t = !tag ? y : el.hasAttribute('data-below') ? y : y - h - 7;
  return { l: x - w / 2, r: x + w / 2, t, b: t + h + (tag ? 7 : 0) };
}

/** Whether two boxes overlap, with `pad` design pixels of breathing room. */
function boxesTouch(a: HTMLElement, b: HTMLElement, pad: number): boolean {
  const r = designBox(a);
  const q = designBox(b);
  return r.l < q.r + pad && r.r > q.l - pad && r.t < q.b + pad && r.b > q.t - pad;
}

/** "twice", "3 times": how many strikes one tap of Strike fires (mobile-5-board). */
function timesWord(n: number): string {
  return n === 2 ? 'twice' : `${n} times`;
}
