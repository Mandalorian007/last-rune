import type { SamplerKind, TextureLike } from './texture';

/**
 * Shared "uniform + sampler + N textures" binding convention used by materials (group 1) and
 * fullscreen passes (group 0):
 *
 * - `@binding(0)` `var<uniform>`: present when `uniformBytes > 0`
 * - `@binding(1)` `sampler`: present when `textures > 0`
 * - `@binding(2 + i)` `texture_2d<f32>`: one per texture slot
 */
export interface BindingDesc {
  uniformBytes?: number;
  textures?: number;
  sampler?: SamplerKind;
  /** Which stages see the bindings. Default fragment + vertex. */
  visibility?: GPUShaderStageFlags;
}

export function hasBindings(desc: BindingDesc): boolean {
  return (desc.uniformBytes ?? 0) > 0 || (desc.textures ?? 0) > 0;
}

export function createBindingLayout(
  device: GPUDevice,
  desc: BindingDesc,
  label: string,
): GPUBindGroupLayout {
  const vis = desc.visibility ?? GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX;
  const entries: GPUBindGroupLayoutEntry[] = [];
  if ((desc.uniformBytes ?? 0) > 0) entries.push({ binding: 0, visibility: vis, buffer: {} });
  const n = desc.textures ?? 0;
  if (n > 0) {
    entries.push({ binding: 1, visibility: vis, sampler: {} });
    for (let i = 0; i < n; i++) {
      entries.push({ binding: 2 + i, visibility: vis, texture: { sampleType: 'float' } });
    }
  }
  return device.createBindGroupLayout({ label, entries });
}

/** Owns the uniform buffer + bind group for one binding set; rebuilds the group lazily. */
export class BindingSet {
  readonly layout: GPUBindGroupLayout;
  readonly uniformBuffer: GPUBuffer | null;
  private readonly views: GPUTextureView[];
  private group: GPUBindGroup | null = null;

  constructor(
    private readonly device: GPUDevice,
    desc: BindingDesc,
    private readonly sampler: GPUSampler,
    defaultView: GPUTextureView,
    private readonly label: string,
  ) {
    this.layout = createBindingLayout(device, desc, `${label}-layout`);
    const bytes = desc.uniformBytes ?? 0;
    this.uniformBuffer =
      bytes > 0
        ? device.createBuffer({
            label: `${label}-uniforms`,
            size: Math.ceil(bytes / 16) * 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          })
        : null;
    this.views = new Array(desc.textures ?? 0).fill(defaultView);
  }

  setUniforms(data: BufferSource, byteOffset = 0): void {
    if (!this.uniformBuffer) throw new Error(`${this.label}: no uniforms declared`);
    if (ArrayBuffer.isView(data)) {
      this.device.queue.writeBuffer(
        this.uniformBuffer,
        byteOffset,
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );
    } else {
      this.device.queue.writeBuffer(this.uniformBuffer, byteOffset, data);
    }
  }

  setTexture(slot: number, tex: TextureLike | GPUTextureView): void {
    if (slot < 0 || slot >= this.views.length) {
      throw new Error(`${this.label}: texture slot ${slot} out of range`);
    }
    const view = 'view' in tex ? tex.view : tex;
    if (this.views[slot] === view) return;
    this.views[slot] = view;
    this.group = null;
  }

  /** Build a bind group for an explicit set of views (callers cache it). */
  createGroup(views: readonly GPUTextureView[] = this.views): GPUBindGroup {
    const entries: GPUBindGroupEntry[] = [];
    if (this.uniformBuffer) entries.push({ binding: 0, resource: { buffer: this.uniformBuffer } });
    if (views.length) {
      entries.push({ binding: 1, resource: this.sampler });
      views.forEach((v, i) => {
        entries.push({ binding: 2 + i, resource: v });
      });
    }
    return this.device.createBindGroup({
      label: `${this.label}-group`,
      layout: this.layout,
      entries,
    });
  }

  get bindGroup(): GPUBindGroup {
    if (!this.group) this.group = this.createGroup();
    return this.group;
  }

  destroy(): void {
    this.uniformBuffer?.destroy();
  }
}
