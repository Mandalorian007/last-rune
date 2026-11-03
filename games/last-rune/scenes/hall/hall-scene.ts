/**
 * The machine hall: pick a machine. Logic only; pixels come from `ctx.views.hall`.
 *
 * - Pointer: hover an alcove → name plate now, FUSE's line after a short dwell.
 *   Click an open alcove → `flow.openPuzzle`. Click a locked one → FUSE says why.
 * - Keyboard/pad: ←/→ cycle alcoves (front to back), Enter opens, Esc → settings.
 * - First visit: FUSE's welcome. Idle: an ambient line now and then.
 * - Coming back from a solve: tells the view what was restored and opened.
 * - Phones (mobile-5-chrome): the camera zooms out and the wings widen so every door fits the
 *   filled width (`hall-frame.ts`), and each door wears a plate saying what it is. The model's
 *   positions are world px; the pointer and the HUD convert through the frame.
 */
import type { Frame } from '@engine/render';
import type { Rect } from '@engine/ui';
import { type FuseLine, hallLines } from '../../content/lines';
import type { GameCtx, GameScene } from '../../game/ctx';
import { progressOf } from '../../game/save';
import { type ProgressState, storyTier } from '../../rules/progression';
import type { MachineId } from '../../rules/types';
import { CSS_PALETTE } from '../../ui/styles';
import type { HallView, HallViewFrame } from '../views';
import {
  type HallFrame,
  hallFrame,
  IDENTITY_FRAME,
  sameFrame,
  spreadModel,
  toScreen,
  toWorld,
} from './hall-frame';
import {
  ALCOVE_HIT,
  type AlcoveModel,
  alcoveAt,
  alcoveNote,
  deriveHall,
  firstFocus,
  focusOrder,
  type HallModel,
  lineForAlcove,
  lockedNote,
  newlyUnlocked,
} from './hall-state';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const DWELL = 0.35;
/** The phone ☰ column at the right edge, CSS px (3 in from the edge, 44 wide, 4 clear). */
const MENU_COLUMN = 51;
const AMBIENT_EVERY = 75;

export class HallScene implements GameScene {
  readonly name = 'hall';
  private ctx!: GameCtx;
  private view!: HallView;
  private progress!: ProgressState;
  /** The doors as designed (world = design) and as laid out for this frame. */
  private baseModel!: HallModel;
  private model!: HallModel;
  private frame: HallFrame = IDENTITY_FRAME;
  /** The bottom of the visible band (screen design px) and one CSS px in design px. */
  private viewBottom = 1080;
  private cssPx = 1;
  private time = 0;
  private hover: MachineId | null = null;
  private focus: MachineId | null = null;
  private dwell = 0;
  private spoken: MachineId | null = null;
  private idle = 0;
  private ambientIndex = 0;
  private lastPointer = { x: -1, y: -1 };
  /** FUSE's welcome waits for the first update, after the flow has settled the caption. */
  private introPending = false;

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    this.view = ctx.views.hall(ctx.viewContext);
    this.refresh();
    ctx.post.set({
      godRays: { x: 960, y: 540, intensity: 0.12, sourceIntensity: 0 },
      fog: { density: 0.4 },
    });
    ctx.setMood('hall');
    if (!ctx.save.get().flags.hallIntro) {
      // The welcome points at the Intake Desk, so it plays only while that is the "Start here"
      // door (an imported or hand-made save can have progress without the flag).
      this.introPending = welcomeFits(this.model);
      ctx.save.update((d) => {
        d.flags.hallIntro = true;
        return undefined;
      });
    }
  }

  exit(): void {
    this.view.dispose();
    this.clearChrome();
  }

  pause(): void {
    this.clearChrome();
    this.ctx.fuse.hush();
  }

  /** Scenes over or after the hall draw with a plain camera and none of its HUD. */
  private clearChrome(): void {
    this.ctx.hud.plate(null);
    this.ctx.hud.suggest(null);
    this.ctx.hud.doors(null);
    this.ctx.fuse.avoid(null);
    const cam = this.ctx.renderer.camera;
    cam.x = cam.y = 0;
    cam.zoom = 1;
    this.frame = IDENTITY_FRAME;
  }

  resume(): void {
    const before = this.progress;
    this.frame = IDENTITY_FRAME;
    this.refresh();
    this.ctx.setMood('hall');
    const restored = this.progress.solved.filter((id) => !before.solved.includes(id));
    for (const id of restored) this.view.onRestored?.(id, newlyUnlocked(before, this.progress));
    this.hover = null;
    this.spoken = null;
    this.idle = 0;
  }

  /** Read-only snapshot for tests/diagnostics. */
  get state(): {
    model: HallModel;
    hover: MachineId | null;
    focus: MachineId | null;
    frame: HallFrame;
  } {
    return { model: this.model, hover: this.hover, focus: this.focus, frame: this.frame };
  }

  update(dt: number): void {
    const { input } = this.ctx;
    this.time += dt;
    this.idle += dt;

    if (this.introPending) {
      this.introPending = false;
      const first = hallLines('first-entry', 1)[0];
      if (first) this.say(first);
    }

    // A resize or rotation can change the phone framing.
    if (this.reframe()) {
      const h = this.hover;
      this.hover = null;
      this.setHover(h, true);
    }
    this.applyCamera();

    // A panel (Settings, Codex) is over the hall: no door card shows on top of it. A touch's
    // pointer stays where it was tapped, so the card would otherwise outlive the tap.
    if ((this.ctx.ui.stack.size > 0 || this.ctx.hud.menuOpen) && this.hover) {
      this.setHover(null, true);
      this.focus = null;
    }

    // Pointer hover (pointer movement takes over from keyboard focus).
    const p = input.pointer;
    const at = toWorld(this.frame, p.x, p.y);
    const moved = p.x !== this.lastPointer.x || p.y !== this.lastPointer.y;
    if (moved) {
      this.lastPointer = { x: p.x, y: p.y };
      this.focus = null;
      const free = !this.ctx.ui.stack.size && !this.ctx.hud.menuOpen;
      const hit = p.inside && free ? alcoveAt(this.model, at.x, at.y) : null;
      this.setHover(hit?.id ?? null);
    }

    // Keyboard / pad focus.
    const step = input.pressed('next') ? 1 : input.pressed('prev') ? -1 : 0;
    if (step !== 0) {
      const order = focusOrder(this.model);
      const cur = this.focus ?? this.hover;
      const i = cur ? order.indexOf(cur) : -1;
      const next =
        i < 0
          ? (firstFocus(this.model) ?? order[0]!)
          : order[(i + step + order.length) % order.length]!;
      this.focus = next;
      this.setHover(next);
      this.dwell = DWELL; // speak right away for keyboard users
    }

    if (this.hover) {
      this.dwell += dt;
      if (this.dwell >= DWELL && this.spoken !== this.hover) this.speak(this.hover);
    }

    if (input.pressed('select')) {
      const hit = alcoveAt(this.model, at.x, at.y);
      if (hit) this.activate(hit);
    } else if (input.pressed('confirm') && (this.focus ?? this.hover)) {
      const a = this.alcove(this.focus ?? this.hover!);
      if (a) this.activate(a);
    } else if (input.pressed('cancel')) {
      this.ctx.openSettings();
    }

    if (this.idle >= AMBIENT_EVERY && !this.ctx.fuse.speaking) this.ambient();

    this.view.update(dt, this.frameState());
  }

  render(frame: Frame): void {
    this.view.render(frame, this.frameState());
  }

  // ── internals ───────────────────────────────────────────────────────────

  /** One reused snapshot (no per-frame allocation). */
  private readonly snap: Mutable<HallViewFrame> = {
    time: 0,
    reducedMotion: false,
    reduceFlashes: false,
    speaking: false,
    model: { alcoves: [], conduits: [] },
    hover: null,
    focus: null,
    layout: IDENTITY_FRAME,
  };

  private frameState(): HallViewFrame {
    const s = this.snap;
    s.time = this.time;
    s.reducedMotion = this.ctx.settings.reducedMotion;
    s.reduceFlashes = this.ctx.settings.reduceFlashes;
    s.speaking = this.ctx.fuse.speaking;
    s.model = this.model;
    s.hover = this.hover;
    s.focus = this.focus;
    s.layout = this.frame;
    return s;
  }

  private refresh(): void {
    this.progress = progressOf(this.ctx.save.get());
    this.baseModel = deriveHall(this.progress);
    this.model = spreadModel(this.baseModel, this.frame);
    this.reframe();
    this.placeChrome();
  }

  /** Phones: the frame for the visible band (identity elsewhere). True if it changed. */
  private reframe(): boolean {
    const { device, surface } = this.ctx;
    let f = IDENTITY_FRAME;
    this.viewBottom = 1080;
    this.cssPx = device.cssPx;
    if (device.phone) {
      const r = surface.rect;
      const k = r.width / 1920 || 1;
      const reserve = Math.max(0, MENU_COLUMN * device.cssPx - device.bar);
      const view = {
        top: Math.max(0, -r.y) / k,
        height: Math.min(1080, surface.root.clientHeight / k),
      };
      this.viewBottom = Math.min(1080, view.top + view.height);
      f = hallFrame(view, reserve);
    }
    if (sameFrame(f, this.frame)) return false;
    this.frame = f;
    this.model = spreadModel(this.baseModel, f);
    this.applyCamera();
    this.placeChrome();
    return true;
  }

  private applyCamera(): void {
    const cam = this.ctx.renderer.camera;
    cam.x = this.frame.camX;
    cam.y = this.frame.camY;
    cam.zoom = this.frame.zoom;
    cam.rotation = 0;
  }

  /** A world box (centre, size) in screen design px. */
  private screenBox(x: number, y: number, w: number, h: number) {
    const c = toScreen(this.frame, x, y);
    const k = this.frame.zoom;
    return { x: c.x, y: c.y, w: w * k, h: h * k };
  }

  /** A world rect in screen design px. */
  private screenRect(r: Rect): Rect {
    const p = toScreen(this.frame, r.x, r.y);
    const k = this.frame.zoom;
    return { x: p.x, y: p.y, width: r.width * k, height: r.height * k };
  }

  /** The HUD's suggestion ring and the phone door plates, at this frame. */
  private placeChrome(): void {
    // Phones mark the suggested door in the HUD (hidden elsewhere); the box hugs the alcove's
    // arch and sill (y-125 to y+99), so it stays inside the phone framing, or the floor disc.
    const next = this.model.alcoves.find((a) => a.suggested);
    const box = next
      ? next.floor
        ? this.screenBox(next.x, next.y, ALCOVE_HIT.h * 1.3, ALCOVE_HIT.h * 1.3)
        : this.screenBox(next.x, next.y - 13, 226, 224)
      : null;
    this.ctx.hud.suggest(
      next && box
        ? {
            ...box,
            label: this.progress.solved.length === 0 ? 'Start here' : 'Next',
            round: next.floor,
          }
        : null,
    );
    this.ctx.hud.doors(this.ctx.device.phone ? this.doorPlates() : null);
  }

  /**
   * Each door's plate: over the foot of its arch (the floor seal's: under its rim), as wide as
   * the gap to the next door allows.
   */
  private doorPlates() {
    const k = this.frame.zoom;
    // One 12 px line plus its padding stays above the band's bottom edge.
    const floorY = this.viewBottom - 22 * this.cssPx;
    const doors = this.model.alcoves.filter((a) => !a.floor);
    return this.model.alcoves.map((a) => {
      const at = toScreen(this.frame, a.x, a.floor ? a.y + 150 : a.y + 52);
      // As wide as the gap to the nearest door in its row (a door alone: a door and a half).
      let gap = 420;
      if (!a.floor)
        for (const b of doors)
          if (b !== a && Math.abs(b.y - a.y) < 60) gap = Math.min(gap, Math.abs(b.x - a.x));
      return {
        id: a.id,
        x: at.x,
        y: Math.min(at.y, floorY),
        maxWidth: gap * k - 6,
        name: a.name,
        status: a.status,
      };
    });
  }

  private alcove(id: MachineId): AlcoveModel | undefined {
    return this.model.alcoves.find((a) => a.id === id);
  }

  private setHover(id: MachineId | null, quiet = false): void {
    if (id === this.hover) return;
    this.hover = id;
    if (!quiet) this.dwell = 0;
    const a = id ? this.alcove(id) : undefined;
    if (!a) {
      this.ctx.hud.plate(null);
      return;
    }
    if (!quiet) this.ctx.sfx('ui.hover');
    const top = a.y < 320;
    const half = a.floor ? ALCOVE_HIT.h * 0.6 : ALCOVE_HIT.h / 2;
    if (this.ctx.device.phone) {
      // Phones (mobile-6-chrome): plain words and the needed gems by name. A top-row door's
      // card hangs under the door's own plate; any other's stands on the arch, clear of it.
      const at = toScreen(this.frame, a.x, top ? a.y + half : a.y - half - 6);
      this.ctx.hud.plate({
        x: at.x,
        y: at.y,
        name: a.name,
        note: lockedNote(a),
        gems: a.missing.map((m) => ({
          label: m.label,
          colour: CSS_PALETTE[m.colour === 'slate' ? 'parchment' : m.colour],
        })),
        above: !top,
        door: a.id,
      });
      return;
    }
    const at = toScreen(this.frame, a.x, top ? a.y + half + 14 : a.y - half);
    this.ctx.hud.plate({
      x: at.x,
      y: top ? at.y : at.y - 80,
      name: a.name,
      note: alcoveNote(a, this.ctx.device.touch),
    });
  }

  private speak(id: MachineId): void {
    const a = this.alcove(id);
    this.spoken = id;
    this.idle = 0;
    const line = a ? lineForAlcove(a) : undefined;
    if (line && !this.ctx.fuse.isSaying(line)) this.say(line, { interrupt: true }, id);
  }

  private activate(a: AlcoveModel): void {
    this.idle = 0;
    if (a.status === 'locked') {
      this.ctx.sfx('ui.deny');
      this.speak(a.id);
      return;
    }
    this.ctx.sfx('ui.click');
    this.ctx.fuse.hush();
    this.ctx.flow.openPuzzle(a.id);
  }

  private ambient(): void {
    this.idle = 0;
    const tier = storyTier(this.progress);
    const pool = [...hallLines('ambient', tier), ...(tier >= 3 ? hallLines('echo', tier) : [])];
    if (pool.length === 0) return;
    const line = pool[this.ambientIndex++ % pool.length]!;
    this.say(line);
  }

  /** FUSE speaks with his card kept off the suggested door (and its tag) and the one he names. */
  private say(line: FuseLine, opts?: { interrupt?: boolean }, about?: MachineId): void {
    const regions: Rect[] = [];
    // Phones: the card keeps off every door (their plates are part of the hall's map).
    const phone = this.ctx.device.phone;
    for (const a of this.model.alcoves) {
      if (phone || a.suggested || a.id === about) regions.push(this.screenRect(doorRect(a)));
    }
    this.ctx.fuse.avoid(regions);
    void this.ctx.fuse.say(line, opts);
  }
}

/** The welcome names the Intake Desk: true only while it is the suggested door. */
export function welcomeFits(model: HallModel): boolean {
  return model.alcoves.find((a) => a.suggested)?.id === 'intake-desk';
}

/** A door's arch-to-sill box plus the phone "Start here ▾" tag above it, design px. */
export function doorRect(a: AlcoveModel): Rect {
  if (a.floor) {
    const r = ALCOVE_HIT.h * 0.65;
    return { x: a.x - r, y: a.y - r - 40, width: r * 2, height: r * 2 + 40 };
  }
  return { x: a.x - 113, y: a.y - 125 - 40, width: 226, height: 224 + 40 };
}
