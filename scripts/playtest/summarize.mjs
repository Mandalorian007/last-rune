// Turn a full-run playtest capture into the markdown tables used in
// docs/design/playtest-report.md.
//
//   PLAYTEST_OUT=/tmp/pt E2E_SKIP_BUILD=1 pnpm exec playwright test full-run
//   node scripts/playtest/summarize.mjs /tmp/pt/metrics.json
//
// The capture (tests/e2e/full-run.spec.ts in PLAYTEST_OUT mode) holds per-machine timings,
// frame times during the strike, and a DOM audit (overlapping / clipped / off-screen text) at
// 1280x720 and 960x540. Screenshots land next to metrics.json.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/playtest/summarize.mjs <metrics.json>');
  process.exit(1);
}
const { metrics, console: log, problems } = JSON.parse(readFileSync(file, 'utf8'));
const s = (ms) => (ms / 1000).toFixed(1);

console.log(
  '| # | Machine | Board | Gems | Keys | Place (s) | Strike (s) | Wake (s) | Card (s) | Strike fps avg / p95 ms / max ms / >33ms | Pages |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const m of metrics) {
  const f = m.strikeFrames;
  console.log(
    `| ${m.n} | ${m.machine} | ${m.board} | ${m.gems} | ${m.keyPresses} | ${s(m.placeMs)} | ${s(m.strikeMs)} | ${s(m.wakeMs)} | ${s(m.solveCardMs)} | ${f.avgMs ? (1000 / f.avgMs).toFixed(0) : '-'} / ${f.p95Ms} / ${f.maxMs} / ${f.over33} | ${m.pages} |`,
  );
}

const issues = new Map();
for (const m of metrics) {
  for (const a of m.audit) {
    const key = `${a.viewport} ${a.kind}: ${a.what.replace(/\(\d+×\d+px\)|\d+>\d+px|at [\d,–-]+/g, '').trim()}`;
    const e = issues.get(key) ?? { n: 0, beats: new Set() };
    e.n++;
    e.beats.add(a.beat.replace(/^\d+-/, ''));
    issues.set(key, e);
  }
}
console.log('\n## DOM audit\n');
for (const [k, v] of [...issues].sort((a, b) => b[1].n - a[1].n)) {
  console.log(
    `- ${k} — ${v.n}× (${[...v.beats].slice(0, 6).join(', ')}${v.beats.size > 6 ? ', …' : ''})`,
  );
}
console.log('\n## Console\n');
for (const l of [...new Set(log)]) console.log(`- ${l}`);
console.log('\n## Problems\n');
for (const p of problems) console.log(`- ${p}`);
