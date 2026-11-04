import { expect, type Page, test } from '@playwright/test';
import { DEV_URL, waitFrames } from './helpers';

// chrome-polish-3 (Gate 2 blind review 5), on the four realistic phones:
//  1. Title: FUSE's docked line keeps off the storm cell (design x ≤ 740) and the menu.
//  2. Settings: the ✕ does not move when the tab changes, the two tabs are one height, and the
//     ✕ is the only way out (no Done beside it).
//  3. Hall: door plates break between words (never inside one), and none overlap.
//  4. Codex: no plate's badge is cut by the plate.
//  5. Menus: the altar's menu is the hall's minus Journal (the journal is a room off the hall),
//     in the same order.
// And an iPhone (its user agent, Fullscreen API or not) never shows Full screen.

const PHONES = [
  { name: 'se', width: 667, height: 320 },
  { name: 'iphone', width: 844, height: 340 },
  { name: 'promax', width: 932, height: 380 },
  { name: 'android', width: 915, height: 360 },
] as const;

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;

test.setTimeout(120_000);

async function toTitle(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(DEV_URL);
  await page.waitForFunction(() => (window as G).__game?.flow.state === 'title', null, {
    timeout: 30_000,
  });
  await page.evaluate(() =>
    document.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }),
    ),
  );
  await waitFrames(page, 6);
}

async function toHall(page: Page) {
  await page.evaluate(() => {
    const g = (window as G).__game;
    g.save.update((d: G) => {
      d.flags.hallIntro = true;
      d.settings.captionSpeed = 'instant';
      d.progress.solved = ['intake-desk', 'furnace', 'splitter-mill'];
      d.puzzles = {};
      d.journal.found = [1, 2, 3, 4];
      d.journal.read = [1, 2, 3];
    });
    g.flow.continueGame();
    g.fuse.hush();
  });
  await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
  await page.waitForTimeout(600);
  await waitFrames(page, 6);
}

/** The labels of the Menu's items as shown, in order (the ☰ opened). */
function menuItems(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.lr-hud .lr-stone-button:not(.lr-hud-menu)')]
      .filter((b) => !b.hidden && !b.closest('[hidden]') && b.getBoundingClientRect().width > 0)
      .map((b) => (b.firstChild?.textContent ?? '').trim()),
  );
}

for (const vp of PHONES) {
  test.describe(`chrome polish ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test(`title line, Settings ✕, door plates, Codex badges and menus at ${vp.width}×${vp.height}`, async ({
      page,
    }) => {
      await toTitle(page);
      const problems: string[] = [];

      // 1. FUSE's docked line on the title, right of the storm cell and clear of the menu.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.settings.captionSpeed = 'instant';
        });
        g.fuse.hush();
        g.stack.top.chat?.();
      });
      await expect(page.locator('.tc-caption[data-docked]')).toBeVisible();
      await page.waitForTimeout(400);
      const cap = await page.evaluate(() => {
        const c = document.querySelector('.tc-caption[data-docked]')!.getBoundingClientRect();
        const o = document
          .querySelector('.tc-overlay:not([data-units="css"])')!
          .getBoundingClientRect();
        const m = document.querySelector('.lr-title-menu')!.getBoundingClientRect();
        return {
          left: c.left,
          storm: o.left + (740 / 1920) * o.width,
          onMenu: c.left < m.right && m.left < c.right && c.top < m.bottom && m.top < c.bottom,
        };
      });
      if (cap.left < cap.storm - 1)
        problems.push(`title: FUSE's line starts at ${cap.left.toFixed(0)}, over the storm cell`);
      if (cap.onMenu) problems.push("title: FUSE's line covers the menu");

      // 2. Settings: the ✕ holds still across the tabs; no Done beside it.
      await page.evaluate(() => (window as G).__game.openSettings());
      await expect(page.locator('.lr-settings')).toBeVisible();
      await waitFrames(page, 4);
      const xBox = () =>
        page.evaluate(() => {
          const r = document
            .querySelector('.lr-settings-host .lr-panel-x')!
            .getBoundingClientRect();
          const p = document.querySelector('.lr-settings-host')!.getBoundingClientRect();
          return { x: r.left, y: r.top, h: p.height };
        });
      const tabs = page.locator('.lr-settings-tab');
      const a = await xBox();
      await tabs.nth(1).click();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await waitFrames(page, 3);
      const b = await xBox();
      if (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5)
        problems.push(`settings: the ✕ moves with the tab (${JSON.stringify({ a, b })})`);
      if (Math.abs(a.h - b.h) > 0.5)
        problems.push(`settings: the panel is ${a.h.toFixed(0)} then ${b.h.toFixed(0)} px tall`);
      const done = await page
        .locator('.lr-settings-host button', { hasText: /^\s*Done\s*$/ })
        .count();
      if (done) problems.push('settings: a Done button beside the ✕');
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      // 3. Hall: plates break between words only, no two touching.
      await toHall(page);
      const plates = await page.evaluate(() => {
        const out: string[] = [];
        const boxes: [string, DOMRect][] = [];
        for (const el of document.querySelectorAll<HTMLElement>('.lr-door')) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          const name = el.querySelector<HTMLElement>('.lr-door-name');
          // A name may take two lines on a narrow phone, broken between words; never inside
          // one, and never a short word left alone on a line (no "Unit / 4").
          if (name) {
            const words: { w: string; top: number }[] = [];
            const walk = document.createTreeWalker(name, NodeFilter.SHOW_TEXT);
            for (let n = walk.nextNode(); n; n = walk.nextNode()) {
              const str = n.textContent ?? '';
              for (const m of str.matchAll(/\S+/g)) {
                const range = document.createRange();
                range.setStart(n, m.index);
                range.setEnd(n, m.index + m[0].length);
                const rows = new Set([...range.getClientRects()].map((q) => Math.round(q.top)));
                if (rows.size > 1) out.push(`plate "${name.textContent}" breaks "${m[0]}"`);
                words.push({ w: m[0], top: Math.round(range.getBoundingClientRect().top) });
              }
            }
            const rows = new Map<number, number>();
            for (const { top } of words) rows.set(top, (rows.get(top) ?? 0) + 1);
            for (const { w, top } of words) {
              if (rows.size > 1 && rows.get(top) === 1 && w.length <= 2)
                out.push(`plate "${name.textContent}" leaves "${w}" alone on a line`);
            }
          }
          for (const [other, q] of boxes) {
            if (r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom)
              out.push(`plates "${el.textContent}" and "${other}" overlap`);
          }
          boxes.push([el.textContent ?? '', r]);
        }
        return out;
      });
      problems.push(...plates.map((s) => `hall: ${s}`));

      // 5. Menus, hall then altar.
      await page.locator('.lr-hud-menu').tap();
      await expect(page.locator('.lr-hud-scrim')).toBeVisible();
      const hall = await menuItems(page);
      await page.locator('.lr-hud-menu').tap();
      await expect(page.locator('.lr-hud-scrim')).toBeHidden();

      // 4. Codex: every badge whole inside its plate.
      await page.evaluate(() => (window as G).__game.codex.open());
      await expect(page.locator('.lr-codex')).toBeVisible();
      await waitFrames(page, 4);
      const cut = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('.lr-plate-chip, .lr-plate-nogo')) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          let p = el.parentElement;
          while (p && getComputedStyle(p).overflow === 'visible') p = p.parentElement;
          if (!p) continue;
          const q = p.getBoundingClientRect();
          if (
            r.left < q.left - 0.5 ||
            r.right > q.right + 0.5 ||
            r.top < q.top - 0.5 ||
            r.bottom > q.bottom + 0.5
          )
            out.push(`${el.className} "${(el.textContent ?? '').trim()}"`);
        }
        return out;
      });
      problems.push(...cut.map((s) => `codex: badge cut ${s}`));
      await page.evaluate(() => (window as G).__game.ui.stack.clear());

      await page.evaluate(() => (window as G).__game.flow.openPuzzle('relay-tower'));
      await expect(page.locator('.lr-altar')).toBeVisible();
      await waitFrames(page, 10);
      await page.evaluate(() => {
        (window as G).__game.fuse.hush();
        document.querySelector<HTMLElement>('.lr-hud-menu')!.click();
      });
      await expect(page.locator('.lr-hud-scrim')).toBeVisible();
      const altar = await menuItems(page);
      expect(hall, 'the hall menu').toEqual(['Journal', 'Codex', 'Settings']);
      expect(altar, "the altar's menu is the hall's minus Journal").toEqual(
        hall.filter((s) => s !== 'Journal'),
      );

      expect(problems).toEqual([]);
    });
  });
}

test.describe('iPhone Safari', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    userAgent: IPHONE_UA,
  });

  test('never shows Full screen on the title, even where the API answers', async ({ page }) => {
    await toTitle(page);
    await expect(page.locator('.lr-title-menu')).toBeVisible();
    await expect(page.locator('.lr-fullscreen:visible')).toHaveCount(0);
  });
});
