/**
 * Social card stage (D-050; from the itch cover tooling, D-043 add. 1): an offscreen engine
 * renderer drawing a game scene at twice the share-image size, framed by the camera, with the
 * game's embossed gold title on top. A capture hands back a bitmap that the page scales into the
 * 1200×630 canvas (the Open Graph / Discord / X large-image size, 1.91:1).
 *
 * A card works in "world" px (the game's 1920×1080 design space, so the game's views and props
 * draw where they always do) and picks what the frame shows with `shot`.
 */
import { ParticleSystem } from '@thunderclap/engine/fx';
import { type PostSettingsPatch, PostStack } from '@thunderclap/engine/post';
import {
  type Camera,
  type DrawParams,
  type Frame,
  type Material,
  type Renderer,
  SnapshotRenderer,
} from '@thunderclap/engine/render';
import { EmbossLabel, EmbossRenderer } from '../art/materials/emboss';
import { LightSet } from '../art/materials/lights';
import { pitch } from '../art/props/palette';

/** The share-image size (og:image), and the factor we render above it (downscaled for clean edges). */
export const COVER_W = 1200;
export const COVER_H = 630;
export const SUPERSAMPLE = 2;
/** The renderer's logical (and pixel) size: screen px of the supersampled cover. */
export const RW = COVER_W * SUPERSAMPLE;
export const RH = COVER_H * SUPERSAMPLE;

/** What the frame shows, in world px: its centre and width (height follows COVER_W:COVER_H). */
export interface Shot {
  cx: number;
  cy: number;
  width: number;
}

/** Where the title sits, in card px (COVER_W×COVER_H): its centre and the width of the word mark. */
export interface TitlePlace {
  x: number;
  y: number;
  width: number;
  /** Specular shine (default 1.2) and bloom glint (default 0.6), as on the title screen. */
  shine?: number;
  glow?: number;
  /** Dark halo behind the letters (0..1, default 0.6), so they hold over a busy picture. */
  halo?: number;
}

export interface CoverContext {
  readonly renderer: Renderer;
  readonly particles: ParticleSystem;
}

export interface CoverDef {
  readonly id: string;
  /** One-line idea, shown under the cover. */
  readonly pitch: string;
  /** Post-stack settings (the game's presets, tuned per cover). */
  readonly post: PostSettingsPatch;
  /** What the frame shows (a scene may override it with its own `shot`). */
  readonly shot?: Shot;
  /** The word mark; leave out when the scene draws its own (the title wall). */
  readonly title?: TitlePlace;
  /** Optional tagline (at most three words), cover px. */
  readonly tagline?: { text: string; x: number; y: number; size?: number };
  /** Seconds to run before the first frame, so bolts have landed and lights settled. */
  readonly warmup?: number;
  /** Build the scene on this cover's renderer. */
  create(ctx: CoverContext): CoverScene;
}

export interface CoverScene {
  /** A frame worked out from the scene's own layout (wins over the cover's `shot`). */
  readonly shot?: Shot;
  update(dt: number): void;
  /** Draw in world px. The stage sets the camera after this returns. */
  draw(frame: Frame): void;
}

/** Word mark: "The Last Rune" in the title screen's embossed gold, measured once. */
const TITLE_FONT = "700 150px 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const TITLE_LABEL = { width: 1400, height: 230, tracking: 6 } as const;
let measuredTitleWidth = 0;

function titleInkWidth(): number {
  if (measuredTitleWidth > 0) return measuredTitleWidth;
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return 1060;
  c.font = TITLE_FONT;
  if ('letterSpacing' in c) (c as { letterSpacing: string }).letterSpacing = '6px';
  measuredTitleWidth = c.measureText('The Last Rune').width;
  return measuredTitleWidth;
}

const GOLD = pitch('gold');

/** The word mark, a soft dark halo under it, and the light that rakes its bevel. */
class TitleMark {
  private readonly label: EmbossLabel;
  private readonly emboss = new EmbossRenderer();
  private readonly lights = new LightSet();
  private readonly halo: Material;
  private readonly haloDp: DrawParams = { x: 0, y: 0, tint: [0, 0, 0, 1] };

  constructor(r: Renderer) {
    this.label = new EmbossLabel(r, {
      text: 'The Last Rune',
      font: TITLE_FONT,
      width: TITLE_LABEL.width,
      height: TITLE_LABEL.height,
      tracking: TITLE_LABEL.tracking,
    });
    this.halo = r.createSpriteMaterial(r.textureFromSource(haloCanvas(), 'cover-halo'), 'halo', {
      blend: 'alpha',
    });
  }

  draw(frame: Frame, cam: Camera, t: TitlePlace): void {
    // Cover px → screen px (renderer) → world px.
    const sx = t.x * SUPERSAMPLE;
    const sy = t.y * SUPERSAMPLE;
    const wx = cam.x + RW / 2 + (sx - RW / 2) / cam.zoom;
    const wy = cam.y + RH / 2 + (sy - RH / 2) / cam.zoom;
    const scale = (t.width * SUPERSAMPLE) / titleInkWidth() / cam.zoom;
    const halo = t.halo ?? 0.6;
    if (halo > 0) {
      const d = this.haloDp;
      d.x = wx;
      d.y = wy + 6 * scale;
      d.w = titleInkWidth() * 1.35 * scale;
      d.h = TITLE_LABEL.height * 1.25 * scale;
      (d.tint as number[])[3] = halo;
      frame.sprite(this.halo, d);
    }
    const L = this.lights;
    L.begin(0.06, 0.06, 0.08, 0, 1);
    L.add(wx, wy + 200 * scale, 1100 * scale, GOLD, 0.7, 260 * scale);
    L.add(wx - 500 * scale, wy - 260 * scale, 900 * scale, [1, 0.92, 0.8], 0.35, 300 * scale);
    this.emboss.light(L);
    this.emboss.draw(frame, this.label, wx, wy, {
      shine: t.shine ?? 1.2,
      glow: t.glow ?? 0.6,
      scale,
    });
  }
}

function haloCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  if (!g) return c;
  g.translate(128, 64);
  g.scale(2, 1);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.7)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(-64, -64, 128, 128);
  return c;
}

/** One cover: its renderer, scene and clock. */
export class CoverStage {
  readonly snap: SnapshotRenderer;
  readonly ctx: CoverContext;
  private readonly scene: CoverScene;
  private readonly title: TitleMark;
  time = 0;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    readonly def: CoverDef,
  ) {
    this.snap = new SnapshotRenderer(device, format, { width: RW, height: RH });
    const r = this.snap.renderer;
    const post = new PostStack(r);
    post.set(def.post);
    r.post = post;
    const particles = new ParticleSystem(r, { capacity: 8192, floorY: 1060 });
    this.ctx = { renderer: r, particles };
    this.scene = def.create(this.ctx);
    this.title = new TitleMark(r);
    const warm = def.warmup ?? 2;
    for (let t = 0; t < warm; t += 1 / 30) this.update(1 / 30);
  }

  update(dt: number): void {
    this.time += dt;
    this.scene.update(dt);
    this.ctx.particles.update(dt);
  }

  /** Draw one frame and return it (RW×RH). */
  capture(): ImageBitmap {
    const r = this.snap.renderer;
    return this.snap.capture((frame) => {
      this.scene.draw(frame);
      const s = this.scene.shot ?? this.def.shot ?? { cx: 960, cy: 540, width: 1360 };
      const cam = r.camera;
      cam.zoom = RW / s.width;
      cam.x = s.cx - RW / 2;
      cam.y = s.cy - RH / 2;
      cam.rotation = 0;
      if (this.def.title) this.title.draw(frame, cam, this.def.title);
    }, this.time);
  }
}

/** Paint a captured frame into a card canvas (COVER_W×COVER_H) plus the optional tagline. */
export function paintCover(g: CanvasRenderingContext2D, bmp: ImageBitmap, def: CoverDef): void {
  const w = g.canvas.width;
  const h = g.canvas.height;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, w, h);
  const tag = def.tagline;
  if (!tag) return;
  const k = w / COVER_W;
  const size = (tag.size ?? 17) * k;
  g.save();
  g.font = `600 ${size}px 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif`;
  if ('letterSpacing' in g) (g as { letterSpacing: string }).letterSpacing = `${size * 0.42}px`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.95)';
  g.shadowBlur = 8 * k;
  g.fillStyle = '#e4d8f4';
  // letterSpacing adds trailing space after the last glyph: nudge right by half of it.
  g.fillText(tag.text.toUpperCase(), tag.x * k + size * 0.21, tag.y * k);
  g.restore();
}
