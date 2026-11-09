import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { pagesFound, pagesUnlockedBy } from '../../games/last-rune/content/journal';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { isRotational, type Placement } from '../../games/last-rune/rules';
import {
  availableMachines,
  getMachine,
  initialState,
  type ProgressState,
  solveMachine,
} from '../../games/last-rune/rules/progression';
import { GEM_KINDS, type MachineId } from '../../games/last-rune/rules/types';
import { deriveHall, focusOrder } from '../../games/last-rune/scenes/hall/hall-state';
import { cursorKeys, nextGem, turnKeys } from './altar-keys';
import { PREVIEW_URL, pressKey, readSave, trackProblems, waitFrames } from './helpers';

// Full run of the production build with real input only: title → hall → all 16 machines, in
// the order the hall unlocks them. Keyboard only (no dev handles, no save seeding), so the
// test survives hall and altar art changes: it finds alcoves by the hall's name plate, not by
// pixel position. One shared page plays the whole game; it is split into serial tests so
// each stays well under the 5-minute budget.
//
// PLAYTEST_OUT=<dir> also records the playtest data behind docs/design/playtest-report.md:
// screenshots at each beat (1280x720 and itch's 960x540), per-machine timings, frame times
// during the strike, and a DOM audit for overlapping or clipped text. See scripts/playtest/.

const PLAYTEST_OUT = process.env.PLAYTEST_OUT ? resolve(process.env.PLAYTEST_OUT) : null;

/**
 * FULL_RUN_DEVICE=ipad|phone plays the same run in a touch device's window (harden-app: zero
 * console errors on desktop, iPad and a phone). Keys still drive it. Default: desktop 1280×720.
 */
const DEVICES = {
  desktop: { viewport: { width: 1280, height: 720 } },
  ipad: { viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 2 },
  phone: {
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  },
} as const;
const DEVICE = DEVICES[(process.env.FULL_RUN_DEVICE ?? 'desktop') as keyof typeof DEVICES];

/**
 * The play order: walk the hall front to back and restore the first open machine each time,
 * the way a player who follows the glow would. Derived from the rules so it tracks the graph.
 */
function playOrder(): MachineId[] {
  const order: MachineId[] = [];
  let state: ProgressState = initialState();
  for (;;) {
    const open = new Set(availableMachines(state).map((m) => m.id));
    const next = focusOrder(deriveHall(state)).find((id) => open.has(id));
    if (!next) return order;
    order.push(next);
    state = solveMachine(state, next);
  }
}

const ORDER = playOrder();
const FINAL: MachineId = 'the-last-rune';
/** story-scenes' ending screen (an ARIA region named "Ending"). */
const ending = () => page.locator('.lr-ending');
const CHUNKS = [ORDER.slice(0, 4), ORDER.slice(4, 8), ORDER.slice(8, 12), ORDER.slice(12)];

interface MachineMetrics {
  n: number;
  machine: MachineId;
  board: string;
  gems: number;
  keyPresses: number;
  placeMs: number;
  strikeMs: number;
  wakeMs: number;
  solveCardMs: number;
  strikeFrames: { frames: number; avgMs: number; p95Ms: number; maxMs: number; over33: number };
  audit: AuditIssue[];
  pages: number;
  unlockedAfter: MachineId[];
}

interface AuditIssue {
  viewport: string;
  beat: string;
  kind: 'overlap' | 'clipped' | 'offscreen';
  what: string;
}

const metrics: MachineMetrics[] = [];
const consoleLog: string[] = [];
let context: BrowserContext;
let page: Page;
let problems: string[];
let shot = 0;

// ── Page instrumentation ─────────────────────────────────────────────────────

/** Frame-time recorder (test-side only; the game exposes nothing in production). */
function installFrameRecorder() {
  const w = window as unknown as { __ptFrames: number[] };
  w.__ptFrames = [];
  const loop = (t: number) => {
    w.__ptFrames.push(t);
    if (w.__ptFrames.length > 20_000) w.__ptFrames.splice(0, 10_000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function frameMark(): Promise<number> {
  return page.evaluate(() => (window as unknown as { __ptFrames: number[] }).__ptFrames.length);
}

async function frameStats(from: number) {
  const ts = await page.evaluate(
    (from) => (window as unknown as { __ptFrames: number[] }).__ptFrames.slice(from),
    from,
  );
  const dts = ts
    .slice(1)
    .map((t, i) => t - ts[i]!)
    .sort((a, b) => a - b);
  if (dts.length === 0) return { frames: 0, avgMs: 0, p95Ms: 0, maxMs: 0, over33: 0 };
  const avg = dts.reduce((s, d) => s + d, 0) / dts.length;
  const r = (x: number) => Math.round(x * 10) / 10;
  return {
    frames: dts.length,
    avgMs: r(avg),
    p95Ms: r(dts[Math.floor(dts.length * 0.95)]!),
    maxMs: r(dts[dts.length - 1]!),
    over33: dts.filter((d) => d > 33.4).length,
  };
}

/** Overlapping, clipped or off-screen UI text, as a player would see it. */
async function audit(beat: string): Promise<AuditIssue[]> {
  const viewport = `${page.viewportSize()?.width}x${page.viewportSize()?.height}`;
  const found = await page.evaluate(() => {
    const out: { kind: 'overlap' | 'clipped' | 'offscreen'; what: string }[] = [];
    const sel = [
      '.lr-altar-title',
      '.lr-altar-actions',
      '.lr-altar-verdict',
      '.lr-altar-need',
      '.lr-altar-count',
      '.lr-altar-hint',
      '.lr-altar-tag',
      '.lr-altar-tip',
      '.lr-hud',
      '.lr-nameplate',
      '.tc-caption',
      '.lr-solve-card',
      '.lr-page-note',
      '.lr-solve-continue',
    ];
    const vis = (el: Element) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        s.display !== 'none' &&
        s.visibility !== 'hidden' &&
        Number(s.opacity) > 0.05 &&
        r.width > 0 &&
        r.height > 0 &&
        !(el as HTMLElement).closest('[hidden]')
      );
    };
    const label = (el: Element) =>
      `${el.className.toString().split(' ')[0]}「${(el.textContent ?? '').trim().slice(0, 40)}」`;
    const els = sel.flatMap((s) => [...document.querySelectorAll(s)]).filter(vis);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) {
        out.push({
          kind: 'offscreen',
          what: `${label(el)} at ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`,
        });
      }
      const h = el as HTMLElement;
      if (h.scrollWidth > h.clientWidth + 2 && getComputedStyle(h).overflowX !== 'visible') {
        out.push({ kind: 'clipped', what: `${label(el)} ${h.scrollWidth}>${h.clientWidth}px` });
      }
    }
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i]!;
        const b = els[j]!;
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 2 && oy > 2) {
          out.push({
            kind: 'overlap',
            what: `${label(a)} × ${label(b)} (${Math.round(ox)}×${Math.round(oy)}px)`,
          });
        }
      }
    }
    return out;
  });
  return found.map((f) => ({ ...f, viewport, beat }));
}

/** Screenshot + DOM audit at 1280x720 and 960x540 (playtest mode only). */
async function beat(name: string, issues?: AuditIssue[]) {
  if (!PLAYTEST_OUT) return;
  const tag = `${String(++shot).padStart(3, '0')}-${name}`;
  await page.screenshot({ path: join(PLAYTEST_OUT, `${tag}.png`) });
  issues?.push(...(await audit(name)));
  await page.setViewportSize({ width: 960, height: 540 });
  await waitFrames(page, 4);
  await page.screenshot({ path: join(PLAYTEST_OUT, `${tag}-960.png`) });
  issues?.push(...(await audit(name)));
  await page.setViewportSize({ width: 1280, height: 720 });
  await waitFrames(page, 4);
}

// ── Driving the game ─────────────────────────────────────────────────────────

async function plate(): Promise<{ name: string; note: string } | null> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.lr-nameplate');
    if (!el || el.hidden) return null;
    return {
      name: el.querySelector('span')?.textContent ?? '',
      note: el.querySelector('small')?.textContent ?? '',
    };
  });
}

/** Hall → altar: ArrowRight walks the alcoves until the name plate names the machine. */
async function openAltar(machine: MachineId): Promise<number> {
  const name = getMachine(machine).name;
  let presses = 0;
  for (; presses < 40; presses++) {
    if ((await plate())?.name === name) break;
    await pressKey(page, 'ArrowRight');
  }
  expect((await plate())?.name, `hall focus never reached ${name}`).toBe(name);
  expect((await plate())?.note).toMatch(/open/i);
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible();
  await expect(page.locator('.lr-altar-title')).toContainText(name);
  return presses + 1;
}

/** The altar's keyboard cursor (`data-cursor="x,y"` on `.lr-altar`). */
async function altarCursor(page: Page): Promise<{ x: number; y: number }> {
  const v = await page.locator('.lr-altar').getAttribute('data-cursor');
  const [x, y] = (v ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
}

/**
 * Build the intended solution with the keyboard, the way a player follows the wire: place the
 * gem on the wire's open end next (else the nearest), 1-6 takes it, R/Q turn it, then the
 * fewest arrows and G (jump to the wire's open end) reach its socket, and Enter places it.
 */
async function buildSolution(machine: MachineId): Promise<number> {
  const p = puzzleFor(machine);
  const tray = GEM_KINDS.filter((k) => (p.tray[k] ?? 0) > 0);
  let presses = 0;
  const press = async (key: string, times = 1) => {
    presses += times;
    await pressKey(page, key, times);
  };
  const todo = [...p.design.intended];
  const placed: Placement[] = [];
  while (todo.length) {
    const g = todo.splice(nextGem(p, placed, todo, await altarCursor(page)), 1)[0]!;
    const slot = tray.indexOf(g.gem);
    expect(slot, `${machine}: ${g.gem} not in tray`).toBeGreaterThanOrEqual(0);
    await press(`Digit${slot + 1}`);
    // Taking a gem may move the cursor on to the wire's open end; plan from where it is.
    for (const k of cursorKeys(p, placed, await altarCursor(page), g.cell)) await press(k);
    expect(await altarCursor(page), `${machine}: cursor missed ${g.gem}`).toEqual(g.cell);
    // R turns the gem under the cursor: the held gem, shown in the socket it will land in.
    for (const k of turnKeys(isRotational(g.gem) ? g.rot : 0)) await press(k);
    await press('Enter');
    placed.push({ gem: g.gem, cell: g.cell, rot: g.rot });
  }
  return presses;
}

async function titleToHall() {
  await page.goto(PREVIEW_URL);
  await expect(page.locator('[data-action="play"]')).toBeVisible();
  await waitFrames(page, 10);
  await beat('title');
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-title-screen')).toHaveCount(0);
  await expect(page.locator('.lr-hud')).toBeVisible();
  const save = await readSave(page);
  expect(save?.progress.solved).toEqual([]);
  await waitFrames(page, 10);
  await beat('hall-first-entry');
}

async function solve(machine: MachineId) {
  const n = metrics.length + 1;
  const p = puzzleFor(machine);
  const before = (await readSave(page))?.progress.solved ?? [];
  const issues: AuditIssue[] = [];

  const hallPresses = await openAltar(machine);
  await waitFrames(page, 6);
  await beat(`${String(n).padStart(2, '0')}-${machine}-open`, issues);

  const t0 = Date.now();
  const placePresses = await buildSolution(machine);
  const placeMs = Date.now() - t0;
  // Placements save on a short debounce.
  await expect
    .poll(async () => (await readSave(page))?.puzzles[machine]?.placements.length, {
      timeout: 5_000,
    })
    .toBe(p.design.intended.length);
  await beat(`${String(n).padStart(2, '0')}-${machine}-placed`, issues);

  // Strike at normal speed (no fast-forward): what a first-time player sits through.
  const f0 = await frameMark();
  const s0 = Date.now();
  await page.keyboard.press('KeyF', { delay: 50 });
  if (PLAYTEST_OUT) {
    // One mid-bolt screenshot, taken on the game's clock: a few frames after the press.
    await waitFrames(page, 30);
    if (await page.locator('.lr-altar-verdict').isHidden()) {
      await page.screenshot({
        path: join(PLAYTEST_OUT, `${String(++shot).padStart(3, '0')}-${n}-${machine}-bolt.png`),
      });
    }
  }
  // The verdict's outcome is read in the frame it shows: an exact verdict stays up only 1.5 s
  // of game time before the altar closes, so a second, later look can find it already gone.
  const outcome = await page.waitForFunction(
    () => {
      const v = document.querySelector<HTMLElement>('.lr-altar-verdict');
      return v && !v.hidden ? (v.dataset.outcome ?? '') : null;
    },
    null,
    { polling: 'raf', timeout: 60_000 },
  );
  const strikeMs = Date.now() - s0;
  expect(await outcome.jsonValue()).toBe('exact');
  const strikeFrames = await frameStats(f0);
  if (PLAYTEST_OUT) {
    await page.screenshot({
      path: join(PLAYTEST_OUT, `${String(++shot).padStart(3, '0')}-${n}-${machine}-verdict.png`),
    });
    issues.push(...(await audit(`${machine}-verdict`)));
  }
  const w0 = Date.now();
  await expect(page.locator('.lr-solve')).toBeVisible({ timeout: 20_000 });
  const wakeMs = Date.now() - w0;

  // The save is written at the solve moment.
  const save = await readSave(page);
  expect(save?.progress.solved).toEqual([...before, machine]);
  expect(save?.puzzles[machine]?.attempts).toBe(1);

  // Let the card play out on its own (no skip), as a first-time player would see it.
  const c0 = Date.now();
  await expect(page.locator('.lr-solve-continue')).toBeVisible({ timeout: 15_000 });
  const solveCardMs = Date.now() - c0;
  // Journal pages land on the card after Continue shows (2.4 s vs 1.6 s); wait for them.
  const pages = pagesUnlockedBy(machine).length;
  if (pages > 0) await expect(page.locator('.lr-page-note')).toBeVisible({ timeout: 10_000 });
  expect(save?.journal?.found).toEqual(
    expect.arrayContaining(pagesUnlockedBy(machine).map((p) => p.page)),
  );
  await waitFrames(page, 10);
  await beat(`${String(n).padStart(2, '0')}-${machine}-solve`, issues);

  // Continue to the hall.
  await pressKey(page, 'Enter');
  if (await page.locator('.lr-solve').count()) await pressKey(page, 'Enter');
  await expect(page.locator('.lr-solve')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('.lr-altar')).toHaveCount(0);
  if (machine === FINAL) {
    // The last solve hands over to the ending (played through to the end card in ending.spec.ts).
    await expect(ending()).toBeAttached({ timeout: 10_000 });
    await expect(page.locator('.lr-hud')).toBeHidden();
    await waitFrames(page, 20);
    await beat(`${String(n).padStart(2, '0')}-${machine}-after`, issues);
  } else {
    await expect(page.locator('.lr-hud')).toBeVisible();
    await waitFrames(page, 20);
    await beat(`${String(n).padStart(2, '0')}-${machine}-hall-after`, issues);
  }

  const after = (await readSave(page))?.progress.solved ?? [];
  const state: ProgressState = { solved: after as MachineId[] };
  metrics.push({
    n,
    machine,
    board: p.altar,
    gems: p.design.intended.length,
    keyPresses: hallPresses + placePresses + 1,
    placeMs,
    strikeMs,
    wakeMs,
    solveCardMs,
    strikeFrames,
    audit: issues,
    pages,
    unlockedAfter: availableMachines(state).map((m) => m.id),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('full run (prod build, keyboard only)', () => {
  test.beforeAll(async ({ browser }) => {
    if (PLAYTEST_OUT) mkdirSync(PLAYTEST_OUT, { recursive: true });
    if (!DEVICE) throw new Error(`FULL_RUN_DEVICE: one of ${Object.keys(DEVICES).join(', ')}`);
    context = await browser.newContext(DEVICE);
    page = await context.newPage();
    await page.addInitScript(installFrameRecorder);
    problems = trackProblems(page);
    page.on('console', (m) => {
      if (m.type() === 'warning' || m.type() === 'error')
        consoleLog.push(`${m.type()}: ${m.text()}`);
    });
  });

  test.afterAll(async () => {
    if (PLAYTEST_OUT) {
      writeFileSync(
        join(PLAYTEST_OUT, 'metrics.json'),
        `${JSON.stringify({ order: ORDER, metrics, console: consoleLog, problems }, null, 2)}\n`,
      );
    }
    await context?.close();
  });

  test('play order covers all 16 machines', () => {
    expect(ORDER).toHaveLength(16);
    expect(new Set(ORDER).size).toBe(16);
    expect(ORDER[0]).toBe('intake-desk');
    expect(ORDER.slice(-2)).toEqual(['control-booth', 'the-last-rune']);
  });

  CHUNKS.forEach((chunk, i) => {
    test(`machines ${i * 4 + 1}-${i * 4 + chunk.length}: ${chunk.join(', ')}`, async () => {
      test.setTimeout(PLAYTEST_OUT ? 600_000 : 240_000);
      if (i === 0) await titleToHall();
      for (const m of chunk) await solve(m);
      expect(problems).toEqual([]);
    });
  });

  test('all 16 machines end solved, and the save survives a reload', async () => {
    const save = await readSave(page);
    expect(save?.progress.solved).toEqual(ORDER);
    for (const m of ORDER) expect(save?.puzzles[m]?.attempts).toBe(1);
    expect([...(save?.journal?.found ?? [])].sort((a, b) => a - b)).toEqual(
      pagesFound(ORDER).map((p) => p.page),
    );
    // Reload: the title now offers Continue, and continuing lands in a fully restored hall.
    await page.reload();
    await expect(page.locator('[data-action="continue"]')).toBeVisible();
    await waitFrames(page, 10);
    await pressKey(page, 'Enter');
    await expect(page.locator('.lr-hud')).toBeVisible();
    await waitFrames(page, 20);
    await beat('hall-complete');
    expect((await readSave(page))?.progress.solved).toEqual(ORDER);
    expect(problems).toEqual([]);
  });
});
