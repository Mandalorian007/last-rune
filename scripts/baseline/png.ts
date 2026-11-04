/**
 * Just enough PNG for the v1.0 baselines, on node:zlib alone (no image dependency).
 *
 * - `decodePng`: 8-bit greyscale, RGB, RGBA or palette, not interlaced (what Chromium
 *   screenshots and `encodeIndexed` produce). Returns RGBA.
 * - `quantize`: median cut to at most 256 colours, refined by a few k-means passes over the
 *   colour histogram. No dithering, so the mapping is a pure function of the pixel.
 * - `encodeIndexed`: a palette ("8-bit") PNG. Indexed baselines are 3–6× smaller than the
 *   RGB screenshots, which is what keeps the committed set small.
 * - `mapToPalette`: the same nearest-colour mapping `quantize` uses, against a given palette.
 *   An identical render maps to identical indices, so a diff against an indexed baseline is
 *   exact for unchanged pixels (see README.md).
 */
import { deflateSync, inflateSync } from 'node:zlib';

export interface Rgba {
  width: number;
  height: number;
  /** width × height × 4 bytes. */
  data: Uint8Array;
}

export interface Indexed {
  width: number;
  height: number;
  /** Up to 256 RGB entries, 3 bytes each. */
  palette: Uint8Array;
  /** width × height palette indices. */
  index: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const body = Buffer.concat([head.subarray(4), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head.subarray(0, 4), body, crc]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(file: Uint8Array): Rgba {
  const buf = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8]!;
      type = data[9]!;
      interlace = data[12]!;
    } else if (kind === 'PLTE') palette = new Uint8Array(data);
    else if (kind === 'tRNS') trns = new Uint8Array(data);
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth})`);
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type];
  if (!channels) throw new Error(`unsupported PNG colour type ${type}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x]!;
      const a = x >= channels ? px[row + x - channels]! : 0;
      const b = y > 0 ? px[prev + x]! : 0;
      const c = x >= channels && y > 0 ? px[prev + x - channels]! : 0;
      let out: number;
      if (f === 0) out = v;
      else if (f === 1) out = v + a;
      else if (f === 2) out = v + b;
      else if (f === 3) out = v + ((a + b) >> 1);
      else if (f === 4) out = v + paeth(a, b, c);
      else throw new Error(`bad PNG filter ${f}`);
      px[row + x] = out & 0xff;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += 4) {
    if (type === 2) {
      data[j] = px[i * 3]!;
      data[j + 1] = px[i * 3 + 1]!;
      data[j + 2] = px[i * 3 + 2]!;
      data[j + 3] = 255;
    } else if (type === 6) {
      data.set(px.subarray(i * 4, i * 4 + 4), j);
    } else if (type === 3) {
      const k = px[i]!;
      data[j] = palette![k * 3]!;
      data[j + 1] = palette![k * 3 + 1]!;
      data[j + 2] = palette![k * 3 + 2]!;
      data[j + 3] = trns && k < trns.length ? trns[k]! : 255;
    } else {
      const g = px[i * channels]!;
      data[j] = g;
      data[j + 1] = g;
      data[j + 2] = g;
      data[j + 3] = type === 4 ? px[i * 2 + 1]! : 255;
    }
  }
  return { width, height, data };
}

/** Read an indexed PNG written by `encodeIndexed` back into palette + indices. */
export function decodeIndexed(file: Uint8Array): Indexed {
  const buf = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let palette: Uint8Array | null = null;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 3) throw new Error('baseline is not an 8-bit palette PNG');
    } else if (kind === 'PLTE') palette = new Uint8Array(data);
    else if (kind === 'IDAT') idat.push(data);
  }
  if (!palette) throw new Error('baseline PNG has no palette');
  const raw = inflateSync(Buffer.concat(idat));
  const index = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (width + 1)]!;
    const src = y * (width + 1) + 1;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const v = raw[src + x]!;
      const a = x > 0 ? index[row + x - 1]! : 0;
      const b = y > 0 ? index[row - width + x]! : 0;
      const c = x > 0 && y > 0 ? index[row - width + x - 1]! : 0;
      let out: number;
      if (f === 0) out = v;
      else if (f === 1) out = v + a;
      else if (f === 2) out = v + b;
      else if (f === 3) out = v + ((a + b) >> 1);
      else if (f === 4) out = v + paeth(a, b, c);
      else throw new Error(`bad PNG filter ${f}`);
      index[row + x] = out & 0xff;
    }
  }
  return { width, height, palette, index };
}

export function encodeIndexed(img: Indexed): Buffer {
  const { width, height, palette, index } = img;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // palette
  // Filter "none" per row: the recommended choice for palette images (and the smallest here).
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    raw.set(index.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('PLTE', palette),
    chunk('IDAT', deflateSync(raw, { level: 9, memLevel: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Nearest palette entry per distinct colour (cached), squared RGB distance, lowest index wins. */
export function mapToPalette(img: Rgba, palette: Uint8Array): Uint8Array {
  const n = palette.length / 3;
  // One slot per 24-bit colour (16 MB); -1 = not looked up yet.
  const cache = new Int16Array(1 << 24).fill(-1);
  const out = new Uint8Array(img.width * img.height);
  const d = img.data;
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    const r = d[j]!;
    const g = d[j + 1]!;
    const b = d[j + 2]!;
    const key = (r << 16) | (g << 8) | b;
    let k = cache[key]!;
    if (k < 0) {
      let best = 0;
      let bestD = Number.POSITIVE_INFINITY;
      for (let p = 0; p < n; p++) {
        const dr = r - palette[p * 3]!;
        const dg = g - palette[p * 3 + 1]!;
        const db = b - palette[p * 3 + 2]!;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestD) {
          bestD = dist;
          best = p;
        }
      }
      k = best;
      cache[key] = k;
    }
    out[i] = k;
  }
  return out;
}

/** Histogram bits per channel for building the palette (the final mapping is exact). */
const HB = 6;
const HS = 8 - HB;

interface Box {
  /** Indices into the histogram's bin list. */
  items: Uint32Array;
  weight: number;
  /** Widest channel and its range × √weight, computed once. */
  axis: number;
  score: number;
}

/**
 * Median cut over a 6-bit-per-channel histogram, then three weighted k-means passes. ≤ `max`
 * colours. Deterministic: same pixels, same palette.
 */
export function quantize(img: Rgba, max = 256): Indexed {
  const d = img.data;
  const hist = new Uint32Array(1 << (HB * 3));
  const sums = new Float64Array((1 << (HB * 3)) * 3);
  for (let j = 0; j < d.length; j += 4) {
    const r = d[j]!;
    const g = d[j + 1]!;
    const b = d[j + 2]!;
    const k = ((r >> HS) << (2 * HB)) | ((g >> HS) << HB) | (b >> HS);
    hist[k]!++;
    sums[k * 3]! += r;
    sums[k * 3 + 1]! += g;
    sums[k * 3 + 2]! += b;
  }
  // Non-empty bins: their mean colour and pixel count.
  const binList: number[] = [];
  for (let k = 0; k < hist.length; k++) if (hist[k]) binList.push(k);
  const n = binList.length;
  const col = new Float64Array(n * 3);
  const w = new Float64Array(n);
  binList.forEach((k, i) => {
    const c = hist[k]!;
    w[i] = c;
    col[i * 3] = sums[k * 3]! / c;
    col[i * 3 + 1] = sums[k * 3 + 1]! / c;
    col[i * 3 + 2] = sums[k * 3 + 2]! / c;
  });

  const makeBox = (items: Uint32Array): Box => {
    let weight = 0;
    const lo = [255, 255, 255];
    const hi = [0, 0, 0];
    for (const i of items) {
      weight += w[i]!;
      for (let c = 0; c < 3; c++) {
        const v = col[i * 3 + c]!;
        if (v < lo[c]!) lo[c] = v;
        if (v > hi[c]!) hi[c] = v;
      }
    }
    let axis = 0;
    for (let c = 1; c < 3; c++) if (hi[c]! - lo[c]! > hi[axis]! - lo[axis]!) axis = c;
    const score = items.length < 2 ? 0 : (hi[axis]! - lo[axis]!) * Math.sqrt(weight);
    return { items, weight, axis, score };
  };

  let pal: Float64Array;
  if (n <= max) {
    pal = col.slice();
  } else {
    const boxes: Box[] = [makeBox(Uint32Array.from({ length: n }, (_, i) => i))];
    while (boxes.length < max) {
      let pick = -1;
      let best = 0;
      for (let b = 0; b < boxes.length; b++) {
        if (boxes[b]!.score > best) {
          best = boxes[b]!.score;
          pick = b;
        }
      }
      if (pick < 0) break;
      const box = boxes[pick]!;
      const ax = box.axis;
      const items = Array.from(box.items).sort(
        (a, b) => col[a * 3 + ax]! - col[b * 3 + ax]! || a - b,
      );
      const half = box.weight / 2;
      let acc = 0;
      let cut = 1;
      for (let i = 0; i < items.length - 1; i++) {
        acc += w[items[i]!]!;
        cut = i + 1;
        if (acc >= half) break;
      }
      boxes.splice(
        pick,
        1,
        makeBox(Uint32Array.from(items.slice(0, cut))),
        makeBox(Uint32Array.from(items.slice(cut))),
      );
    }
    const m = boxes.length;
    pal = new Float64Array(m * 3);
    boxes.forEach((box, p) => {
      for (const i of box.items)
        for (let c = 0; c < 3; c++) pal[p * 3 + c]! += col[i * 3 + c]! * w[i]!;
      for (let c = 0; c < 3; c++) pal[p * 3 + c]! /= box.weight;
    });
    // Weighted k-means over the bins: tightens the cut boxes.
    const acc = new Float64Array(m * 4);
    for (let iter = 0; iter < 3; iter++) {
      acc.fill(0);
      for (let i = 0; i < n; i++) {
        const r = col[i * 3]!;
        const g = col[i * 3 + 1]!;
        const b = col[i * 3 + 2]!;
        let bp = 0;
        let bd = Number.POSITIVE_INFINITY;
        for (let p = 0; p < m; p++) {
          const dr = r - pal[p * 3]!;
          const dg = g - pal[p * 3 + 1]!;
          const db = b - pal[p * 3 + 2]!;
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bd) {
            bd = dist;
            bp = p;
          }
        }
        const wi = w[i]!;
        acc[bp * 4]! += r * wi;
        acc[bp * 4 + 1]! += g * wi;
        acc[bp * 4 + 2]! += b * wi;
        acc[bp * 4 + 3]! += wi;
      }
      for (let p = 0; p < m; p++) {
        const t = acc[p * 4 + 3]!;
        if (t > 0) for (let c = 0; c < 3; c++) pal[p * 3 + c] = acc[p * 4 + c]! / t;
      }
    }
  }
  const out = new Uint8Array(pal.length);
  for (let i = 0; i < pal.length; i++) out[i] = Math.round(pal[i]!);
  return { width: img.width, height: img.height, palette: out, index: mapToPalette(img, out) };
}
