/**
 * Stone surfaces: rough-hewn wall, flagstone floor, and the carved altar slab with sockets.
 * Each surface bakes its albedo + normal/height/AO once (GPU, at creation) and is lit every
 * frame by the scene's LightSet. Draw cost: one textured quad.
 */
import type { DrawParams, Frame, Material, Renderer, RGBA, Texture } from '@engine/render';
import {
  LIT_SURFACE_WGSL,
  SOCKET_WGSL,
  SOLID_BITS,
  STONE_ALBEDO_WGSL,
  STONE_GEN_FLOATS,
  STONE_MODE,
  STONE_NORMAL_WGSL,
} from '../../shaders/stone-wgsl';
import { LIGHT_SET_FLOATS, type LightSet } from './lights';

/** A baked, lit stone quad. */
export class StoneSurface {
  readonly material: Material;
  private readonly dp: DrawParams = { x: 0, y: 0, params: [1, 0, 0, 0] };

  constructor(
    renderer: Renderer,
    readonly albedo: Texture,
    readonly normal: Texture,
    readonly width: number,
    readonly height: number,
    label: string,
  ) {
    this.material = renderer.createMaterial({
      label,
      wgsl: LIT_SURFACE_WGSL,
      blend: 'alpha',
      uniformBytes: LIGHT_SET_FLOATS * 4,
      textures: 2,
      sampler: 'linear-clamp',
    });
    this.material.setTexture(0, albedo);
    this.material.setTexture(1, normal);
  }

  /** Upload this frame's lights. Call once per frame before drawing. */
  light(lights: LightSet): void {
    lights.apply(this.material);
  }

  /**
   * Draw centred at (x, y), at baked size unless w/h are given. `tint` multiplies albedo,
   * `normalStrength` scales relief, `specular` adds wet sheen (default 0.08).
   */
  draw(
    frame: Frame,
    x: number,
    y: number,
    w = this.width,
    h = this.height,
    tint?: ArrayLike<number>,
    normalStrength = 1,
    specular = 0.08,
  ): void {
    const dp = this.dp;
    dp.x = x;
    dp.y = y;
    dp.w = w;
    dp.h = h;
    dp.tint = tint;
    const p = dp.params as number[];
    p[0] = normalStrength;
    p[1] = specular;
    frame.sprite(this.material, dp);
  }

  destroy(): void {
    this.material.destroy();
    this.albedo.destroy();
    this.normal.destroy();
  }
}

function bake(
  renderer: Renderer,
  label: string,
  width: number,
  height: number,
  uniforms: Float32Array<ArrayBuffer>,
): { albedo: Texture; normal: Texture } {
  const albedo = renderer.textureFromShader({
    width,
    height,
    wgsl: STONE_ALBEDO_WGSL,
    uniforms,
    label: `${label}-albedo`,
  });
  const normal = renderer.textureFromShader({
    width,
    height,
    wgsl: STONE_NORMAL_WGSL,
    uniforms,
    label: `${label}-normal`,
    format: 'rgba8unorm',
  });
  return { albedo, normal };
}

export interface StoneOptions {
  width?: number;
  height?: number;
  seed?: number;
}

/** Rough-hewn block wall: grain, chipped edges, tool marks, moss low down. */
export function createStoneWall(renderer: Renderer, opts: StoneOptions = {}): StoneSurface {
  const w = opts.width ?? 1920;
  const h = opts.height ?? 1080;
  const u = new Float32Array(STONE_GEN_FLOATS);
  u.set([w, h, opts.seed ?? 1, STONE_MODE.wall]);
  const t = bake(renderer, 'stone-wall', w, h, u);
  return new StoneSurface(renderer, t.albedo, t.normal, w, h, 'stone-wall');
}

/** Flagstone floor in perspective (far edge at the top of the texture). */
export function createStoneFloor(renderer: Renderer, opts: StoneOptions = {}): StoneSurface {
  const w = opts.width ?? 1920;
  const h = opts.height ?? 320;
  const u = new Float32Array(STONE_GEN_FLOATS);
  u.set([w, h, opts.seed ?? 2, STONE_MODE.floor]);
  const t = bake(renderer, 'stone-floor', w, h, u);
  return new StoneSurface(renderer, t.albedo, t.normal, w, h, 'stone-floor');
}

/**
 * `rim` and `plate` are the phone looks (mobile-3-board): a faint pale lip on an open socket,
 * and a blocked socket as a plain recessed plate (no carved X). `collar` is a fixed gem's
 * bolted iron ring (mobile-4-board).
 */
export type SocketState =
  | 'empty'
  | 'blocked'
  | 'highlighted'
  | 'wanted'
  | 'rim'
  | 'plate'
  | 'collar';

const SOCKET_STATE_ID: Record<SocketState, number> = {
  empty: 0,
  blocked: 1,
  highlighted: 2,
  wanted: 3,
  rim: 4,
  plate: 5,
  collar: 6,
};

/**
 * The altar bake's solid-cell mask: bit (y·cols + x) set for every cell carved with no socket,
 * 24 cells per float (4 floats hold a 10×8 board). Pure, for tests.
 */
export function solidMask(
  cols: number,
  cells: readonly { x: number; y: number }[],
): [number, number, number, number] {
  const m: [number, number, number, number] = [0, 0, 0, 0];
  for (const c of cells) {
    const i = c.y * cols + c.x;
    const w = Math.floor(i / SOLID_BITS);
    if (w < 4) m[w] = m[w]! + 2 ** (i % SOLID_BITS);
  }
  return m;
}

export interface AltarOptions {
  cols: number;
  rows: number;
  /** Socket spacing in px. Default 118. */
  pitch?: number;
  /** Border around the socket grid in px. Default 0.8 × pitch. */
  margin?: number;
  /** Height of the front face in px. Default 0.42 × pitch. */
  front?: number;
  seed?: number;
  /** Cells carved solid, with no socket at all (phones: blocked cells, mobile-4-board). */
  solid?: readonly { x: number; y: number }[];
}

/**
 * The carved altar: one slab with chipped bevelled edges, a carved border groove with rune
 * ticks, and round carved sockets (baked). Socket states other than empty are drawn as
 * overlays with `drawSocket`.
 *
 * Geometry is in logical px at 1:1. `x, y` passed to `draw` are the centre of the top face.
 */
export class AltarSlab {
  readonly cols: number;
  readonly rows: number;
  readonly pitch: number;
  readonly margin: number;
  readonly socketRadius: number;
  readonly frontHeight: number;
  readonly width: number;
  readonly topHeight: number;
  readonly surface: StoneSurface;
  private readonly socketMat: Material;
  private cx = 0;
  private cy = 0;
  private readonly dp: DrawParams = { x: 0, y: 0, params: [0, 0, 0, 0] };

  constructor(renderer: Renderer, opts: AltarOptions) {
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.pitch = opts.pitch ?? 118;
    this.margin = opts.margin ?? Math.round(this.pitch * 0.8);
    this.socketRadius = Math.round(this.pitch * 0.36);
    this.frontHeight = opts.front ?? Math.round(this.pitch * 0.42);
    this.width = this.cols * this.pitch + this.margin * 2;
    this.topHeight = this.rows * this.pitch + this.margin * 2;
    const h = this.topHeight + this.frontHeight;
    const u = new Float32Array(STONE_GEN_FLOATS);
    u.set([this.width, h, opts.seed ?? 3, STONE_MODE.altar]);
    u.set([this.cols, this.rows, this.pitch, this.margin], 4);
    u.set([this.frontHeight, this.socketRadius, this.topHeight, 0], 8);
    u.set(solidMask(this.cols, opts.solid ?? []), 12);
    const t = bake(renderer, 'altar', this.width, h, u);
    this.surface = new StoneSurface(renderer, t.albedo, t.normal, this.width, h, 'altar');
    this.socketMat = renderer.createMaterial({
      label: 'altar-socket',
      wgsl: SOCKET_WGSL,
      blend: 'alpha',
      uniformBytes: LIGHT_SET_FLOATS * 4,
    });
  }

  /** Upload this frame's lights to the slab and socket materials. */
  light(lights: LightSet): void {
    this.surface.light(lights);
    lights.apply(this.socketMat);
  }

  /** Place the slab: (x, y) = centre of the top face. Call before socketCenter/draw. */
  place(x: number, y: number): void {
    this.cx = x;
    this.cy = y;
  }

  /** Logical position of socket (col, row) into `out` (no allocation). */
  socketCenter(col: number, row: number, out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.cx - this.width / 2 + this.margin + this.pitch * (col + 0.5);
    out.y = this.cy - this.topHeight / 2 + this.margin + this.pitch * (row + 0.5);
    return out;
  }

  /** Draw the slab (top face + front face). */
  draw(frame: Frame, tint?: ArrayLike<number>): void {
    const h = this.topHeight + this.frontHeight;
    this.surface.draw(frame, this.cx, this.cy - this.topHeight / 2 + h / 2, this.width, h, tint);
  }

  /**
   * Draw a socket state overlay. `empty` draws nothing (the bowl is baked). `highlighted` is
   * a glowing rim (gold by default, or `color`); `wanted` a dotted ring in `color`; `blocked`
   * a barred rubble plug. `intensity` 0..1+ (animate it for a pulse). Batch overlays: draw
   * all of them together, between the slab and the gems.
   */
  drawSocket(
    frame: Frame,
    col: number,
    row: number,
    state: SocketState,
    color: RGBA | Readonly<RGBA>,
    intensity = 1,
  ): void {
    if (state === 'empty') return;
    const dp = this.dp;
    const o = this.socketCenter(col, row, dp);
    const p = dp.params as number[];
    p[0] = SOCKET_STATE_ID[state];
    p[1] = col * 7.3 + row * 3.1;
    p[2] = intensity;
    dp.x = o.x;
    dp.y = o.y;
    dp.w = this.socketRadius * 2.6;
    dp.h = this.socketRadius * 2.6;
    dp.tint = color;
    dp.emissive = 1.5;
    frame.sprite(this.socketMat, dp);
    dp.emissive = 0;
  }

  destroy(): void {
    this.surface.destroy();
    this.socketMat.destroy();
  }
}
