import { expect, type Page, test } from '@playwright/test';
import { MACHINE_IDS } from '../../games/last-rune/rules/types';
import { DEV_URL, waitFrames } from './helpers';

// mobile-3-ending (D-040): the ending on the four realistic phone viewports (browser bars
// showing, notch insets emulated), replayed so Skip is there:
//  - Skip has its own lane: on screen, ≥44 CSS px to the finger, never under FUSE's caption;
//    the caption is ~14 px. mobile-7-ending: one instruction only: "Plays by itself" is bare
//    text (no pill, no taps) and the caption has no "Tap to continue".
//  - mobile-7-ending: the chat is bottom-anchored (the newest message at the foot of the log),
//    a channel opens on its start block right above the first message, and the end card's
//    title band clears the top, the slip clears the title, and the clipboard is uncut.
//  - The hangout is one conversation: messages use ≥80% of the screen's usable width, nothing
//    in them is cut off, text is ~14 px, and the form's "Builder, then foreman" stays on one line.
//  - Tapping Skip goes to the end card, whose controls are ≥40 drawn / ≥44 to the finger,
//    clear of each other and of the clipboard.

const PHONES = [
  { name: 'iphone', width: 844, height: 340, inset: 47 },
  { name: 'se', width: 667, height: 320, inset: 0 },
  { name: 'promax', width: 932, height: 380, inset: 59 },
  { name: 'android', width: 915, height: 360, inset: 0 },
] as const;

// biome-ignore lint/suspicious/noExplicitAny: dev handle
type G = any;
type Box = { l: number; t: number; r: number; b: number };

test.setTimeout(240_000);

async function insets(page: Page, px: number) {
  if (!px) return;
  await page.addInitScript((px) => {
    const s = document.createElement('style');
    s.textContent = `#app { left: ${px}px !important; right: ${px}px !important; }`;
    document.addEventListener('DOMContentLoaded', () => document.head.append(s));
  }, px);
}

/**
 * Everything that matters sits inside the safe area (#app is inset by env(safe-area-inset-*),
 * emulated here): every visible match of `sels` must lie within the app's box. Backgrounds may
 * bleed; text, avatars, chips, fields and controls may not.
 */
async function insideSafeArea(page: Page, sels: string[], where: string) {
  const out = await page.evaluate((sels) => {
    const a = document.querySelector('#app')!.getBoundingClientRect();
    const bad: string[] = [];
    let n = 0;
    for (const sel of sels) {
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (el.closest('[hidden]')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
        n++;
        if (
          r.left < a.left - 0.5 ||
          r.right > a.right + 0.5 ||
          r.top < a.top - 0.5 ||
          r.bottom > a.bottom + 0.5
        ) {
          bad.push(
            `${sel} ${r.left.toFixed(0)}..${r.right.toFixed(0)} (safe ${a.left}..${a.right})`,
          );
        }
      }
    }
    return { bad, n };
  }, sels);
  expect(out.n, `${where}: nothing measured`).toBeGreaterThan(0);
  expect(out.bad, `${where}: outside the safe area`).toEqual([]);
}

const meets = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/** Box of a selector's first visible match, client px, or null. */
function boxOf(page: Page, sel: string) {
  return page.evaluate((sel) => {
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('[hidden]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    }
    return null;
  }, sel);
}

/** The usable screen: #app (inside the emulated safe areas). */
const appBox = (page: Page) => boxOf(page, '#app') as Promise<Box>;

/** Drawn size and finger size (the phone ::before target) of a control. */
function control(page: Page, sel: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)!;
    const r = el.getBoundingClientRect();
    // Computed sizes are CSS px (one overlay, no transform).
    const b = getComputedStyle(el, '::before');
    const hit =
      b.content && b.content !== 'none'
        ? {
            w: Math.max(r.width, parseFloat(b.width)),
            h: Math.max(r.height, parseFloat(b.height)),
          }
        : { w: r.width, h: r.height };
    return { box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, w: r.width, h: r.height, hit };
  }, sel);
}

for (const vp of PHONES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test(`ending, hangout and end card fit a ${vp.name} (${vp.width}×${vp.height})`, async ({
      page,
    }) => {
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
      // A replay (everything already solved), so Skip is offered.
      await page.evaluate(
        (all) => {
          const g = (window as G).__game;
          g.save.update((d: G) => {
            d.flags.hallIntro = true;
            d.settings.captionSpeed = 'instant';
            d.progress.solved = all;
            d.puzzles = {};
          });
          g.flow.continueGame();
          g.flow.openPuzzle('the-last-rune');
          g.flow.completePuzzle('the-last-rune');
          g.flow.finishSolve();
        },
        MACHINE_IDS as unknown as string[],
      );
      const app = await appBox(page);
      // The notch insets really applied (the app's box is inset), so the checks below mean it.
      expect(app.l).toBeCloseTo(vp.inset, 0);
      expect(app.r).toBeCloseTo(vp.width - vp.inset, 0);

      // ── FUSE's caption and Skip ─────────────────────────────────────────
      const skip = page.locator('.lr-end-skip');
      await expect(skip).toBeVisible();
      await expect(page.locator('.tc-caption:not([hidden])')).toBeVisible({ timeout: 30_000 });
      await waitFrames(page, 4);
      const sk = await control(page, '.lr-end-skip');
      expect(sk.hit.w).toBeGreaterThanOrEqual(43.5);
      expect(sk.hit.h).toBeGreaterThanOrEqual(43.5);
      expect(sk.box.l).toBeGreaterThanOrEqual(app.l - 0.5);
      expect(sk.box.r).toBeLessThanOrEqual(app.r + 0.5);
      expect(sk.box.t).toBeGreaterThanOrEqual(app.t - 0.5);
      await insideSafeArea(
        page,
        ['.lr-end-skip', '.tc-caption', '.tc-caption-text'],
        'ending caption and Skip',
      );
      const cap = (await boxOf(page, '.tc-caption'))!;
      expect(meets(cap, sk.box), 'the caption covers Skip').toBe(false);
      expect(cap.r, 'the caption ends before the Skip lane').toBeLessThanOrEqual(sk.box.l);
      const capText = await page.evaluate(() => {
        const t = document.querySelector('.tc-caption-text')!;
        const body = document.querySelector('.tc-caption-body')!;
        return {
          size: parseFloat(getComputedStyle(t).fontSize),
          cue: getComputedStyle(body, '::after').content,
        };
      });
      expect(capText.size).toBeGreaterThanOrEqual(13.5);
      expect(capText.cue, 'a second instruction under the caption').not.toContain('Tap');
      // "Plays by itself" is a plain caption: no fill, no border, takes no taps.
      const cue = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.lr-end-cue');
        if (!el || el.hidden) return null;
        const cs = getComputedStyle(el);
        return {
          text: el.textContent,
          bg: cs.backgroundColor,
          border: cs.borderTopWidth,
          pe: cs.pointerEvents,
        };
      });
      expect(cue?.text).toBe('Plays by itself');
      expect(cue?.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect(cue?.border).toBe('0px');
      expect(cue?.pe).toBe('none');
      // Skip is on top where it sits: a finger on it lands on it.
      const onSkip = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return !!el?.closest('.lr-end-skip');
        },
        { x: (sk.box.l + sk.box.r) / 2, y: (sk.box.t + sk.box.b) / 2 },
      );
      expect(onSkip).toBe(true);

      // ── The hangout: one conversation ───────────────────────────────────
      const hg = page.locator('.lr-hg');
      await expect(hg).toBeVisible({ timeout: 120_000 });
      await expect(hg.locator('.lr-hg-side')).toBeHidden();
      await expect(hg.locator('.lr-hg-top')).toContainText('ThunderClap Gaming');
      await expect(hg.locator('.lr-hg-form')).toBeVisible({ timeout: 60_000 });
      await waitFrames(page, 20);
      const chat = await page.evaluate(() => {
        const log = document.querySelector<HTMLElement>('.lr-hg-log:not([hidden])')!;
        const lr = log.getBoundingClientRect();
        const msgs = [
          ...log.querySelectorAll<HTMLElement>(':scope > .lr-hg-msg, :scope > .lr-hg-sys'),
        ];
        const cut: string[] = [];
        for (const el of log.querySelectorAll<HTMLElement>(
          '.lr-hg-text, .lr-hg-meta, .lr-hg-form p, .lr-hg-sys',
        )) {
          if (el.scrollWidth > el.clientWidth + 1) cut.push(el.textContent ?? '');
        }
        const rows = msgs.map((m) => {
          const r = m.getBoundingClientRect();
          return { w: r.width, t: r.top, b: r.bottom, l: r.left, r: r.right };
        });
        const form = [...log.querySelectorAll<HTMLElement>('.lr-hg-form p')].map((p) => ({
          text: p.textContent ?? '',
          h: p.getBoundingClientRect().height,
          lh: parseFloat(getComputedStyle(p).lineHeight),
        }));
        const text = parseFloat(getComputedStyle(log.querySelector('.lr-hg-text')!).fontSize);
        const skip = document.querySelector('.lr-end-skip')!.getBoundingClientRect();
        const top = document.querySelector('.lr-hg-top')!.getBoundingClientRect();
        const compose = document.querySelector('.lr-hg-compose')!.getBoundingClientRect();
        const typing = document.querySelector('.lr-hg-typing')!.getBoundingClientRect();
        return {
          log: { t: lr.top, b: lr.bottom, l: lr.left, r: lr.right },
          rows,
          cut,
          form,
          text,
          skip: { l: skip.left, t: skip.top, r: skip.right, b: skip.bottom },
          top: { l: top.left, t: top.top, r: top.right, b: top.bottom },
          composeTop: compose.top,
          typingBottom: typing.bottom,
          vw: window.innerWidth,
        };
      });
      expect(chat.cut, 'cut-off text in the chat').toEqual([]);
      expect(chat.text).toBeGreaterThanOrEqual(13.5);
      expect(chat.rows.length).toBeGreaterThan(1);
      for (const r of chat.rows) {
        expect(r.w, 'a message narrower than 80% of the screen').toBeGreaterThanOrEqual(
          0.8 * (app.r - app.l),
        );
        expect(r.l).toBeGreaterThanOrEqual(app.l - 0.5);
        expect(r.r).toBeLessThanOrEqual(app.r + 0.5);
        // Never cut at the bottom: older messages may only leave through the top.
        expect(r.b).toBeLessThanOrEqual(chat.log.b + 0.5);
      }
      // The newest message is wholly on screen, at the foot of the log (no empty band under it).
      expect(chat.rows.at(-1)!.t).toBeGreaterThanOrEqual(chat.log.t);
      expect(chat.log.b - chat.rows.at(-1)!.b, 'empty chat under the newest message').toBeLessThan(
        12,
      );
      // "Builder, then foreman" (and every form line) on one line.
      expect(chat.form.length).toBe(3);
      for (const f of chat.form) expect(f.h, f.text).toBeLessThan(f.lh * 1.5);
      // The typing line sits above the message bar; Skip sits in the header, over no message.
      expect(chat.typingBottom).toBeLessThanOrEqual(chat.composeTop + 0.5);
      expect(chat.skip.b).toBeLessThanOrEqual(chat.top.b + 0.5);
      await insideSafeArea(
        page,
        [
          '.lr-hg-top > *',
          '.lr-hg-log:not([hidden]) .lr-hg-av',
          '.lr-hg-log:not([hidden]) .lr-hg-meta',
          '.lr-hg-log:not([hidden]) .lr-hg-text',
          '.lr-hg-log:not([hidden]) .lr-hg-form',
          '.lr-hg-log:not([hidden]) .lr-hg-reacts',
          '.lr-hg-log:not([hidden]) .lr-hg-sys',
          '.lr-hg-typing',
          '.lr-hg-compose',
          '.lr-end-skip',
        ],
        'hangout',
      );
      // The header has no dead controls (D-027): no chevron, and the unread count is plain text.
      expect(await hg.locator('.lr-hg-back').count()).toBe(0);
      // mobile-5-chrome: no unread count at all (nothing in a read-only channel is "unread").
      await expect(hg.locator('.lr-hg-badge-count')).toBeHidden();
      // mobile-4-chrome: nothing in the hangout takes focus or looks typeable; the bar reads
      // "Read-only channel". mobile-7-ending: the channel's start block ("Welcome to #x!")
      // is back, as a chat app draws it: one at most, right above the first message.
      const inert = await page.evaluate(() => {
        const hg = document.querySelector('.lr-hg')!;
        const focusable = [
          ...hg.querySelectorAll<HTMLElement>(
            'input, textarea, select, [contenteditable], [tabindex]:not([tabindex="-1"])',
          ),
        ].map((e) => e.outerHTML.slice(0, 60));
        const bar = document.querySelector('.lr-hg-compose')!;
        return {
          focusable,
          bar: bar.hasAttribute('data-typing')
            ? 'typing'
            : getComputedStyle(bar, '::before').content,
          starts: [...hg.querySelectorAll<HTMLElement>('.lr-hg-start')]
            .filter((e) => e.getClientRects().length > 0)
            .map((e) => {
              const r = e.getBoundingClientRect();
              const next = e.nextElementSibling?.getBoundingClientRect();
              return { b: r.bottom, nextT: next?.top ?? r.bottom };
            }),
        };
      });
      expect(inert.focusable, 'focusable controls in the hangout').toEqual([]);
      if (inert.bar !== 'typing') expect(inert.bar).toContain('Read-only channel');
      expect(inert.starts.length, 'a repeated channel start block').toBeLessThanOrEqual(1);
      for (const st of inert.starts) {
        expect(st.nextT - st.b, 'start block apart from the first message').toBeGreaterThanOrEqual(
          -0.5,
        );
        expect(st.nextT - st.b, 'start block apart from the first message').toBeLessThan(24);
      }
      expect(meets(chat.skip, chat.log)).toBe(false);

      // ── Skip still works by finger: on to the end card ──────────────────
      await skip.tap();
      const join = page.locator('.lr-end-card a.lr-end-join');
      await expect(join).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.lr-end-card')).toHaveAttribute('data-in', '');
      await page.waitForTimeout(1400);
      const sels = [
        '.lr-end-card a.lr-end-join',
        '.lr-end-card a.lr-end-coffee',
        '.lr-end-card .tc-link-copy',
        '.lr-end-card .lr-end-links:last-of-type .tc-link-copy',
        '.lr-end-card .lr-end-back',
      ];
      const boxes: Box[] = [];
      for (const sel of sels) {
        const c = await control(page, sel);
        expect(c.h, `${sel} drawn height`).toBeGreaterThanOrEqual(39.5);
        expect(c.hit.h, `${sel} hit height`).toBeGreaterThanOrEqual(43.5);
        expect(c.hit.w, `${sel} hit width`).toBeGreaterThanOrEqual(43.5);
        expect(c.box.l).toBeGreaterThanOrEqual(app.l);
        expect(c.box.r).toBeLessThanOrEqual(app.r);
        expect(c.box.t).toBeGreaterThanOrEqual(app.t);
        expect(c.box.b).toBeLessThanOrEqual(app.b);
        boxes.push(c.box);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (sels[i] === sels[j]) continue;
          expect(meets(boxes[i]!, boxes[j]!), `${sels[i]} meets ${sels[j]}`).toBe(false);
        }
      }
      // mobile-4-chrome: each Copy button names its link; the closing line reads ≥4.5:1.
      const copies = await page.locator('.lr-end-card .tc-link-copy').allTextContents();
      expect(copies.map((t) => t.trim())).toEqual(['Copy invite link', 'Copy Ko-fi link']);
      const contrast = await page.evaluate(() => {
        const f = document.querySelector('.lr-end-footer')!;
        const cs = getComputedStyle(f);
        const rgba = (c: string) => {
          const n = c.match(/[\d.]+/g)!.map(Number);
          return [n[0]!, n[1]!, n[2]!, n[3] ?? 1] as const;
        };
        const lum = (r: number, g: number, b: number) => {
          const ch = (v: number) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
        };
        const [tr, tg, tb] = rgba(cs.color);
        // mobile-6-chrome: the line is plain text on the card's dark plate.
        const [br, bg, bb, ba] = rgba(getComputedStyle(f.parentElement!).backgroundColor);
        // The plate over the brightest gold behind it (worst case).
        const gold = [255, 214, 120];
        const mix = (v: number, i: number) => v * ba + gold[i]! * (1 - ba);
        const lt = lum(tr, tg, tb);
        const lb = lum(mix(br, 0), mix(bg, 1), mix(bb, 2));
        return (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05);
      });
      expect(contrast, 'end card closing line contrast').toBeGreaterThanOrEqual(4.5);
      // mobile-6-chrome: the card is centred on the screen, Join first in a two-column grid
      // (each link's Copy beside it), the closing line and Back across both columns.
      const card = (await boxOf(page, '.lr-end-card'))!;
      expect(
        Math.abs((card.l + card.r) / 2 - (app.l + app.r) / 2),
        'end card off centre',
      ).toBeLessThanOrEqual(2);
      const [joinB, coffeeB, inviteB, kofiB, backB] = boxes;
      expect(joinB!.l).toBeLessThan(inviteB!.l);
      expect(Math.abs(joinB!.t - inviteB!.t)).toBeLessThanOrEqual(1);
      expect(Math.abs(joinB!.l - coffeeB!.l)).toBeLessThanOrEqual(1);
      expect(Math.abs(inviteB!.l - kofiB!.l)).toBeLessThanOrEqual(1);
      expect(coffeeB!.t).toBeGreaterThan(joinB!.b);
      expect(Math.abs((backB!.l + backB!.r) / 2 - (card.l + card.r) / 2)).toBeLessThanOrEqual(2);
      // The title's lines sit on their dark band (no gold showing between the lines).
      const band = await page.evaluate(
        () =>
          getComputedStyle(document.querySelector('.lr-end-title')!, '::before').backgroundColor,
      );
      expect(band).toMatch(/rgba?\(24, 12, 3/);
      // mobile-7-ending: the title band has room above it (>=8 px), the Safety record slip
      // clears the band, the card clears the slip, and the card ends on screen.
      const col = await page.evaluate(() => {
        const t = document.querySelector<HTMLElement>('.lr-end-title')!;
        const r = t.getBoundingClientRect();
        const cs = getComputedStyle(t, '::before'); // CSS px (one overlay, no transform)
        const s = document.querySelector('.lr-end-safety')!.getBoundingClientRect();
        return {
          bandT: r.top + parseFloat(cs.top),
          bandB: r.bottom - parseFloat(cs.bottom),
          safetyT: s.top,
          safetyB: s.bottom,
        };
      });
      expect(col.bandT - app.t, 'title band against the top edge').toBeGreaterThanOrEqual(8);
      expect(
        col.safetyT - col.bandB,
        'Safety record slip touches the title',
      ).toBeGreaterThanOrEqual(4);
      expect(card.t - col.safetyB, 'end card touches the slip').toBeGreaterThanOrEqual(4);
      expect(card.b).toBeLessThanOrEqual(app.b);
      // The clipboard stays a prop: clear of every control, with room to spare.
      const clip = (await boxOf(page, '.lr-clip-note'))!;
      // ...and whole: its page (and so the board around it) stays well inside the screen.
      expect(clip.r, 'clipboard cut at the right').toBeLessThanOrEqual(vp.width - 16);
      expect(clip.b, 'clipboard cut at the bottom').toBeLessThanOrEqual(vp.height - 10);
      for (const b of boxes) {
        const grown = { l: b.l - 12, t: b.t - 4, r: b.r + 12, b: b.b + 4 };
        expect(meets(grown, clip), 'a control crowds the clipboard').toBe(false);
      }
      await insideSafeArea(
        page,
        [
          '.lr-end-title > *',
          '.lr-end-safety',
          '.lr-end-card > *',
          '.lr-end-card a',
          '.lr-end-card button',
          '.lr-clip-note',
        ],
        'end card',
      );
      // Nothing scrolls.
      const scroll = await page.evaluate(() => ({
        x: document.scrollingElement!.scrollWidth - window.innerWidth,
        y: document.scrollingElement!.scrollHeight - window.innerHeight,
      }));
      expect(scroll.x).toBeLessThanOrEqual(0);
      expect(scroll.y).toBeLessThanOrEqual(0);
    });
  });
}
