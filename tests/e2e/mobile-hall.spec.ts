import { expect, type Page, test } from '@playwright/test';
import { DEV_URL, waitFrames } from './helpers';

// mobile-7-hall (gate review 4, D-040 addendum 5): the hall, its menu and the title on phones.
//  1. First visit: every plate is wholly on screen (the Intake Desk's too), the Next ring never
//     cuts a plate, and no two of plates, the Start here tag and Menu overlap.
//  2. Mid-game: the same, plus the Next tag ≥4 px from the band's top and the New page badge.
//  3. A tapped locked door's card says "Locked: solve … first", carries FUSE's word, shows no
//     "Gate" chip and covers no plate, the Next tag or Menu.
//  4. The open menu has a panel and a scrim; its note is ≥11 px.
//  5. FUSE's bubble has a tail and covers no open door or its plate.
//  6. Settings segments ≥36 px; the default text speed is Normal.

const PHONES = [
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;
type Box = { n: string; l: number; t: number; r: number; b: number };

test.setTimeout(120_000);

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
      document.head.append(s);
    });
  }, px);
}

/** Client boxes of the hall's labels: plates, the Next tag, Menu and its badge, the card. */
function labels(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const out: Box[] = [];
    const sel =
      '.lr-door, .lr-hall-next-tag, .lr-hud-menu, .lr-hud-menu-new, .lr-nameplate, .lr-hall-next';
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el.closest('[hidden]')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const n = el.classList.contains('lr-door')
        ? `plate "${(el.textContent ?? '').trim()}"`
        : sel
            .split(', ')
            .find((s) => el.matches(s))!
            .slice(1);
      out.push({ n, l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
    return out;
  });
}

const hit = (a: Box, b: Box, slack = 0.5) =>
  a.l < b.r - slack && b.l < a.r - slack && a.t < b.b - slack && b.t < a.b - slack;

/** Overlaps among labels (the ring may hold its own door's art, never a plate's text). */
function clashes(boxes: Box[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (a.n === 'lr-hall-next' || b.n === 'lr-hall-next') {
        // The ring: no plate's text is cut by its outline (a plate wholly inside is fine).
        const ring = a.n === 'lr-hall-next' ? a : b;
        const o = a === ring ? b : a;
        if (!o.n.startsWith('plate')) continue;
        const inside = o.l >= ring.l && o.r <= ring.r && o.t >= ring.t && o.b <= ring.b;
        if (hit(ring, o, 1) && !inside) out.push(`the Next ring cuts ${o.n}`);
        continue;
      }
      if (hit(a, b)) out.push(`${a.n} overlaps ${b.n}`);
    }
  return out;
}

/** Labels not wholly inside the visible band (the app box less the hall's crop). */
function offBand(page: Page, boxes: Box[]): Promise<string[]> {
  return page.evaluate((boxes) => {
    const app = document.getElementById('app')!.getBoundingClientRect();
    const out: string[] = [];
    for (const b of boxes) {
      if (b.n === 'lr-hall-next') continue;
      if (
        b.l < app.left - 0.5 ||
        b.r > app.right + 0.5 ||
        b.t < app.top - 0.5 ||
        b.b > app.bottom + 0.5
      )
        out.push(`${b.n} is cut by the screen edge`);
    }
    return out;
  }, boxes);
}

async function boot(page: Page, vp: (typeof PHONES)[number]) {
  await insets(page, vp.inset);
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
}

for (const vp of PHONES) {
  test.describe(`phone hall ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test(`hall labels, locked card, menu, FUSE's tail and Settings at ${vp.width}×${vp.height}`, async ({
      page,
    }) => {
      await boot(page, vp);
      const problems: string[] = [];

      // The default text speed is Normal (a saved choice may say otherwise).
      expect(await page.evaluate(() => (window as G).__game.save.get().settings.captionSpeed)).toBe(
        'normal',
      );

      // 1. First visit.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.settings.captionSpeed = 'instant';
        });
        g.flow.newGame();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'hall');
      await page.waitForTimeout(800);
      await waitFrames(page, 6);
      await expect(page.locator('.lr-hall-next-tag')).toHaveText(/Start here/);
      let boxes = await labels(page);
      problems.push(...clashes(boxes).map((s) => `first visit: ${s}`));
      problems.push(...(await offBand(page, boxes)).map((s) => `first visit: ${s}`));
      // FUSE's welcome: a tail toward him, and off the Start here door and its plate.
      await expect(page.locator('.tc-caption')).toBeVisible();
      await waitFrames(page, 3);
      const welcome = await page.evaluate(() => {
        const cap = document.querySelector<HTMLElement>('.tc-caption')!;
        const c = cap.getBoundingClientRect();
        const out: string[] = [];
        if (!cap.dataset.tail) out.push("FUSE's card has no tail");
        for (const el of document.querySelectorAll<HTMLElement>(
          '.lr-door[data-status="unlocked"], .lr-door[data-status="solved"], .lr-hall-next, .lr-hall-next-tag',
        )) {
          const r = el.getBoundingClientRect();
          if (c.left < r.right && r.left < c.right && c.top < r.bottom && r.top < c.bottom)
            out.push(`FUSE's card covers ${el.className.split(' ')[0]} "${el.textContent}"`);
        }
        return out;
      });
      problems.push(...welcome.map((s) => `first visit: ${s}`));
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.fuse.hush();
        g.flow.toTitle();
      });
      await page.waitForFunction(() => (window as G).__game.flow.state === 'title');

      // 2. Mid-game.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.flags.hallIntro = true;
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
      await expect(page.locator('.lr-hall-next-tag')).toHaveText(/Next/);
      boxes = await labels(page);
      problems.push(...clashes(boxes).map((s) => `mid-game: ${s}`));
      problems.push(...(await offBand(page, boxes)).map((s) => `mid-game: ${s}`));
      const tagTop = await page.evaluate(() => {
        const app = document.getElementById('app')!.getBoundingClientRect();
        const t = document.querySelector('.lr-hall-next-tag')!.getBoundingClientRect();
        return t.top - app.top;
      });
      if (tagTop < 4)
        problems.push(`mid-game: the Next tag is ${tagTop.toFixed(1)} px from the top`);
      // New pages (chrome-polish-4): one badge on one line, level with the Menu button and just
      // left of it, on screen, and no separate dot. (The label clash check above covers plates.)
      await expect(page.locator('.lr-hud-menu-new')).toHaveText('New page in journal');
      const badge = await page.evaluate(() => {
        const m = document.querySelector('.lr-hud-menu')!;
        const dot = getComputedStyle(m, '::after');
        const a = m.getBoundingClientRect();
        const b = document.querySelector('.lr-hud-menu-new')!.getBoundingClientRect();
        const app = document.getElementById('app')!.getBoundingClientRect();
        const mid = (b.top + b.bottom) / 2;
        return {
          dot: dot.content !== 'none' && dot.display !== 'none',
          beside:
            b.right <= a.left + 0.5 && b.right >= a.left - 10 && mid > a.top && mid < a.bottom,
          onScreen: b.left >= app.left - 0.5 && b.top >= app.top - 0.5,
          oneLine: b.height < 30,
        };
      });
      if (badge.dot) problems.push('Menu has a dot as well as the badge');
      if (!badge.beside) problems.push('the New page badge is not just left of the Menu button');
      if (!badge.onScreen) problems.push('the New page badge leaves the screen');
      if (!badge.oneLine) problems.push('the New page badge wraps');

      // FUSE speaking in the hall: a tail; never over an open door or its plate.
      // An ambient line, as the hall says one when idle (the scene's own placement).
      await page.evaluate(() => (window as G).__game.stack.top.ambient());
      await expect(page.locator('.tc-caption')).toBeVisible();
      await waitFrames(page, 4);
      const ambient = await page.evaluate(() => {
        const cap = document.querySelector<HTMLElement>('.tc-caption')!;
        const c = cap.getBoundingClientRect();
        const out: string[] = [];
        if (!cap.dataset.tail) out.push("FUSE's card has no tail");
        for (const el of document.querySelectorAll<HTMLElement>(
          '.lr-door[data-status="unlocked"], .lr-door[data-status="solved"], .lr-hall-next, .lr-hall-next-tag',
        )) {
          const r = el.getBoundingClientRect();
          if (c.left < r.right && r.left < c.right && c.top < r.bottom && r.top < c.bottom)
            out.push(`FUSE's card covers ${el.className.split(' ')[0]} "${el.textContent}"`);
        }
        return out;
      });
      problems.push(...ambient.map((s) => `hall FUSE: ${s}`));
      await page.evaluate(() => (window as G).__game.fuse.hush());

      // 3. A tapped locked door (one that waits on the Relay Tower, the Next door).
      const tapAt = (id?: string) =>
        page.evaluate((id) => {
          const st = (window as G).__game.stack.top.state;
          const a = st.model.alcoves.find((x: G) =>
            id ? x.id === id : x.status === 'locked' && !x.floor,
          );
          const f = st.frame;
          const ov = document.querySelector('.tc-layer[data-layer="hud"]')!.getBoundingClientRect();
          const k = ov.width / 1920;
          return {
            id: a.id as string,
            name: a.name as string,
            x: ov.left + (960 + (a.x - 960 - f.camX) * f.zoom) * k,
            y: ov.top + (540 + (a.y - 540 - f.camY) * f.zoom) * k,
          };
        }, id);
      const lockedIds: string[] = await page.evaluate(() =>
        (window as G).__game.stack.top.state.model.alcoves
          .filter((x: G) => x.status === 'locked' && !x.floor)
          .map((x: G) => x.id),
      );
      let n = 0;
      for (const id of lockedIds) {
        const at = await tapAt(id);
        await page.touchscreen.tap(at.x + (n++ % 2), at.y);
        const card = page.locator('.lr-nameplate');
        await expect(card).toBeVisible();
        await expect(card).toContainText(at.name);
        await expect(card).toContainText(/^.*Locked: (solve|earn)/);
        // Gem chips only where the words point at them (the Last Rune's many gems).
        if (id !== 'the-last-rune') await expect(card.locator('.lr-card-gem')).toHaveCount(0);
        // FUSE's reason joins the card; where it cannot fit clear of the other plates, he says
        // it in his own caption instead. Never both, never neither.
        const where = async () =>
          page.evaluate(() => {
            const f = document.querySelector<HTMLElement>('.lr-card-fuse');
            const c = document.querySelector<HTMLElement>('.tc-caption');
            const inCard = !!f && !f.hidden && f.offsetParent !== null;
            const inCap = !!c && c.offsetParent !== null && getComputedStyle(c).opacity !== '0';
            return inCard && !inCap ? 'card' : inCap && !inCard ? 'caption' : 'none';
          });
        await expect.poll(where, { timeout: 3000 }).not.toBe('none');
        const said = await where();
        if (said === 'card') await expect(card.locator('.lr-card-fuse')).toContainText('FUSE');
        await waitFrames(page, 2);
        boxes = await labels(page);
        const c = boxes.find((b) => b.n === 'lr-nameplate');
        if (!c) problems.push(`${id}: no card`);
        else {
          for (const b of boxes)
            if (b !== c && b.n !== 'lr-hall-next' && hit(b, c))
              problems.push(`${id}: the card covers ${b.n}`);
          problems.push(...(await offBand(page, [c])).map((s) => `${id}: ${s}`));
        }
        if (said === 'card') await expect(page.locator('.tc-caption')).toBeHidden();
        else {
          const cap = await page.locator('.tc-caption').boundingBox();
          const cb = await card.boundingBox();
          const bx = (n: string, r: { x: number; y: number; width: number; height: number }) => ({
            n,
            l: r.x,
            t: r.y,
            r: r.x + r.width,
            b: r.y + r.height,
          });
          if (cap && cb && hit(bx('cap', cap), bx('card', cb)))
            problems.push(`${id}: FUSE's caption covers the card`);
        }
        await page.evaluate(() => (window as G).__game.fuse.hush());
      }
      // Tap away: the card goes.
      await page.locator('.lr-hud-menu').click();
      await expect(page.locator('.lr-nameplate')).toBeHidden();

      // 4. The open menu: panel and scrim; the note ≥11 px.
      await expect(page.locator('.lr-hud-scrim')).toBeVisible();
      const menu = await page.evaluate(() => {
        const hud = document.querySelector('.lr-hud')!;
        const panel = getComputedStyle(hud, '::before');
        const note = document.querySelector<HTMLElement>('.lr-hud-note')!;
        return {
          panel: panel.content !== 'none' && panel.backgroundColor !== 'rgba(0, 0, 0, 0)',
          note:
            note.getBoundingClientRect().height > 0
              ? Number.parseFloat(getComputedStyle(note).fontSize)
              : 0,
          // Computed sizes are CSS px (one overlay, no transform; ws/one-overlay).
          scale: 1,
        };
      });
      if (!menu.panel) problems.push('the open menu has no panel');
      // polish-10: no door name is cut mid-word by the open list: a plate under it steps out.
      const cut = await page.evaluate(() => {
        const m = document.querySelector('.lr-hud')!.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLElement>('.lr-door')]
          .filter((el) => getComputedStyle(el).visibility !== 'hidden')
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.left < m.right && m.left < r.right && r.top < m.bottom && m.top < r.bottom;
          })
          .map((el) => el.textContent ?? '');
      });
      for (const name of cut) problems.push(`the open menu cuts the plate "${name}"`);
      if (menu.note * menu.scale < 11)
        problems.push(`the menu note is ${(menu.note * menu.scale).toFixed(1)} px`);
      await page.locator('.lr-hud-menu').click();
      await expect(page.locator('.lr-hud-scrim')).toBeHidden();

      // 6. Settings: segments ≥36 px; Normal text speed.
      await page.evaluate(() => {
        const g = (window as G).__game;
        g.save.update((d: G) => {
          d.settings.captionSpeed = 'normal';
        });
        g.openSettings();
      });
      await expect(page.locator('.lr-settings')).toBeVisible();
      await page.waitForTimeout(300);
      const segs = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.lr-settings .lr-seg button')]
          .map((b) => b.getBoundingClientRect().height)
          .filter((h) => h > 0),
      );
      expect(segs.length).toBeGreaterThan(0);
      for (const h of segs)
        if (h < 35.5) problems.push(`a Settings segment is ${h.toFixed(1)} px tall`);

      expect(problems).toEqual([]);
    });
  });
}
