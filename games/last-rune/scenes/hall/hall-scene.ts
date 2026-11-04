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
import type { Frame } from '@thunderclap/engine/render';
import type { Rect } from '@thunderclap/engine/ui';
import { type FuseLine, hallLines } from '../../content/lines';
import type { GameCtx, GameScene } from '../../game/ctx';
import { progressOf } from '../../game/save';
import { type ProgressState, storyTier } from '../../rules/progression';
import type { MachineId } from '../../rules/types';
import { isPhone } from '../../ui/chrome';
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
  noteNamesGems,
} from './hall-state';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const DWELL = 0.35;
/** The phone ☰ column at the right edge, CSS px, before the layout has measured. */
const MENU_COLUMN = 64;
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
  /** The visible band's top and bottom (screen design px) and one CSS px in design px. */
  private viewTop = 0;
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
    this.ctx.fuse.keepClear(null);
    this.ctx.fuse.pointAt(null);
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
    // Phones: FUSE's card points at him wherever he has rolled (mobile-7-hall).
    this.ctx.fuse.pointAt(this.ctx.device.phone ? this.fuseSpot() : null, 7 * this.cssPx);
  }

  /** FUSE in screen design px (his wheels' centre and his height), if the view says. */
  private fuseSpot(): { x: number; y: number; h: number } | null {
    const f = this.view.fuseAt?.();
    if (!f) return null;
    const p = toScreen(this.frame, f.x, f.y);
    return { x: p.x, y: p.y, h: f.h * this.frame.zoom };
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
    this.viewTop = 0;
    this.viewBottom = 1080;
    this.cssPx = device.cssPx;
    if (device.phone) {
      const r = surface.rect;
      const k = r.width / 1920 || 1;
      // The ☰ rail (the layout's right region) stays clear of doors.
      const st = isPhone(this.ctx.ui) ? this.ctx.ui.layout.state : null;
      const rail = st?.regions.right;
      const railCss = rail && rail.width > 0 ? st.width - rail.x : MENU_COLUMN;
      const reserve = Math.max(0, railCss * device.cssPx - device.bar);
      const view = {
        top: Math.max(0, -r.y) / k,
        height: Math.min(1080, surface.root.clientHeight / k),
      };
      this.viewTop = view.top;
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

  /** The visible band, screen design px (the whole design off phones). */
  private bounds() {
    return { left: 0, top: this.viewTop, right: 1920, bottom: this.viewBottom };
  }

  /** The HUD's suggestion ring and the phone door plates, at this frame. */
  private placeChrome(): void {
    const phone = this.ctx.device.phone;
    const plates = phone ? this.doorPlates() : null;
    this.ctx.hud.doors(plates);
    // Phones mark the suggested door in the HUD (hidden elsewhere). The ring goes round the
    // door's art and stops just above its plate (mobile-7-hall: never through the name): a wall
    // door's arch (y-125) down to its plate, the floor seal's disc down to its plate.
    const next = this.model.alcoves.find((a) => a.suggested);
    let box: { x: number; y: number; w: number; h: number } | null = null;
    if (next) {
      const plateTop = plates?.find((p) => p.id === next.id)?.y;
      const gap = 3 * this.cssPx;
      if (next.floor) {
        const r = ALCOVE_HIT.h * 0.65;
        const disc = this.screenBox(next.x, next.y, r * 2, r * 2);
        const top = disc.y - disc.h / 2;
        const bottom = Math.min(disc.y + disc.h / 2, (plateTop ?? 1e9) - gap);
        box = { x: disc.x, y: (top + bottom) / 2, w: disc.w, h: bottom - top };
      } else {
        const arch = this.screenBox(next.x, next.y - 13, 226, 224);
        const top = arch.y - arch.h / 2;
        const bottom = Math.min(arch.y + arch.h / 2, (plateTop ?? 1e9) - gap);
        box = { x: arch.x, y: (top + bottom) / 2, w: arch.w, h: bottom - top };
      }
    }
    this.ctx.hud.suggest(
      next && box
        ? {
            ...box,
            label: this.progress.solved.length === 0 ? 'Start here' : 'Next',
            round: next.floor,
            bounds: phone ? this.bounds() : undefined,
            gap: 5 * this.cssPx,
          }
        : null,
    );
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
        // Neighbours keep 8 CSS px between their widest plates (mobile-7-hall).
        maxWidth: gap * k - 8 * this.cssPx,
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
      // Phones: plain words ("Locked: solve Relay Tower first"); the gems by name only when the
      // words point at them. The card stands beside the door, clear of every other door's
      // plate (mobile-7-hall); FUSE's word on it joins the card after a moment (`speak`).
      const at = toScreen(this.frame, a.x, top ? a.y + half : a.y - half - 6);
      this.ctx.hud.plate({
        x: at.x,
        y: at.y,
        name: a.name,
        note: lockedNote(a),
        gems: noteNamesGems(a)
          ? a.missing.map((m) => ({
              label: m.label,
              colour: CSS_PALETTE[m.colour === 'slate' ? 'parchment' : m.colour],
            }))
          : [],
        above: !top,
        door: a.id,
        doorBox: this.screenRect(archRect(a)),
        bounds: this.bounds(),
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
    if (!line) return;
    // Phones (mobile-7-hall): his word on a door goes inside that door's card, not a second
    // bubble over the hall.
    if (this.ctx.device.phone && this.ctx.hud.plateSay(id, line.text)) {
      this.ctx.fuse.hush();
      return;
    }
    if (!this.ctx.fuse.isSaying(line)) this.say(line, { interrupt: true }, id);
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
    // Phones: the card keeps off every door (their plates are part of the hall's map) and off
    // FUSE himself, and sits on his side of the hall so its tail is short (mobile-7-hall). The
    // caption card weighs regions by summed area, so a door that can be played counts four
    // times over: if the card must cover something, it is a locked door.
    const phone = this.ctx.device.phone;
    for (const a of this.model.alcoves) {
      if (!phone && !a.suggested && a.id !== about) continue;
      const r = this.screenRect(doorRect(a));
      regions.push(r);
      if (phone && a.status !== 'locked') regions.push(r, r, r);
      if (phone && a.suggested) {
        // Its tag may stand beside the ring (hud placeTag): keep the card off either side.
        const side = 100 * this.cssPx;
        const t = { x: r.x - side, y: r.y, width: r.width + side * 2, height: r.height };
        regions.push(t, t, t, t);
      }
    }
    // The door card he is talking about (phones, when his word did not fit on it): never under
    // his caption. Weighted over any door, since covering it hides what he is explaining.
    const card = phone ? this.ctx.hud.plateBox() : null;
    if (card) for (let i = 0; i < 8; i++) regions.push(card);
    let corner: 'bottom-left' | 'bottom-right' | undefined;
    const me = phone ? this.fuseSpot() : null;
    if (me) {
      const w = me.h * 0.8;
      regions.push({ x: me.x - w / 2, y: me.y - me.h, width: w, height: me.h });
      corner = me.x < 960 ? 'bottom-left' : 'bottom-right';
    }
    this.ctx.fuse.keepClear(regions);
    void this.ctx.fuse.say(line, { ...opts, corner });
  }
}

/** The welcome names the Intake Desk: true only while it is the suggested door. */
export function welcomeFits(model: HallModel): boolean {
  return model.alcoves.find((a) => a.suggested)?.id === 'intake-desk';
}

/**
 * A door's arch-to-sill box plus the phone "Start here ▾" tag above it, design px; the floor
 * seal's also reaches down over its plate, which hangs below the disc.
 */
export function doorRect(a: AlcoveModel): Rect {
  if (a.floor) {
    const r = ALCOVE_HIT.h * 0.65;
    return { x: a.x - r, y: a.y - r - 40, width: r * 2, height: r * 2 + 40 + 120 };
  }
  return { x: a.x - 113, y: a.y - 125 - 40, width: 226, height: 224 + 40 };
}

/** A door's drawn art alone (arch to sill, or the floor seal's disc), world px. */
export function archRect(a: AlcoveModel): Rect {
  if (a.floor) {
    const r = ALCOVE_HIT.h * 0.65;
    return { x: a.x - r, y: a.y - r, width: r * 2, height: r * 2 };
  }
  return { x: a.x - 100, y: a.y - 118, width: 200, height: 210 };
}
