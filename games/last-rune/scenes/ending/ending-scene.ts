/**
 * The ending (pitch screen 7, script §4 "The door"). Plays after the Last
 * Rune's solve moment when the facility is complete.
 *
 * GPU: the hall (its own view instance) under a cool dusk; the Last Rune as a
 * room-sized gold disc at the hall centre; the storm funnelling into it; the
 * door of light it always was; FUSE; the clipboard he drops; full-screen
 * washes (white-out, the chat's dark, the gold flood).
 * DOM: the mock chat (D-005: lore, never live), title card, safety record,
 * credits, end card, and the post-credits clipboard page.
 *
 * Directed by an async script over scene-time waits. A generation token makes
 * skip / exit cancel it cleanly. Skippable only after the first viewing.
 */
import type { PostSettingsPatch } from '@engine/post';
import type { DrawParams, Frame, Material, RGBA } from '@engine/render';
import { h } from '@engine/ui';
import { POST_PRESETS } from '../../art/materials/post-presets';
import { Fuse as FuseProp } from '../../art/props/fuse';
import { PropLightRig } from '../../art/props/lighting';
import type { FuseLine } from '../../content/lines';
import type { GameCtx, GameScene } from '../../game/ctx';
import type { SolveMoment } from '../../game/flow';
import { progressOf } from '../../game/save';
import { deriveHall } from '../hall/hall-state';
import { DeskArt } from '../journal/desk-art';
import { PROP } from '../journal/desk-wgsl';
import type { HallView, HallViewFrame } from '../views';
import {
  CHAT,
  CREDITS,
  type DirectionCue,
  type EndCard,
  type EndingBeat,
  endCard,
  endingBeats,
  endingSkippable,
} from './ending-model';
import { ensureEndingStyles } from './ending-styles';
import { ENDING_MODE, ENDING_WGSL, RUNE_CENTRE } from './ending-wgsl';

/** Layout (design px). */
export const ENDING_LAYOUT = {
  rune: { r: 290 },
  door: { w: 380, h: 620, base: 640 },
  fuse: { x: 1460, y: 968, scale: 150, edge: 1300 },
  /** Where the clipboard comes to rest (centre), its size and angle. */
  clip: { x: 1330, y: 968, w: 150, h: 196, rot: -0.32 },
} as const;

/** Phases, for tests and diagnostics. */
export type EndingPhase =
  | 'rune'
  | 'door'
  | 'edge'
  | 'through'
  | 'chat'
  | 'flood'
  | 'credits'
  | 'end-card'
  | 'post-credits';

const GOLD: RGBA = [1.0, 0.72, 0.3, 1];
const STORM: RGBA = [0.45, 0.7, 1.0, 1];
const WARM_WHITE: RGBA = [1.0, 0.95, 0.86, 1];
const CHAT_DARK: RGBA = [0.012, 0.013, 0.016, 1];
/**
 * The ending preset, held back while the rune lights: less bloom and haze so the
 * engraving and the door read. The full preset arrives with the gold flood.
 */
const DUSK_POST = {
  bloom: { intensity: 0.7, threshold: 1.4 },
  godRays: { intensity: 0.28 },
  fog: { density: 0.22 },
  vignette: { intensity: 0.7 },
  grade: { exposure: 0.92 },
} as const;
/**
 * The door opening: bloom, rays and haze ease down while the door rises, so the Builder's
 * mark still reads through the light instead of blooming out.
 */
const DOOR_POST = {
  bloom: { intensity: 0.5, threshold: 1.75 },
  godRays: { intensity: 0.12 },
  fog: { density: 0.14 },
  grade: { exposure: 0.88 },
} as const;
/** FUSE goes through: the light swells back up into the white-out. */
const THROUGH_POST = { bloom: { intensity: 0.8, threshold: 1.35 }, godRays: { intensity: 0.3 } };
const THROUGH_POST_CALM = { bloom: { intensity: 0.6, threshold: 1.55 } };
/** The gold flood: warm and full, but held under white so the end card reads. */
const FLOOD_POST = {
  bloom: { intensity: 0.75, threshold: 1.4 },
  godRays: { intensity: 0.4 },
  fog: { density: 0.3 },
  vignette: { intensity: 0.55 },
  grade: { exposure: 0.95 },
} as const;
/** Reduce flashes: the same flood with a softer bloom (no sudden glare). */
const FLOOD_POST_CALM = { ...FLOOD_POST, bloom: { intensity: 0.55, threshold: 1.6 } } as const;
/** The chat: a flat screen. Fog and rays fade to nothing, then switch off. */
const CHAT_POST = {
  fog: { density: 0, enabled: false },
  godRays: { intensity: 0, enabled: false },
  vignette: { intensity: 0.2 },
} as const;

/** `b` over `a`, section by section (built once, at load). */
function mergePost(a: PostSettingsPatch, b: PostSettingsPatch): PostSettingsPatch {
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const key = k as keyof PostSettingsPatch;
    out[k] = { ...a[key], ...b[key] };
  }
  return out as PostSettingsPatch;
}
const FLOOD_LOOK = mergePost(POST_PRESETS.ending, FLOOD_POST);
const FLOOD_LOOK_CALM = mergePost(POST_PRESETS.ending, FLOOD_POST_CALM);
/** Fog and rays come back from nothing when the gold floods in. */
const FLOOD_FROM = { fog: { enabled: true, density: 0 }, godRays: { enabled: true, intensity: 0 } };

/** A scalar eased from `from` to `to` over `dur` seconds of scene time. Allocation-free. */
class Tween {
  v: number;
  private from: number;
  private to: number;
  private t0 = 0;
  private dur = 0;
  constructor(v: number) {
    this.v = v;
    this.from = v;
    this.to = v;
  }
  set(to: number, dur: number, now: number): void {
    this.from = this.v;
    this.to = to;
    this.t0 = now;
    this.dur = dur;
    if (dur <= 0) this.v = to;
  }
  snap(v: number): void {
    this.v = this.from = this.to = v;
    this.dur = 0;
  }
  tick(now: number): void {
    if (this.dur <= 0) {
      this.v = this.to;
      return;
    }
    const k = Math.min(1, Math.max(0, (now - this.t0) / this.dur));
    const e = k * k * (3 - 2 * k);
    this.v = this.from + (this.to - this.from) * e;
  }
}

interface Wait {
  until: number;
  resolve: () => void;
}

export class EndingScene implements GameScene {
  readonly name = 'ending';
  private ctx!: GameCtx;
  private readonly moment: SolveMoment;
  private readonly beats: EndingBeat[] = endingBeats();
  private card!: EndCard;
  private view!: HallView;
  private viewFrame!: HallViewFrame;
  private desk!: DeskArt;
  private fuse!: FuseProp;
  private readonly lights = new PropLightRig();
  private matPre!: Material;
  private matAdd!: Material;
  private readonly dp: DrawParams = {
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    rotation: 0,
    tint: [1, 1, 1, 1],
    emissive: 1,
    params: [0, 0, 0, 0],
  };

  private time = 0;
  private gen = 0;
  private waits: Wait[] = [];
  private _phase: EndingPhase = 'rune';

  // Animated state.
  private readonly dusk = new Tween(0);
  private readonly ign = new Tween(0.08);
  private readonly storm = new Tween(0);
  private readonly pull = new Tween(0);
  private readonly aperture = new Tween(0);
  private readonly door = new Tween(0);
  private readonly doorBright = new Tween(0.5);
  private readonly approach = new Tween(0);
  private readonly fuseFade = new Tween(1);
  private readonly fuseDepth = new Tween(0);
  private readonly screen = new Tween(0);
  /** 0 = warm white, 1 = the chat's near-black. */
  private readonly screenDark = new Tween(0);
  private readonly flood = new Tween(0);
  /** Clipboard fall: -1 = still in his clamp, else seconds since the drop. */
  private clipT = -1;
  private clipFromX = 0;
  private clipFromY = 0;

  // DOM.
  private root: HTMLElement | null = null;
  private chat!: HTMLElement;
  private chatText!: HTMLElement;
  private caret!: HTMLElement;
  private reacts: HTMLElement[] = [];
  private typing!: HTMLElement;
  private titleEl!: HTMLElement;
  private safetyEl!: HTMLElement;
  private creditsEl!: HTMLElement;
  private cardEl!: HTMLElement;
  private noteEl!: HTMLElement;
  private skipBtn: HTMLButtonElement | null = null;
  private typingLine: { el: HTMLElement; text: string; shown: number; cps: number } | null = null;

  // Post-credits idle.
  private idleFrom = -1;
  private noteShown = false;
  private postSeconds = 30;
  private postLine: FuseLine | null = null;
  private readonly abort = new AbortController();

  constructor(moment: SolveMoment) {
    this.moment = moment;
  }

  get phase(): EndingPhase {
    return this._phase;
  }

  get skippable(): boolean {
    return endingSkippable(this.moment);
  }

  enter(ctx: GameCtx): void {
    this.ctx = ctx;
    const doc = ctx.surface.root.ownerDocument;
    ensureEndingStyles(doc);
    const save = ctx.save.get();
    this.card = endCard(save.stats);
    this.view = ctx.views.hall(ctx.viewContext);
    this.viewFrame = {
      time: 0,
      reducedMotion: ctx.settings.reducedMotion,
      model: deriveHall(progressOf(save)),
      hover: null,
      focus: null,
    };
    this.desk = new DeskArt(ctx.renderer);
    this.desk.candleOn = false;
    const L = ENDING_LAYOUT.fuse;
    this.fuse = new FuseProp(ctx.renderer, { x: L.x, y: L.y, scale: L.scale, facing: -1 });
    this.fuse.lookAt(RUNE_CENTRE.x, RUNE_CENTRE.y);
    this.matPre = ctx.renderer.createMaterial({
      label: 'ending-pre',
      wgsl: ENDING_WGSL,
      blend: 'premultiplied',
    });
    this.matAdd = ctx.renderer.createMaterial({
      label: 'ending-add',
      wgsl: ENDING_WGSL,
      blend: 'additive',
    });
    const idle = this.beats.find((b) => b.kind === 'idle');
    if (idle?.kind === 'idle') {
      this.postSeconds = idle.seconds;
      this.postLine = idle.line;
    }
    this.buildDom(doc);
    // A hard cut, like the view itself (the solve moment hands straight over to the hall).
    ctx.post.set(POST_PRESETS.ending);
    ctx.post.set(DUSK_POST);
    ctx.setMood('ending');
    ctx.hud.plate(null);
    const reset = () => {
      if (this.idleFrom >= 0) this.idleFrom = this.time;
    };
    const win = doc.defaultView;
    for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const) {
      win?.addEventListener(ev, reset, { signal: this.abort.signal, passive: true });
    }
    void this.direct(this.gen);
  }

  exit(): void {
    this.gen++;
    this.flushWaits();
    this.abort.abort();
    this.ctx.fuse.hush();
    this.root?.remove();
    this.root = null;
    this.view.dispose();
    this.desk.destroy();
    this.fuse.destroy();
    this.matPre.destroy();
    this.matAdd.destroy();
    this.ctx.post.finishBlend();
    this.ctx.post.set(POST_PRESETS.hall);
  }

  // ── Director ─────────────────────────────────────────────────────────────

  private wait(seconds: number): Promise<void> {
    return new Promise((resolve) => this.waits.push({ until: this.time + seconds, resolve }));
  }

  private flushWaits(): void {
    const w = this.waits;
    this.waits = [];
    for (const x of w) x.resolve();
  }

  private async say(line: FuseLine, g: number): Promise<boolean> {
    if (g !== this.gen) return false;
    this.fuse.mood = 'talk';
    await this.ctx.fuse.say(line, { interrupt: true });
    if (g !== this.gen) return false;
    this.fuse.mood = 'idle';
    return true;
  }

  /** Play the beat list in order. Every await re-checks the generation token. */
  private async direct(g: number): Promise<void> {
    const t = () => this.time;
    const live = () => g === this.gen;
    // Arrival: the rune is already warm from the final gem; the hall dims around it.
    this.dusk.set(1, 2.2, t());
    this.ign.set(0.3, 2.5, t());
    this.storm.set(0.35, 3, t());
    await this.wait(1.4);
    let chatIndex = 0;
    for (const beat of this.beats) {
      if (!live()) return;
      switch (beat.kind) {
        case 'line': {
          const id = beat.line.id;
          if (!(await this.say(beat.line, g))) return;
          if (id === 'beat.rune-lights') {
            // "I'll get the lights."
            this.ctx.sound.sfx.play('endingSwell');
            this.ign.set(1, 3, t());
            this.storm.set(0.8, 2.5, t());
            this.aperture.set(0.1, 3, t());
          }
          await this.wait(0.7);
          break;
        }
        case 'direction':
          await this.cue(beat.cue, g);
          break;
        case 'chat':
          if (chatIndex++ === 0) await this.wait(0.9);
          await this.type(beat.line.text, g);
          await this.wait(1.3);
          break;
        case 'title-card':
          await this.endScreen(g);
          break;
        case 'idle':
          // Armed in endScreen; the update loop watches for idleness.
          break;
      }
    }
  }

  private async cue(cue: DirectionCue, g: number): Promise<void> {
    const t = this.time;
    const L = ENDING_LAYOUT;
    switch (cue) {
      case 'door':
        // The rune catches the storm. It was always a door. The player walks toward it.
        this._phase = 'door';
        this.pull.set(1, 3.5, t);
        this.storm.set(0.55, 4, t);
        this.door.set(1, 3.2, t + 0.6);
        this.aperture.set(0.24, 3, t);
        this.approach.set(1, 7, t);
        this.ctx.post.blendTo(DOOR_POST, 3.8);
        this.ctx.sound.sfx.play('endingSwell');
        await this.wait(4.2);
        break;
      case 'edge':
        // FUSE rolls to the edge of the gold light. Stops. Clipboard still in his clamp.
        this._phase = 'edge';
        this.fuse.rollTo(L.fuse.edge);
        await this.wait(2.6);
        this.fuse.lookAt(RUNE_CENTRE.x, L.door.base - L.door.h * 0.5);
        await this.wait(0.6);
        break;
      case 'through': {
        // He drops the clipboard. It lands. He goes through. White.
        this._phase = 'through';
        const f = this.fuse;
        this.clipFromX = f.x - 0.36 * f.scale * f.facing;
        this.clipFromY = f.y - 0.64 * f.scale;
        f.clipboard = false;
        this.clipT = 0;
        await this.wait(0.42);
        this.ctx.sound.sfx.play('clipboardDrop');
        await this.wait(1.5);
        if (g !== this.gen) return;
        f.rollTo(RUNE_CENTRE.x);
        this.fuseDepth.set(1, 3.2, this.time);
        this.fuseFade.set(0, 2.6, this.time + 1.0);
        this.doorBright.set(this.calm ? 0.45 : 0.7, 3, this.time + 0.8);
        this.ctx.post.blendTo(this.calm ? THROUGH_POST_CALM : THROUGH_POST, 4.5);
        await this.wait(2.8);
        // Reduce flashes: a slower fade to a dimmer white.
        this.screen.set(1, this.calm ? 2.8 : 1.6, this.time);
        await this.wait(2.4);
        break;
      }
      case 'chat-open':
        this._phase = 'chat';
        // Behind the white the hall settles: storm spent, door closed, rune lit.
        this.storm.snap(0);
        this.door.snap(0);
        this.aperture.snap(0.08);
        this.approach.snap(0);
        this.screenDark.set(1, 1.6, t);
        // A flat screen: fog, god rays and vignette ease away as the white goes dark.
        this.ctx.post.blendTo(CHAT_POST, 1.6);
        await this.wait(1.0);
        this.chat.setAttribute('data-in', '');
        await this.wait(1.6);
        break;
      case 'react':
        this.caret.hidden = true;
        await this.wait(1.4);
        this.typing.textContent = `${CHAT.reactors[0]!.name}, ${CHAT.reactors[1]!.name} and ${CHAT.reactors.length - 2} others are typing…`;
        for (const r of this.reacts) {
          await this.wait(0.32);
          r.setAttribute('data-in', '');
        }
        await this.wait(2.6);
        break;
      case 'flood':
        this._phase = 'flood';
        this.typing.textContent = '';
        this.chat.setAttribute('data-shrink', '');
        // The warmth eases in with the gold (slower with Reduce flashes).
        this.ctx.post.set(FLOOD_FROM);
        this.ctx.post.blendTo(this.calm ? FLOOD_LOOK_CALM : FLOOD_LOOK, this.calm ? 5 : 3);
        this.ctx.sound.sfx.play('endingSwell');
        this.screen.set(0, 2.2, t + 0.5);
        // Reduce flashes: the gold rises slowly instead of blooming at once.
        this.flood.set(1, this.calm ? 6 : 4, t + 0.3);
        this.ign.set(1, this.calm ? 2.5 : 0.5, t);
        await this.wait(2.4);
        break;
    }
  }

  /** Type a chat line into the open message, slowly. Reduced motion: whole lines. */
  private async type(text: string, g: number): Promise<void> {
    if (g !== this.gen) return;
    const p = h('p', { class: 'lr-chat-line' });
    this.chatText.append(p);
    p.append(this.caret);
    if (this.ctx.settings.reducedMotion) {
      p.prepend(text);
      await this.wait(0.6);
      return;
    }
    this.typingLine = { el: p, text, shown: 0, cps: 11 };
    while (this.typingLine && g === this.gen) await this.wait(0.1);
  }

  /** Title card, safety record, credits, then the end card. */
  private async endScreen(g: number): Promise<void> {
    if (g !== this.gen) return;
    this._phase = 'credits';
    this.chat.hidden = true;
    this.titleEl.setAttribute('data-in', '');
    await this.wait(2.6);
    this.safetyEl.setAttribute('data-in', '');
    await this.wait(2.8);
    this.creditsEl.setAttribute('data-in', '');
    const items = Array.from(this.creditsEl.children) as HTMLElement[];
    for (const el of items) {
      if (g !== this.gen) return;
      el.setAttribute('data-in', '');
      await this.wait(2.6);
      el.setAttribute('data-out', '');
      await this.wait(0.9);
      el.hidden = true;
    }
    if (g !== this.gen) return;
    this.showEndCard();
  }

  private showEndCard(): void {
    this._phase = 'end-card';
    this.creditsEl.hidden = true;
    this.titleEl.setAttribute('data-in', '');
    this.safetyEl.setAttribute('data-in', '');
    this.cardEl.hidden = false;
    this.cardEl.setAttribute('data-in', '');
    if (this.skipBtn) this.skipBtn.hidden = true;
    const back = this.cardEl.querySelector<HTMLButtonElement>('.lr-end-back');
    back?.focus({ preventScroll: true });
    this.idleFrom = this.time;
  }

  /** Skip straight to the end card (replays only). */
  skip(): void {
    if (!this.skippable || this._phase === 'end-card' || this._phase === 'post-credits') return;
    this.gen++;
    this.flushWaits();
    this.ctx.fuse.hush();
    this.typingLine = null;
    this.ctx.post.finishBlend();
    this.ctx.post.set(this.calm ? FLOOD_LOOK_CALM : FLOOD_LOOK);
    // The world as the ending leaves it: rune lit, door shut, FUSE gone, clipboard on the floor.
    this.dusk.snap(1);
    this.ign.snap(1);
    this.storm.snap(0);
    this.pull.snap(1);
    this.aperture.snap(0.08);
    this.door.snap(0);
    this.approach.snap(0);
    this.fuseFade.snap(0);
    this.screen.snap(0);
    this.flood.snap(1);
    this.fuse.clipboard = false;
    this.clipT = 99;
    this.clipFromX = ENDING_LAYOUT.clip.x;
    this.clipFromY = ENDING_LAYOUT.clip.y - 120;
    this.chat.hidden = true;
    this.showEndCard();
  }

  // ── Frame ────────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.time += dt;
    const now = this.time;
    if (this.waits.length) {
      // Resolve due waits without allocating: compact in place.
      let j = 0;
      const w = this.waits;
      for (let i = 0; i < w.length; i++) {
        const x = w[i]!;
        if (x.until <= now) x.resolve();
        else w[j++] = x;
      }
      w.length = j;
    }
    if (this.skippable && this.ctx.input.pressed('cancel') && !this.ctx.ui.stack.hasModal)
      this.skip();

    for (const tw of this.tweenList) tw.tick(now);

    // Typing.
    const tl = this.typingLine;
    if (tl) {
      const before = Math.floor(tl.shown);
      tl.shown += dt * tl.cps * (tl.text[before] === ' ' ? 1.6 : 1);
      const n = Math.min(tl.text.length, Math.floor(tl.shown));
      if (n !== before) {
        // One text node, grown in place.
        const node = tl.el.firstChild;
        if (node && node.nodeType === 3) (node as Text).data = tl.text.slice(0, n);
        else tl.el.prepend(tl.text.slice(0, n));
      }
      if (n >= tl.text.length) this.typingLine = null;
    }

    // FUSE through the door: he recedes toward the door's foot.
    const f = this.fuse;
    const L = ENDING_LAYOUT;
    const d = this.fuseDepth.v;
    f.scale = L.fuse.scale * (1 - 0.42 * d);
    f.y = L.fuse.y + (L.door.base + 30 - L.fuse.y) * d;
    f.opacity = this.fuseFade.v;
    f.update(dt);
    if (this.clipT >= 0) this.clipT += dt;

    // Post-credits: thirty seconds of nobody touching anything.
    if (
      this._phase === 'end-card' &&
      !this.noteShown &&
      this.idleFrom >= 0 &&
      now - this.idleFrom >= this.postSeconds
    ) {
      this.showNote();
    }
    this.viewFrame = this.frameState();
    this.view.update(dt, this.viewFrame);
  }

  private readonly tweenList: Tween[] = [
    this.dusk,
    this.ign,
    this.storm,
    this.pull,
    this.aperture,
    this.door,
    this.doorBright,
    this.approach,
    this.fuseFade,
    this.fuseDepth,
    this.screen,
    this.screenDark,
    this.flood,
  ];

  private frameState(): HallViewFrame {
    const vf = this.viewFrame as { time: number };
    vf.time = this.time;
    return this.viewFrame;
  }

  /** Settings → Reduce flashes: softer white-out, door and flood; no spark twinkle. */
  private get calm(): boolean {
    return this.ctx.settings.reduceFlashes;
  }

  render(frame: Frame): void {
    const vf = this.viewFrame;
    this.view.render(frame, vf);
    const reduced = this.ctx.settings.reducedMotion;
    const t = this.time;
    const C = RUNE_CENTRE;
    const R = ENDING_LAYOUT.rune.r;
    const grow = reduced ? 1 : 1 + this.approach.v * 0.1;

    // Dusk: the hall cools and dims around the rune.
    if (this.dusk.v > 0.001) this.wash(frame, 0.01, 0.018, 0.045, 0.62 * this.dusk.v, 4000, 10, 0);

    // The storm funnelling into the rune.
    if (this.storm.v > 0.002) {
      this.quad(this.matAdd, frame, C.x, C.y, 1920, 1080, ENDING_MODE.funnel);
      // Reduce flashes freezes the funnel's twinkling sparks too.
      this.setParams(this.storm.v, reduced || this.calm ? 4.0 : t, this.pull.v);
      this.dp.emissive = 1;
      frame.sprite(this.matAdd, this.dp);
    }

    // The rune: a room-sized gold disc, and the light pooling around it.
    const ign = this.ign.v;
    this.desk.glow(frame, C.x, C.y, R * 3.6 * grow, R * 2.6 * grow, 1.0, 0.62, 0.22, 0.12 * ign);
    this.quad(this.matPre, frame, C.x, C.y, R * 2 * grow, R * 2 * grow, ENDING_MODE.disc);
    this.setParams(ign, reduced ? 0 : t, this.aperture.v);
    this.dp.emissive = 1;
    frame.sprite(this.matPre, this.dp);

    // The door it always was.
    if (this.door.v > 0.002) {
      const D = ENDING_LAYOUT.door;
      const dw = D.w * grow;
      const dh = D.h * grow;
      const base = C.y + (D.base - C.y) * grow;
      this.quad(this.matAdd, frame, C.x, base - dh * 0.5, dw, dh, ENDING_MODE.door);
      this.setParams(this.door.v, reduced ? 0 : t, this.doorBright.v);
      this.dp.emissive = 1;
      frame.sprite(this.matAdd, this.dp);
    }

    // FUSE, lit by the rune and the storm.
    const f = this.fuse;
    const Lr = this.lights.begin(0.1 + 0.05 * (1 - this.dusk.v), 0.11, 0.16);
    Lr.add(C.x, C.y, 1500, GOLD, 0.4 + 1.6 * ign + 0.8 * this.flood.v, 260);
    if (this.door.v > 0.01) {
      Lr.add(C.x, ENDING_LAYOUT.door.base - 220, 1100, WARM_WHITE, 1.0 * this.door.v, 200);
    }
    Lr.add(C.x, 120, 1400, STORM, 0.5 * this.storm.v, 300);
    Lr.add(f.eye.x, f.eye.y, 420, f.eye.color, f.eye.intensity, 40);
    if (f.opacity > 0.003) f.draw(frame, Lr);

    // Gold floods the hall.
    if (this.flood.v > 0.001) {
      const r = 60 + this.flood.v * 2300;
      // The re-dressed hall is brighter than the one this was tuned on: keep the
      // gold under the card, and lower still with Reduce flashes.
      const calm = this.calm;
      this.wash(frame, 0.62, 0.38, 0.12, calm ? 0.28 : 0.34, r, 520, calm ? 0.1 : 0.14);
      this.desk.glow(
        frame,
        C.x,
        C.y,
        1500 * this.flood.v,
        1100 * this.flood.v,
        1.0,
        0.7,
        0.3,
        calm ? 0.09 : 0.12,
      );
    }

    // The clipboard: falls from his clamp, lands, stays.
    if (this.clipT >= 0) this.drawClipboard(frame);

    // White-out, then the chat's dark.
    const s = this.screen.v;
    if (s > 0.001) {
      const k = this.screenDark.v;
      const r = WARM_WHITE[0] + (CHAT_DARK[0] - WARM_WHITE[0]) * k;
      const g = WARM_WHITE[1] + (CHAT_DARK[1] - WARM_WHITE[1]) * k;
      const b = WARM_WHITE[2] + (CHAT_DARK[2] - WARM_WHITE[2]) * k;
      const w = this.calm ? 0.72 + 0.28 * k : 1;
      this.wash(frame, r * w, g * w, b * w, s, 4000, 10, (1 - k) * (this.calm ? 0.25 : 0.6));
    }
  }

  private drawClipboard(frame: Frame): void {
    const C = ENDING_LAYOUT.clip;
    const T = 0.42; // fall time
    const k = Math.min(1, this.clipT / T);
    // Falls (gravity), turns, then a small settle bounce.
    const fall = k * k;
    const x = this.clipFromX + (C.x - this.clipFromX) * k;
    let y = this.clipFromY + (C.y - this.clipFromY) * fall;
    const after = this.clipT - T;
    if (after > 0 && after < 0.3) y -= Math.sin((after / 0.3) * Math.PI) * 10;
    const scaleK = 0.42 + 0.58 * k; // from his clamp size to lying in the foreground
    const rot = 0.14 + (C.rot - 0.14) * Math.min(1, k * 1.1);
    const ign = this.ign.v;
    this.desk.extraLight.x = RUNE_CENTRE.x;
    this.desk.extraLight.y = RUNE_CENTRE.y;
    this.desk.extraLight.radius = 1500;
    this.desk.extraLight.r = 1.0;
    this.desk.extraLight.g = 0.72;
    this.desk.extraLight.b = 0.36;
    this.desk.extraLight.intensity = 0.6 + 1.0 * ign + 0.6 * this.flood.v;
    this.desk.extraLight.height = 500;
    this.desk.beginLights(this.time, 2.6);
    if (k >= 1) this.desk.shadow(frame, x + 8, y + 10, C.w, C.h, 16, 0.5, rot);
    this.desk.prop(frame, PROP.clipboard, x, y, C.w * scaleK, C.h * scaleK, rot, 5.0);
  }

  // ── Draw helpers (one DrawParams, reused) ───────────────────────────────

  private quad(
    _mat: Material,
    _frame: Frame,
    x: number,
    y: number,
    w: number,
    h: number,
    mode: number,
  ): void {
    const dp = this.dp;
    dp.x = x;
    dp.y = y;
    dp.w = w;
    dp.h = h;
    dp.rotation = 0;
    const tint = dp.tint as number[];
    tint[0] = 1;
    tint[1] = 1;
    tint[2] = 1;
    tint[3] = 1;
    (dp.params as number[])[0] = mode;
  }

  private setParams(y: number, z: number, w: number): void {
    const p = this.dp.params as number[];
    p[1] = y;
    p[2] = z;
    p[3] = w;
  }

  /** Full-screen radial wash from the hall centre (premultiplied). */
  private wash(
    frame: Frame,
    r: number,
    g: number,
    b: number,
    a: number,
    radius: number,
    soft: number,
    emissive: number,
  ): void {
    this.quad(this.matPre, frame, 960, 540, 1920, 1080, ENDING_MODE.wash);
    const tint = this.dp.tint as number[];
    tint[0] = r;
    tint[1] = g;
    tint[2] = b;
    tint[3] = a;
    this.setParams(radius, soft, 0);
    this.dp.emissive = emissive;
    frame.sprite(this.matPre, this.dp);
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  private buildDom(doc: Document): void {
    void doc;
    // Chat mock.
    this.caret = h('span', { class: 'lr-chat-caret', 'aria-hidden': 'true' });
    this.chatText = h('div', { class: 'lr-chat-text', 'aria-live': 'polite' });
    this.reacts = CHAT.reactors.map((r) =>
      h('span', null, h('i', { style: { background: `hsl(${r.hue} 55% 55%)` } }), r.name),
    );
    this.typing = h('div', { class: 'lr-chat-typing' });
    const servers = h(
      'div',
      { class: 'lr-chat-servers', 'aria-hidden': 'true' },
      h('i'),
      h('i', { dataset: { on: '' } }),
      h('i'),
      h('i'),
    );
    const side = h(
      'div',
      { class: 'lr-chat-side' },
      h('h3', null, CHAT.server),
      ...CHAT.channels.map((c) => h('p', c === CHAT.channel ? { dataset: { on: '' } } : null, c)),
    );
    const msg = h(
      'div',
      { class: 'lr-chat-msg' },
      h('div', { class: 'lr-chat-av', 'aria-hidden': 'true' }),
      h('div', null, h('b', null, 'FUSE'), h('small', null, 'today'), this.chatText),
    );
    this.chat = h(
      'div',
      { class: 'lr-chat', role: 'img', 'aria-label': `A chat window, channel ${CHAT.channel}` },
      servers,
      side,
      h(
        'div',
        { class: 'lr-chat-main' },
        h('div', { class: 'lr-chat-top' }, CHAT.channel),
        h(
          'div',
          { class: 'lr-chat-log' },
          msg,
          h('div', { class: 'lr-chat-react' }, ...this.reacts),
          this.typing,
        ),
        h('div', { class: 'lr-chat-input' }, `Message ${CHAT.channel}`),
      ),
    );

    // Title card, safety record, credits.
    this.titleEl = h(
      'div',
      { class: 'lr-end-title', role: 'heading', 'aria-level': '1' },
      ...this.card.title.map((l) => h('h2', null, l)),
    );
    this.safetyEl = h(
      'div',
      { class: 'lr-end-safety' },
      h('small', null, 'Safety record'),
      this.card.safety,
    );
    this.creditsEl = h(
      'div',
      { class: 'lr-end-credits' },
      ...CREDITS.map(([role, who]) => h('div', null, h('small', null, role), h('span', null, who))),
    );

    // End card: the Discord link opens only on the player's click.
    const row = h('div', { class: 'lr-end-row' });
    for (const b of this.card.buttons) {
      row.append(
        h(
          'a',
          {
            class: b.id === 'join' ? 'lr-end-join' : 'lr-end-tip',
            href: b.href,
            target: '_blank',
            rel: 'noopener noreferrer',
            dataset: { action: `ending-${b.id}` },
          },
          b.label,
        ),
      );
    }
    const back = h(
      'button',
      {
        type: 'button',
        class: 'lr-stone-button lr-end-back',
        on: {
          click: () => {
            this.ctx.sfx('ui.click');
            this.ctx.flow.finishEnding();
          },
        },
      },
      'Back to the hall',
    );
    back.dataset.action = 'ending-back';
    this.cardEl = h(
      'div',
      { class: 'lr-end-card' },
      row,
      h('p', { class: 'lr-end-footer' }, this.card.footer),
      back,
    );
    this.cardEl.hidden = true;

    // Post-credits: the clipboard's top sheet flips to a new page.
    const C = ENDING_LAYOUT.clip;
    const nw = Math.round(C.w * 0.8);
    const nh = Math.round(C.h * 0.74);
    this.noteEl = h(
      'div',
      {
        class: 'lr-clip-note',
        'aria-live': 'polite',
        style: {
          left: `${Math.round(C.x - nw / 2)}px`,
          top: `${Math.round(C.y - nh / 2 + C.h * 0.08)}px`,
          width: `${nw}px`,
          height: `${nh}px`,
          transform: `rotate(${C.rot}rad)`,
        },
      },
      h('p', { class: 'lr-clip-day' }, this.postLine?.text ?? ''),
      h('p', { class: 'lr-clip-form', 'aria-hidden': 'true' }),
    );
    this.noteEl.hidden = true;

    const parts: HTMLElement[] = [
      this.chat,
      this.titleEl,
      this.safetyEl,
      this.creditsEl,
      this.cardEl,
      this.noteEl,
    ];
    if (this.skippable) {
      this.skipBtn = h(
        'button',
        {
          type: 'button',
          class: 'lr-stone-button lr-end-skip',
          on: { click: () => this.skip() },
        },
        'Skip',
        h('kbd', { 'aria-hidden': 'true' }, 'Esc'),
      );
      this.skipBtn.dataset.action = 'ending-skip';
      parts.push(this.skipBtn);
    }
    this.root = h('section', { class: 'lr-ending', 'aria-label': 'Ending' }, ...parts);
    this.ctx.ui.layers.hud.append(this.root);
  }

  private showNote(): void {
    this.noteShown = true;
    this._phase = 'post-credits';
    this.noteEl.hidden = false;
    // Next frame, so the fade-in transition runs.
    requestAnimationFrame(() => {
      this.noteEl.setAttribute('data-in', '');
      void this.wait(1.0).then(() => this.noteEl.setAttribute('data-flip', ''));
      this.ctx.sfx('ui.page');
    });
  }
}
