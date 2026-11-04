import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { MachineId } from '../../games/last-rune/rules/types';
import { solvedLook } from '../../games/last-rune/scenes/altar/solved-board';
import { playOrder } from './altar-audit';
import { DEV_URL, waitFrames } from './helpers';

// solve-truth (D-027): the solve moment shows exactly the board the player built. Gate 6 found
// the Furnace's solve drawing a vertical Channel horizontal, lighting the fixed Amplify the bolt
// never touched, and dropping the fixed gems' collar and padlock. On every altar, solved:
//  - each gem's turn on the solve board is the turn it had at the altar's verdict just before
//    (the real Strike, not a shortcut);
//  - exactly the gems the bolt reached are lit;
//  - every fixed gem is still marked fixed and its socket wears the collar.

const ORDER = playOrder();

test.setTimeout(300_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;
interface Seen {
  gems: { cell: string; kind: string; rot: number; lit: boolean; fixed: boolean }[];
  collars: string[];
}

/** The live view's board: each gem's resting turn (mod 4), lit or not, fixed or not. */
function readView(page: Page): Promise<Seen> {
  return page.evaluate(() => {
    const v = (window as G).__altarView;
    return {
      gems: v.board.map((b: G) => ({
        cell: `${b.cell.x},${b.cell.y}`,
        kind: b.g.kind,
        rot: ((Math.round(b.rotTarget) % 4) + 4) % 4,
        lit: b.energy > 0.5 && b.g.state === 'energised',
        fixed: b.fixed,
      })),
      collars: v.marks
        .filter((m: G) => m.state === 'collar')
        .map((m: G) => `${m.col},${m.row}`)
        .sort(),
    };
  });
}

async function solveAndCompare(page: Page, id: MachineId): Promise<string[]> {
  const problems: string[] = [];
  const pz = puzzleFor(id);
  const intended = pz.design.intended;
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  await page.evaluate(
    ({ id, placements, solved }) => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { [id]: { attempts: 0, placements } };
      });
      g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, placements: intended, solved: ORDER.slice(0, ORDER.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await waitFrames(page, 10);
  // Strike for real: the altar's own verdict is the board the player studies before the solve.
  await page.evaluate(() => (window as G).__game.fuse.hush());
  await page.locator('[data-action="strike"]').click();
  await waitFrames(page, 4);
  const sure = page.locator('.lr-confirm .lr-gold-button');
  if (await sure.isVisible()) await sure.click();
  await expect(page.locator('.lr-altar-verdict')).toBeVisible({ timeout: 60_000 });
  await waitFrames(page, 4);
  const play = await readView(page);
  const playView = await page.evaluateHandle(() => (window as G).__altarView);

  // The altar hands over to the solve moment on its own.
  await expect(page.locator('.lr-solve-card')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction((pv) => (window as G).__altarView !== pv, playView);
  await waitFrames(page, 10);
  const solved = await readView(page);

  const look = solvedLook(pz, intended);
  const lit = new Set(look.lit.map((c) => `${c.x},${c.y}`));
  const fixedCells = pz.fixed.map((f) => `${f.cell.x},${f.cell.y}`).sort();
  if (solved.gems.length !== play.gems.length)
    problems.push(`${id}: ${play.gems.length} gems at the altar, ${solved.gems.length} solved`);
  for (const s of solved.gems) {
    const p = play.gems.find((q) => q.cell === s.cell);
    if (!p || p.kind !== s.kind) {
      problems.push(`${id} ${s.cell}: ${s.kind} solved, ${p?.kind ?? 'nothing'} at the altar`);
      continue;
    }
    if (p.rot !== s.rot) problems.push(`${id} ${s.cell} ${s.kind}: turn ${p.rot} → ${s.rot}`);
    if (s.lit !== lit.has(s.cell))
      problems.push(`${id} ${s.cell} ${s.kind}: ${s.lit ? 'lit off the route' : 'dark on it'}`);
    if (s.fixed !== p.fixed) problems.push(`${id} ${s.cell} ${s.kind}: fixed state changed`);
  }
  if (JSON.stringify(solved.collars) !== JSON.stringify(fixedCells))
    problems.push(`${id}: collars ${solved.collars} on the solve, fixed gems at ${fixedCells}`);
  return problems;
}

// One test per altar: each gets its own time budget and they spread across workers, so a
// loaded machine can't push a single 16-altar walk past the timeout.
for (const id of ORDER) {
  test(`${id}, solved: same turns, only the powered gems lit, fixed gems keep the collar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await solveAndCompare(page, id)).toEqual([]);
  });
}

test.describe('phone', () => {
  test.use({ viewport: { width: 915, height: 360 }, isMobile: true, hasTouch: true });
  test('the Furnace solved on a phone: same turns, the Amplify off the route dark', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await solveAndCompare(page, 'furnace')).toEqual([]);
  });
});
