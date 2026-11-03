/**
 * A "Copy link" button beside each outbound link (Join ThunderClap Gaming, Ko-fi), for when a
 * browser blocks the new tab or the player would rather paste the link somewhere.
 *
 * - Copy writes the link's own href, only on the player's press: `navigator.clipboard.writeText`,
 *   then `execCommand('copy')` (see `copyText`). On success the button reads "Copied!" for a
 *   moment and a live region says so. If both fail, a read-only field with the link appears,
 *   selected, so it can be copied by hand. It never fails silently.
 * - `openInNewTab` is the gamepad path (menu-nav): a pad press is not a user gesture, so the
 *   browser may block the new tab. When `window.open` gives null, the same field appears
 *   with "Your browser blocked the new tab." Mouse clicks and Enter stay native link clicks.
 *
 * No network calls; the URL comes from the anchor (which comes from content/ending.ts).
 */
import { h } from '@engine/ui';
import { LINK_COPY_TEXT } from '../content/ending';

const SVG = 'http://www.w3.org/2000/svg';
const COPIED_MS = 2200;
const POPUP_BLOCKED_EVENT = 'lr-popup-blocked';

/** Two overlapping sheets, stroked in the button's text colour. */
function copyIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'lr-copy-icon');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of ['M8 8h11v13H8z', 'M5 16H4V3h11v1']) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

/**
 * Copies `text`, in order: the async Clipboard API; then a hidden textarea and
 * `execCommand('copy')` (itch's iframe has no `clipboard-write` in its allow list, so Chrome and
 * Edge reject writeText there: https://github.com/itchio/itch.io/issues/1202); else false.
 * Call from the click handler: both need the player's gesture.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused (permissions policy, no focus, no gesture): try the old way.
  }
  return execCopy(text);
}

function execCopy(text: string): boolean {
  const prev = document.activeElement as HTMLElement | null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  prev?.focus({ preventScroll: true });
  return ok;
}

let fieldIds = 0;

/**
 * Wraps `anchor` with a Copy link button and its fallback field (a small popover that covers
 * what is below or above it rather than pushing the screen around; Close or Escape hides it). `name` finishes the button's
 * accessible name ("Copy link to <name>"); `action` names the parts for tests
 * (`<action>-copy`, `<action>-fallback`).
 */
export function withCopyLink(
  anchor: HTMLAnchorElement,
  opts: { name: string; action: string; cls: string },
): HTMLElement {
  const url = anchor.href;
  const label = h('span', null, LINK_COPY_TEXT.copy);
  const button = h(
    'button',
    {
      type: 'button',
      class: 'lr-copy-link',
      'aria-label': `${LINK_COPY_TEXT.copy} to ${opts.name}`,
      dataset: { action: `${opts.action}-copy` },
    },
    label,
  );
  button.prepend(copyIcon());

  const id = `lr-link-field-${++fieldIds}`;
  const message = h('label', { for: id }, '');
  const field = h('input', {
    id,
    type: 'text',
    readonly: true,
    value: url,
    spellcheck: 'false',
    autocomplete: 'off',
    class: 'lr-link-field',
    on: { focus: () => field.select(), click: () => field.select() },
  });
  const close = h(
    'button',
    {
      type: 'button',
      class: 'lr-link-close',
      dataset: { action: `${opts.action}-close` },
      on: { click: () => hideFallback() },
    },
    LINK_COPY_TEXT.close,
  );
  const fallback = h(
    'div',
    {
      class: 'lr-link-fallback',
      dataset: { action: `${opts.action}-fallback` },
      on: {
        keydown: (e) => {
          if (e.key !== 'Escape') return;
          e.preventDefault();
          e.stopPropagation();
          hideFallback();
        },
      },
    },
    h('div', { class: 'lr-link-fallback-head' }, message, close),
    field,
  );
  fallback.hidden = true;
  const live = h('span', { class: 'tc-sr-only', 'aria-live': 'polite' }, '');

  let resetTimer = 0;
  const announce = (text: string) => {
    // Cleared first, so saying the same thing twice is still read.
    live.textContent = '';
    window.setTimeout(() => {
      live.textContent = text;
    }, 60);
  };
  const showFallback = (text: string) => {
    message.textContent = text;
    field.value = url;
    fallback.hidden = false;
    field.focus({ preventScroll: true });
    field.select();
    announce(text);
  };
  /** Closes the field (Close or Escape) and puts focus back on Copy link. */
  const hideFallback = () => {
    fallback.hidden = true;
    button.focus({ preventScroll: true });
  };

  button.addEventListener('click', async () => {
    if (!(await copyText(url))) {
      showFallback(LINK_COPY_TEXT.copyBlocked);
      return;
    }
    label.textContent = LINK_COPY_TEXT.copied;
    button.dataset.copied = '';
    announce(LINK_COPY_TEXT.copiedAnnounce);
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      label.textContent = LINK_COPY_TEXT.copy;
      delete button.dataset.copied;
    }, COPIED_MS);
  });
  anchor.addEventListener(POPUP_BLOCKED_EVENT, () => showFallback(LINK_COPY_TEXT.popupBlocked));

  return h(
    'div',
    { class: `lr-outbound ${opts.cls}` },
    h('div', { class: 'lr-outbound-row' }, anchor, button),
    fallback,
    live,
  );
}

/**
 * Opens a new-tab link from script (the gamepad path) and reports whether it opened. When the
 * browser blocks it, the link's Copy field shows instead. The new tab gets no opener.
 */
export function openInNewTab(a: HTMLAnchorElement): boolean {
  let w: Window | null = null;
  try {
    // Not 'noopener' as a feature: that makes window.open return null even when it worked.
    w = window.open(a.href, '_blank');
  } catch {
    w = null;
  }
  if (!w) {
    a.dispatchEvent(new CustomEvent(POPUP_BLOCKED_EVENT));
    return false;
  }
  try {
    w.opener = null;
  } catch {
    // Some browsers make it read-only; the tab is open either way.
  }
  return true;
}

/** True for a link that opens in a new tab (the ones menu-nav opens via `openInNewTab`). */
export function isNewTabLink(el: Element): el is HTMLAnchorElement {
  return el instanceof HTMLAnchorElement && el.target === '_blank' && !!el.href;
}
