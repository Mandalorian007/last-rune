/**
 * The Ko-fi link (D-034), used on the title and the end card, built with the engine's
 * external-link widget (D-036): a plain new-tab link plus Copy link. It opens only on the
 * player's action. No third-party widget, script, iframe or remote image; the cup icon is
 * drawn here as inline SVG.
 */
import {
  type ExternalLink,
  type ExternalLinkLabels,
  externalLink,
  h,
} from '@thunderclap/engine/ui';
import { type EndingButton, LINK_COPY_TEXT } from '../content/ending';

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

/** The engine link labels with Last Rune's wording; `name` finishes "Copy link to <name>". */
export function linkLabels(name: string): ExternalLinkLabels {
  return { ...LINK_COPY_TEXT, copyAriaLabel: `${LINK_COPY_TEXT.copy} to ${name}` };
}

/**
 * The Ko-fi link (cup icon + label) with Copy link, as the engine widget. `action` names its parts
 * for tests (`data-action`); `cls` goes on the anchor, `wrap` on the wrapper.
 */
export function coffeeLinkWidget(
  link: EndingButton,
  opts: {
    cls: string;
    wrap: string;
    action: string;
    place: 'above' | 'below';
    align: 'center' | 'end';
    /** Copy button text, if it must say which link it copies (phone end card). */
    copy?: string;
  },
): ExternalLink | null {
  return externalLink({
    url: link.href,
    content: [cupIcon(), h('span', null, link.label)],
    labels: { ...linkLabels("ThunderSoap's Ko-fi"), ...(opts.copy ? { copy: opts.copy } : {}) },
    linkClass: opts.cls,
    className: opts.wrap,
    action: opts.action,
    place: opts.place,
    align: opts.align,
  });
}
