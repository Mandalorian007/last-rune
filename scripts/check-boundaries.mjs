#!/usr/bin/env node
// Import-boundary check (D-041, docs/engine/refactor-plan.md "Phase 1"). Run by `pnpm check`.
//
//   1. Outside packages/engine, the engine is reached only through its exports map:
//      `@thunderclap/engine/<subpath>` where <subpath> is a key of packages/engine/package.json
//      "exports". No `@engine/*` alias, no relative or root path into packages/engine/.
//   2. Inside packages/engine/src, nothing imports a game (`@game/*`, games/) or any path that
//      leaves the package.
//   3. games/*/rules/ imports nothing from the engine (architecture.md rule 2).
//   4. packages/host-electron (ws/host-electron) reaches the engine only through its exports map,
//      imports no game, and no relative path leaves the package. Outside it, the package is
//      reached only through its own exports map. The engine never imports it.
//
// Exit 1 and print every violation as `file:line  specifier  reason`.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const engineDir = join(root, 'packages', 'engine');
const engineSrc = join(engineDir, 'src');
const PKG = '@thunderclap/engine';

const exportsMap = JSON.parse(readFileSync(join(engineDir, 'package.json'), 'utf8')).exports ?? {};
const subpaths = (pkg, map) =>
  new Set(Object.keys(map).map((k) => (k === '.' ? pkg : `${pkg}/${k.replace(/^\.\//, '')}`)));
const allowedSubpaths = subpaths(PKG, exportsMap);

const hostDir = join(root, 'packages', 'host-electron');
const HOST_PKG = '@thunderclap/host-electron';
const hostSubpaths = subpaths(
  HOST_PKG,
  JSON.parse(readFileSync(join(hostDir, 'package.json'), 'utf8')).exports ?? {},
);

const CODE = /\.(m?[jt]s|tsx?)$/;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  'test-results',
  'playwright-report',
  'out',
]);

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && CODE.test(e.name)) out.push(p);
  }
  return out;
}

// `from 'x'`, `import 'x'`, `import('x')`, `export … from 'x'`.
const SPEC = /\bfrom\s*['"]([^'"\n]+)['"]|\bimport\s*\(?\s*['"]([^'"\n]+)['"]/g;

/** @param {string} text @returns {{ spec: string; line: number }[]} */
function importsOf(text) {
  /** @type {{ spec: string; line: number }[]} */
  const out = [];
  for (const m of text.matchAll(SPEC)) {
    const spec = m[1] ?? m[2];
    const line = text.slice(0, m.index).split('\n').length;
    out.push({ spec, line });
  }
  return out;
}

/** Absolute target of a relative or root-relative specifier, else null. */
function target(file, spec) {
  const bare = spec.split('?')[0];
  if (bare.startsWith('.')) return resolve(dirname(file), bare);
  if (bare.startsWith('/')) return join(root, bare);
  return null;
}

const inside = (p, dir) => p === dir || p.startsWith(dir + sep);

/** @type {string[]} */
const problems = [];
const report = (file, line, spec, why) =>
  problems.push(`${relative(root, file)}:${line}  '${spec}'  ${why}`);

// Every code file outside the engine package (game, tests, scripts, tools, root configs).
const outsideFiles = [
  ...walk(join(root, 'games')),
  ...walk(join(root, 'tests')),
  ...walk(join(root, 'scripts')),
  ...walk(join(root, 'tools')),
  ...readdirSync(root)
    .filter((n) => CODE.test(n))
    .map((n) => join(root, n)),
];

for (const file of outsideFiles) {
  const isRules = /[/\\]games[/\\][^/\\]+[/\\]rules[/\\]/.test(file);
  for (const { spec, line } of importsOf(readFileSync(file, 'utf8'))) {
    if (spec === '@engine' || spec.startsWith('@engine/')) {
      report(file, line, spec, `old alias; import from '${PKG}/<module>'`);
      continue;
    }
    if (spec === PKG || spec.startsWith(`${PKG}/`)) {
      if (!allowedSubpaths.has(spec.split('?')[0])) {
        report(
          file,
          line,
          spec,
          `not in the engine exports map (${[...allowedSubpaths].join(', ')})`,
        );
      } else if (isRules) {
        report(file, line, spec, 'rules/ must not import the engine');
      }
      continue;
    }
    if (spec === HOST_PKG || spec.startsWith(`${HOST_PKG}/`)) {
      if (!hostSubpaths.has(spec.split('?')[0])) {
        report(
          file,
          line,
          spec,
          `not in the host-electron exports map (${[...hostSubpaths].join(', ')})`,
        );
      } else if (isRules) {
        report(file, line, spec, 'rules/ must not import a host');
      }
      continue;
    }
    const t = target(file, spec);
    if (t && inside(t, engineDir)) {
      report(file, line, spec, `reaches into packages/engine; import from '${PKG}/<module>'`);
    } else if (t && inside(t, hostDir)) {
      report(file, line, spec, `reaches into packages/host-electron; import from '${HOST_PKG}'`);
    }
  }
}

// packages/host-electron: the engine by its exports map only, no game, nothing outside itself.
const hostFiles = walk(hostDir);
for (const file of hostFiles) {
  for (const { spec, line } of importsOf(readFileSync(file, 'utf8'))) {
    if (spec === '@game' || spec.startsWith('@game/') || /(^|\/)games\//.test(spec)) {
      report(file, line, spec, 'host-electron must never import a game');
      continue;
    }
    if (spec === '@engine' || spec.startsWith('@engine/')) {
      report(file, line, spec, `old alias; import from '${PKG}/<module>'`);
      continue;
    }
    if (spec === PKG || spec.startsWith(`${PKG}/`)) {
      if (!allowedSubpaths.has(spec.split('?')[0])) {
        report(file, line, spec, 'not in the engine exports map');
      }
      continue;
    }
    const t = target(file, spec);
    if (t && !inside(t, hostDir)) report(file, line, spec, 'leaves packages/host-electron');
  }
}

for (const file of walk(engineSrc)) {
  for (const { spec, line } of importsOf(readFileSync(file, 'utf8'))) {
    if (spec === '@game' || spec.startsWith('@game/') || /(^|\/)games\//.test(spec)) {
      report(file, line, spec, 'the engine must never import a game');
      continue;
    }
    if (spec.startsWith('@thunderclap/')) {
      report(file, line, spec, 'the engine must never import a host or another package');
      continue;
    }
    const t = target(file, spec);
    if (t && !inside(t, engineSrc)) {
      report(file, line, spec, 'leaves packages/engine/src');
    }
  }
}

if (problems.length) {
  console.error(`check-boundaries: ${problems.length} violation(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-boundaries: ok (${outsideFiles.length} game/tooling files, ${hostFiles.length} host-electron files, engine exports: ${[...allowedSubpaths].length})`,
);
