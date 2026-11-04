import { expect, type Page, test } from '@playwright/test';
import { puzzleFor } from '../../games/last-rune/content/puzzles';
import type { Cell, MachineId } from '../../games/last-rune/rules/types';
import { playOrder } from './altar-audit';
import { DEV_URL, waitFrames } from './helpers';

// held-gem (blind review 9; D-040 add. 10, findings A and E). A: the gem in hand stays vivid in
// its tray slot and Turn visibly turns it there; over a socket it would land in, the gem sits in
// that socket as a faint ghost at its current turn. E: an Amplify the bolt passes without
// doubling (the bolt was already doubled) is drawn idle, never lit like a working one.

// biome-ignore lint/suspicious/noExplicitAny: dev handles
type G = any;
const ORDER = playOrder();
test.setTimeout(120_000);

async function open(page: Page, id: MachineId, placements: unknown[]) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  await page.evaluate(
    ({ id, placements, solved }) => {
      const g = (window as G).__game;
      g.save.update((d: G) => {
        d.flags.hallIntro = true;
        d.flags.dotTold = true;
        d.settings.captionSpeed = 'instant';
        d.progress.solved = solved;
        d.puzzles = { [id]: { attempts: 0, placements } };
      });
      g.flow.continueGame();
      g.flow.openPuzzle(id);
    },
    { id, placements, solved: ORDER.slice(0, ORDER.indexOf(id)) },
  );
  await expect(page.locator('.lr-altar')).toBeVisible();
  await page.waitForFunction(() => !!(window as G).__altarLayout && !!(window as G).__altarView);
  // Clear any teaching tip so it sits over nothing we look at.
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => (window as G).__game.fuse.hush());
    await waitFrames(page, 4);
    const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
    if (!(await next.isVisible())) break;
    await next.click({ timeout: 2000 }).catch(() => {});
  }
  await waitFrames(page, 10);
}

/** Design px (1920 wide) to CSS px. */
async function toCss(page: Page) {
  const ob = (await page.locator('.tc-overlay:not([data-units="css"])').boundingBox())!;
  const k = ob.width / 1920;
  return (x: number, y: number) => ({ x: ob.x + x * k, y: ob.y + y * k, k });
}

/** In the browser: per-pixel compare of two same-size PNGs, plus each one's mean saturation. */
async function comparePngs(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ({ a, b }) => {
      const read = async (b64: string) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext('2d')!;
        ctx.drawImage(bmp, 0, 0);
        return { data: ctx.getImageData(0, 0, bmp.width, bmp.height).data, w: bmp.width };
      };
      const { data: da, w } = await read(a);
      const { data: db } = await read(b);
      // Mean saturation over the gem's body (the middle of the clip, inside any ring).
      const sat = (d: Uint8ClampedArray, w: number) => {
        let s = 0;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const px = (i / 4) % w;
          const py = Math.floor(i / 4 / w);
          if (Math.hypot(px - w / 2, py - w / 2) > w * 0.3) continue;
          const mx = Math.max(d[i]!, d[i + 1]!, d[i + 2]!);
          const mn = Math.min(d[i]!, d[i + 1]!, d[i + 2]!);
          s += mx > 0 ? (mx - mn) / mx : 0;
          n++;
        }
        return s / n;
      };
      let changed = 0;
      for (let i = 0; i < da.length; i += 4) {
        const dd =
          Math.abs(da[i]! - db[i]!) +
          Math.abs(da[i + 1]! - db[i + 1]!) +
          Math.abs(da[i + 2]! - db[i + 2]!);
        if (dd > 90) changed++;
      }
      // Mean luma over the same middle disc (0..255).
      const lum = (d: Uint8ClampedArray, w: number) => {
        let s = 0;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const px = (i / 4) % w;
          const py = Math.floor(i / 4 / w);
          if (Math.hypot(px - w / 2, py - w / 2) > w * 0.3) continue;
          s += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
          n++;
        }
        return s / n;
      };
      return {
        changed: changed / (da.length / 4),
        satA: sat(da, w),
        satB: sat(db, w),
        lumA: lum(da, w),
        lumB: lum(db, w),
      };
    },
    { a: a.toString('base64'), b: b.toString('base64') },
  );
}

test.describe('phone', () => {
  test.use({
    viewport: { width: 667, height: 320 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  const ID: MachineId = 'press-unit-4';
  const P = puzzleFor(ID);
  const HALF = P.design.intended.slice(0, Math.floor(P.design.intended.length / 2));

  test('the first altar: paging the teach card keeps the gem in hand; setting it down ends the hold', async ({
    page,
  }) => {
    // polish-10 (blind review 10, Android): "the first gem drops the hold". On phones the hold
    // ends by design when a gem is set down (mobile-5-board); the teach card must never end it.
    await page.emulateMedia({ reducedMotion: 'reduce' });
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
    await expect(page.locator('.lr-altar-tip:not([hidden]) .lr-info-next')).toBeVisible();
    await page.waitForFunction(() => !!(window as G).__altarLayout && !!(window as G).__altarView);
    const L = await page.evaluate(() => (window as G).__altarLayout);
    const css = await toCss(page);
    const s = L.tray[0];
    const slot = css(s.x, s.y);
    await page.touchscreen.tap(slot.x, slot.y);
    await page.waitForFunction(() => !!(window as G).__altarView?.held);
    await expect(page.locator('.lr-altar-holding')).toBeVisible();
    // Page the card while holding: the gem stays in hand.
    const next = page.locator('.lr-altar-tip:not([hidden]) .lr-info-next');
    if (await next.isVisible()) {
      await next.tap();
      await waitFrames(page, 6);
      expect(await page.evaluate(() => !!(window as G).__altarView.held)).toBe(true);
      await expect(page.locator('.lr-altar-holding')).toBeVisible();
    }
    // Set it down: the hold ends (the next tap on the tray takes another).
    const first = puzzleFor('intake-desk').design.intended[0]!;
    const c = css(
      L.left + L.margin + L.pitch * (first.cell.x + 0.5),
      L.top + L.margin + L.pitch * (first.cell.y + 0.5),
    );
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForFunction(() => !(window as G).__altarView?.held);
    await expect(page.locator('.lr-altar-holding')).toBeHidden();
  });

  test('the held Split stays vivid in its tray slot and Turn visibly turns it', async ({
    page,
  }) => {
    await open(page, ID, HALF);
    const L = await page.evaluate(() => (window as G).__altarLayout);
    const css = await toCss(page);
    const s = L.tray.find((t: G) => t.gem === 'split');
    const c = css(s.x, s.y);
    const r = Math.ceil((s.size * c.k) / 2) + 2;
    const clip = { x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r };
    const rest = await page.screenshot({ clip });
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForFunction(() => (window as G).__altarView?.held?.kind === 'split');
    await waitFrames(page, 8);
    const held = await page.screenshot({ clip });
    await waitFrames(page, 6);
    const again = await page.screenshot({ clip });
    await page.locator('.lr-altar-turnbtn').tap();
    await expect.poll(() => page.evaluate(() => (window as G).__altarView.held.rot)).toBe(1);
    await waitFrames(page, 8);
    const turned = await page.screenshot({ clip });

    // Held, the gem keeps its colour: no pale wash over it (blind review 9, finding A).
    const rh = await comparePngs(page, rest, held);
    expect(rh.satB, 'held gem as vivid as at rest').toBeGreaterThan(rh.satA * 0.8);
    // Still frames agree; a Turn changes a good part of the slot.
    const still = await comparePngs(page, held, again);
    expect(still.changed).toBeLessThan(0.03);
    const turn = await comparePngs(page, held, turned);
    expect(turn.changed, 'Turn changes the held gem at a glance').toBeGreaterThan(0.08);
    expect(turn.satB).toBeGreaterThan(rh.satA * 0.8);
  });

  test('aimed at a socket, the held gem is a ghost there at its turn; never on a placed gem', async ({
    page,
  }) => {
    await open(page, ID, HALF);
    const L = await page.evaluate(() => (window as G).__altarLayout);
    const css = await toCss(page);
    const s = L.tray.find((t: G) => t.gem === 'split');
    const from = css(s.x, s.y);
    await page.touchscreen.tap(from.x, from.y);
    await page.waitForFunction(() => (window as G).__altarView?.held?.kind === 'split');
    await page.locator('.lr-altar-turnbtn').tap();
    await expect.poll(() => page.evaluate(() => (window as G).__altarView.held.rot)).toBe(1);

    const want = P.design.intended.slice(HALF.length).find((q) => q.gem === 'split')!;
    const centre = (cell: Cell) => ({
      x: L.left + L.margin + L.pitch * (cell.x + 0.5),
      y: L.top + L.margin + L.pitch * (cell.y + 0.5),
    });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, x = 0, y = 0) =>
      cdp.send('Input.dispatchTouchEvent', {
        type: type as 'touchStart',
        touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      });
    /** Drag from the tray slot until the aim sits on `cell`; returns the ghost's state. */
    const aimAt = async (cell: Cell) => {
      const at = css(centre(cell).x, centre(cell).y);
      // The finger rides below the aim point (the loupe lifts the aim above the fingertip).
      const end = { x: at.x, y: Math.min(319, at.y + 56) };
      await touch('touchStart', from.x, from.y);
      for (let i = 1; i <= 10; i++) {
        await touch(
          'touchMove',
          from.x + (end.x - from.x) * (i / 10),
          from.y + (end.y - from.y) * (i / 10),
        );
        await waitFrames(page, 1);
      }
      await waitFrames(page, 6);
      const got = await page.evaluate(() => {
        const v = (window as G).__altarView;
        const g = v.heldInst;
        return {
          snapped: v.held?.snapped,
          state: g.state,
          x: g.x,
          y: g.y,
          rot: g.rot,
          size: g.size,
        };
      });
      return got;
    };

    const ghost = await aimAt(want.cell);
    expect(ghost.snapped).toBe(true);
    expect(ghost.state).toBe('ghost');
    expect(ghost.rot, 'the ghost shows the held turn').toBe(1);
    expect(Math.abs(ghost.x - centre(want.cell).x)).toBeLessThan(1);
    expect(Math.abs(ghost.y - centre(want.cell).y)).toBeLessThan(1);
    // The tray slot still shows what is in hand, turned with it.
    const si = L.tray.findIndex((t: G) => t.gem === 'split');
    expect(await page.evaluate((i) => (window as G).__altarView.tray[i].rot, si)).toBe(1);
    // Back off the board without dropping: return to the slot.
    await touch('touchMove', from.x, from.y);
    await touch('touchEnd');
    await waitFrames(page, 6);

    // A socket that already holds a gem gets no ghost.
    const placed = HALF[0]!.cell;
    const over = await aimAt(placed);
    expect(over.snapped).toBe(false);
    expect(over.state).not.toBe('ghost');
    await touch('touchMove', from.x, from.y);
    await touch('touchEnd');
  });
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('hovering a socket with a gem in hand shows its ghost there, and R turns the ghost', async ({
    page,
  }) => {
    const ID: MachineId = 'press-unit-4';
    await open(page, ID, []);
    const L = await page.evaluate(() => (window as G).__altarLayout);
    const css = await toCss(page);
    const s = L.tray.find((t: G) => t.gem === 'split');
    const slot = css(s.x, s.y);
    await page.mouse.move(slot.x, slot.y, { steps: 3 });
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(() => (window as G).__altarView?.held?.kind === 'split');
    const want = puzzleFor(ID).design.intended.find((q) => q.gem === 'split')!.cell;
    const cx = L.left + L.margin + L.pitch * (want.x + 0.5);
    const cy = L.top + L.margin + L.pitch * (want.y + 0.5);
    const at = css(cx, cy);
    await page.mouse.move(at.x, at.y, { steps: 4 });
    await waitFrames(page, 6);
    const look = () =>
      page.evaluate(() => {
        const g = (window as G).__altarView.heldInst;
        return { state: g.state, x: g.x, y: g.y, rot: g.rot };
      });
    const before = await look();
    expect(before.state).toBe('ghost');
    expect(Math.abs(before.x - cx)).toBeLessThan(1);
    expect(Math.abs(before.y - cy)).toBeLessThan(1);
    await page.keyboard.press('KeyR');
    await waitFrames(page, 4);
    const after = await look();
    expect(after.state).toBe('ghost');
    expect(after.rot).toBe((before.rot + 1) % 4);

    // polish-10 (blind review 10): the ghost must not read as placed. It is see-through (the
    // dark socket shows through it) with a dashed rim; set down, the same gem at the same turn
    // is solid. So the ghost's middle is clearly darker than the placed gem's.
    const r = Math.ceil((L.pitch * at.k) / 2);
    const clip = { x: at.x - r, y: at.y - r, width: 2 * r, height: 2 * r };
    await waitFrames(page, 6);
    const ghostPng = await page.screenshot({ clip });
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(
      (c) =>
        (window as G).__altarView.board.some(
          (b: G) => b.cell.x === c.x && b.cell.y === c.y && !b.hidden,
        ),
      want,
    );
    // Off the board (the gem still in hand follows the pointer, far from this socket).
    await page.mouse.move(4, 360, { steps: 3 });
    await waitFrames(page, 20);
    const placedPng = await page.screenshot({ clip });
    const cmp = await comparePngs(page, ghostPng, placedPng);
    expect(cmp.changed, 'ghost and placed gem look different').toBeGreaterThan(0.08);
    expect(cmp.lumA, 'the ghost is see-through, darker than the placed gem').toBeLessThan(
      cmp.lumB * 0.8,
    );
  });

  test('an Amplify the bolt passes already doubled draws idle, unlike a working one', async ({
    page,
  }) => {
    // Control Booth: the storm runs east through its fixed Amplify (2,2) into a second at (3,2).
    await open(page, 'control-booth', [
      { cell: { x: 0, y: 2 }, gem: 'channel', rot: 1 },
      { cell: { x: 1, y: 2 }, gem: 'channel', rot: 1 },
      { cell: { x: 3, y: 2 }, gem: 'amplify', rot: 1 },
    ]);
    await page.keyboard.press('KeyF', { delay: 50 });
    // Once the bolt is past both, read how each is drawn on the same frame.
    const handle = await page.waitForFunction(
      () => {
        const v = (window as G).__altarView;
        const at = (x: number, y: number) =>
          v.board.find((b: G) => b.cell.x === x && b.cell.y === y);
        const a = at(2, 2);
        const b = at(3, 2);
        if (!a || !b?.idle || a.energy < 0.6) return null;
        return {
          active: { idle: a.idle, state: a.g.state, glow: a.g.glow, energy: a.energy },
          idle: { idle: b.idle, state: b.g.state, glow: b.g.glow, energy: b.energy },
        };
      },
      null,
      { polling: 'raf', timeout: 30_000 },
    );
    const got = (await handle.jsonValue())!;
    expect(got.active.idle).toBe(false);
    expect(got.active.state).toBe('energised');
    expect(got.idle.idle).toBe(true);
    expect(got.idle.state, 'the idle Amplify does not flare').not.toBe('energised');
    expect(got.idle.glow).toBeLessThan(got.active.glow);
  });
});
