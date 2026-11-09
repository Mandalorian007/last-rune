/// <reference types="@webgpu/types" />
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import { isRotational, type Placement } from '../../games/last-rune/rules';
import { GEM_KINDS } from '../../games/last-rune/rules/types';
import { cursorKeys } from './altar-keys';
import {
  DEV_URL,
  PREVIEW_URL,
  pressKey,
  readSave,
  trackProblems,
  waitForBoot,
  waitFrames,
} from './helpers';

// harden-app (D-053): the production build in the browsers real players bring. GPU failures at
// boot and mid-run, storage that throws, an uncaught error, the GitHub Pages sub-path with no
// request leaving the origin, back/forward, and a resize in the middle of placing a gem.
// HARDEN_OUT=<dir> writes a screenshot of each message a player can see.

const OUT = process.env.HARDEN_OUT ? resolve(process.env.HARDEN_OUT) : null;
/** GitHub Pages serves the game here (`https://mandalorian007.github.io/last-rune/`). */
const SUB = `${PREVIEW_URL}/last-rune/`;

async function shot(page: Page, name: string) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

async function toTitle(page: Page, url = PREVIEW_URL) {
  await page.goto(url);
  await waitForBoot(page);
  await expect(page.locator('.lr-title-menu').first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
}

async function toHall(page: Page) {
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-hud')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);
}

async function toFirstAltar(page: Page) {
  await toHall(page);
  await pressKey(page, 'ArrowRight');
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(400);
}

async function cursor(page: Page) {
  const v = await page.locator('.lr-altar').getAttribute('data-cursor');
  const [x, y] = (v ?? '0,0').split(',').map(Number);
  return { x: x!, y: y! };
}

/** Key in intake-desk's intended solution; `between` runs after each gem is taken up. */
async function buildIntake(page: Page, between?: (i: number) => Promise<void>) {
  const p = puzzleFor('intake-desk');
  const tray = GEM_KINDS.filter((k) => (p.tray[k] ?? 0) > 0);
  const placed: Placement[] = [];
  for (const [i, g] of p.design.intended.entries()) {
    await pressKey(page, `Digit${tray.indexOf(g.gem) + 1}`);
    await between?.(i);
    for (const k of cursorKeys(p, placed, await cursor(page), g.cell)) await pressKey(page, k);
    if (isRotational(g.gem)) await pressKey(page, 'KeyR', g.rot);
    await pressKey(page, 'Enter');
    placed.push({ gem: g.gem, cell: g.cell, rot: g.rot });
  }
  await expect
    .poll(async () => (await readSave(page))?.puzzles['intake-desk']?.placements.length)
    .toBe(p.design.intended.length);
}

// ── GPU ──────────────────────────────────────────────────────────────────────

test('requestDevice() failing shows the WebGPU screen, not a blank page', async ({ page }) => {
  await page.addInitScript(() => {
    GPUAdapter.prototype.requestDevice = async () => {
      throw new DOMException('test: device refused', 'OperationError');
    };
  });
  const problems = trackProblems(page);
  await page.goto(PREVIEW_URL);
  await waitForBoot(page);
  const card = page.locator('.engine-msg');
  await expect(card).toContainText('WebGPU is not available');
  await expect(card).toContainText(/Chrome|Safari/);
  await expect(page.locator('#app canvas')).toHaveCount(0);
  await shot(page, 'no-device');
  expect(problems).toEqual([]);
});

/** Hands the page a `__loseDevice()` that resolves the engine's `device.lost` as a real loss. */
async function stubDeviceLoss(page: Page) {
  await page.addInitScript(() => {
    const real = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (this: GPUAdapter, d) {
      const dev = await real.call(this, d);
      let fire: (info: unknown) => void = () => {};
      const lost = new Promise((r) => {
        fire = r;
      });
      Object.defineProperty(dev, 'lost', { value: lost });
      (window as unknown as { __loseDevice: () => void }).__loseDevice = () =>
        fire({ reason: 'unknown', message: 'GPU process restarted' });
      return dev;
    };
  });
}

test('losing the GPU mid-run says so, offers Reload, and Reload continues the game', async ({
  page,
}) => {
  await stubDeviceLoss(page);
  const problems = trackProblems(page);
  await toTitle(page);
  await toFirstAltar(page);
  await pressKey(page, 'Digit1');
  await pressKey(page, 'Enter');
  await page.evaluate(() => (window as unknown as { __loseDevice: () => void }).__loseDevice());
  const card = page.locator('.engine-msg');
  await expect(card).toContainText('The lights went out');
  await expect(card).toContainText('progress is saved');
  await shot(page, 'device-lost');
  // Keys behind the card do nothing; the card's button has focus.
  await expect(card.getByRole('button', { name: 'Reload' })).toBeFocused();
  await card.getByRole('button', { name: 'Reload' }).click();
  await waitForBoot(page);
  await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await toHall(page);
  expect((await readSave(page))?.puzzles['intake-desk']?.placements.length).toBeGreaterThan(0);
  // The loss itself is logged once (engine); nothing else.
  expect(problems.filter((p) => !p.includes('[gpu] device lost'))).toEqual([]);
});

test('a boot that throws shows a Reload card instead of a blank page', async ({ page }) => {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      ...rest: unknown[]
    ) {
      if (id === 'webgpu') throw new Error('test: context creation crashed');
      // biome-ignore lint/suspicious/noExplicitAny: forwarding the overloads
      return (real as any).call(this, id, ...rest);
    } as typeof real;
  });
  const problems = trackProblems(page);
  await page.goto(PREVIEW_URL);
  await waitForBoot(page);
  const card = page.locator('.engine-msg');
  await expect(card).toContainText('Something went wrong');
  await expect(card.getByRole('button')).toHaveText(['Reload']);
  await shot(page, 'boot-crash');
  expect(problems.filter((p) => !p.includes('[boot] failed'))).toEqual([]);
});

// ── Errors and storage ───────────────────────────────────────────────────────

test('an uncaught error shows a calm card; Keep playing goes on with the save intact', async ({
  page,
}) => {
  const problems = trackProblems(page);
  await toTitle(page);
  await toHall(page);
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('test fault');
    }, 0);
  });
  const card = page.locator('.engine-msg');
  await expect(card).toContainText('Something went wrong');
  await expect(card).toContainText('Your progress is saved');
  await shot(page, 'uncaught-error');
  await card.getByRole('button', { name: 'Keep playing' }).click();
  await expect(card).toHaveCount(0);
  // The hall still takes keys: the first door opens.
  await pressKey(page, 'ArrowRight');
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible({ timeout: 10_000 });
  expect(problems).toEqual(['pageerror: test fault']);
});

const STORAGE_FAULTS: [string, () => void][] = [
  [
    'access throws (blocked storage)',
    () => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('test: storage blocked', 'SecurityError');
        },
      });
    },
  ],
  [
    'writes throw (quota, old Safari private mode)',
    () => {
      Storage.prototype.setItem = () => {
        throw new DOMException('test: quota', 'QuotaExceededError');
      };
    },
  ],
];

for (const [what, fault] of STORAGE_FAULTS) {
  test(`localStorage ${what}: the game boots, says progress won't keep, and plays`, async ({
    page,
  }) => {
    await page.addInitScript(fault);
    const problems = trackProblems(page);
    await toTitle(page);
    await expect(page.locator('.tc-toast')).toContainText(/can.t be saved/);
    if (what.startsWith('access')) await shot(page, 'storage-blocked');
    await toFirstAltar(page);
    await pressKey(page, 'Digit1');
    await pressKey(page, 'Enter');
    await page.waitForTimeout(400);
    await expect(page.locator('.engine-msg')).toHaveCount(0);
    expect(problems).toEqual([]);
  });
}

// ── GitHub Pages sub-path and the network ────────────────────────────────────

/** Serve dist/ under /last-rune/ (as Pages does) and log every request the page makes. */
async function servePages(page: Page) {
  await page.route(`${SUB}**`, async (route) => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace(/^\/last-rune/, '');
    await route.fulfill({ response: await route.fetch({ url: url.toString() }) });
  });
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  return requests;
}

test('under /last-rune/ every asset resolves and no request leaves the sub-path', async ({
  page,
}) => {
  const requests = await servePages(page);
  const problems = trackProblems(page);
  await toTitle(page, SUB);
  await toFirstAltar(page);
  await buildIntake(page);
  await pressKey(page, 'KeyF');
  await expect(page.locator('.lr-solve')).toBeVisible({ timeout: 20_000 });
  // Files the page names but the browser may not fetch on its own (touch icon, share card).
  const linked = await page.evaluate(() => [
    ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')].map(
      (l) => l.href,
    ),
    new URL('social.jpg', document.baseURI).href,
  ]);
  expect(linked.length).toBe(2);
  for (const href of linked) {
    expect(href.startsWith(SUB), href).toBe(true);
    expect((await page.request.get(href)).status(), href).toBe(200);
  }
  // Zero external requests, and nothing reached for the server root: all of it is ours.
  const stray = requests.filter((u) => !u.startsWith(SUB) && !/^(data|blob):/.test(u));
  expect(stray).toEqual([]);
  expect(requests.length).toBeGreaterThanOrEqual(2); // the page and its one bundle
  expect(problems).toEqual([]);
});

test('back, forward and reload under /last-rune/ keep the game playable', async ({ page }) => {
  await servePages(page);
  const problems = trackProblems(page);
  await page.goto('about:blank');
  await toTitle(page, SUB);
  await toHall(page);
  await page.goBack();
  await page.goForward();
  await waitForBoot(page);
  // Restored from the back/forward cache (still in the hall) or reloaded (title, Continue).
  const hud = page.locator('.lr-hud');
  const cont = page.locator('[data-action="continue"]');
  await expect
    .poll(async () => (await hud.isVisible()) || (await cont.isVisible()), { timeout: 15_000 })
    .toBe(true);
  await page.waitForTimeout(600);
  test.info().annotations.push({
    type: 'forward',
    description: (await cont.isVisible()) ? 'reloaded' : 'bfcache',
  });
  if (await cont.isVisible()) await toHall(page);
  // Either way the hall still runs and takes keys: the first door opens.
  await pressKey(page, 'ArrowRight');
  await pressKey(page, 'Enter');
  await expect(page.locator('.lr-altar')).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await toHall(page);
  expect(problems).toEqual([]);
});

// ── Resize and rotate mid-placement ──────────────────────────────────────────

test('resizing and rotating with a gem in hand keeps the hold and the placement lands', async ({
  page,
}) => {
  const problems = trackProblems(page);
  await toTitle(page);
  await toFirstAltar(page);
  const sizes = [
    { width: 720, height: 1280 },
    { width: 960, height: 540 },
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
  ];
  await buildIntake(page, async (i) => {
    // Every gem: a different window between taking it up and setting it down.
    await page.setViewportSize(sizes[i % sizes.length]!);
    await page.waitForTimeout(250);
  });
  await pressKey(page, 'KeyF');
  await expect(page.locator('.lr-solve')).toBeVisible({ timeout: 20_000 });
  expect(problems).toEqual([]);
});

// ── Phone: rotate mid-placement, rapid taps (dev handles for the altar's layout) ─────────────

// biome-ignore lint/suspicious/noExplicitAny: dev handles
type G = any;
const LANDSCAPE = { width: 844, height: 390 };

test.describe('phone', () => {
  test.use({ viewport: LANDSCAPE, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  /** Design px of the altar layout to CSS px, read fresh (the layout moves on resize). */
  async function geometry(page: Page) {
    const L = await page.evaluate(() => (window as G).__altarLayout);
    const ob = (await page.locator('.tc-layer[data-layer="hud"]').boundingBox())!;
    const k = ob.width / 1920;
    const css = (x: number, y: number) => ({ x: ob.x + x * k, y: ob.y + y * k });
    return {
      slot: (i: number) => css(L.tray[i].x, L.tray[i].y),
      cell: (c: { x: number; y: number }) =>
        css(L.left + L.margin + L.pitch * (c.x + 0.5), L.top + L.margin + L.pitch * (c.y + 0.5)),
    };
  }
  const held = (page: Page) => page.evaluate(() => !!(window as G).__altarView?.held);
  const placed = (page: Page) =>
    page.evaluate(() => (window as G).__game.save.get().puzzles['intake-desk']?.placements ?? []);

  test('turning the phone with a gem in hand keeps it, and double taps never double-place', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await page.goto(DEV_URL);
    await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
      timeout: 30_000,
    });
    await page.evaluate(() => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.settings.captionSpeed = 'instant';
      });
      g.flow.newGame();
      g.fuse.hush();
      g.flow.openPuzzle('intake-desk');
    });
    await page.waitForFunction(() => !!(window as G).__altarLayout && !!(window as G).__altarView);
    await waitFrames(page, 10);
    const [first, second] = puzzleFor('intake-desk').design.intended;

    // A rapid double tap on a tray slot is take-then-let-go, never a stuck or doubled hold.
    let g = await geometry(page);
    const s = g.slot(0);
    await page.touchscreen.tap(s.x, s.y);
    await page.touchscreen.tap(s.x, s.y);
    await waitFrames(page, 6);
    expect(await held(page)).toBe(false);

    // Take a gem, turn the phone to portrait and back: still in hand, and it lands where tapped.
    await page.touchscreen.tap(s.x, s.y);
    await page.waitForFunction(() => !!(window as G).__altarView?.held);
    await page.setViewportSize({ width: LANDSCAPE.height, height: LANDSCAPE.width });
    await expect(page.getByText('Turn your phone sideways')).toBeVisible();
    await shot(page, 'phone-portrait-holding');
    await page.setViewportSize(LANDSCAPE);
    await expect(page.getByText('Turn your phone sideways')).toBeHidden();
    await waitFrames(page, 10);
    expect(await held(page)).toBe(true);
    g = await geometry(page);
    const a = g.cell(first!.cell);
    // A double tap on an empty socket: one gem set (the second tap may lift it again, never two).
    await page.touchscreen.tap(a.x, a.y);
    await page.touchscreen.tap(a.x, a.y);
    await waitFrames(page, 10);
    const atA = (await placed(page)).filter(
      (p: Placement) => p.cell.x === first!.cell.x && p.cell.y === first!.cell.y,
    );
    expect(atA.length).toBeLessThanOrEqual(1);
    // And the board still takes a plain tap afterwards.
    if (!(await held(page))) {
      await page.touchscreen.tap(s.x, s.y);
      await page.waitForFunction(() => !!(window as G).__altarView?.held);
    }
    const b = g.cell(second!.cell);
    await page.touchscreen.tap(b.x, b.y);
    await waitFrames(page, 10);
    const all: Placement[] = await placed(page);
    expect(all.some((p) => p.cell.x === second!.cell.x && p.cell.y === second!.cell.y)).toBe(true);
    const cells = all.map((p) => `${p.cell.x},${p.cell.y}`);
    expect(new Set(cells).size).toBe(cells.length);
    expect(problems).toEqual([]);
  });
});
