/**
 * The Last Rune in the desktop shell (D-042, ws/last-rune-desktop): the production build
 * (dist/) served by the ThunderClap Electron shell (packages/host-electron, unpackaged, with
 * `TC_RENDERER_DIR`), driven by Playwright's Electron driver with real input only.
 *
 * - Title → hall → intake-desk → solve, with the save written to the shell's localStorage.
 * - Settings' desktop-only Quit closes the app; a relaunch offers Continue with the solve kept.
 * - The title's Ko-fi link opens in the system browser (shell.openExternal, stubbed) and its
 *   Copy link reaches the system clipboard; window fullscreen keeps the game filling the window.
 *
 * Run with `pnpm test:e2e:desktop` (scripts/desktop/e2e.mjs builds what it needs).
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from '@playwright/test';
import { coffeeLink } from '../../games/last-rune/content/ending';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { isRotational, type Placement } from '../../games/last-rune/rules';
import { getMachine } from '../../games/last-rune/rules/progression';
import { GEM_KINDS, type MachineId } from '../../games/last-rune/rules/types';
import { cursorKeys, nextGem, turnKeys } from '../e2e/altar-keys';
import { pressKey, readSave, trackProblems, waitFrames } from '../e2e/helpers';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const shell = join(root, 'packages/host-electron');
const SHOTS = join(root, 'docs/design/screens/local');
/** The Electron binary the shell's `electron` devDependency downloaded. */
const electronBin = createRequire(join(shell, 'package.json'))('electron') as unknown as string;
const MACHINE: MachineId = 'intake-desk';

let userData = '';
test.beforeAll(() => {
  userData = mkdtempSync(join(tmpdir(), 'lr-desktop-'));
  mkdirSync(SHOTS, { recursive: true });
});
test.afterAll(() => {
  rmSync(userData, { recursive: true, force: true });
});

async function launch(): Promise<{ app: ElectronApplication; page: Page; problems: string[] }> {
  const app = await electron.launch({
    executablePath: electronBin,
    args: [shell],
    cwd: shell,
    env: {
      ...process.env,
      TC_USER_DATA: userData,
      TC_RENDERER_DIR: join(root, 'dist'),
    } as Record<string, string>,
  });
  const page = await app.firstWindow();
  const problems = trackProblems(page);
  await expect(page.locator('[data-action="play"], [data-action="continue"]').first()).toBeVisible({
    timeout: 30_000,
  });
  await waitFrames(page, 10);
  return { app, page, problems };
}

/** Stub shell.openExternal in the main process: record the URL instead of opening a browser. */
async function stubOpen(app: ElectronApplication): Promise<() => Promise<string[]>> {
  await app.evaluate(({ shell: s }) => {
    const g = globalThis as unknown as { __opened: string[] };
    g.__opened = [];
    s.openExternal = async (url: string) => {
      g.__opened.push(url);
    };
  });
  return () => app.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened);
}

async function altarCursor(page: Page): Promise<{ x: number; y: number }> {
  const v = await page.locator('.lr-altar').getAttribute('data-cursor');
  const [x, y] = (v ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
}

/** Hall → altar: ArrowRight walks the alcoves until the name plate names the machine. */
async function openAltar(page: Page, machine: MachineId): Promise<void> {
  const name = getMachine(machine).name;
  const plate = () =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.lr-nameplate');
      return el && !el.hidden ? (el.querySelector('span')?.textContent ?? '') : null;
    });
  for (let i = 0; i < 40 && (await plate()) !== name; i++) await pressKey(page, 'ArrowRight');
  expect(await plate(), `hall focus never reached ${name}`).toBe(name);
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar-title')).toContainText(name);
}

/** Places the intended solution with the keyboard, the way full-run.spec.ts does. */
async function buildSolution(page: Page, machine: MachineId): Promise<void> {
  const p = puzzleFor(machine);
  const tray = GEM_KINDS.filter((k) => (p.tray[k] ?? 0) > 0);
  const todo = [...p.design.intended];
  const placed: Placement[] = [];
  while (todo.length) {
    const g = todo.splice(nextGem(p, placed, todo, await altarCursor(page)), 1)[0]!;
    await pressKey(page, `Digit${tray.indexOf(g.gem) + 1}`);
    for (const k of cursorKeys(p, placed, await altarCursor(page), g.cell)) {
      await pressKey(page, k);
    }
    expect(await altarCursor(page)).toEqual(g.cell);
    for (const k of turnKeys(isRotational(g.gem) ? g.rot : 0)) await pressKey(page, k);
    await pressKey(page, 'Enter');
    placed.push({ gem: g.gem, cell: g.cell, rot: g.rot });
  }
}

test.describe.configure({ mode: 'serial' });

test('title → intake-desk → solve, then Quit; the save survives a relaunch', async () => {
  test.setTimeout(180_000);
  let { app, page, problems } = await launch();
  // The page runs on the shell's fixed origin, with the bridge and no Node.
  expect(page.url()).toBe('app://bundle/');
  expect(
    await page.evaluate(() => ({
      bridge: typeof (window as unknown as { thunderclap?: unknown }).thunderclap,
      node: typeof (window as unknown as { process?: unknown }).process,
    })),
  ).toEqual({ bridge: 'object', node: 'undefined' });
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle()))
    .toBe('The Last Rune');
  await page.screenshot({ path: join(SHOTS, 'desktop-title.png') });

  // Title → hall (a new game: nothing solved yet).
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-title-screen')).toHaveCount(0);
  await expect(page.locator('.lr-hud')).toBeVisible();
  expect((await readSave(page))?.progress.solved).toEqual([]);

  // Hall → altar → solve.
  await openAltar(page, MACHINE);
  await buildSolution(page, MACHINE);
  await page.keyboard.press('KeyF', { delay: 50 });
  const verdict = page.locator('.lr-altar-verdict');
  await expect(verdict).toBeVisible({ timeout: 60_000 });
  await expect(verdict).toHaveAttribute('data-outcome', 'exact');
  await expect(page.locator('.lr-solve')).toBeVisible({ timeout: 20_000 });
  expect((await readSave(page))?.progress.solved).toEqual([MACHINE]);
  await expect(page.locator('.lr-solve-continue')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: join(SHOTS, 'desktop-solve.png') });
  await pressKey(page, 'Enter');
  if (await page.locator('.lr-solve').count()) await pressKey(page, 'Enter');
  await expect(page.locator('.lr-hud')).toBeVisible({ timeout: 10_000 });

  // Settings has the desktop-only Quit; it saves and closes the app.
  await pressKey(page, 'KeyO');
  const quit = page.getByRole('button', { name: 'Quit game' });
  await expect(quit).toBeVisible();
  await page.screenshot({ path: join(SHOTS, 'desktop-settings-quit.png') });
  expect(problems).toEqual([]);
  const closed = app.waitForEvent('close');
  await quit.click();
  await closed;

  // Relaunch on the same userData: the title offers Continue and the solve is still there.
  ({ app, page, problems } = await launch());
  try {
    await expect(page.locator('[data-action="continue"]')).toBeVisible();
    expect((await readSave(page))?.progress.solved).toEqual([MACHINE]);
    await pressKey(page, 'Enter');
    await expect(page.locator('.lr-hud')).toBeVisible();
    expect(problems).toEqual([]);
  } finally {
    await app.close();
  }
});

test('links and fullscreen go through the host', async () => {
  const { app, page, problems } = await launch();
  const before = await app.evaluate(({ clipboard }) => clipboard.readText());
  try {
    const opened = await stubOpen(app);
    const kofi = coffeeLink()?.href;
    expect(kofi).toMatch(/^https:\/\//);

    // A mouse click on the Ko-fi link opens the system browser, not a window in the app.
    await page.locator('[data-action="title-coffee"]').click();
    await expect.poll(opened).toEqual([kofi]);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    expect(page.url()).toBe('app://bundle/');

    // Copy link reaches the system clipboard through the bridge.
    const copy = page.locator('[data-action="title-coffee-copy"]');
    await copy.click();
    await expect(copy).toHaveText(/Copied/);
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(kofi);

    // Window fullscreen (the macOS menu, F11 elsewhere): the canvas follows the window.
    const fs = (on: boolean) =>
      page.evaluate(
        (v) =>
          (
            window as unknown as {
              thunderclap: { fullscreen: { set(on: boolean): Promise<boolean> } };
            }
          ).thunderclap.fullscreen.set(v),
        on,
      );
    expect(await fs(true)).toBe(true);
    await expect
      .poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight]))
      .toEqual(
        await app.evaluate(({ screen }) => [
          screen.getPrimaryDisplay().size.width,
          screen.getPrimaryDisplay().size.height,
        ]),
      );
    await waitFrames(page, 10);
    const canvas = await page.locator('#app canvas').first().boundingBox();
    const view = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    // Letterboxed 16:9: one side fills the window.
    expect(
      Math.abs((canvas?.width ?? 0) - view.w) < 2 || Math.abs((canvas?.height ?? 0) - view.h) < 2,
    ).toBe(true);
    await page.screenshot({ path: join(SHOTS, 'desktop-fullscreen.png') });
    expect(await fs(false)).toBe(false);
    expect(problems).toEqual([]);
  } finally {
    await app.evaluate(({ clipboard }, t) => clipboard.writeText(t), before);
    await app.close();
  }
});
