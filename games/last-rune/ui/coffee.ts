/**
 * The Ko-fi link (D-034), used on the title and the end card. A plain link: it opens
 * only on the player's click, in a new tab, with no referrer and no opener. No widget,
 * script, iframe or remote image; the cup icon is drawn here as inline SVG.
 */
import { h } from '@engine/ui';
import type { EndingButton } from '../content/ending';

const SVG = 'http://www.w3.org/2000/svg';

/** A steaming cup on a saucer, stroked in the link's text colour. */
function cupIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'lr-coffee-icon');
  const paths = [
    // Steam.
    'M12 3c-2 2.2 2 3.8 0 6.5',
    'M17.5 3c-2 2.2 2 3.8 0 6.5',
    // Cup, handle and saucer.
    'M6 13h17v6.5a6.5 6.5 0 0 1-6.5 6.5h-4A6.5 6.5 0 0 1 6 19.5z',
    'M23 15h1.8a3.2 3.2 0 0 1 0 6.4H22.4',
    'M3.5 29h22',
  ];
  for (const d of paths) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  return svg;
}

/** The Ko-fi anchor with its cup icon. `action` names it for tests (`data-action`). */
export function coffeeAnchor(link: EndingButton, cls: string, action: string): HTMLAnchorElement {
  const a = h(
    'a',
    {
      class: cls,
      href: link.href,
      target: '_blank',
      rel: 'noopener noreferrer',
      dataset: { action },
    },
    h('span', null, link.label),
  );
  a.prepend(cupIcon());
  return a;
}
