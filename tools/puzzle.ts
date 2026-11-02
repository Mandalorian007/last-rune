/**
 * Dev-only puzzle viewer. Prints a puzzle's board, tray, difficulty metrics and a solution.
 *
 *   pnpm puzzle <machineId>          one puzzle in full
 *   pnpm puzzle all                  the curve table for all 16 (slow: runs every solver)
 *   pnpm puzzle <id> --json          metrics as JSON
 *   pnpm puzzle <id> --solutions N   also print the first N solver solutions
 *
 * Runs under Node via tsx. Not bundled into the game.
 */
import { PUZZLES } from '../games/last-rune/content/puzzles/index';
import { TARGETS } from '../games/last-rune/content/puzzles/targets';
import { type DifficultyMetrics, measure } from '../games/last-rune/rules/difficulty';
import type { Placement, PuzzleDef } from '../games/last-rune/rules/model';
import { simulate } from '../games/last-rune/rules/sim';
import { solve } from '../games/last-rune/rules/solver';
import { MACHINE_IDS, type MachineId } from '../games/last-rune/rules/types';

const GLYPH: Record<string, string> = {
  channel: '═',
  split: 'S',
  amplify: 'A',
  capacitor: 'C',
  gate: 'G',
};
const BEND = ['└', '┌', '┐', '┘'];
const GATE = ['G↑', 'G→', 'G↓', 'G←'];
const DIR_ARROW = { N: '↑', S: '↓', E: '→', W: '←' } as const;

function cellGlyph(pl: Placement): string {
  if (pl.gem === 'bend') return BEND[pl.rot]!;
  if (pl.gem === 'gate') return GATE[pl.rot]!;
  return GLYPH[pl.gem]!;
}

/** Board with a one-socket frame for the storm (⚡) and machines (their need). */
export function render(p: PuzzleDef, placements: readonly Placement[] = []): string {
  const [w, h] = p.altar.split('x').map(Number) as [number, number];
  const grid: string[][] = Array.from({ length: h + 2 }, () => Array<string>(w + 2).fill(''));
  const put = (x: number, y: number, t: string) => {
    grid[y + 1]![x + 1] = t;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, '·');
  for (const b of p.blocked) put(b.x, b.y, '▓');
  for (const f of p.fixed) put(f.cell.x, f.cell.y, `${cellGlyph(f)}*`);
  for (const pl of placements) put(pl.cell.x, pl.cell.y, cellGlyph(pl));
  put(p.storm.at.x, p.storm.at.y, `⚡${p.storm.strength}${DIR_ARROW[p.storm.dir]}`);
  for (const m of p.machines) put(m.at.x, m.at.y, `M${m.need}`);
  return grid
    .map((r) =>
      r
        .map((c) => c.padEnd(4))
        .join('')
        .trimEnd(),
    )
    .join('\n');
}

function trayLine(p: PuzzleDef): string {
  return Object.entries(p.tray)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([g, n]) => `${g} ×${n}`)
    .join(', ');
}

function metricsBlock(m: DifficultyMetrics): string {
  const t = TARGETS[m.id as MachineId];
  return [
    `score ${m.score} (target ${t.score[0]}–${t.score[1]})   est. ${m.minutes} min (target ${t.minutes})`,
    `solutions ${m.solutions}${m.capped ? '+' : ''}   min gems ${m.minGems}   tray ${m.trayTotal} (slack ${m.slack})   decoy kinds ${m.decoyKinds.join(', ') || '-'}`,
    `solver nodes ${m.nodes}   search bits ${m.searchBits}   informative fails ${Math.round(m.informative * 100)}%`,
    `novice bot: solved ${m.bot.solved}/${m.bot.sessions} sessions, median ${m.bot.expected} tries; fails dead ${m.bot.fails.dead} / under ${m.bot.fails.under} / over ${m.bot.fails.over}`,
    `required ideas: ${m.required.join(', ') || '-'}   (concepts ${m.concepts})`,
    `intended shows: ${m.intendedMarkers.join(', ') || '-'}   path ${m.pathCells} sockets`,
  ].join('\n');
}

function show(id: MachineId, opts: { json: boolean; solutions: number }): void {
  const p = PUZZLES[id];
  const m = measure(p);
  if (opts.json) {
    console.log(JSON.stringify(m, null, 2));
    return;
  }
  const strikes = p.pulses > 1 ? `, ${p.pulses} strikes` : '';
  console.log(`\n${id}  (${p.altar}, storm ${p.storm.strength}×${strikes})`);
  console.log(`insight: ${p.design.insight}\n`);
  console.log(render(p));
  console.log(`\ntray: ${trayLine(p)}\n`);
  console.log(metricsBlock(m));
  const r = simulate(p, p.design.intended);
  console.log(
    `\nintended solution (${p.design.intended.length} gems, ${r.outcome}; readings ${r.machines.map((x) => x.readings.join('/')).join(', ')}):\n`,
  );
  console.log(render(p, p.design.intended));
  if (opts.solutions > 0) {
    const s = solve(p, { keep: opts.solutions });
    s.solutions.forEach((sol, i) => {
      console.log(`\nsolution ${i + 1} (${sol.length} gems):\n`);
      console.log(render(p, sol));
    });
  }
}

function table(ids: readonly MachineId[] = MACHINE_IDS, json = false): void {
  const all: DifficultyMetrics[] = [];
  const rows: string[] = [
    '| # | Machine | Target | Score | Min (target / est.) | Solutions | Min gems | Slack | Bot tries | Bits | Concepts | Required ideas |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  let total = 0;
  for (const id of ids) {
    const t0 = Date.now();
    const m = measure(PUZZLES[id]);
    all.push(m);
    const t = TARGETS[id];
    total += m.minutes;
    rows.push(
      `| ${MACHINE_IDS.indexOf(id) + 1} | ${id} | ${t.score[0]}–${t.score[1]} | ${m.score} | ${t.minutes} / ${m.minutes} | ${m.solutions}${m.capped ? '+' : ''} | ${m.minGems} | ${m.slack} | ${m.bot.expected} | ${m.searchBits} | ${m.concepts} | ${m.required.join(', ') || '-'} |`,
    );
    process.stderr.write(`${id}: ${Date.now() - t0} ms\n`);
  }
  if (json) {
    console.log(JSON.stringify(all));
    return;
  }
  console.log(rows.join('\n'));
  console.log(`\nTotal estimated minutes: ${total}`);
}

const args = process.argv.slice(2);
const id = args[0];
const json = args.includes('--json');
const si = args.indexOf('--solutions');
const nsol = si >= 0 ? Number(args[si + 1] ?? 3) : 0;
if (!id) {
  console.log(
    `usage: pnpm puzzle <machineId|all> [--json] [--solutions N]\n       pnpm puzzle table <id> <id> ...\n${MACHINE_IDS.join(' ')}`,
  );
} else if (id === 'all') table(MACHINE_IDS, json);
else if (id === 'table')
  table(args.slice(1).filter((a) => !a.startsWith('--')) as MachineId[], json);
else if ((MACHINE_IDS as readonly string[]).includes(id))
  show(id as MachineId, { json, solutions: nsol });
else {
  console.error(`unknown machine ${id}`);
  process.exit(1);
}
