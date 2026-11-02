import { describe, expect, it } from 'vitest';
import { ITCH_LIMITS, resolveRef, validateBuild } from './itch-validate.mjs';

const html = (body: string) => ({ path: 'index.html', size: body.length, text: body });
const viteIndex = html(
  '<!doctype html><script type="module" crossorigin src="./assets/index-AbC1.js"></script>' +
    '<link rel="stylesheet" href="./assets/index-x.css">',
);
const viteJs = { path: 'assets/index-AbC1.js', size: 10, text: 'import"./chunk-1.js";' };
const viteChunk = { path: 'assets/chunk-1.js', size: 10, text: 'export const a=1;' };
const viteCss = { path: 'assets/index-x.css', size: 10, text: 'body{background:url(./bg.png)}' };
const vitePng = { path: 'assets/bg.png', size: 10 };
const good = [viteIndex, viteJs, viteChunk, viteCss, vitePng];

describe('validateBuild', () => {
  it('accepts a typical relative Vite build', () => {
    expect(validateBuild(good)).toEqual({ errors: [], warnings: [] });
  });

  it('requires index.html at the root', () => {
    const r = validateBuild([{ ...viteIndex, path: 'game/index.html' }]);
    expect(r.errors.join()).toMatch(/index\.html must be at the root/);
  });

  it('enforces file count, per-file and total size, and path length', () => {
    const many = Array.from({ length: ITCH_LIMITS.maxFiles }, (_, i) => ({
      path: `f${i}.bin`,
      size: 1,
    }));
    expect(validateBuild([viteIndex, ...many]).errors.join()).toMatch(/Too many files/);
    expect(
      validateBuild([
        viteIndex,
        { path: 'big.bin', size: ITCH_LIMITS.maxFileBytes + 1 },
      ]).errors.join(),
    ).toMatch(/200 MB/);
    const halfGig = { size: ITCH_LIMITS.maxTotalBytes / 2 };
    expect(
      validateBuild([
        viteIndex,
        { path: 'a', ...halfGig },
        { path: 'b', ...halfGig },
      ]).errors.join(),
    ).toMatch(/500 MB/);
    expect(validateBuild([viteIndex, { path: 'x'.repeat(241), size: 1 }]).errors.join()).toMatch(
      /240-char/,
    );
  });

  it('rejects absolute root URLs in HTML, CSS and JS', () => {
    const r = validateBuild([
      html('<script src="/assets/a.js"></script><a href="//example.com/x">ok</a>'),
      { path: 'a.css', size: 1, text: 'div{background:url(/img/a.png)}' },
      { path: 'b.js', size: 1, text: 'const u="/assets/x.wasm"; const re=/a/;' },
    ]);
    expect(r.errors.filter((e) => e.includes('absolute'))).toHaveLength(3);
  });

  it('flags case mismatches, missing files and folder URLs', () => {
    const r = validateBuild([
      html('<img src="./assets/BG.png"><img src="./nope.png"><a href="./levels/">x</a>'),
      vitePng,
    ]);
    const all = r.errors.join('\n');
    expect(all).toMatch(/case-insensitively/);
    expect(all).toMatch(/nope\.png" does not exist/);
    expect(all).toMatch(/folder/);
  });

  it('rejects source maps unless allowed', () => {
    const files = [...good, { path: 'assets/index-AbC1.js.map', size: 1 }];
    expect(validateBuild(files).errors.join()).toMatch(/source maps/);
    expect(validateBuild(files, { allowSourceMaps: true }).errors).toEqual([]);
  });

  it('ignores external, data and anchor references', () => {
    const r = validateBuild([
      html(
        '<a href="https://discord.gg/x">d</a><img src="data:image/png;base64,AA"><a href="#t">t</a>',
      ),
    ]);
    expect(r.errors).toEqual([]);
  });
});

describe('resolveRef', () => {
  it('resolves relative to the referring file', () => {
    expect(resolveRef('assets/a.css', './b.png')).toBe('assets/b.png');
    expect(resolveRef('assets/a.css', '../index.html')).toBe('index.html');
    expect(resolveRef('index.html', 'assets/x.js')).toBe('assets/x.js');
  });
});
