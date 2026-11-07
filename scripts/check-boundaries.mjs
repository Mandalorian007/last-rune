#!/usr/bin/env node
// Import-boundary check (D-041, D-052). Run by `pnpm check`.
//
// The engine and the desktop shell are npm packages (@thunderclap-engine/engine,
// @thunderclap-engine/host-electron). Every code file of this repo (game, tests, scripts, tools,
// root configs):
//   1. reaches each package only through its public entry points: `<pkg>` or `<pkg>/<subpath>`
//      where <subpath> is a key of the installed package's package.json "exports". No deep
//      `dist/` or `src/` import, no path into node_modules, no old `@thunderclap/*` or `@engine/*`
//      name;
//   2. games/*/rules/ imports nothing from the engine or a host (architecture.md rule 2).
//
// Exit 1 and print every violation as `file:line  specifier  reason`.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

/** The public specifiers of an installed package: its name and each exports-map subpath. */
function publicSpecifiers(pkg) {
  const exportsMap = JSON.parse(readFileSync(require.resolve(`${pkg}/package.json`), 'utf8'))
    .exports ?? { '.': true };
  return new Set(
    Object.keys(exportsMap)
      .filter((k) => k !== './package.json')
      .map((k) => (k === '.' ? pkg : `${pkg}/${k.replace(/^\.\//, '')}`)),
  );
}

const PACKAGES = [
  { name: '@thunderclap-engine/engine', what: 'the engine' },
  { name: '@thunderclap-engine/host-electron', what: 'a host' },
].map((p) => ({ ...p, allowed: publicSpecifiers(p.name) }));

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

/** @type {string[]} */
const problems = [];
const report = (file, line, spec, why) =>
  problems.push(`${relative(root, file)}:${line}  '${spec}'  ${why}`);

const files = [
  ...walk(join(root, 'games')),
  ...walk(join(root, 'tests')),
  ...walk(join(root, 'scripts')),
  ...walk(join(root, 'tools')),
  ...readdirSync(root)
    .filter((n) => CODE.test(n))
    .map((n) => join(root, n)),
];

for (const file of files) {
  const isRules = /[/\\]games[/\\][^/\\]+[/\\]rules[/\\]/.test(file);
  for (const { spec, line } of importsOf(readFileSync(file, 'utf8'))) {
    const bare = spec.split('?')[0];
    if (bare === '@engine' || bare.startsWith('@engine/') || bare.startsWith('@thunderclap/')) {
      report(file, line, spec, 'old name; import from @thunderclap-engine/<package>');
      continue;
    }
    if (/(^|[/\\])node_modules[/\\]/.test(bare) || /(^|[/\\])packages[/\\]engine/.test(bare)) {
      report(file, line, spec, 'reaches into a package by path; use its public entry points');
      continue;
    }
    const pkg = PACKAGES.find((p) => bare === p.name || bare.startsWith(`${p.name}/`));
    if (!pkg) continue;
    if (!pkg.allowed.has(bare)) {
      report(file, line, spec, `not a public entry point of ${pkg.name}`);
    } else if (isRules) {
      report(file, line, spec, `rules/ must not import ${pkg.what}`);
    }
  }
}

if (problems.length) {
  console.error(`check-boundaries: ${problems.length} violation(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-boundaries: ok (${files.length} game/tooling files; ${PACKAGES.map((p) => `${p.name}: ${p.allowed.size} entry points`).join(', ')})`,
);
