/**
 * The machine hall: pick a machine. Logic only; pixels come from `ctx.views.hall`.
 *
 * - Pointer: hover an alcove → name plate now, FUSE's line after a short dwell.
 *   Click an open alcove → `flow.openPuzzle`. Click a locked one → FUSE says why.
 * - Keyboard/pad: ←/→ cycle alcoves (front to back), Enter opens, Esc → settings.
 * - First visit: FUSE's welcome. Idle: an ambient line now and then.
 * - Coming back from a solve: tells the view what was restored and opened.
 */
import type { Frame } from '@engine/render';
import { hallLines } from '../../content/lines';
import type { GameCtx, GameScene } from '../../game/ctx';
import { progressOf } from '../../game/save';
import { type ProgressState, storyTier } from '../../rules/progression';
import type { MachineId } from '../../rules/types';
import type { HallView, HallViewFrame } from '../views';
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
  newlyUnlocked,
} from './hall-state';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const DWELL = 0.35;
const AMBIENT_EVERY = 75;

export class HallScene implements GameScene {
  readonly name = 'hall';
  private ctx!: GameCtx;
  private view!: HallView;
  private progress!: ProgressState;
  private model!: HallModel;
  private time = 0;
  private hover: MachineId | null = null;
  private focus: MachineId | null = null;
  private dwell = 0;
  private spoken: MachineId | null = null;
  private idle = 0;
  private ambientIndex = 0;
  private lastPointer = { x: -1, y: -1 };

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
      const first = hallLines('first-entry', 1)[0];
      if (first) void ctx.fuse.say(first);
      ctx.save.update((d) => {
        d.flags.hallIntro = true;
        return undefined;
      });
    }
  }

  exit(): void {
    this.view.dispose();
    this.ctx.hud.plate(null);
    this.ctx.hud.suggest(null);
  }

  pause(): void {
    this.ctx.hud.plate(null);
    this.ctx.hud.suggest(null);
    this.ctx.fuse.hush();
  }

  resume(): void {
    const before = this.progress;
    this.refresh();
    this.ctx.setMood('hall');
    const restored = this.progress.solved.filter((id) => !before.solved.includes(id));
    for (const id of restored) this.view.onRestored?.(id, newlyUnlocked(before, this.progress));
    this.hover = null;
    this.spoken = null;
    this.idle = 0;
  }

  /** Read-only snapshot for tests/diagnostics. */
  get state(): { model: HallModel; hover: MachineId | null; focus: MachineId | null } {
    return { model: this.model, hover: this.hover, focus: this.focus };
  }

  update(dt: number): void {
    const { input } = this.ctx;
    this.time += dt;
    this.idle += dt;

    // Pointer hover (pointer movement takes over from keyboard focus).
    const p = input.pointer;
    const moved = p.x !== this.lastPointer.x || p.y !== this.lastPointer.y;
    if (moved) {
      this.lastPointer = { x: p.x, y: p.y };
      this.focus = null;
      const hit = p.inside ? alcoveAt(this.model, p.x, p.y) : null;
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
      const hit = alcoveAt(this.model, p.x, p.y);
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
    return s;
  }

  private refresh(): void {
    this.progress = progressOf(this.ctx.save.get());
    this.model = deriveHall(this.progress);
    // Phones mark the suggested door in the HUD (hidden elsewhere); the box hugs the alcove's
    // arch and sill (y-125 to y+99), so it stays inside the phone framing, or the floor disc.
    const next = this.model.alcoves.find((a) => a.suggested);
    this.ctx.hud.suggest(
      next
        ? {
            x: next.x,
            y: next.floor ? next.y : next.y - 13,
            w: next.floor ? ALCOVE_HIT.h * 1.3 : 226,
            h: next.floor ? ALCOVE_HIT.h * 1.3 : 224,
            label: this.progress.solved.length === 0 ? 'Start here' : 'Next',
            round: next.floor,
          }
        : null,
    );
  }

  private alcove(id: MachineId): AlcoveModel | undefined {
    return this.model.alcoves.find((a) => a.id === id);
  }

  private setHover(id: MachineId | null): void {
    if (id === this.hover) return;
    this.hover = id;
    this.dwell = 0;
    const a = id ? this.alcove(id) : undefined;
    if (!a) {
      this.ctx.hud.plate(null);
      return;
    }
    this.ctx.sfx('ui.hover');
    const top = a.y < 320;
    const half = a.floor ? ALCOVE_HIT.h * 0.6 : ALCOVE_HIT.h / 2;
    this.ctx.hud.plate({
      x: a.x,
      y: top ? a.y + half + 14 : a.y - half - 80,
      name: a.name,
      note: alcoveNote(a),
    });
  }

  private speak(id: MachineId): void {
    const a = this.alcove(id);
    this.spoken = id;
    this.idle = 0;
    const line = a ? lineForAlcove(a) : undefined;
    if (line && !this.ctx.fuse.isSaying(line)) void this.ctx.fuse.say(line, { interrupt: true });
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
    void this.ctx.fuse.say(line);
  }
}
