/**
 * Gold embossed text and plates (title, buttons, badges, chapter marks).
 *
 *   const emboss = new EmbossRenderer(renderer);
 *   const title = new EmbossLabel(renderer, { text: 'The Last Rune', font: '700 150px Georgia', width: 1300, height: 240 });
 *   // per frame
 *   emboss.light(lights);
 *   emboss.draw(frame, title, 960, 250);
 *
 * Labels are baked once (canvas → mask texture); change text with `label.setText()` (re-bakes,
 * not per frame). Text that must be read by assistive tech stays in the DOM (D-009): use this
 * for decorative/hero lettering and mirror it with an accessible DOM label.
 */
import type {
  DrawParams,
  Frame,
  Material,
  Renderer,
  RGBA,
  Texture,
} from '@thunderclap-engine/engine/render';
import { EMBOSS_WGSL } from '../../shaders/emboss-wgsl';
import { LIGHT_SET_FLOATS, type LightSet } from './lights';
import { LINEAR } from './palette';

export interface EmbossLabelOptions {
  text: string;
  /** CSS font at logical size, e.g. '700 64px Georgia, serif'. */
  font: string;
  /** Logical size of the label quad. */
  width: number;
  height: number;
  /** Draw a bevelled enamel plate behind the text. */
  plate?: boolean;
  /** Plate corner radius (px). Default height × 0.3. */
  radius?: number;
  /** Letter spacing in px (Canvas letterSpacing where supported). */
  tracking?: number;
  /** Texture resolution multiplier (default 2 for crisp edges on high-DPI). */
  scale?: number;
}

/** A baked text/plate mask with its own material binding. */
export class EmbossLabel {
  readonly material: Material;
  texture: Texture;
  readonly width: number;
  readonly height: number;
  private readonly opts: EmbossLabelOptions;

  constructor(
    private readonly renderer: Renderer,
    opts: EmbossLabelOptions,
  ) {
    this.opts = { ...opts };
    this.width = opts.width;
    this.height = opts.height;
    this.material = renderer.createMaterial({
      label: 'emboss',
      wgsl: EMBOSS_WGSL,
      blend: 'alpha',
      uniformBytes: LIGHT_SET_FLOATS * 4,
      textures: 1,
      sampler: 'linear-clamp',
    });
    this.texture = this.bake();
    this.material.setTexture(0, this.texture);
  }

  setText(text: string): void {
    if (text === this.opts.text) return;
    this.opts.text = text;
    const old = this.texture;
    this.texture = this.bake();
    this.material.setTexture(0, this.texture);
    old.destroy();
  }

  private bake(): Texture {
    const o = this.opts;
    const s = o.scale ?? 2;
    const w = Math.ceil(o.width * s);
    const h = Math.ceil(o.height * s);
    const text = layer(w, h, (g) => {
      g.scale(s, s);
      g.font = o.font;
      if (o.tracking !== undefined && 'letterSpacing' in g) {
        (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
          `${o.tracking}px`;
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#fff';
      g.fillText(o.text, o.width / 2, o.height / 2 + 2);
    });
    const plate = o.plate
      ? layer(w, h, (g) => {
          g.scale(s, s);
          const inset = 8;
          const r = o.radius ?? o.height * 0.3;
          g.fillStyle = '#fff';
          g.beginPath();
          g.roundRect(inset, inset, o.width - inset * 2, o.height - inset * 2, r);
          g.fill();
        })
      : null;
    const textBlur = blurred(text, 3 * s);
    const plateBlur = plate ? blurred(plate, 6 * s) : null;
    const shadow = layer(w, h, (g) => {
      g.filter = `blur(${7 * s}px)`;
      g.drawImage(plate ?? text, 0, 5 * s);
    });
    const R = pixels(text);
    const G = pixels(textBlur);
    const B = pixels(shadow);
    const A = plateBlur ? pixels(plateBlur) : null;
    const out = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const j = i * 4 + 3; // canvases are white-on-transparent: use their alpha
      out[i * 4] = R[j]!;
      out[i * 4 + 1] = G[j]!;
      out[i * 4 + 2] = B[j]!;
      out[i * 4 + 3] = A ? A[j]! : 0;
    }
    // Mask data, not colour: linear rgba8unorm, so the shader reads the bytes as written.
    return this.renderer.textureFromPixels({
      width: w,
      height: h,
      data: out,
      label: 'emboss-mask',
    });
  }

  destroy(): void {
    this.material.destroy();
    this.texture.destroy();
  }
}

function layer(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('emboss: 2D canvas unavailable');
  draw(g);
  return c;
}

function blurred(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  return layer(src.width, src.height, (g) => {
    g.filter = `blur(${px}px)`;
    g.drawImage(src, 0, 0);
  });
}

function pixels(c: HTMLCanvasElement): Uint8ClampedArray {
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('emboss: 2D canvas unavailable');
  return g.getImageData(0, 0, c.width, c.height).data;
}

export interface EmbossDrawOptions {
  /** Gold colour (linear). Default palette gold. */
  color?: Readonly<RGBA>;
  /** Overall opacity. */
  alpha?: number;
  /** Specular strength multiplier. */
  shine?: number;
  /** Bloom glint multiplier (0 for none). */
  glow?: number;
  /** Scale relative to the label's logical size. */
  scale?: number;
}

const GOLD_TINT: RGBA = [LINEAR.gold[0], LINEAR.gold[1], LINEAR.gold[2], 1];

export class EmbossRenderer {
  private readonly dp: DrawParams = { x: 0, y: 0, params: [1, 1, 0.25, 0] };
  private readonly tint: RGBA = [1, 1, 1, 1];
  private lights: LightSet | null = null;

  /** Remember this frame's lights; they are uploaded to each label as it is drawn. */
  light(lights: LightSet): void {
    this.lights = lights;
  }

  draw(frame: Frame, label: EmbossLabel, x: number, y: number, opts?: EmbossDrawOptions): void {
    if (this.lights) this.lights.apply(label.material);
    const c = opts?.color ?? GOLD_TINT;
    const tint = this.tint;
    tint[0] = c[0];
    tint[1] = c[1];
    tint[2] = c[2];
    tint[3] = opts?.alpha ?? 1;
    const k = opts?.scale ?? 1;
    const dp = this.dp;
    const p = dp.params as number[];
    p[0] = opts?.shine ?? 1;
    dp.x = x;
    dp.y = y;
    dp.w = label.width * k;
    dp.h = label.height * k;
    dp.tint = tint;
    dp.emissive = opts?.glow ?? 1;
    frame.sprite(label.material, dp);
    dp.emissive = 0;
  }
}
