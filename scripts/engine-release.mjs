#!/usr/bin/env node
// Cut a @thunderclap/engine release (D-041 addendum 3).
//
//   pnpm engine:release <version>          bump, date the CHANGELOG, commit (no tag)
//   pnpm engine:release <version> --tag    also create the annotated tag engine-v<version>
//   pnpm engine:release <version> --dry    print what would happen, change nothing
//
// This is the only way the repo gets tags. It never pushes: the printed push command is yours to run.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'packages/engine/package.json');
const logPath = join(root, 'packages/engine/CHANGELOG.md');

const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith('--'));
const tag = args.includes('--tag');
const dry = args.includes('--dry');
const skipChecks = args.includes('--skip-checks');

const fail = (msg) => {
  console.error(`engine-release: ${msg}`);
  process.exit(1);
};
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const run = (cmd, ...a) => execFileSync(cmd, a, { cwd: root, stdio: 'inherit' });

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(version)) {
  fail('usage: pnpm engine:release <semver> [--tag] [--dry] [--skip-checks]');
}
const tagName = `engine-v${version}`;
if (git('status', '--porcelain')) fail('working tree is not clean');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('releases are cut from main');
if (tag && git('tag', '--list', tagName)) fail(`tag ${tagName} already exists`);

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const log = readFileSync(logPath, 'utf8');
// The first "## <x> (unreleased)" heading becomes "## <version> (<date>)".
const head = /^## [^\n]*\(unreleased\)[^\n]*$/m;
if (!head.test(log)) fail('CHANGELOG.md has no "## … (unreleased)" section to release');
const date = new Date().toISOString().slice(0, 10);
const nextLog = log.replace(head, `## ${version} (${date})`);

console.log(`engine-release: ${pkg.version} → ${version}${tag ? `, tag ${tagName}` : ', no tag'}`);
if (dry) process.exit(0);

if (!skipChecks) {
  run('pnpm', 'check');
  run('pnpm', 'test:e2e:engine');
}

pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
writeFileSync(logPath, nextLog);
git('add', pkgPath, logPath);
git('commit', '-q', '-m', `engine: release ${version}`);
if (tag) git('tag', '-a', tagName, '-m', `@thunderclap/engine ${version}`);

console.log(`engine-release: committed${tag ? ` and tagged ${tagName}` : ''}. Push with:`);
console.log(`  git push origin main${tag ? ` ${tagName}` : ''}`);
