/** The title on phones: the Ko-fi and Copy link row and the release tag, compact. */
import { cpx, P, tpx } from '../../ui/phone-base';

export const TITLE_PHONE_CSS = /* css */ `
${P} .tc-link-copy, ${P} .tc-link-message { font-size: ${tpx(11)}; padding: ${cpx(2)} ${cpx(8)}; }
${P} .lr-title-links { right: ${cpx(6)}; bottom: ${cpx(4)}; gap: ${cpx(6)}; }
${P} .lr-title-coffee { min-height: ${cpx(24)}; padding: 0 ${cpx(8)}; font-size: ${tpx(11)}; }
${P} .lr-release { font-size: ${tpx(11)}; }
`;
