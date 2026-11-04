#!/usr/bin/env node
// The Last Rune's desktop app icon, drawn from code (CLAUDE.md: all art is procedural; there is
// no image file in the repo). `pnpm desktop:build` runs this first and hands the PNG to
// electron-builder, which makes the macOS .icns, the Windows .ico and the Linux icon from it.
//
//   node scripts/desktop/icon.mjs [out.png] [--size 1024]
//
// Default output: build/desktop/icon.png (git-ignored). The picture is the game's own motif in
// its palette (games/last-rune/art/materials/palette.ts): a cyan channel gem, the rune on its
// table, lit by the wire that runs through it, set in slate inside a gold rim. Shapes are signed
// distance fields, supersampled 4x4 per pixel, so the output is the same on every machine.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

// ── Palette (sRGB, from palette.ts) ──────────────────────────────────────────
const hex = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255);
const C = {
  channel: hex('#3fe0ff'),
  stoneDark: hex('#1b1f28'),
  stone: hex('#3a4150'),
  ink: hex('#0a0c13'),
  gold: hex('#e8b64a'),
  goldLight: hex('#fff0b8'),
  goldDeep: hex('#7a4c10'),
  flameCore: hex('#fff1c9'),
};

// ── Signed distance helpers (unit square, y down) ────────────────────────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Rounded box centred at the origin: half size `b`, corner radius `r`. */
function sdRoundBox(x, y, b, r) {
  const qx = Math.abs(x) - b + r;
  const qy = Math.abs(y) - b + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Regular hexagon with pointy top, circumradius `r` (Inigo Quilez's sdHexagon, rotated). */
function sdHex(x, y, r) {
  const kx = -0.866025404;
  const ky = 0.5;
  const kz = 0.577350269;
  const ri = r * 0.866025404; // inradius
  let px = Math.abs(y);
  let py = Math.abs(x);
  const d = 2 * Math.min(kx * px + ky * py, 0);
  px -= d * kx;
  py -= d * ky;
  px -= clamp(px, -kz * ri, kz * ri);
  py -= ri;
  return Math.hypot(px, py) * Math.sign(py);
}

/** Segment a→b with half width `w`. */
function sdSeg(x, y, ax, ay, bx, by, w) {
  const pax = x - ax;
  const pay = y - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h) - w;
}

// ── The picture ──────────────────────────────────────────────────────────────
// Apple's grid: the tile is 824/1024 of the canvas with a ~185 px corner; the rest is clear.
const TILE = 0.4024; // half size
const CORNER = 0.18;
const GEM = 0.215; // gem circumradius
const WIRE = 0.016;

/** The rune on the gem's table (an algiz-like mark): strokes as [ax, ay, bx, by]. */
const RUNE = [
  [0, -0.075, 0, 0.085],
  [0, -0.005, -0.06, -0.075],
  [0, -0.005, 0.06, -0.075],
];

/** Colour and coverage at a point (centre-origin units, y down). */
function shade(x, y) {
  const tile = sdRoundBox(x, y, TILE, CORNER);
  if (tile > 0.004) return [0, 0, 0, 0];

  // Slate, lit from above, darker at the rim; a cyan glow from the gem behind the stone.
  const r = Math.hypot(x, y);
  let col = mix(C.stone, C.stoneDark, smooth(-0.4, 0.4, y));
  col = mix(col, C.ink, smooth(0.15, 0.6, r) * 0.7);
  col = mix(col, C.channel, 0.32 * Math.exp(-r * r * 18));

  // The wire runs through the gem, left to right, ending in gold studs.
  const studX = 0.3;
  const wire = sdSeg(x, y, -studX, 0, studX, 0, WIRE);
  col = mix(col, C.channel, 0.55 * Math.exp(-Math.max(wire, 0) * 40));
  col = mix(col, mix(C.channel, C.flameCore, 0.45), 1 - smooth(-0.003, 0.003, wire));
  for (const sx of [-studX, studX]) {
    const stud = Math.hypot(x - sx, y) - 0.042;
    const ring = Math.abs(stud + 0.012) - 0.012;
    col = mix(
      col,
      mix(C.gold, C.goldLight, smooth(0.04, -0.04, y)),
      1 - smooth(-0.003, 0.003, ring),
    );
    col = mix(col, C.goldDeep, (1 - smooth(-0.003, 0.003, stud + 0.024)) * 0.9);
  }

  // The gem: a halo, then six facets shaded by their angle to a light at the top left,
  // a flat table on top and dark girdle lines between the facets.
  const gem = sdHex(x, y, GEM);
  col = mix(col, C.channel, 0.6 * Math.exp(-Math.max(gem, 0) * 22) * (gem > 0 ? 1 : 0));
  if (gem < 0.004) {
    const a = Math.atan2(y, x);
    // Six wedges, one per face: their edges run from the centre to the hexagon's corners.
    const start = -Math.PI - Math.PI / 6;
    const facet = Math.floor((a - start) / (Math.PI / 3)) % 6;
    const mid = start + (facet + 0.5) * (Math.PI / 3);
    const lit = 0.5 + 0.5 * Math.cos(mid - -2.3); // light from the top left
    let g = mix(mix(C.channel, C.ink, 0.55), mix(C.channel, C.flameCore, 0.35), lit);
    // Table: a smaller hexagon, flat and bright.
    const table = sdHex(x, y, GEM * 0.56);
    g = mix(g, mix(C.channel, C.flameCore, 0.18), 1 - smooth(-0.003, 0.003, table));
    // Lines from the table's corners to the girdle's, and the table's outline.
    let edge = Math.abs(table);
    for (let k = 0; k < 6; k++) {
      const ca = -Math.PI / 2 + (k * Math.PI) / 3;
      const cx = Math.cos(ca);
      const cy = Math.sin(ca);
      edge = Math.min(edge, sdSeg(x, y, cx * GEM * 0.56, cy * GEM * 0.56, cx * GEM, cy * GEM, 0));
    }
    g = mix(g, mix(C.channel, C.ink, 0.7), (1 - smooth(0.002, 0.006, edge)) * 0.6);
    // The rune, cut into the table and glowing.
    let rune = Number.POSITIVE_INFINITY;
    for (const [ax, ay, bx, by] of RUNE) rune = Math.min(rune, sdSeg(x, y, ax, ay, bx, by, 0.013));
    g = mix(g, C.flameCore, 1 - smooth(-0.003, 0.003, rune));
    g = mix(g, C.ink, 1 - smooth(-0.003, 0.004, Math.abs(gem) - 0.004)); // girdle outline
    col = mix(col, g, 1 - smooth(-0.003, 0.003, gem));
  }

  // Gold rim just inside the tile's edge, brighter at the top.
  const rim = Math.abs(tile + 0.016) - 0.007;
  col = mix(
    col,
    mix(C.goldLight, C.goldDeep, smooth(-0.4, 0.4, y)),
    1 - smooth(-0.003, 0.003, rim),
  );

  return [...col, 1 - smooth(-0.003, 0.003, tile)];
}

/** RGBA pixels, 4x4 supersampled. */
export function renderIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const S = 4;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sj = 0; sj < S; sj++) {
        for (let si = 0; si < S; si++) {
          const x = (i + (si + 0.5) / S) / size - 0.5;
          const y = (j + (sj + 0.5) / S) / size - 0.5;
          const c = shade(x, y);
          // Premultiplied while summing, so edges do not darken.
          r += c[0] * c[3];
          g += c[1] * c[3];
          b += c[2] * c[3];
          a += c[3];
        }
      }
      const o = (j * size + i) * 4;
      const n = S * S;
      const al = a / n;
      px[o] = al ? Math.round(clamp(r / a, 0, 1) * 255) : 0;
      px[o + 1] = al ? Math.round(clamp(g / a, 0, 1) * 255) : 0;
      px[o + 2] = al ? Math.round(clamp(b / a, 0, 1) * 255) : 0;
      px[o + 3] = Math.round(al * 255);
    }
  }
  return px;
}

// ── PNG (8-bit RGBA, no dependencies) ────────────────────────────────────────
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const si = args.indexOf('--size');
  const size = si >= 0 ? Number(args[si + 1]) : 1024;
  const out = resolve(
    args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--size') ??
      join(root, 'build/desktop/icon.png'),
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePng(size, renderIcon(size)));
  console.log(`icon: ${out} (${size}x${size})`);
}
