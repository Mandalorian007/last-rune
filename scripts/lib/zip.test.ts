import { inflateRawSync, crc32 as nodeCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, createZip } from './zip.mjs';

/** Tiny reader for the archives createZip writes: walks the central directory. */
function readZip(buf: Buffer) {
  const eocd = buf.length - 22;
  expect(buf.readUInt32LE(eocd)).toBe(0x06054b50);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: Record<string, Buffer> = {};
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const localNameLen = buf.readUInt16LE(local + 26);
    const start = local + 30 + localNameLen + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + csize);
    const data = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    expect(crc32(data)).toBe(crc);
    out[name] = data;
    p += 46 + nameLen;
  }
  return out;
}

describe('createZip', () => {
  it('round-trips files with index.html at the root, sorted and deterministic', () => {
    const entries = [
      { path: 'assets/app.js', data: Buffer.from('console.log(1);'.repeat(50)) },
      { path: 'index.html', data: Buffer.from('<!doctype html><title>x</title>') },
      { path: 'assets/raw.bin', data: Buffer.from([0, 1, 2, 3]) },
    ];
    const a = createZip(entries);
    const b = createZip([...entries].reverse());
    expect(a.equals(b)).toBe(true);
    const files = readZip(a);
    expect(Object.keys(files)).toEqual(['assets/app.js', 'assets/raw.bin', 'index.html']);
    for (const e of entries) expect(files[e.path].equals(e.data)).toBe(true);
  });

  it('rejects absolute or backslash paths', () => {
    expect(() => createZip([{ path: '/index.html', data: Buffer.alloc(0) }])).toThrow();
    expect(() => createZip([{ path: 'a\\b', data: Buffer.alloc(0) }])).toThrow();
  });

  it('crc32 matches zlib', () => {
    const buf = Buffer.from('The Last Rune');
    expect(crc32(buf)).toBe(nodeCrc32(buf));
  });
});
