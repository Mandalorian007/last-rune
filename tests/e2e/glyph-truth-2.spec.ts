import { expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS, type MachineId } from '../../games/last-rune/rules/types';
import type { AltarLayout } from '../../games/last-rune/scenes/altar/layout';
import { GEM_WGSL } from '../../games/last-rune/shaders/gem-wgsl';
import { playOrder } from './altar-audit';
import { DEV_URL, waitFrames } from './helpers';

// glyph-truth-2 (D-027, D-040 addendum 8, blind review 7):
//  - a straight gem is drawn along the run it sits on, never across it (Lift Shaft's rails,
//    Capacitor Bay's ice), and every tray gem is drawn at one turn, as the Codex draws it;
//  - Undo, Clear and Turn read disabled when a tap would do nothing, and Turn names its gem;
//  - the Split's input and the Gate's two inputs are solid inlet marks on the rim.

const ORDER = playOrder();

test.setTimeout(300_000);

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.use({ viewport: { width: 667, height: 320 }, isMobile: true, hasTouch: true });

async function open(page: Page, id: MachineId) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  await page.evaluate(
    ({ id, solved }) => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { [id]: { attempts: 0, placements: [] } };
      });
      g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, solved: ORDER.slice(0, ORDER.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForFunction(() => !!(window as G).__altarLayout);
  await waitFrames(page, 10);
}

/** Each board gem's axis (0 upright, 1 level) by cell. */
function axes(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const out: Record<string, number> = {};
    for (const b of (window as G).__altarView.board)
      out[`${b.cell.x},${b.cell.y}`] = ((Math.round(b.rotTarget) % 2) + 2) % 2;
    return out;
  });
}

test('straight gems lie along their run; tray gems are drawn at one turn everywhere', async ({
  page,
}) => {
  const problems: string[] = [];
  await open(page, 'lift-shaft');
  let a = await axes(page);
  for (const c of ['1,0', '4,0', '2,4', '3,4', '4,4'])
    if (a[c] !== 1) problems.push(`lift-shaft ${c} drawn upright on a level run`);
  for (const c of ['0,1', '0,3', '5,1', '5,3'])
    if (a[c] !== 0) problems.push(`lift-shaft ${c} drawn level on an upright run`);
  await open(page, 'capacitor-bay');
  a = await axes(page);
  if (a['5,2'] !== 1) problems.push('capacitor-bay 5,2 drawn upright on a level run');
  for (const id of MACHINE_IDS) {
    await open(page, id);
    const rots = await page.evaluate(() =>
      (window as G).__altarView.tray.map((t: G) => `${t.kind}:${t.rot}`),
    );
    for (const r of rots) if (!r.endsWith(':0')) problems.push(`${id}: tray ${r}`);
  }
  expect(problems).toEqual([]);
});

test('Undo, Clear and Turn are disabled when a tap would do nothing; Turn names its gem', async ({
  page,
}) => {
  await open(page, 'boiler-room');
  const undo = page.locator('[data-action="undo"]');
  const clear = page.locator('[data-action="clear"]');
  const turn = page.locator('.lr-altar-turnbtn');
  await expect(undo).toBeDisabled();
  await expect(clear).toBeDisabled();
  await expect(turn).toBeDisabled();
  // A disabled rail button looks it: no solid plate and a dashed edge.
  const look = await undo.evaluate((e) => getComputedStyle(e).borderTopStyle);
  expect(look).toBe('dashed');

  const L = await page.evaluate(
    () => (window as unknown as { __altarLayout: AltarLayout }).__altarLayout,
  );
  const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
  const k = ob.width / 1920;
  const hold = async (gem: string) => {
    const s = L.tray.find((t) => t.gem === gem)!;
    await page.touchscreen.tap(ob.x + s.x * k, ob.y + s.y * k);
    await page.waitForFunction((g) => (window as G).__altarView?.held?.kind === g, gem);
    await waitFrames(page, 4);
  };
  const kinds = L.tray.map((t) => t.gem);
  const turner = kinds.find((g) => g === 'bend' || g === 'gate' || g === 'split');
  const straight = kinds.find((g) => g === 'channel' || g === 'amplify' || g === 'capacitor');
  expect(turner, 'boiler-room has a gem that turns in its tray').toBeTruthy();
  await hold(turner!);
  await expect(turn).toBeEnabled();
  await expect(turn.locator('.lr-turn-what')).toHaveText(/\S/);
  await expect(turn).toHaveAttribute('aria-label', /Turn the \w+/);
  if (straight) {
    await hold(straight);
    await expect(turn).toBeDisabled();
    await expect(turn.locator('.lr-turn-what')).toHaveText('');
  }
});

test("the Split's and the Gate's inputs are inlet marks on the rim, not door bars", () => {
  // The glyph SDF's branch for one kind (params.x: 2 split, 4 gate), up to the next kind's.
  const branch = (kind: number) => {
    const at = GEM_WGSL.indexOf(`if (kind == ${kind})`);
    expect(at, `kind ${kind} branch`).toBeGreaterThan(0);
    return GEM_WGSL.slice(at, GEM_WGSL.indexOf(`if (kind == ${kind + 1})`, at));
  };
  const inlets = (src: string) => (src.match(/g_inlet\(p,/g) ?? []).length;
  expect(GEM_WGSL).toContain('fn g_inlet(');
  expect(inlets(branch(2)), 'Split: one input').toBe(1);
  expect(inlets(branch(4)), 'Gate: two inputs').toBe(2);
  for (const k of [0, 1, 3]) expect(inlets(branch(k)), `kind ${k} has no input mark`).toBe(0);
});
