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
import type { Gestures } from '@thunderclap/engine/input';
import type { Frame } from '@thunderclap/engine/render';
import type { GemPortraits } from '../../art/gem-portraits';
import { POST_PRESETS } from '../../art/materials/post-presets';
import type { BoltSegment } from '../../art/props/bolt';
import type { BoltHandle, StormCellHandle } from '../../audio';
import { machineLine, type reactionLine } from '../../content/lines';
import { puzzleFor } from '../../content/puzzles';
import type { GameCtx, GameScene } from '../../game/ctx';
import type { BoltOutcome } from '../../game/flow';
import { markTaught, progressOf, taughtGems } from '../../game/save';
import type { Placement, PuzzleDef, SimResult } from '../../rules';
import type { Cell, GemKind, MachineId } from '../../rules/types';
import { codexPages } from '../../ui/codex-data';
import { altarFrame } from './altar-chrome';
import { circuitMethods } from './altar-circuit';
import { columnMethods } from './altar-column';
import {
  type Hand,
  INTRO_SECS,
  type InfoHow,
  type Mode,
  type Press,
  TEACH_MACHINE,
} from './altar-defs';
import { domMethods } from './altar-dom';
import { editMethods } from './altar-edit';
import { handMethods } from './altar-hand';
import { infoMethods } from './altar-info';
import { placeMethods } from './altar-place';
import { readoutMethods } from './altar-readout';
import { runMethods } from './altar-run';
import { ensureAltarStyles } from './altar-styles';
import { AltarView } from './altar-view';
import { BoardState } from './board';
import { type CapBeat, type ChargeChip, guideHops, type PathHop } from './circuit-model';
import { emitPuzzleEvent } from './events';
import { setHintTarget } from './hints';
import { type HintSlot, hintRetired } from './moments';
import type { Fizzle, StrikeTimeline } from './strike';
import { arrivalNudges, firstMultiStrike, type NewGems, newGems, turnTeaches } from './teach';

type PlaceMethods = typeof placeMethods;
type ColumnMethods = typeof columnMethods;
type DomMethods = typeof domMethods;
type ReadoutMethods = typeof readoutMethods;
type CircuitMethods = typeof circuitMethods;
type InfoMethods = typeof infoMethods;
type HandMethods = typeof handMethods;
type RunMethods = typeof runMethods;
type EditMethods = typeof editMethods;

// The scene's methods live in modules by concern (see each file); they share the class's
// state, so the class and this interface merge and the modules go on the prototype.
export interface AltarScene
  extends PlaceMethods,
    ColumnMethods,
    DomMethods,
    ReadoutMethods,
    CircuitMethods,
    InfoMethods,
    HandMethods,
    RunMethods,
    EditMethods {}

export class AltarScene implements GameScene {
  readonly name = 'altar';
  ctx!: GameCtx;
  puzzle!: PuzzleDef;
  board!: BoardState;
  view!: AltarView;
  mode: Mode = 'edit';
  hand: Hand | null = null;
  press: Press | null = null;
  cursor: Cell = { x: 0, y: 0 };
  /** Socket just filled with Enter; the next gem taken by key moves the cursor on from it. */
  keyPlaced: Cell | null = null;
  cursorKey = '';
  keyboard = false;
  lastPointer = { x: -1, y: -1 };
  hoverCell: Cell | null = null;
  hoverSlot = -1;
  deny: { cell: Cell; t: number } | null = null;
  postSnapshot: unknown = null;
  hum: StormCellHandle | null = null;
  boltSound: BoltHandle | null = null;
  bloomBase = 0.85;
  bloomBoost = 0;

  // Strike playback
  result: SimResult | null = null;
  timeline: StrikeTimeline | null = null;
  fizzleList: Fizzle[] = [];
  /** Trace hops into an Amplify that passes the bolt on undoubled (held-gem, `amp-idle.ts`). */
  idleAmps: Set<number> = new Set();
  /** The root red mark of a failed strike: the verdict moves so it never covers this socket. */
  verdictAvoid: Cell | null = null;
  pulseSegs: BoltSegment[][] = [];
  st = 0;
  pulse = -1;
  arrival = 0;
  rate = 1;
  skipping = false;
  verdictShown = false;
  wakeTimer = -1;
  readings: number[] = [];
  pulseEnded = -1;
  strikeRevision = -1;
  resultAge = 0;

  // Session stats (dev hook)
  openedAt = 0;
  time = 0;
  attempts = 0;
  resets = 0;
  outcomes: Record<BoltOutcome, number> = { dead: 0, under: 0, exact: 0, over: 0 };
  solved = false;
  /** Socket the hint mechanism is pointing at, if any. */
  hintCell: Cell | null = null;

  // Teaching (first altar) + affordances
  /** First socket to use on the first altar; pulses until something is placed. */
  teachCell: Cell | null = null;
  idle = 0;
  idleRev = -1;
  nudged = false;
  /** Empty sockets the held gem may go in; cached per (board revision, gem). */
  validCells: Cell[] = [];
  validRev = -1;
  validKind: GemKind | null = null;
  rules = {} as Record<GemKind, string>;
  /** The gem info card: off the board, over the tray band (see `updateInfo`). */
  tip!: HTMLElement;
  tipKey = '';
  /** The tray slot the info card points at (null: none), and the caption edge it was fit to. */
  tipSlotX: number | null = null;
  tipRight = 0;
  /** Iron brackets on fixed (and hint-locked) gems, rebuilt when the board changes. */
  /** Turn arrow on a held Bend, Gate or Split, until the player has turned one here. */
  turnBadge!: HTMLElement;
  turned = false;
  /** Touch: the on-screen turn control, by the held gem or the gem last placed or selected. */
  turnBtn!: HTMLButtonElement;
  /** Touch: a ↻ mark on the gem the button turns (not a target itself: taps pass through). */
  turnMark!: HTMLElement;
  /** Whether Turn has a gem to turn (null: not yet decided since the DOM was built). */
  turnShown: boolean | null = null;
  turnTarget: Cell | 'hand' | null = null;
  lastPlaced: Cell | null = null;
  /** Scene time the gem in hand was taken from the tray. */
  handAt = 0;
  /** Frames left in which avoidTray re-measures after enter. */
  settleFrames = 4;
  /** Phones: the magnifier over the board while a finger aims a gem (made on first use). */
  /** Touch aim, lift, snap and the loupe (engine Gestures `magnify`), linked while the altar is up. */
  gestures: Gestures | null = null;
  /** Board gem the keyboard cursor last announced. */
  focusKey = '';

  // DOM
  dom!: HTMLElement;
  subtitle!: HTMLElement;
  /** Phones (mobile-6-board): "Holding Bend" over the tray, in the title's place, while held. */
  holdingEl!: HTMLElement;
  verdict!: HTMLElement;
  /** Screen-reader announcements (sr-only, always in the DOM so changes are read). */
  announcer!: HTMLElement;
  announceTimer: ReturnType<typeof setTimeout> | null = null;
  strikeBtn!: HTMLButtonElement;
  undoBtn!: HTMLButtonElement;
  clearBtn!: HTMLButtonElement;
  counts: HTMLElement[] = [];
  /** The key-hint line under the tray, and which version of it is showing. */
  hint!: HTMLElement;
  titleEl!: HTMLElement;
  actionsEl!: HTMLElement;
  backBtn!: HTMLButtonElement;
  /** Phones: takes the rail buttons out of their regions and the altar's tracks off the chrome. */
  offRails: (() => void) | null = null;
  /** The hint's mode, plus `+` when it mentions ↻ (phones say it only while it applies). */
  hintMode = '';
  needs: HTMLElement[] = [];
  /** First altar only: "Gives N" at the storm, the twin of the machine's "Needs N". */
  stormLabel: HTMLElement | null = null;
  tags: HTMLElement[] = [];

  // Circuit read-out (altar-clarity)
  circuitRev = -1;
  circuitMode: Mode | null = null;
  liveMask: Uint8Array = new Uint8Array(0);
  openEnds: Cell[] = [];
  chips: ChargeChip[] = [];
  chipEls: HTMLElement[] = [];
  /** Per machine, per strike: what arrived. */
  strikeReadings: number[][] = [];

  // First-appearance teaching
  news: NewGems = { fixed: [], tray: [], turns: [], remind: [] };
  /** New fixed gems still pulsing (until hovered, turned, or the first strike). */
  teachFixed: { gem: GemKind; cell: Cell }[] = [];
  /** Stubs on the sides each new fixed gem joins (see `guideHops`). */
  guide: PathHop[] = [];
  /** New tray kinds not yet picked up. */
  teachTray = new Set<GemKind>();
  spoken = new Set<GemKind>();
  /** New gems FUSE has yet to name, said one at a time when he is free (see `updateNudges`). */
  pendingNudges: GemKind[] = [];
  /** Seconds left on the arrival card for this altar's new gems (0 = gone). */
  introLeft = 0;
  /** teach-4: the first altar that strikes more than once (its card explains the count). */
  firstMulti = false;
  /** teach-4: real gem pictures for the arrival card's in→out figures, made when first drawn. */
  pictures: GemPortraits | null = null;
  /** teach-4: who is told what the gauge dots mean (`lampLine`), and whether they have been. */
  lampTeach = { reach: false };
  /** teach-4: where Turn was just taught, why it stays dim for a Channel (`straightLine`). */
  straightTeach = false;
  /** Phones: the arrival card's page, one new piece at a time; the player turns it (Next ›). */
  introPageIdx = 0;
  /** Phones: lines other workstreams put in the how-to slot (`setHintLine`, moments.ts). */
  hintLines: Partial<Record<HintSlot, string | null>> = {};
  /** Phones: a card owns the column, so FUSE's caption is frozen (released when none does). */
  fuseHeld = false;
  /** Phones: the how-to line has retired (moments.ts), and FUSE's fail quip waits its turn. */
  hintRetired = false;
  pendingQuip: ReturnType<typeof reactionLine> | null = null;
  /** Phones: a long press opened this gem's full card; the next tap closes it. */
  infoPin: { gem: GemKind; how: InfoHow } | null = null;
  /** Phones: the frame the layout was built for, and a rebuild waiting for edit mode. */
  frame = '';
  relayoutPending = false;
  /** The journal desk is over the altar: its view is torn down until `resume`. */
  paused = false;
  offDevice: (() => void) | null = null;
  // altar-truth: no charge numbers on the route before Strike, on any altar (one rule, D-040
  // addendum 5). The plan's numbers live on the Capacitor read-out; chips come with Strike.
  /** Turning kinds this altar teaches to turn (show the turn arrow when held). */
  turnTeach = new Set<GemKind>();
  /** The route preview with the held gem tried where it would land (cell, rot, kind). */
  ghostKey = '';
  /** Where the preview's first strike meets a gem from a side it doesn't take: a small ✕. */
  noGoEls: HTMLElement[] = [];
  noGoKey = '';

  // Multi-strike read-outs (capacitor-clarity)
  /** "2 strikes" row in the storm's Gives card, and pips on Strike: one per strike. */
  strikeRow: HTMLElement | null = null;
  strikePips: HTMLElement[] = [];
  /** One read-out per Capacitor the bolt reaches: what it keeps and lets out, per strike. */
  capEls: HTMLElement[] = [];
  /** Phones: the cards (gem and teach card, verdict, how-to line, read-outs), in `cardLane`. */
  lane: HTMLElement | null = null;
  /**
   * dense-board-4: on a slim column the held gem's rule card folds behind this tab; a tap opens
   * it (pinned), the next tap or setting the gem down closes it.
   */
  ruleTab: HTMLButtonElement | null = null;
  /** dense-board-4: the pinned card came from the Rule tab (shown as the chip). */
  ruleOpen = false;
  /**
   * teach-overlay: phones open the arrival card (and a pinned rule card) as a panel over the
   * column. After a few seconds without a touch on it, or a tap on the board or tray, the
   * arrival card folds to `cardPill` (not dismissed: "Got it" does that) and a pinned card closes.
   */
  cardMin = false;
  /** Scene time of the last touch on the open panel (or its opening). */
  cardAt = 0;
  /** What the panel showed when `cardAt` was last reset (a new card restarts the clock). */
  cardKey = '';
  /** The folded arrival card: its gem's picture and name; a tap opens it again. */
  cardPill: HTMLButtonElement | null = null;
  cardPillKey = '';
  /** Phones: the card lane is short (SHORT_LANE_PX): the held gem's card folds behind the tab. */
  shortLane = false;
  /** Phones: the title and the tray's slots and counts, in the chrome's `top` region. */
  head: HTMLElement | null = null;
  /** Where the head was last lined up with the tray (`placeHead`). */
  headKey = '';
  /** Gives/Needs card sizes when last placed (phone). */
  labelKey = '';
  /** Phones: Strike's "twice" / "1 of 2" for multi-strike altars (the pips are for big screens). */
  strikeCount: HTMLElement | null = null;
  /**
   * Strike's word (mobile-7-strike). Phones say what a tap does on one line: "Strike",
   * "Strike ×2" on a multi-strike altar, the same after a miss (teach-7: no "Try again").
   */
  strikeWord: HTMLElement | null = null;
  /** Phones: one reach lamp per gauge, before Strike (see reach.ts). */
  lampEls: (HTMLElement | null)[] = [];
  /** Phones: one marker per tray slot (a used-up slash; the first visit's pulse). */
  slotEls: HTMLElement[] = [];
  /** A gem has been taken from the tray at this visit (ends the first visit's tray pulse). */
  picked = false;
  capKey = '';
  /** The strike's Capacitor beats (live read-out), with their line elements. */
  capBeats: CapBeat[] = [];
  capLines: HTMLElement[] = [];

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
      this.news = newGems(this.puzzle, solved, taughtGems(save));
      this.teachFixed = this.news.fixed.map((f) => ({ gem: f.gem, cell: f.cell }));
      this.teachTray = new Set(this.news.tray);
      this.turnTeach = turnTeaches(this.news);
      this.firstMulti = firstMultiStrike(this.puzzle, solved);
      // teach-5: the dot's legend shows the first time a dot lights, once per game.
      this.lampTeach = { reach: this.ctx.flow.dotDue() };
      // Only where Turn is first taught (the Bend in the tray): the lane is roomy there.
      this.straightTeach = this.turnTeach.has('bend');
      this.guide = guideHops(
        this.puzzle,
        this.teachFixed.map((f) => f.cell),
      );
    }

    ensureAltarStyles(ctx.ui.root.ownerDocument);
    this.linkGestures();
    this.buildDom();
    this.refreshHud();
    this.frame = this.frameKey();
    this.offDevice = ctx.device.onChange(() => {
      this.relayoutPending = this.frameKey() !== this.frame;
    });
    // On the first altar the card (with the gold-ring line) stays until the first placement.
    // Phones: until the player taps Got it (or places a gem), never on a timer.
    this.introLeft =
      this.introPages() === 0
        ? 0
        : this.teachCell || this.view.layout.phone
          ? Number.POSITIVE_INFINITY
          : INTRO_SECS;
    this.introPageIdx = 0;
    // teach-8: the new gems' cards are up; they are taught here, whatever order the hall is
    // played in (an altar met later does not teach them again; this one does until solved).
    const taught = [...this.news.fixed.map((f) => f.gem), ...this.news.tray];
    if (this.introLeft > 0 && taught.length > 0)
      ctx.save.update((d) => {
        markTaught(d, taught, this.machine);
      });
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
    if (!this.paused) this.teardownView();
    this.pictures?.destroy();
    this.pictures = null;
    this.ctx.input.setGestures(null);
    this.gestures?.destroy();
    this.gestures = null;
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
  teardownView(): void {
    this.offRails?.();
    this.offRails = null;
    this.view.dispose();
    this.dom.remove();
    this.chipEls.length = 0;
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
    this.lane?.remove();
    this.lane = null;
    this.head?.remove();
    this.head = null;
    this.headKey = '';
    this.slotEls.length = 0;
    this.leader = null;
    this.leaderKey = '';
    this.fixedTap = null;
  }

  /** The altar's look; phones drop the fog and vignette so the whole grid reads evenly. */
  applyPost(): void {
    const post = this.ctx.post;
    post.set(POST_PRESETS.altar);
    if (this.view.layout.phone) post.set({ fog: { enabled: false }, vignette: { enabled: false } });
  }

  /** The phone frame the layout was built for ('' off phones). */
  frameKey(): string {
    const d = this.ctx.device;
    const f = altarFrame(d, this.ctx.chrome);
    return f ? `${f.padL},${f.padR},${f.cssPx.toFixed(3)},${f.top},${f.bottom}` : '';
  }

  /**
   * A phone turned, or the window crossed the phone size: rebuild the board's layout and its
   * labels for the new frame. Waits for the edit mode (never mid-strike or on a verdict).
   */
  relayout(): void {
    this.relayoutPending = false;
    this.teardownView();
    this.rebuildView();
  }

  /** A fresh view and labels over the board as it stands (relayout, and back from the desk). */
  rebuildView(): void {
    this.frame = this.frameKey();
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
    this.ghostKey = '';
    this.noGoKey = '';
    this.buildDom();
    this.refreshHud();
    this.updateHint();
    this.settleFrames = 4;
  }

  /**
   * The journal opens over an altar only between strikes (ctx `openJournal`): a bolt and its
   * verdict play out first.
   */
  canPause(): boolean {
    return this.mode === 'edit';
  }

  /**
   * A scene over the altar (the journal desk). The board itself is kept as it is; its view,
   * labels, rails, gestures and hum go away so the desk has the screen, camera and chrome to
   * itself. `resume` builds them again over the same board.
   */
  pause(): void {
    this.ctx.fuse.hush();
    this.ctx.fuse.avoid(null);
    this.dropHand();
    this.holdFuse(false);
    this.phoneCaption(false);
    this.hum?.stop(0.3);
    this.hum = null;
    this.ctx.input.setGestures(null);
    this.teardownView();
    this.paused = true;
  }

  resume(): void {
    if (this.paused) {
      this.paused = false;
      this.hum = this.ctx.sound.sfx.stormCell(this.puzzle.storm.strength, 0.8);
      if (this.gestures) this.ctx.input.setGestures(this.gestures);
      this.rebuildView();
    }
    this.setMood();
    this.fitTop(); // the text size may have changed in Settings
    this.avoidTray();
  }

  setMood(): void {
    this.ctx.setMood(this.machine === 'the-last-rune' ? 'last-rune' : 'altar');
  }

  // ── DOM ─────────────────────────────────────────────────────────────────

  // ── Circuit read-out ────────────────────────────────────────────────────

  /** The route preview of the board as it is (no held gem), cached per revision. */
  realPreview: { hops: PathHop[]; sim: SimResult } | null = null;

  // ── First-appearance teaching ───────────────────────────────────────────

  /** Seconds FUSE has been quiet in edit mode (so a nudge never lands on another line). */
  quiet = 0;

  // ── Edits ───────────────────────────────────────────────────────────────

  tagTimer = 0;

  /** Phones: the line from the arrival card to the fixed gem it teaches (mobile-7-teach). */
  leader: SVGSVGElement | null = null;
  leaderKey = '';

  /** Phones: the fixed gem just tapped, whose card shows for a moment (mobile-7-teach). */
  fixedTap: { cell: Cell; t: number } | null = null;

  /** What turns a gem with the input in use: the keys, or the on-screen ↻ for a finger. */
  get turnKeys(): string {
    return this.touch && !this.keyboard ? 'The \u21bb button' : 'R or Q';
  }

  /** The player's last input was a finger (see engine platform/device-mode.ts). */
  get touch(): boolean {
    return this.ctx.device.touch;
  }

  // ── Playtest events + hint mechanism ───────────────────────────────────

  // ── Strike ──────────────────────────────────────────────────────────────

  /** Effective "Reduce flashes" ('auto' follows reduced motion; an explicit on/off wins). */
  get reduceFlashes(): boolean {
    return this.ctx.settings.reduceFlashes;
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
  readonly aimable = (c: Cell) => !this.board.isBlocked(c) && !this.board.fixedAt(c);

  // ── Teaching + affordances ──────────────────────────────────────────────

  /** True while the first altar is still teaching its first move. */
  get teaching(): boolean {
    return !!this.teachCell && this.mode === 'edit' && !this.board.at(this.teachCell);
  }

  /** The socket the held gem is refused at (its tag stays while the gem hovers there). */
  refusedKey = '';

  render(frame: Frame): void {
    this.view.render(frame);
  }
}

Object.assign(
  AltarScene.prototype,
  placeMethods,
  columnMethods,
  domMethods,
  readoutMethods,
  circuitMethods,
  infoMethods,
  handMethods,
  runMethods,
  editMethods,
);
